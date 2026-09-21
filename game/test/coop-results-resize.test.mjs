import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { teamHud } from './helpers/coop-win.mjs';

// Earn terminal state through normal keyboard input. Browser geometry and
// scrolling are modeled; actual portrait focus-outline acceptance is separate.
async function results(t, status) {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true, capturePaint: true });
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = `results-resize-${status}`;
  pack.levels = [pack.levels[0]];
  pack.levels[0].enemies = [];
  if (status === 'won') {
    pack.levels[0].spawns = [
      { x: 18.5, y: 0.5 },
      { x: 53.5, y: 0.5 },
    ];
    pack.levels[0].goal = { coverage: 0.1 };
  }
  await f.selectFile(JSON.stringify(pack));
  f.$('coop-difficulty').value = status === 'won' ? 'standard' : 'expert';
  f.$('coop-start').focus();
  f.tap('Enter');
  f.tick(3);
  if (status === 'won') {
    f.tap('KeyS');
    f.tick(600);
  } else {
    for (let loop = 0; loop < 2; loop++)
      for (const [first, second, ticks] of [
        ['KeyD', 'ArrowLeft', 30],
        ['KeyW', 'ArrowUp', 15],
        ['KeyD', 'ArrowLeft', 15],
        ['KeyS', 'ArrowDown', 15],
        ['KeyA', 'ArrowRight', 15],
      ]) {
        f.tap(first);
        f.tap(second);
        f.tick(ticks);
      }
  }
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    status === 'won' ? 'A WORLD YOU REVEALED TOGETHER' : 'ONE MORE SHARED PLAN',
  );
  const target = f.$('coop-settings-open');
  target.focus();
  target.click();
  f.tap('Escape');
  assert.equal(f.doc.activeElement, target);
  const panel = f.$('coop-overlay');
  Object.assign(f.doc.documentElement, { clientWidth: 390, clientHeight: 844 });
  Object.assign(panel, {
    _rect: { x: 0, y: 0, width: 390, height: 844 },
    clientLeft: 0,
    clientTop: 0,
    clientWidth: 390,
    clientHeight: 844,
    scrollHeight: 1030,
    scrollTop: 0,
  });
  target._rect = { x: 20, y: 889.7, width: 110, height: 47 };
  const calls = [];
  target.scrollIntoView = (options) => calls.push(options);
  return { f, target, panel, calls };
}

for (const status of ['won', 'lost']) {
  test(`${status} Results rotation reveals Settings without moving focus, resuming or changing the result`, async (t) => {
    const { f, target, calls } = await results(t, status);
    const before = {
      hud: teamHud(f),
      paint: f.lastPaint,
      message: f.$('coop-message-text').textContent,
    };
    const focusCount = f.focusAttempts.length;
    f.win.emit('resize');
    assert.deepEqual(calls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
    assert.equal(f.doc.activeElement, target);
    assert.equal(f.focusAttempts.length, focusCount);
    f.tick(60);
    assert.deepEqual(
      { hud: teamHud(f), paint: f.lastPaint, message: f.$('coop-message-text').textContent },
      before,
    );
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-resume').hidden, true);
    target._rect.y = 700;
    f.win.emit('resize');
    assert.equal(calls.length, 1, 'An already visible result action needs no second reveal.');
  });

  test(`${status} Results reveal yields to newer focus on the final style read`, async (t) => {
    const { f, target, calls } = await results(t, status);
    const view = f.doc.defaultView,
      original = view.getComputedStyle.bind(view);
    let reads = 0;
    t.mock.method(view, 'getComputedStyle', (node) => {
      const style = original(node);
      if (node === target && ++reads === 2) f.$('coop-retry').focus();
      return style;
    });
    f.win.emit('resize');
    assert.equal(reads, 2);
    assert.deepEqual(calls, []);
    assert.equal(f.doc.activeElement.id, 'coop-retry');
  });

  test(`${status} Results measurement cannot reveal an action belonging to an attempt replaced by Retry`, async (t) => {
    const { f, panel, calls } = await results(t, status);
    const original = panel.getBoundingClientRect.bind(panel);
    panel.getBoundingClientRect = () => {
      f.$('coop-retry').click();
      return original();
    };
    f.win.emit('resize');
    assert.deepEqual(calls, []);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
  });

  test(`${status} Results reveal respects foreground and independent Settings ownership`, async (t) => {
    const { f, target, calls } = await results(t, status);
    f.doc.hidden = true;
    f.win.emit('resize');
    f.doc.hidden = false;
    target.click();
    const dialogFocus = f.doc.activeElement;
    f.win.emit('resize');
    assert.equal(f.doc.activeElement, dialogFocus);
    assert.equal(f.$('coop-options').open, true);
    f.tap('Escape');
    f.win.emit('blur');
    f.win.emit('resize');
    f.win.emit('focus');
    f.tick(3);
    assert.deepEqual(calls, [], 'Background resize leaves no delayed scroll on return.');
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-resume').hidden, true);
  });
}
