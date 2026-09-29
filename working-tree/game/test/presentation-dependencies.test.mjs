import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, LIMITS } from '../presentation/model.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import {
  inspectPresentationDependencies,
  verifyPresentationDependencies,
} from '../presentation/dependencies.mjs';

let pending;
function fixture() {
  return (pending ??= (async () => {
    const source = structuredClone(createDefaultThemeBundle());
    const files = new Map();
    const specifications = [
      ['picture', 'image', '../assets/field-kit/sprites/player-scout-compact.png', 'image/png'],
      ['sound', 'audio', './fixtures/audio/silence-mpeg1-layer3.mp3', 'audio/mpeg'],
      ['unused-font', 'font', '../ui/fonts/field-kit/ibm-plex-mono-500.woff2', 'font/woff2'],
    ];
    const originals = {};
    const shape = source.slots.find((slot) => slot.id === 'player.scout.compact');
    for (const [id, kind, path, mime] of specifications) {
      const bytes = new Uint8Array(await readFile(new URL(path, import.meta.url)));
      const sha256 = await hashPresentationBytes(bytes);
      const asset = {
        format: FORMATS.asset,
        id: `dependencies.${id}`,
        revision: 1,
        kind,
        description: 'Dependency inventory fixture',
        provenance: {
          creator: 'Test',
          source: 'Project fixture',
          license: 'Project asset',
          prompt: '',
          parent: null,
        },
        file: {
          sha256,
          bytes: bytes.length,
          mime,
          width: kind === 'image' ? 32 : null,
          height: kind === 'image' ? 32 : null,
        },
        geometry:
          kind === 'image' ? { ...structuredClone(shape.geometry), rotorAnchors: [] } : null,
        recipe: null,
        quality: { stage: 'produced', evidence: [] },
      };
      source.assets.push(asset);
      files.set(sha256, new Blob([bytes], { type: mime }));
      originals[id] = asset;
    }
    for (const id of ['scene.reveal.legacy', 'scene.reveal.wide']) {
      const slot = source.slots.find((slot) => slot.id === id);
      slot.dimensions = structuredClone(shape.dimensions);
      slot.geometry = { ...structuredClone(shape.geometry), rotorAnchors: [] };
      source.themes[1].bindings[id] = { id: originals.picture.id, revision: 1 };
    }
    source.themes[1].bindings['audio.music'] = { id: originals.sound.id, revision: 1 };
    const compiled = await compilePresentation(source, files);
    return { ...compiled, originals, bytes: compiled.files.get('runtime.json') };
  })());
}

test('real compiler inventory includes lazy picture/audio once and excludes unselected authoring history', async () => {
  const f = await fixture();
  const inventory = await inspectPresentationDependencies(f.bytes);
  assert.deepEqual(
    f.dependencies,
    inventory,
    'Compiler and runtime inspection share one inventory.',
  );
  assert.equal(inventory.files.length, 2);
  assert.equal(inventory.manifest.sha256, await hashPresentationBytes(f.bytes));
  assert.equal(inventory.manifest.bytes, f.bytes.length);
  assert.deepEqual(inventory.files.find((file) => file.mime === 'image/png').slots, [
    'scene.reveal.legacy',
    'scene.reveal.wide',
  ]);
  assert.deepEqual(inventory.files.find((file) => file.mime === 'audio/mpeg').slots, [
    'audio.music',
  ]);
  assert(f.files.has(`assets/${f.originals['unused-font'].file.sha256}.woff2`));
  assert(!inventory.files.some((file) => file.sha256 === f.originals['unused-font'].file.sha256));
  assert.equal(
    inventory.totalBytes,
    f.bytes.length + f.originals.picture.file.bytes + f.originals.sound.file.bytes,
  );
  assert(Object.isFrozen(inventory.files[0].slots));
  assert.deepEqual(await inspectPresentationDependencies(f.bytes), inventory);
});

test('a loaded host can still lack lazy resources; full-byte verification checks both without playback or decoding', async () => {
  const f = await fixture();
  const requests = [];
  const host = createPresentationHost({
    baseURL: 'https://test.invalid/compiled/',
    fetch: async (url) => {
      requests.push(url);
      return new Response(f.files.get(url.split('/compiled/')[1]));
    },
    decodeImage: () => {
      throw new Error('No eager bitmap is required.');
    },
  });
  try {
    const snapshot = await host.load();
    assert.equal(requests.length, 1);
    const reads = [];
    const result = await verifyPresentationDependencies(f.bytes, {
      read: async (file) => {
        reads.push(file.path);
        return f.files.get(file.path);
      },
    });
    assert.equal(result.status, 'verified-bytes');
    assert.equal(result.mediaDecoded, false);
    assert.equal(reads.length, 2);
    assert.equal(host.current(), snapshot);
    for (const missing of result.inventory.files)
      await assert.rejects(
        verifyPresentationDependencies(f.bytes, {
          read: async (file) => (file.path === missing.path ? null : f.files.get(file.path)),
        }),
        /unavailable/,
      );
  } finally {
    host.close();
  }
});

test('missing, truncated, enlarged and same-length corrupt dependencies never qualify', async () => {
  const f = await fixture();
  for (const mutate of [
    () => undefined,
    (bytes) => bytes.slice(1),
    (bytes) => new Uint8Array(bytes.length + 1),
    (bytes) => {
      const copy = bytes.slice();
      copy[0] ^= 1;
      return copy;
    },
  ])
    await assert.rejects(
      verifyPresentationDependencies(f.bytes, {
        read: async (file) => mutate(f.files.get(file.path)),
      }),
      /unavailable|byte count|hash differs/,
    );
});

test('inventory rejects arbitrary paths, ambiguous file claims and oversized or malformed original bytes', async () => {
  const f = await fixture();
  const manifest = JSON.parse(new TextDecoder().decode(f.bytes));
  const hash = f.originals.picture.file.sha256;
  for (const path of [
    'https://other.invalid/picture.png',
    '../private.png',
    `./assets/${hash}.jpg`,
  ]) {
    const copy = structuredClone(manifest);
    copy.urls[hash] = path;
    await assert.rejects(
      inspectPresentationDependencies(new TextEncoder().encode(JSON.stringify(copy))),
    );
  }
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array(LIMITS.manifestBytes + 1),
    new Uint8Array([255]),
    new TextEncoder().encode('{}'),
  ])
    await assert.rejects(inspectPresentationDependencies(bytes));
  const changed = structuredClone(manifest);
  changed.resolved.assets['scene.reveal.wide'].file.bytes++;
  await assert.rejects(
    inspectPresentationDependencies(new TextEncoder().encode(JSON.stringify(changed))),
  );
});

test('inventory owns caller bytes before hashing and retains exact whitespace identity', async () => {
  const f = await fixture();
  const bytes = f.bytes.slice();
  const inspecting = inspectPresentationDependencies(bytes);
  bytes.fill(0);
  const result = await inspecting;
  assert.equal(result.manifest.sha256, await hashPresentationBytes(f.bytes));
  const spaced = new TextEncoder().encode(
    JSON.stringify(JSON.parse(new TextDecoder().decode(f.bytes)), null, 2),
  );
  const other = await inspectPresentationDependencies(spaced);
  assert.notEqual(other.manifest.sha256, result.manifest.sha256);
  assert.deepEqual(other.files, result.files);
});

test('cancellation settles a non-cooperating reader and never starts later reads', async () => {
  const f = await fixture();
  const stop = new AbortController();
  stop.abort();
  let calls = 0;
  await assert.rejects(
    verifyPresentationDependencies(f.bytes, {
      signal: stop.signal,
      read: () => {
        calls++;
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
  const controller = new AbortController();
  let finish, entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const check = verifyPresentationDependencies(f.bytes, {
    signal: controller.signal,
    read: () => {
      calls++;
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await started;
  controller.abort();
  await assert.rejects(check, { name: 'AbortError' });
  finish(new Uint8Array());
  await Promise.resolve();
  assert.equal(calls, 1);
});

test('pure procedural presentations require no resource reads and confer no decoded-media claim', async () => {
  const f = await compilePresentation(createDefaultThemeBundle());
  const result = await verifyPresentationDependencies(f.files.get('runtime.json'), {
    read: () => {
      throw new Error('No asset files exist.');
    },
  });
  assert.equal(result.inventory.files.length, 0);
  assert.equal(result.inventory.totalBytes, f.files.get('runtime.json').length);
  assert.equal(result.mediaDecoded, false);
});

test('procedural-only verification rejects cancellation between inspection and verification', async (t) => {
  const compiled = await compilePresentation(createDefaultThemeBundle());
  const controller = new AbortController();
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  t.mock.method(crypto.subtle, 'digest', (...args) =>
    digest(...args).then((hash) => {
      // Complete the real hash, then abort after inspection resolves but before
      // its caller continues. An empty inventory must not skip that boundary.
      queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => controller.abort())));
      return hash;
    }),
  );
  let reads = 0;
  await assert.rejects(
    verifyPresentationDependencies(compiled.files.get('runtime.json'), {
      signal: controller.signal,
      read: () => {
        reads++;
        throw new Error('A procedural presentation has no resource files.');
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(controller.signal.aborted, true);
  assert.equal(reads, 0);
});

test('retained manifest pins are checked before any dependency read with no latest fallback', async () => {
  const f = await fixture();
  let reads = 0;
  const read = (file) => {
    reads++;
    return f.files.get(file.path);
  };
  for (const expectedManifestSha256 of ['0'.repeat(64), 'latest', '', 'A'.repeat(64), 3])
    await assert.rejects(
      verifyPresentationDependencies(f.bytes, { read, expectedManifestSha256 }),
      /pin/,
    );
  assert.equal(reads, 0);
  const expectedManifestSha256 = await hashPresentationBytes(f.bytes);
  await verifyPresentationDependencies(f.bytes, { read, expectedManifestSha256 });
  assert.equal(reads, 2);
  const spaced = new TextEncoder().encode(
    JSON.stringify(JSON.parse(new TextDecoder().decode(f.bytes)), null, 2),
  );
  await assert.rejects(
    verifyPresentationDependencies(spaced, { read, expectedManifestSha256 }),
    /pinned manifest/,
  );
  assert.equal(reads, 2);
});

test('retained dependency inventories preserve every lazy original and describe the exact archived manifest', async () => {
  const f = await fixture();
  const pin = await hashPresentationBytes(f.bytes);
  const current = await inspectPresentationDependencies(f.bytes);
  const retained = await inspectPresentationDependencies(f.bytes, { retainedManifestSha256: pin });
  assert.deepEqual(retained, {
    ...current,
    manifest: { ...current.manifest, path: `runtime.${pin}.json` },
  });
  const checked = [];
  const verified = await verifyPresentationDependencies(f.bytes, {
    retainedManifestSha256: pin,
    expectedManifestSha256: pin,
    read: async (file) => {
      checked.push(file.path);
      return f.files.get(file.path);
    },
  });
  assert.deepEqual(verified.inventory, retained);
  assert.deepEqual(
    checked,
    retained.files.map((file) => file.path),
  );
  assert.equal(verified.mediaDecoded, false);
  assert.equal(retained.totalBytes, current.totalBytes);
});

test('retained dependency identity rejects changed bytes and conflicting pins before reading any files', async () => {
  const f = await fixture();
  const pin = await hashPresentationBytes(f.bytes);
  const changed = new TextEncoder().encode(new TextDecoder().decode(f.bytes) + '\n');
  let reads = 0;
  const read = () => {
    reads++;
    throw new Error('Must not read assets');
  };
  for (const retainedManifestSha256 of [
    '',
    '../runtime.json',
    `${pin}#fragment`,
    {},
    'A'.repeat(64),
  ]) {
    await assert.rejects(
      inspectPresentationDependencies(f.bytes, { retainedManifestSha256 }),
      /exact SHA-256/,
    );
  }
  await assert.rejects(
    verifyPresentationDependencies(changed, { read, retainedManifestSha256: pin }),
    /differ from their exact manifest pin/,
  );
  await assert.rejects(
    verifyPresentationDependencies(f.bytes, {
      read,
      retainedManifestSha256: pin,
      expectedManifestSha256: '0'.repeat(64),
    }),
    /differ from the pinned manifest/,
  );
  assert.equal(reads, 0);
});
