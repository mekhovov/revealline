import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { FIXED_DT } from '../coop/core.mjs';

const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const teamHTML = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const raw = (store) => JSON.parse(store.getItem(DISPLAY_PREFERENCES_KEY));
let sequence = 0;
function change(page, id, value) {
  const control = page.$(id);
  if (typeof value === 'boolean') control.checked = value;
  else control.value = value;
  control.emit('change');
}
function reaches(page, id) {
  for (let count = 0; count < 30; count++) {
    page.doc.activeElement.emit('keydown', { key: 'Tab', code: 'Tab', repeat: false });
    if (page.doc.activeElement === page.$(id)) return;
  }
  assert.fail(`Actual menu traversal must reach ${id}`);
}
function reflects(page, face, size, reduced) {
  assert.equal(page.doc.body.dataset.textFace, face);
  assert.equal(page.doc.body.dataset.textSize, size);
  assert.equal(page.doc.body.dataset.effects, reduced ? 'reduced' : 'full');
}

// Real Team markup, host, core and painter; only Canvas and browser/frame boundaries are finite.
async function teamPage(t, store, { systemReduced = false } = {}) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, teamHTML);
  const $ = (id) => doc.getElementById(id),
    frames = new Map(),
    originals = new Map();
  let next = 0,
    now = 0,
    calls = [],
    font = '';
  const context = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) =>
          calls.push({ method, args, ...(method === 'fillText' ? { font } : {}) }),
      set: (_, key, value) => {
        if (key === 'font') font = value;
        return true;
      },
    },
  );
  $('coop-canvas').width = 1152;
  $('coop-canvas').height = 576;
  $('coop-canvas').getContext = () => context;
  const media = new Events();
  media.matches = systemReduced;
  const globals = {
    document: doc,
    window: win,
    localStorage: store,
    navigator: { getGamepads: () => [] },
    location: { href: 'http://localhost/game/couch/relay-rescue.html' },
    matchMedia: (query) =>
      query === '(prefers-reduced-motion: reduce)' ? media : { matches: false },
    requestAnimationFrame(fn) {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    frames.clear();
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  await import(`../couch/relay-rescue.mjs?display-host=${++sequence}`);
  assert.equal(doc.documentElement.dataset.toolState, 'ready');
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      calls = [];
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      fn((now += FIXED_DT * 1000));
    }
  };
  return {
    $,
    doc,
    win,
    tick,
    media,
    geometry: () => calls.map(({ method, args }) => ({ method, args })),
    fonts: () => calls.filter((c) => c.method === 'fillText').map((c) => c.font),
  };
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: shared display edits preserve the actual paused Solo cut and replay`, async (t) => {
    const store = memoryStorage();
    saveLibrary(
      store,
      profileKey,
      updatePreferences(emptyLibrary(), { turnPolicy, textSize: 'large' }),
    );
    const page = await soloPage(t, { campaign, storage: store });
    assert.equal(
      store.getItem(DISPLAY_PREFERENCES_KEY),
      null,
      'Legacy adoption must not write a new record.',
    );
    page.$('start-button').click();
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let n = 0; n < 13; n++) page.frame();
    assert.equal(page.rendered.run.player.cutting, true);
    page.$('settings-button').click();
    page.$('settings-tab-display').click();
    page.frame(0);
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      slot = store.getItem(sessionKey);
    const library = loadLibrary(store, profileKey).library;
    change(page, 'text-face', 'plain');
    change(page, 'settings-reduced-effects', true);
    reflects(page, 'plain', 'large', true);
    assert.deepEqual(raw(store), { textFace: 'plain', textSize: 'large', reducedEffects: true });
    page.frame(0);
    assert.equal(page.rendered.textFace, 'plain');
    assert.equal(page.rendered.reduced, true);
    assert.strictEqual(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(store.getItem(sessionKey), slot);
    assert.deepEqual(
      loadLibrary(store, profileKey).library,
      updatePreferences(library, { textFace: 'plain', textSize: 'large', reducedEffects: true }),
    );
    page.doc.querySelector('button[data-close="settings-dialog"]').click();
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    page.$('start-button').click();
    for (let n = 0; n < 12; n++) page.frame();
    page.$('pause-button').click();
    page.frame(0);
    assert.equal(verifyReplay(JSON.parse(store.getItem(sessionKey)).replay).match, true);
    assert.deepEqual(page.errors, []);
  });
}

test('Solo to Team to Versus and back restores one display record without Couch profile writes', async (t) => {
  const store = memoryStorage();
  saveLibrary(
    store,
    profileKey,
    updatePreferences(emptyLibrary(), { textFace: 'plain', textSize: 'large' }),
  );
  await t.test('Solo explicitly opts into the shared record', async (t) => {
    const page = await soloPage(t, { campaign, storage: store, titleScreen: true });
    page.$('shell-options').click();
    page.$('settings-tab-display').click();
    change(page, 'settings-reduced-effects', true);
    reflects(page, 'plain', 'large', true);
  });
  const profile = store.getItem(profileKey),
    session = store.getItem(sessionKey);
  await t.test('Team adopts and edits from its real paused Options', async (t) => {
    const before = store.writes.length,
      page = await teamPage(t, store);
    assert.equal(store.writes.length, before);
    reflects(page, 'plain', 'large', true);
    page.$('coop-start').click();
    page.tick(10);
    page.$('coop-pause').click();
    page.tick();
    const geometry = page.geometry(),
      clock = page.$('coop-clock').textContent;
    page.$('coop-options').open = true;
    page.$('coop-options-toggle').focus();
    for (const id of ['coop-text-face', 'coop-text-size', 'coop-reduced']) reaches(page, id);
    change(page, 'coop-text-face', 'pixel');
    change(page, 'coop-text-size', 'standard');
    page.tick(120);
    assert.deepEqual(page.geometry(), geometry);
    assert.ok(page.fonts().some((font) => font.includes('Field Kit Mono')));
    assert.equal(page.$('coop-clock').textContent, clock);
    assert.equal(page.$('coop-overlay-title').textContent, 'Both players paused');
    assert.equal(store.getItem(profileKey), profile);
    assert.equal(store.getItem(sessionKey), session);
  });
  await t.test(
    'Versus adopts, exposes controls to keyboard and changes only display state',
    async (t) => {
      const before = store.writes.length,
        page = await couchPage(t, { storage: store });
      assert.equal(store.writes.length, before);
      reflects(page, 'pixel', 'standard', true);
      page.$('race-start').click();
      page.frame();
      page.frames(8);
      page.$('race-pause').click();
      page.frame(0); // Refresh the real HUD after Pause without advancing either run.
      const checkpoint = page.checkpoint(),
        display = store.getItem(DISPLAY_PREFERENCES_KEY),
        writes = store.writes.length;
      page.$('race-options').focus();
      page.$('race-options').click();
      assert.equal(page.doc.activeElement.id, 'race-text-face');
      assert.equal(store.getItem(DISPLAY_PREFERENCES_KEY), display);
      assert.equal(store.writes.length, writes, 'Opening Options does not save a preference');
      assert.equal(page.state(), 'paused');
      assert.deepEqual(page.checkpoint(), checkpoint);
      page.$('race-options-back').focus();
      reaches(page, 'race-text-face');
      reaches(page, 'race-text-size');
      change(page, 'race-text-face', 'plain');
      change(page, 'race-text-size', 'large');
      change(page, 'race-reduced', false);
      page.frames(30);
      reflects(page, 'plain', 'large', false);
      assert.equal(page.drawOptions[0].textFace, 'plain');
      assert.equal(page.drawOptions[1].reduced, false);
      assert.deepEqual(page.checkpoint(), checkpoint);
      assert.equal(page.state(), 'paused');
      assert.equal(store.getItem(profileKey), profile);
      assert.equal(store.getItem(sessionKey), session);
      page.$('race-options-back').click();
      assert.equal(page.doc.activeElement.id, 'race-options');
      page.frames(20);
      assert.equal(page.state(), 'paused');
      assert.deepEqual(page.checkpoint(), checkpoint);
    },
  );
  await t.test('fresh Solo prefers the shared record over its older profile', async (t) => {
    const before = store.writes.length,
      page = await soloPage(t, { campaign, storage: store, titleScreen: true });
    reflects(page, 'plain', 'large', false);
    assert.equal(page.$('settings-reduced-effects').checked, false);
    assert.equal(store.writes.length, before);
    assert.equal(store.getItem(profileKey), profile);
  });
});

test('Team system reduction preserves a raw false choice and a denied shared save stays session-only', async (t) => {
  const store = memoryStorage(),
    initial = { textFace: 'plain', textSize: 'large', reducedEffects: false };
  store.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(initial));
  const before = new Map(store.map),
    page = await teamPage(t, store, { systemReduced: true });
  reflects(page, 'plain', 'large', true);
  assert.equal(page.$('coop-reduced').checked, false);
  assert.match(page.$('coop-system-reduction').textContent, /System reduced motion/);
  assert.deepEqual(store.map, before);
  store.setItem = () => {
    throw new DOMException('Full storage', 'QuotaExceededError');
  };
  change(page, 'coop-text-size', 'standard');
  reflects(page, 'plain', 'standard', true);
  assert.match(page.$('coop-display-status').textContent, /session|save/i);
  assert.deepEqual(store.map, before);
  page.media.matches = false;
  page.media.emit('change');
  reflects(page, 'plain', 'standard', false);
  assert.equal(page.$('coop-reduced').checked, false);
});

test('Versus controller selects the real display control without replacing or starting the duel', async (t) => {
  const store = memoryStorage(),
    pad = {
      index: 0,
      id: 'Display pad',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
  const page = await couchPage(t, { storage: store, pads: [pad] });
  page.join(0);
  const displayBefore = store.getItem(DISPLAY_PREFERENCES_KEY);
  page.$('race-options').click();
  page.frame();
  assert.equal(page.doc.activeElement.id, 'race-text-face');
  assert.equal(store.getItem(DISPLAY_PREFERENCES_KEY), displayBefore);
  const before = page.checkpoint();
  page.focus('race-text-size');
  page.pulse(0, 0);
  assert.equal(page.editors().length, 1);
  page.pulse(0, 13);
  page.pulse(0, 0);
  assert.equal(page.editors().length, 0);
  assert.equal(page.$('race-text-size').value, 'large');
  assert.equal(raw(store).textSize, 'large');
  assert.equal(page.doc.activeElement.id, 'race-text-size');
  assert.equal(page.state(), 'ready');
  assert.deepEqual(page.checkpoint(), before);
});
