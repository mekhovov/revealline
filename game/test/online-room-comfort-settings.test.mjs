import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { MENU_ANIMATION_KEY } from '../ui/menu-animation-preferences.mjs';
import { mountRoomUI } from '../online/room-ui.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const initial = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };

// Run the complete room presentation owner. DOM, storage and a paused transport
// snapshot are finite models; no server, rendered board or audio device is used.
async function fixture(t, locale) {
  const priorLocale = getLocale(),
    doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    data = new Map([
      [DISPLAY_PREFERENCES_KEY, JSON.stringify(initial)],
      [MENU_ANIMATION_KEY, 'on'],
      ['revealline.audio-master.v1', JSON.stringify({ muted: true, volume: 0.3 })],
    ]),
    writes = [],
    transportCalls = [],
    priorGlobals = new Map();
  let frame = 0,
    failure = null,
    disposed = false,
    view;
  setLocale(locale, { persist: false });
  doc.parentNode = win;
  mountCouch(doc, await readFile(new URL('../online/index.html', import.meta.url), 'utf8'));
  const reconnect = doc.createElement('button');
  reconnect.id = 'reconnect';
  doc.getElementById('notice').after(reconnect);
  Object.assign(win, {
    location: new URL('https://example.test/game/online/'),
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem(key, value) {
        writes.push([key, value]);
        if (failure) throw new DOMException('Modeled full storage', 'QuotaExceededError');
        data.set(key, value);
      },
    },
    navigator: { getGamepads: () => [] },
    matchMedia: () => Object.assign(new Events(), { matches: false }),
    requestAnimationFrame(fn) {
      frames.set(++frame, fn);
      return frame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout,
    clearTimeout,
  });
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    location: win.location,
    navigator: win.navigator,
    localStorage: win.localStorage,
    matchMedia: win.matchMedia,
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
  })) {
    priorGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const display = createDisplayPreferences({ window: win, getStorage: () => win.localStorage }),
    destruction = createDestructionPreferences(),
    state = Object.freeze({
      status: 'paused',
      recipe: Object.freeze({ mode: 'versus' }),
      engine: Object.freeze({ kind: 'snake', runs: Object.freeze([]) }),
    });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    view?.dispose();
    display.dispose();
    destruction.dispose?.();
  };
  t.after(() => {
    dispose();
    for (const [key, descriptor] of priorGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    setLocale(priorLocale, { persist: false });
  });
  for (const id of ['ready', 'create', 'rematch'])
    doc.getElementById(id).addEventListener('click', () => transportCalls.push(id));
  view = mountRoomUI({
    getState: () => state,
    getSeat: () => 0,
    canPlay: () => false,
    submit: (...args) => transportCalls.push(['submit', ...args]),
    pause: () => transportCalls.push('pause'),
    display,
    destruction,
  });
  view.shell.open('settings');
  return {
    doc,
    win,
    display,
    state,
    data,
    writes,
    transportCalls,
    dispose,
    $: (suffix) => doc.getElementById(`room-display-comfort-${suffix}`),
    fail(value) {
      failure = value;
    },
  };
}

for (const locale of ['en', 'uk'])
  test(`Rooms ${locale} presets preserve paused transport through preview, failed saves, Retry and Undo`, async (t) => {
    const h = await fixture(t, locale),
      accepted = JSON.stringify(h.state),
      before = h.writes.length,
      apply = h.$('apply');
    h.$('choice').value = 'clear';
    h.$('choice').emit('change');
    h.$('choice').value = 'comfort';
    h.$('choice').emit('change');
    assert.equal(h.writes.length, before, 'Preview does not persist preferences.');
    assert.equal(h.doc.body.dataset.textSize, 'standard');
    h.fail(true);
    apply.focus();
    apply.click();
    assert.equal(h.doc.querySelector('[data-tool-text-size]').value, 'large');
    assert.equal(h.doc.querySelector('[data-tool-text-face]').value, 'plain');
    assert.equal(h.doc.getElementById('room-reduced').checked, true);
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.match(
      h.$('status').textContent,
      locale === 'en' ? /Session only/ : /Лише в цьому сеансі/,
    );
    assert.equal(h.doc.activeElement, apply);
    h.fail(false);
    apply.click();
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'off');
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), {
      textFace: 'plain',
      textSize: 'large',
      reducedEffects: true,
    });
    assert.doesNotMatch(h.$('status').textContent, /Session only|Лише в цьому сеансі/);
    h.$('undo').focus();
    h.$('undo').click();
    assert.equal(h.doc.activeElement, apply);
    assert.equal(h.doc.querySelector('[data-tool-text-size]').value, 'standard');
    assert.equal(h.doc.querySelector('[data-tool-text-face]').value, 'pixel');
    assert.equal(h.doc.getElementById('room-reduced').checked, false);
    assert.deepEqual(JSON.parse(h.data.get(DISPLAY_PREFERENCES_KEY)), initial);
    assert.equal(h.data.get(MENU_ANIMATION_KEY), 'on');
    assert.equal(JSON.stringify(h.state), accepted);
    assert.deepEqual(
      h.transportCalls,
      [],
      'Settings never ready, start, pause or submit a room action.',
    );
    h.dispose();
    const after = h.writes.length;
    apply.click();
    h.win.emit('pageshow', { persisted: true });
    assert.equal(h.writes.length, after);
    assert.equal(h.doc.querySelector('.comfort-presets'), null);
  });
