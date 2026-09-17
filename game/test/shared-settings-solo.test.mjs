import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';

// Real Solo entry, menu routing and document capture/bubble handlers. The
// finite DOM models button activation only; this is not physical-device or
// browser layout/BFCache qualification.
function press(page, key) {
  const target = page.doc.activeElement,
    event = target.emit('keydown', { key, code: key, repeat: false });
  if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
  page.doc.activeElement.emit('keyup', { key, code: key });
  return event;
}
function activate(page, id) {
  page.$(id).focus();
  press(page, 'Enter');
}
const categoryNames = ['controls', 'audio', 'display', 'data'];
function category(page, selected) {
  for (const name of categoryNames) {
    const active = name === selected,
      tab = page.$(`settings-tab-${name}`),
      panel = page.$(`settings-panel-${name}`);
    assert.equal(tab.getAttribute('aria-selected'), String(active), name);
    assert.equal(tab.tabIndex, active ? 0 : -1, name);
    assert.equal(panel.hidden, !active, name);
    assert.equal(panel.inert, !active, name);
  }
}
function heldAtTitle(page, originalRun) {
  page.frame(250);
  assert.equal(page.$('shell-home').open, true);
  assert.strictEqual(page.rendered.run, originalRun);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.$('shell-missions').open, false);
  assert.deepEqual(page.errors, []);
}

test('Home quick sound toggles the existing master in place and remains synchronized with Audio settings', async (t) => {
  const storage = memoryStorage({
      [AUDIO_PREFERENCES_KEY]: JSON.stringify({ muted: false, volume: 0.42 }),
    }),
    page = await soloPage(t, { titleScreen: true, storage }),
    run = page.rendered.run,
    record = () => JSON.parse(storage.getItem(AUDIO_PREFERENCES_KEY)),
    quick = page.$('shell-sound');
  assert.equal(quick.textContent, 'Sound: on');
  assert.equal(quick.getAttribute('aria-pressed'), 'true');
  activate(page, 'shell-sound');
  assert.deepEqual(record(), { muted: true, volume: 0.42 });
  assert.equal(quick.textContent, 'Sound: off');
  assert.equal(quick.getAttribute('aria-pressed'), 'false');
  assert.equal(page.$('settings-master-mute').textContent, 'Unmute sound');
  assert.equal(page.$('sound-button').getAttribute('aria-label'), 'Unmute sound');
  assert.equal(page.doc.activeElement, quick);
  assert.equal(page.$('settings-dialog').open, false);
  heldAtTitle(page, run);

  activate(page, 'shell-sound');
  assert.deepEqual(record(), { muted: false, volume: 0.42 });
  assert.equal(quick.textContent, 'Sound: on');
  assert.equal(page.$('settings-master-mute').textContent, 'Mute sound');
  assert.equal(page.doc.activeElement, quick);
  heldAtTitle(page, run);

  activate(page, 'shell-options');
  activate(page, 'settings-tab-audio');
  activate(page, 'settings-master-mute');
  assert.deepEqual(record(), { muted: true, volume: 0.42 });
  assert.equal(quick.textContent, 'Sound: off');
  assert.equal(quick.getAttribute('aria-pressed'), 'false');
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.doc.activeElement, page.$('settings-master-mute'));
  heldAtTitle(page, run);
});

test('Solo Settings opens Appearance by default, returns to its Home opener and retains the chosen category on reopening', async (t) => {
  const page = await soloPage(t, { titleScreen: true }),
    run = page.rendered.run,
    before = [...page.storage.map];
  activate(page, 'shell-options');
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('settings-tab-display').textContent, 'Appearance & accessibility');
  category(page, 'display');
  activate(page, 'settings-tab-data');
  category(page, 'data');
  const close = page.doc.querySelector('button[data-close="settings-dialog"]');
  close.focus();
  press(page, 'Enter');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.$('settings-dialog').open, false);
  assert.equal(page.doc.activeElement, page.$('shell-options'));
  activate(page, 'shell-options');
  assert.equal(page.$('settings-dialog').open, true);
  category(page, 'data');
  assert.deepEqual([...page.storage.map], before);
  heldAtTitle(page, run);
});

test('category arrows, Home and End cross the real document adapter exactly once without a game command', async (t) => {
  const page = await soloPage(t, { titleScreen: true }),
    run = page.rendered.run,
    before = [...page.storage.map],
    focusCounts = new Map();
  activate(page, 'shell-options');
  page.$('settings-tab-display').focus();
  for (const name of categoryNames) {
    const tab = page.$(`settings-tab-${name}`),
      focus = tab.focus.bind(tab);
    tab.focus = (...args) => {
      focusCounts.set(name, (focusCounts.get(name) ?? 0) + 1);
      focus(...args);
    };
  }
  for (const [key, expected] of [
    ['ArrowRight', 'data'],
    ['ArrowRight', 'controls'],
    ['ArrowRight', 'audio'],
    ['ArrowRight', 'display'],
    ['ArrowLeft', 'audio'],
    ['Home', 'controls'],
    ['End', 'data'],
  ]) {
    focusCounts.clear();
    const event = press(page, key);
    assert.equal(event.defaultPrevented, true, key);
    assert.equal(event.cancelBubble, true, key);
    assert.deepEqual([...focusCounts], [[expected, 1]], `${key} must navigate exactly once`);
    assert.equal(page.doc.activeElement, page.$(`settings-tab-${expected}`));
    category(page, expected);
  }
  assert.deepEqual([...page.storage.map], before);
  heldAtTitle(page, run);
});

test('changing categories cancels real key capture without saving a binding or closing Settings', async (t) => {
  const page = await soloPage(t, { titleScreen: true }),
    run = page.rendered.run;
  activate(page, 'shell-options');
  activate(page, 'settings-tab-controls');
  page.$('keyboard-settings').open = true;
  const binding = page.$('key-binding-list').querySelector('button');
  binding.focus();
  press(page, 'Enter');
  assert.equal(page.$('cancel-key-capture').hidden, false);
  const before = [...page.storage.map];
  // Native pointer activation need not move focus before the click; the
  // category hook must own cancellation and place focus on the visible tab.
  page.$('settings-tab-audio').click();
  assert.equal(page.$('cancel-key-capture').hidden, true);
  assert.equal(page.doc.activeElement, page.$('settings-tab-audio'));
  category(page, 'audio');
  assert.equal(page.$('settings-dialog').open, true);
  assert.deepEqual([...page.storage.map], before);

  activate(page, 'settings-tab-controls');
  binding.focus();
  press(page, 'Enter');
  assert.equal(page.$('cancel-key-capture').hidden, false);
  const escape = press(page, 'Escape');
  assert.equal(escape.defaultPrevented, true);
  assert.equal(page.$('cancel-key-capture').hidden, true);
  assert.equal(page.$('settings-dialog').open, true, 'Capture owns the first Escape.');
  assert.equal(page.doc.activeElement, binding);
  assert.deepEqual([...page.storage.map], before);
  heldAtTitle(page, run);
});
