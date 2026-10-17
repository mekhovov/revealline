import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { sharedBattlefieldGround } from '../presentation/battlefield-ground.mjs';

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
  const page = await soloPage(t, { ...options(), automaticPreparationFrames: false });
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

test('awaiting the real Start promise submits only preparation frames and consumes no simulation time', async (t) => {
  const page = await soloPage(t, options());
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  let completed = false;
  const starting = page.$('start-button').onclick();
  starting.then(
    () => (completed = true),
    () => (completed = true),
  );
  // Deliberately use the plain waiter, with no settle() or manual frame pump.
  await waitFor(() => completed, { timeoutMs: 20000 });
  await starting;
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(authoritativeCheckpoint(run), before, 'The fixture never runs active ticks');
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
  const display = first.resources.phaser.displayed;
  assert.equal(first.resources.phaser.uniqueCanvases, 2);
  assert.equal(first.resources.phaser.rgbaBytesEstimate, display.width * display.height * 4 * 2);
  const owned = first.resources.renderer.ownedCanvases;
  assert.equal(
    owned.rgbaBytesEstimate,
    Object.values(owned.categories).reduce((sum, category) => sum + category.rgbaBytesEstimate, 0),
  );
  const shared = first.resources.sharedPresentationImages;
  assert.ok(shared.uniqueObserved.images > 0);
  assert.equal(
    shared.sharedCategoryReferences + shared.uniqueObserved.images,
    Object.values(shared.categories).reduce((sum, value) => sum + value.images, 0),
  );
  assert.match(shared.accounting, /Do not add/);
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

test('persisted pages retain prepared art while final page teardown retires the painter once', async (t) => {
  const original = BoardPainter.prototype.prepare;
  let painter;
  BoardPainter.prototype.prepare = async function (...args) {
    painter = this;
    return original.apply(this, args);
  };
  t.after(() => {
    BoardPainter.prototype.prepare = original;
  });
  const page = await soloPage(t, options());
  await start(page);
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  assert.ok(painter);
  page.win.emit('pagehide', { persisted: true });
  assert.ok(!painter.disposed, 'The back/forward cache must retain its accepted art');
  page.win.emit('pageshow', { persisted: true });
  page.frame(1000);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  await start(page);
  assert.equal(page.rendered.run, run);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(painter.disposed, true);
  assert.equal(painter.presentation, null);
  assert.equal(painter.background, null);
  assert.equal(painter.resourceSnapshot().layers.pixels, 0);
  assert.equal(painter.resourceSnapshot().enemyImages.ownedLeases, 0);
  const revision = painter.paintRevision;
  page.win.emit('pagehide', { persisted: false });
  assert.equal(painter.paintRevision, revision, 'Repeated retirement is idempotent');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.errors, []);
});

test('unchanged paused display retains pixels without stopping input polls and restores flags for dirty or retired frames', async (t) => {
  const page = await soloPage(t, options());
  await start(page);
  page.$('pause-button').click();
  page.frame(0);
  const before = page.displayRender,
    reads = page.padReads,
    run = authoritativeCheckpoint(page.rendered.run);
  for (let i = 0; i < 20; i++) {
    page.frame(1000 / 60);
    assert.equal(page.displayRender.cameraVisible, true);
    assert.equal(page.displayRender.clearBeforeRender, true);
  }
  assert.equal(page.displayRender.draws, before.draws);
  assert.equal(page.displayRender.clears, before.clears);
  assert.ok(page.padReads >= reads + 20, 'Controller polling continues every frame');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), run);
  page.frame(0, { dispatchRender: false });
  assert.equal(page.displayRender.cameraVisible, false);
  assert.equal(page.displayRender.clearBeforeRender, false);
  page.win.emit('resize');
  page.frame(0, {
    beforeRender() {
      assert.equal(page.displayRender.cameraVisible, true);
      assert.equal(page.displayRender.clearBeforeRender, true);
    },
  });
  assert.equal(
    page.displayRender.draws,
    before.draws + 1,
    'Resize repaints even after an aborted submission',
  );
  assert.equal(page.displayRender.clears, before.clears + 1);
  await start(page);
  const resumed = page.displayRender.draws;
  page.frame(1000 / 60);
  assert.ok(page.displayRender.draws > resumed, 'Running play always submits its live board');
  page.$('pause-button').click();
  page.frame(0);
  page.frame(0, { dispatchRender: false });
  assert.equal(page.displayRender.cameraVisible, false);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(page.displayRender.cameraVisible, true);
  assert.equal(page.displayRender.clearBeforeRender, true);
  assert.deepEqual(page.errors, []);
});

test('hidden and unfocused frames retain the display without advancing play and restore foreground rendering', async (t) => {
  const page = await soloPage(t, options());
  await start(page);
  for (const mode of ['hidden', 'unfocused']) {
    page.frame(1000 / 60);
    const before = page.displayRender,
      run = authoritativeCheckpoint(page.rendered.run);
    if (mode === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    } else {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    for (let i = 0; i < 8; i++) {
      page.frame(1000);
      assert.equal(page.displayRender.cameraVisible, true);
      assert.equal(page.displayRender.clearBeforeRender, true);
    }
    assert.equal(page.displayRender.draws, before.draws, `${mode} must retain its displayed board`);
    assert.equal(page.displayRender.clears, before.clears);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), run);
    page.frame(0, { dispatchRender: false });
    assert.equal(page.displayRender.cameraVisible, false);
    if (mode === 'hidden') {
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
    } else {
      page.doc.focused = true;
      page.win.emit('focus');
    }
    page.frame(0);
    assert.equal(page.displayRender.cameraVisible, true);
    assert.equal(page.displayRender.clearBeforeRender, true);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), run);
    await start(page);
    const resumed = page.displayRender.draws;
    page.frame(1000 / 60);
    assert.ok(page.displayRender.draws > resumed, 'Explicit Resume restores ordinary rendering');
  }
  assert.deepEqual(page.errors, []);
});

test('paused display choices repaint once without advancing play or resuming steady compositing', async (t) => {
  const page = await soloPage(t, options());
  await start(page);
  page.$('pause-button').click();
  page.frame(0);
  page.frame(120);
  const before = authoritativeCheckpoint(page.rendered.run);
  function checkChange(change, inspect = () => {}) {
    const draws = page.displayRender.draws;
    change();
    page.frame(120);
    inspect();
    assert.equal(
      page.displayRender.draws,
      draws + 1,
      'A changed display choice refreshes the board',
    );
    for (let i = 0; i < 3; i++) page.frame(120);
    assert.equal(page.displayRender.draws, draws + 1, 'Unchanged paused frames retain pixels');
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  }
  checkChange(
    () => {
      page.$('settings-grid').checked = true;
      page.$('settings-grid').emit('change');
    },
    () => assert.equal(page.rendered.showGrid, true),
  );
  checkChange(
    () => page.change('text-face', 'plain'),
    () => assert.equal(page.rendered.textFace, 'plain'),
  );
  for (const [id, option, value] of [
    ['enemy-remains', 'showCombatScrap', false],
    ['brutal-destruction', 'brutal', true],
    ['blood-body-parts', 'blood', false],
  ]) {
    checkChange(
      () => {
        page.$(id).checked = value;
        page.$(id).emit('change');
      },
      () => assert.equal(page.rendered[option], value),
    );
  }
  const ground = sharedBattlefieldGround(),
    previousGround = ground.snapshot().world;
  try {
    checkChange(() => ground.set('field-crossing'));
  } finally {
    ground.set(previousGround);
  }
  assert.deepEqual(page.errors, []);
});

test('real submission observes cheap irregular delivery without changing fixed ticks or restoring before Resume', async (t) => {
  let workClock = 1000;
  const page = await soloPage(t, {
    ...options(),
    browserSetup({ globals }) {
      globals.performance = { now: () => workClock };
    },
  });
  await start(page);
  const run = page.rendered.run;
  const reference = structuredClone(run);
  const initialTick = run.tick;
  let elapsedMs = 0;
  function deliver(seconds, intervals) {
    const target = elapsedMs + seconds * 1000;
    for (let i = 0; elapsedMs < target; i++) {
      assert.ok(i < 10000, 'Synthetic host schedule must stay bounded.');
      const ms = intervals[i % intervals.length];
      elapsedMs += ms;
      workClock += ms;
      page.frame(ms, { beforeRender: () => (workClock += 2) });
    }
    // POST_RENDER updates policy after draw; a zero-time callback exposes the
    // chosen painter tier without adding any simulation time.
    page.frame(0, { beforeRender: () => (workClock += 2) });
    const expectedTicks = Math.floor((elapsedMs + 1e-7) / (FIXED_DT * 1000));
    assert.equal(run.tick - initialTick, expectedTicks);
    while (reference.tick < initialTick + expectedTicks) stepRun(reference, {}, FIXED_DT);
    assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
    assert.equal(page.doc.body.dataset.flightState, 'running');
  }
  deliver(3, [1000 / 30]);
  assert.equal(page.rendered.quality, 'full', 'Steady slow callbacks retain the full painter.');
  deliver(3.2, [1000 / 30, 50]);
  assert.equal(
    page.rendered.quality,
    'reduced',
    'Irregular missed delivery reaches the real painter.',
  );
  deliver(13, [1000 / 60]);
  assert.equal(page.rendered.quality, 'reduced', 'Headroom alone cannot restore during play.');
  page.$('pause-button').click();
  const paused = authoritativeCheckpoint(run);
  await start(page);
  assert.strictEqual(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), paused);
  assert.equal(page.rendered.quality, 'full', 'Public Resume is the safe restoration boundary.');
  assert.deepEqual(page.errors, []);
});

// Exercise the pinned browser scheduler's callback-before-reschedule ordering.
// A manual frame pump would incorrectly revive a loop killed by a thrown error.
async function submissionFaultPage(t) {
  let scene;
  const page = await soloPage(t, {
    ...options(),
    automaticPreparationFrames: false,
    browserSetup({ globals }) {
      const Scene = globals.Phaser.Scene;
      globals.Phaser.Scene = class extends Scene {
        constructor(...args) {
          super(...args);
          scene = this;
        }
      };
    },
  });
  const draw = BoardPainter.prototype.draw;
  let drawFault = null;
  // soloPage owns prototype restoration; this hook retires only our closure.
  t.after(() => {
    drawFault = null;
  });
  BoardPainter.prototype.draw = function (...args) {
    drawFault?.call(this);
    return draw.apply(this, args);
  };
  const rejected = [];
  const prepareBoard = scene.prepareBoard;
  scene.prepareBoard = async function (...args) {
    try {
      return await prepareBoard.apply(this, args);
    } catch (error) {
      rejected.push(error);
      throw error;
    }
  };
  const source = await readFile(new URL('../vendor/phaser-4.2.1.min.js', import.meta.url), 'utf8');
  const steps = source.match(
    /function e\(i\)\{t\.callback\(i\),t\.isRunning&&\(t\.timeOutID=window\.requestAnimationFrame\(e\)\)\}/g,
  );
  assert.equal(steps?.length, 1, 'Use the actual pinned Phaser RAF callback boundary.');
  const queued = [];
  let id = 0;
  const loop = { isRunning: true, callback: () => page.frame(1000 / 60) };
  const step = runInNewContext(`(${steps[0]})`, {
    t: loop,
    window: {
      requestAnimationFrame(callback) {
        queued.push(callback);
        return ++id;
      },
    },
  });
  queued.push(step);
  const deliver = () => {
    assert.equal(queued.length, 1, 'The prior callback must schedule exactly one successor.');
    queued.shift()(id * (1000 / 60));
  };
  const until = (predicate, message) =>
    waitFor(
      () => {
        if (predicate()) return true;
        deliver();
        return false;
      },
      { timeoutMs: 20000, message },
    );
  return {
    page,
    scene,
    rejected,
    deliver,
    queued,
    until,
    fault(callback) {
      drawFault = callback;
    },
    pending: () => until(() => !!scene.preparedFrame, 'The required board awaits submission.'),
    running: () => until(() => page.doc.body.dataset.flightState === 'running', 'Explicit Retry.'),
  };
}

test('owned required submission failure preserves the RAF loop through persistent fault and explicit Retry', async (t) => {
  const f = await submissionFaultPage(t),
    { page, scene } = f,
    run = page.rendered.run,
    before = authoritativeCheckpoint(run),
    fault = new Error('Persistent required submission fault');
  const starting = page.$('start-button').onclick();
  await f.pending();
  let attempts = 0;
  f.fault(() => {
    attempts++;
    throw fault;
  });
  assert.doesNotThrow(f.deliver, 'The owned failure must reject preparation without killing RAF.');
  await starting;
  assert.strictEqual(f.rejected[0], fault, 'Reject with the original error object.');
  assert.equal(scene.preparedFrame, null);
  assert.equal(scene.preparedCancel, null);
  assert.equal(scene.prepared(), false);
  assert.equal(page.$('flight-preparation-status').dataset.state, 'error');
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.doc.body.dataset.flightLayout, undefined);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const display = page.displayRender,
    reads = page.padReads;
  for (let i = 0; i < 4; i++) f.deliver();
  assert.equal(attempts, 1, 'Recovery never retries the failed board automatically.');
  assert.ok(page.padReads >= reads + 4, 'Input polling stays live for public Retry/Cancel.');
  assert.equal(page.displayRender.draws, display.draws);
  assert.equal(page.displayRender.clears, display.clears);
  page.key('Escape');
  page.key('Escape', false);
  f.deliver();
  assert.equal(attempts, 1, 'Cancel must not restart the persistent draw fault.');
  let failedRetrySettled = false;
  const failedRetry = page.$('start-button').onclick();
  failedRetry.finally(() => {
    failedRetrySettled = true;
  });
  await f.until(() => failedRetrySettled, 'A failed detached reprepare still settles.');
  await failedRetry;
  assert.strictEqual(f.rejected[1], fault);
  assert.equal(attempts, 2, 'Only the explicit Retry reattempts detached preparation.');
  const canvas = page.$('game-canvas').querySelector('canvas');
  canvas.emit('contextlost');
  canvas.emit('contextrestored');
  for (let i = 0; i < 3; i++) f.deliver();
  assert.equal(attempts, 2, 'Context restoration cannot restart the failed draw automatically.');
  f.fault(null);
  const retry = page.$('start-button').onclick();
  await f.running();
  await retry;
  assert.equal(scene.failedPreparationRun, null);
  assert.strictEqual(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.equal(f.queued.length, 1, 'Retry used the surviving loop, without reseeding it.');
  f.fault(() => {
    throw fault;
  });
  assert.throws(
    f.deliver,
    (error) => error === fault,
    'Active errors retain ordinary propagation.',
  );
  assert.equal(f.queued.length, 0, 'The pinned scheduler does not reschedule a thrown callback.');
});

test('cancelled submission callbacks cannot reject a replacement or turn AbortSignal events into errors', async (t) => {
  const f = await submissionFaultPage(t),
    { page, scene } = f,
    before = authoritativeCheckpoint(page.rendered.run);
  const starting = page.$('start-button').onclick();
  await f.pending();
  const retiredFailure = scene.preparedFailure;
  page.key('Escape');
  page.key('Escape', false);
  await starting;
  assert.equal(f.rejected[0]?.name, 'AbortError');
  assert.notEqual(f.rejected[0]?.type, 'abort', 'An event is not an error reason.');
  const retry = page.$('start-button').onclick();
  await f.pending();
  const replacement = scene.preparedFrame;
  assert.equal(retiredFailure(new Error('retired owner')), false);
  assert.strictEqual(scene.preparedFrame, replacement);
  await f.running();
  await retry;
  assert.equal(f.rejected.length, 1);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
});

test('a submission error after reentrant cancellation keeps the ordinary throw path', async (t) => {
  const f = await submissionFaultPage(t),
    { page, scene } = f,
    fault = new Error('Renderer failure after its preparation was cancelled');
  const starting = page.$('start-button').onclick();
  await f.pending();
  f.fault(() => {
    page.key('Escape');
    page.key('Escape', false);
    throw fault;
  });
  assert.throws(f.deliver, (error) => error === fault);
  await starting;
  assert.equal(f.rejected[0]?.name, 'AbortError');
  assert.equal(scene.failedPreparationRun, null);
  assert.equal(scene.preparedFrame, null);
  assert.equal(f.queued.length, 0);
});

test('retired painter generation cannot claim owned submission recovery', async (t) => {
  const f = await submissionFaultPage(t),
    { page, scene } = f,
    fault = new Error('Renderer generation retired during submission');
  const starting = page.$('start-button').onclick();
  await f.pending();
  f.fault(function () {
    this.dispose();
    throw fault;
  });
  assert.throws(f.deliver, (error) => error === fault);
  assert.equal(scene.failedPreparationRun, null);
  assert.equal(f.rejected.length, 0, 'A retired generation cannot reject as the current owner.');
  page.key('Escape');
  page.key('Escape', false);
  await starting;
  assert.equal(f.rejected[0]?.name, 'AbortError');
  assert.equal(scene.preparedFrame, null);
  assert.equal(f.queued.length, 0);
});
