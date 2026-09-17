import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { page } from './helpers/coop-host.mjs';

const nearest = { block: 'nearest', inline: 'nearest', behavior: 'instant' };
const inside = { x: 118, y: 280, width: 300, height: 45.5 };
// Finite inputs taken from the previously observed 844×390 scroller; reused here as a finite Settings layout. The fixture
// models layout; a real browser must separately prove its ring and scroll result.
const clipped = { x: 118, y: 338.4921875, width: 300, height: 45.5 };

async function paused(t, { after = clipped, denySave = false } = {}) {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (denySave) throw new Error('Modeled storage denial');
      values.set(key, value);
    },
  };
  const f = await page(t, {
    nativeFocus: true,
    beforeImport({ doc, win, install }) {
      Object.assign(win, doc.defaultView, { innerWidth: 844, innerHeight: 390 });
      doc.defaultView = win;
      doc.documentElement.clientWidth = 844;
      doc.documentElement.clientHeight = 390;
      install('localStorage', { value: storage });
    },
  });
  f.$('coop-start').click();
  f.tick(180);
  f.$('coop-pause').click();
  f.$('coop-settings-open').click();
  f.choose('coop-text-face', 'plain');
  const target = f.$('coop-text-size'),
    panel = f.$('coop-options');
  panel._rect = { x: 86, y: 12, width: 672, height: 366 };
  Object.assign(panel, {
    clientLeft: 2,
    clientTop: 2,
    clientWidth: 668,
    clientHeight: 362,
    scrollHeight: 1470,
    scrollTop: 354,
  });
  target.focus();
  t.mock.method(target, 'getBoundingClientRect', () => {
    const r = f.doc.body.dataset.textSize === 'large' ? after : inside;
    return { ...r, left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height };
  });
  const calls = [];
  t.mock.method(target, 'scrollIntoView', (options) =>
    calls.push({
      options,
      face: f.doc.body.dataset.textFace,
      size: f.doc.body.dataset.textSize,
      selected: target.value,
      focusOwned: f.doc.activeElement === target,
    }),
  );
  t.mock.method(target, 'focus', () => assert.fail('Display reflow must not refocus a control.'));
  return { ...f, target, panel, calls, storage, values };
}

function assertPaused(f, clock) {
  assert.equal(f.panel.hidden, false);
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.equal(f.doc.activeElement === f.target, true);
}

test('Large reflow reveals the current Team control clipped inside the Settings scroller', async (t) => {
  const f = await paused(t),
    clock = f.$('coop-clock').textContent;
  assert.notEqual(clock, '0:00', 'the test paused a real running attempt');
  f.choose('coop-text-size', 'large');
  assert.deepEqual(f.calls, [
    {
      options: nearest,
      face: 'plain',
      size: 'large',
      selected: 'large',
      focusOwned: true,
    },
  ]);
  assertPaused(f, clock);
  f.tick(120);
  assertPaused(f, clock);
  assert.deepEqual(JSON.parse(f.values.get(DISPLAY_PREFERENCES_KEY)), {
    textFace: 'plain',
    textSize: 'large',
    reducedEffects: false,
  });
});

test('a fully visible Team control is not scrolled by a display change', async (t) => {
  const f = await paused(t, { after: inside });
  f.choose('coop-text-size', 'large');
  assert.deepEqual(f.calls, []);
  assert.equal(f.doc.activeElement === f.target, true);
});

test('reveal reserves the focus ring even when the control rectangle fits', async (t) => {
  // Inner scroller bottom is 376; this control ends at 370. Its 7px focus ring
  // would cross the inner edge, even though its own rectangle remains inside.
  const f = await paused(t, { after: { ...inside, y: 324.5 } });
  f.choose('coop-text-size', 'large');
  assert.deepEqual(
    f.calls.map((entry) => entry.options),
    [nearest],
  );
});

test('denied preference saving retains Large and the active paused action', async (t) => {
  const f = await paused(t, { denySave: true }),
    clock = f.$('coop-clock').textContent;
  f.choose('coop-text-size', 'large');
  assert.equal(f.target.value, 'large');
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.ok(f.$('coop-display-status').textContent);
  assert.deepEqual(
    f.calls.map((entry) => entry.options),
    [nearest],
  );
  assertPaused(f, clock);
});

test('shared stored display updates reveal only the current paused action', async (t) => {
  const f = await paused(t),
    clock = f.$('coop-clock').textContent;
  const raw = JSON.stringify({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  f.values.set(DISPLAY_PREFERENCES_KEY, raw);
  f.win.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: f.storage, newValue: raw });
  assert.equal(f.doc.body.dataset.effects, 'reduced');
  assert.deepEqual(
    f.calls.map((entry) => entry.options),
    [nearest],
  );
  assertPaused(f, clock);
});

for (const reason of ['new-focus', 'closed-options', 'background', 'hidden-document', 'resumed'])
  test(`a newer ${reason} during layout wins over the old display action`, async (t) => {
    const f = await paused(t);
    const read = f.target.getBoundingClientRect.bind(f.target);
    let changed = false;
    t.mock.method(f.target, 'getBoundingClientRect', () => {
      if (!changed && f.doc.body.dataset.textSize === 'large') {
        changed = true;
        if (reason === 'new-focus') f.$('coop-settings-close').focus();
        if (reason === 'closed-options') f.$('coop-options').close();
        if (reason === 'background') f.doc.focused = false;
        if (reason === 'hidden-document') f.doc.hidden = true;
        if (reason === 'resumed') {
          f.$('coop-settings-close').click();
          f.$('coop-resume').click();
        }
      }
      return read();
    });
    f.choose('coop-text-size', 'large');
    assert.equal(changed, true);
    assert.deepEqual(f.calls, []);
    if (reason === 'new-focus') assert.equal(f.doc.activeElement.id, 'coop-settings-close');
    if (reason === 'resumed') assert.equal(f.panel.hidden, true);
  });

for (const condition of ['disabled', 'hidden', 'inert', 'invisible', 'invalid-size'])
  test(`display reflow leaves a ${condition} action alone`, async (t) => {
    const f = await paused(t);
    if (condition === 'disabled') f.target.disabled = true;
    if (condition === 'hidden') f.target.hidden = true;
    if (condition === 'inert') f.target.inert = true;
    if (condition === 'invisible') f.target.style.visibility = 'hidden';
    if (condition === 'invalid-size') f.panel.clientHeight = Number.NaN;
    f.choose('coop-text-size', 'large');
    assert.deepEqual(f.calls, []);
  });

test('a terminal page cannot reveal a stale display action on later storage delivery', async (t) => {
  const f = await paused(t);
  f.win.emit('pagehide');
  const raw = JSON.stringify({ textFace: 'plain', textSize: 'large', reducedEffects: false });
  f.values.set(DISPLAY_PREFERENCES_KEY, raw);
  f.win.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: f.storage, newValue: raw });
  assert.deepEqual(f.calls, []);
  assert.equal(f.doc.body.dataset.textSize, 'standard');
});

test('a newer shared display choice during layout keeps its own selection', async (t) => {
  const f = await paused(t),
    read = f.target.getBoundingClientRect.bind(f.target);
  let changed = false;
  t.mock.method(f.target, 'getBoundingClientRect', () => {
    if (!changed && f.doc.body.dataset.textSize === 'large') {
      changed = true;
      f.choose('coop-text-size', 'standard');
    }
    return read();
  });
  f.choose('coop-text-size', 'large');
  assert.equal(changed, true);
  assert.equal(f.target.value, 'standard');
  assert.equal(f.doc.body.dataset.textSize, 'standard');
  assert.equal(JSON.parse(f.values.get(DISPLAY_PREFERENCES_KEY)).textSize, 'standard');
  assert.deepEqual(f.calls, []);
});
