import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';

// Real Team host/core and markup; only measured browser geometry and scroll
// defaults are modeled here. Native pixel/focus-outline acceptance is separate.
async function paused(t) {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  f.$('coop-start').click();
  f.tick(3);
  f.$('coop-pause').click();
  const target = f.$('coop-settings-open');
  target.focus();
  target.click();
  f.tap('Escape');
  assert.ok(f.doc.activeElement === target);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  const panel = f.$('coop-overlay');
  Object.assign(f.doc.documentElement, { clientWidth: 844, clientHeight: 390 });
  Object.assign(panel, {
    _rect: { x: 86, y: 12, width: 672, height: 366 },
    clientLeft: 2,
    clientTop: 2,
    clientWidth: 668,
    clientHeight: 362,
    scrollHeight: 569,
    scrollTop: 0,
  });
  target._rect = { x: 116, y: 507.9921875, width: 110.5625, height: 47 };
  const calls = [];
  target.scrollIntoView = (options) => calls.push(options);
  return { f, panel, target, calls };
}

function checkpoint(f) {
  return {
    hud: [
      'coop-stage',
      'coop-clock',
      'coop-coverage',
      'coop-reserves',
      'coop-objective',
      'coop-state-0',
      'coop-state-1',
      'coop-charge-0',
      'coop-charge-1',
    ].map((id) => [id, f.$(id).textContent]),
    progress: f.$('coop-progress').value,
    paint: f.lastPaint,
  };
}

test('rotation reveals the same paused Settings action without refocus, resume or checkpoint change', async (t) => {
  const { f, target, calls } = await paused(t);
  const before = checkpoint(f),
    focusCalls = f.focusAttempts.length;
  f.win.emit('resize');
  assert.deepEqual(calls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  assert.ok(f.doc.activeElement === target);
  assert.equal(f.focusAttempts.length, focusCalls);
  f.tick(60);
  assert.deepEqual(checkpoint(f), before);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  assert.deepEqual(f.visits, []);
});

test('the bordered client scrollport and 8px outline clearance govern reveal, not only the window', async (t) => {
  const { f, panel, target, calls } = await paused(t);
  panel._rect.height = 188;
  panel.clientHeight = 184;
  target._rect.y = 190; // Fully inside the window; below the smaller client scrollport.
  f.win.emit('resize');
  assert.equal(calls.length, 1);
  target._rect.y = 145; // Bottom192 is inside client bottom198, but outside the 8px clearance190.
  f.win.emit('resize');
  assert.equal(calls.length, 2);
  target._rect.y = 140;
  f.win.emit('resize');
  assert.equal(calls.length, 2, 'A fully clear current action is not scrolled again.');
});

test('layout measurement cannot reveal the previous action after another action takes focus', async (t) => {
  const { f, panel, calls } = await paused(t);
  const original = panel.getBoundingClientRect.bind(panel);
  panel.getBoundingClientRect = () => {
    f.$('coop-resume').focus();
    return original();
  };
  f.win.emit('resize');
  assert.deepEqual(calls, []);
  assert.ok(f.doc.activeElement === f.$('coop-resume'));
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
});

test('the final style read cannot revive a stale paused focus owner', async (t) => {
  const { f, target, calls } = await paused(t);
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
  assert.ok(f.doc.activeElement === f.$('coop-retry'));
});

test('background, hidden and disabled actions do not schedule a later reveal on return', async (t) => {
  const { f, target, calls } = await paused(t);
  f.doc.hidden = true;
  f.win.emit('resize');
  f.doc.hidden = false;
  target.disabled = true;
  f.win.emit('resize');
  target.disabled = false;
  target.hidden = true;
  f.win.emit('resize');
  target.hidden = false;
  f.win.emit('blur');
  f.win.emit('resize');
  f.win.emit('focus');
  f.tick(3);
  assert.deepEqual(calls, []);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
});

test('a Settings dialog owns focus independently of the underlying Pause scroller', async (t) => {
  const { f, target, calls } = await paused(t);
  target.click();
  const current = f.doc.activeElement;
  f.win.emit('resize');
  assert.equal(f.$('coop-options').open, true);
  assert.ok(f.doc.activeElement === current);
  assert.deepEqual(calls, []);
});

test('a synchronous resize callback cannot recurse or reveal a newly running attempt', async (t) => {
  const { f, target, calls } = await paused(t);
  target.scrollIntoView = (options) => {
    calls.push(options);
    f.win.emit('resize');
  };
  f.win.emit('resize');
  assert.equal(calls.length, 1);
  f.$('coop-resume').click();
  f.win.emit('resize');
  assert.equal(calls.length, 1);
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('terminal disposal removes the Pause resize owner', async (t) => {
  const { f, calls } = await paused(t);
  const before = f.win.listeners.get('resize')?.size || 0;
  f.win.emit('pagehide', { persisted: false });
  assert.ok((f.win.listeners.get('resize')?.size || 0) < before);
  f.win.emit('resize');
  assert.deepEqual(calls, []);
});
