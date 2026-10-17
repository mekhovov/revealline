import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRun, FIXED_DT, stepRun } from '../core/index.mjs';
import { createDemoIndexedDBStorage, demoRecordingQuality } from '../demo-library.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { campaignKey, loadLibrary, progressFor } from '../library.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { saveSession, suspendSession } from '../sessions.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryStorage, settle, soloPage } from './helpers/solo-dom.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campaign = await read('../content/campaign.json');
campaign.classRecipes = await read('../content/classes.json');
const trace = await read('../demo-data/first-signal-left.replay.json');
const DATABASE = 'revealline-demo-recordings-v1',
  PROFILE = 'revealline.library.dev.v1',
  SESSION = 'revealline.suspended.dev.v1',
  SETTINGS = 'revealline.demo.dev.v1',
  PREFIX_TICKS = 49;
const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

function unfinishedFlight() {
  const level = applyGameplayTuning(campaign.levels[0], resolveGameplayTuning('standard'));
  assert.deepEqual(
    level,
    trace.level,
    'Use the real installed First Signal with current Standard tuning.',
  );
  const run = createRun(level, trace.options),
    recorder = createRecorder(level, trace.options),
    inputs = trace.segments.flatMap(({ ticks, input, releaseBefore }) => {
      assert.equal(releaseBefore, false);
      return Array(ticks).fill(input);
    });
  // This is a real early ordinary save, not a fabricated terminal checkpoint.
  // The reviewed route's seed35 is restored through Continue Saved. The frozen
  // cross-engine final checkpoint is not trusted; this host records its own win.
  for (const input of inputs.slice(0, PREFIX_TICKS)) {
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'running');
  assert.equal(run.coverage, 0);
  const saved = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'demo-retention-ordinary-first-signal',
    savedAt: '2026-09-29T12:00:00.000Z',
    continuation: { direction: null },
  });
  assert.equal(verifyReplay(saved.replay).match, true);
  return { run, recorder, inputs, saved };
}

async function mountedFlight(t, { createPage = soloPage, browserSetup, ...options } = {}) {
  const f = unfinishedFlight(),
    storage = memoryStorage(),
    database = managedIndexedDB(),
    requests = [];
  assert.equal(saveSession(storage, SESSION, f.saved).ok, true);
  // The app, recorder and production demo IndexedDB adapter are unchanged.
  // Only IndexedDB transaction ordering/storage is modeled, not browser disk
  // persistence or quota. Other host databases retain the existing fixture.
  const page = await createPage(t, {
    ...options,
    storage,
    titleScreen: true,
    browserSetup(context) {
      const { globals } = context;
      const ordinary = globals.indexedDB;
      globals.indexedDB = {
        open(name, ...args) {
          if (name !== DATABASE) return ordinary.open(name, ...args);
          requests.push(name);
          return database.indexedDB.open(name, ...args);
        },
      };
      browserSetup?.(context);
    },
  });
  return { ...f, page, database, requests };
}

function openKeep(page) {
  if (!page.$('shell-home').open) page.$('shell-menu').click();
  page.$('shell-workshop').click();
  assert.equal(page.$('shell-workshop-dialog').open, true);
  page.$('demo-keep').closest('details').open = true;
  assert.equal(page.$('demo-keep').disabled, false);
  page.$('demo-keep').click();
}

function setCollection(page, enabled) {
  page.$('shell-options').click();
  page.$('settings-tab-extras').click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('demo-collect').checked, !enabled);
  page.$('demo-collect').checked = enabled;
  page.$('demo-collect').emit('change');
  assert.equal(JSON.parse(page.storage.getItem(SETTINGS)).collect, enabled);
  page.doc.querySelector('[data-close="settings-dialog"]').click();
}

async function completeOrdinary(f) {
  const { page, run, recorder, inputs, saved } = f;
  assert.equal(page.$('shell-continue').hidden, false);
  page.$('shell-continue').click();
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), saved.replay.checkpoint);
  let direction = null,
    frames = 0;
  const flush = () => {
    if (!frames) return;
    page.frame(frames * FIXED_DT * 1000);
    frames = 0;
    assert.equal(page.rendered.run.tick, run.tick);
    assert.equal(page.rendered.run.status, run.status);
  };
  for (const input of inputs.slice(PREFIX_TICKS)) {
    if (input.action || (input.direction && input.direction !== direction)) flush();
    if (input.direction && input.direction !== direction) {
      page.key(keys[input.direction]);
      page.key(keys[input.direction], false);
      direction = input.direction;
    }
    if (input.action) {
      page.key('KeyE');
      page.key('KeyE', false);
    }
    assert.equal(input.boost, false);
    assert.equal(input.pickup, false);
    assert.equal(input.switchClass, null);
    // Ordinary continuous steering retains its last heading on key release.
    // The authored route waits on the top border; use the actual retained
    // heading in the independent reference instead of injecting a stop.
    const command = { ...input, direction };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
    frames++;
    const capture = run.events.some((event) => event.type === 'capture.stopped');
    if (input.action || capture || frames === 12 || run.status === 'won') flush();
    if (capture) direction = null;
    if (run.status === 'won') break;
  }
  flush();
  assert.equal(
    page.rendered.run.status,
    'won',
    'Ordinary keys complete the actual restored flight.',
  );
  assert.equal(page.rendered.run.lives, 3);
  assert.equal(page.rendered.run.tick, trace.ticks);
  const checkpoint = authoritativeCheckpoint(run);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true);
  assert.equal(demoRecordingQuality(replay).eligible, true);
  const earned = loadLibrary(page.storage, PROFILE).library;
  assert.ok(progressFor(earned, campaign).clears['signal-01']);
  assert.equal(earned.gallery.length, 1, 'The ordinary win still earns its picture.');
  assert.equal(earned.scores.length, 1, 'The ordinary win still earns its score.');
  assert.equal(page.storage.getItem(SESSION), null, 'Only the completed owned save is cleared.');
  page.$('skip-celebration').click();
  page.$('show-result').click();
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  return { checkpoint, earned };
}

async function readCache(database) {
  const adapter = createDemoIndexedDBStorage({ indexedDB: database.indexedDB });
  try {
    return await adapter.read();
  } finally {
    adapter.close();
  }
}

function assertRetained(document, checkpoint) {
  assert.equal(document.items.length, 1);
  const saved = JSON.parse(document.items[0].replayText);
  assert.equal(verifyReplay(saved).match, true, 'The app produced a strictly verifiable replay.');
  assert.deepEqual(saved.checkpoint, checkpoint);
  assert.equal(document.items[0].descriptor.campaignKey, campaignKey(campaign));
}

function observeWinningHostSerialization(t, page) {
  let inHostFrame = false,
    winningSerializations = 0;
  const frame = page.frame;
  t.mock.method(page, 'frame', (...args) => {
    inHostFrame = true;
    try {
      return frame(...args);
    } finally {
      inHostFrame = false;
    }
  });
  const stringify = JSON.stringify;
  t.mock.method(JSON, 'stringify', (value, ...args) => {
    // Observe the real replay byte-budget serialization, without replacing an
    // exporter/validator. Reference replay checks outside host frames do not count.
    if (
      inHostFrame &&
      value?.version === trace.version &&
      value?.summary?.status === 'won' &&
      Array.isArray(value?.segments)
    )
      winningSerializations++;
    return stringify(value, ...args);
  });
  return () => winningSerializations;
}

test('mounted ordinary restored win is kept manually without enabling automatic collection', async (t) => {
  const f = await mountedFlight(t),
    { page, database, requests } = f;
  const winningSerializations = observeWinningHostSerialization(t, page);
  assert.equal(page.$('demo-collect').checked, false);
  openKeep(page);
  assert.match(page.$('demo-keep-status').textContent, /Complete a normal run/);
  assert.deepEqual(requests, [], 'An unfinished Keep does not open the demo database.');
  page.doc.querySelector('[data-close="shell-workshop-dialog"]').click();
  const { checkpoint, earned } = await completeOrdinary(f);
  assert.equal(
    winningSerializations(),
    0,
    'Disabled automatic collection must not export a replay',
  );
  assert.deepEqual(requests, [], 'A normal win does not silently opt into automatic collection.');
  assert.equal(page.storage.getItem(SETTINGS), null);
  openKeep(page);
  await settle(() => page.$('demo-keep-status').textContent.includes('kept for demos'));
  assert.equal(page.$('demo-collect').checked, false);
  assert.equal(page.storage.getItem(SETTINGS), null, 'Manual Keep does not change the preference.');
  assertRetained(await readCache(database), checkpoint);
  assert.deepEqual(loadLibrary(page.storage, PROFILE).library, earned);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.getItem(SESSION), null);
  assert.deepEqual(page.errors, []);
});

test('mounted ordinary restored win is retained automatically only after the real Settings opt-in', async (t) => {
  const f = await mountedFlight(t),
    { page, database, requests } = f;
  const winningSerializations = observeWinningHostSerialization(t, page);
  setCollection(page, true);
  assert.deepEqual(
    requests,
    [],
    'Enabling collection does not create a cache before an eligible win.',
  );
  const { checkpoint, earned } = await completeOrdinary(f);
  assert.equal(
    winningSerializations(),
    0,
    'Enabled collection defers replay serialization until after the winning host frame.',
  );
  await settle(() => database.allPuts.length === 1);
  assertRetained(await readCache(database), checkpoint);
  assert.equal(page.$('demo-keep-status').textContent, '', 'No manual Keep action was used.');
  assert.equal(JSON.parse(page.storage.getItem(SETTINGS)).collect, true);
  page.$('shell-menu').click();
  setCollection(page, false);
  assertRetained(await readCache(database), checkpoint);
  assert.deepEqual(loadLibrary(page.storage, PROFILE).library, earned);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.getItem(SESSION), null);
  assert.deepEqual(page.errors, []);
});

test('earned terminal parent callbacks cannot reopen active Demo media admission', async (t) => {
  let sound;
  const original = Soundscape.prototype.setActorPresentation;
  t.mock.method(Soundscape.prototype, 'setActorPresentation', function (...args) {
    sound = this;
    return original.apply(this, args);
  });
  const canvases = [];
  const f = await mountedFlight(t, {
    // Only this new case opts into the actual Demo fixture's finite native
    // animation and PNG decode boundaries; ordinary retention cases stay intact.
    createPage: demoPage,
    audio: { ...audioHarness(), URLImpl: undefined },
    browserSetup({ document }) {
      const create = document.createElement.bind(document);
      document.createElement = (tag) => {
        const element = create(tag);
        if (tag === 'canvas') canvases.push(element);
        return element;
      };
    },
  });
  const { page } = f;
  assert.ok(sound, 'Observe the real app-owned shared preparation queue.');
  const { checkpoint, earned } = await completeOrdinary(f);
  const parent = page.rendered.run;
  assert.equal(parent.status, 'won');
  const surface = canvases.find((canvas) => canvas.listeners.get('contextlost')?.size);
  assert.ok(surface, 'The displayed parent canvas owns real context lifecycle listeners.');
  page.$('shell-menu').click();
  await page.open();
  const demoTick = page.demoFrame.run.tick;
  const controller = new AbortController();
  let calls = 0,
    settled = false;
  const pending = sound.mediaPreparation.run('main', () => ++calls, {
    signal: controller.signal,
  });
  // Attach rejection handling immediately; a failed assertion still retires
  // this injected owner instead of leaving a pending queue promise behind.
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  t.after(() => controller.abort());
  const microtasks = () => new Promise((resolve) => setImmediate(resolve));
  await microtasks();
  assert.equal(calls, 0, 'Active Demo parks real shared main-thread preparation.');
  for (let frame = 0; frame < 6; frame++) page.frame(1000 / 60);
  await microtasks();
  assert.ok(page.demoFrame.run.tick > demoTick, 'The spectator really advances.');
  assert.equal(calls, 0, 'The won parent cannot admit bulk work on its native callbacks.');
  page.doc.focused = false;
  page.win.emit('blur');
  page.doc.focused = true;
  page.win.emit('focus');
  await microtasks();
  assert.equal(calls, 0, 'Parent focus restoration cannot reopen active Demo admission.');
  surface.emit('contextlost');
  page.frame(1000 / 60);
  await microtasks();
  assert.equal(calls, 0, 'Parent context loss preserves the active Demo queue owner.');
  surface.emit('contextrestored');
  page.frame(1000 / 60);
  await microtasks();
  assert.equal(calls, 0, 'Parent context restoration does not become Demo Pause.');
  assert.deepEqual(authoritativeCheckpoint(parent), checkpoint);
  assert.deepEqual(loadLibrary(page.storage, PROFILE).library, earned);
  assert.equal(page.storage.getItem(SESSION), null);
  page.$('demo-interrupt').click();
  await settle(() => settled, 'Explicit Demo Pause must settle the owned queued task.');
  assert.equal(await pending, 1);
  await microtasks();
  assert.equal(calls, 1, 'Explicit visible Pause releases the parked work exactly once.');
  assert.deepEqual(authoritativeCheckpoint(parent), checkpoint);
  assert.deepEqual(loadLibrary(page.storage, PROFILE).library, earned);
  assert.deepEqual(page.errors, []);
});
