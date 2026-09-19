import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectImageDataUrl } from '../content.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createCouchInstalledChapters } from '../couch/couch-installed-chapters.mjs';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { acquirePresentationImage } from '../ui/presentation-image.mjs';
import { presentationPicturePins } from '../flight-media-pins.mjs';
import { createReleasePictureDefaults } from '../presentation/release-pictures.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { FORMATS, TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { COMPILED_PRESENTATION_FORMAT } from '../presentation/host.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const pilot = await buildExternalPilot();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function decodeImage(value) {
  const dataUrl =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const header = inspectImageDataUrl(dataUrl);
  assert.equal(header.valid, true);
  return { naturalWidth: header.width, naturalHeight: header.height };
}
class Locks {
  held = new Set();
  async request(key, _options, action) {
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
// Real authenticated PNGs, transactions, identities and flight/picture modules.
// Browser image decoding and its scheduling are finite models, not native proof.
function pictures() {
  const urls = new Map(),
    images = [];
  let id = 0;
  const model = { urls, images, onDecode: null };
  model.URLImpl = class extends URL {
    static createObjectURL(blob) {
      const url = `blob:external-picture-parity/${++id}`;
      urls.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      assert.ok(urls.has(url), 'Each owned URL is released exactly once.');
      urls.delete(url);
    }
  };
  model.ImageClass = class {
    constructor() {
      images.push(this);
      this.released = 0;
    }
    set src(source) {
      Promise.resolve()
        .then(async () => {
          this.bytes = source.startsWith('data:')
            ? Buffer.from(source.split(',')[1], 'base64')
            : Buffer.from(await urls.get(source).arrayBuffer());
          const size = await decodeImage(new Blob([this.bytes], { type: 'image/png' }));
          this.width = this.naturalWidth = size.naturalWidth;
          this.height = this.naturalHeight = size.naturalHeight;
          this.onload?.();
        })
        .catch((error) => this.onerror?.(error));
    }
    async decode() {
      await model.onDecode?.(this);
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.released++;
    }
  };
  return model;
}

// Same bounded release fixture as external-chapter-app: each release slot uses
// the next authenticated original. It proves distinct choice, not production art.
function releaseSnapshot() {
  const assets = {},
    bindings = {},
    urls = {};
  for (const [index, original] of pilot.descriptor.originals.entries()) {
    const source = pilot.descriptor.originals[(index + 1) % pilot.descriptor.originals.length];
    const slot = CURRENT_PICTURES.find(
      (row) =>
        row.owner.baseCampaignKey === pilot.descriptor.campaignKey &&
        row.owner.levelId === original.levelId &&
        row.owner.themeId === 'fpv',
    );
    assert.ok(slot);
    const asset = {
      format: FORMATS.asset,
      id: `fixture.release.external-${index}`,
      revision: 1,
      kind: 'image',
      description: 'Distinct authenticated PNG used only by a release adapter fixture.',
      provenance: {
        creator: 'Test fixture',
        source: 'Swapped original; no production art claim.',
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
    bindings[slot.id] = { id: asset.id, revision: asset.revision };
    urls[source.sha256] = `./assets/${source.sha256}.png`;
  }
  return {
    format: COMPILED_PRESENTATION_FORMAT,
    source: { id: 'test.external-release', revision: 1 },
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
const compact = (picture) => ({
  sha256: sha(picture.image.bytes),
  width: picture.image.naturalWidth,
  height: picture.image.naturalHeight,
  fit: picture.fit,
  sampling: picture.sampling,
});

async function fixture(t, { assigned = true, available = true, malformed = false } = {}) {
  const pointers = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks();
  const committedWrites = { pointers: 0, media: 0 };
  pointers.afterAnyCommit = () => committedWrites.pointers++;
  media.afterAnyCommit = () => committedWrites.media++;
  const values = new Map([
    ['revealline.library.dev.v1', 'retained Solo progress'],
    ['revealline.session.dev.v1', 'retained paused Solo attempt'],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: () => assert.fail('Picture consumption must not write player storage.'),
    removeItem: () => assert.fail('Picture consumption must not remove player storage.'),
  };
  const pointer = createExternalChapterPointerStore({
    indexedDB: pointers.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  const manager = createManagedMediaStore({ indexedDB: media.indexedDB, storyMedia: true });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const writer = await claimProfileWriter(locks, pointer.keys.writerKey);
  const installer = createExternalChapterHost({
    indexedDB: pointers.indexedDB,
    profileKey: pointer.keys.profileKey,
    packsKey: pointer.keys.packsKey,
    storage,
    lockManager: locks,
    writer,
    registeredEntries: [],
    knownDescriptors: [pilot.descriptor],
    getManagedStore: () => manager,
    decodeImage,
  });
  let catalog;
  try {
    await installer.install(pilot.prepared);
    catalog = (await installer.inspect()).executionCatalog;
  } finally {
    installer.close();
    writer.release();
  }
  const identityCatalog = createMediaIdentityCatalog(catalog);
  const entry = catalog.entries.find((row) => row.difficulty === 'standard');
  const level = entry.campaign.levels[0];
  const request = {
    executionKey: entry.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeId: 'fpv',
  };
  const identity = identityCatalog.resolve(request);
  assert.equal(identity.levelId, pilot.descriptor.originals[0].levelId);
  const snapshot = releaseSnapshot();
  let activeSnapshot = snapshot,
    badBytes = malformed;
  const releaseReads = [];
  const page = {
    ready: Promise.resolve(snapshot),
    current: () => activeSnapshot,
    async readPicture(slotId, options) {
      assert.equal(options.snapshot, snapshot);
      const asset = snapshot.resolved.assets[slotId];
      assert.ok(asset, 'Only the finite fixture release slots may be requested.');
      const original = pilot.prepared.imported.assets.find(
        (row) => row.sha256 === asset.file.sha256,
      );
      assert.ok(original);
      releaseReads.push(slotId);
      if (!badBytes) return { asset, blob: original.blob };
      const bytes = new Uint8Array(await original.blob.arrayBuffer());
      bytes[bytes.length - 1] ^= 1;
      return { asset, blob: new Blob([bytes], { type: asset.file.mime }) };
    },
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
  const originalMedia = await store.readMetadata();
  assert.equal(
    await defaults.assignFreshChapter({
      descriptor: pilot.descriptor,
      mediaGeneration: originalMedia.generation,
      identityCatalog,
    }),
    true,
  );
  assert.deepEqual(releaseReads, [], 'Fixture installation reuses authenticated retained bytes.');
  activeSnapshot = available ? snapshot : null;
  page.ready = Promise.resolve(activeSnapshot);
  const indexedDB = {
    open(name, ...args) {
      return (name === MANAGED_MEDIA_DATABASE ? media.indexedDB : pointers.indexedDB).open(
        name,
        ...args,
      );
    },
  };
  const model = pictures();
  const reader = createCouchInstalledChapters({
    channel: 'dev',
    registeredEntries: [],
    indexedDB,
    storage,
    lockManager: locks,
    presentationPage: page,
    ...model,
  });
  const solo = createFlightPictures({
    context: { runId: 'external-parity-solo', ...request },
    level,
    themeIds: ['fpv'],
    identityCatalog,
    readMedia,
    prepareSelection: (options) =>
      defaults.prepareSelection({ ...options, authoredBackground: null }),
    acquire: (proof, options) => acquirePresentationImage(proof, { ...options, ...model }),
  });
  t.after(() => {
    solo.dispose();
    reader.dispose();
    store.close();
    manager.close();
    pointer.close();
  });
  async function editLibrary(edit) {
    const saved = await store.read();
    const library = edit(saved.document.library);
    await store.commit(
      await store.prepare(library, saved.assets, {
        previous: saved.document,
        executionCatalog: catalog,
      }),
      { expectedGeneration: saved.generation },
    );
  }
  async function addRevision({ assign = false } = {}) {
    let revised;
    await editLibrary((library) => {
      const assignment = library.assignments.find(
        (row) => row.identity.levelId === identity.levelId,
      );
      const original = library.presentations.find(
        (row) => row.id === assignment.presentationId && row.revision === assignment.revision,
      );
      revised = {
        ...original,
        revision:
          Math.max(
            ...library.presentations
              .filter((row) => row.id === original.id)
              .map((row) => row.revision),
          ) + 1,
        poster: { ...original.poster, assetId: pilot.descriptor.originals[2].assetId },
        description: 'A second immutable still revision with different authenticated bytes.',
      };
      return {
        ...library,
        presentations: [...library.presentations, revised],
        assignments: library.assignments.map((row) =>
          assign && row === assignment ? { ...row, revision: revised.revision } : row,
        ),
      };
    });
    return revised;
  }
  if (!assigned)
    await editLibrary((library) => ({
      ...library,
      assignments: library.assignments.filter((row) => row.identity.levelId !== identity.levelId),
    }));
  return {
    reader,
    solo,
    store,
    catalog,
    identity,
    model,
    media,
    indexedDB,
    storage,
    locks,
    addRevision,
    editLibrary,
    page,
    releaseReads,
    allowReleaseBytes: () => {
      badBytes = false;
    },
    writes: () => ({
      pointers: pointers.allPuts.length,
      media: media.allPuts.length,
      committedWrites: { ...committedWrites },
      values: [...values],
    }),
    async first() {
      const rows = await reader.refresh();
      const row = rows.find((candidate) => candidate.level.id === identity.levelId);
      assert.ok(row);
      return row;
    },
  };
}

test('fresh external installed Versus uses the accepted release still selected by Solo, retaining original readiness and no writes', async (t) => {
  const f = await fixture(t),
    before = f.writes();
  const saved = await f.store.readMetadata();
  assert.ok(
    saved.document.library.presentations.some(
      (row) => row.id === pilot.descriptor.originals[0].presentationId,
    ),
  );
  await f.solo.ensure();
  const solo = compact(f.solo.current());
  assert.equal(solo.sha256, pilot.descriptor.originals[1].sha256);
  assert.notEqual(solo.sha256, pilot.descriptor.originals[0].sha256);
  const pin = presentationPicturePins(f.solo.pins()).choices[0];
  assert.deepEqual(pin.identity, f.identity);
  assert.match(pin.presentationId, /^fk-picture-/);
  const row = await f.first();
  const chosen = await f.reader.select(row, { raceId: 1 });
  assert.equal(await f.reader.confirm(row, { raceId: 1 }), chosen);
  assert.deepEqual(
    f.writes(),
    before,
    'Neither picture consumer may write media, player or chapter state.',
  );
  assert.deepEqual(
    f.releaseReads,
    [],
    'A saved still assignment does not fetch a release replacement.',
  );
  assert.deepEqual(
    compact(chosen),
    solo,
    'External readiness must not replace the accepted picture choice with the descriptor original.',
  );
});

test('an unassigned external identity chooses the compatible release with exact Solo parity without saving an assignment', async (t) => {
  const f = await fixture(t, { assigned: false }),
    before = f.writes();
  await f.solo.ensure();
  const row = await f.first();
  const chosen = await f.reader.select(row, { raceId: 10 });
  assert.equal(compact(chosen).sha256, pilot.descriptor.originals[1].sha256);
  assert.deepEqual(compact(chosen), compact(f.solo.current()));
  assert.equal(await f.reader.confirm(row, { raceId: 10 }), chosen);
  assert.equal(f.releaseReads.length, 1);
  const current = await f.store.readMetadata();
  assert.equal(
    current.document.library.assignments.some(
      (item) => item.identity.levelId === f.identity.levelId,
    ),
    false,
  );
  assert.deepEqual(
    f.writes(),
    before,
    'Resolving an unassigned release does not persist a new assignment.',
  );
});

test('an unassigned external picture keeps its descriptor original and returns a visible notice when optional presentation is absent', async (t) => {
  const f = await fixture(t, { assigned: false, available: false }),
    before = f.writes();
  const row = await f.first();
  const chosen = await f.reader.select(row, { raceId: 11 });
  assert.equal(compact(chosen).sha256, pilot.descriptor.originals[0].sha256);
  assert.match(chosen.notice, /release.*unavailable.*authored picture.*kept/i);
  assert.equal(await f.reader.confirm(row, { raceId: 11 }), chosen);
  assert.deepEqual(f.releaseReads, []);
  assert.deepEqual(f.writes(), before);
});

test('malformed chosen external release bytes refuse fallback and same-race repair retries the selected release', async (t) => {
  const f = await fixture(t, { assigned: false, malformed: true }),
    before = f.writes();
  const row = await f.first();
  await assert.rejects(f.reader.select(row, { raceId: 12 }), /SHA-256|hash|original/i);
  assert.equal(
    f.reader.current(),
    null,
    'The valid descriptor original must not hide a corrupt chosen release.',
  );
  assert.equal(f.releaseReads.length, 1);
  f.allowReleaseBytes();
  const repaired = await f.reader.select(row, { raceId: 12 });
  assert.equal(compact(repaired).sha256, pilot.descriptor.originals[1].sha256);
  assert.equal(await f.reader.confirm(row, { raceId: 12 }), repaired);
  assert.equal(f.releaseReads.length, 2);
  assert.deepEqual(f.writes(), before);
});

test('a valid alternate still cannot bypass missing descriptor-original readiness', async (t) => {
  const f = await fixture(t),
    row = await f.first();
  await f.solo.ensure();
  assert.equal(compact(f.solo.current()).sha256, pilot.descriptor.originals[1].sha256);
  const beforeDeletion = f.writes();
  const db = await new Promise((resolve, reject) => {
    const request = f.media.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('mediaBlobs', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.objectStore('mediaBlobs').delete(pilot.descriptor.originals[0].sha256);
    });
  } finally {
    db.close();
  }
  const before = f.writes();
  assert.equal(before.media, beforeDeletion.media, 'A delete-only transaction has no puts.');
  assert.equal(
    before.committedWrites.media,
    beforeDeletion.committedWrites.media + 1,
    'The no-write observer must also detect completed delete-only transactions.',
  );
  await assert.rejects(f.reader.select(row, { raceId: 2 }), /missing|unavailable|original/i);
  assert.equal(f.reader.current(), null);
  assert.deepEqual(f.writes(), before);
});

test('an explicit historical still revision wins over its newer unassigned revision in both consumers', async (t) => {
  const f = await fixture(t);
  const newer = await f.addRevision();
  const before = f.writes(),
    row = await f.first();
  await f.solo.ensure();
  const pin = presentationPicturePins(f.solo.pins()).choices[0];
  assert.equal(pin.presentationId, newer.id);
  assert.equal(pin.presentationRevision, newer.revision - 1);
  assert.equal(pin.sha256, pilot.descriptor.originals[1].sha256);
  const picture = await f.reader.select(row, { raceId: 3 });
  assert.deepEqual(compact(picture), compact(f.solo.current()));
  assert.equal(await f.reader.confirm(row, { raceId: 3 }), picture);
  assert.deepEqual(f.writes(), before);
});

for (const interruption of ['failure', 'cancellation']) {
  test(`external same-race Retry after chosen-image ${interruption} retains its captured revision after reassignment`, async (t) => {
    const f = await fixture(t),
      row = await f.first();
    const chosenHash = pilot.descriptor.originals[1].sha256;
    let matches = 0,
      entered = false,
      finish;
    const gate = new Promise((resolve) => {
      finish = resolve;
    });
    t.after(finish);
    f.model.onDecode = async (image) => {
      if (sha(image.bytes) !== chosenHash || ++matches !== 2) return;
      // The first match is mandatory whole-chapter readiness. This second
      // match is acquisition of the captured alternate, after that proof.
      entered = true;
      if (interruption === 'failure') throw new Error('Controlled chosen-image decode failure.');
      await gate;
    };
    let settled = false;
    const pending = f.reader.select(row, { raceId: 4 });
    // Attach rejection handling immediately; cancellation never leaves an
    // unhandled rejection while the deliberately held decoder unwinds.
    const outcome = pending.then(
      (value) => {
        settled = true;
        return { value };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );
    await waitFor(() => entered || settled, {
      timeoutMs: 45000,
      message: 'The installed adapter did not reach its chosen-image acquisition.',
    });
    assert.equal(
      entered,
      true,
      'Readiness must be followed by the captured alternate acquisition.',
    );
    if (interruption === 'cancellation') {
      f.reader.cancel();
      finish();
    }
    const result = await outcome;
    assert.ok(result.error, 'The failed/cancelled picture must not be published.');
    if (interruption === 'failure') assert.match(result.error.message, /Controlled chosen-image/);
    else assert.equal(result.error.name, 'AbortError');
    assert.equal(f.reader.current(), null);
    f.model.onDecode = null;
    await f.addRevision({ assign: true });
    const before = f.writes();
    const retry = await f.reader.select(row, { raceId: 4 });
    assert.equal(
      compact(retry).sha256,
      chosenHash,
      'Retry reopens the captured immutable pin, not the current assignment.',
    );
    assert.equal(await f.reader.confirm(row, { raceId: 4 }), retry);
    const fresh = await f.reader.select(row, { raceId: 5 });
    assert.equal(
      compact(fresh).sha256,
      pilot.descriptor.originals[2].sha256,
      'A deliberate fresh race may choose the newer assignment.',
    );
    assert.equal(await f.reader.confirm(row, { raceId: 5 }), fresh);
    assert.deepEqual(f.writes(), before);
  });
}

test('accepted external Start rejects a changed media generation without discarding its displayed picture', async (t) => {
  const f = await fixture(t),
    row = await f.first();
  const picture = await f.reader.select(row, { raceId: 6 });
  assert.equal(compact(picture).sha256, pilot.descriptor.originals[1].sha256);
  await f.addRevision({ assign: true });
  const before = f.writes();
  await assert.rejects(f.reader.confirm(row, { raceId: 6 }), /changed|generation/i);
  assert.equal(f.reader.current(), picture);
  assert.equal(picture.image.released, 0);
  assert.equal(compact(picture).sha256, pilot.descriptor.originals[1].sha256);
  assert.deepEqual(f.writes(), before);
});

test('explicit same-race Retry reopens the accepted external revision after the current assignment changes', async (t) => {
  const f = await fixture(t),
    row = await f.first();
  const accepted = await f.reader.select(row, { raceId: 9 });
  assert.equal(compact(accepted).sha256, pilot.descriptor.originals[1].sha256);
  await f.addRevision({ assign: true });
  const before = f.writes();
  const retry = await f.reader.select(row, { raceId: 9 });
  assert.equal(compact(retry).sha256, pilot.descriptor.originals[1].sha256);
  assert.equal(await f.reader.confirm(row, { raceId: 9 }), retry);
  assert.equal(accepted.image.released, 1);
  assert.deepEqual(f.writes(), before);
});

test('staged external Next preserves accepted Results through cancellation and confirmation, then retires only after commit', async (t) => {
  const f = await fixture(t),
    rows = await f.reader.refresh();
  const first = rows.find((row) => row.level.id === pilot.descriptor.originals[0].levelId);
  const second = rows.find((row) => row.level.id === pilot.descriptor.originals[1].levelId);
  assert.ok(first && second);
  const before = f.writes();
  const accepted = await f.reader.select(first, { raceId: 7 });
  assert.equal(compact(accepted).sha256, pilot.descriptor.originals[1].sha256);
  let matches = 0,
    entered = false,
    finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  t.after(finish);
  f.model.onDecode = async (image) => {
    if (sha(image.bytes) === pilot.descriptor.originals[2].sha256 && ++matches === 2) {
      entered = true;
      await gate;
    }
  };
  let settled = false;
  const pending = f.reader.stage(second, { raceId: 8 }).then(
    (value) => {
      settled = true;
      return { value };
    },
    (error) => {
      settled = true;
      return { error };
    },
  );
  await waitFor(() => entered || settled, {
    timeoutMs: 45000,
    message: 'Staged Next did not reach the chosen successor image.',
  });
  assert.equal(entered, true);
  assert.equal(f.reader.current(), accepted, 'Pending Next retains the Results picture.');
  assert.equal(accepted.image.released, 0);
  f.reader.cancel();
  finish();
  const cancelled = await pending;
  assert.equal(cancelled.error?.name, 'AbortError');
  assert.equal(f.reader.current(), accepted);
  f.model.onDecode = null;
  assert.equal(await f.reader.confirm(first, { raceId: 7 }), accepted);
  const next = await f.reader.stage(second, { raceId: 8 });
  assert.equal(compact(next.picture).sha256, pilot.descriptor.originals[2].sha256);
  assert.equal(f.reader.current(), accepted);
  await next.confirm();
  assert.equal(f.reader.current(), accepted, 'Confirmation alone cannot replace Results.');
  const retire = next.commit();
  assert.equal(f.reader.current(), next.picture);
  assert.equal(accepted.image.released, 0, 'Publish the successor before releasing Results.');
  assert.equal(await f.reader.confirm(second, { raceId: 8 }), next.picture);
  retire();
  retire();
  assert.equal(accepted.image.released, 1);
  next.cancel();
  assert.equal(next.picture.image.released, 0, 'A committed image is owned by the reader.');
  f.reader.dispose();
  f.reader.dispose();
  assert.equal(next.picture.image.released, 1);
  assert.equal(f.model.urls.size, 0);
  assert.ok(f.model.images.every((image) => image.released === 1));
  assert.deepEqual(f.writes(), before);
});

// Real Couch DOM/property handlers, installed adapter and both painter inputs;
// the existing finite browser/painter boundary does not prove native rendering.
test('external host Start and one-action Rematch share the Solo-selected still while missing descriptor originals retain Results', async (t) => {
  const f = await fixture(t);
  await f.solo.ensure();
  const expected = compact(f.solo.current()),
    before = f.writes();
  f.reader.dispose();
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: f.model.ImageClass,
    URLImpl: f.model.URLImpl,
    assetDatabase: f.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
  });
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
  const choice = page
    .$('race-level')
    .options.find(
      (option) =>
        option.value.startsWith('installed/') && option.value.endsWith(`/${f.identity.levelId}`),
    );
  assert.ok(choice);
  page.$('race-focus').click();
  page.$('race-level').value = choice.value;
  await action(page.$('race-level'), 'change');
  await waitFor(() => !page.$('race-start').disabled, {
    timeoutMs: 45000,
    message: 'External installed choice did not become ready through the host.',
  });
  page.$('race-setup-back').click();
  page.frame(0);
  const selected = page.drawOptions[0].backdrop;
  assert.equal(selected === page.drawOptions[1].backdrop, true);
  assert.deepEqual(compact(selected), expected);
  assert.equal(page.state(), 'ready');
  assert.ok(page.renders.every((run) => run.level.id === f.identity.levelId && run.tick === 0));
  await action(page.$('race-start'));
  page.frame(0);
  assert.equal(page.state(), 'running');
  assert.equal(page.drawOptions[0].backdrop === selected, true);
  assert.equal(page.drawOptions[1].backdrop === selected, true);
  page.$('race-pause').click();
  page.frame(0);
  assert.deepEqual(
    f.writes(),
    before,
    'Both boards remain read-only consumers of Solo picture state.',
  );
  assert.equal(page.state(), 'paused');
  assert.equal(page.$('race-format').value, 'single');
  const missionName = page.renders[0].level.name;
  const result = () => ({
    runs: [...page.renders],
    checkpoints: page.checkpoint(),
    picture: page.drawOptions[0].backdrop,
    rows: [0, 1].map((seat) => page.$(`race-result-${seat}`).textContent),
    wins: page.$('series-score').textContent,
    map: page.$('race-level').value,
  });
  const retained = (accepted) => {
    assert.equal(page.state(), 'finished');
    assert.ok(page.renders.every((run, seat) => run === accepted.runs[seat]));
    assert.deepEqual(page.checkpoint(), accepted.checkpoints);
    assert.ok(page.drawOptions.every((options) => options.backdrop === accepted.picture));
    assert.deepEqual(compact(accepted.picture), expected);
    assert.deepEqual(
      [0, 1].map((seat) => page.$(`race-result-${seat}`).textContent),
      accepted.rows,
    );
    assert.equal(page.$('series-score').textContent, accepted.wins);
    assert.equal(page.$('race-level').value, accepted.map);
    assert.equal(accepted.picture.image.released, 0);
  };
  const finishRace = () => {
    assert.equal(page.state(), 'running');
    // Legal neutral frames run the real duel to its authored time limit;
    // no timer, winner, simulation state or score is assigned by the test.
    page.frames(151, 200);
    assert.equal(page.state(), 'finished');
    assert.match(page.$('race-message').textContent, /^Draw\b/);
    assert.equal(page.$('race-start').textContent, `Rematch: ${missionName}`);
    return result();
  };
  await action(page.$('race-start'));
  page.frame(0);
  const firstResult = finishRace();
  assert.equal(firstResult.picture === selected, true);
  assert.equal(expected.sha256, pilot.descriptor.originals[1].sha256);
  assert.notEqual(expected.sha256, pilot.descriptor.originals[0].sha256);

  let matches = 0,
    entered = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  f.model.onDecode = async (image) => {
    if (sha(image.bytes) !== expected.sha256 || ++matches !== 2) return;
    // The first matching decode authenticates this chapter original. The
    // second acquires the separately selected still after that readiness proof.
    entered = true;
    await gate;
  };
  page.doc.body.focus();
  let settled = false;
  const pending = action(page.$('race-start')).then(
    () => {
      settled = true;
      return { error: null };
    },
    (error) => {
      settled = true;
      return { error };
    },
  );
  await waitFor(() => entered || settled, {
    timeoutMs: 45000,
    message: 'External Rematch did not reach acquisition of its selected alternate.',
  });
  assert.equal(entered, true, 'The chosen still follows mandatory original readiness.');
  page.frame(0);
  retained(firstResult);
  assert.equal(page.doc.activeElement.id, 'race-picture-cancel');
  release();
  assert.equal((await pending).error, null);
  f.model.onDecode = null;
  page.frame(0);
  assert.equal(page.state(), 'running', 'The same click starts the prepared external rematch.');
  assert.ok(
    page.renders.every(
      (run, seat) =>
        run !== firstResult.runs[seat] && run.tick === 0 && run.level.id === f.identity.levelId,
    ),
  );
  assert.equal(page.$('race-level').value, firstResult.map);
  const rematchPicture = page.drawOptions[0].backdrop;
  assert.equal(rematchPicture === page.drawOptions[1].backdrop, true);
  assert.equal(rematchPicture.image === selected.image, false);
  assert.deepEqual(compact(rematchPicture), expected);
  assert.deepEqual(rematchPicture.choice.identity, f.identity);
  assert.equal(rematchPicture.choice.kind, 'still');
  assert.equal(selected.image.released, 1);
  assert.equal(rematchPicture.image.released, 0);
  assert.deepEqual(f.writes(), before);

  const secondResult = finishRace();
  const beforeDeletion = f.writes();
  const db = await new Promise((resolve, reject) => {
    const request = f.media.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('mediaBlobs', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.objectStore('mediaBlobs').delete(pilot.descriptor.originals[0].sha256);
    });
  } finally {
    db.close();
  }
  const afterDeletion = f.writes();
  assert.equal(afterDeletion.media, beforeDeletion.media);
  assert.equal(afterDeletion.committedWrites.media, beforeDeletion.committedWrites.media + 1);
  const diagnostics = [];
  t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
  await action(page.$('race-start'));
  page.frame(0);
  retained(secondResult);
  assert.equal(page.$('race-start').disabled, false);
  assert.equal(page.$('race-start').textContent, `Rematch: ${missionName}`);
  assert.equal(page.doc.activeElement.id, 'race-start');
  assert.equal(
    page.$('race-message').textContent,
    'The rematch picture could not be prepared. Results are kept. Choose Rematch to retry.',
  );
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0][0], 'Next picture preparation failed.');
  assert.match(diagnostics[0][1].message, /missing|unavailable|original/i);
  page.frames(20);
  retained(secondResult);
  assert.deepEqual(
    f.writes(),
    afterDeletion,
    'Only the intentional original deletion writes; a refused rematch remains read-only.',
  );
});

test('cancelling while optional presentation is pending retains the captured unassigned choice after an assignment is added', async (t) => {
  const f = await fixture(t, { assigned: false });
  const row = await f.first();
  const snapshot = f.page.current();
  let entered = false,
    finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  t.after(() => finish(snapshot));
  Object.defineProperty(f.page, 'ready', {
    configurable: true,
    get() {
      entered = true;
      return gate;
    },
  });
  let settled = false;
  const pending = f.reader.select(row, { raceId: 13 }).then(
    (value) => {
      settled = true;
      return { value };
    },
    (error) => {
      settled = true;
      return { error };
    },
  );
  await waitFor(() => entered || settled, {
    timeoutMs: 45000,
    message: 'The unassigned external choice did not reach optional presentation readiness.',
  });
  assert.equal(entered, true);
  f.reader.cancel();
  finish(snapshot);
  assert.equal((await pending).error?.name, 'AbortError');
  assert.equal(f.reader.current(), null);
  assert.deepEqual(f.releaseReads, [], 'No release bytes were requested before readiness.');
  Object.defineProperty(f.page, 'ready', {
    configurable: true,
    writable: true,
    value: Promise.resolve(snapshot),
  });
  await f.editLibrary((library) => {
    const original = library.presentations.find(
      (item) => item.identity.levelId === f.identity.levelId && item.id.startsWith('fk-picture-'),
    );
    assert.ok(original);
    const revised = {
      ...original,
      revision: original.revision + 1,
      poster: { ...original.poster, assetId: pilot.descriptor.originals[2].assetId },
      description: 'An explicit assignment added while a cancelled unassigned race is retained.',
    };
    return {
      ...library,
      presentations: [...library.presentations, revised],
      assignments: [
        ...library.assignments,
        { identity: f.identity, presentationId: revised.id, revision: revised.revision },
      ],
    };
  });
  const before = f.writes();
  const retry = await f.reader.select(row, { raceId: 13 });
  assert.equal(
    compact(retry).sha256,
    pilot.descriptor.originals[1].sha256,
    'Same-race Retry completes the captured unassigned release choice.',
  );
  assert.equal(await f.reader.confirm(row, { raceId: 13 }), retry);
  assert.equal(f.releaseReads.length, 1);
  const fresh = await f.reader.select(row, { raceId: 14 });
  assert.equal(
    compact(fresh).sha256,
    pilot.descriptor.originals[2].sha256,
    'A new race may adopt the explicit assignment added after cancellation.',
  );
  assert.equal(await f.reader.confirm(row, { raceId: 14 }), fresh);
  assert.equal(f.releaseReads.length, 1, 'The new saved still requires no release download.');
  assert.deepEqual(f.writes(), before);
});

test('missing captured saved-still bytes fail after original readiness without falling back to the valid descriptor picture', async (t) => {
  const { pngBytes, assetRecord, presentationRecord } = await import(
    './helpers/media-fixtures.mjs'
  );
  const f = await fixture(t);
  // This tiny explicit still is separate from every chapter original; deleting
  // it cannot accidentally turn this into another descriptor-readiness test.
  const bytes = pngBytes(),
    digest = sha(bytes),
    asset = {
      ...assetRecord('external-only-still'),
      sha256: digest,
      bytes: bytes.length,
    },
    presentation = {
      ...presentationRecord(f.identity, 1, asset.id),
      id: 'external-only-presentation',
    };
  assert.ok(pilot.descriptor.originals.every((original) => original.sha256 !== digest));
  const saved = await f.store.read();
  const library = {
    ...saved.document.library,
    assets: [...saved.document.library.assets, asset],
    presentations: [...saved.document.library.presentations, presentation],
    assignments: [
      ...saved.document.library.assignments.filter(
        (item) => item.identity.levelId !== f.identity.levelId,
      ),
      { identity: f.identity, presentationId: presentation.id, revision: presentation.revision },
    ],
  };
  await f.store.commit(
    await f.store.prepare(
      library,
      [...saved.assets, { sha256: digest, blob: new Blob([bytes], { type: 'image/png' }) }],
      { previous: saved.document, executionCatalog: f.catalog },
    ),
    { expectedGeneration: saved.generation },
  );
  const row = await f.first();
  const accepted = await f.reader.select(row, { raceId: 15 });
  assert.equal(compact(accepted).sha256, digest);
  assert.equal(await f.reader.confirm(row, { raceId: 15 }), accepted);
  const db = await new Promise((resolve, reject) => {
    const request = f.media.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('mediaBlobs', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.objectStore('mediaBlobs').delete(digest);
    });
  } finally {
    db.close();
  }
  const before = f.writes(),
    priorImages = f.model.images.length;
  await assert.rejects(f.reader.select(row, { raceId: 15 }), /missing|unavailable|original/i);
  assert.equal(
    f.reader.current(),
    null,
    'Valid chapter originals cannot replace missing chosen bytes.',
  );
  assert.equal(accepted.image.released, 1);
  assert.deepEqual(
    new Set(f.model.images.slice(priorImages).map((image) => sha(image.bytes))),
    new Set(pilot.descriptor.originals.map((original) => original.sha256)),
    'All descriptor originals were still authenticated and decoded before chosen-byte refusal.',
  );
  assert.deepEqual(f.releaseReads, []);
  assert.deepEqual(f.writes(), before);
});

test('Retry of accepted Results retains its external picture after a successor is cancelled and the first assignment changes', async (t) => {
  const f = await fixture(t),
    rows = await f.reader.refresh();
  const first = rows.find((row) => row.level.id === pilot.descriptor.originals[0].levelId),
    second = rows.find((row) => row.level.id === pilot.descriptor.originals[1].levelId);
  assert.ok(first && second);
  const accepted = await f.reader.select(first, { raceId: 16 });
  assert.equal(compact(accepted).sha256, pilot.descriptor.originals[1].sha256);
  const successor = await f.reader.stage(second, { raceId: 17 });
  assert.equal(compact(successor.picture).sha256, pilot.descriptor.originals[2].sha256);
  successor.cancel();
  assert.equal(successor.picture.image.released, 1);
  assert.equal(f.reader.current(), accepted);
  assert.equal(accepted.image.released, 0);
  assert.equal(await f.reader.confirm(first, { raceId: 16 }), accepted);
  await f.addRevision({ assign: true });
  const before = f.writes();
  const retry = await f.reader.select(first, { raceId: 16 });
  assert.equal(
    compact(retry).sha256,
    pilot.descriptor.originals[1].sha256,
    'Cancelled Next must not displace the accepted race’s immutable picture choice.',
  );
  assert.equal(await f.reader.confirm(first, { raceId: 16 }), retry);
  const fresh = await f.reader.select(first, { raceId: 18 });
  assert.equal(compact(fresh).sha256, pilot.descriptor.originals[2].sha256);
  assert.equal(await f.reader.confirm(first, { raceId: 18 }), fresh);
  assert.deepEqual(f.writes(), before);
});
