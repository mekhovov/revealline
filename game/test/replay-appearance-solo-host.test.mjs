import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { REPLAY_PRESENTATION_FORMAT, snapshotReplayPresentation } from '../replay-presentation.mjs';
import { ACTOR_STYLE_PREFERENCES_KEY } from '../actor-style-preferences.mjs';
import { ACTOR_APPEARANCE_RELEASES } from '../presentation/actor-appearance-lease.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';

// Actual Solo export/recording and exact source assets; finite DOM/Canvas and
// modeled PNG decoding. This is not native download or visual-quality evidence.
const root = fileURLToPath(new URL('../../', import.meta.url));
const legacyKey = 'revealline.suspended.dev.v1';
const ticks = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
async function sourceBytes(path) {
  try {
    return await readFile(new URL(`../../${path}`, import.meta.url));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      maxBuffer: 12 * 1024 * 1024,
    });
  }
}
async function setup(
  t,
  { storage = memoryStorage(), search = '?journey=whole-spatial-v5', ...options } = {},
) {
  return soloPage(t, {
    titleScreen: true,
    storage,
    search,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => {
      const value = String(path);
      const presentation = value.match(/(?:^|\/)presentation\/(.+)$/);
      if (presentation)
        return new Response(await sourceBytes(`game/presentation/${presentation[1]}`));
      const artwork = value.match(/(?:^|\/)content-design\/assets\/(.+)$/);
      if (artwork)
        return new Response(await sourceBytes(`game/content-design/assets/${artwork[1]}`));
      return undefined;
    },
    ...options,
  });
}
async function start(page) {
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
}
function captureDownloads(t, page) {
  const downloads = [],
    anchors = [],
    timers = [];
  const URLImpl = globalThis.URL;
  const createURL = URLImpl.createObjectURL.bind(URLImpl);
  const createElement = page.doc.createElement.bind(page.doc);
  const timeout = globalThis.setTimeout;
  t.mock.method(URLImpl, 'createObjectURL', (blob) => {
    const url = createURL(blob);
    if (blob.type === 'application/json') downloads.push({ blob, url });
    return url;
  });
  t.mock.method(page.doc, 'createElement', (tag) => {
    const node = createElement(tag);
    if (tag === 'a') anchors.push(node);
    return node;
  });
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds, ...args) => {
    const timer = timeout(callback, milliseconds, ...args);
    // Keep the real delayed revoke; it need not hold this Node fixture open.
    if (milliseconds === 60000) {
      timer.unref();
      timers.push(timer);
    }
    return timer;
  });
  t.after(() => {
    for (const timer of timers) clearTimeout(timer);
    for (const download of downloads) URLImpl.revokeObjectURL(download.url);
  });
  return {
    downloads,
    anchors,
    async exported() {
      await page.$('export-replay').onclick();
      assert.equal(page.$('replay-dialog').open, true, page.$('run-message').textContent);
      assert.ok(downloads.length > 0, page.$('replay-operation-status').textContent);
      const output = JSON.parse(page.$('replay-json').value);
      assert.deepEqual(JSON.parse(await downloads.at(-1).blob.text()), output);
      return output;
    },
  };
}
function assertExactReplay(page, raw) {
  assert.deepEqual(raw.checkpoint, authoritativeCheckpoint(page.rendered.run));
  const verified = verifyReplay(raw);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), raw.checkpoint);
  assert.deepEqual(page.errors, []);
}
function changeFutureActors(page, actorStyle) {
  const newValue = JSON.stringify({ actorStyle });
  page.storage.setItem(ACTOR_STYLE_PREFERENCES_KEY, newValue);
  page.win.emit('storage', {
    key: ACTOR_STYLE_PREFERENCES_KEY,
    newValue,
    storageArea: page.storage,
  });
}
function saveLegacy(page) {
  if (page.doc.body.dataset.flightState === 'running') page.$('pause-button').click();
  if (!page.storage.getItem(legacyKey)) page.$('save-attempt-button').click();
  return JSON.parse(page.storage.getItem(legacyKey));
}

test('active and paused Journey exports pin accepted FPV actors; raw download preserves the inner recording', async (t) => {
  const page = await setup(t);
  await start(page);
  page.key('ArrowDown');
  ticks(page, 12);
  page.key('ArrowDown', false);
  const capture = captureDownloads(t, page);
  const first = await capture.exported();
  assert.equal(first.format, REPLAY_PRESENTATION_FORMAT);
  assert.equal(first.actorAppearancePin.content.owner.kind, 'journey');
  assert.equal(first.actorAppearancePin.content.editionId, 'whole-spatial-v5');
  assert.equal(first.actorAppearancePin.content.level.id, 'first-return');
  assert.deepEqual(
    first.actorAppearancePin.presentation,
    ACTOR_APPEARANCE_RELEASES[0].presentation,
  );
  assert.deepEqual(snapshotReplayPresentation(first), first);
  assertExactReplay(page, first.replay);
  assert.match(capture.anchors.at(-1).download, /-recorded-actors-replay\.json$/);
  assert.match(
    page.$('replay-appearance-note').textContent,
    /does not record the reveal picture, music or interface/,
  );
  assert.equal(page.$('download-raw-replay').hidden, false);
  changeFutureActors(page, 'campaign');
  page.$('replay-dialog').close();
  const second = await capture.exported();
  assert.deepEqual(second.actorAppearancePin, first.actorAppearancePin);
  assert.deepEqual(second.replay, first.replay);
  await page.$('download-raw-replay').onclick();
  assert.deepEqual(JSON.parse(await capture.downloads.at(-1).blob.text()), first.replay);
  assert.equal(
    capture.anchors.at(-1).download,
    `revealline-${first.replay.summary.levelId}-replay.json`,
  );
  assert.deepEqual(
    JSON.parse(page.$('replay-json').value),
    second,
    'Raw download does not replace the displayed recorded-actor envelope.',
  );
});

test('a legally completed Classic run exports its exact terminal replay and accepted actors', async (t) => {
  const page = await setup(t, { search: '?journey=legacy' });
  await start(page);
  // Same production gp4 opening route independently qualified by the actor
  // host cohort. No state/status, collision, life or quota writes are made.
  ticks(page, 133);
  page.key('ArrowDown');
  ticks(page, 469);
  page.key('ArrowDown', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(authoritativeCheckpoint(page.rendered.run).hash, 'd8b55c21a6756634');
  changeFutureActors(page, 'campaign');
  const capture = captureDownloads(t, page);
  const exported = await capture.exported();
  assert.equal(exported.actorAppearancePin.style, 'fpv');
  assert.equal(exported.actorAppearancePin.content.owner.kind, 'campaign');
  assert.equal(exported.execution.sourcePackId, null);
  assert.equal(exported.replay.summary.status, 'won');
  assertExactReplay(page, exported.replay);
});

test('a fresh Campaign-style attempt keeps the historical raw export shape', async (t) => {
  const page = await setup(t, { search: '?journey=legacy' });
  page.change('menu-actor-style', 'campaign');
  await start(page);
  ticks(page, 12);
  const capture = captureDownloads(t, page);
  const exported = await capture.exported();
  assert.equal(exported.format, undefined);
  assert.equal(exported.actorAppearancePin, undefined);
  assert.equal(page.$('download-raw-replay').hidden, true);
  assert.equal(page.$('download-replay').textContent, 'Download raw JSON');
  assertExactReplay(page, exported);
});

test('historical v5 Continue remains unpinned and exports raw despite a fresh FPV preference', async (t) => {
  const storage = memoryStorage(),
    database = managedIndexedDB().indexedDB;
  let original;
  await t.test('create an actual accepted saved attempt', async (t) => {
    const page = await setup(t, { storage, search: '?journey=legacy', assetIndexedDB: database });
    await start(page);
    ticks(page, 12);
    original = saveLegacy(page);
    assert.equal(original.format, 'xonix-session.v6');
  });
  const historical = structuredClone(original);
  historical.format = 'xonix-session.v5';
  delete historical.actorAppearancePin;
  storage.setItem(legacyKey, JSON.stringify(historical));
  await t.test('restore through the historical reader and export', async (t) => {
    const page = await setup(t, { storage, search: '?journey=legacy', assetIndexedDB: database });
    page.$('shell-continue').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    assert.equal(page.rendered.actorAppearance, null);
    const capture = captureDownloads(t, page);
    const exported = await capture.exported();
    assert.equal(exported.format, undefined);
    assert.equal(exported.actorAppearancePin, undefined);
    assert.equal(page.$('download-raw-replay').hidden, true);
    assertExactReplay(page, exported);
  });
});

test('same-ID modified Custom content exports raw rather than asserting official actor ownership', async (t) => {
  const source = JSON.parse(await sourceBytes('game/content/packs/night-shift.json'));
  source.themes[0].palette.accent = '#ff11aa';
  const { pack } = await preparePack(source);
  const assets = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(
        exportPackLibrary(installPack(emptyPackLibrary(), pack)),
        'revealline.packs.dev.v1',
      );
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  const page = await setup(t, { search: '?journey=legacy', assetIndexedDB: assets.indexedDB });
  page.$('pack-select').value = source.id;
  await page.$('pack-select').onchange();
  await start(page);
  page.frame(0);
  assert.equal(page.rendered.run.levelId, source.campaigns[0].levels[0].id);
  assert.equal(page.rendered.actorAppearance, null);
  const capture = captureDownloads(t, page);
  const exported = await capture.exported();
  assert.equal(exported.format, undefined);
  assert.equal(exported.actorAppearancePin, undefined);
  assert.equal(page.$('download-raw-replay').hidden, true);
  assertExactReplay(page, exported);
});
