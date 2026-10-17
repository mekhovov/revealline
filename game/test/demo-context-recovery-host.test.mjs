import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey, DEMO_HOST_READY_TIMEOUT_MS } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { Soundscape } from '../ui/audio.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const frames = (page, count = 12) => {
  for (let index = 0; index < count; index++) page.frame(1000 / 60);
};
const checkpoint = (run) => authoritativeCheckpoint(run);
const layers = (painter) =>
  [...painter.layers.values()].filter((layer) => layer.canvas && layer.lost);
const noErrors = (page) => assert.deepEqual(page.errors, []);

function assertBlocked(page) {
  for (const id of ['demo-resume', 'demo-takeover', 'demo-next', 'demo-watch-pause', 'demo-return'])
    assert.equal(page.$(id).disabled, true, `${id} must not activate a lost Demo renderer.`);
}

function tryResume(page) {
  page.$('demo-resume').click();
  page.$('demo-watch-pause').click();
  page.$('demo-takeover').click();
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  frames(page);
}

test(
  'display loss freezes spectator authority and restoration repaints once before explicit Resume',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    const ordinary = checkpoint(page.rendered.run);
    await page.open();
    frames(page);
    const run = page.demoFrame.run,
      before = checkpoint(run),
      beforeTick = run.tick,
      stored = [...page.storage.map],
      painter = page.demoFrame.painter,
      draw = t.mock.method(painter, 'draw'),
      display = page.$('demo-canvas');
    const loss = display.emit('contextlost');
    assert.equal(
      loss.defaultPrevented,
      false,
      'Recovery must not request a different browser loss policy.',
    );
    frames(page);
    assert.deepEqual(
      checkpoint(run),
      before,
      'The independent spectator clock cannot advance through display loss.',
    );
    assertBlocked(page);
    tryResume(page);
    assert.deepEqual(checkpoint(run), before);
    assert.equal(draw.mock.callCount(), 0);
    display.emit('contextrestored');
    await flush();
    assert.equal(
      draw.mock.callCount(),
      1,
      'Restoration paints the paused frame even though suspension stopped the clock.',
    );
    assert.equal(page.demoFrame.options.paused, true);
    frames(page);
    assert.equal(
      draw.mock.callCount(),
      1,
      'Restoration does not restart recurring paused drawing.',
    );
    assert.deepEqual(checkpoint(run), before);
    page.$('demo-resume').click();
    page.frame(0);
    frames(page);
    assert.ok(run.tick > beforeTick, 'Only explicit Resume restarts spectator simulation.');
    assert.deepEqual(checkpoint(page.rendered.run), ordinary);
    assert.deepEqual([...page.storage.map], stored);
    noErrors(page);
  },
);

test(
  'practice loses held input on owned layer loss and needs restoration plus a fresh command',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    const ordinary = checkpoint(page.rendered.run);
    await page.open();
    demoKey(page, 'ArrowDown');
    demoKey(page, 'ArrowDown', false);
    await settle(() => !page.$('demo-practice-controls').hidden);
    page.frame(0);
    frames(page, 3);
    const run = page.demoFrame.run,
      layer = layers(page.demoFrame.painter)[0];
    assert.ok(layer, 'The actual Demo painter owns a cached board layer.');
    demoKey(page, 'ArrowRight');
    demoKey(page, 'Space');
    const before = checkpoint(run),
      beforeTick = run.tick;
    layer.canvas.emit('contextlost');
    frames(page);
    assert.deepEqual(
      checkpoint(run),
      before,
      'Practice is paused before any further input/simulation step.',
    );
    assertBlocked(page);
    page.$('demo-resume').click();
    demoKey(page, 'ArrowRight', true, { repeat: true });
    frames(page);
    assert.deepEqual(checkpoint(run), before);
    layer.canvas.emit('contextrestored');
    await flush();
    page.$('demo-resume').click();
    frames(page);
    assert.deepEqual(
      checkpoint(run),
      before,
      'Resume arms practice without replaying a held direction or action.',
    );
    demoKey(page, 'ArrowRight', false);
    demoKey(page, 'Space', false);
    demoKey(page, 'ArrowRight');
    demoKey(page, 'ArrowRight', false);
    frames(page, 3);
    assert.ok(run.tick > beforeTick);
    assert.deepEqual(checkpoint(page.rendered.run), ordinary);
    noErrors(page);
  },
);

test(
  'multiple surface losses and real painter retirement cannot recursively repaint or clear display loss',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    await page.open();
    const painter = page.demoFrame.painter,
      owned = layers(painter);
    assert.ok(owned.length >= 2, 'Use two real cached surfaces from the current painter.');
    const run = page.demoFrame.run,
      before = checkpoint(run),
      beforeTick = run.tick,
      display = page.$('demo-canvas'),
      draw = t.mock.method(painter, 'draw');
    owned[0].canvas.emit('contextlost');
    owned[1].canvas.emit('contextlost');
    display.emit('contextlost');
    owned[0].canvas.emit('contextrestored');
    await flush();
    assertBlocked(page);
    assert.equal(draw.mock.callCount(), 0);
    painter.invalidate();
    assert.equal(
      draw.mock.callCount(),
      0,
      'Synchronous retired:true callbacks cannot reenter drawing.',
    );
    await flush();
    assert.equal(
      draw.mock.callCount(),
      0,
      'Retiring a lost layer cannot restore the independent display.',
    );
    assert.equal(owned[1].canvas.width, 0);
    display.emit('contextrestored');
    await flush();
    assert.equal(draw.mock.callCount(), 1);
    owned[1].lost();
    owned[1].restored();
    await flush();
    assert.equal(
      page.$('demo-resume').disabled,
      false,
      'Late events from the retired surface cannot reacquire loss ownership.',
    );
    assert.equal(draw.mock.callCount(), 1);
    assert.deepEqual(checkpoint(run), before);
    page.$('demo-resume').click();
    page.frame(0);
    frames(page);
    assert.ok(run.tick > beforeTick);
    noErrors(page);
  },
);

test(
  'display loss survives closing and reopening the same canvas until its actual restoration',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    await page.open();
    const display = page.$('demo-canvas'),
      oldPainter = page.demoFrame.painter;
    display.emit('contextlost');
    page.$('demo-back').click();
    page.$('shell-demo').click();
    assert.ok(Object.is(display, page.$('demo-canvas')), 'The display element is reused.');
    assertBlocked(page);
    tryResume(page);
    display.emit('contextrestored');
    await page.ready();
    await flush();
    assert.ok(
      !Object.is(page.demoFrame.painter, oldPainter),
      'The reopened scene owns a fresh painter.',
    );
    const run = page.demoFrame.run,
      before = checkpoint(run),
      beforeTick = run.tick;
    frames(page);
    assert.deepEqual(checkpoint(run), before, 'Reopening and restoration cannot implicitly play.');
    page.$('demo-resume').click();
    page.frame(0);
    frames(page);
    assert.ok(run.tick > beforeTick);
    noErrors(page);
  },
);

test(
  'retired painter losses cannot interrupt a successor or restore a successor loss',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    await page.open();
    const oldPainter = page.demoFrame.painter,
      oldLayer = layers(oldPainter)[0];
    oldLayer.canvas.emit('contextlost');
    page.$('demo-back').click();
    await page.open();
    const painter = page.demoFrame.painter,
      run = page.demoFrame.run;
    assert.ok(!Object.is(painter, oldPainter));
    const tick = run.tick;
    oldLayer.lost();
    oldLayer.restored();
    frames(page);
    assert.ok(
      run.tick > tick,
      'Callbacks retained from a disposed painter cannot pause its successor.',
    );
    const layer = layers(painter)[0],
      before = checkpoint(run),
      beforeTick = run.tick;
    layer.canvas.emit('contextlost');
    oldLayer.restored();
    tryResume(page);
    assert.deepEqual(checkpoint(run), before);
    assertBlocked(page);
    layer.canvas.emit('contextrestored');
    await flush();
    page.$('demo-resume').click();
    page.frame(0);
    frames(page);
    assert.ok(run.tick > beforeTick);
    noErrors(page);
  },
);

test(
  'a loss during real painter preparation is retained until that surface restores after adoption',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    let preparedLayer = null,
      preparedPainter = null;
    const original = BoardPainter.prototype.setLook;
    t.mock.method(BoardPainter.prototype, 'setLook', async function (...args) {
      const result = await original.apply(this, args);
      if (!preparedLayer) {
        preparedPainter = this;
        this.paintLayer(
          'recovery-preparation',
          page.$('demo-canvas').getContext('2d'),
          8,
          8,
          ['prepared'],
          () => {},
        );
        preparedLayer = this.layers.get('recovery-preparation');
        preparedLayer.canvas.emit('contextlost');
      }
      return result;
    });
    await page.open();
    assert.ok(
      preparedLayer,
      'Loss occurs in the forwarded real setLook preparation before player adoption.',
    );
    assertBlocked(page);
    frames(page);
    preparedLayer.canvas.emit('contextrestored');
    await flush();
    assert.ok(Object.is(page.demoFrame.painter, preparedPainter));
    const run = page.demoFrame.run,
      before = checkpoint(run);
    assert.equal(run.tick, 0);
    frames(page);
    assert.deepEqual(checkpoint(run), before);
    page.$('demo-resume').click();
    page.frame(0);
    frames(page);
    assert.ok(run.tick > 0);
    noErrors(page);
  },
);

test(
  'fresh main-game handoff remains available with an independently lost Demo display',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    await page.open();
    const levelId = page.demoFrame.run.levelId;
    page.$('demo-canvas').emit('contextlost');
    assert.equal(page.$('demo-fresh').disabled, false);
    page.$('demo-fresh').click();
    await settle(
      () => !page.$('demo-dialog').open,
      'Fresh main preparation uses its own renderer.',
      { timeoutMs: DEMO_HOST_READY_TIMEOUT_MS },
    );
    page.frame(0);
    assert.equal(page.rendered.run.levelId, levelId);
    assert.equal(page.rendered.run.tick, 0);
    assert.equal(page.$('game-overlay').dataset.kind, 'ready');
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    frames(page);
    assert.ok(page.rendered.run.tick > 0);
    noErrors(page);
  },
);

test(
  'hidden restoration and later visibility, resize and fullscreen changes repaint the stopped paused spectator',
  { timeout: 240000 },
  async (t) => {
    const page = await demoPage(t);
    await page.open();
    frames(page);
    const painter = page.demoFrame.painter,
      run = page.demoFrame.run,
      before = checkpoint(run),
      draw = t.mock.method(painter, 'draw'),
      display = page.$('demo-canvas');
    display.emit('contextlost');
    page.doc.hidden = true;
    page.doc.emit('visibilitychange');
    display.emit('contextrestored');
    await flush();
    assert.equal(draw.mock.callCount(), 0, 'A hidden restoration does not paint.');
    page.doc.hidden = false;
    page.doc.emit('visibilitychange');
    await flush();
    assert.equal(
      draw.mock.callCount(),
      1,
      'Foreground return paints even though recovery stopped RAF.',
    );
    page.win.emit('resize');
    await flush();
    assert.equal(draw.mock.callCount(), 2);
    page.doc.emit('fullscreenchange');
    await flush();
    assert.equal(draw.mock.callCount(), 3);
    frames(page);
    assert.equal(
      draw.mock.callCount(),
      3,
      'Event-driven repaint cannot restart a recurring clock.',
    );
    assert.deepEqual(checkpoint(run), before);
    assert.equal(page.demoFrame.options.paused, true);
    noErrors(page);
  },
);

test(
  'restoring a reopened display releases real required preparation without starting spectator playback',
  { timeout: 240000 },
  async (t) => {
    let sound;
    const original = Soundscape.prototype.setActorPresentation;
    t.mock.method(Soundscape.prototype, 'setActorPresentation', function (...args) {
      sound = this;
      return original.apply(this, args);
    });
    const page = await demoPage(t);
    await page.open();
    const display = page.$('demo-canvas');
    display.emit('contextlost');
    page.$('demo-back').click();
    page.$('shell-demo').click();
    assert.equal(sound.mediaPreparation.snapshot().phase, 'suspended');
    const controller = new AbortController();
    t.after(() => controller.abort());
    let calls = 0,
      settled = false,
      failure = null;
    const work = sound.mediaPreparation.run('fetch', () => ++calls, {
      priority: 'required',
      signal: controller.signal,
    });
    work.then(
      () => {
        settled = true;
      },
      (error) => {
        failure = error;
        settled = true;
      },
    );
    await flush();
    assert.equal(calls, 0, 'The real shared queue holds required work during display loss.');
    display.emit('contextrestored');
    await settle(
      () => settled,
      'Actual required admission must finish after display restoration.',
      { timeoutMs: DEMO_HOST_READY_TIMEOUT_MS },
    );
    assert.equal(failure, null);
    assert.equal(calls, 1);
    await page.ready();
    const run = page.demoFrame.run,
      before = checkpoint(run);
    assert.equal(run.tick, 0);
    frames(page);
    assert.deepEqual(checkpoint(run), before);
    page.$('demo-resume').click();
    page.frame(0);
    frames(page);
    assert.ok(run.tick > 0);
    noErrors(page);
  },
);
