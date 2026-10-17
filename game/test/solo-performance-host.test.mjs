import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { readFile } from 'node:fs/promises';
import { PNGImage } from './helpers/png-image.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
const pictures = { Image: PNGImage };
const fetchResponse = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
async function start(page) {
  page.$('start-button').click();
  try {
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Prepared frame must precede play',
      { timeoutMs: 20000 },
    );
  } catch (error) {
    error.message += `\n${JSON.stringify({
      level: page.rendered.run.levelId,
      runStatus: page.rendered.run.status,
      body: page.doc.body.dataset,
      overlay: page.$('game-overlay').dataset,
      preparation: page.$('flight-preparation-status').textContent,
      preparationState: page.$('flight-preparation-status').dataset,
      start: page.$('start-button').dataset,
      focus: page.doc.activeElement?.id,
      errors: page.errors.map((value) => String(value?.stack ?? value)),
    })}`;
    throw error;
  }
  page.frame(0);
}
test('manual diagnostics expose separate retained PCM and declared reservations without starting audio', async (t) => {
  const audio = audioHarness();
  let contexts = 0;
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    audio,
    search: '?journey=opening&performance=1',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    browserSetup: ({ globals }) => {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
      globals.AudioContext = function () {
        contexts++;
        return audio.context;
      };
    },
  });
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  assert.equal(contexts, 0);
  const report = page.win.RevealLineSoloPerformance.export();
  assert.equal(report.resources.pcm.effects.decodedBytes, 0);
  assert.equal(report.resources.pcm.effects.decodedBytesLimit, 32 * 1024 * 1024);
  assert.equal(report.resources.pcm.reactions.decodedBytes, 0);
  assert.equal(report.resources.pcm.reactions.decodedBytesLimit, 12 * 1024 * 1024);
  assert.equal(report.resources.pcm.proceduralNoise.decodedBytes, 0);
  assert.match(report.resources.pcm.accounting, /retain evicted buffers/);
  assert.match(report.resources.media.reservationAccounting, /not measured native allocation/);
  assert.equal(contexts, 0);
  assert.equal(audio.sources.length, 0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
test('direct Start prepares a paused board without browsing other mission owners; repeated resume retains the run', async (t) => {
  const requests = [];
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    search: '?journey=opening',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchJSON: (path) => {
      requests.push(String(path));
    },
  });
  const run = page.rendered.run;
  await start(page);
  assert.equal(page.rendered.run, run);
  assert.ok(
    !requests.some((path) => path.includes('mission-library-index')),
    'Starting the accepted Journey must not construct the unified browser',
  );
  for (let i = 0; i < 20; i++) {
    page.$('pause-button').click();
    const checkpoint = authoritativeCheckpoint(run);
    page.frame(500);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    await start(page);
    assert.equal(page.rendered.run, run);
  }
  assert.deepEqual(page.errors, []);
});
test(
  'ordinary Solo constructs Missions and its backup only on the first public browse, then reuses both',
  { timeout: 90000 },
  async (t) => {
    const dialogs = [],
      requests = [];
    let exportedBackup = null;
    const page = await soloPage(t, {
      search: '',
      titleScreen: true,
      pictures,
      fetchResponse,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchJSON: (path) => {
        requests.push(String(path));
      },
      browserSetup({ document, globals }) {
        const create = document.createElement.bind(document);
        document.createElement = (tag, ...args) => {
          const element = create(tag, ...args);
          if (String(tag).toLowerCase() === 'dialog') {
            assert(dialogs.length < 128, 'Keep the modeled owner inventory bounded.');
            dialogs.push(element);
          }
          return element;
        };
        globals.URL = class extends globals.URL {
          static createObjectURL(blob) {
            if (blob.type === 'application/json') {
              assert(blob.size < 1024 * 1024, 'Keep the fresh profile export bounded.');
              exportedBackup = blob;
            }
            return super.createObjectURL(blob);
          }
        };
      },
    });
    const missionOwners = () =>
      dialogs.filter((node) => ['journey-chooser', 'journey-backup'].includes(node.id));
    const catalogue = page.$('missions-catalogue'),
      catalogueHandler = catalogue.onclick;
    assert.equal(typeof catalogueHandler, 'function');
    assert.equal(page.$('journey-chooser'), null);
    assert.equal(page.$('journey-backup'), null);
    assert.deepEqual(missionOwners(), []);
    page.$('shell-featured').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Direct Start must prepare the accepted attempt',
      { timeoutMs: 20000 },
    );
    page.frame(0);
    const run = page.rendered.run;
    assert.equal(run.levelId, 'first-return');
    assert.deepEqual(missionOwners(), []);
    assert(!requests.some((path) => path.includes('mission-library-index')));
    page.$('shell-menu').click();
    const checkpoint = authoritativeCheckpoint(run);
    await openMissionLibrary(page, 'shell-play');
    const chooser = page.$('journey-chooser'),
      backup = page.$('journey-backup');
    assert.deepEqual(missionOwners(), [chooser, backup]);
    assert(page.$('journey-collection'), 'The first mounted chooser is the unified browser.');
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.$('missions-catalogue'), catalogue);
    assert.equal(catalogue.onclick, catalogueHandler);
    const backupButton = page.$('journey-backup-open');
    backupButton.focus();
    backupButton.click();
    assert.equal(backup.open, true);
    assert.equal(page.doc.activeElement, page.$('journey-backup-export'));
    await page.$('journey-backup-export').onclick();
    assert(exportedBackup, 'Use the actual scoped profile export, retaining its edition identity.');
    const raw = await exportedBackup.text();
    page.$('journey-backup-file').files = [{ size: Buffer.byteLength(raw), text: async () => raw }];
    await page.$('journey-backup-file').onchange();
    assert.equal(
      page.$('journey-backup-apply').disabled,
      false,
      page.$('journey-backup-status').textContent,
    );
    await page.$('journey-backup-apply').onclick();
    assert.match(page.$('journey-backup-status').textContent, /Merged and saved locally/);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    page.$('journey-backup-back').click();
    assert.equal(backup.open, false);
    assert.equal(page.doc.activeElement, backupButton);
    page.$('journey-back').click();
    assert.equal(chooser.open, false);
    assert.equal(page.doc.activeElement, page.$('shell-play'));
    await openMissionLibrary(page, 'shell-play');
    assert.equal(page.$('journey-chooser'), chooser);
    assert.equal(page.$('journey-backup'), backup);
    assert.deepEqual(missionOwners(), [chooser, backup]);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(page.errors, []);
  },
);
test('ordinary Solo creates optional Worlds only on public opening and reuses its lifecycle owner', async (t) => {
  const dialogs = [],
    requests = [];
  const page = await soloPage(t, {
    search: '',
    titleScreen: true,
    pictures,
    fetchResponse,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchJSON: (path) => {
      requests.push(String(path));
    },
    browserSetup({ document }) {
      const create = document.createElement.bind(document);
      document.createElement = (tag, ...args) => {
        const element = create(tag, ...args);
        if (String(tag).toLowerCase() === 'dialog') {
          assert(dialogs.length < 128, 'Keep the modeled owner inventory bounded.');
          dialogs.push(element);
        }
        return element;
      };
    },
  });
  const owners = () => dialogs.filter((node) => node.id === 'optional-worlds-dialog');
  assert.equal(page.$('optional-worlds-dialog'), null);
  assert.deepEqual(owners(), []);
  page.$('shell-featured').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Direct Start prepares the accepted attempt',
    {
      timeoutMs: 20000,
    },
  );
  page.frame(0);
  const run = page.rendered.run;
  assert.equal(run.levelId, 'first-return');
  assert.equal(page.$('optional-worlds-dialog'), null);
  assert.deepEqual(owners(), []);
  assert(!requests.some((path) => path.includes('optional-worlds')));
  const openWorlds = () => {
    page.$('settings-button').click();
    page.$('settings-tab-content').click();
    assert.equal(page.$('settings-panel-content').hidden, false);
    const opener = page.$('shell-worlds');
    assert.equal(opener.closest('#settings-panel-content'), page.$('settings-panel-content'));
    assert.equal(opener.hidden, false);
    opener.click();
  };
  openWorlds();
  const panel = page.$('optional-worlds-dialog'),
    checkpoint = authoritativeCheckpoint(run);
  assert.equal(panel.open, true, 'The explicit click creates and opens the owner synchronously.');
  assert.deepEqual(owners(), [panel]);
  await settle(
    () => !page.$('optional-worlds-reload').disabled,
    'Public Worlds inventory completes',
    {
      timeoutMs: 15000,
    },
  );
  assert.equal(page.doc.activeElement, page.$('optional-worlds-top-back'));
  page.$('optional-worlds-top-back').click();
  assert.equal(panel.open, false);
  openWorlds();
  assert.equal(page.$('optional-worlds-dialog'), panel);
  assert.deepEqual(owners(), [panel]);
  await settle(
    () => !page.$('optional-worlds-reload').disabled,
    'Public Worlds inventory reopens',
    {
      timeoutMs: 15000,
    },
  );
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  assert.equal(panel.open, false);
  assert.equal(panel.isConnected, true);
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  openWorlds();
  assert.equal(panel.open, true);
  page.win.emit('pagehide', { persisted: true });
  assert.equal(panel.open, false);
  assert.equal(panel.isConnected, true);
  const staleOpen = page.$('shell-worlds').onclick;
  page.win.emit('pagehide', { persisted: false });
  assert.equal(panel.isConnected, false);
  staleOpen();
  assert.equal(page.$('optional-worlds-dialog'), null);
  assert.deepEqual(owners(), [panel]);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});
test('retiring an unopened Solo page cannot create optional Worlds through a retained opener', async (t) => {
  const page = await soloPage(t, {
    search: '',
    titleScreen: true,
    pictures,
    fetchResponse,
    journeyIndexedDB: managedIndexedDB().indexedDB,
  });
  const staleOpen = page.$('shell-worlds').onclick,
    run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  assert.equal(typeof staleOpen, 'function');
  assert.equal(page.$('optional-worlds-dialog'), null);
  page.win.emit('pagehide', { persisted: false });
  staleOpen();
  assert.equal(page.$('optional-worlds-dialog'), null);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});
test('raw scene interruptions preserve exact 250ms boundary and never catch up hidden time', async (t) => {
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    search: '?journey=opening',
    journeyIndexedDB: managedIndexedDB().indexedDB,
  });
  await start(page);
  for (const gap of [100, 249, 250, 251, 500]) {
    const before = page.rendered.run.tick;
    page.frame(gap);
    if (gap <= 250) {
      assert.equal(page.doc.body.dataset.flightState, 'running');
      assert.equal(page.rendered.run.tick - before, Math.floor(((gap + 1e-7) * 120) / 1000));
      page.$('pause-button').click();
    } else {
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.equal(page.rendered.run.tick, before);
    }
    await start(page);
  }
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  page.frame(10000);
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  page.frame(1000);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  await start(page);
  page.frame(100);
  assert.equal(page.doc.body.dataset.flightState, 'running');
});

test('changing 30/40/45/60/90/120/144 Hz callbacks preserve fixed ticks and the exported replay', async (t) => {
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    search: '?journey=opening',
    journeyIndexedDB: managedIndexedDB().indexedDB,
  });
  await start(page);
  const reference = structuredClone(page.rendered.run);
  for (const hz of [30, 40, 45, 60, 90, 120, 144]) {
    const before = page.rendered.run.tick;
    // More than the former 120-callback smoothing cooldown at every cadence.
    for (let frame = 0; frame < hz * 5; frame++) page.frame(1000 / hz);
    for (let tick = 0; tick < 120 * 5; tick++) stepRun(reference, {}, FIXED_DT);
    assert.equal(page.rendered.run.tick - before, 600, `${hz} Hz keeps all real elapsed time`);
    assert.deepEqual(
      authoritativeCheckpoint(page.rendered.run),
      authoritativeCheckpoint(reference),
    );
  }
  const timers = [],
    urls = [];
  const timeout = globalThis.setTimeout;
  const createURL = URL.createObjectURL.bind(URL);
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = timeout(callback, delay, ...args);
    if (delay === 60000) {
      timer.unref();
      timers.push(timer);
    }
    return timer;
  });
  t.mock.method(URL, 'createObjectURL', (blob) => {
    const url = createURL(blob);
    urls.push(url);
    return url;
  });
  t.after(() => {
    timers.forEach(clearTimeout);
    urls.forEach((url) => URL.revokeObjectURL(url));
  });
  await page.$('export-replay').onclick();
  assert.equal(page.$('replay-dialog').open, true);
  const output = JSON.parse(page.$('replay-json').value);
  const replay = output.replay ?? output;
  assert.equal(verifyReplay(replay).match, true);
  assert.deepEqual(replay.checkpoint, authoritativeCheckpoint(reference));
  assert.deepEqual(page.errors, []);
});

test('canvas loss and restoration preserve the run until explicit Resume and fresh input', async (t) => {
  const canvases = [];
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    search: '?journey=opening',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    browserSetup({ document }) {
      const create = document.createElement.bind(document);
      document.createElement = (tag) => {
        const element = create(tag);
        if (tag === 'canvas') canvases.push(element);
        return element;
      };
    },
  });
  await start(page);
  // The finite Phaser boundary creates its displayed canvas through the DOM.
  // Trigger the real host listener, not its pause or restoration functions.
  const surface = canvases.find((canvas) => canvas.listeners.get('contextlost')?.size);
  assert.ok(surface, 'The displayed canvas must own context lifecycle listeners');
  page.key('ArrowDown');
  page.frame(100);
  const run = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(run);
  surface.emit('contextlost');
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  page.$('start-button').click();
  page.frame(1000);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  surface.emit('contextrestored');
  page.frame(10000);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  await start(page);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  const tick = run.tick;
  const reference = structuredClone(run);
  for (let i = 0; i < 12; i++) stepRun(reference, { direction: 'down' }, FIXED_DT);
  page.frame(100);
  assert.equal(run.tick, tick + 12, 'Only fresh active time may enter the fixed-step loop');
  assert.deepEqual(
    authoritativeCheckpoint(run),
    authoritativeCheckpoint(reference),
    'The accepted continuous-steering heading resumes through the ordinary core',
  );
  page.key('ArrowDown', false);
  page.key('ArrowRight');
  const neutral = structuredClone(reference);
  for (let i = 0; i < 12; i++) {
    stepRun(reference, { direction: 'right' }, FIXED_DT);
    stepRun(neutral, { direction: 'down' }, FIXED_DT);
  }
  page.frame(100);
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
  assert.notDeepEqual(
    authoritativeCheckpoint(run),
    authoritativeCheckpoint(neutral),
    'Fresh native input accepts a new turn',
  );
  page.key('ArrowRight', false);
  assert.deepEqual(page.errors, []);
});

test(
  'twenty earned-result Retry cycles retain one host and prepare fresh authoritative attempts',
  { timeout: 300_000 },
  async (t) => {
    const { rows } = JSON.parse(
      await readFile(new URL('./fixtures/candidate-solo-tuned-host-routes.json', import.meta.url)),
    );
    const [levelId, , , , segments] = rows[0];
    let hosts = 0;
    const page = await soloPage(t, {
      pictures,
      fetchResponse,
      search: '?journey=opening',
      storage: memoryStorage({
        [JOURNEY_PREFERENCES_KEY]: JSON.stringify({
          format: 'JourneyPreferencesV1',
          difficulty: 'standard',
        }),
      }),
      journeyIndexedDB: managedIndexedDB().indexedDB,
      browserSetup({ globals }) {
        const Game = globals.Phaser.Game;
        globals.Phaser.Game = class extends Game {
          constructor(config) {
            super(config);
            hosts++;
          }
        };
      },
    });
    await start(page);
    assert.equal(page.rendered.run.levelId, levelId);
    const initial = authoritativeCheckpoint(page.rendered.run);
    const artwork = structuredClone(page.rendered.backdrop.assetRevision);
    const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
    for (let attempt = 0; attempt < 20; attempt++) {
      const run = page.rendered.run;
      const reference = structuredClone(run);
      for (const [direction, ticks] of segments) {
        if (direction !== null) {
          page.key(keys[direction]);
          page.key(keys[direction], false);
        }
        let pending = 0;
        for (let tick = 0; tick < ticks; tick++) {
          stepRun(reference, { direction }, FIXED_DT);
          pending++;
          const closure = reference.events.some((event) => event.type === 'capture.stopped');
          if (closure || pending === 12 || tick === ticks - 1) {
            page.frame(pending * FIXED_DT * 1000);
            pending = 0;
            if (closure && tick < ticks - 1 && run.status !== 'won') {
              page.key(keys[direction]);
              page.key(keys[direction], false);
            }
          }
        }
      }
      assert.equal(
        run.status,
        'won',
        `Attempt ${attempt} must earn its result through native inputs`,
      );
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
      if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
      page.$('show-result').click();
      assert.equal(page.$('game-overlay').dataset.kind, 'won');
      assert.equal(page.$('retry-button').disabled, false);
      page.$('retry-button').click();
      await settle(
        () => page.rendered.run !== run && page.doc.body.dataset.flightState === 'running',
        `Retry ${attempt} must prepare and adopt a fresh attempt`,
        { timeoutMs: 20000 },
      );
      page.frame(0);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), initial);
      assert.deepEqual(page.rendered.backdrop.assetRevision, artwork);
      assert.equal(hosts, 1, 'Retries reuse the existing Phaser host and its lifecycle listeners');
    }
    assert.deepEqual(page.errors, []);
  },
);

test('uncreated soundtrack accounting retains bootstrap media and actual shared reservations', async (t) => {
  const { Soundscape } = await import('../ui/audio.mjs');
  const audio = audioHarness();
  t.after(() => audio.soundscape.dispose());
  let releaseBootstrap,
    capture,
    contexts = 0;
  const bootstrap = new Promise((resolve) => {
    releaseBootstrap = resolve;
  });
  t.after(() => releaseBootstrap());
  const original = Soundscape.prototype.resourceSnapshot;
  t.mock.method(Soundscape.prototype, 'resourceSnapshot', function () {
    capture = this;
    return original.call(this);
  });
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    audio,
    search: '?journey=opening&performance=1',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    browserSetup: ({ globals }) => {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
      globals.AudioContext = function () {
        contexts++;
        return audio.context;
      };
      globals.caches = {
        async open() {
          await bootstrap;
          return {
            match: async () => undefined,
            keys: async () => [],
            put: async () => {},
            delete: async () => false,
          };
        },
      };
    },
  });
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const fresh = page.win.RevealLineSoloPerformance.export().resources;
  assert.deepEqual(fresh.soundtrackOwner, {
    format: 'SoloOptionalOwnerStateV1',
    state: 'never-created',
    bootstrapMediaElementCreated: true,
  });
  assert(
    page.audioElements.length > 0,
    'An HTMLAudioElement really exists before the player constructor',
  );
  assert.deepEqual(fresh.soundtrack.inspection, {
    workerOwned: false,
    workerActive: false,
    workerOwnedBytes: 0,
    pendingRequests: 0,
  });
  assert.deepEqual(fresh.soundtrack.playback, {
    ownedBlobURLCount: 0,
    ownedBlobBytes: 0,
    failedRevocationCount: 0,
    failedRevocationBytes: 0,
    decks: [],
  });
  let finishDecode;
  const pending = capture.mediaPreparation.run(
    'decode',
    () =>
      new Promise((resolve) => {
        finishDecode = resolve;
      }),
    { bytes: 4096 },
  );
  await settle(() => !!finishDecode, 'Shared native decode has started');
  const held = page.win.RevealLineSoloPerformance.export().resources;
  assert.equal(held.soundtrackOwner.state, 'never-created');
  assert.equal(held.media.active.decode, 1);
  assert.equal(held.media.reservedDecodeBytes, 4096);
  const { reservationAccounting, ...shared } = held.media;
  assert.match(reservationAccounting, /not measured native allocation/);
  assert.deepEqual(held.soundtrack.admission, shared);
  assert.equal(held.soundtrack.playback.ownedBlobURLCount, 0);
  finishDecode();
  await pending;
  releaseBootstrap();
  await settle(() => !page.$('soundtrack-open').disabled, 'Actual player construction completes');
  const created = page.win.RevealLineSoloPerformance.export().resources;
  assert.equal(created.soundtrackOwner.state, 'active');
  assert.equal(created.soundtrackOwner.bootstrapMediaElementCreated, true);
  assert.equal(created.soundtrack.playback.decks.length, 2);
  assert.equal(contexts, 0);
  assert.equal(audio.sources.length, 0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('failed soundtrack bootstrap and disposed parent retain unknown owner counters', async (t) => {
  const page = await soloPage(t, {
    pictures,
    fetchResponse,
    search: '?journey=opening&performance=1',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    browserSetup: ({ globals }) => {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  const failed = page.win.RevealLineSoloPerformance.export().resources;
  assert.equal(failed.soundtrackOwner.state, 'failed');
  assert.equal(failed.soundtrackOwner.bootstrapMediaElementCreated, true);
  assert.equal(failed.soundtrack.inspection, null);
  assert.equal(failed.soundtrack.playback, null);
  const { reservationAccounting, ...shared } = failed.media;
  assert.deepEqual(failed.soundtrack.admission, shared);
  page.win.emit('pagehide', { persisted: false });
  const disposed = page.win.RevealLineSoloPerformance.export().resources;
  assert.equal(disposed.soundtrackOwner.state, 'disposed');
  assert.equal(disposed.soundtrack.inspection, null);
  assert.equal(disposed.soundtrack.playback, null);
  assert.deepEqual(page.errors, []);
});

test('the actual public diagnostic export rejects active play before inspecting owners', async () => {
  const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('    window.RevealLineSoloPerformance = Object.freeze({');
  const end = source.indexOf("\n    window.addEventListener('pagehide'", start);
  assert(start >= 0 && end > start);
  const window = {};
  let ownerReads = 0;
  const error = new Error('Pause gameplay before exporting diagnostics');
  // Exercise the actual complete export method with its original lexical inputs.
  // The denied branch must not touch any owner, DOM or other later dependency.
  const install = new Function(
    'window',
    'performanceSession',
    'soundtrackPlayer',
    'paused',
    'started',
    'run',
    source.slice(start, end),
  );
  install(
    window,
    {
      export(options) {
        assert.deepEqual(options, { paused: false });
        throw error;
      },
    },
    {
      preparationDiagnostics() {
        ownerReads++;
        return { admission: {} };
      },
    },
    false,
    true,
    { status: 'running' },
  );
  assert.throws(
    () => window.RevealLineSoloPerformance.export(),
    (value) => value === error,
  );
  assert.equal(ownerReads, 0);
});
