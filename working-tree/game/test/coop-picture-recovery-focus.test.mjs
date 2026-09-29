import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

const nearest = { block: 'nearest', inline: 'nearest', behavior: 'instant' };
const friendly = 'Team picture unavailable. Retry picture or choose another arena.';
const diagnostic = 'Team picture preparation failed.';
const missing = () =>
  new Error(
    'Presentation file unavailable: ./assets/d76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d.png',
  );
const settle = (f, state) => waitFor(() => f.$('coop-picture-status').dataset.state === state);

// Native methods remain finite observations. The actual browser owns scrolling,
// viewport fit and hit testing; the real host owns selection, errors and focus.
async function waiting(t, { width = 844, height = 390, visible = false, before = () => {} } = {}) {
  const gates = [deferred(), deferred(), deferred()],
    scrolls = [],
    faults = [];
  t.mock.method(console, 'error', (...args) => faults.push(args));
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    waitPicture: false,
    presentation: { read: ({ calls }) => gates[calls.reads.length - 1]?.promise },
    beforeImport(context) {
      const { $, doc, win } = context;
      Object.assign(win, doc.defaultView, { innerWidth: width, innerHeight: height });
      doc.defaultView = win;
      doc.documentElement.clientWidth = width;
      doc.documentElement.clientHeight = height;
      for (const id of ['coop-picture-cancel', 'coop-picture-retry']) {
        $(id)._rect = { x: 30, y: visible ? 160 : 921, width: 240, height: 47 };
        t.mock.method($(id), 'scrollIntoView', (options) => {
          scrolls.push({ id, options, active: doc.activeElement.id, level: $('coop-level').value });
        });
      }
      before(context, scrolls);
    },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  return { ...f, gates, scrolls, faults };
}

for (const [width, height] of [
  [844, 390],
  [390, 844],
])
  test(`failed picture → Retry → pending Cancel is visible at ${width}×${height} without starting a flight`, async (t) => {
    const f = await waiting(t, { width, height });
    assert.deepEqual(f.scrolls, [
      {
        id: 'coop-picture-cancel',
        options: nearest,
        active: 'coop-picture-cancel',
        level: 'relay-yard',
      },
    ]);
    f.scrolls.length = 0;
    const error = missing();
    f.gates[0].reject(error);
    await settle(f, 'error');
    assert.equal(f.$('coop-picture-status').textContent, friendly);
    assert.deepEqual(f.faults, [[diagnostic, error]], 'Technical details remain local diagnostics');
    assert.deepEqual(f.scrolls, [
      {
        id: 'coop-picture-retry',
        options: nearest,
        active: 'coop-picture-retry',
        level: 'relay-yard',
      },
    ]);
    assert.equal(f.$('coop-start').disabled, true);
    assert.equal(f.drawImages.length, 0);
    f.scrolls.length = 0;
    f.tap('Enter');
    await waitFor(() => f.artwork.calls.reads.length === 2);
    assert.deepEqual(f.scrolls, [
      {
        id: 'coop-picture-cancel',
        options: nearest,
        active: 'coop-picture-cancel',
        level: 'relay-yard',
      },
    ]);
    assert.equal(f.artwork.calls.reads[0].slot, f.artwork.calls.reads[1].slot);
    assert.equal(
      f.artwork.calls.reads[0].options.snapshot,
      f.artwork.calls.reads[1].options.snapshot,
    );
    f.gates[1].resolve();
    await settle(f, 'ready');
    assert.equal(f.doc.activeElement.id, 'coop-start');
    assert.equal(f.drawImages.length, 0);
    f.tap('Enter');
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.equal(f.drawImages.at(-1).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  });

test('visible recovery controls retain their viewport and explicit Cancel reveals only its own Retry', async (t) => {
  const f = await waiting(t, { visible: true });
  assert.deepEqual(f.scrolls, []);
  f.$('coop-picture-retry')._rect.y = 921;
  f.tap('Enter');
  assert.equal(f.$('coop-picture-status').dataset.state, 'cancelled');
  assert.deepEqual(f.scrolls, [
    {
      id: 'coop-picture-retry',
      options: nearest,
      active: 'coop-picture-retry',
      level: 'relay-yard',
    },
  ]);
  const scrollCount = f.scrolls.length;
  f.gates[0].reject(missing());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    f.scrolls.length,
    scrollCount,
    'A cancelled read cannot reveal or report late failure',
  );
  assert.deepEqual(f.faults, []);
  assert.equal(f.$('coop-start').disabled, true);
});

test('a failed picture can be replaced by a different arena through the real selector', async (t) => {
  const f = await waiting(t);
  f.gates[0].reject(missing());
  await settle(f, 'error');
  f.scrolls.length = 0;
  f.$('coop-level').focus();
  const ready = f.choose('coop-level', 'first-connection');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  assert.equal(f.doc.activeElement.id, 'coop-picture-cancel');
  assert.deepEqual(
    f.scrolls.map(({ id, level }) => ({ id, level })),
    [{ id: 'coop-picture-cancel', level: 'first-connection' }],
  );
  f.gates[1].resolve();
  await ready;
  await settle(f, 'ready');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.drawImages.length, 0);
  f.tap('Enter');
  assert.equal(f.drawImages.at(-1).sha256, COOP_PICTURE_BINDINGS[0].picture.sha256);
  assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
});

for (const outcome of ['ready', 'error'])
  test(`held artwork settling to ${outcome} behind Settings cannot focus or scroll recovery actions`, async (t) => {
    const f = await waiting(t);
    f.$('coop-settings-open').focus();
    f.tap('Enter');
    const selected = f.doc.activeElement,
      attempts = f.focusAttempts.length;
    assert.equal(f.$('coop-options').open, true);
    f.scrolls.length = 0;
    if (outcome === 'ready') f.gates[0].resolve();
    else f.gates[0].reject(missing());
    await settle(f, outcome);
    assert.equal(f.doc.activeElement, selected);
    assert.equal(f.focusAttempts.length, attempts);
    assert.deepEqual(f.scrolls, []);
    assert.equal(f.drawImages.length, 0);
    assert.equal(f.$('coop-start').disabled, outcome === 'error');
  });

for (const newer of [
  'focus-then-body',
  'settings',
  'blur-return',
  'hidden-return',
  'pagehide',
  'pointer-intent',
  'key-intent',
])
  test(`direct Retry reveal respects newer ${newer} inside its focus callback`, async (t) => {
    const f = await waiting(t);
    f.scrolls.length = 0;
    let changed = false;
    f.$('coop-picture-retry').addEventListener('focusin', () => {
      if (changed) return;
      changed = true;
      if (newer === 'focus-then-body') {
        f.$('coop-level').focus();
        f.doc.body.focus();
      }
      if (newer === 'settings') f.$('coop-settings-open').click();
      if (newer === 'blur-return') {
        f.win.emit('blur');
        f.win.emit('focus');
      }
      if (newer === 'hidden-return') {
        f.doc.hidden = true;
        f.doc.emit('visibilitychange');
        f.doc.hidden = false;
        f.doc.emit('visibilitychange');
      }
      if (newer === 'pagehide') f.win.emit('pagehide');
      if (newer === 'pointer-intent') f.doc.body.emit('pointerdown', { pointerId: 19, button: 0 });
      if (newer === 'key-intent') f.doc.body.emit('keydown', { key: 'F9', code: 'F9' });
    });
    f.gates[0].reject(missing());
    await settle(f, 'error');
    assert.equal(changed, true);
    assert.deepEqual(f.scrolls, []);
    assert.equal(f.drawImages.length, 0);
    if (newer === 'focus-then-body') assert.equal(f.doc.activeElement, f.doc.body);
    if (newer === 'settings') assert.equal(f.$('coop-options').open, true);
  });

test('same-scope arena replacement during Retry geometry retires the old direct handoff', async (t) => {
  const f = await waiting(t),
    target = f.$('coop-picture-retry');
  const read = target.getBoundingClientRect.bind(target);
  let replaced = false,
    next;
  t.mock.method(target, 'getBoundingClientRect', () => {
    if (!replaced) {
      replaced = true;
      next = f.choose('coop-level', 'first-connection');
    }
    return read();
  });
  f.scrolls.length = 0;
  f.gates[0].reject(missing());
  await waitFor(() => f.artwork.calls.reads.length === 2);
  assert.equal(replaced, true);
  assert.equal(
    f.scrolls.some(({ id }) => id === 'coop-picture-retry'),
    false,
  );
  f.gates[1].resolve();
  await next;
  await settle(f, 'ready');
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.drawImages.length, 0);
});

test('a pending reveal exception cannot prevent the real picture read or later recovery', async (t) => {
  let attempts = 0;
  const f = await waiting(t, {
    before({ $ }) {
      t.mock.method($('coop-picture-cancel'), 'scrollIntoView', () => {
        attempts++;
        throw new Error('Modeled browser reveal failure');
      });
    },
  });
  assert.equal(attempts, 1);
  assert.equal(f.artwork.calls.reads.length, 1);
  f.gates[0].reject(missing());
  await settle(f, 'error');
  assert.equal(f.$('coop-start').disabled, true);
  f.$('coop-picture-retry').focus();
  f.tap('Enter');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  f.gates[1].resolve();
  await settle(f, 'ready');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.drawImages.length, 0);
});

test('a completion reveal exception leaves explicit Retry usable', async (t) => {
  const f = await waiting(t);
  let attempts = 0;
  t.mock.method(f.$('coop-picture-retry'), 'scrollIntoView', () => {
    attempts++;
    throw new Error('Modeled browser reveal failure');
  });
  f.gates[0].reject(missing());
  await settle(f, 'error');
  assert.equal(attempts, 1);
  assert.equal(f.doc.activeElement.id, 'coop-picture-retry');
  f.tap('Enter');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  f.gates[1].resolve();
  await settle(f, 'ready');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.drawImages.length, 0);
});

test('newer focus during pending Cancel remains authoritative even after returning to BODY', async (t) => {
  let moved = false;
  const f = await waiting(t, {
    before({ $, doc }) {
      $('coop-picture-cancel').addEventListener('focusin', () => {
        if (moved) return;
        moved = true;
        $('coop-level').focus();
        doc.body.focus();
      });
    },
  });
  assert.equal(moved, true);
  assert.equal(f.doc.activeElement, f.doc.body);
  const attempts = f.focusAttempts.length;
  assert.deepEqual(f.scrolls, []);
  f.gates[0].resolve();
  await settle(f, 'ready');
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.equal(f.focusAttempts.length, attempts, 'Completion cannot revive the retired handoff');
  assert.deepEqual(f.scrolls, []);
  assert.equal(f.drawImages.length, 0);
});

test('a fresh Retry retires all temporary focus observers after either terminal outcome', async (t) => {
  const f = await waiting(t);
  f.gates[0].reject(missing());
  await settle(f, 'error');
  const active = [];
  for (const node of [f.doc, f.win]) {
    const add = node.addEventListener.bind(node),
      remove = node.removeEventListener.bind(node);
    t.mock.method(node, 'addEventListener', (type, listener, options) => {
      active.push({ node, type, listener, options });
      return add(type, listener, options);
    });
    t.mock.method(node, 'removeEventListener', (type, listener, options) => {
      const index = active.findIndex(
        (entry) =>
          entry.node === node &&
          entry.type === type &&
          entry.listener === listener &&
          entry.options === options,
      );
      if (index >= 0) active.splice(index, 1);
      return remove(type, listener, options);
    });
  }
  for (const [index, outcome] of [
    [1, 'error'],
    [2, 'ready'],
  ]) {
    f.$('coop-picture-retry').focus();
    f.tap('Enter');
    await waitFor(() => f.artwork.calls.reads.length === index + 1);
    assert.ok(active.length > 0);
    if (outcome === 'ready') f.gates[index].resolve();
    else f.gates[index].reject(missing());
    await settle(f, outcome);
    assert.equal(active.length, 0, 'No temporary document/window observer outlives completion');
  }
});
