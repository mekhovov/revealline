// Real solo app + guide + input routers + persistence. Canvas, Window messaging,
// Gamepad, IndexedDB and HTMLMediaElement are modeled browser boundaries; this
// does not certify layout, physical controllers or two simultaneous browsers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { COMBAT_ACTOR_CATALOG, PRESSURE_DIFFICULTY_CATALOG } from '../content-design/catalogs.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  emptyLibrary,
  updatePreferences,
  saveLibrary,
  loadLibrary,
  campaignKey,
} from '../library.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture, memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import {
  preparePack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  resolvePackCampaign,
} from '../packs.mjs';
import { createSelectionBookmark } from '../selection-bookmark.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Model native dialog opening/return focus; real app modal navigation and handlers stay active.
function nativeDialogs(t) {
  const showModal = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close,
    origins = new WeakMap();
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open' });
    showModal.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    close.call(this);
    const origin = origins.get(this),
      dialog = origin?.closest('dialog');
    if (origin?.isConnected && !origin.closest('[hidden]') && (!dialog || dialog.open))
      origin.focus();
    else this.ownerDocument.activeElement = this.ownerDocument.body;
  });
}

const profileKey = 'revealline.library.dev.v1';
const handoffKey = 'revealline.playground.current';
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'field-guide-host',
  revision: '1',
  title: 'Guide host preservation',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [retryFixture('self-contact').level],
};

test('an admitted edition launches its current pressure lesson and the actual child retains the exact setup without rewards', async (t) => {
  const fixture = await editionProviderFixture();
  fixture.source.missions[0].actors[0].role = 'trail-pursuer';
  const compiled = compileContentProject(fixture.source);
  fixture.data.campaign.levels = compiled.missions.map(
    (mission) => resolveMission(compiled, mission.id, { difficulty: 'standard' }).level,
  );
  const preview = memoryStorage({ [handoffKey]: 'unrelated retained preview' });
  let search, level, options;
  await t.test(
    'the real parent uses the exact edition adapter and preserves its paused run',
    async (t) => {
      const page = await setup(t, {
        search: '?edition=sample-public',
        fetchResponse: fixture.fetcher,
        previewStorage: preview,
      });
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      ticks(page, 12);
      page.$('pause-button').click();
      page.frame(0);
      const run = page.rendered.run;
      level = structuredClone(run.level);
      options = {
        seed: run.seed,
        classId: run.classId,
        classRecipes: structuredClone(run.classRecipes),
        turnPolicy: run.turnPolicy,
      };
      const checkpoint = authoritativeCheckpoint(run);
      openGuide(page);
      page.change('enemy-guide-topic', 'trail-pursuit');
      assert.equal(page.$('enemy-guide-play').disabled, false);
      const writes = page.storage.writes.length;
      const lesson = await launch(page);
      const url = new URL(lesson.frame.src);
      search = url.search;
      assert.equal(url.searchParams.get('edition'), 'sample-public');
      assert.equal(url.searchParams.get('edition-mission'), run.levelId);
      assert.equal(url.searchParams.get('guide-seed'), String(run.seed));
      assert.equal(url.searchParams.get('class'), run.classId);
      assert.equal(
        preview.writes.length,
        0,
        'Edition reconstruction never overwrites the Playground.',
      );
      childReturn(page, lesson);
      page.frame(0);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.equal(page.rendered.paused, true);
      assert.equal(page.storage.writes.length, writes);
      assert.deepEqual(page.errors, []);
    },
  );
  await t.test(
    'the real edition child starts the same effective core and stays write-free',
    async (t) => {
      const page = await setup(t, {
        search,
        fetchResponse: fixture.fetcher,
        previewStorage: preview,
        parentWindow: { location: { origin: 'http://localhost' }, postMessage() {} },
      });
      const expected = createRun(level, options);
      assert.deepEqual(
        authoritativeCheckpoint(page.rendered.run),
        authoritativeCheckpoint(expected),
      );
      assert.deepEqual(page.rendered.run.classRecipes, options.classRecipes);
      assert.equal(page.$('enemy-workshop-return').textContent, 'Return to field guide');
      page.$('start-button').click();
      page.key('ArrowRight');
      for (let i = 0; i < 30; i++) {
        page.frame();
        stepRun(expected, { direction: 'right' }, FIXED_DT);
      }
      page.key('ArrowRight', false);
      assert.deepEqual(
        authoritativeCheckpoint(page.rendered.run),
        authoritativeCheckpoint(expected),
      );
      page.$('pause-button').click();
      page.frame(0);
      assert.equal(page.rendered.paused, true);
      assert.equal(page.storage.writes.length, 0);
      assert.equal(preview.getItem(handoffKey), 'unrelated retained preview');
      assert.deepEqual(page.errors, []);
    },
  );
});

test('a restored FPV-only pack keeps all four canonical Guide appearances and practices', async (t) => {
  nativeDialogs(t);
  const themes = JSON.parse(
    readFileSync(new URL('../content/themes.json', import.meta.url)),
  ).themes;
  const level = { ...retryFixture('self-contact').level, id: 'guide-fpv-board' };
  const { pack } = await preparePack({
    format: 'xonix-pack.v1',
    id: 'guide-fpv-only',
    version: '1.0.0',
    name: 'FPV-only guide fixture',
    description: 'One real validated board with only the FPV theme; no optional image payloads.',
    engine: 'xonix-core.v2',
    dependencies: [],
    themes: themes.filter(({ id }) => id === 'fpv'),
    classRecipes: campaign.classRecipes,
    campaigns: [
      {
        version: campaign.version,
        id: 'guide-fpv-campaign',
        revision: '1',
        title: 'Saved FPV-only selection',
        themeId: 'fpv',
        levels: [level],
      },
    ],
    visualOverrides: {},
    levelVisuals: [],
    music: [],
  });
  const installed = exportPackLibrary(installPack(emptyPackLibrary(), pack));
  const assets = memoryIndexedDB();
  // Seed the modeled browser through its real IDB transaction boundary, before
  // importing the app. Startup still imports and validates the stored pack.
  await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        transaction = db.transaction('assets', 'readwrite');
      transaction.objectStore('assets').put(installed, 'revealline.packs.dev.v1');
      transaction.onerror = transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  const storage = memoryStorage(),
    previewStorage = memoryStorage();
  const selectionKey = `${profileKey}.last-selection.v1`;
  const selected = campaignKey(resolvePackCampaign(pack, pack.campaigns[0].id).campaign);
  assert.equal(
    createSelectionBookmark({ storage, key: selectionKey, canWrite: () => true }).remember({
      campaignKey: selected,
      levelId: level.id,
      themeId: 'fpv',
    }),
    true,
  );
  const bookmark = storage.getItem(selectionKey);
  const paint = [];
  const context = new Proxy(
    {},
    {
      get: (target, key) => target[key] ?? ((...args) => paint.push([key, ...args])),
      set: (target, key, value) => {
        target[key] = value;
        paint.push(['set', key, value]);
        return true;
      },
    },
  );
  // Record actual Guide painter calls; other optional Canvas surfaces stay null.
  // This checks palette use, not native pixels or browser layout.
  t.mock.method(SoloElement.prototype, 'getContext', function () {
    return this.id === 'enemy-guide-preview' ? context : null;
  });
  const page = await soloPage(t, {
    campaign,
    storage,
    previewStorage,
    titleScreen: true,
    assetIndexedDB: assets.indexedDB,
  });
  page.win.crypto = globalThis.crypto;
  page.$('enemy-guide-frame').contentWindow = {};
  assert.equal(page.$('pack-select').value, pack.id, 'stored pack was selected during bootstrap');
  assert.equal(page.$('campaign-select').value, selected);
  assert.deepEqual(
    page.$('theme-select').children.map(({ value }) => value),
    ['fpv'],
  );
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const savedProfile = storage.getItem(profileKey),
    writes = storage.writes.length;
  const assetWrites = assets.allPuts.length;
  openGuide(page);
  const appearance = page.$('enemy-guide-theme');
  assert.deepEqual(
    appearance.children.map(({ value, textContent }) => [value, textContent]),
    themes.map(({ id, name }) => [id, name]),
  );
  for (const theme of themes) {
    paint.length = 0;
    appearance.value = theme.id;
    appearance.emit('change');
    assert.ok(
      paint.some(
        ([op, key, value]) => op === 'set' && key === 'fillStyle' && value === theme.palette.accent,
      ),
      `${theme.id} preview paints with its canonical palette`,
    );
    await launch(page);
    const lesson = JSON.parse(previewStorage.getItem(handoffKey));
    assert.deepEqual(lesson.theme, theme, `${theme.id} practice uses the complete canonical theme`);
    assert.match(page.$('enemy-guide-status').textContent, /Practice only/);
    page.$('enemy-guide-return').click();
    assert.equal(previewStorage.getItem(handoffKey), null);
    assert.equal(page.$('enemy-guide-frame').hidden, true);
    page.frame(0);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(storage.getItem(profileKey), savedProfile);
    assert.equal(storage.getItem(selectionKey), bookmark);
    assert.deepEqual(
      page.$('theme-select').children.map(({ value }) => value),
      ['fpv'],
    );
    assert.equal(page.$('theme-select').value, 'fpv');
  }
  nativeKey(page, 'Escape');
  assert.equal(page.$('shell-home').open, true);
  assert.equal(
    page.doc.activeElement === page.$('shell-guide'),
    true,
    'focus returns to the Guide opener',
  );
  assert.equal(
    storage.writes.length,
    writes,
    'Guide preview and practice never rewrite the parent profile or selection',
  );
  assert.equal(assets.allPuts.length, assetWrites, 'the installed pack remains unchanged');
  assert.deepEqual(page.errors, []);
});
function ticks(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}
async function waitFor(predicate, describe) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), describe());
}
function nativeKey(page, key) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key, code: key === ' ' ? 'Space' : key, repeat: false });
  if (!event.defaultPrevented && ['Enter', ' '].includes(key) && target.tagName === 'BUTTON')
    target.click();
  // When native select editing leaves Escape to the browser, its default
  // action requests modal cancellation. The actual dialog listener owns it.
  if (!event.defaultPrevented && key === 'Escape') {
    const dialog = target.closest('dialog[open]') ?? page.doc.querySelector('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  target.emit('keyup', { key, code: key === ' ' ? 'Space' : key });
  return event;
}
async function setup(t, options = {}) {
  nativeDialogs(t);
  // Paint is covered by the real guide/actor tests. A null Canvas2D context is
  // an explicit optional-browser boundary here, not a replacement guide/router.
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const page = await soloPage(t, { campaign, ...options });
  page.win.crypto = globalThis.crypto;
  page.$('enemy-guide-frame').contentWindow = {};
  return page;
}
async function liveCut(page) {
  page.$('start-button').click();
  // Start owns asynchronous accepted actor/picture preparation. Do not send
  // gameplay input or Escape while its ready-card operation is still pending.
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  ticks(page, 30);
  page.key('ArrowDown', false);
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  assert.equal(page.rendered.run.player.cutting, true);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  return authoritativeCheckpoint(page.rendered.run);
}
function openGuide(page) {
  page.$('overlay-menu').click();
  assert.equal(page.$('shell-home').open, true);
  page.$('shell-options').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('settings-dialog').open, true);
  page.$('settings-tab-extras').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('settings-panel-extras').hidden, false);
  page.$('shell-guide').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('shell-home').open, true, 'Main menu stays beneath Settings and its guide');
  assert.equal(page.$('settings-dialog').open, true, 'Settings Extras retains its Guide opener');
  assert.equal(page.$('enemy-guide-dialog').open, true);
}
async function launch(page) {
  page.$('enemy-guide-play').click();
  await settle(() => !page.$('enemy-guide-frame').hidden, page.$('enemy-guide-status').textContent);
  const frame = page.$('enemy-guide-frame');
  assert.equal(page.doc.activeElement, frame);
  const url = new URL(frame.src);
  assert.equal(url.searchParams.get('practice'), '1');
  assert.equal(url.searchParams.get('practice-return'), 'enemy-guide');
  return { frame, token: url.searchParams.get('enemy-workshop-session') };
}
function childReturn(page, { frame, token }, overrides = {}) {
  page.win.emit('message', {
    origin: 'http://localhost',
    source: frame.contentWindow,
    data: { format: 'revealline.enemy-workshop-return.v1', session: token },
    ...overrides,
  });
}

function readinessClock(t) {
  let now = Date.now(),
    sequence = 0;
  const callbacks = new Map();
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setInterval', (callback, delay) => {
    const id = ++sequence;
    callbacks.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, 'clearInterval', (id) => callbacks.delete(id));
  return {
    callbacks,
    tick(ms = 250) {
      now += ms;
      for (const { callback, delay } of [...callbacks.values()]) if (delay === 250) callback();
    },
  };
}

// Run the real classic boot script in the child's separate realm. It starts
// loading, then reports its actual missing-renderer failure when mounted.
// The parent app, Guide and controller router remain the ordinary host.
function bootChild(frame) {
  const document = new Document(),
    events = new Events();
  document.URL = frame.src;
  document.readyState = 'loading';
  document.documentElement.dataset.bootState = 'loading';
  document.currentScript = { src: new URL('boot.mjs', frame.src).href };
  const make = (tag, id, parent = document.body) => {
    const element = document.createElement(tag);
    element.id = id;
    parent.append(element);
    return element;
  };
  const screen = make('section', 'boot-screen');
  for (const id of ['boot-title', 'boot-status', 'boot-detail']) make('p', id, screen);
  make('a', 'boot-retry', screen);
  make('a', 'boot-online', screen);
  make('details', 'boot-local', screen);
  const context = createContext({
    document,
    URL,
    location: new URL(frame.src),
    setTimeout: () => 1,
    clearTimeout() {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
  new Script(readFileSync(new URL('../boot.mjs', import.meta.url), 'utf8')).runInContext(context);
  frame.contentDocument = document;
  return { document, fail: () => document.emit('DOMContentLoaded') };
}

test('confirmed pre-ready practice failure returns controller focus without consuming a held Confirm or changing the exact setup', async (t) => {
  const fixture = await editionProviderFixture();
  fixture.source.actorCatalogId = COMBAT_ACTOR_CATALOG.id;
  fixture.source.difficultyCatalogId = PRESSURE_DIFFICULTY_CATALOG.id;
  fixture.source.missions[0].combat = { version: 'mission-combat.v1', enabled: true };
  fixture.source.missions[0].actors.push({
    id: 'practice-sentry',
    role: 'optional-sentry',
    tier: 'measured',
    x: 30.5,
    y: 12.5,
    heading: [1, 0],
  });
  const compiled = compileContentProject(fixture.source);
  fixture.data.campaign.levels = compiled.missions.map(
    (mission) => resolveMission(compiled, mission.id, { difficulty: 'standard' }).level,
  );
  const clock = readinessClock(t),
    preview = memoryStorage({ [handoffKey]: 'retained authoring preview' }),
    page = await setup(t, {
      search: '?edition=sample-public',
      fetchResponse: fixture.fetcher,
      previewStorage: preview,
    });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  ticks(page, 12);
  page.$('pause-button').click();
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    saved = [...page.storage.map],
    writes = page.storage.writes.length;
  openGuide(page);
  page.change('enemy-guide-topic', 'optional-sentry');
  const controls = padBoundary(page, t),
    lesson = await launch(page),
    child = bootChild(lesson.frame),
    url = lesson.frame.src,
    handoff = preview.getItem(handoffKey);
  assert.equal(new URL(url).searchParams.get('edition-mission'), page.rendered.run.levelId);
  assert.equal(new URL(url).searchParams.get('guide-seed'), String(page.rendered.run.seed));
  assert.equal(handoff, 'retained authoring preview');
  controls.set(0, true);
  const reads = page.padReads;
  controls.frame();
  clock.tick(21000);
  assert.equal(page.doc.activeElement, lesson.frame, 'slow loading retains child input ownership');
  assert.equal(page.padReads, reads, 'the parent does not sample a loading child controller');
  child.fail();
  const detail = child.document.getElementById('boot-detail').textContent;
  assert.match(detail, /renderer is unavailable/);
  assert.equal(child.document.documentElement.dataset.bootState, 'failed');
  clock.tick();
  assert.equal(
    page.doc.activeElement.id,
    'enemy-guide-return',
    'confirmed failure exposes native Return to the controller',
  );
  assert.match(page.$('enemy-guide-status').textContent, /Practice could not start/);
  assert.equal(child.document.getElementById('boot-detail').textContent, detail);
  assert.equal(lesson.frame.src, url, 'failure detail stays open until deliberate Return');
  assert.equal(preview.getItem(handoffKey), handoff);
  for (let i = 0; i < 8; i++) controls.frame();
  assert.equal(lesson.frame.hidden, false, 'held Confirm cannot dismiss failed practice');
  controls.set(0, false);
  for (let i = 0; i < 8; i++) controls.frame();
  controls.pulse(0);
  assert.equal(lesson.frame.hidden, true, 'fresh Confirm activates the existing Return');
  assert.equal(preview.getItem(handoffKey), 'retained authoring preview');
  assert.equal(page.doc.activeElement.id, 'enemy-guide-play');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual([...page.storage.map], saved);
  assert.equal(page.storage.writes.length, writes);
  // Retire the shared native/controller echo guard before a separate action.
  for (let i = 0; i < 80; i++) controls.frame();
  const retry = await launch(page);
  assert.notEqual(retry.token, lesson.token);
  const retained = new URL(url),
    relaunched = new URL(retry.frame.src);
  for (const query of [retained, relaunched]) query.searchParams.delete('enemy-workshop-session');
  assert.equal(relaunched.href, retained.href, 'only the return-bridge token changes on relaunch');
  assert.equal(
    preview.getItem(handoffKey),
    handoff,
    'deliberate relaunch retains the exact lesson',
  );
  childReturn(page, retry);
  assert.deepEqual(page.errors, []);
});

test('visible-window blur defers confirmed practice failure focus until a fresh active return', async (t) => {
  const clock = readinessClock(t),
    preview = memoryStorage({ [handoffKey]: 'keep the prior preview' }),
    page = await setup(t, { previewStorage: preview });
  const checkpoint = await liveCut(page);
  openGuide(page);
  const controls = padBoundary(page, t),
    lesson = await launch(page),
    child = bootChild(lesson.frame),
    handoff = preview.getItem(handoffKey);
  controls.set(0, true);
  controls.frame();
  page.doc.focused = false;
  page.win.emit('blur');
  assert.equal(page.doc.hidden, false, 'a visible window can be inactive');
  child.fail();
  clock.tick();
  assert.match(page.$('enemy-guide-status').textContent, /Practice could not start/);
  assert.equal(
    page.doc.activeElement.id,
    lesson.frame.id,
    'confirmed failure must not focus an inactive window',
  );
  assert.equal(clock.callbacks.size, 0, 'failure is observed once while its focus handoff waits');
  page.doc.focused = true;
  page.win.emit('focus');
  assert.equal(
    page.doc.activeElement.id,
    'enemy-guide-return',
    'the same failed child recovers on active return',
  );
  for (let i = 0; i < 8; i++) controls.frame();
  assert.equal(lesson.frame.hidden, false, 'held Confirm across blur and recovery cannot Return');
  assert.equal(preview.getItem(handoffKey), handoff);
  controls.set(0, false);
  for (let i = 0; i < 8; i++) controls.frame();
  controls.pulse(0);
  assert.equal(lesson.frame.hidden, true);
  assert.equal(preview.getItem(handoffKey), 'keep the prior preview');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

for (const event of ['pageshow', 'visibilitychange'])
  test(`an observed practice failure retains its deferred Return across ${event}`, async (t) => {
    const clock = readinessClock(t),
      page = await setup(t);
    await liveCut(page);
    openGuide(page);
    const lesson = await launch(page),
      child = bootChild(lesson.frame);
    page.doc.focused = false;
    child.fail();
    clock.tick();
    assert.equal(page.doc.activeElement.id, lesson.frame.id);
    if (event === 'pageshow') page.win.emit('pagehide', { persisted: true });
    else {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    }
    page.doc.focused = true;
    page.doc.hidden = false;
    if (event === 'pageshow') page.win.emit(event, { persisted: true });
    else page.doc.emit(event);
    assert.equal(page.doc.activeElement.id, 'enemy-guide-return');
    assert.equal(lesson.frame.hidden, false);
    assert.equal(clock.callbacks.size, 0, 'the observed failure needs no continuing poll');
    assert.deepEqual(page.errors, []);
  });

for (const changed of [
  'newer-focus',
  'url',
  'window',
  'document',
  'inaccessible',
  'return-and-relaunch',
  'closed',
  'disposed',
])
  test(`deferred practice Return is retired by ${changed}`, async (t) => {
    const clock = readinessClock(t),
      page = await setup(t);
    await liveCut(page);
    openGuide(page);
    const lesson = await launch(page),
      child = bootChild(lesson.frame);
    page.doc.focused = false;
    child.fail();
    clock.tick();
    assert.equal(page.doc.activeElement.id, lesson.frame.id);
    if (changed === 'newer-focus') {
      page.$('enemy-guide-return').focus();
      lesson.frame.focus();
    }
    if (changed === 'url') child.document.URL += '&changed=1';
    if (changed === 'window') lesson.frame.contentWindow = {};
    if (changed === 'document') bootChild(lesson.frame).fail();
    if (changed === 'inaccessible')
      Object.defineProperty(lesson.frame, 'contentDocument', {
        configurable: true,
        get() {
          throw new Error('Cross-origin child');
        },
      });
    if (changed === 'return-and-relaunch') {
      childReturn(page, lesson);
      await launch(page);
    }
    if (changed === 'closed') page.$('enemy-guide-dialog').close();
    if (changed === 'disposed') page.win.emit('pagehide', { persisted: false });
    const focus = page.doc.activeElement.id,
      status = page.$('enemy-guide-status')?.textContent;
    page.doc.focused = true;
    page.win.emit('focus');
    page.win.emit('focus');
    assert.equal(page.doc.activeElement.id, focus);
    assert.equal(page.$('enemy-guide-status')?.textContent, status);
    if (changed !== 'disposed') page.$('enemy-guide-return').click();
    assert.equal(clock.callbacks.size, 0);
    assert.deepEqual(page.errors, []);
  });

test('practice readiness resumes after cached departure and never transfers focus in a hidden page', async (t) => {
  const clock = readinessClock(t),
    page = await setup(t);
  const checkpoint = await liveCut(page);
  openGuide(page);
  const lesson = await launch(page),
    child = bootChild(lesson.frame);
  const queued = [...clock.callbacks.values()]
    .filter(({ delay }) => delay === 250)
    .map(({ callback }) => callback);
  assert.equal(queued.length, 1);
  page.win.emit('pagehide', { persisted: true });
  assert.equal(clock.callbacks.size, 0, 'departure retires the timer');
  child.fail();
  for (const callback of queued) callback();
  assert.equal(page.doc.activeElement, lesson.frame);
  page.doc.hidden = true;
  page.win.emit('pageshow', { persisted: true });
  clock.tick(30000);
  assert.equal(page.doc.activeElement, lesson.frame, 'background restoration cannot take focus');
  assert.equal(clock.callbacks.size, 0);
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  assert.equal(clock.callbacks.size, 1, 'the same unsettled child is observed on return');
  clock.tick();
  assert.equal(page.doc.activeElement.id, 'enemy-guide-return');
  assert.equal(clock.callbacks.size, 0, 'confirmed failure settles once');
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('practice readiness preserves user focus and settles at ready without observing later failures', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const clock = readinessClock(t),
    page = await setup(t);
  await liveCut(page);
  openGuide(page);
  const first = await launch(page),
    child = bootChild(first.frame);
  const other = page.doc.createElement('button');
  other.textContent = 'Independent parent control';
  page.$('enemy-guide-practice').append(other);
  other.focus();
  child.fail();
  clock.tick();
  assert.equal(page.doc.activeElement, other, 'failure does not steal a newer focus choice');
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.match(
      page.$('enemy-guide-status').textContent,
      language === 'uk'
        ? /Тренування не запустилося.*Кампанія залишається на паузі/
        : /Practice could not start.*campaign remains paused/,
    );
    assert.doesNotMatch(page.$('enemy-guide-status').textContent, /enemyGuide\.|\{\{/);
    assert.equal(page.doc.activeElement, other);
  }
  childReturn(page, first);
  const next = await launch(page),
    ready = bootChild(next.frame);
  ready.document.documentElement.dataset.bootState = 'ready';
  clock.tick();
  assert.equal(clock.callbacks.size, 0, 'ready practice owns its recovery controls');
  ready.fail();
  page.win.emit('pagehide', { persisted: true });
  page.win.emit('pageshow', { persisted: true });
  clock.tick();
  assert.equal(page.doc.activeElement, next.frame);
  assert.equal(clock.callbacks.size, 0, 'return does not reopen a settled readiness monitor');
  assert.match(page.$('enemy-guide-status').textContent, /Practice only/);
});

for (const retired of [
  'different-url',
  'different-window',
  'return-and-relaunch',
  'closed',
  'disposed',
])
  test(`practice readiness rejects ${retired} without stale focus or status`, async (t) => {
    const clock = readinessClock(t),
      page = await setup(t);
    await liveCut(page);
    openGuide(page);
    const lesson = await launch(page),
      child = bootChild(lesson.frame);
    const queued = [...clock.callbacks.values()]
      .filter(({ delay }) => delay === 250)
      .map(({ callback }) => callback);
    assert.equal(queued.length, 1);
    if (retired === 'different-url') child.document.URL = `${lesson.frame.src}&foreign=1`;
    if (retired === 'different-window') lesson.frame.contentWindow = {};
    if (retired === 'return-and-relaunch') {
      childReturn(page, lesson);
      await launch(page);
      // The old document can remain observable briefly during navigation.
      assert.notEqual(lesson.frame.src, child.document.URL);
    }
    if (retired === 'closed') page.$('enemy-guide-dialog').close();
    if (retired === 'disposed') page.win.emit('pagehide', { persisted: false });
    const focus = page.doc.activeElement,
      status = page.$('enemy-guide-status')?.textContent;
    child.fail();
    for (const callback of queued) callback();
    clock.tick();
    assert.equal(page.doc.activeElement, focus);
    assert.equal(page.$('enemy-guide-status')?.textContent, status);
    if (['different-window', 'closed', 'disposed'].includes(retired))
      assert.equal(clock.callbacks.size, 0, 'invalid or retired owner stops observation');
    if (retired !== 'disposed') page.$('enemy-guide-return').click();
    assert.equal(clock.callbacks.size, 0, 'Return retires unresolved foreign-document observation');
  });

test('live Guide locale changes translate ordinary rows and practice without replacing the paused parent or child', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const page = await setup(t),
    checkpoint = await liveCut(page);
  openGuide(page);
  page.change('enemy-guide-topic', 'relay-sentinel');
  page.change('enemy-guide-theme', 'ukraine');
  const topic = page.$('enemy-guide-topic'),
    spot = page.$('enemy-guide-spot'),
    risk = page.$('enemy-guide-risk'),
    action = page.$('enemy-guide-try');
  topic.focus();
  setLocale('uk', { persist: false });
  assert.equal(
    spot.textContent,
    'Ознака: Поетапна зустріч. Замок позначає ядро, захищене пов’язаними ретрансляторами щита.',
  );
  assert.match(risk.textContent, /^Ризик: /);
  assert.match(
    action.textContent,
    /^Спробуйте: Захопіть усі ретранслятори щита\. Коли ЯДРО ВІДКРИТО,/,
  );
  assert.equal(page.doc.activeElement, topic);
  assert.equal(topic.value, 'relay-sentinel');
  assert.equal(page.$('enemy-guide-theme').value, 'ukraine');
  assert.equal(page.$('enemy-guide-spot'), spot);
  assert.equal(page.$('enemy-guide-risk'), risk);
  assert.equal(page.$('enemy-guide-try'), action);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  const child = await launch(page),
    childURL = child.frame.src,
    childWindow = child.frame.contentWindow,
    handoff = page.win.sessionStorage.getItem(handoffKey),
    hint = page.$('enemy-guide-practice-hint'),
    writes = page.storage.writes.length;
  const ukrainian = hint.textContent;
  assert.match(ukrainian, /Коли ЯДРО ВІДКРИТО/);
  assert.match(ukrainian, /Повтор починає той самий урок\./);
  assert.doesNotMatch(ukrainian, /Move with|Retry starts|CORE OPEN/);
  for (const language of ['en', 'uk']) {
    setLocale(language, { persist: false });
    page.frame(0);
    if (language === 'en')
      assert.match(hint.textContent, /During CORE OPEN.*Retry starts the same lesson\./);
    else assert.equal(hint.textContent, ukrainian);
    assert.equal(page.$('enemy-guide-practice-hint'), hint);
    assert.equal(child.frame.src, childURL);
    assert.equal(child.frame.contentWindow, childWindow);
    assert.equal(child.frame.hidden, false);
    assert.equal(page.doc.activeElement, child.frame);
    assert.equal(topic.value, 'relay-sentinel');
    assert.equal(page.$('enemy-guide-theme').value, 'ukraine');
    assert.equal(page.win.sessionStorage.getItem(handoffKey), handoff);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.storage.writes.length, writes);
  }
  childReturn(page, child);
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.doc.activeElement.id, 'enemy-guide-play');
  assert.deepEqual(page.errors, []);
});
function padBoundary(page, t) {
  // Continue the host clock; a reset to 1000ms would regress after earlier
  // complete-file cases and keep the Confirm lifecycle guarded indefinitely.
  let now = performance.now();
  t.mock.method(performance, 'now', () => now);
  const original = navigator.getGamepads;
  const pad = {
    index: 0,
    id: 'Field guide controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => {
    original();
    return [pad];
  };
  const frame = () => {
    now += 20;
    page.frame(20);
  };
  const set = (index, pressed) => (pad.buttons[index] = { pressed, value: pressed ? 1 : 0 });
  const pulse = (index) => {
    set(index, true);
    frame();
    set(index, false);
    frame();
  };
  frame();
  // A neutral sample connects automatically; Confirm is now a real menu action.
  return { pad, frame, set, pulse };
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: actual guide preserves a live cut, Large text preference and held-input isolation through practice and return`, async (t) => {
    const storage = memoryStorage(),
      preview = memoryStorage({ [handoffKey]: 'an existing authoring preview' });
    saveLibrary(storage, profileKey, updatePreferences(emptyLibrary(), { turnPolicy }));
    const page = await setup(t, { storage, previewStorage: preview });
    const checkpoint = await liveCut(page);
    const pausedPlayer = structuredClone(page.rendered.run.player);
    assert.equal(page.$('pause-label').hidden, false);
    assert.equal(page.$('overlay-reading').hidden, true);
    assert.equal(page.$('overlay-read').hidden, true, 'compact pause has no hidden reading action');
    assert.equal(page.$('overlay-reading').tabIndex, -1);
    page.$('settings-button').click();
    page.change('text-size', 'large');
    page.doc.querySelector('[data-close="settings-dialog"]').click();
    page.frame(0);
    assert.equal(page.doc.body.dataset.textSize, 'large');
    assert.equal(loadLibrary(storage, profileKey).library.preferences.textSize, 'large');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    openGuide(page);
    const snapshot = [...storage.map],
      writeCount = storage.writes.length;
    page.change('enemy-guide-topic', 'line-impact');
    page.change('enemy-guide-theme', 'coupa');
    assert.match(page.$('enemy-guide-risk').textContent, /costs a life/);
    const controls = padBoundary(page, t);
    const lesson = await launch(page);
    const recipe = JSON.parse(preview.getItem(handoffKey));
    assert.equal(recipe.level.id, 'line-impact-demo');
    assert.equal(recipe.settings.turnPolicy, turnPolicy);
    assert.equal(recipe.theme.id, 'coupa');
    assert.equal(recipe.masteryDefinition, null);
    const reads = page.padReads;
    controls.set(13, true);
    controls.set(0, true);
    for (let i = 0; i < 60; i++) controls.frame();
    assert.equal(page.padReads, reads, 'focused child prevents parent sampling, not just dispatch');
    assert.equal(page.doc.activeElement, lesson.frame);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    childReturn(page, lesson, { origin: 'https://foreign.invalid' });
    assert.equal(lesson.frame.hidden, false, 'foreign return cannot dismiss lesson');
    childReturn(page, lesson);
    assert.equal(lesson.frame.src, 'about:blank');
    assert.equal(page.doc.activeElement.id, 'enemy-guide-play');
    assert.equal(page.$('enemy-guide-dialog').open, true);
    assert.equal(preview.getItem(handoffKey), 'an existing authoring preview');
    for (let i = 0; i < 60; i++) controls.frame();
    assert.equal(
      page.doc.activeElement.id,
      'enemy-guide-play',
      'held pad cannot reclaim returned focus',
    );
    assert.equal(lesson.frame.hidden, true, 'held Confirm cannot relaunch lesson');
    controls.set(13, false);
    controls.set(0, false);
    controls.frame();
    controls.pulse(1);
    assert.equal(page.$('enemy-guide-dialog').open, false, 'fresh controller Back closes guide');
    assert.equal(page.$('shell-home').open, true);
    assert.equal(page.doc.activeElement.id, 'shell-guide');
    assert.equal(page.$('settings-dialog').open, true);
    controls.pulse(1);
    await Promise.resolve();
    assert.equal(page.$('settings-dialog').open, false, 'a separate Back leaves Settings');
    assert.equal(page.$('shell-home').open, true);
    assert.equal(page.doc.activeElement.id, 'shell-options');
    controls.pulse(1);
    await Promise.resolve();
    assert.equal(page.$('shell-home').open, false, 'a separate Back leaves Main menu');
    assert.equal(page.doc.activeElement.id, 'start-button');
    controls.pulse(13);
    page.key('ArrowRight');
    page.key('ArrowRight', false);
    // Advance the mocked physical clock through the 120ms Confirm release
    // and 1250ms Steam/native echo guard before a separate keyboard gesture.
    // The parent remains paused for every neutral sample.
    for (let i = 0; i < 80; i++) controls.frame();
    assert.equal(page.rendered.paused, true, 'direction inputs never resume the paused parent');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(
      [...storage.map],
      snapshot,
      'practice never changes profile or suspended bytes',
    );
    assert.equal(storage.writes.length, writeCount, 'practice never rewrites a campaign save');
    page.$('start-button').focus();
    nativeKey(page, 'Enter');
    await settle(() => page.doc.body.dataset.flightState === 'running');
    ticks(page, 3);
    assert.equal(page.rendered.paused, false);
    assert.ok(page.rendered.run.player.y > pausedPlayer.y, 'explicit Resume continues saved Down');
    assert.equal(
      page.rendered.run.player.x,
      pausedPlayer.x,
      'rejected Right did not enter flight intent',
    );
    assert.deepEqual(page.errors, []);
  });
}

test('actual guide repeated return and canceled load preserve the parent and reject stale lesson messages', async (t) => {
  const preview = memoryStorage({ [handoffKey]: 'previous preview' });
  const page = await setup(t, { previewStorage: preview });
  const checkpoint = await liveCut(page);
  openGuide(page);
  const saved = [...page.storage.map];
  const first = await launch(page);
  childReturn(page, first);
  const second = await launch(page);
  assert.notEqual(second.token, first.token);
  childReturn(page, first);
  assert.equal(second.frame.hidden, false, 'old lesson return cannot dismiss current lesson');
  page.$('enemy-guide-return').click();
  assert.equal(second.frame.hidden, true);
  assert.equal(page.$('enemy-guide-dialog').open, true);
  assert.equal(preview.getItem(handoffKey), 'previous preview');

  let resolve;
  const fetch = globalThis.fetch,
    pending = new Promise((done) => (resolve = done));
  globalThis.fetch = (path) =>
    path === 'content/scenarios/line-impact-demo.json' ? pending : fetch(path);
  page.change('enemy-guide-topic', 'line-impact');
  const operation = page.$('enemy-guide-play').onclick();
  assert.equal(page.$('enemy-guide-play').disabled, true);
  nativeKey(page, 'Escape');
  assert.equal(
    page.$('enemy-guide-dialog').open,
    false,
    'Back cancels rather than trapping a load',
  );
  resolve({
    ok: true,
    json: async () =>
      JSON.parse(
        readFileSync(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
      ),
  });
  assert.equal(await operation, false);
  assert.equal(second.frame.src, 'about:blank');
  assert.equal(preview.getItem(handoffKey), 'previous preview');
  ticks(page, 10);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual([...page.storage.map], saved);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

for (const listening of [false, true]) {
  test(`actual guide returns with streamed music ${listening ? 'continuing' : 'still explicitly paused'}, without resuming flight`, async (t) => {
    const original = await fixture(),
      db = memoryIndexedDB(),
      store = createSoundtrackStore({ indexedDB: db.indexedDB });
    const library = {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    };
    await store.commit(
      await prepareSoundtrackLibrary(library, original.assets, { probeMedia: structuralProbe }),
      { expectedGeneration: 0 },
    );
    store.close();
    const audio = {
      ...audioHarness(),
      durationSeconds: original.track.asset.durationSeconds,
      filePlayback: true,
    };
    const page = await setup(t, { audio, soundtrackIndexedDB: db.indexedDB });
    await settle(() => !page.$('soundtrack-open').disabled);
    page.$('settings-button').click();
    page.$('settings-tab-audio').click();
    assert.equal(page.$('settings-panel-audio').hidden, false);
    page.$('soundtrack-open').click();
    await waitFor(
      () =>
        /Saved library loaded|Music library ready|unsaved draft/.test(
          page.$('soundtrack-status').textContent,
        ),
      () => page.$('soundtrack-status').textContent,
    );
    page.$('soundtrack-play').click();
    const media = page.audioElements[0];
    // Play owns transport only. Choose the independent master explicitly before
    // exercising audible music's suspension and return around the guide.
    await settle(
      () => !media.paused,
      'The muted stream must start without changing master intent.',
    );
    assert.equal(
      loadLibrary(page.storage, profileKey, { campaigns: [campaign] }).library.preferences
        .musicEnabled,
      false,
      'Play does not persist an implicit master unmute.',
    );
    assert.equal(media.muted, true);
    page.$('soundtrack-master-mute').click();
    await settle(
      () =>
        !media.paused &&
        !media.muted &&
        loadLibrary(page.storage, profileKey, { campaigns: [campaign] }).library.preferences
          .musicEnabled,
      'Explicit master intent and playback must settle before opening the guide.',
    );
    if (!listening) {
      page.$('soundtrack-pause').click();
      await settle(() => media.paused);
    }
    media.currentTime = 0.01;
    const stream = media.src;
    page.$('soundtrack-close').click();
    page.doc.querySelector('[data-close="settings-dialog"]').click();
    const checkpoint = await liveCut(page);
    openGuide(page);
    const child = await launch(page);
    assert.equal(media.paused, true, 'parent audio suspends while the child lesson runs');
    const playsDuringLesson = media.plays;
    page.doc.hidden = true;
    page.doc.emit('visibilitychange');
    page.win.emit('blur');
    page.doc.hidden = false;
    page.doc.emit('visibilitychange');
    page.win.emit('focus');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(media.paused, true, 'returning to the tab cannot create two audible game owners');
    assert.equal(media.plays, playsDuringLesson);
    childReturn(page, child);
    if (listening) await settle(() => !media.paused);
    else {
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(media.paused, true);
      assert.equal(media.plays, playsDuringLesson, 'music-only Pause is not undone by returning');
    }
    assert.equal(media.src, stream);
    assert.equal(media.currentTime, 0.01, 'return never restarts the song');
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(page.errors, []);
  });
}
