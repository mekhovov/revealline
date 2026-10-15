import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const options = () => ({
  pictures: { Image: PNGImage },
  fetchResponse: async (path) =>
    String(path).includes('/content-design/assets/')
      ? new Response(await readFile(path))
      : undefined,
  search: '?journey=opening',
  journeyIndexedDB: managedIndexedDB().indexedDB,
});
const microtasks = () => new Promise((resolve) => setImmediate(resolve));
async function start(page) {
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Start must submit its prepared board',
    { timeoutMs: 20000 },
  );
  page.frame(0);
}

test('Start and context recovery wait for visible Phaser submission after detached preparation', async (t) => {
  const original = BoardPainter.prototype.prepare;
  let prepared = false;
  BoardPainter.prototype.prepare = async function (...args) {
    const result = await original.apply(this, args);
    prepared = true;
    return result;
  };
  t.after(() => {
    BoardPainter.prototype.prepare = original;
  });
  const page = await soloPage(t, options());
  const run = page.rendered.run;
  async function heldStart() {
    prepared = false;
    const before = authoritativeCheckpoint(run);
    page.$('start-button').click();
    await waitFor(
      () => {
        page.frame(0, { dispatchRender: false });
        return prepared;
      },
      {
        timeoutMs: 20000,
        message: 'Detached preparation must complete while visible submission is withheld',
      },
    );
    page.frame(0, { dispatchRender: false });
    await microtasks();
    assert.notEqual(
      page.doc.body.dataset.flightState,
      'running',
      'Scene.update must not release Start',
    );
    assert.deepEqual(authoritativeCheckpoint(run), before);
    page.submitRender();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Phaser POST_RENDER releases the prepared Start',
      { timeoutMs: 20000 },
    );
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
  await heldStart();
  const visibleCanvas = page.$('game-canvas').querySelector('canvas');
  visibleCanvas.emit('contextlost');
  visibleCanvas.emit('contextrestored');
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  await heldStart();
  assert.deepEqual(page.errors, []);
});

test('frame work and input latency include display submission, and canceled submissions receive no credit', async (t) => {
  let workClock = 1000;
  const page = await soloPage(t, {
    ...options(),
    search: '?journey=opening&performance=1',
    browserSetup({ globals }) {
      globals.performance = { now: () => workClock };
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  await start(page);
  page.key('ArrowDown');
  page.frame(1000 / 60, {
    beforeRender: () => {
      workClock += 40;
    },
  });
  page.key('ArrowDown', false);
  page.$('pause-button').click();
  const first = page.win.RevealLineSoloPerformance.export();
  assert.equal(first.stages.work.maxMs, 40, 'Whole-frame work includes time after Scene.update');
  assert.equal(first.inputLatency.byKind.keyboard.toRender.maxMs, 40);
  assert.equal(first.inputLatency.byKind.keyboard.toRender.count, 1);
  await start(page);
  page.key('ArrowRight');
  page.frame(1000 / 60, {
    dispatchRender: false,
    beforeRender: () => {
      workClock += 40;
    },
  });
  page.$('pause-button').click();
  page.submitRender();
  const cancelled = page.win.RevealLineSoloPerformance.export();
  assert.equal(
    cancelled.inputLatency.byKind.keyboard.toRender.count,
    1,
    'A detached paint and a later stale POST_RENDER cannot claim presented input',
  );
  assert.ok(cancelled.inputLatency.cancelled >= 1);
  assert.deepEqual(page.errors, []);
});
