import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

// Model one actual Window, rather than adding a production fallback for the
// older fixture's separate style object. Rectangles are finite test inputs;
// browser evidence separately checks the actual responsive layout and ring.
const page = (t, options = {}) =>
  couchPage(t, {
    ...options,
    beforeImport({ document, window }) {
      Object.assign(window, document.defaultView, { innerWidth: 844, innerHeight: 390 });
      document.defaultView = window;
      document.documentElement.clientWidth = 844;
      document.documentElement.clientHeight = 390;
    },
  });
const nearest = { block: 'nearest', inline: 'nearest', behavior: 'instant' };
const outside = { x: 28, y: 592, width: 200, height: 50 };
function observe(t, target) {
  const calls = [];
  t.mock.method(target, 'scrollIntoView', (options) => calls.push(options));
  t.mock.method(target, 'focus', () => assert.fail('Resize must never focus an action.'));
  return calls;
}

for (const [edge, rect] of Object.entries({
  left: { x: -1, y: 10, width: 100, height: 44 },
  top: { x: 10, y: -1, width: 100, height: 44 },
  right: { x: 745, y: 10, width: 100, height: 44 },
  bottom: outside,
}))
  test(`resize reveals current Ready Start beyond the ${edge} edge without activating it`, async (t) => {
    const f = await page(t),
      target = f.$('race-start');
    target.focus();
    target._rect = rect;
    const before = f.checkpoint(),
      calls = observe(t, target);
    f.win.emit('resize');
    assert.deepEqual(calls, [nearest]);
    assert.equal(f.doc.activeElement === target, true);
    assert.equal(f.state(), 'ready');
    assert.deepEqual(f.checkpoint(), before);
    assert.equal(f.tick(), 0);
    target._rect = { x: 28, y: 300, width: 200, height: 50 };
    f.win.emit('resize');
    assert.equal(calls.length, 1, 'a wholly visible current action needs no further scroll');
  });

for (const condition of [
  'disabled',
  'hidden-ancestor',
  'inert-ancestor',
  'aria-hidden-ancestor',
  'invisible',
  'foreign-root',
  'background',
  'hidden-document',
])
  test(`resize cannot reveal an action that is ${condition}`, async (t) => {
    const f = await page(t),
      target = f.$('race-start');
    target.focus();
    target._rect = outside;
    if (condition === 'disabled') target.disabled = true;
    if (condition === 'hidden-ancestor') f.$('race-main').hidden = true;
    if (condition === 'inert-ancestor') f.$('race-main').inert = true;
    if (condition === 'aria-hidden-ancestor') f.$('race-main').setAttribute('aria-hidden', 'true');
    if (condition === 'invisible') target.style.visibility = 'hidden';
    if (condition === 'foreign-root') f.doc.body.append(target);
    if (condition === 'background') f.doc.focused = false;
    if (condition === 'hidden-document') f.doc.hidden = true;
    const before = f.checkpoint(),
      calls = observe(t, target);
    f.win.emit('resize');
    assert.deepEqual(calls, []);
    assert.equal(f.doc.activeElement === target, true);
    assert.deepEqual(f.checkpoint(), before);
  });

for (const interruption of ['other-focus', 'new-screen', 'background'])
  test(`geometry publication cannot reveal the old action after ${interruption}`, async (t) => {
    const f = await page(t),
      target = f.$('race-start');
    target.focus();
    target._rect = outside;
    const read = target.getBoundingClientRect.bind(target),
      before = f.checkpoint(),
      calls = observe(t, target);
    let changed = false;
    t.mock.method(target, 'getBoundingClientRect', () => {
      if (!changed) {
        changed = true;
        if (interruption === 'other-focus') f.$('race-help').focus();
        if (interruption === 'new-screen') f.$('race-help').click();
        if (interruption === 'background') f.doc.focused = false;
      }
      return read();
    });
    f.win.emit('resize');
    assert.deepEqual(calls, []);
    if (interruption === 'other-focus') assert.equal(f.doc.activeElement.id, 'race-help');
    if (interruption === 'new-screen') assert.equal(f.doc.activeElement.id, 'race-help-read');
    assert.deepEqual(f.checkpoint(), before);
  });

test('resize ignores descendant events, invalid dimensions and recursive delivery', async (t) => {
  const f = await page(t),
    target = f.$('race-start');
  target.focus();
  target._rect = outside;
  const calls = observe(t, target);
  target.emit('resize');
  assert.deepEqual(calls, []);
  f.doc.documentElement.clientWidth = Number.NaN;
  f.win.innerWidth = Number.NaN;
  f.win.emit('resize');
  assert.deepEqual(calls, []);
  f.doc.documentElement.clientWidth = f.win.innerWidth = 844;
  target._rect = { ...outside, height: 0 };
  f.win.emit('resize');
  assert.deepEqual(calls, []);
  target._rect = outside;
  const read = target.getBoundingClientRect.bind(target);
  t.mock.method(target, 'getBoundingClientRect', () => {
    f.win.emit('resize');
    return read();
  });
  f.win.emit('resize');
  assert.deepEqual(calls, [nearest]);
});

test('the final style read cannot authorize a scroll after foreground loss', async (t) => {
  const f = await page(t),
    target = f.$('race-start');
  target.focus();
  target._rect = outside;
  const before = f.checkpoint(),
    calls = observe(t, target),
    style = f.win.getComputedStyle.bind(f.win);
  let reads = 0;
  t.mock.method(f.win, 'getComputedStyle', (element) => {
    const value = style(element);
    if (element === target && ++reads === 2) f.doc.focused = false;
    return value;
  });
  f.win.emit('resize');
  assert.equal(reads, 2, 'the modeled interruption occurs in the final eligibility read');
  assert.equal(f.doc.activeElement === target, true, 'foreground loss need not move DOM focus');
  assert.deepEqual(calls, []);
  assert.deepEqual(f.checkpoint(), before);
});

test('resize reveals paused Resume while preserving a real started cut and live canvas ownership', async (t) => {
  const f = await page(t);
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.frames(4);
  assert.equal(f.state(), 'running');
  assert.ok(f.tick() > 0);
  const canvas = f.$('race-canvas-0');
  canvas.focus();
  canvas._rect = outside;
  const live = f.checkpoint(),
    canvasCalls = observe(t, canvas);
  f.win.emit('resize');
  assert.deepEqual(canvasCalls, [], 'the arena is outside the menu/HUD action owner');
  assert.deepEqual(f.checkpoint(), live);
  f.$('race-pause').click();
  f.frame(0);
  assert.equal(f.state(), 'paused');
  const target = f.$('race-start'),
    paused = f.checkpoint();
  assert.equal(f.doc.activeElement === target, true);
  target._rect = outside;
  const calls = observe(t, target);
  f.win.emit('resize');
  f.frame(0);
  assert.deepEqual(calls, [nearest]);
  assert.equal(f.state(), 'paused');
  assert.deepEqual(f.checkpoint(), paused);
});

test('resize reveals a real finished round action without replacing either run or result', async (t) => {
  const base = JSON.parse(
      await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
    ),
    campaign = { ...base, briefs: [], levels: [retryFixture('enemy-player').level] },
    f = await page(t, { campaign });
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.key('ArrowRight');
  f.frames(60);
  assert.equal(f.state(), 'finished');
  const target = f.$('race-start'),
    before = f.checkpoint(),
    results = [0, 1].map((i) => f.$(`race-result-${i}`).textContent),
    score = f.$('series-score').textContent;
  assert.equal(f.doc.activeElement === target, true);
  target._rect = outside;
  const calls = observe(t, target);
  f.win.emit('resize');
  assert.deepEqual(calls, [nearest]);
  assert.deepEqual(f.checkpoint(), before);
  assert.deepEqual(
    [0, 1].map((i) => f.$(`race-result-${i}`).textContent),
    results,
  );
  assert.equal(f.$('series-score').textContent, score);
});

test('resize stores no future focus intent and terminal disposal removes its listener', async (t) => {
  const f = await page(t),
    target = f.$('race-start');
  target.focus();
  target._rect = outside;
  const calls = observe(t, target),
    before = f.checkpoint();
  // Action and active-reader resize observers can coexist. Their exact count
  // is not a player contract; every registered observer must be retired.
  const resizeListeners = [...(f.win.listeners.get('resize') || [])];
  assert.ok(resizeListeners.length > 0);
  f.doc.focused = false;
  f.win.emit('resize');
  f.doc.focused = true;
  await Promise.resolve();
  assert.deepEqual(calls, [], 'foreground return does not replay the old resize');
  f.win.emit('resize');
  assert.deepEqual(calls, [nearest], 'only a new resize considers the current action');
  f.win.emit('pagehide', { persisted: false });
  for (const listener of resizeListeners)
    assert.equal(f.win.listeners.get('resize')?.has(listener), false);
  assert.equal(f.win.listeners.get('resize')?.size, 0);
  f.win.emit('resize');
  assert.equal(calls.length, 1);
  assert.deepEqual(f.checkpoint(), before);
});
