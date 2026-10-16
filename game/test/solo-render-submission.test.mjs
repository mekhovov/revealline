import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
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
