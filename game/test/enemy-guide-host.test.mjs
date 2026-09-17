// Real solo app + guide + input routers + persistence. Canvas, Window messaging,
// Gamepad, IndexedDB and HTMLMediaElement are modeled browser boundaries; this
// does not certify layout, physical controllers or two simultaneous browsers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
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
function liveCut(page) {
  page.$('start-button').click();
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
  page.$('shell-workshop').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('shell-workshop-dialog').open, true);
  page.$('shell-guide').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('shell-home').open, true, 'Main menu stays beneath Workshop and its guide');
  assert.equal(page.$('shell-workshop-dialog').open, true, 'Workshop retains its Guide opener');
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
function padBoundary(page, t) {
  let now = 1000;
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
    const checkpoint = liveCut(page);
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
    assert.equal(page.$('shell-workshop-dialog').open, true);
    controls.pulse(1);
    await Promise.resolve();
    assert.equal(page.$('shell-workshop-dialog').open, false, 'a separate Back leaves Workshop');
    assert.equal(page.$('shell-home').open, true);
    assert.equal(page.doc.activeElement.id, 'shell-workshop');
    controls.pulse(1);
    await Promise.resolve();
    assert.equal(page.$('shell-home').open, false, 'a separate Back leaves Main menu');
    assert.equal(page.doc.activeElement.id, 'start-button');
    controls.pulse(13);
    page.key('ArrowRight');
    page.key('ArrowRight', false);
    ticks(page, 20);
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
  const checkpoint = liveCut(page);
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
    const checkpoint = liveCut(page);
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
