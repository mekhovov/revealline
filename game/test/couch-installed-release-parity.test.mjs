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

// Exact committed R5 pack and compiled original bytes. Browser decode/pixels,
// Web Locks scheduling and IndexedDB are modeled; this is not native play proof.
// The Solo leg executes its actual flight/pin/default/materialization modules,
// not the full Solo application host, player input or saved-flight restoration.
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const sourcePack = await json('../content/packs/fpv-arcade-r5.json');
const runtime = await json('../presentation/compiled/runtime.json');
const identity = Object.freeze({
  baseCampaignKey: 'fpv-pressure-lines/1/ebb56ffdd9baa8e8',
  levelId: 'orchard-crossing',
  levelRevision: '1',
  themeId: 'fpv',
});
const expected = Object.freeze({
  release: '53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850',
  embedded: 'e748ccee83cdb51fb9d385c626d6824d37eeef254f1684e27e54b12e42b35823',
});
const releaseChoice = releasePictureForIdentity(runtime, identity);
assert.equal(releaseChoice.slotId, 'picture.fpv.9c57dfab02314b3b');
assert.equal(releaseChoice.asset.file.sha256, expected.release);
const releaseBytes = await readFile(
  new URL(`../presentation/compiled/assets/${expected.release}.png`, import.meta.url),
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(releaseBytes), expected.release);
assert.equal(releaseBytes.length, 52720);
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
const releaseSummary = Object.freeze({
  sha256: expected.release,
  width: 1152,
  height: 576,
  fit: 'contain',
  sampling: 'nearest',
});

async function fixture(t, { available = true, pack = preparedSource } = {}) {
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
    const current = await installer.inspect();
    await installer.commitMutation(
      await installer.prepareMutation(current, installPack(current.packs, pack)),
    );
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
  const pictureEntry = resolvePackCampaign(pack, 'fpv-pressure-lines');
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
  const background = pictureEntry.levelVisuals.find((row) => row.levelId === level.id)
    .visualOverrides.background;
  let reads = 0,
    rejectRead = false;
  const snapshot = available ? runtime : null;
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
  await new Promise((resolve, reject) => {
    borrowed.onload = resolve;
    borrowed.onerror = reject;
    borrowed.src = background.dataUrl;
  });
  await borrowed.decode();
  const staticRow = {
    level,
    pictureEntry,
    authoredBackground: background,
    backdrop: { image: borrowed, fit: background.fit, sampling: 'nearest' },
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
    async orchard() {
      const rows = await installed.refresh();
      assert.equal(rows.length, 3);
      const row = rows.find((row) => row.level.id === identity.levelId);
      assert.ok(row, 'Real installed snapshot must enumerate Orchard Crossing.');
      return row;
    },
  };
}

test('R5 baseline and fresh Solo flight select the exact release without assigning it or changing its identity', async (t) => {
  const f = await fixture(t);
  assert.equal(sha(bytesFromData(f.background.dataUrl)), expected.embedded);
  assert.equal(await matchesReleasePictureBaseline(identity, f.background), true);
  assert.equal(
    await matchesReleasePictureBaseline({ ...identity, levelRevision: '2' }, f.background),
    false,
  );
  assert.equal(releasePictureForIdentity(runtime, { ...identity, levelRevision: '2' }), null);
  await f.solo.ensure();
  assert.deepEqual(compact(f.solo.current()), releaseSummary);
  const pin = presentationPicturePins(f.solo.pins()).choices[0];
  assert.equal(pin.kind, 'still');
  assert.deepEqual(pin.identity, identity);
  assert.equal(pin.sha256, expected.release);
  const saved = await f.store.read();
  assert.deepEqual(
    saved.document.library.assignments,
    [],
    'A fresh choice is not a saved assignment.',
  );
  assert.equal(saved.document.library.presentations.length, 1);
  assert.equal(
    sha(bytesFromData(f.background.dataUrl)),
    expected.embedded,
    'Authored original stays intact.',
  );
});

test('fresh exact R5 Orchard Crossing uses identical Solo, static Versus and installed Versus artwork', async (t) => {
  const f = await fixture(t);
  await f.solo.ensure();
  const before = f.writes();
  const row = await f.orchard();
  const staticPicture = await f.staticPictures.select(f.staticRow, { raceId: 1 });
  const installedPicture = await f.installed.select(row, { raceId: 1 });
  assert.deepEqual(compact(f.solo.current()), releaseSummary);
  assert.deepEqual(compact(staticPicture), releaseSummary);
  assert.deepEqual(f.writes(), before, 'Both Couch picture consumers remain read-only.');
  assert.equal(await f.installed.confirm(row, { raceId: 1 }), installedPicture);
  // Intentional regression: unpatched source returns e748…/1774×887 here.
  // Limit diagnostics to digest, geometry and fitting, never embedded data URLs.
  assert.deepEqual(compact(installedPicture), compact(staticPicture));
});

test('same-race installed Retry retains release choice and performs no player or media writes', async (t) => {
  const f = await fixture(t),
    before = f.writes(),
    row = await f.orchard(),
    first = await f.installed.select(row, { raceId: 4 });
  const retry = await f.installed.select(row, { raceId: 4 });
  assert.deepEqual(compact(first), releaseSummary);
  assert.deepEqual(compact(retry), releaseSummary);
  assert.equal(await f.installed.confirm(row, { raceId: 4 }), retry);
  assert.deepEqual(f.writes(), before);
});

test('unavailable release snapshot preserves exact installed original and borrowed static fallback through Retry', async (t) => {
  const f = await fixture(t, { available: false }),
    before = f.writes(),
    row = await f.orchard();
  const first = await f.staticPictures.select(f.staticRow, { raceId: 7 });
  const retry = await f.staticPictures.select(f.staticRow, { raceId: 7 });
  const installedPicture = await f.installed.select(row, { raceId: 7 });
  assert.equal(first.image, f.borrowed);
  assert.equal(retry.image, f.borrowed);
  assert.equal(compact(retry).sha256, expected.embedded);
  assert.deepEqual(compact(installedPicture), compact(retry));
  assert.equal(await f.installed.confirm(row, { raceId: 7 }), installedPicture);
  f.staticPictures.dispose();
  assert.equal(f.borrowed.released, 0, 'A borrowed authored original is owned by its chapter.');
  assert.equal(f.reads(), 0);
  assert.deepEqual(f.writes(), before);
});

test('changed R5 authored artwork retains its original despite unchanged gameplay owner', async (t) => {
  const custom = structuredClone(sourcePack);
  const orchard = custom.levelVisuals.find((row) => row.levelId === identity.levelId);
  const alternative = custom.levelVisuals.find((row) => row.levelId !== identity.levelId);
  orchard.visualOverrides.background = structuredClone(alternative.visualOverrides.background);
  const pack = (await preparePack(custom, { decodeImage })).pack;
  const f = await fixture(t, { pack }),
    before = f.writes(),
    row = await f.orchard();
  assert.equal(await matchesReleasePictureBaseline(identity, f.background), false);
  const picture = await f.installed.select(row, { raceId: 9 });
  assert.equal(compact(picture).sha256, sha(bytesFromData(f.background.dataUrl)));
  assert.notEqual(compact(picture).sha256, expected.release);
  assert.equal(f.reads(), 0, 'Changed custom background must never request a release substitute.');
  assert.deepEqual(f.writes(), before);
});

test('failed selected release for staged Next keeps accepted installed picture and writes nothing', async (t) => {
  const f = await fixture(t),
    before = f.writes(),
    row = await f.orchard(),
    accepted = await f.installed.select(row, { raceId: 10 });
  assert.deepEqual(compact(accepted), releaseSummary);
  f.failReads();
  await assert.rejects(f.installed.stage(row, { raceId: 11 }), /selected release download failure/);
  assert.equal(f.installed.current(), accepted);
  assert.equal(accepted.image.released, 0);
  assert.equal(await f.installed.confirm(row, { raceId: 10 }), accepted);
  assert.deepEqual(f.writes(), before);
});

test('saved still assignment wins without release download and stale generation blocks Start', async (t) => {
  const f = await fixture(t);
  await f.solo.ensure();
  const saved = await f.store.read();
  const presentation = saved.document.library.presentations[0];
  const assigned = {
    ...saved.document.library,
    assignments: [{ identity, presentationId: presentation.id, revision: presentation.revision }],
  };
  await f.store.commit(
    await f.store.prepare(assigned, saved.assets, {
      previous: saved.document,
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: saved.generation },
  );
  const before = f.writes(),
    reads = f.reads(),
    row = await f.orchard();
  f.failReads();
  const picture = await f.installed.select(row, { raceId: 15 });
  assert.deepEqual(compact(picture), releaseSummary);
  assert.equal(picture.choice.kind, 'still');
  assert.equal(f.reads(), reads, 'An explicit assignment does not download a new default.');
  assert.equal(await f.installed.confirm(row, { raceId: 15 }), picture);
  assert.deepEqual(f.writes(), before);
  const current = await f.store.read();
  await f.store.commit(
    await f.store.prepare(current.document.library, current.assets, {
      previous: current.document,
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: current.generation },
  );
  const afterOtherWriter = f.writes();
  await assert.rejects(f.installed.confirm(row, { raceId: 15 }), /changed|generation/i);
  assert.equal(f.installed.current(), picture, 'Stale Start does not discard the held picture.');
  assert.equal(picture.image.released, 0);
  assert.deepEqual(f.writes(), afterOtherWriter);
});

test('cancelled installed release stage retains the accepted image and its usable Start confirmation', async (t) => {
  const f = await fixture(t),
    before = f.writes(),
    row = await f.orchard(),
    accepted = await f.installed.select(row, { raceId: 20 });
  assert.deepEqual(compact(accepted), releaseSummary);
  let finish, entered;
  const started = new Promise((resolve) => (entered = resolve));
  const gate = new Promise((resolve) => (finish = resolve));
  f.model.state.onDecode = async () => {
    entered();
    await gate;
  };
  const staging = f.installed.stage(row, { raceId: 21 });
  await started;
  f.installed.cancel();
  finish();
  f.model.state.onDecode = null;
  await assert.rejects(staging, { name: 'AbortError' });
  assert.equal(f.installed.current(), accepted);
  assert.equal(accepted.image.released, 0);
  assert.equal(await f.installed.confirm(row, { raceId: 20 }), accepted);
  assert.deepEqual(f.writes(), before);
  const retried = await f.installed.select(row, { raceId: 21 });
  assert.deepEqual(compact(retried), releaseSummary);
  assert.equal(retried.choice.kind, 'release');
  assert.deepEqual(retried.choice.identity, identity);
  assert.equal(retried.choice.sha256, expected.release);
  assert.equal(await f.installed.confirm(row, { raceId: 21 }), retried);
  assert.equal(accepted.image.released, 1, 'Explicit Retry can retire the prior accepted image.');
  assert.deepEqual(f.writes(), before);
});

test('same-race Retry after release read failure keeps its captured release instead of reverting to embedded art', async (t) => {
  const f = await fixture(t),
    before = f.writes(),
    row = await f.orchard();
  f.failReads();
  await assert.rejects(
    f.installed.select(row, { raceId: 30 }),
    /selected release download failure/,
  );
  assert.equal(f.installed.current(), null);
  f.allowReads();
  const retried = await f.installed.select(row, { raceId: 30 });
  assert.deepEqual(compact(retried), releaseSummary);
  assert.equal(await f.installed.confirm(row, { raceId: 30 }), retried);
  assert.deepEqual(f.writes(), before);
});

test('Retry of accepted embedded Results after cancelled Next keeps its captured metadata fence', async (t) => {
  const f = await fixture(t);
  await f.solo.ensure();
  const row = await f.orchard(),
    accepted = await f.installed.select(row, { raceId: 60 }),
    successor = await f.installed.stage(row, { raceId: 61 });
  successor.cancel();
  assert.equal(f.installed.current(), accepted);
  assert.equal(await f.installed.confirm(row, { raceId: 60 }), accepted);
  const saved = await f.store.read();
  await f.store.commit(
    await f.store.prepare(saved.document.library, saved.assets, {
      previous: saved.document,
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: saved.generation },
  );
  const before = f.writes();
  await assert.rejects(
    f.installed.select(row, { raceId: 60 }),
    /Saved picture choices changed/,
    'Retry must preserve the accepted owner and its existing stale-metadata rejection, not create a fresh reader.',
  );
  assert.equal(accepted.image.released, 1);
  assert.equal(successor.picture.image.released, 1);
  assert.equal(f.installed.current(), null);
  assert.deepEqual(f.writes(), before);
});

test('successful embedded release stage keeps prior ownership until explicit retirement and releases each image once', async (t) => {
  const f = await fixture(t),
    before = f.writes(),
    row = await f.orchard(),
    prior = await f.installed.select(row, { raceId: 40 });
  const stage = await f.installed.stage(row, { raceId: 41 });
  const next = stage.picture;
  assert.deepEqual(compact(prior), releaseSummary);
  assert.deepEqual(compact(next), releaseSummary);
  assert.notEqual(next.image, prior.image);
  assert.equal(f.installed.current(), prior, 'Preparation cannot publish a candidate.');
  assert.equal(prior.image.released, 0);
  assert.equal(next.image.released, 0);
  await stage.confirm();
  assert.equal(f.installed.current(), prior, 'Confirmation alone cannot retire Results.');
  assert.equal(prior.image.released, 0);
  const retire = stage.commit();
  assert.equal(f.installed.current(), next);
  assert.equal(await f.installed.confirm(row, { raceId: 41 }), next);
  assert.equal(prior.image.released, 0, 'Commit publishes before explicit prior cleanup.');
  assert.equal(next.image.released, 0);
  retire();
  retire();
  assert.equal(prior.image.released, 1);
  assert.equal(next.image.released, 0);
  stage.cancel();
  assert.equal(next.image.released, 0, 'A committed stage is owned by the installed reader.');
  f.installed.dispose();
  f.installed.dispose();
  retire();
  assert.equal(prior.image.released, 1);
  assert.equal(next.image.released, 1);
  assert.equal(f.borrowed.released, 0, 'Separate static chapter ownership stays untouched.');
  assert.equal(f.model.urls.size, 0);
  assert.ok(
    f.model.images.filter((image) => image !== f.borrowed).every((image) => image.released === 1),
    'Inspection originals, embedded fallback leases and release images each retire once.',
  );
  assert.deepEqual(f.writes(), before);
});

// Exercise the actual Couch host and property handlers with the existing finite
// DOM, image and painter boundary; this is not native rendering/input evidence.
async function installedHost(t, { onRead } = {}) {
  const f = await fixture(t),
    before = f.writes();
  f.installed.dispose();
  const signalChoice = releasePictureForIdentity(runtime, {
    baseCampaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-01',
    levelRevision: '1',
    themeId: 'fpv',
  });
  assert.ok(signalChoice);
  const signalBytes = await readFile(
    new URL(
      `../presentation/compiled/assets/${signalChoice.asset.file.sha256}.png`,
      import.meta.url,
    ),
  );
  assert.equal(sha(signalBytes), signalChoice.asset.file.sha256);
  assert.equal(signalBytes.length, signalChoice.asset.file.bytes);
  const originals = new Map([
    [signalChoice.slotId, { asset: signalChoice.asset, bytes: signalBytes }],
    [releaseChoice.slotId, { asset: releaseChoice.asset, bytes: releaseBytes }],
  ]);
  const snapshot = { resolved: runtime.resolved, images: new Map(), canvas: {} },
    reads = [];
  let lease,
    packRequests = 0;
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: f.model.ImageClass,
    URLImpl: f.model.URLImpl,
    assetDatabase: f.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    fetchResponse(path) {
      if (path === '../content/packs/fpv-arcade-r5.json') {
        packRequests++;
        return { ok: false, status: 404 };
      }
    },
    beforeImport({ document, window }) {
      lease = mountPresentationPage({
        document,
        window,
        createHost: () => ({
          async load() {
            return snapshot;
          },
          apply() {},
          close() {},
          async readPicture(slot, options) {
            assert.equal(options.snapshot, snapshot);
            const original = originals.get(slot);
            assert.ok(original, `Only finite committed release originals may be read: ${slot}`);
            reads.push(slot);
            await onRead?.({ slot, options });
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
  const action = async (element, type = 'click') => {
    const handler = element[`on${type}`];
    assert.equal(typeof handler, 'function');
    let pending;
    element[`on${type}`] = (...args) => (pending = handler(...args));
    try {
      element.emit(type);
      await pending;
    } finally {
      element[`on${type}`] = handler;
    }
  };
  assert.equal(packRequests, 1);
  assert.equal(page.renders[0].level.id, 'signal-01');
  assert.equal(sha(page.drawOptions[0].backdrop.image.bytes), signalChoice.asset.file.sha256);
  const choice = page
    .$('race-level')
    .options.find(
      (option) =>
        option.value.startsWith('installed/') && option.value.endsWith('/orchard-crossing'),
    );
  assert.ok(choice, 'The real installed catalogue must expose Orchard Crossing.');
  page.$('race-focus').click();
  page.$('race-level').value = choice.value;
  await action(page.$('race-level'), 'change');
  await waitFor(() => !page.$('race-start').disabled, {
    timeoutMs: 45000,
    message: 'Installed Orchard release art did not become ready through the real host.',
  });
  page.$('race-setup-back').click();
  page.frame(0);
  const picture = page.drawOptions[0].backdrop;
  assert.equal(picture, page.drawOptions[1].backdrop);
  assert.deepEqual(compact(picture), releaseSummary);
  assert.deepEqual(picture.choice.identity, identity);
  assert.equal(picture.choice.kind, 'release');
  assert.deepEqual(reads, [signalChoice.slotId, releaseChoice.slotId]);
  for (const run of page.renders) {
    assert.equal(run.level.id, 'orchard-crossing');
    assert.equal(run.tick, 0, 'Map selection cannot start either player.');
  }
  assert.equal(page.state(), 'ready');
  page.frames(4);
  assert.ok(page.renders.every((run) => run.tick === 0));
  return { f, page, action, before, picture, reads };
}

test('actual host uses approved installed Orchard art on both boards when the shipped R5 pack URL is unavailable', async (t) => {
  const { f, page, action, before, picture } = await installedHost(t);
  await action(page.$('race-start'));
  page.frame(0);
  assert.equal(page.state(), 'running', 'An explicit Start gesture begins the race.');
  assert.equal(page.drawOptions[0].backdrop, picture);
  assert.equal(page.drawOptions[1].backdrop, picture);
  assert.deepEqual(f.writes(), before);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(f.model.urls.size, 0);
  assert.deepEqual(f.writes(), before);
});

function installedResult(page) {
  return {
    runs: [...page.renders],
    checkpoints: page.checkpoint(),
    picture: page.drawOptions[0].backdrop,
    results: [0, 1].map((seat) => page.$(`race-result-${seat}`).textContent),
    wins: page.$('series-score').textContent,
  };
}
function assertInstalledResult(page, before) {
  assert.equal(page.state(), 'finished');
  assert.ok(page.renders.every((run, seat) => run === before.runs[seat]));
  assert.deepEqual(page.checkpoint(), before.checkpoints);
  assert.equal(page.drawOptions[0].backdrop, before.picture);
  assert.equal(page.drawOptions[1].backdrop, before.picture);
  assert.deepEqual(compact(before.picture), releaseSummary);
  assert.deepEqual(
    [0, 1].map((seat) => page.$(`race-result-${seat}`).textContent),
    before.results,
  );
  assert.equal(page.$('series-score').textContent, before.wins);
  assert.equal(before.picture.image.released, 0);
}
async function finishInstalledRound(host) {
  const { page, action } = host;
  await action(page.$('race-start'));
  page.frame(0);
  assert.equal(page.state(), 'running');
  // Actual legal neutral frames reach the authored 30-second round timeout.
  // No winner, run, timer, checkpoint, or score is assigned by the test.
  page.frames(151, 200);
  assert.equal(page.state(), 'finished');
  assert.match(page.$('race-message').textContent, /Draw.*Time/);
  assert.equal(page.$('series-score').textContent, '0 : 0');
  return installedResult(page);
}
function holdInstalledDecode(t, f) {
  let resolve,
    entered = false;
  const gate = new Promise((yes) => {
    resolve = yes;
  });
  t.after(resolve);
  // Only the first chosen release decode is held. Embedded verification images
  // and later explicit setup preparations continue through their real paths.
  f.model.state.onDecode = async (image) => {
    if (entered || sha(image.bytes) !== expected.release) return;
    entered = true;
    await gate;
  };
  return { entered: () => entered, resolve };
}
function beginInstalledRematch(host) {
  const { page, action } = host;
  page.$('race-start').focus();
  // Capture errors immediately while the deliberately pending decoder unwinds.
  return action(page.$('race-start')).then(
    () => ({ error: null }),
    (error) => ({ error }),
  );
}

for (const format of ['single', 'first-to-two'])
  test(`installed ${format} Results need one deliberate continuation action to prepare, confirm and start both boards`, async (t) => {
    const host = await installedHost(t),
      { f, page, action, before } = host;
    assert.equal(page.$('race-format').value, 'single', 'One race is the cold default.');
    if (format !== 'single') {
      page.$('race-focus').click();
      page.$('race-format').value = format;
      await action(page.$('race-format'), 'change');
      await waitFor(() => !page.$('race-start').disabled);
      page.$('race-setup-back').click();
      page.frame(0);
    }
    const result = await finishInstalledRound(host);
    assert.match(
      page.$('race-start').textContent,
      format === 'single' ? /^Rematch: Orchard Crossing/ : /^Next round: Orchard Crossing/,
    );
    const held = holdInstalledDecode(t, f);
    // Touch can activate a button without a preceding native focus change.
    // The admitted click must establish and revalidate its own action lease.
    page.doc.body.focus();
    const pending = action(page.$('race-start')).then(
      () => ({ error: null }),
      (error) => ({ error }),
    );
    await waitFor(held.entered, { timeoutMs: 45000 });
    page.frame(0);
    assertInstalledResult(page, result);
    assert.equal(page.doc.activeElement.id, 'race-picture-cancel');
    held.resolve();
    assert.equal((await pending).error, null);
    page.frame(0);
    assert.equal(page.state(), 'running', 'The same deliberate action starts the prepared race.');
    assert.ok(page.renders.every((run, seat) => run !== result.runs[seat] && run.tick === 0));
    const next = page.drawOptions[0].backdrop;
    assert.equal(next, page.drawOptions[1].backdrop);
    assert.deepEqual(compact(next), releaseSummary);
    assert.deepEqual(next.choice.identity, identity);
    assert.notEqual(next.image, result.picture.image);
    assert.equal(result.picture.image.released, 1);
    assert.equal(next.image.released, 0);
    assert.equal(page.$('race-format').value, format);
    assert.equal(page.$('series-score').textContent, '0 : 0');
    assert.deepEqual(f.writes(), before);
    // Neutral tied rounds qualify installed continuation, not two earned wins.
  });

for (const interruption of ['hidden', 'blur', 'newer focus', 'Back', 'Settings', 'Cancel'])
  test(`installed rematch respects ${interruption} while its selected picture is pending`, async (t) => {
    const host = await installedHost(t),
      { f, page, action, before } = host,
      result = await finishInstalledRound(host),
      held = holdInstalledDecode(t, f);
    const pending = beginInstalledRematch(host);
    await waitFor(held.entered, { timeoutMs: 45000 });
    assertInstalledResult(page, result);
    if (interruption === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
      page.doc.body.focus();
      page.frame(0);
    } else if (interruption === 'blur') {
      page.doc.focused = false;
      page.win.emit('blur');
      page.doc.focused = true;
      page.doc.body.focus();
      page.frame(0);
    } else if (interruption === 'newer focus') {
      page.$('race-help').focus();
      page.doc.body.focus();
    } else if (interruption === 'Back') {
      page.key('Escape', true, page.doc.activeElement);
      page.key('Escape', false, page.doc.activeElement);
    } else if (interruption === 'Settings') page.$('race-options').click();
    else {
      page.$('race-picture-cancel').focus();
      page.$('race-picture-cancel').click();
    }
    const focus = page.doc.activeElement;
    held.resolve();
    assert.equal((await pending).error, null);
    page.frame(0);
    assert.equal(
      page.doc.activeElement === focus,
      true,
      'Completion cannot retake a newer focus owner.',
    );
    if (['Back', 'Settings', 'Cancel'].includes(interruption)) {
      assertInstalledResult(page, result);
      if (interruption === 'Settings') {
        assert.equal(page.doc.body.dataset.couchScreen, 'options');
        page.$('race-options-back').click();
      }
      page.$('race-start').focus();
      await action(page.$('race-start'));
      page.frame(0);
      assert.equal(page.state(), 'running', 'A new deliberate continuation can succeed.');
      assert.equal(result.picture.image.released, 1);
    } else {
      assert.equal(page.state(), 'ready', 'Lost intent permits preparation, never automatic play.');
      assert.ok(page.renders.every((run, seat) => run !== result.runs[seat] && run.tick === 0));
      page.frames(20);
      assert.ok(page.renders.every((run) => run.tick === 0));
      assert.equal(result.picture.image.released, 1);
      await action(page.$('race-start'));
      page.frame(0);
      assert.equal(page.state(), 'running', 'A fresh Start owns the ready round.');
    }
    assert.equal(page.drawOptions[0].backdrop, page.drawOptions[1].backdrop);
    assert.deepEqual(compact(page.drawOptions[0].backdrop), releaseSummary);
    assert.deepEqual(f.writes(), before);
  });

for (const failure of ['read', 'decode'])
  test(`installed rematch ${failure} failure retains exact Results and permits a fresh deliberate retry`, async (t) => {
    let refuse = false;
    const injected = new Error(`Controlled installed rematch ${failure} refusal.`),
      diagnostics = [];
    t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
    const host = await installedHost(t, {
      onRead({ slot }) {
        if (refuse && failure === 'read' && slot === releaseChoice.slotId) throw injected;
      },
    });
    const { f, page, action, before } = host,
      result = await finishInstalledRound(host);
    f.model.state.onDecode = async (image) => {
      if (refuse && failure === 'decode' && sha(image.bytes) === expected.release) throw injected;
    };
    refuse = true;
    page.$('race-start').focus();
    await action(page.$('race-start'));
    page.frame(0);
    assertInstalledResult(page, result);
    assert.match(page.$('race-message').textContent, /Both boards are kept/i);
    assert.equal(page.doc.activeElement.id, 'race-start');
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][0], 'Next picture preparation failed.');
    assert.equal(diagnostics[0][1], injected);
    page.frames(20);
    assertInstalledResult(page, result);
    refuse = false;
    await action(page.$('race-start'));
    page.frame(0);
    assert.equal(page.state(), 'running');
    assert.equal(page.drawOptions[0].backdrop, page.drawOptions[1].backdrop);
    assert.deepEqual(compact(page.drawOptions[0].backdrop), releaseSummary);
    assert.equal(result.picture.image.released, 1);
    assert.deepEqual(f.writes(), before);
  });

test('installed rematch refuses media metadata changed during its selected decode without replacing Results', async (t) => {
  const diagnostics = [];
  t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
  const host = await installedHost(t),
    { f, page } = host,
    result = await finishInstalledRound(host),
    held = holdInstalledDecode(t, f);
  const pending = beginInstalledRematch(host);
  await waitFor(held.entered, { timeoutMs: 45000 });
  assertInstalledResult(page, result);
  const saved = await f.store.read();
  await f.store.commit(
    await f.store.prepare(saved.document.library, saved.assets, {
      previous: saved.document,
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: saved.generation },
  );
  const afterOtherWriter = f.writes();
  held.resolve();
  assert.equal((await pending).error, null);
  page.frame(0);
  assertInstalledResult(page, result);
  assert.match(page.$('race-message').textContent, /Both boards are kept/i);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0][1].message, /changed|generation/i);
  page.frames(20);
  assertInstalledResult(page, result);
  assert.deepEqual(f.writes(), afterOtherWriter, 'Only the deliberate other-writer commit writes.');
});

test('a confirmed new installed setup owns its generation after the cancelled rematch decode settles late', async (t) => {
  const host = await installedHost(t),
    { f, page, before } = host,
    result = await finishInstalledRound(host),
    held = holdInstalledDecode(t, f);
  const pending = beginInstalledRematch(host);
  await waitFor(held.entered, { timeoutMs: 45000 });
  page.$('race-focus').click();
  assert.equal(page.doc.body.dataset.couchScreen, 'confirm');
  assertInstalledResult(page, result);
  page.$('race-confirm-reset').click();
  await waitFor(() => !page.$('race-start').disabled, { timeoutMs: 45000 });
  page.frame(0);
  assert.equal(page.doc.body.dataset.couchScreen, 'setup');
  assert.equal(page.state(), 'ready');
  assert.ok(page.renders.every((run, seat) => run !== result.runs[seat] && run.tick === 0));
  const current = {
    runs: [...page.renders],
    checkpoints: page.checkpoint(),
    picture: page.drawOptions[0].backdrop,
    focus: page.doc.activeElement,
  };
  assert.deepEqual(compact(current.picture), releaseSummary);
  assert.equal(result.picture.image.released, 1, 'Only confirmed new setup may discard Results.');
  held.resolve();
  assert.equal((await pending).error, null);
  page.frames(10);
  assert.equal(page.state(), 'ready');
  assert.equal(page.doc.body.dataset.couchScreen, 'setup');
  assert.ok(page.renders.every((run, seat) => run === current.runs[seat]));
  assert.deepEqual(page.checkpoint(), current.checkpoints);
  assert.equal(page.drawOptions[0].backdrop, current.picture);
  assert.equal(page.drawOptions[1].backdrop, current.picture);
  assert.equal(page.doc.activeElement === current.focus, true);
  assert.equal(current.picture.image.released, 0);
  assert.deepEqual(f.writes(), before);
});
