import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareNativeMenus } from '../ui/native-menus.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { menuAnimationBinding, MENU_ANIMATION_KEY } from '../ui/menu-animation-preferences.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';

const initial = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const modes = [
  ['solo', '../index.html', 'settings', ''],
  ['team', '../couch/relay-rescue.html', 'coop-settings', 'coop-'],
  ['versus', '../couch/index.html', 'race-settings', 'race-'],
];
async function fixture(t, [mode, file, prefix, fields] = modes[0]) {
  const priorLocale = getLocale();
  setLocale('en', { persist: false });
  const doc = new Document(),
    win = doc.defaultView,
    media = Object.assign(new Events(), { matches: false }),
    data = new Map([
      [DISPLAY_PREFERENCES_KEY, JSON.stringify(initial)],
      [MENU_ANIMATION_KEY, 'on'],
    ]),
    writes = [],
    explicitDisplay = [];
  let failure = null;
  win.location = new URL('https://example.test/game/');
  win.matchMedia = () => media;
  win.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      writes.push({ key, value });
      if (failure === 'silent') return;
      if (failure) throw new DOMException('Modeled storage failure', failure);
      data.set(key, value);
    },
  };
  mountCouch(doc, await readFile(new URL(file, import.meta.url), 'utf8'));
  const menu = prepareNativeMenus({ document: doc, mode }),
    display = createDisplayPreferences({ window: win, getStorage: () => win.localStorage });
  const stop = display.subscribe((state) => {
    doc.getElementById(`${fields}text-face`).value = state.textFace;
    doc.getElementById(`${fields}text-size`).value = state.textSize;
    doc.getElementById(mode === 'solo' ? 'settings-reduced-effects' : `${fields}reduced`).checked =
      state.reducedEffects;
  });
  const setDisplay = (patch) => {
    explicitDisplay.push(patch);
    return display.set(patch);
  };
  menu.refreshGlobalSettings({ comfort: { display, setDisplay } });
  t.after(() => {
    menu.destroy();
    stop();
    display.dispose();
    setLocale(priorLocale, { persist: false });
  });
  const $ = (suffix) => doc.getElementById(`${prefix}-panel-accessibility-comfort-${suffix}`),
    animation = menuAnimationBinding(win);
  return {
    doc,
    win,
    menu,
    display,
    animation,
    data,
    writes,
    explicitDisplay,
    $,
    media,
    fail(value) {
      failure = value;
    },
    select(value) {
      $('choice').value = value;
      $('choice').emit('change');
    },
    remote(key, value) {
      data.set(key, value);
      win.emit('storage', { key, newValue: value, storageArea: win.localStorage });
    },
  };
}

for (const mode of modes)
  test(`${mode[0]} native presets preview without writes and Apply/Undo retain the host display writer`, async (t) => {
    const h = await fixture(t, mode);
    h.select('clear');
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.explicitDisplay, []);
    assert.match(h.$('choice').closest('section').textContent, /Text style: Theme font → Plain/);
    h.$('apply').click();
    assert.deepEqual(h.explicitDisplay, [{ textFace: 'plain', textSize: 'large' }]);
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), {
      ...initial,
      textFace: 'plain',
      textSize: 'large',
    });
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
    h.$('undo').focus();
    h.$('undo').click();
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.equal(h.doc.activeElement, h.$('apply'));
    assert.equal(h.$('undo').disabled, true);
  });

for (const failure of ['silent', 'QuotaExceededError'])
  test(`failed ${failure} preset saving retains session choices, localized feedback and original Undo through Retry`, async (t) => {
    const h = await fixture(t);
    h.fail(failure);
    h.$('apply').click();
    assert.equal(h.display.snapshot().textSize, 'large');
    assert.equal(h.animation.get(), false);
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
    assert.match(h.$('status').textContent, /could not be saved/);
    assert.equal(h.$('apply').textContent, 'Retry saving preset');
    h.$('apply').focus();
    setLocale('uk', { persist: false });
    assert.match(h.$('status').textContent, /Лише в цьому сеансі/);
    assert.equal(h.doc.activeElement, h.$('apply'));
    h.fail(null);
    h.$('apply').click();
    assert.equal(h.display.getWarning(), '');
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'off');
    h.$('undo').click();
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
  });

test('a newer explicit same-value display edit keeps its whole record while Undo restores only owned menu motion', async (t) => {
  const h = await fixture(t);
  h.$('apply').click();
  h.display.set({ textSize: 'large' });
  h.$('undo').click();
  assert.equal(h.display.snapshot().textFace, 'plain');
  assert.equal(h.display.snapshot().textSize, 'large');
  assert.equal(h.display.snapshot().reducedEffects, true);
  assert.equal(h.animation.get(), true);
});

test('a newer explicit same-value menu choice stays while Undo restores only owned display fields', async (t) => {
  const h = await fixture(t);
  h.$('apply').click();
  h.animation.set(false);
  h.$('undo').click();
  assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
  assert.equal(h.animation.get(), false);
});

test('newer other-tab values revoke Undo and stale events cannot revoke current ownership', async (t) => {
  const h = await fixture(t);
  h.$('apply').click();
  h.win.emit('storage', {
    key: DISPLAY_PREFERENCES_KEY,
    newValue: JSON.stringify(initial),
    storageArea: h.win.localStorage,
  });
  assert.equal(h.$('undo').disabled, false);
  h.remote(DISPLAY_PREFERENCES_KEY, JSON.stringify({ ...initial, textSize: 'large' }));
  h.remote(MENU_ANIMATION_KEY, 'on');
  assert.equal(h.$('undo').disabled, true);
  assert.match(h.$('status').textContent, /Newer choices were kept/);
  assert.equal(h.display.snapshot().textSize, 'large');
});

test('system reduced motion remains active through preset Undo without being persisted as player intent', async (t) => {
  const h = await fixture(t);
  h.$('apply').click();
  h.media.matches = true;
  h.media.emit('change');
  h.$('undo').click();
  assert.equal(h.display.snapshot().reducedEffects, false);
  assert.equal(h.display.snapshot().effectiveReducedEffects, true);
  assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
});

test('a reentrant newer menu choice during display Undo is preserved', async (t) => {
  const h = await fixture(t);
  h.$('apply').click();
  const stop = h.display.subscribe((state) => {
    if (state.textSize === 'standard') h.animation.set(false);
  });
  h.$('undo').click();
  stop();
  assert.equal(h.animation.get(), false);
  assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
});

test('Clear text never retries an unrelated failed menu choice', async (t) => {
  const h = await fixture(t);
  h.fail('silent');
  h.animation.set(false);
  h.select('clear');
  h.$('apply').click();
  h.fail(null);
  h.$('apply').click();
  assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
  assert.equal(h.animation.get(), false);
  assert.equal(h.animation.persistence().status, 'session');
});

test('a persisted page return retires Undo even when missed other-tab choices return to the same values', async (t) => {
  const h = await fixture(t);
  h.$('apply').click();
  const savedDisplay = h.data.get(DISPLAY_PREFERENCES_KEY),
    writes = h.writes.length;
  h.win.emit('pageshow', { persisted: false });
  assert.equal(h.$('undo').disabled, false);
  // No storage events arrive while the page is frozen.
  h.data.set(DISPLAY_PREFERENCES_KEY, JSON.stringify(initial));
  h.data.set(MENU_ANIMATION_KEY, 'on');
  h.data.set(DISPLAY_PREFERENCES_KEY, savedDisplay);
  h.data.set(MENU_ANIMATION_KEY, 'off');
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.$('undo').disabled, true);
  assert.match(h.$('status').textContent, /page was restored/);
  assert.equal(h.data.get(DISPLAY_PREFERENCES_KEY), savedDisplay);
  assert.equal(h.animation.get(), false);
  assert.equal(h.writes.length, writes, 'Page restoration never writes or reverts preferences.');
  setLocale('uk', { persist: false });
  assert.match(h.$('status').textContent, /Сторінку відновлено/);
});
