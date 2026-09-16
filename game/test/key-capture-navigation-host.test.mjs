import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { loadLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Dispatch through the actual document capture, dialog capture and target chain.
// Only native button activation and Escape's dialog default are modeled here.
function key(page, value, extra = {}) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat: false, ...extra });
  if (!event.defaultPrevented && value === 'Enter' && target.tagName === 'BUTTON') target.click();
  const dialog = target.closest('dialog[open]');
  if (
    !event.defaultPrevented &&
    value === 'Escape' &&
    dialog &&
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
  )
    dialog.close();
  target.emit('keyup', { key: value, code: value, ...extra });
  if (!event.defaultPrevented && value === ' ' && target.tagName === 'BUTTON') target.click();
  return event;
}
function activate(page, target) {
  target.focus();
  key(page, 'Enter');
}
function binding(page, action) {
  return page
    .$('key-binding-list')
    .querySelectorAll('button')
    .find((button) => button.dataset.keyAction === action);
}
function storedBindings(page) {
  return loadLibrary(page.storage, 'revealline.library.dev.v1').library.preferences
    .keyboardBindings;
}
async function controls(t, active = false) {
  const page = await soloPage(t);
  if (active) {
    page.$('start-button').click();
    page.frame(16);
    page.key('ArrowDown');
    for (let n = 0; n < 8; n++) page.frame(16);
    page.$('pause-button').click();
  }
  activate(page, page.$('shell-settings'));
  assert.equal(page.$('settings-dialog').open, true);
  activate(page, page.$('settings-tab-controls'));
  // DETAILS expansion is a native boundary; the source module owns every key capture.
  page.$('keyboard-settings').open = true;
  return page;
}

for (const active of [false, true])
  test(`${active ? 'paused' : 'Ready'} Settings capture binds arrows through document navigation without advancing the flight`, async (t) => {
    const page = await controls(t, active);
    page.change('key-preset', 'left-hand');
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run);
    for (const [action, code] of [
      ['up', 'ArrowUp'],
      ['down', 'ArrowDown'],
      ['left', 'ArrowLeft'],
      ['right', 'ArrowRight'],
    ]) {
      const change = binding(page, action);
      activate(page, change);
      assert.equal(page.$('cancel-key-capture').hidden, false);
      const captured = key(page, code);
      assert.equal(captured.defaultPrevented, true);
      assert.deepEqual(storedBindings(page).bindings[action], [code]);
      assert.equal(page.doc.activeElement, change);
      assert.equal(page.$('cancel-key-capture').hidden, true);
      assert.match(page.$('key-capture-status').textContent, /changed to/);
      page.frame(16);
      assert.equal(page.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    }
    assert.deepEqual(storedBindings(page).bindings.pause, ['Escape', 'KeyQ']);
    const change = binding(page, 'up');
    change.focus();
    assert.equal(key(page, 'ArrowDown').defaultPrevented, true);
    assert.equal(
      page.doc.activeElement,
      binding(page, 'down'),
      'Ordinary menu arrows resume after capture.',
    );
    for (const id of ['key-preset', 'touch-opacity']) {
      page.$(id).focus();
      assert.equal(key(page, 'ArrowDown').defaultPrevented, false, `${id} retains native editing`);
      assert.equal(page.doc.activeElement, page.$(id));
    }
    assert.deepEqual(page.errors, []);
  });

test('rejected arrow capture stays owned until Escape; Tab cancels without menu interception', async (t) => {
  const page = await controls(t),
    change = binding(page, 'up');
  activate(page, change);
  const oldProfile = new Map(page.storage.map);
  key(page, 'ArrowDown'); // Default Down already owns this key.
  assert.match(page.$('key-capture-status').textContent, /already assigned/);
  assert.equal(page.$('cancel-key-capture').hidden, false);
  assert.equal(page.doc.activeElement, change);
  assert.deepEqual(page.storage.map, oldProfile);
  for (const [value, code] of [
    ['Enter', 'Enter'],
    [' ', 'Space'],
  ]) {
    assert.equal(key(page, value, { code }).defaultPrevented, true);
    assert.match(page.$('key-capture-status').textContent, /reserved/);
    assert.equal(page.$('cancel-key-capture').hidden, false);
    assert.equal(page.doc.activeElement, change);
    assert.deepEqual(page.storage.map, oldProfile);
  }
  assert.equal(key(page, 'Escape').defaultPrevented, true);
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('cancel-key-capture').hidden, true);
  assert.equal(page.doc.activeElement, change);
  assert.deepEqual(page.storage.map, oldProfile);
  activate(page, change);
  assert.equal(
    key(page, 'Tab').defaultPrevented,
    false,
    'Browser owns ordinary interior Tab traversal.',
  );
  assert.equal(page.$('cancel-key-capture').hidden, true);
  assert.deepEqual(page.storage.map, oldProfile);
  // Model the ensuing browser focus move separately; do not claim native layout.
  binding(page, 'down').focus();
  key(page, 'ArrowDown');
  assert.equal(page.doc.activeElement, binding(page, 'left'));
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  key(page, 'Escape');
  assert.equal(
    page.$('settings-dialog').open,
    false,
    'After cancellation, native dialog Escape works again.',
  );
  page.frame(16);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
