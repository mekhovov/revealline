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

import { t as translateComfortWarning } from '../i18n/index.mjs';

const partialComfortCopy = {
  en: 'Newer choices were kept. Undo affects only preset settings that remain unchanged.',
  uk: 'Новіший вибір залишено без змін. Скасування стосується лише незмінених налаштувань набору.',
};
const supersededComfortCopy = {
  en: 'Newer choices were kept. Undo is no longer available for this preset.',
  uk: 'Новіші зміни збережено. Скасування цього набору більше недоступне.',
};
const comfortTarget = { textFace: 'plain', textSize: 'large', reducedEffects: true };
const menuWrites = (h) => h.writes.filter(({ key }) => key === MENU_ANIMATION_KEY);
function assertComfortFeedback(h, kind = 'partial', owner = null, retry = false) {
  const focused = h.doc.activeElement;
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    const suffix = owner === 'display'
      ? h.display.getWarningKey()
        ? translateComfortWarning(h.display.getWarningKey())
        : h.display.getWarning()
      : owner === 'menu' ? h.animation.feedback(locale).text : '';
    const sentence = (kind === 'partial' ? partialComfortCopy : supersededComfortCopy)[locale];
    assert.equal(h.$('status').textContent, [sentence, suffix].filter(Boolean).join(' '));
    assert.equal(h.$('apply').textContent,
      locale === 'en'
        ? retry ? 'Retry saving preset' : 'Apply preset'
        : retry ? 'Повторити збереження набору' : 'Застосувати набір');
    assert.equal(h.doc.activeElement, focused);
  }
}

for (const mode of modes)
  for (const newer of [true, false])
    test(`${mode[0]} Apply preserves a newer explicit menu choice ${newer} during the display callback`, async (t) => {
      const h = await fixture(t, mode);
      const revision = h.animation.revision();
      let armed = false;
      const stop = h.display.subscribe((state) => {
        if (!armed || state.textSize !== 'large') return;
        armed = false;
        h.animation.set(newer);
      });
      t.after(stop);
      armed = true;
      h.$('apply').focus();
      h.$('apply').click();
      assert.equal(armed, false);
      assert.equal(h.animation.get(), newer);
      assert.equal(h.animation.revision(), revision + 1);
      assert.deepEqual(menuWrites(h), [{ key: MENU_ANIMATION_KEY, value: newer ? 'on' : 'off' }]);
      assert.equal(h.data.get(MENU_ANIMATION_KEY), newer ? 'on' : 'off');
      assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), comfortTarget);
      assert.equal(h.$('undo').disabled, false);
      assertComfortFeedback(h);
      stop();
      h.$('undo').click();
      assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
      assert.equal(h.animation.get(), newer);
      assert.equal(h.animation.revision(), revision + 1);
      assert.equal(menuWrites(h).length, 1);
    });

for (const newer of [true, false])
  test(`Retry does not save a newer failed menu choice ${newer} made during its display callback`, async (t) => {
    const h = await fixture(t);
    h.fail('silent');
    h.$('apply').click();
    assert.equal(h.$('apply').textContent, 'Retry saving preset');
    const revision = h.animation.revision(), count = menuWrites(h).length;
    const saved = h.data.get(MENU_ANIMATION_KEY);
    h.fail(null);
    let newerPersistence;
    let armed = false;
    const stop = h.display.subscribe(() => {
      if (!armed) return;
      armed = false;
      h.fail(newer ? 'QuotaExceededError' : 'silent');
      h.animation.set(newer);
      newerPersistence = h.animation.persistence();
      h.fail(null);
    });
    t.after(stop);
    armed = true;
    h.$('apply').focus();
    h.$('apply').click();
    assert.equal(armed, false);
    assert.deepEqual(newerPersistence, {
      status: 'session', reason: newer ? 'full' : 'unconfirmed',
    });
    assert.equal(h.display.getWarning(), '');
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), comfortTarget);
    assert.equal(h.animation.get(), newer);
    assert.equal(h.animation.revision(), revision + 1);
    assert.equal(h.animation.persistence().status, 'session');
    assert.deepEqual(menuWrites(h).slice(count), [{ key: MENU_ANIMATION_KEY, value: newer ? 'on' : 'off' }]);
    assert.equal(h.data.get(MENU_ANIMATION_KEY), saved);
    assertComfortFeedback(h);
    stop();
    h.$('undo').click();
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.equal(h.animation.get(), newer);
    assert.equal(h.animation.revision(), revision + 1);
    assert.equal(h.animation.persistence().status, 'session');
    assert.equal(menuWrites(h).length, count + 1);
  });

for (const newer of [true, false])
  test(`Retry preserves a pre-existing newer failed menu choice ${newer} and its partial status`, async (t) => {
    const h = await fixture(t);
    h.fail('silent');
    h.$('apply').click();
    h.fail(newer ? 'QuotaExceededError' : 'silent');
    h.animation.set(newer);
    assert.deepEqual(h.animation.persistence(), {
      status: 'session', reason: newer ? 'full' : 'unconfirmed',
    });
    const revision = h.animation.revision(), count = menuWrites(h).length;
    const saved = h.data.get(MENU_ANIMATION_KEY);
    h.$('apply').focus();
    assertComfortFeedback(h, 'partial', 'display', true);
    h.fail(null);
    h.$('apply').click();
    assert.equal(h.display.getWarning(), '');
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), comfortTarget);
    assert.equal(h.animation.get(), newer);
    assert.equal(h.animation.revision(), revision);
    assert.equal(menuWrites(h).length, count);
    assert.equal(h.data.get(MENU_ANIMATION_KEY), saved);
    assert.equal(h.animation.persistence().status, 'session');
    assertComfortFeedback(h);
    h.$('undo').click();
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.equal(h.animation.get(), newer);
    assert.equal(h.animation.revision(), revision);
    assert.equal(menuWrites(h).length, count);
    h.animation.set(true);
    h.$('apply').click();
    h.animation.set(false);
    assert.equal(h.$('undo').disabled, false);
    assertComfortFeedback(h);
    h.display.set({ textSize: 'large' });
    assert.equal(h.$('undo').disabled, true);
    assertComfortFeedback(h, 'superseded');
  });

test('menu-only Retry preserves a newer failed display record and reports its partial scope', async (t) => {
  const h = await fixture(t);
  h.fail('silent');
  h.$('apply').click();
  h.display.set({ textSize: 'standard' });
  const newer = h.display.snapshot(), count = h.explicitDisplay.length;
  const menuRevision = h.animation.revision(), menuCount = menuWrites(h).length;
  const savedDisplay = h.data.get(DISPLAY_PREFERENCES_KEY);
  h.$('apply').focus();
  assertComfortFeedback(h, 'partial', 'menu', true);
  h.fail(null);
  h.$('apply').click();
  assert.equal(h.explicitDisplay.length, count);
  assert.deepEqual(h.display.snapshot(), newer);
  assert.equal(h.data.get(DISPLAY_PREFERENCES_KEY), savedDisplay);
  assert.notEqual(h.display.getWarning(), '');
  assert.equal(h.animation.get(), false);
  assert.equal(h.animation.revision(), menuRevision);
  assert.equal(h.animation.persistence().status, 'saved');
  assert.equal(h.data.get(MENU_ANIMATION_KEY), 'off');
  assert.equal(menuWrites(h).length, menuCount + 1);
  assertComfortFeedback(h);
  h.$('undo').click();
  assert.equal(h.explicitDisplay.length, count);
  assert.deepEqual(h.display.snapshot(), newer);
  assert.equal(h.data.get(DISPLAY_PREFERENCES_KEY), savedDisplay);
  assert.equal(h.animation.get(), true);
  assert.equal(h.animation.revision(), menuRevision + 1);
  assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
});


test('fresh Apply records display supersession inside its own callback and keeps menu-only Undo', async (t) => {
  const h = await fixture(t);
  const revision = h.display.snapshot().revision;
  let armed = false;
  const stop = h.display.subscribe(() => {
    if (!armed) return;
    armed = false;
    h.display.set({ textSize: 'standard' });
  });
  t.after(stop);
  armed = true;
  h.$('apply').focus();
  h.$('apply').click();
  const newer = h.display.snapshot(), writes = h.explicitDisplay.length;
  const saved = h.data.get(DISPLAY_PREFERENCES_KEY);
  assert.equal(armed, false);
  assert.equal(newer.revision, revision + 2);
  assert.deepEqual(JSON.parse(saved), { ...comfortTarget, textSize: 'standard' });
  assert.equal(h.animation.get(), false);
  assert.equal(h.$('undo').disabled, false);
  assertComfortFeedback(h);
  stop();
  h.$('undo').click();
  assert.deepEqual(h.display.snapshot(), newer);
  assert.equal(h.data.get(DISPLAY_PREFERENCES_KEY), saved);
  assert.equal(h.explicitDisplay.length, writes);
  assert.equal(h.animation.get(), true);
});

test('fresh Apply records menu supersession inside its own callback and keeps display-only Undo', async (t) => {
  const h = await fixture(t);
  const revision = h.animation.revision();
  let armed = false;
  const stop = h.animation.subscribe(() => {
    if (!armed) return;
    armed = false;
    h.animation.set(true);
  });
  t.after(stop);
  armed = true;
  h.$('apply').focus();
  h.$('apply').click();
  assert.equal(armed, false);
  assert.equal(h.animation.get(), true);
  assert.equal(h.animation.revision(), revision + 2);
  assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
  assert.deepEqual(menuWrites(h).map(x => x.value), ['off', 'on']);
  assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), comfortTarget);
  assert.equal(h.$('undo').disabled, false);
  assertComfortFeedback(h);
  stop();
  h.$('undo').click();
  assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
  assert.equal(h.animation.get(), true);
  assert.equal(h.animation.revision(), revision + 2);
  assert.equal(menuWrites(h).length, 2);
});
