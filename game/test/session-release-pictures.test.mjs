import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import {
  createMediaIdentityCatalog,
  MEDIA_PRESENTATION_FORMAT,
  STILL_ASSET_FORMAT,
} from '../media-library.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { FORMATS } from '../presentation/model.mjs';
import {
  createSessionReleasePictures,
  SESSION_RELEASE_PICTURE_BYTES,
} from '../presentation/session-release-pictures.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { importMediaBundle } from '../media-bundle.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';

const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = JSON.parse(
  await readFile(new URL('../content/classes.json', import.meta.url)),
);
const catalog = createExecutionCatalog([{ campaign, themes: [{ id: 'fpv' }, { id: 'ukraine' }] }]);
const identityCatalog = createMediaIdentityCatalog(catalog);
const entry = catalog.entries.find((row) => row.difficulty === 'standard');
const owners = campaign.levels.map((level) =>
  CURRENT_PICTURES.find(
    (row) =>
      row.owner.baseCampaignKey === entry.baseCampaignKey &&
      row.owner.levelId === level.id &&
      row.owner.themeId === 'fpv',
  ),
);
assert(owners.every(Boolean));
async function until(predicate) {
  for (let i = 0; i < 1000; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert(predicate(), 'Expected bounded operation boundary');
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decodeImage = async (blob) => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
};
// A genuine ancillary PNG text chunk retains valid one-pixel image bytes. Large
// fixtures exercise actual byte/hash budgets without claiming native decoding.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
function imageBytes(marker, total = 160) {
  const original = pngBytes();
  const payload = Buffer.alloc(total - original.length - 12, 120);
  payload.write(`fixture\0${marker}`);
  const type = Buffer.from('tEXt'),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  let value = 0xffffffff;
  for (const bytes of [type, payload])
    for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  crc.writeUInt32BE((value ^ 0xffffffff) >>> 0);
  return Buffer.concat([
    original.subarray(0, -12),
    length,
    type,
    payload,
    crc,
    original.subarray(-12),
  ]);
}
function addition(index = 0, bytes = imageBytes('first')) {
  const owner = owners[index],
    file = { sha256: digest(bytes), bytes: bytes.length, mime: 'image/png', width: 1, height: 1 };
  const art = {
    format: FORMATS.asset,
    id: `test.session-${index}`,
    revision: 1,
    kind: 'image',
    description: 'Explicit PNG fixture; no artwork approval.',
    provenance: {
      creator: 'Test',
      source: 'Owned test pixels',
      license: 'Test only',
      prompt: '',
      parent: null,
    },
    file,
    recipe: null,
    quality: { stage: 'produced', evidence: [] },
    geometry: {
      frame: { x: 0, y: 0, width: 1, height: 1 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
  };
  const asset = {
    format: STILL_ASSET_FORMAT,
    id: `fk-art-${file.sha256}`,
    ...file,
    provenance: { kind: 'original', credit: 'Test', source: 'Owned test pixels' },
  };
  const id = `fk-picture-${digest(canonicalJSON({ identity: owner.owner, sha256: file.sha256, fit: 'contain', sampling: 'nearest' }))}`;
  const presentation = {
    format: MEDIA_PRESENTATION_FORMAT,
    id,
    revision: 1,
    identity: owner.owner,
    poster: { assetId: asset.id, fit: 'contain', sampling: 'nearest' },
    story: null,
    description: 'Exact session original.',
  };
  return {
    row: {
      choice: { slotId: owner.id, label: owner.label, identity: owner.owner, asset: art },
      asset,
      presentation,
      assignment: { identity: owner.owner, presentationId: id, revision: 1 },
    },
    original: { sha256: file.sha256, blob: new Blob([bytes], { type: 'image/png' }) },
    pin: {
      kind: 'still',
      identity: owner.owner,
      presentationId: id,
      presentationRevision: 1,
      assetId: asset.id,
      sha256: file.sha256,
    },
  };
}
function fixture(t, options = {}) {
  const urls = new Map(),
    released = [],
    images = [];
  let next = 0;
  const URLImpl = {
    createObjectURL(blob) {
      const url = `blob:session-${++next}`;
      urls.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      assert(urls.delete(url), 'URL released exactly once');
      released.push(url);
    },
  };
  class Image {
    constructor() {
      images.push(this);
      this.closed = 0;
    }
    set src(url) {
      this.source = url;
      void urls
        .get(url)
        .arrayBuffer()
        .then((raw) => {
          const bytes = Buffer.from(raw);
          this.sha256 = digest(bytes);
          this.width = this.naturalWidth = bytes.readUInt32BE(16);
          this.height = this.naturalHeight = bytes.readUInt32BE(20);
          this.onload?.();
        });
    }
    decode() {
      return Promise.resolve();
    }
    removeAttribute() {
      this.source = '';
      this.closed++;
    }
  }
  const registry = createSessionReleasePictures({
    decodeImage,
    URLImpl,
    ImageClass: Image,
    ...options,
  });
  t.after(() => {
    registry.dispose();
    assert.equal(urls.size, 0);
  });
  const stage = (items, extra = {}) =>
    registry.stage(
      items.map((item) => item.row),
      items.map((item) => item.original),
      { executionCatalog: catalog, ...extra },
    );
  return { registry, stage, urls, released, images };
}

test('verified multi-world stage accepts without acquiring an unselected FPV drawable; it is explicitly session-only', async (t) => {
  const f = fixture(t),
    item = addition(),
    stage = await f.stage([item]);
  assert.equal(f.registry.has(item.pin), false);
  assert.equal(stage.has(item.pin), true);
  assert(Object.isFrozen(stage.library));
  assert.deepEqual(stage.document.library.assignments, []);
  const pins = createPresentationPins({
    library: stage.library,
    identityCatalog,
    executionKey: entry.executionKey,
    levelId: campaign.levels[0].id,
    levelRevision: campaign.levels[0].revision,
    themeIds: ['ukraine', 'fpv'],
  });
  assert.equal(pins.choices[0].kind, 'legacy');
  assert.deepEqual(pins.choices[1], item.pin);
  assert.equal(f.urls.size, 0);
  const accepted = stage.accept();
  assert.equal(accepted.scope, 'session');
  assert.equal(Object.hasOwn(accepted, 'generation'), false);
  assert.equal(f.registry.has(item.pin), true);
  assert.equal(stage.discard(), false);
  assert.equal(f.registry.status().bytes, item.original.blob.size);
});

test('accepted exact history survives disposable flight leases and newer artwork; export/import retains every original without assignments', async (t) => {
  const f = fixture(t),
    first = addition(),
    second = addition(0, imageBytes('second'));
  (await f.stage([first])).accept();
  const old = await f.registry.acquire(first.pin);
  assert.equal(old.image.sha256, first.pin.sha256);
  old.release();
  old.release();
  (await f.stage([second])).accept();
  const retry = await f.registry.acquire(first.pin),
    current = await f.registry.acquire(second.pin);
  assert.equal(retry.image.sha256, first.pin.sha256);
  assert.equal(current.image.sha256, second.pin.sha256);
  retry.release();
  current.release();
  const bytes = await f.registry.exportBundle();
  const imported = await importMediaBundle(bytes, { decodeImage });
  assert.equal(imported.document.library.presentations.length, 2);
  assert.deepEqual(imported.document.library.assignments, []);
  assert.deepEqual(imported.document, f.registry.metadata().document);
  for (const item of [first, second]) {
    const original = imported.assets.find((row) => row.sha256 === item.pin.sha256);
    assert.deepEqual(
      new Uint8Array(await original.blob.arrayBuffer()),
      new Uint8Array(await item.original.blob.arrayBuffer()),
    );
  }
  assert.equal(
    digest(Buffer.from(await bytes.arrayBuffer())),
    digest(Buffer.from(await (await f.registry.exportBundle()).arrayBuffer())),
  );
});

test('exact repeat needs no new payload; conflicts, unknown pins and tampered known pins reject', async (t) => {
  const f = fixture(t),
    item = addition();
  (await f.stage([item])).accept();
  const stage = await f.registry.stage([item.row, item.row], [], { executionCatalog: catalog });
  stage.accept();
  assert.equal(f.registry.metadata().document.library.assets.length, 1);
  assert.equal(f.registry.status().bytes, item.original.blob.size);
  const changed = structuredClone(item.row);
  changed.asset.provenance.credit = 'Changed';
  await assert.rejects(
    f.registry.stage([changed], [], { executionCatalog: catalog }),
    /Conflicting immutable/,
  );
  const tampered = { ...item.pin, sha256: 'f'.repeat(64) };
  assert.equal(f.registry.has(tampered), true);
  await assert.rejects(f.registry.acquire(tampered), /saved picture revision is missing/);
  assert.equal(f.registry.has({ ...item.pin, presentationId: 'unknown' }), false);
  await assert.rejects(
    f.registry.acquire({ ...item.pin, identity: { ...item.pin.identity, themeId: 'ukraine' } }),
    /saved picture revision is missing/,
  );
  await assert.rejects(
    f.registry.acquire({ ...item.pin, presentationId: 'unknown' }),
    /does not own/,
  );
  assert.equal(f.urls.size, 0);
});

test('stale simultaneous stages and canceled acquired stages cannot publish or leak their decoded lease', async (t) => {
  const f = fixture(t),
    a = addition(),
    b = addition(1, imageBytes('b'));
  const first = await f.stage([a]),
    second = await f.stage([b]);
  await assert.rejects(f.stage([b]), /pending session/);
  const lease = await second.acquire(b.pin);
  first.accept();
  assert.throws(() => second.accept(), /stale/);
  second.discard();
  assert.equal(lease.image.source, '');
  assert.equal(f.registry.has(b.pin), false);
  assert.equal(f.registry.status().reservedBytes, 0);
  const controller = new AbortController();
  const canceled = await f.stage([b], { signal: controller.signal });
  await canceled.acquire(b.pin);
  controller.abort();
  assert.throws(() => canceled.accept(), /cancelled/);
  assert.equal(f.urls.size, 0);
  assert.equal(f.registry.has(a.pin), true);
});

test('abort while verifier ignores cancellation holds its reservation until settlement and preserves accepted state', async (t) => {
  const gate = deferred();
  let entered;
  const f = fixture(t, {
    decodeImage: async (blob) => {
      entered = true;
      await gate.promise;
      return decodeImage(blob);
    },
  });
  const controller = new AbortController(),
    item = addition();
  const pending = f.stage([item], { signal: controller.signal });
  await until(() => entered);
  controller.abort();
  assert.equal(f.registry.status().reservedBytes, item.original.blob.size);
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.registry.status().bytes, 0);
  assert.equal(f.registry.status().reservedBytes, 0);
  assert.equal(f.registry.status().pendingStages, 0);
});

test('immutable snapshot ownership rejects caller mutations, incorrect metadata, bytes and release identities atomically', async (t) => {
  const f = fixture(t),
    item = addition();
  const row = structuredClone(item.row);
  const pending = f.registry.stage([row], [item.original], { executionCatalog: catalog });
  row.asset.sha256 = 'a'.repeat(64);
  (await pending).accept();
  const stable = f.registry.metadata();
  const bads = [];
  const wrongSize = structuredClone(item.row);
  wrongSize.asset.bytes++;
  bads.push([wrongSize, item.original]);
  const wrongMime = structuredClone(item.row);
  wrongMime.asset.mime = 'image/jpeg';
  bads.push([wrongMime, item.original]);
  const wrongIdentity = structuredClone(item.row);
  wrongIdentity.choice.identity.levelRevision = 'foreign';
  bads.push([wrongIdentity, item.original]);
  const wrongHash = { sha256: item.pin.sha256, blob: new Blob([imageBytes('corrupt')]) };
  bads.push([item.row, wrongHash]);
  const header = Buffer.from(await item.original.blob.arrayBuffer());
  header.writeUInt32BE(2, 16);
  const wrongHeader = addition(1, header);
  bads.push([wrongHeader.row, wrongHeader.original]);
  const malformed = addition(1, Buffer.alloc(160, 4));
  bads.push([malformed.row, malformed.original]);
  for (const [bad, original] of bads) {
    await assert.rejects(f.registry.stage([bad], [original], { executionCatalog: catalog }));
    assert.deepEqual(f.registry.metadata(), stable);
    assert.equal(f.registry.status().reservedBytes, 0);
  }
  await assert.rejects(
    f.registry.stage([item.row], [item.original, item.original], { executionCatalog: catalog }),
    /duplicate/,
  );
  await assert.rejects(
    f.stage([addition(1)], { executionCatalog: createExecutionCatalog([]) }),
    /identity|owner|known|catalog/i,
  );
});

test('actual 32 MiB cumulative originals cap includes pending reservations and never evicts accepted history', async (t) => {
  const f = fixture(t);
  const items = Array.from({ length: 8 }, (_, index) =>
    addition(index, imageBytes(`large-${index}`, 4 * 1024 * 1024)),
  );
  const stage = await f.stage(items);
  assert.equal(f.registry.status().reservedBytes, SESSION_RELEASE_PICTURE_BYTES);
  await assert.rejects(f.stage([addition(8)]), /32 MiB/);
  stage.accept();
  assert.equal(f.registry.status().bytes, SESSION_RELEASE_PICTURE_BYTES);
  assert.equal(f.registry.status().originals, 8);
  await assert.rejects(f.stage([addition(8)]), /32 MiB/);
  assert.equal(f.registry.metadata().document.library.presentations.length, 8);
  const repeat = await f.registry.stage([items[0].row], [], { executionCatalog: catalog });
  repeat.accept();
  assert.equal(f.registry.status().bytes, SESSION_RELEASE_PICTURE_BYTES);
});

test('late ignored drawable decode after discard is released once; registry disposal retires accepted and pending leases', async (t) => {
  const f = fixture(t),
    item = addition(),
    stage = await f.stage([item]),
    gate = deferred();
  let started = false;
  const image = {
    width: 1,
    height: 1,
    naturalWidth: 1,
    naturalHeight: 1,
    releases: 0,
    removeAttribute() {
      this.releases++;
    },
  };
  const promise = stage.acquire(item.pin, {
    decodeImage: async () => {
      started = true;
      await gate.promise;
      return image;
    },
  });
  await until(() => started);
  stage.discard();
  await assert.rejects(promise, { name: 'AbortError' });
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(image.releases, 1);
  assert.equal(f.urls.size, 0);
  (await f.stage([item])).accept();
  const accepted = await f.registry.acquire(item.pin);
  f.registry.dispose();
  assert.equal(accepted.image.source, '');
  accepted.release();
  await assert.rejects(f.registry.acquire(item.pin), /closed/);
  assert.throws(() => f.registry.metadata(), /closed/);
  assert.equal(f.registry.status().bytes, 0);
});

test('export cancellation or concurrent acceptance cannot return a misleading complete snapshot; no persistent capabilities are used', async (t) => {
  let persistentCalls = 0;
  const forbidden = () => {
    persistentCalls++;
    throw new Error('Persistent capability must not be used');
  };
  for (const [name, value] of Object.entries({
    indexedDB: { open: forbidden },
    localStorage: { setItem: forbidden },
    navigator: { locks: { request: forbidden } },
  })) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() =>
      prior ? Object.defineProperty(globalThis, name, prior) : delete globalThis[name],
    );
  }
  const f = fixture(t),
    item = addition();
  (await f.stage([item])).accept();
  const next = await f.stage([addition(1, imageBytes('next'))]);
  const gate = deferred();
  let entered;
  const exporting = f.registry.exportBundle({
    decodeImage: async (blob) => {
      entered = true;
      await gate.promise;
      return decodeImage(blob);
    },
  });
  await until(() => entered);
  next.accept();
  gate.resolve();
  await assert.rejects(exporting, /changed during export/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(f.registry.exportBundle({ signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(persistentCalls, 0);
  assert.equal(f.registry.metadata().document.library.assignments.length, 0);
});

test('decoded dimensions and metadata cardinality refuse without accepting partial history', async (t) => {
  const f = fixture(t, { decodeImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }) });
  await assert.rejects(f.stage([addition()]), /Decoded still dimensions/);
  assert.equal(f.registry.status().originals, 0);
  assert.equal(f.registry.status().reservedBytes, 0);
  const item = addition();
  await assert.rejects(
    f.registry.stage(
      Array.from({ length: 257 }, () => item.row),
      [],
      { executionCatalog: catalog },
    ),
    /bounded additions/,
  );
  assert.equal(f.registry.status().pendingStages, 0);
});
