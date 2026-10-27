import { nativeCaptureSession as nativeSession } from '../capture-presentation-session.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { modelTeamDialogs } from './helpers/coop-host.mjs';
import { installActorAppearanceTransport } from './helpers/actor-appearance-transport.mjs';
import {
  installCoopPresentation,
  waitFor as waitForTeamPicture,
} from './helpers/coop-presentation-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { ENEMY_STATS_KEY } from '../enemy-stats.mjs';
import { t as translate } from '../i18n/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { soloPage, memoryStorage, settle, installSoloStylesheets } from './helpers/solo-dom.mjs';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { FIXED_DT } from '../coop/core.mjs';

const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const teamHTML = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
// Isolate display writes from the ordinary first-use statistics writer allocation.
const existingEnemyStatsWriter = { [`${ENEMY_STATS_KEY}:writer`]: 'display-host-existing-writer' };
const raw = (store) => JSON.parse(store.getItem(DISPLAY_PREFERENCES_KEY));
let sequence = 0;
// Seed the unrelated statistics writer identity before startup snapshots.
// Its owner legitimately creates this on first use; display edits must not.
function displayStorage() {
  const store = memoryStorage();
  store.map.set('revealline-enemy-stats.v1:writer', 'display-host-fixture');
  return store;
}

test('actual Solo comfort Apply and Undo preserve a paused cut and use its existing profile writer', async (t) => {
  const store = memoryStorage(),
    page = await soloPage(t, { campaign, storage: store, waitForPictures: false });
  await activateHostAction(page.$('start-button'));
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let n = 0; n < 13; n++) page.frame();
  page.$('settings-button').click();
  page.$('settings-tab-accessibility').click();
  page.frame(0);
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    suspended = store.getItem(sessionKey),
    before = loadLibrary(store, profileKey).library.preferences,
    writes = store.writes.length,
    prefix = 'settings-panel-accessibility-comfort-';
  page.$(`${prefix}choice`).value = 'comfort';
  page.$(`${prefix}choice`).emit('change');
  assert.equal(store.writes.length, writes, 'A preset preview never writes preferences.');
  page.$(`${prefix}apply`).click();
  reflects(page, 'plain', 'large', true);
  assert.equal(page.$('settings-background-animation').checked, false);
  assert.deepEqual(loadLibrary(store, profileKey).library.preferences, {
    ...before,
    textFace: 'plain',
    textSize: 'large',
    reducedEffects: true,
  });
  page.$(`${prefix}undo`).focus();
  page.$(`${prefix}undo`).click();
  reflects(page, before.textFace, before.textSize, before.reducedEffects);
  assert.deepEqual(loadLibrary(store, profileKey).library.preferences, before);
  assert.equal(page.doc.activeElement, page.$(`${prefix}apply`));
  page.frame(0);
  assert.strictEqual(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(store.getItem(sessionKey), suspended);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

function change(page, id, value) {
  const control = page.$(id);
  if (typeof value === 'boolean') control.checked = value;
  else control.value = value;
  control.emit('change');
}
function reaches(page, id) {
  for (let count = 0; count < 30; count++) {
    const active = page.doc.activeElement,
      event = active.emit('keydown', { key: 'Tab', code: 'Tab', repeat: false }),
      dialog = active.closest('dialog[open]');
    // Model only an unprevented native Tab default within the actual modal.
    if (!event.defaultPrevented && dialog) {
      const choices = [...dialog.querySelectorAll('button,a,input,select,textarea,summary')].filter(
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
  modelTeamDialogs(doc);
  const stopStylesheets = installSoloStylesheets(doc);
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
    const errors = [];
    try {
      win.emit('pagehide', { persisted: false });
    } catch (error) {
      errors.push(error);
    }
    stopStylesheets();
    frames.clear();
    try {
      doc.documentElement.remove();
    } catch (error) {
      errors.push(error);
    }
    for (const [key, descriptor] of originals) {
      try {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Team fixture retirement failed');
  });
  const install = (key, descriptor) => {
    if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  };
  const artwork = installCoopPresentation({ doc, win, install });
  installActorAppearanceTransport({
    install,
    baseURL: new URL('../presentation/compiled/', globals.location.href),
  });
  await import(`../couch/relay-rescue.mjs?display-host=${++sequence}`);
  await waitForTeamPicture(
    () => $('coop-picture-status').dataset.state === 'ready',
    () => $('coop-picture-status').textContent,
  );
  await waitForTeamPicture(
    () => !!doc.documentElement.style.getPropertyValue('--iw-font-mono'),
    () => 'The current interface stylesheet must be accepted.',
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
    artwork,
    pendingFrames: () => frames.size,
    $,
    doc,
    win,
    tick,
    media,
    geometry: () => calls.map(({ method, args }) => ({ method, args })),
    fonts: () => calls.filter((c) => c.method === 'fillText').map((c) => c.font),
    labels: () => calls.filter((call) => call.method === 'fillText'),
  };
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: shared display edits preserve the actual paused Solo cut and replay`, async (t) => {
    const store = displayStorage();
    saveLibrary(
      store,
      profileKey,
      updatePreferences(emptyLibrary(), { turnPolicy, textSize: 'large' }),
    );
    const page = await soloPage(t, { campaign, storage: store, waitForPictures: false });
    assert.equal(
      store.getItem(DISPLAY_PREFERENCES_KEY),
      null,
      'Legacy adoption must not write a new record.',
    );
    await activateHostAction(page.$('start-button'));
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let n = 0; n < 13; n++) page.frame();
    assert.equal(page.rendered.run.player.cutting, true);
    page.$('settings-button').click();
    page.$('settings-tab-accessibility').click();
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
    await settle(() => page.doc.body.dataset.flightState === 'running');
    for (let n = 0; n < 12; n++) page.frame();
    page.$('pause-button').click();
    page.frame(0);
    assert.equal(
      verifyReplay(nativeSession(JSON.parse(store.getItem(sessionKey))).replay).match,
      true,
    );
    assert.deepEqual(page.errors, []);
  });
}

test('Solo to Team to Versus and back restores one display record without Couch profile writes', async (t) => {
  const store = displayStorage();
  saveLibrary(
    store,
    profileKey,
    updatePreferences(emptyLibrary(), { textFace: 'plain', textSize: 'large' }),
  );
  await t.test('Solo explicitly opts into the shared record', async (t) => {
    const page = await soloPage(t, { campaign, storage: store, titleScreen: true });
    page.$('shell-options').click();
    page.$('settings-tab-accessibility').click();
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
    await activateHostAction(page.$('coop-start'));
    page.tick(10);
    page.$('coop-pause').click();
    page.tick();
    const geometry = page.geometry(),
      labels = page.labels(),
      clock = page.$('coop-clock').textContent;
    page.$('coop-settings-open').click();
    page.$('coop-settings-tab-accessibility').click();
    page.$('coop-settings-tab-accessibility').focus();
    for (const id of ['coop-text-face', 'coop-text-size', 'coop-reduced']) reaches(page, id);
    change(page, 'coop-text-face', 'pixel');
    page.tick(120);
    assert.deepEqual(page.geometry(), geometry);
    assert.ok(labels.length > 0, 'The prepared arena paints its actual labels.');
    assert.notDeepEqual(
      page.fonts(),
      labels.map(({ font }) => font),
      'Theme font replaces Plain while geometry stays exact.',
    );
    const numericFont = page.doc.documentElement.style.getPropertyValue('--iw-font-mono');
    assert.ok(numericFont, 'The accepted interface publishes its numeric font.');
    assert.ok(page.fonts().some((font) => font.includes(numericFont)));
    change(page, 'coop-text-size', 'standard');
    page.tick(120);
    assert.notDeepEqual(page.geometry(), geometry, 'Large changes canvas label geometry');
    const images = (commands) => commands.filter((command) => command.method === 'drawImage');
    assert.deepEqual(
      images(page.geometry()),
      images(geometry),
      'The accepted picture and actor frames stay exact',
    );
    for (const id of ['1', '2']) {
      const size = (values) =>
        Number(values.find((call) => call.args[0] === id).font.match(/([\d.]+)px/)[1]);
      assert.ok(
        Math.abs(size(labels) - size(page.labels()) * (4 / 3)) < 1e-9,
        'The real host forwards Large to player numerals',
      );
    }
    assert.equal(page.$('coop-clock').textContent, clock);
    assert.match(page.$('coop-overlay-title').textContent, /paused/i);
    assert.equal(page.$('coop-overlay-title').textContent, 'PAUSED');
    assert.equal(page.$('coop-overlay-title').textContent, translate('interface:paused3'));
    assert.equal(page.doc.body.dataset.coopPaused, 'true');
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
      assert.equal(page.doc.activeElement.id, 'race-settings-tab-display');
      assert.equal(store.getItem(DISPLAY_PREFERENCES_KEY), display);
      assert.equal(store.writes.length, writes, 'Opening Options does not save a preference');
      assert.equal(page.state(), 'paused');
      assert.deepEqual(page.checkpoint(), checkpoint);
      page.$('race-settings-tab-accessibility').click();
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
  const store = displayStorage(),
    initial = { textFace: 'plain', textSize: 'large', reducedEffects: false };
  store.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(initial));
  const before = new Map(store.map),
    page = await teamPage(t, store, { systemReduced: true });
  reflects(page, 'plain', 'large', true);
  assert.equal(page.$('coop-reduced').checked, false);
  assert.match(page.$('coop-system-reduction').textContent, /System reduced motion/);
  assert.deepEqual(store.map, before);
  page.$('coop-settings-open').click();
  page.$('coop-settings-tab-accessibility').click();
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
  const store = displayStorage(),
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
  page.focus('race-options');
  page.pulse(0, 0);
  assert.equal(page.doc.activeElement.id, 'race-settings-tab-display');
  assert.equal(store.getItem(DISPLAY_PREFERENCES_KEY), displayBefore);
  const before = page.checkpoint();
  page.pulse(0, 13);
  assert.equal(page.doc.activeElement.id, 'race-settings-tab-accessibility');
  page.pulse(0, 0);
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

for (const mode of ['team', 'versus'])
  test(`${mode}: incoming extra size remains selected while its presentation uses Large`, async (t) => {
    const store = displayStorage();
    const raw = JSON.stringify({
      textFace: 'plain',
      textSize: 'extra-large',
      reducedEffects: false,
    });
    store.setItem(DISPLAY_PREFERENCES_KEY, raw);
    const page =
      mode === 'team' ? await teamPage(t, store) : await couchPage(t, { storage: store });
    const prefix = mode === 'team' ? 'coop' : 'race';
    const size = page.$(`${prefix}-text-size`);
    assert.equal(size.value, 'extra-large');
    assert.equal(size.querySelector('[data-text-size-retained]').disabled, true);
    assert.equal(page.doc.body.dataset.textSize, 'large');
    assert.equal(store.getItem(DISPLAY_PREFERENCES_KEY), raw);
    change(page, `${prefix}-text-face`, 'pixel');
    assert.equal(JSON.parse(store.getItem(DISPLAY_PREFERENCES_KEY)).textSize, 'extra-large');
  });

for (const mode of ['Team', 'Versus'])
  test(`actual ${mode} comfort preview and Apply/Undo preserve the existing display controls and Solo profile`, async (t) => {
    const store = memoryStorage(),
      initial = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
    store.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(initial));
    saveLibrary(store, profileKey, emptyLibrary());
    const page =
        mode === 'Team' ? await teamPage(t, store) : await couchPage(t, { storage: store }),
      prefix =
        mode === 'Team'
          ? 'coop-settings-panel-accessibility-comfort-'
          : 'race-settings-panel-accessibility-comfort-',
      fieldPrefix = mode === 'Team' ? 'coop-' : 'race-',
      face = page.$(`${fieldPrefix}text-face`),
      profile = store.getItem(profileKey),
      writes = store.writes.length;
    page.$(`${prefix}choice`).value = 'clear';
    page.$(`${prefix}choice`).emit('change');
    assert.equal(store.writes.length, writes);
    page.$(`${prefix}apply`).click();
    reflects(page, 'plain', 'large', false);
    assert.equal(page.$(`${fieldPrefix}text-face`), face);
    assert.deepEqual(raw(store), { ...initial, textFace: 'plain', textSize: 'large' });
    page.$(`${prefix}undo`).click();
    reflects(page, 'pixel', 'standard', false);
    assert.deepEqual(raw(store), initial);
    assert.equal(store.getItem(profileKey), profile);
  });

// Additive actual-fixture ownership regressions; existing tests above stay unchanged.
import { BoardPainter } from '../ui/render.mjs';

const retirementGlobalKeys = [
  'document',
  'window',
  'navigator',
  'indexedDB',
  'localStorage',
  'performance',
  'URL',
  'Image',
  'location',
  'sessionStorage',
  'matchMedia',
  'Option',
  'fetch',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'createImageBitmap',
];
const retirementPainterKeys = [
  'setLook',
  'setLevel',
  'skipCelebration',
  'startCelebration',
  'effectsFor',
  'draw',
];
function retirementDescriptors(target, keys) {
  return new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(target, key)]));
}
function assertRetirementDescriptors(target, originals) {
  for (const [key, expected] of originals) {
    const actual = Object.getOwnPropertyDescriptor(target, key);
    assert.deepEqual(actual && Object.keys(actual), expected && Object.keys(expected), key);
    for (const field of Object.keys(expected || {}))
      assert.strictEqual(actual[field], expected[field], `${key}.${field}`);
  }
}
function restoreRetirementDescriptors(target, originals, errors) {
  for (const [key, descriptor] of originals) {
    try {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else assert.equal(Reflect.deleteProperty(target, key), true, key);
    } catch (error) {
      errors.push(error);
    }
  }
}
async function withRetirementPage(create, inspect) {
  const globals = retirementDescriptors(globalThis, retirementGlobalKeys);
  const painter = retirementDescriptors(BoardPainter.prototype, retirementPainterKeys);
  const callbacks = [];
  let page,
    root,
    removeRoot,
    retired = false,
    result;
  const errors = [];
  const retire = () => {
    assert.equal(retired, false, 'Invoke the actual registered teardown exactly once');
    assert.equal(callbacks.length, 1, 'Capture the actual fixture teardown');
    retired = true;
    return callbacks[0]();
  };
  try {
    page = await create({ after: (callback) => callbacks.push(callback) });
    root = page.doc.documentElement;
    removeRoot = root.remove;
    result = await inspect(page, retire, globals, painter);
  } catch (error) {
    errors.push(error);
  } finally {
    // Failure-path protection is not the implementation under test: assertions
    // above observe the actual teardown before this safety restoration runs.
    if (!retired && callbacks.length) {
      root ||= globalThis.document?.documentElement;
      removeRoot ||= root?.remove;
      try {
        retire();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      removeRoot?.call(root);
    } catch (error) {
      errors.push(error);
    }
    restoreRetirementDescriptors(globalThis, globals, errors);
    restoreRetirementDescriptors(BoardPainter.prototype, painter, errors);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, 'Retirement regression cleanup failed');
  return result;
}
const retirementFixtures = [
  ['Versus', (context) => couchPage(context, { storage: memoryStorage() })],
  ['Team', (context) => teamPage(context, memoryStorage())],
];
for (const [name, create] of retirementFixtures) {
  test(`${name}: retirement detaches only after real pagehide and restores exact owners`, async () => {
    await withRetirementPage(create, async (page, retire, globals, painter) => {
      const root = page.doc.documentElement;
      const child = page.doc.body.children[0];
      const activeGlobals = retirementDescriptors(globalThis, retirementGlobalKeys);
      const activePainter = retirementDescriptors(BoardPainter.prototype, retirementPainterKeys);
      let observed = 0,
        dispatched = 0;
      globalThis.requestAnimationFrame(() => dispatched++);
      page.win.addEventListener('pagehide', (event) => {
        observed++;
        assert.equal(event.persisted, false);
        assert.equal(root.isConnected, true);
        assert.equal(child.isConnected, true);
        assertRetirementDescriptors(globalThis, activeGlobals);
        assertRetirementDescriptors(BoardPainter.prototype, activePainter);
      });
      retire();
      assert.equal(observed, 1);
      assert.equal(root.isConnected, false);
      assert.equal(child.isConnected, false);
      assert.equal(page.pendingFrames(), 0);
      assert.equal(dispatched, 0);
      assertRetirementDescriptors(globalThis, globals);
      assertRetirementDescriptors(BoardPainter.prototype, painter);
    });
  });
  test(`${name}: retirement keeps old locale producers dormant while a live binding refreshes`, async () => {
    await withRetirementPage(create, async (page, retire) => {
      // Let the actual application initialize localization under its own fixture
      // globals before observing it; do not alter original tests' import order.
      const { getLocale, setLocale, localizedText } = await import('../i18n/index.mjs');
      const previousLocale = getLocale();
      const retired = page.doc.createElement('span');
      page.doc.body.append(retired);
      const liveDocument = new Document();
      const live = liveDocument.createElement('span');
      liveDocument.body.append(live);
      let retiredCalls = 0,
        liveCalls = 0;
      localizedText(retired, () => `${++retiredCalls}:${getLocale()}`);
      localizedText(live, () => `${++liveCalls}:${getLocale()}`);
      try {
        retire();
        const beforeRetired = retiredCalls,
          beforeLive = liveCalls;
        setLocale(previousLocale === 'en' ? 'uk' : 'en', { persist: false });
        assert.equal(retiredCalls, beforeRetired, 'A retained old producer must not refresh');
        assert.equal(liveCalls, beforeLive + 1, 'The real refresh must still reach a live binding');
      } finally {
        retired.remove();
        liveDocument.documentElement.remove();
        setLocale(previousLocale, { persist: false });
      }
    });
  });
  test(`${name}: retirement preserves a throwing pagehide observer error and still retires owners`, async () => {
    await withRetirementPage(create, async (page, retire, globals, painter) => {
      const originalError = new Error('Injected observer failure after application registration');
      globalThis.requestAnimationFrame(() => assert.fail('Retired fixture frame dispatched'));
      page.win.addEventListener('pagehide', () => {
        throw originalError;
      });
      assert.throws(retire, (error) => error === originalError);
      assert.equal(page.doc.documentElement.isConnected, false);
      assert.equal(page.pendingFrames(), 0);
      assertRetirementDescriptors(globalThis, globals);
      assertRetirementDescriptors(BoardPainter.prototype, painter);
    });
  });
  test(`${name}: retirement retains both observer and root-removal failures`, async () => {
    await withRetirementPage(create, async (page, retire, globals, painter) => {
      const originalError = new Error('Injected observer failure');
      const rootError = new Error('Injected root removal failure');
      const root = page.doc.documentElement,
        remove = root.remove;
      page.win.addEventListener('pagehide', () => {
        throw originalError;
      });
      root.remove = () => {
        throw rootError;
      };
      try {
        assert.throws(
          retire,
          (error) =>
            error instanceof AggregateError &&
            error.errors.length === 2 &&
            error.errors[0] === originalError &&
            error.errors[1] === rootError,
        );
        assert.equal(page.pendingFrames(), 0);
        assertRetirementDescriptors(globalThis, globals);
        assertRetirementDescriptors(BoardPainter.prototype, painter);
      } finally {
        root.remove = remove;
      }
    });
  });
}
test('Versus: retirement retains observer and painter-restoration failures without skipping later owners', async () => {
  await withRetirementPage(retirementFixtures[0][1], async (page, retire, globals, painter) => {
    const originalError = new Error('Injected observer failure');
    const restoreError = new Error('Injected painter restoration failure');
    const activeSetLook = BoardPainter.prototype.setLook;
    page.win.addEventListener('pagehide', () => {
      throw originalError;
    });
    Object.defineProperty(BoardPainter.prototype, 'setLook', {
      configurable: true,
      get: () => activeSetLook,
      set() {
        throw restoreError;
      },
    });
    assert.throws(
      retire,
      (error) =>
        error instanceof AggregateError &&
        error.errors.length === 2 &&
        error.errors[0] === originalError &&
        error.errors[1] === restoreError,
    );
    assert.equal(page.doc.documentElement.isConnected, false);
    assert.equal(page.pendingFrames(), 0);
    assertRetirementDescriptors(globalThis, globals);
    assertRetirementDescriptors(
      BoardPainter.prototype,
      new Map([...painter].filter(([key]) => key !== 'setLook')),
    );
  });
});
test('Sequential fixture retirement never leaves the previous document as the active owner', async () => {
  let retiredDocument;
  for (const [, create] of retirementFixtures) {
    await withRetirementPage(create, async (page, retire, globals, painter) => {
      assert.strictEqual(globalThis.document, page.doc);
      if (retiredDocument) {
        assert.notStrictEqual(page.doc, retiredDocument);
        assert.equal(retiredDocument.documentElement.isConnected, false);
      }
      retire();
      assert.equal(
        page.doc.documentElement.isConnected,
        false,
        'Observe actual retirement before the regression harness safety cleanup',
      );
      assertRetirementDescriptors(globalThis, globals);
      assertRetirementDescriptors(BoardPainter.prototype, painter);
      retiredDocument = page.doc;
    });
  }
});
