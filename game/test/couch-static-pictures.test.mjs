import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCouchStaticPictures } from '../couch/couch-static-pictures.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes, provenance, libraryRecord, deferred } from './helpers/media-fixtures.mjs';

const json = async (name) => JSON.parse(await fs.readFile(new URL(name, import.meta.url), 'utf8'));
const [campaign, classes, themes, runtime] = await Promise.all([
  json('../content/campaign.json'),
  json('../content/classes.json'),
  json('../content/themes.json'),
  json('../presentation/compiled/runtime.json'),
]);
const baseEntry = {
  campaign: { ...campaign, classRecipes: classes },
  classRecipes: classes,
  themes: themes.themes,
};
const catalog = createExecutionCatalog([baseEntry]),
  entry = catalog.entries.find((entry) => entry.difficulty === 'standard'),
  identities = createMediaIdentityCatalog(catalog),
  firstLevel = entry.campaign.levels[0];
const owner = (level = firstLevel, themeId = 'fpv') =>
  identities.resolve({
    executionKey: entry.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeId,
  });
const releaseRow = CURRENT_PICTURES.find(
  (row) => JSON.stringify(row.owner) === JSON.stringify(owner()),
);
assert.ok(releaseRow);
const releaseAsset = runtime.resolved.assets[releaseRow.id];
const original = await fs.readFile(
  new URL(`../presentation/compiled/assets/${releaseAsset.file.sha256}.png`, import.meta.url),
);
const rowFor = (level = firstLevel) => ({
  level,
  pictureEntry: baseEntry,
  authoredBackground: null,
  defaultThemeId: 'fpv',
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function browser() {
  const images = [],
    created = [],
    revoked = [];
  const state = {
    dimensions: [releaseAsset.file.width, releaseAsset.file.height],
    error: false,
    gate: null,
    onDecode: null,
  };
  class ImageClass {
    constructor() {
      [this.width, this.height] = state.dimensions;
      this.naturalWidth = this.width;
      this.naturalHeight = this.height;
      this.closed = 0;
      images.push(this);
    }
    set src(value) {
      this.source = value;
      queueMicrotask(() => (state.error ? this.onerror?.() : this.onload?.()));
    }
    async decode() {
      await state.onDecode?.(this);
      if (state.gate) await state.gate.promise;
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.source = null;
    }
    close() {
      this.closed++;
    }
  }
  const URLImpl = {
    createObjectURL(blob) {
      const url = `blob:static-${created.length}`;
      created.push({ url, blob });
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
  return { state, images, created, revoked, ImageClass, URLImpl };
}
function fixture(t, { indexedDB = null, snapshot = true, onRead } = {}) {
  const native = browser(),
    statuses = [];
  let current = snapshot ? { resolved: { assets: { [releaseRow.id]: releaseAsset } } } : null;
  const selectedSnapshot = current;
  let reads = 0;
  const page = {
    ready: Promise.resolve(current),
    current: () => current,
    async readPicture(slot, options) {
      reads++;
      assert.equal(slot, releaseRow.id);
      assert.equal(options.snapshot === selectedSnapshot, true);
      const replacement = await onRead?.(options);
      return replacement ?? { asset: releaseAsset, blob: new Blob([original]) };
    },
  };
  const pictures = createCouchStaticPictures({
    entries: [baseEntry],
    presentationPage: page,
    indexedDB,
    ...native,
  });
  t.after(() => pictures.dispose());
  return {
    ...native,
    page,
    pictures,
    statuses,
    row: rowFor(),
    reads: () => reads,
    replaceSnapshot: () => {
      current = { ...current };
    },
    select(row, options = {}) {
      return pictures.select(row, { raceId: 1, onStatus: (x) => statuses.push(x), ...options });
    },
  };
}
async function savedFixture(t, memory = managedIndexedDB()) {
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    store = createStillMediaStore({
      managedStore: manager,
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    });
  const prepared = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord(owner());
  library.assets = [prepared.asset];
  await store.commit(
    await store.prepare(library, [{ sha256: prepared.asset.sha256, blob: prepared.blob }], {
      executionCatalog: catalog,
    }),
    { expectedGeneration: 0 },
  );
  t.after(() => {
    store.close();
    manager.close();
  });
  return { memory, store, manager, prepared, library };
}

test('exact published original has one decoded lease for both boards and no storage API fallback is explicit', async (t) => {
  const f = fixture(t);
  const result = await f.select(f.row);
  assert.equal(result.image === f.images[0], true);
  assert.equal(result.fit, 'contain');
  assert.equal(result.sampling, 'nearest');
  assert.equal(result.choice.sha256, releaseAsset.file.sha256);
  assert.deepEqual(result.choice.identity, owner());
  assert.match(result.notice, /Saved picture choices are unavailable/);
  assert.equal(f.reads(), 1);
  assert.equal(f.pictures.confirm(f.row, { raceId: 1 }) === result, true);
  assert.equal(f.reads(), 1, 'Confirm does not select or download again.');
  f.pictures.dispose();
  f.pictures.dispose();
  assert.equal(f.images[0].closed, 1);
  assert.deepEqual(f.revoked, [f.created[0].url]);
});

test('whole optional snapshot failure keeps explicit borrowed authored art, without releasing its owner', async (t) => {
  const f = fixture(t, { snapshot: false });
  let released = 0;
  const borrowed = { width: releaseAsset.file.width, height: releaseAsset.file.height };
  f.row.authoredBackground = {
    dataUrl: `data:image/png;base64,${original.toString('base64')}`,
    fit: 'contain',
  };
  f.row.backdrop = {
    image: borrowed,
    fit: 'contain',
    sampling: 'nearest',
    release: () => released++,
  };
  const result = await f.select(f.row);
  assert.equal(result.choice.kind, 'authored');
  assert.equal(result.image === borrowed, true);
  assert.equal(result.choice.original.sha256, releaseAsset.file.sha256);
  assert.equal(result.choice.original.bytes, original.length);
  assert.equal(result.choice.original.fit, 'contain');
  assert.match(result.notice, /Release artwork is unavailable/);
  assert.equal(f.pictures.confirm(f.row, { raceId: 1 }) === result, true);
  f.pictures.dispose();
  assert.equal(released, 0);
  assert.equal(f.reads(), 0);
});

test('valid empty media store selects release art without any media/progress writes', async (t) => {
  const memory = managedIndexedDB(),
    f = fixture(t, { indexedDB: memory.indexedDB });
  const result = await f.select(f.row);
  assert.equal(result.choice.kind, 'release');
  assert.equal(result.notice, '');
  assert.equal((await f.pictures.confirm(f.row, { raceId: 1 })) === result, true);
  assert.deepEqual(memory.allPuts, []);
  assert.ok(memory.openCount > 0, 'Established schema initialization is permitted.');
});

test('available but failing storage blocks Start and never guesses an unassigned picture', async (t) => {
  const f = fixture(t, {
    indexedDB: {
      open() {
        throw new Error('Blocked saved choices');
      },
    },
  });
  await assert.rejects(f.select(f.row), /Blocked saved choices/);
  assert.equal(f.reads(), 0);
  assert.equal(f.pictures.current(), null);
  assert.throws(() => f.pictures.confirm(f.row, { raceId: 1 }), /Load the selected original/);
});

test('explicit saved still assignment wins over current release art without any library mutation', async (t) => {
  const saved = await savedFixture(t),
    f = fixture(t, { indexedDB: saved.memory.indexedDB });
  f.state.dimensions = [1, 1];
  const before = await saved.store.readMetadata(),
    puts = [...saved.memory.allPuts];
  const result = await f.select(f.row);
  assert.equal(result.choice.kind, 'still');
  assert.equal(result.choice.pin.assetId, 'picture-a');
  assert.equal(result.choice.pin.sha256, saved.prepared.asset.sha256);
  assert.equal(f.reads(), 0);
  assert.equal((await f.pictures.confirm(f.row, { raceId: 1 })) === result, true);
  assert.deepEqual(await saved.store.readMetadata(), before);
  assert.deepEqual(saved.memory.allPuts, puts);
});

test('manual authored replacement does not borrow a release original just because gameplay identity matches', async (t) => {
  const f = fixture(t),
    borrowed = { width: 1, height: 1 };
  f.row.authoredBackground = {
    dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
    fit: 'contain',
  };
  f.row.backdrop = { image: borrowed, fit: 'contain', sampling: 'nearest' };
  const result = await f.select(f.row);
  assert.equal(result.choice.kind, 'authored');
  assert.equal(result.image === borrowed, true);
  assert.equal(f.reads(), 0);
});

test('unknown same-ID owner, changed level revision and crossed theme cannot request release bytes', async (t) => {
  const f = fixture(t);
  await assert.rejects(f.select({ ...f.row, pictureEntry: { ...baseEntry } }), /registered static/);
  await assert.rejects(
    f.select({ ...f.row, level: { ...f.row.level, revision: 'different' } }),
    /exact catalog owner/,
  );
  await assert.rejects(f.select(f.row, { themeId: 'uninstalled-world' }), /exact couch map/);
  assert.equal(f.reads(), 0);
});

for (const failure of ['read', 'hash', 'decode', 'dimensions'])
  test(`selected release ${failure} failure blocks Start and never silently falls back`, async (t) => {
    const f = fixture(t, {
      onRead:
        failure === 'read'
          ? () => {
              throw new Error('Original unavailable');
            }
          : failure === 'hash'
            ? () => ({ asset: releaseAsset, blob: new Blob([new Uint8Array(original.length)]) })
            : undefined,
    });
    if (failure === 'decode') f.state.error = true;
    if (failure === 'dimensions') f.state.dimensions = [1, 1];
    await assert.rejects(f.select(f.row), /unavailable|SHA-256|could not decode|dimensions differ/);
    assert.equal(f.pictures.current(), null);
    assert.throws(() => f.pictures.confirm(f.row, { raceId: 1 }), /Load the selected original/);
    assert.equal(f.revoked.length, f.created.length);
    for (const image of f.images) assert.equal(image.closed, 1);
  });

test('same-race retry retains exact saved pin and refuses changed metadata instead of selecting the replacement', async (t) => {
  const saved = await savedFixture(t),
    f = fixture(t, { indexedDB: saved.memory.indexedDB });
  f.state.dimensions = [1, 1];
  f.state.error = true;
  await assert.rejects(f.select(f.row), /could not decode/);
  const next = structuredClone(saved.library);
  next.presentations.push({ ...next.presentations[0], revision: 2 });
  next.assignments[0].revision = 2;
  await saved.store.commit(
    await saved.store.prepare(
      next,
      [{ sha256: saved.prepared.asset.sha256, blob: saved.prepared.blob }],
      {
        executionCatalog: catalog,
        previous: (await saved.manager.readDomainMetadata('media')).library,
      },
    ),
    { expectedGeneration: 1 },
  );
  f.state.error = false;
  await assert.rejects(f.select(f.row), /Saved picture choices changed/);
  assert.equal(f.pictures.current(), null);
  assert.equal(f.reads(), 0);
  const result = await f.select(f.row, { raceId: 2 });
  assert.equal(result.choice.pin.presentationRevision, 2);
});

test('confirm refuses a changed saved generation and a changed release snapshot without replacement reads', async (t) => {
  const memory = managedIndexedDB(),
    f = fixture(t, { indexedDB: memory.indexedDB });
  await f.select(f.row);
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    store = createStillMediaStore({ managedStore: manager });
  t.after(() => {
    store.close();
    manager.close();
  });
  const metadata = await store.readMetadata();
  await store.commit(
    await store.prepare(metadata.document.library, [], {
      executionCatalog: catalog,
      previous: (await manager.readDomainMetadata('media')).library,
    }),
    { expectedGeneration: metadata.generation },
  );
  await assert.rejects(f.pictures.confirm(f.row, { raceId: 1 }), /Saved picture choices changed/);
  assert.equal(f.reads(), 1);
  f.replaceSnapshot();
  assert.throws(() => f.pictures.confirm(f.row, { raceId: 1 }), /release artwork changed/);
});

test('cancelling after an unassigned choice is captured cannot make Retry adopt a new saved assignment', async (t) => {
  const memory = managedIndexedDB(),
    f = fixture(t, { indexedDB: memory.indexedDB }),
    gate = deferred(),
    entered = deferred();
  f.page.ready = {
    then(resolve, reject) {
      entered.resolve();
      return gate.promise.then(resolve, reject);
    },
  };
  f.state.onDecode = (image) => {
    const blob = f.created.find((row) => row.url === image.source).blob;
    const [width, height] =
      blob.size === pngBytes().length
        ? [1, 1]
        : [releaseAsset.file.width, releaseAsset.file.height];
    image.width = image.naturalWidth = width;
    image.height = image.naturalHeight = height;
  };
  const pending = f.select(f.row);
  await entered.promise;
  f.pictures.cancel();
  await assert.rejects(pending, { name: 'AbortError' });
  await savedFixture(t, memory);
  gate.resolve(f.page.current());
  await assert.rejects(f.select(f.row), /Saved picture choices changed/);
  assert.equal(f.pictures.current(), null);
  assert.equal(f.reads(), 1, 'Retry retains the captured release choice, not the later still.');
  const next = await f.select(f.row, { raceId: 2 });
  assert.equal(next.choice.kind, 'still');
  assert.equal(next.choice.pin.presentationRevision, 1);
});

test('failed replacement retains the prior accepted lease until a new picture succeeds', async (t) => {
  const f = fixture(t);
  const first = await f.select(f.row),
    old = first.image;
  f.state.error = true;
  await assert.rejects(f.select(f.row, { raceId: 2 }), /could not decode/);
  assert.equal(f.pictures.current() === first, true);
  assert.equal(old.closed, 0);
  f.state.error = false;
  const next = await f.select(f.row, { raceId: 2 });
  assert.equal(next.image === old, false);
  assert.equal(old.closed, 1);
  assert.equal(next.image.closed, 0);
});

test('cancel during full decode promptly releases its URL and late completion cannot replace accepted art', async (t) => {
  const f = fixture(t);
  const first = await f.select(f.row),
    gate = deferred(),
    entered = deferred();
  f.state.gate = gate;
  f.state.onDecode = () => entered.resolve();
  const pending = f.select(f.row, { raceId: 2 });
  await entered.promise;
  f.pictures.cancel();
  await assert.rejects(pending, { name: 'AbortError' });
  const abandoned = f.images.at(-1);
  assert.equal(abandoned.closed, 1);
  assert.deepEqual(f.revoked, [f.created.at(-1).url]);
  assert.equal(f.pictures.current() === first, true);
  gate.resolve();
  await tick();
  assert.equal(abandoned.closed, 1);
  assert.equal(f.pictures.current() === first, true);
});

test('dispose during pending bytes suppresses late status/decode and closes only its owned resource', async (t) => {
  const gate = deferred(),
    entered = deferred(),
    f = fixture(t, {
      onRead: () => {
        entered.resolve();
        return gate.promise;
      },
    });
  const pending = f.select(f.row);
  await entered.promise;
  f.pictures.dispose();
  const count = f.statuses.length;
  gate.resolve({ asset: releaseAsset, blob: new Blob([original]) });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.images.length, 0);
  assert.equal(f.statuses.length, count);
  assert.equal(f.pictures.current(), null);
  await assert.rejects(f.select(f.row), { name: 'AbortError' });
});

test('corrupt selected saved bytes fail before decoder and do not borrow the published default', async (t) => {
  const saved = await savedFixture(t),
    f = fixture(t, { indexedDB: saved.memory.indexedDB });
  await new Promise((resolve, reject) => {
    const open = saved.memory.indexedDB.open('revealline-soundtrack-v1', 4);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction(['mediaBlobs'], 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
      tx.objectStore('mediaBlobs').put(
        new Blob([new Uint8Array(saved.prepared.asset.bytes)]),
        saved.prepared.asset.sha256,
      );
    };
  });
  await assert.rejects(f.select(f.row), /SHA-256 differs/);
  assert.equal(f.images.length, 0);
  assert.equal(f.reads(), 0);
  assert.equal(f.pictures.current(), null);
});

test('stale pending release cannot replace a newer selection and its later original is ignored', async (t) => {
  const gate = deferred(),
    entered = deferred();
  let first = true;
  const f = fixture(t, {
    onRead: () => {
      if (first) {
        first = false;
        entered.resolve();
        return gate.promise;
      }
    },
  });
  const old = f.select(f.row);
  await entered.promise;
  const next = f.select(f.row, { raceId: 2 });
  gate.resolve({ asset: releaseAsset, blob: new Blob([original]) });
  await assert.rejects(old, { name: 'AbortError' });
  const result = await next;
  assert.equal(f.pictures.current() === result, true);
  assert.equal(f.images.length, 1);
  assert.throws(() => f.pictures.confirm(f.row, { raceId: 1 }), /Load the selected original/);
});

test('a changed borrowed backdrop is refused after capture rather than silently replacing the prepared original', async (t) => {
  const f = fixture(t, { snapshot: false });
  f.row.authoredBackground = {
    dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
    fit: 'contain',
  };
  f.row.backdrop = { image: { width: 1, height: 1 }, fit: 'contain' };
  await f.select(f.row);
  f.row.backdrop = { image: { width: 1, height: 1 }, fit: 'contain' };
  assert.throws(() => f.pictures.confirm(f.row, { raceId: 1 }), /authored picture changed/);
});

test('a reentrant status selection joins the published operation promise before starting a newer race', async (t) => {
  const f = fixture(t);
  let newer,
    replaced = false;
  const old = f.pictures.select(f.row, {
    raceId: 1,
    onStatus: () => {
      if (replaced) return;
      replaced = true;
      newer = f.pictures.select(f.row, { raceId: 2 }).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
    },
  });
  await assert.rejects(old, { name: 'AbortError' });
  const result = await newer;
  assert.ifError(result.error);
  assert.equal(result.value === f.pictures.current(), true);
  assert.equal(f.reads(), 1);
});

test('the 51 existing static combinations resolve exact authored owners without touching gameplay records', async (t) => {
  const source = await json('../content/packs/fpv-arcade-r5.json');
  const prepared = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const header = inspectImageDataUrl(dataUrl);
      assert.equal(header.valid, true);
      return { naturalWidth: header.width, naturalHeight: header.height };
    },
  });
  const featured = resolvePackCampaign(prepared.pack, 'fpv-pressure-lines');
  const entries = [baseEntry, featured],
    before = JSON.stringify(entries);
  const pictures = createCouchStaticPictures({
    entries,
    indexedDB: null,
    presentationPage: { ready: Promise.resolve(null), current: () => null },
  });
  t.after(() => pictures.dispose());
  const combinations = new Set();
  let raceId = 0;
  for (const entry of entries)
    for (const level of entry.campaign.levels)
      for (const theme of entry.themes) {
        const background =
          entry.levelVisuals?.find((row) => row.levelId === level.id)?.visualOverrides.background ??
          null;
        const header = background ? inspectImageDataUrl(background.dataUrl) : null;
        const row = {
          level,
          pictureEntry: entry,
          authoredBackground: background,
          defaultThemeId: theme.id,
          ...(background
            ? {
                backdrop: {
                  image: { width: header.width, height: header.height },
                  fit: background.fit,
                  sampling: 'nearest',
                },
              }
            : {}),
        };
        const result = await pictures.select(row, { raceId: ++raceId, themeId: theme.id });
        combinations.add(JSON.stringify(result.choice.identity));
        assert.equal(result.choice.identity.levelId, level.id);
        assert.equal(result.choice.identity.themeId, theme.id);
        assert.equal(pictures.confirm(row, { raceId }) === result, true);
      }
  assert.equal(combinations.size, 51);
  assert.equal(raceId, 51);
  assert.equal(JSON.stringify(entries), before);
});

// These transactions exercise real original-byte validation with finite image
// decoding. They do not certify browser decoding or visual appearance.
test('staged static picture retains the accepted original through confirmation and explicit handoff', async (t) => {
  const f = fixture(t),
    prior = await f.select(f.row);
  const stage = await f.pictures.stage(f.row, { raceId: 2 });
  assert.equal(f.pictures.current() === prior, true);
  assert.equal(prior.image.closed, 0);
  assert.throws(() => stage.commit(), /Confirm/);
  await stage.confirm();
  assert.equal(f.pictures.current() === prior, true);
  const retire = stage.commit();
  assert.equal(f.pictures.current() === stage.picture, true);
  assert.equal(
    prior.image.closed,
    0,
    'The host publishes its own references before retiring Results.',
  );
  stage.cancel();
  assert.equal(
    stage.picture.image.closed,
    0,
    'A committed ticket no longer owns its accepted image.',
  );
  retire();
  retire();
  assert.equal(prior.image.closed, 1);
  assert.equal(stage.picture.image.closed, 0);
  f.pictures.dispose();
  assert.equal(stage.picture.image.closed, 1);
  assert.equal(f.revoked.length, 2);
});

for (const action of ['cancel', 'abort', 'confirmation refusal'])
  test(`staged static ${action} releases only its candidate`, async (t) => {
    const f = fixture(t),
      prior = await f.select(f.row),
      controller = new AbortController();
    const stage = await f.pictures.stage(f.row, { raceId: 2, signal: controller.signal });
    if (action === 'abort') controller.abort();
    else if (action === 'cancel') stage.cancel();
    else {
      f.replaceSnapshot();
      await assert.rejects(stage.confirm(), /artwork changed/);
      stage.cancel();
    }
    assert.equal(f.pictures.current() === prior, true);
    assert.equal(prior.image.closed, 0);
    assert.equal(stage.picture.image.closed, 1);
    assert.throws(() => stage.commit());
    stage.cancel();
    assert.equal(stage.picture.image.closed, 1);
  });

test('cancelled pending static stage cannot release Results or replace a later stage', async (t) => {
  const f = fixture(t),
    prior = await f.select(f.row),
    gate = deferred(),
    entered = deferred();
  f.state.onDecode = () => {
    entered.resolve();
    return gate.promise;
  };
  const pending = f.pictures.stage(f.row, { raceId: 2 });
  await entered.promise;
  f.pictures.cancel();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.pictures.current() === prior, true);
  assert.equal(prior.image.closed, 0);
  f.state.onDecode = null;
  const next = await f.pictures.stage(f.row, { raceId: 2 });
  gate.resolve();
  await next.confirm();
  const retire = next.commit();
  retire();
  assert.equal(f.pictures.current() === next.picture, true);
  assert.equal(f.images[1].closed, 1);
  assert.equal(prior.image.closed, 1);
  assert.equal(next.picture.image.closed, 0);
});

for (const action of ['cancel', 'dispose'])
  test(`static staged ready callback ${action} cannot publish or leak a candidate`, async (t) => {
    const f = fixture(t),
      prior = await f.select(f.row);
    await assert.rejects(
      f.pictures.stage(f.row, {
        raceId: 2,
        onStatus(status) {
          if (status.status === 'ready') f.pictures[action]();
        },
      }),
      { name: 'AbortError' },
    );
    assert.equal(prior.image.closed, action === 'dispose' ? 1 : 0);
    assert.equal(f.images[1].closed, 1);
    assert.equal(f.pictures.current() === (action === 'dispose' ? null : prior), true);
  });

test('static final context callback cancellation refuses adoption after its last reader', async (t) => {
  const f = fixture(t),
    prior = await f.select(f.row);
  const stage = await f.pictures.stage(f.row, { raceId: 2 });
  const current = f.page.current;
  f.page.current = () => {
    f.pictures.cancel();
    return current();
  };
  await assert.rejects(stage.confirm(), { name: 'AbortError' });
  assert.equal(f.pictures.current() === prior, true);
  assert.equal(prior.image.closed, 0);
  assert.equal(stage.picture.image.closed, 1);
});

test('static previous-image cleanup sees the adopted owner and disposal releases both once', async (t) => {
  const f = fixture(t),
    prior = await f.select(f.row);
  const stage = await f.pictures.stage(f.row, { raceId: 2 });
  await stage.confirm();
  const originalClose = prior.image.close.bind(prior.image);
  let sawAccepted = false;
  prior.image.close = () => {
    sawAccepted = f.pictures.current() === stage.picture;
    originalClose();
    f.pictures.dispose();
  };
  const retire = stage.commit();
  retire();
  retire();
  assert.equal(sawAccepted, true);
  assert.equal(prior.image.closed, 1);
  assert.equal(stage.picture.image.closed, 1);
  assert.equal(f.revoked.length, 2);
});

test('static disposal also retires a committed prior lease if its host handoff is interrupted', async (t) => {
  const f = fixture(t),
    prior = await f.select(f.row);
  const stage = await f.pictures.stage(f.row, { raceId: 2 });
  await stage.confirm();
  const retire = stage.commit();
  f.pictures.dispose();
  retire();
  assert.equal(prior.image.closed, 1);
  assert.equal(stage.picture.image.closed, 1);
  assert.equal(f.revoked.length, 2);
});
