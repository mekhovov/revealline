import { modelTeamDialogs } from './helpers/coop-host.mjs';
import {
  installCoopPresentation,
  waitFor as waitForTeamPicture,
} from './helpers/coop-presentation-fixture.mjs';
import { installActorAppearanceTransport } from './helpers/actor-appearance-transport.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MENU_STYLE_PREFERENCES_KEY } from '../menu-style-preferences.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary } from '../library.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { FIXED_DT } from '../coop/core.mjs';

const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const teamHTML = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const raw = (store) => JSON.parse(store.getItem(MENU_STYLE_PREFERENCES_KEY));
const unrelated = (store) =>
  new Map([...store.map].filter(([key]) => key !== MENU_STYLE_PREFERENCES_KEY));
let sequence = 0;
function change(page, id, value) {
  const control = page.$(id);
  assert.equal(control.disabled, false, `${id} remains usable`);
  control.value = value;
  control.emit('change');
}
function reaches(page, id) {
  for (let count = 0; count < 40; count++) {
    const active = page.doc.activeElement;
    const event = active.emit('keydown', { key: 'Tab', code: 'Tab', repeat: false });
    if (!event.defaultPrevented) {
      // The finite DOM has no browser defaults. Solo intentionally leaves
      // interior modal Tab native; model only that unprevented default here.
      const root = active.closest('dialog[open]') ?? page.doc.body;
      const choices = [...root.querySelectorAll('button,a,input,select,textarea,summary')].filter(
        (node) =>
          !node.disabled &&
          node.tabIndex >= 0 &&
          !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
          node.getClientRects().length,
      );
      choices[(choices.indexOf(active) + 1) % choices.length]?.focus();
    }
    if (page.doc.activeElement === page.$(id)) return;
  }
  assert.fail(`Actual navigation must reach ${id}`);
}
function reflects(page, prefix, palette, ornaments) {
  assert.equal(page.$(`${prefix}menu-palette`).value, palette);
  assert.equal(page.$(`${prefix}menu-ornaments`).value, ornaments);
  assert.equal(page.doc.body.dataset.menuOrnaments, ornaments);
}

// Real Team markup, host, core and painter; only Canvas and browser/frame boundaries are finite.
async function teamPage(t, store, { systemReduced = false } = {}) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, teamHTML);
  modelTeamDialogs(doc);
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
    location: { href: 'http://localhost/game/couch/relay-rescue.html?journey=legacy' },
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
  installCoopPresentation({
    doc,
    win,
    install(key, descriptor) {
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
    },
  });
  installActorAppearanceTransport({
    baseURL: new URL('../presentation/compiled/', globals.location.href),
    install(key, descriptor) {
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
    },
  });
  await import(`../couch/relay-rescue.mjs?menu-style-host=${++sequence}`);
  await waitForTeamPicture(
    () => $('coop-picture-status').dataset.state === 'ready',
    () => $('coop-picture-status').textContent,
  );
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
  test(`${turnPolicy}: menu edits preserve the actual paused Solo cut, saved slot and replay`, async (t) => {
    const store = memoryStorage();
    saveLibrary(
      store,
      profileKey,
      updatePreferences(emptyLibrary(), { turnPolicy, textSize: 'large' }),
    );
    const page = await soloPage(t, { campaign, storage: store });
    assert.equal(
      store.getItem(MENU_STYLE_PREFERENCES_KEY),
      null,
      'Opening a host does not create a menu preference.',
    );
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let n = 0; n < 13; n++) page.frame();
    assert.equal(page.rendered.run.player.cutting, true);
    page.$('settings-button').click();
    page.$('settings-tab-display').click();
    page.frame(0);
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      records = unrelated(store),
      backdrop = page.rendered.backdrop;
    page.$('text-size').focus();
    reaches(page, 'menu-palette');
    change(page, 'menu-palette', 'ukrainian');
    reaches(page, 'menu-ornaments');
    change(page, 'menu-ornaments', 'rich');
    page.frame(0);
    assert.deepEqual(raw(store), { palette: 'ukrainian', ornaments: 'rich' });
    assert.equal(page.doc.body.dataset.menuPalette, 'field-kit');
    assert.equal(page.doc.body.dataset.textSize, 'large');
    assert.strictEqual(page.rendered.run, run);
    assert.strictEqual(page.rendered.backdrop, backdrop);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(
      unrelated(store),
      records,
      'No profile, display, audio or suspended-slot writer is invoked.',
    );
    page.doc.querySelector('button[data-close="settings-dialog"]').click();
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    for (let n = 0; n < 12; n++) page.frame();
    page.$('pause-button').click();
    page.frame(0);
    assert.equal(verifyReplay(JSON.parse(store.getItem(sessionKey)).replay).match, true);
    assert.deepEqual(page.errors, []);
  });
}

test('one separate menu record survives Solo, Team, Versus and Solo return without altering display or progress', async (t) => {
  const store = memoryStorage();
  saveLibrary(
    store,
    profileKey,
    updatePreferences(emptyLibrary(), { textFace: 'plain', textSize: 'large' }),
  );
  store.setItem(
    DISPLAY_PREFERENCES_KEY,
    JSON.stringify({ textFace: 'plain', textSize: 'large', reducedEffects: true }),
  );
  await t.test('Solo opts into FPV Field Kit rich menus from the real Settings', async (t) => {
    const page = await soloPage(t, { campaign, storage: store, titleScreen: true });
    page.$('shell-options').click();
    page.$('settings-tab-display').click();
    const records = unrelated(store);
    change(page, 'menu-palette', 'ukrainian');
    change(page, 'menu-ornaments', 'rich');
    assert.deepEqual(unrelated(store), records);
  });
  const records = unrelated(store);
  await t.test(
    'Team changes menu styling from paused Options without changing a single painter command',
    async (t) => {
      const before = store.writes.length,
        page = await teamPage(t, store);
      assert.equal(store.writes.length, before);
      reflects(page, 'coop-', 'ukrainian', 'rich');
      page.$('coop-start').click();
      page.tick(10);
      page.$('coop-pause').click();
      page.tick();
      const geometry = page.geometry(),
        clock = page.$('coop-clock').textContent,
        fonts = page.fonts();
      page.$('coop-settings-open').click();
      page.$('coop-settings-tab-display').focus();
      reaches(page, 'coop-menu-palette');
      change(page, 'coop-menu-palette', 'auto');
      reaches(page, 'coop-menu-ornaments');
      for (const ornaments of ['off', 'rich', 'subtle', 'off']) {
        change(page, 'coop-menu-ornaments', ornaments);
        page.tick();
        assert.equal(page.doc.activeElement.id, 'coop-menu-ornaments');
        assert.deepEqual(page.geometry(), geometry);
      }
      page.tick(120);
      assert.deepEqual(page.geometry(), geometry);
      assert.deepEqual(page.fonts(), fonts);
      assert.equal(page.$('coop-clock').textContent, clock);
      assert.equal(page.$('coop-overlay-title').textContent, 'Both players paused');
      assert.equal(page.doc.body.dataset.textFace, 'plain');
      assert.equal(page.doc.body.dataset.textSize, 'large');
      assert.equal(page.doc.body.dataset.effects, 'reduced');
      assert.deepEqual(unrelated(store), records);
    },
  );
  await t.test(
    'Versus Settings opens Appearance category, paused checkpoint and exact Back opener',
    async (t) => {
      const before = store.writes.length,
        page = await couchPage(t, { storage: store });
      assert.equal(store.writes.length, before);
      reflects(page, 'race-', 'auto', 'off');
      page.$('race-start').click();
      page.frame();
      page.frames(8);
      page.$('race-pause').click();
      page.frame(0);
      const checkpoint = page.checkpoint(),
        pictures = page.drawOptions.map((options) => options.backdrop);
      page.$('race-options').focus();
      page.$('race-options').click();
      assert.equal(page.doc.activeElement.id, 'race-settings-tab-display');
      reaches(page, 'race-menu-palette');
      change(page, 'race-menu-palette', 'ukrainian');
      reaches(page, 'race-menu-ornaments');
      for (const ornaments of ['rich', 'subtle']) {
        change(page, 'race-menu-ornaments', ornaments);
        page.frame(0);
        assert.equal(page.doc.activeElement.id, 'race-menu-ornaments');
        assert.deepEqual(page.checkpoint(), checkpoint);
      }
      page.frames(30);
      assert.deepEqual(page.checkpoint(), checkpoint);
      assert.deepEqual(
        page.drawOptions.map((options) => options.backdrop),
        pictures,
      );
      assert.equal(page.state(), 'paused');
      assert.deepEqual(unrelated(store), records);
      page.$('race-options-back').click();
      assert.equal(page.doc.activeElement.id, 'race-options');
      page.frames(20);
      assert.equal(page.state(), 'paused');
      assert.deepEqual(page.checkpoint(), checkpoint);
    },
  );
  await t.test('fresh Solo adopts without an implicit save or start', async (t) => {
    const before = store.writes.length,
      page = await soloPage(t, { campaign, storage: store, titleScreen: true });
    reflects(page, '', 'ukrainian', 'subtle');
    assert.equal(store.writes.length, before);
    assert.deepEqual(unrelated(store), records);
    assert.equal(page.$('shell-home').open, true);
  });
});

test('controller editing the new native selectors changes only menu style and preserves Ready', async (t) => {
  const store = memoryStorage(),
    pad = {
      index: 0,
      id: 'Menu style pad',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
  const page = await couchPage(t, { storage: store, pads: [pad] });
  page.join(0);
  page.$('race-options').click();
  page.frame();
  const before = page.checkpoint(),
    records = unrelated(store);
  for (const [id, expected] of [
    ['race-menu-palette', 'ukrainian'],
    ['race-menu-ornaments', 'rich'],
  ]) {
    page.focus(id);
    page.pulse(0, 0);
    assert.equal(page.editors().length, 1);
    page.pulse(0, 13);
    page.pulse(0, 0);
    assert.equal(page.editors().length, 0);
    assert.equal(page.$(id).value, expected);
    assert.equal(page.doc.activeElement.id, id);
  }
  assert.deepEqual(raw(store), { palette: 'ukrainian', ornaments: 'rich' });
  assert.equal(page.state(), 'ready');
  assert.deepEqual(page.checkpoint(), before);
  assert.deepEqual(unrelated(store), records);
});

test('denied menu saving leaves Team local choice usable and does not replace the existing shared record', async (t) => {
  const store = memoryStorage();
  store.setItem(
    MENU_STYLE_PREFERENCES_KEY,
    JSON.stringify({ palette: 'auto', ornaments: 'subtle' }),
  );
  const page = await teamPage(t, store),
    before = new Map(store.map);
  store.setItem = () => {
    throw new DOMException('Full storage', 'QuotaExceededError');
  };
  change(page, 'coop-menu-palette', 'ukrainian');
  change(page, 'coop-menu-ornaments', 'off');
  reflects(page, 'coop-', 'ukrainian', 'off');
  assert.match(page.$('coop-menu-style-status').textContent, /session|save/i);
  assert.deepEqual(store.map, before);
  page.win.emit('storage', {
    key: MENU_STYLE_PREFERENCES_KEY,
    storageArea: store,
    newValue: store.getItem(MENU_STYLE_PREFERENCES_KEY),
  });
  reflects(page, 'coop-', 'ukrainian', 'off');
});

test('a real host storage notification updates menus without moving focus, resuming or accepting stale records', async (t) => {
  const store = memoryStorage(),
    page = await couchPage(t, { storage: store });
  page.$('race-start').click();
  page.frame();
  page.frames(8);
  page.$('race-pause').click();
  page.frame(0);
  page.$('race-options').click();
  page.$('race-menu-ornaments').focus();
  const checkpoint = page.checkpoint(),
    records = unrelated(store),
    focus = page.doc.activeElement;
  const latest = JSON.stringify({ palette: 'ukrainian', ornaments: 'rich' });
  store.setItem(MENU_STYLE_PREFERENCES_KEY, latest);
  page.win.emit('storage', {
    key: MENU_STYLE_PREFERENCES_KEY,
    storageArea: store,
    newValue: latest,
  });
  reflects(page, 'race-', 'ukrainian', 'rich');
  page.win.emit('storage', {
    key: MENU_STYLE_PREFERENCES_KEY,
    storageArea: store,
    newValue: JSON.stringify({ palette: 'auto', ornaments: 'off' }),
  });
  reflects(page, 'race-', 'ukrainian', 'rich');
  page.frames(10);
  assert.equal(page.doc.activeElement === focus, true);
  assert.equal(page.state(), 'paused');
  assert.deepEqual(page.checkpoint(), checkpoint);
  assert.deepEqual(unrelated(store), records);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(page.doc.querySelectorAll('.menu-ornament').length, 0);
  page.win.emit('storage', {
    key: MENU_STYLE_PREFERENCES_KEY,
    storageArea: store,
    newValue: latest,
  });
  assert.equal(page.doc.body.dataset.menuPalette, undefined);
});
