import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { SOURCE_EXTERNAL_CHAPTER } from '../external-chapter-source.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { loadLibrary } from '../library.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStillAuthoringCatalog } from '../ui/still-media-catalog.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { emptyPackLibrary, exportPackLibrary } from '../packs.mjs';
import { FORMATS, TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { COMPILED_PRESENTATION_FORMAT } from '../presentation/host.mjs';
const pilot = await buildExternalPilot();
function releasePictureManifest() {
  const assets = {},
    bindings = {},
    urls = {};
  pilot.descriptor.originals.forEach((original, index) => {
    const source = pilot.descriptor.originals[(index + 1) % pilot.descriptor.originals.length],
      slot = CURRENT_PICTURES.find(
        (row) =>
          row.owner.baseCampaignKey === pilot.descriptor.campaignKey &&
          row.owner.levelId === original.levelId &&
          row.owner.themeId === 'fpv',
      );
    assert.ok(slot);
    const asset = {
      format: FORMATS.asset,
      id: `fixture.release.poster-${index}`,
      revision: 1,
      kind: 'image',
      description: 'Distinct authenticated source PNG used only as a new-release adapter fixture.',
      provenance: {
        creator: 'Test fixture',
        source: 'Swapped fixture poster; no production art claim.',
        license: 'Test only',
        prompt: '',
        parent: null,
      },
      file: Object.fromEntries(
        ['sha256', 'bytes', 'mime', 'width', 'height'].map((key) => [key, source[key]]),
      ),
      geometry: {
        frame: { x: 0, y: 0, width: source.width, height: source.height },
        pivot: { x: 0.5, y: 0.5 },
        occupiedBounds: null,
        rotorAnchors: [],
        nineSlice: null,
      },
      recipe: null,
      quality: { stage: 'produced', evidence: [] },
    };
    assets[slot.id] = asset;
    bindings[slot.id] = { id: asset.id, revision: 1 };
    urls[source.sha256] = `./assets/${source.sha256}.png`;
  });
  return {
    format: COMPILED_PRESENTATION_FORMAT,
    source: { id: 'test.release', revision: 1 },
    resolved: {
      theme: { id: 'fpv-field-kit', revision: 1, name: 'Field Kit fixture' },
      collection: null,
      tokens: TOKEN_DEFAULTS,
      bindings,
      assets,
    },
    urls,
  };
}
const profile = 'revealline.library.dev.v1',
  packsKey = 'revealline.packs.dev.v1';
const routes = JSON.parse(
  await readFile(
    new URL('../../authoring/library/four-worlds-chapters/routes.json', import.meta.url),
  ),
).routes;
const route = routes.find(
  (r) => r.packId === pilot.prior.id && r.difficulty === 'standard' && r.turnPolicy === 'immediate',
);
const PICTURE_READY_TIMEOUT_MS = 30000;
const settle = (predicate, message = 'Native source host should finish its bounded operation.') =>
  waitFor(predicate, { timeoutMs: PICTURE_READY_TIMEOUT_MS, message });
// Retained-original verification is bulk work; join the actual action before checking readiness.
// This test allowance does not change any runtime deadline or storage lease.
const INVENTORY_TIMEOUT_MS = 180000;
const CANCEL_JOIN_TIMEOUT_MS = 15000;
function sourceDiagnostic(p, phase) {
  return JSON.stringify({
    phase,
    status: p.$('optional-worlds-status')?.textContent,
    reloadDisabled: p.$('optional-worlds-reload')?.disabled,
    sourceState: p.$('optional-worlds-source-state')?.textContent,
    chooseDisabled: p.$('optional-worlds-source-choose')?.disabled,
    errors: p.errors.map((error) => String(error?.stack ?? error)),
  });
}
function clickOperation(p, control) {
  const button = p.$(control),
    original = button.onclick;
  assert.equal(button.disabled, false, `${control} must be enabled`);
  let operation;
  button.onclick = function (...args) {
    operation = original.apply(this, args);
    return operation;
  };
  try {
    button.click();
  } finally {
    button.onclick = original;
  }
  assert.equal(typeof operation?.then, 'function', `${control} must expose its action promise`);
  return operation;
}
async function waitSource(
  p,
  phase,
  {
    operation,
    ready = () => !p.$('optional-worlds-reload').disabled,
    timeoutMs = INVENTORY_TIMEOUT_MS,
    cancelJoinTimeoutMs = CANCEL_JOIN_TIMEOUT_MS,
  } = {},
) {
  let completed = !operation,
    rejected = false,
    failure;
  operation?.then(
    () => {
      completed = true;
    },
    (error) => {
      completed = rejected = true;
      failure = error;
    },
  );
  try {
    await waitFor(() => completed && (operation || ready()), { timeoutMs, message: phase });
    if (rejected) throw failure;
    // A fulfilled panel handler can still report a refused installation.
    assert.ok(ready(), `Completed action is not ready: ${sourceDiagnostic(p, phase)}`);
  } catch (error) {
    const beforeCancel = sourceDiagnostic(p, phase);
    let cleanup = 'No pending action to cancel.';
    if (!completed || (!operation && p.$('optional-worlds-reload')?.disabled)) {
      const cancel = p.$('optional-worlds-cancel');
      if (p.$('optional-worlds-dialog')?.open && cancel && !cancel.hidden) {
        cancel.click();
        cleanup = 'Actual panel Cancel requested.';
      }
      if (operation) {
        try {
          await waitFor(() => completed, { timeoutMs: cancelJoinTimeoutMs });
          cleanup += ' Action promise settled after cancellation.';
        } catch {
          cleanup += ' Action promise did not settle within the cleanup allowance.';
        }
      } else {
        // The shell's open callback exposes no promise. Its native Cancel path
        // still aborts the panel; this cannot claim all async unwind has joined.
        cleanup += ' Shell open exposes no promise to join.';
      }
    }
    assert.fail(`${phase}: ${error?.message ?? error}\n${beforeCancel}\n${cleanup}`);
  }
}
class Locks {
  held = new Set();
  async request(name, options, callback) {
    const fn = callback ?? options;
    if (this.held.has(name)) return fn(null);
    this.held.add(name);
    try {
      return await fn({ name });
    } finally {
      this.held.delete(name);
    }
  }
}
class Picture {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.url = value;
    if (value) queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this.url;
  }
  async decode() {}
  removeAttribute() {
    this.url = '';
  }
}
async function nativeAssets(memory) {
  const db = await new Promise((resolve, reject) => {
    const req = memory.indexedDB.open('revealline-assets-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('assets');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return {
    close: () => db.close(),
    put: (key, value) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(value, key);
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      }),
    read: (key) =>
      new Promise((resolve, reject) => {
        const req = db.transaction('assets').objectStore('assets').get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      }),
  };
}
async function page(t, f = {}) {
  f.assets ??= managedIndexedDB();
  f.media ??= managedIndexedDB();
  f.storage ??= memoryStorage();
  f.locks ??= new Locks();
  const p = await soloPage(t, {
    assetIndexedDB: f.assets.indexedDB,
    soundtrackIndexedDB: f.media.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    pictures: { Image: Picture },
    initialReadyTimeoutMs: PICTURE_READY_TIMEOUT_MS,
    ...f.options,
  });
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (url, options) =>
    String(url).includes('optional-worlds.json')
      ? new Response(await readFile(new URL('../content/optional-worlds.json', import.meta.url)))
      : fetchBefore(url, options);
  t.after(() => {
    globalThis.fetch = fetchBefore;
  });
  return Object.assign(p, { fixture: f });
}
async function worlds(p) {
  p.$('shell-menu').click();
  p.$('shell-worlds').click();
  await waitSource(p, 'Open More worlds and authenticate installed originals', {
    ready: () => !!p.$('optional-worlds-source-install') && !p.$('optional-worlds-reload').disabled,
  });
}
async function install(p) {
  await worlds(p);
  p.$('optional-worlds-source-pack').files = [pilot.payloads.pack];
  p.$('optional-worlds-source-media').files = [pilot.payloads.media];
  await waitSource(p, `Install and authenticate exact ${pilot.descriptor.id}`, {
    operation: clickOperation(p, 'optional-worlds-source-install'),
    ready: () =>
      !p.$('optional-worlds-reload').disabled && !p.$('optional-worlds-source-choose').disabled,
  });
  assert.equal(
    p.$('optional-worlds-source-choose').disabled,
    false,
    p.$('optional-worlds-status').textContent + p.$('optional-worlds-source-state').textContent,
  );
}
async function choose(p) {
  const phase = `Choose and authenticate exact ${pilot.descriptor.id}`;
  await waitSource(p, phase, {
    operation: clickOperation(p, 'optional-worlds-source-choose'),
    ready: () => !p.$('optional-worlds-dialog').open,
  });
  // Selection starts its own picture read; a fulfilled Choose is not image readiness.
  try {
    await settle(() => p.doc.body.dataset.pictureState === 'ready');
  } catch (error) {
    assert.fail(
      `${phase}: picture did not become ready: ${error.message}\n${sourceDiagnostic(p, phase)}\n${JSON.stringify({ pack: p.$('pack-select').value, pictureState: p.doc.body.dataset.pictureState })}`,
    );
  }
  p.frame(0);
  assert.equal(p.$('pack-select').value, pilot.descriptor.id);
}
function ticks(p, count) {
  for (let i = 0; i < count; i++) p.frame();
}
function direction(p, value) {
  if (value) {
    p.key('Arrow' + value[0].toUpperCase() + value.slice(1));
    p.key('Arrow' + value[0].toUpperCase() + value.slice(1), false);
  }
}

test('fresh native source installation assigns release pictures after durable install and retains every authored original', async (t) => {
  const requests = [],
    manifest = releasePictureManifest();
  const p = await page(t, {
    options: {
      fetchResponse: async (url) => {
        if (!String(url).includes('/presentation/compiled/')) return undefined;
        requests.push(String(url));
        if (String(url).endsWith('/runtime.json')) return new Response(JSON.stringify(manifest));
        assert.fail('Existing authenticated fixture bytes must be reused rather than downloaded.');
      },
    },
  });
  await install(p);
  const manager = createManagedMediaStore({
      indexedDB: p.fixture.media.indexedDB,
      storyMedia: true,
    }),
    still = createStillMediaStore({ managedStore: manager });
  t.after(() => {
    still.close();
    manager.close();
  });
  const saved = await still.readMetadata();
  for (const [index, original] of pilot.descriptor.originals.entries()) {
    const assignment = saved.document.library.assignments.find(
      (row) => row.identity.levelId === original.levelId,
    );
    assert.match(assignment.presentationId, /^fk-picture-/);
    const chosen = saved.document.library.presentations.find(
        (row) => row.id === assignment.presentationId,
      ),
      asset = saved.document.library.assets.find((row) => row.id === chosen.poster.assetId);
    assert.equal(asset.sha256, pilot.descriptor.originals[(index + 1) % 3].sha256);
    assert.ok(
      saved.document.library.presentations.some((row) => row.id === original.presentationId),
    );
    assert.ok(
      saved.document.library.assets.some(
        (row) => row.id === original.assetId && row.sha256 === original.sha256,
      ),
    );
  }
  await choose(p);
  assert.equal(p.rendered.backdrop.pin.sha256, pilot.descriptor.originals[1].sha256);
  assert.match(p.rendered.backdrop.pin.presentationId, /^fk-picture-/);
  assert.deepEqual(requests, ['http://localhost/game/presentation/compiled/runtime.json']);
});

test('source registry is exact compiled authority; public catalog remains five unchanged embedded entries', async () => {
  assert.deepEqual(SOURCE_EXTERNAL_CHAPTER, pilot.descriptor);
  const catalog = JSON.parse(
    await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
  );
  assert.equal(catalog.packs.length, 5);
  assert.equal(
    catalog.packs.some((p) => p.id === pilot.descriptor.id),
    false,
  );
});

test('native pair install preserves an unfinished unrelated flight, then separate Choose and legal route earn the exact original once', async (t) => {
  const p = await page(t);
  p.$('start-button').click();
  direction(p, 'down');
  ticks(p, 13);
  const run = p.rendered.run,
    before = authoritativeCheckpoint(run);
  await install(p);
  p.frame(0);
  assert.equal(p.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.equal(p.rendered.paused, true);
  assert.equal(p.$('pack-select').value, '');
  await choose(p);
  assert.equal(p.rendered.run.tick, 0);
  assert.equal(p.rendered.paused, true);
  assert.equal(p.rendered.backdrop.pin.sha256, pilot.descriptor.originals[0].sha256);
  p.$('start-button').click();
  for (const segment of route.segments) {
    direction(p, segment.input.direction);
    ticks(p, segment.ticks);
  }
  p.frame(0);
  assert.equal(p.rendered.run.status, 'won');
  const library = loadLibrary(p.storage, profile).library;
  assert.equal(library.pictureReceipts.length, 1);
  assert.equal(
    library.pictureReceipts[0].presentationPin.sha256,
    pilot.descriptor.originals[0].sha256,
  );
  assert.equal(library.storyReceipts[0].storyPin, null);
  const saved = p.storage.getItem(profile);
  p.frame();
  p.frame();
  assert.equal(p.storage.getItem(profile), saved);
  assert.deepEqual(p.errors, []);
});

test('stored external run reloads with exact saved pin and remains paused until explicit Resume', async (t) => {
  const f = {};
  let checkpoint, pin;
  await t.test('native install, select and pause', async (t) => {
    const p = await page(t, f);
    await install(p);
    await choose(p);
    p.$('start-button').click();
    direction(p, 'down');
    ticks(p, 151);
    p.$('pause-button').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    pin = p.rendered.backdrop.pin;
    assert(f.storage.getItem('revealline.suspended.dev.v1'));
  });
  await t.test('fresh app import restores the saved flight', async (t) => {
    const p = await page(t, f);
    await p.$('continue-saved').onclick();
    await settle(
      () =>
        p.$('pack-select').value === pilot.descriptor.id &&
        p.doc.body.dataset.pictureState === 'ready',
    );
    p.frame(0);
    assert.equal(p.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.deepEqual(p.rendered.backdrop.pin, pin);
    ticks(p, 10);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    p.$('start-button').click();
    ticks(p, 10);
    assert(p.rendered.run.tick > checkpoint.tick || p.rendered.run.tick > 151);
    assert.deepEqual(p.errors, []);
  });
});

for (const journals of [
  ['external-chapter-journal.v1'],
  ['external-chapter-journal.v1', 'backup-journal'],
])
  test(`startup preserves and refuses ${journals.join(' + ')} before any backup recovery`, async (t) => {
    const f = { assets: managedIndexedDB(), storage: memoryStorage() };
    const assets = await nativeAssets(f.assets);
    t.after(() => assets.close());
    for (const suffix of journals) await assets.put(`${profile}.${suffix}`, { retained: suffix });
    const before = f.assets.allPuts.length;
    const p = await page(t, f);
    assert.match(p.$('save-warning').textContent, /external-recovery|mixed-journals/);
    assert.equal(f.assets.allPuts.length, before);
    for (const suffix of journals)
      assert.deepEqual(await assets.read(`${profile}.${suffix}`), { retained: suffix });
    p.$('start-button').click();
    direction(p, 'down');
    ticks(p, 5);
    assert.equal(f.storage.getItem(profile), null);
  });

test('cleared assignment still selects descriptor original; missing original refuses both new flight and Original artwork without generic fallback', async (t) => {
  const p = await page(t);
  await install(p);
  await choose(p);
  const manager = createManagedMediaStore({
    indexedDB: p.fixture.media.indexedDB,
    storyMedia: true,
  });
  const decodeImage = async () => ({ naturalWidth: 1774, naturalHeight: 887 });
  const still = createStillMediaStore({ managedStore: manager, decodeImage });
  t.after(() => {
    still.close();
    manager.close();
  });
  const prior = await still.read();
  await still.commit(
    await still.prepare({ ...prior.document.library, assignments: [] }, prior.assets, {
      executionCatalog: pilot.prepared.executionCatalog,
    }),
    { expectedGeneration: prior.generation },
  );
  p.change('pack-select', '');
  await settle(() => !p.$('pack-select').disabled);
  p.change('pack-select', pilot.descriptor.id);
  await settle(() => !p.$('pack-select').disabled && p.doc.body.dataset.pictureState === 'ready');
  p.frame(0);
  assert.equal(p.rendered.backdrop.pin.sha256, pilot.descriptor.originals[0].sha256);
  const request = p.fixture.media.indexedDB.open('revealline-soundtrack-v1', 4);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('mediaBlobs', 'readwrite');
    tx.objectStore('mediaBlobs').delete(pilot.descriptor.originals[0].sha256);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  p.change('pack-select', '');
  await settle(() => !p.$('pack-select').disabled);
  p.change('pack-select', pilot.descriptor.id);
  await settle(() => !p.$('picture-use-legacy').hidden);
  p.$('start-button').click();
  await settle(() => !p.$('picture-use-legacy').hidden);
  ticks(p, 10);
  assert.equal(p.rendered.run.tick, 0);
  assert.equal(p.rendered.paused, true);
  p.$('picture-use-legacy').click();
  await settle(() => !p.$('picture-use-legacy').hidden);
  ticks(p, 10);
  assert.equal(p.rendered.run.tick, 0);
  assert.equal(p.rendered.paused, true);
  assert.equal(p.rendered.backdrop, null);
  assert.match(p.$('run-message').textContent, /original|missing|unavailable/i);
});

test('ordinary native removal and pack-only export refuse indexed content without dropping pointer or index', async (t) => {
  const p = await page(t);
  await install(p);
  const before = p.fixture.assets.contents().get('assets');
  p.$('optional-worlds-manage').click();
  p.$('export-packs').click();
  await settle(() => /Pack-only export/.test(p.$('pack-status').textContent));
  assert.equal(p.$('pack-json').value || '', '');
  const remove = [...p.$('installed-packs').querySelectorAll('button')].find((b) =>
    /remove/i.test(b.textContent),
  );
  assert(remove, 'Use the actual installed pack Remove control.');
  remove.click();
  await settle(() => /kept|descriptor|External/.test(p.$('pack-status').textContent));
  assert.deepEqual(p.fixture.assets.contents().get('assets'), before);
});

test('Workshop authenticates the same pointer/index and holds both locks; stale index and pending journal cannot publish assignments', async (t) => {
  const assets = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks(),
    storage = memoryStorage();
  const manager = createManagedMediaStore({ indexedDB: media.indexedDB, storyMedia: true });
  const decodeImage = async () => ({ naturalWidth: 1774, naturalHeight: 887 });
  const host = createExternalChapterHost({
    indexedDB: assets.indexedDB,
    profileKey: profile,
    packsKey,
    storage,
    lockManager: locks,
    writer: { writable: true },
    getManagedStore: () => manager,
    registeredEntries: [],
    knownDescriptors: [pilot.descriptor],
    decodeImage,
  });
  const records = await nativeAssets(assets);
  t.after(() => {
    records.close();
    host.close();
    manager.close();
  });
  await host.install(pilot.prepared);
  const baseEntry = (await import('./helpers/media-fixtures.mjs')).mediaFixture(false).campaign;
  const catalog = createStillAuthoringCatalog({
    baseEntry: { campaign: baseEntry, themes: [{ id: 'fpv' }] },
    storage,
    readAsset: records.read,
    lockManager: locks,
    getManagedStore: () => manager,
    indexedDB: assets.indexedDB,
    decodeImage,
  });
  const snapshot = await catalog.read();
  let called = 0;
  await catalog.withCurrent(snapshot, () => {
    called++;
    assert.deepEqual(locks.held, new Set([`${profile}.writer`, `${profile}.backup-lock`]));
  });
  assert.equal(called, 1);
  await records.put(`${profile}.external-chapter-index.v1`, {
    format: 'revealline-external-chapter-index.v1',
    chapters: [],
  });
  await assert.rejects(catalog.withCurrent(snapshot, () => called++));
  assert.equal(called, 1);
  await records.put(`${profile}.external-chapter-journal.v1`, { interrupted: true });
  await assert.rejects(catalog.read(), /external-recovery/);
  assert.equal(called, 1);
});

test('guarded metadata work uses one backup lock, refuses a stale branded snapshot and remains lazy for ordinary packs', async (t) => {
  const assets = managedIndexedDB(),
    records = await nativeAssets(assets),
    locks = new Locks();
  let borrows = 0,
    calls = 0;
  const host = createExternalChapterHost({
    indexedDB: assets.indexedDB,
    profileKey: profile,
    packsKey,
    storage: memoryStorage(),
    lockManager: locks,
    writer: { writable: true },
    getManagedStore: () => {
      borrows++;
      throw new Error('Ordinary path must stay lazy');
    },
    registeredEntries: [],
    knownDescriptors: [pilot.descriptor],
  });
  t.after(() => {
    host.close();
    records.close();
  });
  const snapshot = await host.inspect();
  await host.withCurrent(snapshot, () => {
    calls++;
    assert(locks.held.has(`${profile}.backup-lock`));
  });
  await records.put(packsKey, exportPackLibrary(emptyPackLibrary()));
  await assert.rejects(
    host.withCurrent(snapshot, () => calls++),
    /snapshot changed/,
  );
  assert.equal(calls, 1);
  assert.equal(borrows, 0);
});

test('source install and unrelated chapter win preserve an earlier exact first-earned story A after binding B', async (t) => {
  const { createStoryFixture, inspectionEnvironment } = await import(
    './helpers/victory-story-fixture.mjs'
  );
  const { mediaFixture, libraryRecord, pngBytes } = await import('./helpers/media-fixtures.mjs');
  const { validateMediaLibrary } = await import('../media-library.mjs');
  const { createPresentationPins } = await import('../presentation-pins.mjs');
  const { createStoryMediaStore } = await import('../story-media-store.mjs');
  const source = createStoryFixture(),
    base = mediaFixture(false),
    raw = libraryRecord(base.identity);
  raw.assets = source.library.assets;
  const library = validateMediaLibrary(raw, { identityCatalog: base.identityCatalog });
  const pin = createPresentationPins({
    library,
    identityCatalog: base.identityCatalog,
    ...base.request(),
    themeIds: ['fpv'],
  }).choices[0];
  const f = { media: managedIndexedDB() };
  const manager = createManagedMediaStore({ indexedDB: f.media.indexedDB, storyMedia: true });
  const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
  const still = createStillMediaStore({ managedStore: manager, decodeImage });
  const story = createStoryMediaStore({ managedStore: manager, decodeImage });
  t.after(() => {
    story.close();
    still.close();
    manager.close();
  });
  await still.commit(
    await still.prepare(library, [{ sha256: pin.sha256, blob: new Blob([pngBytes()]) }], {
      executionCatalog: base.catalog,
    }),
    { expectedGeneration: 0 },
  );
  async function bind(revision) {
    const descriptor = { ...source.descriptor, picturePin: pin, revision };
    await story.commit(
      await story.stage({ descriptor, blob: source.blob }, inspectionEnvironment().options),
    );
    await story.commit(
      await story.stageBinding(
        { picturePin: pin, story: { id: descriptor.id, revision } },
        {
          expectedGeneration: (await story.readMetadata()).generation,
          ...inspectionEnvironment().options,
        },
      ),
    );
  }
  await bind(1);
  const urls = new Map(),
    createURL = URL.createObjectURL,
    revokeURL = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => {
    const url = createURL(blob);
    urls.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    urls.delete(url);
    revokeURL(url);
  };
  t.after(() => {
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
  });
  class FlexiblePicture extends Picture {
    async decode() {
      const blob = urls.get(this.url);
      if (blob) {
        const bytes = Buffer.from(await blob.arrayBuffer());
        this.width = this.naturalWidth = bytes.readUInt32BE(16);
        this.height = this.naturalHeight = bytes.readUInt32BE(20);
      }
    }
  }
  f.options = {
    campaign: { ...base.campaign, title: 'External coexistence story fixture' },
    pictures: { Image: FlexiblePicture },
  };
  const p = await page(t, f);
  p.$('start-button').click();
  direction(p, 'down');
  for (let n = 0; n < 1000 && p.rendered.run.status === 'running'; n++) p.frame();
  p.frame(0);
  assert.equal(p.rendered.run.status, 'won');
  const first = loadLibrary(p.storage, profile).library.storyReceipts[0];
  assert.equal(first.storyPin.revision, 1);
  await bind(2);
  const originals = await story.exportInventory();
  await install(p);
  await choose(p);
  p.$('start-button').click();
  for (const segment of route.segments) {
    direction(p, segment.input.direction);
    ticks(p, segment.ticks);
  }
  p.frame(0);
  assert.equal(p.rendered.run.status, 'won');
  const next = loadLibrary(p.storage, profile).library;
  assert.deepEqual(
    next.storyReceipts.find((r) => r.storyPin),
    first,
  );
  const after = await story.exportInventory();
  assert.deepEqual(after.document, originals.document);
  assert.deepEqual(
    Buffer.from(await after.assets[0].blob.arrayBuffer()),
    Buffer.from(await source.blob.arrayBuffer()),
  );
});

test('Back during exact media hashing cancels native pair install and late digest cannot publish or change the flight', async (t) => {
  const p = await page(t);
  await worlds(p);
  const run = p.rendered.run,
    before = authoritativeCheckpoint(run);
  const saved = new Map(p.storage.map),
    writes = p.fixture.assets.allPuts.length;
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  let entered = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  crypto.subtle.digest = async (algorithm, bytes) => {
    const result = await digest(algorithm, bytes);
    if (bytes.byteLength === pilot.descriptor.media.bytes) {
      entered = true;
      await gate;
    }
    return result;
  };
  t.after(() => {
    crypto.subtle.digest = digest;
    release();
  });
  p.$('optional-worlds-source-pack').files = [pilot.payloads.pack];
  p.$('optional-worlds-source-media').files = [pilot.payloads.media];
  const pending = p.$('optional-worlds-source-install').onclick();
  await settle(() => entered);
  p.$('optional-worlds-top-back').click();
  release();
  await pending;
  p.frame(0);
  assert.equal(p.$('optional-worlds-dialog').open, false);
  assert.equal(p.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(p.storage.map, saved);
  assert.equal(p.fixture.assets.allPuts.length, writes);
  assert.equal(p.$('pack-select').value, '');
  assert.deepEqual(p.errors, []);
});

test('native exact-pair recovery completes a retained published journal once; reload is required before adopting its preserved profile', async (t) => {
  const { createExternalChapterPointerStore } = await import('../external-chapter-pointer.mjs');
  const { createExternalChapterInstaller } = await import('../external-chapter-install.mjs');
  const { claimProfileWriter } = await import('../profile-writer.mjs');
  const f = {
    assets: managedIndexedDB(),
    media: managedIndexedDB(),
    locks: new Locks(),
    storage: memoryStorage(),
  };
  const manager = createManagedMediaStore({ indexedDB: f.media.indexedDB, storyMedia: true });
  const decodeImage = async () => ({ naturalWidth: 1774, naturalHeight: 887 });
  const still = createStillMediaStore({ managedStore: manager, decodeImage });
  const pointer = createExternalChapterPointerStore({
    indexedDB: f.assets.indexedDB,
    profileKey: profile,
    packsKey,
  });
  const writer = await claimProfileWriter(f.locks, `${profile}.writer`);
  let fail = true;
  const installer = createExternalChapterInstaller({
    pointerStore: {
      ...pointer,
      async compareAndSwap(before, next, options) {
        const result = await pointer.compareAndSwap(before, next, options);
        if (fail && next.journal?.phase === 'published') {
          fail = false;
          throw new Error('Modeled interruption after native publication');
        }
        return result;
      },
    },
    managedStore: manager,
    writer,
    lockManager: f.locks,
    storage: f.storage,
    registeredEntries: [],
    decodeImage,
  });
  await assert.rejects(installer.install(pilot.prepared), /Modeled interruption/);
  const generation = (await still.readMetadata()).generation;
  installer.close();
  pointer.close();
  writer.release();
  t.after(() => {
    still.close();
    manager.close();
  });
  await t.test(
    'explicit native recovery leaves existing generation and asks for reload',
    async (t) => {
      const p = await page(t, f);
      assert.match(p.$('save-warning').textContent, /external-recovery/);
      await install(p);
      assert.equal((await still.readMetadata()).generation, generation);
      p.$('optional-worlds-source-choose').click();
      await settle(() => /Reload after recovery/.test(p.$('optional-worlds-status').textContent));
      assert.equal(p.$('pack-select').value, '');
    },
  );
  await t.test(
    'new host coherently adopts recovered index and permits separate Choose',
    async (t) => {
      const p = await page(t, f);
      await worlds(p);
      await choose(p);
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.backdrop.pin.sha256, pilot.descriptor.originals[0].sha256);
      assert.equal((await still.readMetadata()).generation, generation);
    },
  );
});

test('published external pictures survive saved Continue and confirmed Restart with overlapping preparation', async (t) => {
  const manifest = releasePictureManifest(),
    f = {
      options: {
        fetchResponse: async (url) => {
          if (!String(url).includes('/presentation/compiled/')) return undefined;
          if (String(url).endsWith('/runtime.json')) return new Response(JSON.stringify(manifest));
          assert.fail('Retained original bytes are already installed.');
        },
      },
    };
  let pin;
  await t.test('install, play, pause and retain new release original', async (t) => {
    const p = await page(t, f);
    await install(p);
    await choose(p);
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    direction(p, 'down');
    ticks(p, 30);
    p.$('pause-button').click();
    p.frame(0);
    pin = p.rendered.backdrop.pin;
    assert.match(pin.presentationId, /^fk-picture-/);
    assert(f.storage.getItem('revealline.suspended.dev.v1'));
  });
  await t.test(
    'restored attempt resumes and the confirmed replacement attempt becomes ready',
    async (t) => {
      const p = await page(t, f);
      await p.$('continue-saved').onclick();
      await settle(() => p.doc.body.dataset.pictureState === 'ready');
      p.frame(0);
      assert.deepEqual(p.rendered.backdrop.pin, pin);
      assert.equal(p.rendered.paused, true);
      p.$('start-button').click();
      await settle(() => p.doc.body.dataset.flightState === 'running');
      p.$('pause-button').click();
      p.$('overlay-restart').click();
      assert.equal(p.$('restart-dialog').open, true);
      p.$('restart-confirm').click();
      assert.equal(p.$('restart-dialog').open, false);
      await settle(
        () =>
          p.doc.body.dataset.pictureState === 'ready' &&
          p.doc.body.dataset.flightState === 'running',
        p.$('run-message').textContent,
      );
      p.frame(0);
      assert.equal(p.rendered.run.tick, 0);
      assert.deepEqual(p.rendered.backdrop.pin, pin);
      assert.deepEqual(p.errors, []);
    },
  );
});
