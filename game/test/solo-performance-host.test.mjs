import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { readFile } from 'node:fs/promises';
import { PNGImage } from './helpers/png-image.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
const pictures = { Image: PNGImage };
const fetchResponse = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
async function start(page) {
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Prepared frame must precede play',
    { timeoutMs: 20000 },
  );
  page.frame(0);
}
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
