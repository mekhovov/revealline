import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

import { authoritativeCheckpoint } from '../replay.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

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

test('Pause quick sound preserves the live cut and intentionally paused music until deliberate Resume', async (t) => {
  const storage = memoryStorage({
    [AUDIO_PREFERENCES_KEY]: JSON.stringify({ muted: false, volume: 0.13 }),
  });
  const audio = audioHarness();
  const page = await soloPage(t, { storage, audio });
  const quick = page.$('overlay-sound');
  assert.equal(quick.hidden, true, 'Ready has no Pause-only Sound action.');
  assert.equal(quick.getAttribute('aria-label'), 'Sound');
  await settle(() => !page.$('soundtrack-open').disabled);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  for (let n = 0; n < 27; n++) page.frame();
  page.key('ArrowDown', false);
  assert.equal(page.rendered.run.player.cutting, true);
  page.$('pause-button').click();
  page.frame(0);
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run),
    pausedTick = run.tick;
  assert.equal(quick.hidden, false);
  assert.equal(page.doc.activeElement, page.$('start-button'), 'Resume keeps initial Pause focus.');

  page.$('settings-button').click();
  page.$('settings-tab-audio').click();
  page.$('soundtrack-open').click();
  await settle(() => page.$('soundtrack-dialog')?.open && !page.$('soundtrack-pause').disabled);
  await page.$('soundtrack-pause').onclick();
  assert.match(page.$('soundtrack-summary').textContent, /paused/);
  await settle(
    () => !page.$('soundtrack-close').disabled,
    'Music controls finish their loading operation.',
  );
  page.$('soundtrack-close').click();
  await settle(() => !page.$('soundtrack-dialog').open);
  page.doc.querySelector('[data-close="settings-dialog"]').click();
  const transport = () => ({
    summary: page.$('soundtrack-summary').textContent,
    media: page.audioElements.map((media) => ({
      src: media.src,
      time: media.currentTime,
      plays: media.plays,
      paused: media.paused,
    })),
  });
  const previousTransport = transport();
  for (const muted of [true, false]) {
    activate(page, 'overlay-sound');
    assert.deepEqual(JSON.parse(storage.getItem(AUDIO_PREFERENCES_KEY)), { muted, volume: 0.13 });
    assert.equal(quick.textContent, muted ? 'Sound: off' : 'Sound: on');
    assert.equal(quick.getAttribute('aria-label'), 'Sound');
    assert.equal(quick.getAttribute('aria-pressed'), String(!muted));
    assert.equal(page.$('shell-sound').textContent, quick.textContent);
    assert.equal(page.$('settings-master-mute').textContent, muted ? 'Unmute sound' : 'Mute sound');
    for (let n = 0; n < 20; n++) page.frame();
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.doc.activeElement, quick);
    assert.deepEqual(transport(), previousTransport);
  }
  storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: true, volume: 0.42 }));
  page.win.emit('storage', {
    key: AUDIO_PREFERENCES_KEY,
    storageArea: storage,
    newValue: storage.getItem(AUDIO_PREFERENCES_KEY),
  });
  assert.equal(quick.textContent, 'Sound: off');
  assert.equal(quick.getAttribute('aria-pressed'), 'false');
  quick.textContent = 'Stale native restoration';
  quick.setAttribute('aria-pressed', 'true');
  page.win.emit('pageshow', { persisted: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(quick.textContent, 'Sound: off');
  assert.equal(quick.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(transport(), previousTransport);
  activate(page, 'start-button');
  await settle(() => page.doc.body.dataset.flightState === 'running');
  for (let n = 0; n < 4; n++) page.frame();
  assert.equal(page.rendered.run, run);
  assert.ok(run.tick > pausedTick);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.match(
    page.$('soundtrack-summary').textContent,
    /paused/,
    'Flight Resume preserves Music Pause.',
  );
  assert.deepEqual(page.errors, []);
});

test('Pause quick sound keeps failed-save session intent through restoration without resuming', async (t) => {
  const storage = memoryStorage({
    [AUDIO_PREFERENCES_KEY]: JSON.stringify({ muted: false, volume: 0.13 }),
  });
  const page = await soloPage(t, { storage });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.$('pause-button').click();
  page.frame(0);
  const before = authoritativeCheckpoint(page.rendered.run),
    saved = storage.getItem(AUDIO_PREFERENCES_KEY);
  const write = storage.setItem.bind(storage);
  t.mock.method(storage, 'setItem', (key, value) => {
    if (key === AUDIO_PREFERENCES_KEY) throw new Error('Test storage unavailable.');
    return write(key, value);
  });
  activate(page, 'overlay-sound');
  assert.equal(storage.getItem(AUDIO_PREFERENCES_KEY), saved);
  assert.equal(page.$('overlay-sound').textContent, 'Sound: off');
  assert.equal(page.$('shell-sound').textContent, 'Sound: off');
  page.win.emit('pageshow', { persisted: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  page.frame(200);
  assert.equal(page.$('overlay-sound').getAttribute('aria-pressed'), 'false');
  assert.equal(page.doc.activeElement, page.$('overlay-sound'));
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(page.errors, []);
});

test('embedded training Pause Sound remains session-only and cannot resume or award progress', async (t) => {
  const page = await soloPage(t, {
    search: '?course=first-flight&lesson=close-line',
    parentWindow: {},
  });
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let n = 0; n < 20; n++) page.frame();
  assert.equal(page.rendered.run.player.cutting, true);
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  const before = authoritativeCheckpoint(page.rendered.run),
    stored = [...page.storage.map],
    writes = page.storage.writes.length;
  assert.equal(page.$('overlay-sound').hidden, false);
  const prior = page.$('overlay-sound').getAttribute('aria-pressed');
  activate(page, 'overlay-sound');
  assert.notEqual(page.$('overlay-sound').getAttribute('aria-pressed'), prior);
  for (let n = 0; n < 20; n++) page.frame();
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual([...page.storage.map], stored);
  assert.equal(page.storage.writes.length, writes);
  assert.equal(page.doc.activeElement, page.$('overlay-sound'));
  assert.deepEqual(page.errors, []);
});
