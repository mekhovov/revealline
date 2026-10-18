import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey } from './helpers/demo-host-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('manual resource export requires real Demo Pause and retains closed display across reopen', async (t) => {
  const page = await demoPage(t, {
    search: '?journey=legacy&performance=1',
    browserSetup({ globals }) {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  const exportReport = () => page.win.RevealLineSoloPerformance.export();
  const before = authoritativeCheckpoint(page.rendered.run);
  const initial = exportReport().resources.demo;
  assert.equal(initial.active, false);
  assert.equal(initial.scenes, 0);
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.open();
    assert.throws(exportReport, /Pause gameplay before exporting diagnostics/);
    page.doc.hidden = true;
    page.doc.emit('visibilitychange');
    assert.throws(exportReport, /Pause gameplay before exporting diagnostics/);
    page.doc.hidden = false;
    page.doc.emit('visibilitychange');
    page.$('demo-interrupt').click();
    const checkpoint = authoritativeCheckpoint(page.demoFrame.run);
    const paused = exportReport().resources.demo;
    assert.equal(paused.active, true);
    assert.equal(paused.scenes, 1);
    assert.equal(paused.pendingPreparations, 0);
    assert.equal(paused.painters.length, 1);
    assert(paused.display.pixels > 0);
    assert(paused.painters[0].ownedCanvases.pixels > 0);
    assert.match(paused.sharedImages.accounting, /nonadditive/);
    for (let i = 0; i < 10; i++) assert.deepEqual(exportReport().resources.demo, paused);
    assert.deepEqual(authoritativeCheckpoint(page.demoFrame.run), checkpoint);
    page.$('demo-back').click();
    const closed = exportReport().resources.demo;
    assert.equal(closed.active, false);
    assert.equal(closed.scenes, 0);
    assert.equal(closed.painters.length, 0);
    assert.equal(closed.display.pixels, paused.display.pixels);
    assert.equal(closed.transition.pixels, 0);
    assert.equal(closed.reward.poster.pixels, 0);
    assert.equal(closed.workers.observedHandles, 0);
  }
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(page.errors, []);
});

test('closed Demo retains unsettled scene reservation until ignored decode actually completes', async (t) => {
  const page = await demoPage(t, {
    search: '?journey=legacy&performance=1',
    browserSetup({ globals }) {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  const exportReport = () => page.win.RevealLineSoloPerformance.export();
  let complete,
    entered = false;
  const held = new Promise((resolve) => {
    complete = resolve;
  });
  const loading = t.mock.method(BoardPainter.prototype, 'setLook', function () {
    entered = true;
    return held;
  });
  try {
    page.$('shell-demo').click();
    await waitFor(() => entered);
    assert.throws(exportReport, /Pause gameplay before exporting diagnostics/);
    assert.equal(page.$('demo-watch-pause').disabled, false);
    page.$('demo-watch-pause').click();
    assert.throws(
      exportReport,
      /Pause gameplay before exporting diagnostics/,
      'Explicit Pause cannot conceal an unsettled preparation.',
    );
    page.$('demo-canvas').emit('contextlost');
    assert.throws(
      exportReport,
      /Pause gameplay before exporting diagnostics/,
      'Suspension can change director phase but does not settle the acquisition.',
    );
    page.$('demo-back').click();
    const cancelled = exportReport().resources.demo;
    assert.equal(cancelled.scenes, 0);
    assert.equal(cancelled.painters.length, 0);
    assert.equal(cancelled.pendingPreparations, 1);
    complete();
    await waitFor(() => exportReport().resources.demo.pendingPreparations === 0);
    assert.equal(page.$('demo-dialog').open, false);
    assert.deepEqual(page.errors, []);
  } finally {
    complete();
    loading.mock.restore();
  }
});

test('manual resource export rejects advancing practice despite the retained interrupted spectator flag', async (t) => {
  const page = await demoPage(t, {
    search: '?journey=legacy&performance=1',
    browserSetup({ globals }) {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  await page.open();
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  await waitFor(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  assert.equal(page.demoFrame.options.paused, false);
  let reads = 0;
  const original = BoardPainter.prototype.resourceSnapshot;
  t.mock.method(BoardPainter.prototype, 'resourceSnapshot', function () {
    reads++;
    return original.call(this);
  });
  assert.throws(
    () => page.win.RevealLineSoloPerformance.export(),
    /Pause gameplay before exporting diagnostics/,
  );
  assert.equal(reads, 0, 'Denied export never inspects either painter.');
  page.$('demo-interrupt').click();
  const checkpoint = authoritativeCheckpoint(page.demoFrame.run);
  assert.equal(page.win.RevealLineSoloPerformance.export().resources.demo.scenes, 1);
  assert.deepEqual(authoritativeCheckpoint(page.demoFrame.run), checkpoint);
  page.$('demo-back').click();
  assert.deepEqual(page.errors, []);
});
