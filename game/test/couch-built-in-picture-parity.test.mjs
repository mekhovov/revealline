import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { inspectImageDataUrl } from '../content.mjs';
import { preparePack, installPack, resolvePackCampaign } from '../packs.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createCouchInstalledChapters } from '../couch/couch-installed-chapters.mjs';
import { createCouchStaticPictures } from '../couch/couch-static-pictures.mjs';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { acquirePresentationImage } from '../ui/presentation-image.mjs';
import { presentationPicturePins } from '../flight-media-pins.mjs';
import {
  createReleasePictureDefaults,
  matchesReleasePictureBaseline,
  releasePictureForIdentity,
} from '../presentation/release-pictures.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';

// These literal owners and originals were reviewed against committed field-kit@58.
// The oracle is independent of the resolver under test. Browser decoding, IDB,
// painter pixels and layout remain modeled; no native acceptance is implied.
const expectedRows = [
  [
    'signal-01',
    'First Signal',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.26e53164613e83d0',
    'c1aedf89bc3433dc1cb60998fa1e2563480a590c38586332f444c4c12c772fce',
    40810,
    768,
  ],
  [
    'signal-02',
    'Relay Orchard',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.11b817ad76f073e5',
    '0233c5f399b93700594af044a5f56687a0742333d32b7bc54ef7122173f1dc65',
    46655,
    768,
  ],
  [
    'signal-03',
    'Crosswind',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.eed5c579750a6e66',
    'e033d8a3118b42b870e2f6350f7ae960b6085b46beb32ae235881a53bfbdc066',
    42638,
    768,
  ],
  [
    'signal-04',
    'Stone Lanes',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.15ad2393da53b1f3',
    'd4690eb2839e8f90a4ac105502c5b22c1b1cceb643c5d2593ca3a4e61d6aa008',
    44881,
    768,
  ],
  [
    'signal-05',
    'Night Patrol',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.89f500bf737786b4',
    '30957860bb1edac99c230a91a34eab8249b43497fda680707276c859f3bd5f0c',
    34535,
    768,
  ],
  [
    'signal-06',
    'Hidden Frequency',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.493d624384c36c39',
    '2444795bb19516949a98519f0e23f9cdf64b454f01a0bb297521d17b5af376da',
    42982,
    768,
  ],
  [
    'signal-07',
    'The Crossing',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.0f5828ed32e61eea',
    'efef00b62e24bc89315f26fe888d64658bb63cfcce3eeb047645c812903d3e3f',
    45086,
    768,
  ],
  [
    'signal-08',
    'Last Light',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.95c0dfa75cc8f037',
    '9ef850d87a46eee28cbfa3df8f2d2945673b8bf5dc2fdcc4edf1840175e3f7a1',
    36209,
    768,
  ],
  [
    'signal-09',
    'Signal Garden',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.6a200fa6fc2c6c98',
    '713991ea5d2ba3bbc0f5115c6fdc98f337da90b657b0c43c7db1625073377f90',
    46471,
    768,
  ],
  [
    'signal-10',
    'Supply Circuit',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.21af5a140bffb67a',
    '5428ce32eb31d44ea4b04561d86cc65e31ce79fe50acce40beadfd1d2546b837',
    47287,
    768,
  ],
  [
    'signal-11',
    'Short Fuse',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.c2db06198f371c49',
    '535cf4dc9b21c9ff7f9c26d4bc0657e8d6820626551b4d34d82e332748e4d9e3',
    38018,
    768,
  ],
  [
    'signal-12',
    'Relay Storm',
    'first-signal/2/88639f3aab7b6cc1',
    'picture.fpv.f0b0d70327a0a4c4',
    'd22b1070efad07ed1e6f9d8e42d3dc7e19922478e7abedad3f08d55e53cf065c',
    40454,
    768,
  ],
  [
    'orchard-crossing',
    'Orchard Crossing',
    'fpv-pressure-lines/1/ebb56ffdd9baa8e8',
    'picture.fpv.9c57dfab02314b3b',
    '53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850',
    52720,
    1152,
  ],
  [
    'courtyard-exits',
    'Courtyard Exits',
    'fpv-pressure-lines/1/ebb56ffdd9baa8e8',
    'picture.fpv.c123b9065e7d1d0a',
    'e85e9aa8f56ba214bcdc9184feb99f526f1a89f66627ac0bf278bffa123dc7c9',
    40846,
    1152,
  ],
  [
    'night-crossfire',
    'Night Crossfire',
    'fpv-pressure-lines/1/ebb56ffdd9baa8e8',
    'picture.fpv.efccb4b013c76322',
    'dda5900559255b1bad906b80a1b9a3cee914ba732f6dcb4fdb8b3c9bce50633f',
    32275,
    1152,
  ],
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const sourcePack = await json('../content/packs/fpv-arcade-r5.json');
const runtime = await json('../presentation/compiled/runtime.json');
const campaign = await json('../content/campaign.json');
const registry = await json('../content/classes.json');
const themes = await json('../content/themes.json');
const baseEntry = {
  campaign: { ...campaign, classRecipes: registry },
  classRecipes: registry,
  themes: themes.themes,
  visualOverrides: {},
  levelVisuals: [],
  music: [],
  sourcePackId: null,
};
const expectedFor = (row) => ({
  identity: { baseCampaignKey: row[2], levelId: row[0], levelRevision: '1', themeId: 'fpv' },
  slotId: row[3],
  summary: { sha256: row[4], width: row[6], height: 576, fit: 'contain', sampling: 'nearest' },
});
const originals = new Map();
for (const row of expectedRows) {
  const expected = expectedFor(row),
    asset = runtime.resolved.assets[expected.slotId];
  assert.equal(asset.kind, 'image');
  assert.equal(asset.quality.stage, 'reviewed');
  assert.deepEqual(asset.file, {
    bytes: row[5],
    width: row[6],
    height: 576,
    mime: 'image/png',
    sha256: row[4],
  });
  const bytes = await readFile(
    new URL(`../presentation/compiled/assets/${row[4]}.png`, import.meta.url),
  );
  assert.equal(bytes.length, row[5]);
  assert.equal(sha(bytes), row[4]);
  originals.set(expected.slotId, { asset, bytes });
}
const bytesFromData = (url) => Buffer.from(url.split(',')[1], 'base64');
async function decodeImage(value) {
  const dataUrl =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const header = inspectImageDataUrl(dataUrl);
  assert.equal(header.valid, true);
  return { naturalWidth: header.width, naturalHeight: header.height };
}
const preparedSource = (await preparePack(sourcePack, { decodeImage })).pack;

class Locks {
  held = new Set();
  async request(key, _options, callback) {
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
function modeledImages() {
  const urls = new Map(),
    images = [];
  let nextURL = 0;
  const state = { onDecode: null };
  class ImageClass {
    constructor() {
      images.push(this);
      this.released = 0;
    }
    set src(source) {
      this.source = source;
      Promise.resolve()
        .then(async () => {
          this.bytes = source.startsWith('data:')
            ? bytesFromData(source)
            : Buffer.from(await urls.get(source).arrayBuffer());
          const header = inspectImageDataUrl(
            `data:image/png;base64,${this.bytes.toString('base64')}`,
          );
          assert.equal(header.valid, true);
          this.width = this.naturalWidth = header.width;
          this.height = this.naturalHeight = header.height;
          this.onload?.();
        })
        .catch((error) => this.onerror?.(error));
    }
    async decode() {
      await state.onDecode?.(this);
      this.decoded = true;
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.released++;
    }
  }
  class URLImpl extends URL {
    static createObjectURL(blob) {
      const url = `blob:installed-release-parity/${++nextURL}`;
      urls.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      assert.ok(urls.has(url), 'An owned object URL is released exactly once.');
      urls.delete(url);
    }
  }
  return { images, urls, state, ImageClass, URLImpl };
}
const compact = (picture) => ({
  sha256: sha(picture.image.bytes),
  width: picture.image.naturalWidth,
  height: picture.image.naturalHeight,
  fit: picture.fit,
  sampling: picture.sampling,
});
async function fixture(t, row) {
  const pack = preparedSource,
    expected = expectedFor(row),
    identity = expected.identity;
  const releaseChoice = releasePictureForIdentity(runtime, identity);
  assert.equal(releaseChoice.slotId, expected.slotId);
  const releaseBytes = originals.get(expected.slotId).bytes;
  const isFeatured = !row[0].startsWith('signal-');
  const pointerMemory = managedIndexedDB(),
    mediaMemory = managedIndexedDB(),
    locks = new Locks(),
    model = modeledImages();
  const committedWrites = { pointers: 0, media: 0 };
  pointerMemory.afterAnyCommit = () => committedWrites.pointers++;
  mediaMemory.afterAnyCommit = () => committedWrites.media++;
  const values = new Map([
    ['revealline.library.dev.v1', 'retained Solo progress'],
    ['revealline.session.dev.v1', 'retained paused Solo attempt'],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: () => assert.fail('Picture preparation must not write player storage.'),
    removeItem: () => assert.fail('Picture preparation must not delete player storage.'),
  };
  const pointer = createExternalChapterPointerStore({
    indexedDB: pointerMemory.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  const manager = createManagedMediaStore({
    indexedDB: mediaMemory.indexedDB,
    storyMedia: true,
    soundtrackCatalogue: true,
  });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const writer = await claimProfileWriter(locks, pointer.keys.writerKey);
  const installer = createExternalChapterHost({
    indexedDB: pointerMemory.indexedDB,
    profileKey: pointer.keys.profileKey,
    packsKey: pointer.keys.packsKey,
    storage,
    lockManager: locks,
    writer,
    registeredEntries: [],
    getManagedStore: () => manager,
    decodeImage,
  });
  try {
    if (isFeatured) {
      const current = await installer.inspect();
      await installer.commitMutation(
        await installer.prepareMutation(current, installPack(current.packs, pack)),
      );
    }
  } finally {
    installer.close();
    writer.release();
  }
  const indexedDB = {
    open(name, ...args) {
      return (
        name === MANAGED_MEDIA_DATABASE ? mediaMemory.indexedDB : pointerMemory.indexedDB
      ).open(name, ...args);
    },
  };
  const pictureEntry = isFeatured ? resolvePackCampaign(pack, 'fpv-pressure-lines') : baseEntry;
  const catalog = createExecutionCatalog([pictureEntry]);
  const entry = catalog.entries.find((entry) => entry.difficulty === 'standard');
  const level = entry.campaign.levels.find((level) => level.id === identity.levelId);
  const identityCatalog = createMediaIdentityCatalog(catalog);
  const request = {
    executionKey: entry.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeId: 'fpv',
  };
  assert.deepEqual(identityCatalog.resolve(request), identity);
  const background =
    pictureEntry.levelVisuals.find((row) => row.levelId === level.id)?.visualOverrides.background ??
    null;
  let reads = 0,
    rejectRead = false;
  const snapshot = runtime;
  const page = {
    ready: Promise.resolve(snapshot),
    current: () => snapshot,
    async readPicture(slotId, options) {
      reads++;
      assert.equal(options.snapshot, snapshot);
      assert.equal(slotId, releaseChoice.slotId);
      if (rejectRead) throw new Error('Controlled selected release download failure.');
      return { asset: releaseChoice.asset, blob: new Blob([releaseBytes], { type: 'image/png' }) };
    },
  };
  const installed = createCouchInstalledChapters({
    channel: 'dev',
    registeredEntries: [],
    indexedDB,
    storage,
    lockManager: locks,
    presentationPage: page,
    ...model,
  });
  const staticPictures = createCouchStaticPictures({
    entries: [pictureEntry],
    presentationPage: page,
    indexedDB,
    ...model,
  });
  // This image belongs to the authored chapter loader. A static fallback borrows
  // it; selecting, retrying or disposing static presentation must not release it.
  const borrowed = new model.ImageClass();
  if (background) {
    await new Promise((resolve, reject) => {
      borrowed.onload = resolve;
      borrowed.onerror = reject;
      borrowed.src = background.dataUrl;
    });
    await borrowed.decode();
  }
  const staticRow = {
    level,
    pictureEntry,
    authoredBackground: background,
    backdrop: background ? { image: borrowed, fit: background.fit, sampling: 'nearest' } : null,
    defaultThemeId: 'fpv',
  };
  const readMedia = async (options) => ({
    store,
    ...(await store.readPresentationMetadata(options)),
  });
  const defaults = createReleasePictureDefaults({
    getHost: () => page,
    executionCatalog: () => catalog,
    readMedia,
  });
  const solo = createFlightPictures({
    context: { runId: 'parity-fresh-solo', ...request },
    level,
    themeIds: ['fpv'],
    identityCatalog,
    readMedia,
    prepareSelection: (options) =>
      defaults.prepareSelection({ ...options, authoredBackground: background }),
    acquire: (source, options) => acquirePresentationImage(source, { ...options, ...model }),
  });
  t.after(() => {
    solo.dispose();
    installed.dispose();
    staticPictures.dispose();
    store.close();
    manager.close();
    pointer.close();
  });
  return {
    installed,
    indexedDB,
    storage,
    locks,
    staticPictures,
    staticRow,
    solo,
    store,
    catalog,
    background,
    borrowed,
    model,
    reads: () => reads,
    failReads: () => (rejectRead = true),
    allowReads: () => (rejectRead = false),
    writes: () => ({
      pointers: pointerMemory.allPuts.length,
      media: mediaMemory.allPuts.length,
      committedWrites: { ...committedWrites },
      values: [...values],
    }),
    async installedRow() {
      const rows = await installed.refresh();
      assert.equal(rows.length, 3);
      const row = rows.find((row) => row.level.id === identity.levelId);
      assert.ok(row, 'Real installed snapshot must enumerate this exact Pressure Lines map.');
      return row;
    },
  };
}

test('all fifteen committed FPV maps have exact Solo/static picture parity, including the three installed Pressure Lines owners', async (t) => {
  assert.equal(expectedRows.length, 15);
  assert.equal(new Set(expectedRows.map((row) => row[0])).size, 15);
  assert.deepEqual(
    [...campaign.levels, ...preparedSource.campaigns[0].levels].map((level) => level.id),
    expectedRows.map((row) => row[0]),
  );
  for (const row of expectedRows)
    await t.test(row[1], async (t) => {
      const f = await fixture(t, row),
        expected = expectedFor(row);
      assert.equal(await matchesReleasePictureBaseline(expected.identity, f.background), true);
      const original = f.background ? sha(bytesFromData(f.background.dataUrl)) : null;
      await f.solo.ensure();
      assert.deepEqual(compact(f.solo.current()), expected.summary);
      const pin = presentationPicturePins(f.solo.pins()).choices[0];
      assert.equal(pin.kind, 'still');
      assert.deepEqual(pin.identity, expected.identity);
      assert.equal(pin.sha256, row[4]);
      const saved = await f.store.read();
      assert.deepEqual(
        saved.document.library.assignments,
        [],
        'Solo retains the original without installing a new assignment.',
      );
      const before = f.writes();
      const picture = await f.staticPictures.select(f.staticRow, { raceId: 1, themeId: 'fpv' });
      assert.deepEqual(picture.choice.identity, expected.identity);
      assert.deepEqual(compact(picture), expected.summary);
      assert.equal(await f.staticPictures.confirm(f.staticRow, { raceId: 1 }), picture);
      if (!row[0].startsWith('signal-')) {
        const installedRow = await f.installedRow();
        const installed = await f.installed.select(installedRow, { raceId: 1, themeId: 'fpv' });
        assert.deepEqual(installed.choice.identity, expected.identity);
        assert.deepEqual(compact(installed), expected.summary);
        assert.equal(await f.installed.confirm(installedRow, { raceId: 1 }), installed);
      }
      assert.deepEqual(
        f.writes(),
        before,
        'Versus consumers do not mutate media, progress, or saved-flight storage.',
      );
      assert.equal(f.background ? sha(bytesFromData(f.background.dataUrl)) : null, original);
    });
});
async function action(page, id, type = 'click') {
  const element = page.$(id),
    handler = element[`on${type}`];
  let operation;
  element[`on${type}`] = (event) => (operation = handler?.(event));
  try {
    element.emit(type);
    await operation;
  } finally {
    element[`on${type}`] = handler;
  }
  page.frame();
}
test('actual Versus host passes one exact compiled original lease to both boards for every built-in FPV map', async (t) => {
  const model = modeledImages(),
    memory = managedIndexedDB(),
    reads = [];
  let lease;
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: model.ImageClass,
    URLImpl: model.URLImpl,
    assetDatabase: memory.indexedDB,
    beforeImport({ document, window }) {
      lease = mountPresentationPage({
        document,
        window,
        createHost: () => ({
          async load() {
            return runtime;
          },
          apply() {},
          close() {},
          async readPicture(slotId, options) {
            assert.equal(options.snapshot, runtime);
            const original = originals.get(slotId);
            assert.ok(original, `Only expected built-in originals are allowed: ${slotId}`);
            reads.push(slotId);
            return {
              asset: original.asset,
              blob: new Blob([original.bytes], { type: 'image/png' }),
            };
          },
        }),
      });
    },
  });
  t.after(() => lease.close());
  await waitFor(() => !page.$('race-start').disabled, 'initial required picture');
  const keys = page.$('race-level').children.map((option) => option.value);
  assert.equal(keys.length, 15, 'The actual host lists the complete built-in inventory.');
  const writes = memory.allPuts.length;
  for (const row of expectedRows) {
    page.$('race-level').value = row[0].startsWith('signal-')
      ? row[0]
      : `shipped/${sourcePack.id}/fpv-pressure-lines/${row[0]}`;
    await action(page, 'race-level', 'change');
    if (page.$('race-theme').value !== 'fpv') {
      page.$('race-theme').value = 'fpv';
      await action(page, 'race-theme', 'change');
    }
    await waitFor(() => !page.$('race-start').disabled, `prepared ${row[0]}`);
    page.frame();
    const picture = page.drawOptions[0].backdrop;
    assert.equal(
      page.drawOptions[1].backdrop,
      picture,
      'Both boards borrow the identical accepted lease.',
    );
    assert.deepEqual(picture.choice.identity, expectedFor(row).identity);
    assert.deepEqual(compact(picture), expectedFor(row).summary);
    assert.notEqual(
      page.renders[0],
      page.renders[1],
      'The shared picture does not share simulation state.',
    );
  }
  assert.deepEqual(new Set(reads), new Set(expectedRows.map((row) => row[3])));
  assert.equal(
    memory.allPuts.length,
    writes,
    'Preparing all boards never writes a media assignment.',
  );
});
