import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import {
  COOP_PRESENTATION_FORMAT,
  COOP_PRESENTATION_MIME,
  COOP_PRESENTATION_LIMITS,
  readCoopPresentationEnvelope,
  readCoopPresentationPicture,
  exportCoopPresentationEnvelope,
  disposeCoopPresentationEnvelope,
} from '../coop/presentation-envelope.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const MiB = 1024 * 1024;
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
};
function png(mark = 0, width = 1152, height = 576) {
  // Complete compressed PNG bytes with correct CRCs, generated in memory only.
  // The injected decoder below is modeled; these tests do not certify browsers.
  const chunk = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, bytes, tail]);
  };
  const header = Buffer.alloc(13),
    pixels = Buffer.alloc((width * 4 + 1) * height);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  pixels[1] = mark;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const pictures = [png(0), png(197)];
function fixture({ pack = structuredClone(COOP_STARTER_PACK), images = pictures } = {}) {
  pack = structuredClone(pack);
  pack.id = 'local-team-envelope-test';
  const byHash = new Map(images.map((bytes) => [sha(bytes), bytes]));
  const assets = [...byHash]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hash, bytes]) => ({
      sha256: hash,
      bytes: bytes.length,
      mime: 'image/png',
      width: 1152,
      height: 576,
      provenance: {
        kind: 'user-supplied',
        attribution: 'Synthetic test fixture',
        source: 'Memory',
      },
    }));
  const manifest = {
    format: 'revealline-team-presentation-envelope.v1',
    pack,
    packSha256: sha(canonicalJSON(pack)),
    presentation: {
      id: 'local.test-art',
      revision: 1,
      theme: { id: 'fpv', revision: 32, collection: null },
      levels: pack.levels.map((level, i) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: sha(canonicalJSON(level)),
        pictureSha256: sha(images[i % images.length]),
      })),
      assets,
    },
  };
  return { manifest, byHash, payload: assets.map((asset) => byHash.get(asset.sha256)) };
}
function envelope(
  f,
  { manifest = f.manifest, rawManifest, payload = f.payload, trailing = [] } = {},
) {
  const manifestBytes = rawManifest ?? Buffer.from(JSON.stringify(manifest, null, 2));
  const header = Buffer.alloc(12);
  header.write('RLTEAM1\n', 'ascii');
  header.writeUInt32BE(manifestBytes.length, 8);
  return new Blob([header, manifestBytes, ...payload, ...trailing], {
    type: COOP_PRESENTATION_MIME,
  });
}
function decoder() {
  const seen = [],
    releases = [];
  let live = 0,
    peak = 0;
  return {
    seen,
    releases,
    get live() {
      return live;
    },
    get peak() {
      return peak;
    },
    async decodeImage(blob) {
      assert.ok(blob instanceof Blob);
      assert.equal(blob.type, 'image/png');
      const index = seen.length;
      seen.push(sha(new Uint8Array(await Blob.prototype.arrayBuffer.call(blob))));
      live++;
      peak = Math.max(peak, live);
      return {
        image: { naturalWidth: 1152, naturalHeight: 576 },
        release() {
          releases.push(index);
          live--;
        },
      };
    },
  };
}
function frozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) frozen(child);
}
async function rejectsFixture(f, options = {}) {
  const d = decoder();
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(f, options), { decodeImage: d.decodeImage }),
  );
  assert.equal(d.live, 0, 'failed validation cannot retain qualification decodes');
}

test('format limits match the bounded transfer contract', () => {
  assert.equal(COOP_PRESENTATION_FORMAT, 'revealline-team-presentation-envelope.v1');
  assert.equal(COOP_PRESENTATION_MIME, 'application/vnd.revealline.team-presentation');
  assert.deepEqual(COOP_PRESENTATION_LIMITS, {
    manifestBytes: 2 * MiB,
    bundleBytes: 32 * MiB,
    bodyBytes: 24 * MiB,
    assetBytes: 4 * MiB,
    assets: 24,
    width: 1152,
    height: 576,
  });
});

test('two-level import validates every picture sequentially, exposes frozen identity, and exports original bytes', async () => {
  const f = fixture(),
    d = decoder(),
    stages = [];
  const rawManifest = Buffer.from(` \n${JSON.stringify(f.manifest, null, 2)}\n `);
  const input = envelope(f, { rawManifest });
  const original = Buffer.from(await input.arrayBuffer());
  const owner = await readCoopPresentationEnvelope(input, {
    decodeImage: d.decodeImage,
    onProgress: (progress) => stages.push(progress.stage),
  });
  try {
    assert.deepEqual(owner.pack, f.manifest.pack);
    assert.deepEqual(Object.keys(owner).sort(), ['pack', 'receipt']);
    frozen(owner);
    assert.equal(owner.receipt.sourceKind, 'local-import');
    assert.equal(owner.receipt.format, COOP_PRESENTATION_FORMAT);
    assert.deepEqual(owner.receipt.presentation, { id: 'local.test-art', revision: 1 });
    assert.equal(owner.receipt.manifestSha256, sha(rawManifest));
    assert.equal(owner.receipt.packSha256, f.manifest.packSha256);
    assert.deepEqual(owner.receipt.theme, f.manifest.presentation.theme);
    assert.deepEqual(owner.receipt.assets, f.manifest.presentation.assets);
    assert.deepEqual(
      d.seen,
      f.manifest.presentation.assets.map((asset) => asset.sha256),
    );
    assert.deepEqual(d.releases, [0, 1]);
    assert.equal(d.live, 0);
    assert.equal(d.peak, 1, 'qualification must not retain a decoded picture cache');
    assert.equal(stages[0], 'manifest');
    assert.equal(stages.at(-1), 'ready');
    assert.equal(stages.filter((stage) => stage === 'checking-picture').length, 2);
    for (const [index, level] of owner.pack.levels.entries()) {
      const picture = await readCoopPresentationPicture(owner, structuredClone(level));
      const expectedHash = f.manifest.presentation.levels[index].pictureSha256;
      assert.equal(picture.file.sha256, expectedHash);
      assert.ok(picture.blob instanceof Blob);
      assert.equal(sha(new Uint8Array(await picture.blob.arrayBuffer())), expectedHash);
    }
    const exported = await exportCoopPresentationEnvelope(owner);
    assert.ok(exported instanceof Blob);
    assert.deepEqual(Buffer.from(await exported.arrayBuffer()), original);
    assert.throws(() => {
      owner.pack.levels[0].name = 'Changed';
    }, TypeError);
    f.manifest.pack.name = 'Changed outside owner';
    assert.notEqual(owner.pack.name, f.manifest.pack.name);
  } finally {
    disposeCoopPresentationEnvelope(owner);
  }
});

test('one source picture may be shared by two levels without duplicate decoding or payload', async () => {
  const f = fixture({ images: [pictures[0]] }),
    d = decoder();
  const owner = await readCoopPresentationEnvelope(envelope(f), { decodeImage: d.decodeImage });
  try {
    assert.equal(d.seen.length, 1);
    const first = await readCoopPresentationPicture(owner, owner.pack.levels[0]);
    const second = await readCoopPresentationPicture(owner, owner.pack.levels[1]);
    assert.equal(first.file.sha256, second.file.sha256);
  } finally {
    disposeCoopPresentationEnvelope(owner);
  }
});

test('historical level IDs and revision types survive the presentation wrapper unchanged', async () => {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.levels[0].id = `Field ${'x'.repeat(94)}`;
  pack.levels[0].revision = '2';
  pack.levels[1].id = 'Relay Yard';
  pack.levels[1].revision = 2;
  const f = fixture({ pack }),
    d = decoder();
  const owner = await readCoopPresentationEnvelope(envelope(f), { decodeImage: d.decodeImage });
  try {
    assert.equal(owner.pack.levels[0].id.length, 100);
    assert.equal(owner.pack.levels[0].revision, '2');
    assert.equal(owner.pack.levels[1].revision, 2);
    await readCoopPresentationPicture(owner, structuredClone(owner.pack.levels[0]));
    const changed = { ...owner.pack.levels[0], revision: 2 };
    await assert.rejects(async () => readCoopPresentationPicture(owner, changed));
    await assert.rejects(async () =>
      readCoopPresentationPicture(owner, {
        ...owner.pack.levels[1],
        name: 'Same ID, different authored level',
      }),
    );
  } finally {
    disposeCoopPresentationEnvelope(owner);
  }
});

for (const [name, change] of [
  [
    'unknown envelope format',
    (m) => {
      m.format += '.future';
    },
  ],
  [
    'unknown top-level field',
    (m) => {
      m.url = 'https://example.invalid/art';
    },
  ],
  [
    'extra gameplay art field',
    (m) => {
      m.pack.levels[0].picture = {};
    },
  ],
  [
    'wrong canonical pack hash',
    (m) => {
      m.packSha256 = '0'.repeat(64);
    },
  ],
  [
    'wrong canonical level hash',
    (m) => {
      m.presentation.levels[0].levelSha256 = '0'.repeat(64);
    },
  ],
  [
    'string/numeric mapping revision alias',
    (m) => {
      m.presentation.levels[0].levelRevision = '2';
    },
  ],
  [
    'missing level mapping',
    (m) => {
      m.presentation.levels.pop();
    },
  ],
  [
    'duplicate level mapping',
    (m) => {
      m.presentation.levels[1] = structuredClone(m.presentation.levels[0]);
    },
  ],
  [
    'orphan level mapping',
    (m) => {
      m.presentation.levels[0].levelId = 'absent-level';
    },
  ],
  [
    'dangling picture mapping',
    (m) => {
      m.presentation.levels[0].pictureSha256 = '0'.repeat(64);
    },
  ],
  [
    'missing referenced asset',
    (m) => {
      m.presentation.assets.pop();
    },
  ],
  [
    'duplicate asset declaration',
    (m) => {
      m.presentation.assets.push(structuredClone(m.presentation.assets[0]));
    },
  ],
  [
    'unsorted asset declarations',
    (m) => {
      m.presentation.assets.reverse();
    },
  ],
  [
    'uploaded approval claim',
    (m) => {
      m.presentation.assets[0].quality = { stage: 'reviewed', evidence: ['Claim'] };
    },
  ],
  [
    'unsupported provenance kind',
    (m) => {
      m.presentation.assets[0].provenance.kind = 'reviewed';
    },
  ],
  [
    'empty attribution',
    (m) => {
      m.presentation.assets[0].provenance.attribution = '  ';
    },
  ],
  [
    'overlong attribution',
    (m) => {
      m.presentation.assets[0].provenance.attribution = 'x'.repeat(513);
    },
  ],
  [
    'overlong provenance source',
    (m) => {
      m.presentation.assets[0].provenance.source = 'x'.repeat(2049);
    },
  ],
  [
    'invalid presentation identifier',
    (m) => {
      m.presentation.id = 'x'.repeat(81);
    },
  ],
  [
    'out-of-range presentation revision',
    (m) => {
      m.presentation.revision = 1000001;
    },
  ],
  [
    'unsafe theme revision',
    (m) => {
      m.presentation.theme.revision = Number.MAX_SAFE_INTEGER + 1;
    },
  ],
  [
    'unknown theme field',
    (m) => {
      m.presentation.theme.current = true;
    },
  ],
  [
    'invalid collection reference',
    (m) => {
      m.presentation.theme.collection = { id: 'draft', revision: 0 };
    },
  ],
  [
    'non-production dimensions',
    (m) => {
      m.presentation.assets[0].width = 1151;
    },
  ],
  [
    'unsupported image MIME',
    (m) => {
      m.presentation.assets[0].mime = 'image/svg+xml';
    },
  ],
  [
    'over-budget image size',
    (m) => {
      m.presentation.assets[0].bytes = 4 * MiB + 1;
    },
  ],
]) {
  test(`rejects ${name} without retaining a decoded image`, async () => {
    const f = fixture();
    change(f.manifest);
    await rejectsFixture(f);
  });
}

test('unused but otherwise valid picture assets are refused', async () => {
  const f = fixture({ images: [...pictures, png(29)] });
  await rejectsFixture(f);
});

test('changing only custom pixels changes the source receipt while preserving gameplay identity', async () => {
  const first = fixture(),
    second = fixture({ images: [png(30), png(31)] });
  const a = await readCoopPresentationEnvelope(envelope(first), {
    decodeImage: decoder().decodeImage,
  });
  const b = await readCoopPresentationEnvelope(envelope(second), {
    decodeImage: decoder().decodeImage,
  });
  try {
    assert.deepEqual(a.pack, b.pack);
    assert.equal(a.receipt.packSha256, b.receipt.packSha256);
    assert.deepEqual(a.receipt.presentation, b.receipt.presentation);
    assert.notEqual(a.receipt.manifestSha256, b.receipt.manifestSha256);
    assert.notDeepEqual(a.receipt.assets, b.receipt.assets);
  } finally {
    disposeCoopPresentationEnvelope(a);
    disposeCoopPresentationEnvelope(b);
  }
});

for (const [name, build] of [
  ['truncated header', () => new Blob([Buffer.from('RLTEAM1')])],
  ['unknown magic', () => new Blob([Buffer.from('NOTTEAM1'), Buffer.alloc(4)])],
  ['truncated body', (f) => envelope(f).slice(0, envelope(f).size - 1)],
  ['reordered bodies', (f) => envelope(f, { payload: [...f.payload].reverse() })],
  ['duplicated body', (f) => envelope(f, { payload: [f.payload[0], f.payload[0]] })],
  ['trailing payload', (f) => envelope(f, { trailing: [Buffer.from([0])] })],
  [
    'malformed UTF-8 manifest',
    (f) => envelope(f, { rawManifest: Buffer.from([123, 195, 40, 125]) }),
  ],
  [
    'corrupted image body',
    (f) => {
      const broken = Buffer.from(f.payload[0]);
      broken[broken.length - 1] ^= 1;
      return envelope(f, { payload: [broken, f.payload[1]] });
    },
  ],
]) {
  test(`rejects ${name}`, async () => {
    const d = decoder();
    await assert.rejects(
      readCoopPresentationEnvelope(build(fixture()), { decodeImage: d.decodeImage }),
    );
    assert.equal(d.live, 0);
  });
}

test('declared manifest budget is checked before a missing oversized manifest can be read', async () => {
  const header = Buffer.alloc(12);
  header.write('RLTEAM1\n', 'ascii');
  header.writeUInt32BE(2 * MiB + 1, 8);
  const d = decoder();
  await assert.rejects(
    readCoopPresentationEnvelope(new Blob([header]), { decodeImage: d.decodeImage }),
  );
  assert.equal(d.seen.length, 0);
});

test('outer container budget rejects an oversized native Blob without decoding', async () => {
  const input = new Blob([new Uint8Array(32 * MiB + 1)]),
    d = decoder();
  await assert.rejects(
    readCoopPresentationEnvelope(input, { decodeImage: d.decodeImage }),
    /file size/i,
  );
  assert.equal(d.seen.length, 0);
});

test('aggregate picture-body budget is independent of the per-image and outer limits', async () => {
  const f = fixture();
  const images = Array.from({ length: 7 }, (_, i) => {
    const bytes = Buffer.alloc(4 * MiB);
    bytes[0] = i;
    return bytes;
  });
  f.manifest.pack.levels = Array.from({ length: 7 }, (_, i) => ({
    ...structuredClone(f.manifest.pack.levels[0]),
    id: `area-${i}`,
  }));
  f.manifest.packSha256 = sha(canonicalJSON(f.manifest.pack));
  f.manifest.presentation.levels = f.manifest.pack.levels.map((level, i) => ({
    levelId: level.id,
    levelRevision: level.revision,
    levelSha256: sha(canonicalJSON(level)),
    pictureSha256: sha(images[i]),
  }));
  const byHash = new Map(images.map((bytes) => [sha(bytes), bytes]));
  f.manifest.presentation.assets = [...byHash]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hash, bytes]) => ({
      ...f.manifest.presentation.assets[0],
      sha256: hash,
      bytes: bytes.length,
    }));
  const input = envelope(f, {
    payload: f.manifest.presentation.assets.map((asset) => byHash.get(asset.sha256)),
  });
  assert.ok(input.size < 32 * MiB);
  const d = decoder();
  await assert.rejects(
    readCoopPresentationEnvelope(input, { decodeImage: d.decodeImage }),
    /combined image budget/i,
  );
  assert.equal(d.seen.length, 0);
});

test('header dimensions cannot be authenticated by a matching hash alone', async () => {
  const f = fixture({ images: [png(0, 1151), pictures[1]] }),
    d = decoder();
  await assert.rejects(readCoopPresentationEnvelope(envelope(f), { decodeImage: d.decodeImage }));
  assert.equal(d.live, 0);
});

test('a decoder dimension mismatch releases its returned lease exactly once', async () => {
  let calls = 0,
    releases = 0;
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(fixture()), {
      async decodeImage() {
        calls++;
        return { image: { naturalWidth: 1151, naturalHeight: 576 }, release: () => releases++ };
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(releases, 1);
});

test('a later decode failure retains no earlier qualification image', async () => {
  let calls = 0,
    releases = 0;
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(fixture()), {
      async decodeImage() {
        if (++calls === 2) throw new Error('Modeled decoder failure');
        return { image: { naturalWidth: 1152, naturalHeight: 576 }, release: () => releases++ };
      },
    }),
    /Modeled decoder failure/,
  );
  assert.equal(calls, 2);
  assert.equal(releases, 1);
});

test('missing decoder or missing decoder ownership handle cannot qualify custom artwork', async () => {
  await assert.rejects(readCoopPresentationEnvelope(envelope(fixture()), {}));
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(fixture()), {
      decodeImage: async () => ({ image: { naturalWidth: 1152, naturalHeight: 576 } }),
    }),
  );
});

test('already cancelled import performs no qualification decode', async () => {
  const controller = new AbortController(),
    d = decoder();
  controller.abort();
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(fixture()), {
      signal: controller.signal,
      decodeImage: d.decodeImage,
    }),
    { name: 'AbortError' },
  );
  assert.equal(d.seen.length, 0);
});

test('cancellation during a native-like pending decode waits for settlement then releases once', async () => {
  const controller = new AbortController(),
    entered = deferred(),
    pending = deferred();
  let calls = 0,
    releases = 0;
  const reading = readCoopPresentationEnvelope(envelope(fixture()), {
    signal: controller.signal,
    async decodeImage() {
      calls++;
      entered.resolve();
      await pending.promise;
      return { image: { naturalWidth: 1152, naturalHeight: 576 }, release: () => releases++ };
    },
  });
  await entered.promise;
  let settled = false;
  void reading.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  controller.abort();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'owned native decode stays accounted for until it settles');
  pending.resolve();
  await assert.rejects(reading, { name: 'AbortError' });
  assert.equal(calls, 1, 'no later body starts after cancelled qualification');
  assert.equal(releases, 1);
});

for (const stage of ['manifest', 'checking-picture', 'ready']) {
  test(`cancellation reentry from ${stage} progress cannot publish an owner`, async () => {
    const controller = new AbortController(),
      d = decoder(),
      visited = [];
    await assert.rejects(
      readCoopPresentationEnvelope(envelope(fixture()), {
        signal: controller.signal,
        decodeImage: d.decodeImage,
        onProgress(progress) {
          visited.push(progress.stage);
          if (progress.stage === stage) controller.abort();
        },
      }),
      { name: 'AbortError' },
    );
    assert.ok(visited.includes(stage));
    assert.equal(d.live, 0);
    assert.equal(d.releases.length, d.seen.length);
    if (stage !== 'ready') assert.ok(!visited.includes('ready'));
  });
}

test('native Blob methods are used without trusting instance overrides', async () => {
  class HostileBlob extends Blob {
    get size() {
      throw new Error('Instance size getter is not authority');
    }
    slice() {
      throw new Error('Instance slice is not authority');
    }
    arrayBuffer() {
      throw new Error('Instance reader is not authority');
    }
  }
  const original = envelope(fixture());
  const wrapped = new HostileBlob([original]);
  const owner = await readCoopPresentationEnvelope(wrapped, { decodeImage: decoder().decodeImage });
  try {
    const exported = await exportCoopPresentationEnvelope(owner);
    assert.deepEqual(
      Buffer.from(await Blob.prototype.arrayBuffer.call(exported)),
      Buffer.from(await original.arrayBuffer()),
    );
  } finally {
    disposeCoopPresentationEnvelope(owner);
  }
});

test('a Blob-shaped object, fabricated owner and copied receipt cannot impersonate native ownership', async () => {
  await assert.rejects(
    readCoopPresentationEnvelope(
      { size: 12, arrayBuffer: async () => new ArrayBuffer(12) },
      {
        decodeImage: decoder().decodeImage,
      },
    ),
  );
  const owner = await readCoopPresentationEnvelope(envelope(fixture()), {
    decodeImage: decoder().decodeImage,
  });
  try {
    for (const fake of [{}, { ...owner }, structuredClone(owner)]) {
      await assert.rejects(async () => readCoopPresentationPicture(fake, owner.pack.levels[0]));
      await assert.rejects(async () => exportCoopPresentationEnvelope(fake));
    }
  } finally {
    disposeCoopPresentationEnvelope(owner);
  }
});

test('disposal is idempotent and ends byte/export access without changing immutable metadata', async () => {
  const owner = await readCoopPresentationEnvelope(envelope(fixture()), {
    decodeImage: decoder().decodeImage,
  });
  const pack = structuredClone(owner.pack),
    receipt = structuredClone(owner.receipt);
  disposeCoopPresentationEnvelope(owner);
  disposeCoopPresentationEnvelope(owner);
  assert.deepEqual(owner.pack, pack);
  assert.deepEqual(owner.receipt, receipt);
  await assert.rejects(async () => readCoopPresentationPicture(owner, owner.pack.levels[0]));
  await assert.rejects(async () => exportCoopPresentationEnvelope(owner));
});

test('cancellation reentry from releasing a qualification image prevents later decode and adoption', async () => {
  const controller = new AbortController();
  let calls = 0,
    releases = 0;
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(fixture()), {
      signal: controller.signal,
      async decodeImage() {
        calls++;
        return {
          image: { naturalWidth: 1152, naturalHeight: 576 },
          release() {
            releases++;
            controller.abort();
          },
        };
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
  assert.equal(releases, 1);
});

test('failed decoder cleanup cannot publish an owner or advance to another image', async () => {
  let calls = 0,
    releases = 0;
  await assert.rejects(
    readCoopPresentationEnvelope(envelope(fixture()), {
      async decodeImage() {
        calls++;
        return {
          image: { naturalWidth: 1152, naturalHeight: 576 },
          release() {
            releases++;
            throw new Error('Modeled release failure');
          },
        };
      },
    }),
    /Modeled release failure/,
  );
  assert.equal(calls, 1);
  assert.equal(releases, 1);
});

test('primary qualification failure is preserved when decoder release also throws', async () => {
  for (const failure of ['dimensions', 'cancellation']) {
    const controller = new AbortController();
    const cleanupError = new Error('Secondary cleanup failure');
    let calls = 0,
      releases = 0;
    await assert.rejects(
      readCoopPresentationEnvelope(envelope(fixture()), {
        signal: controller.signal,
        async decodeImage() {
          calls++;
          if (failure === 'cancellation') controller.abort();
          return {
            image: { naturalWidth: failure === 'dimensions' ? 1151 : 1152, naturalHeight: 576 },
            release() {
              releases++;
              throw cleanupError;
            },
          };
        },
      }),
      (error) => {
        assert.notEqual(error, cleanupError, `${failure} remains the primary failure`);
        assert.equal(error.name, failure === 'cancellation' ? 'AbortError' : 'TypeError');
        if (failure === 'dimensions') assert.match(error.message, /dimensions/i);
        return true;
      },
    );
    assert.equal(calls, 1);
    assert.equal(releases, 1);
  }
});
