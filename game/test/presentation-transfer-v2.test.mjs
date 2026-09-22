import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, LIMITS, validateThemeBundle } from '../presentation/model.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
  verifyThemeAssets,
} from '../presentation/bundle.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const encode = (value) => new TextEncoder().encode(canonicalJSON(value));
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
function transfer(version, manifest, payloads = []) {
  const body = encode(manifest),
    header = new Uint8Array(12);
  header.set(new TextEncoder().encode(`RLTHM${version}\r\n`));
  new DataView(header.buffer).setUint32(8, body.length);
  return new Blob([header, body, ...payloads]);
}
async function fixture() {
  const document = structuredClone(createDefaultThemeBundle());
  const png = pngBytes(),
    wav = new Uint8Array(44);
  wav.set(new TextEncoder().encode('RIFF'));
  wav.set(new TextEncoder().encode('WAVE'), 8);
  new DataView(wav.buffer).setUint32(4, 36, true);
  const assets = new Map();
  for (const [id, data, kind, mime] of [
    ['image', png, 'image', 'image/png'],
    ['audio', wav, 'audio', 'audio/wav'],
  ]) {
    const sha256 = await hashPresentationBytes(data);
    document.assets.push({
      format: FORMATS.asset,
      id: `transfer.${id}`,
      revision: 1,
      kind,
      description: 'Bounded transfer fixture; not production artwork',
      provenance: {
        creator: 'Test',
        source: 'Injected fixture',
        license: 'Test-only',
        prompt: '',
        parent: null,
      },
      file: {
        sha256,
        bytes: data.length,
        mime,
        width: kind === 'image' ? 1 : null,
        height: kind === 'image' ? 1 : null,
      },
      recipe: null,
      geometry:
        kind === 'image'
          ? {
              frame: { x: 0, y: 0, width: 1, height: 1 },
              pivot: { x: 0.5, y: 0.5 },
              occupiedBounds: null,
              rotorAnchors: [],
              nineSlice: null,
            }
          : null,
      quality: { stage: 'produced', evidence: [] },
    });
    assets.set(sha256, new Blob([data]));
  }
  const duplicate = structuredClone(document.assets.at(-2));
  duplicate.id = 'transfer.shared-image';
  document.assets.push(duplicate);
  return { document: validateThemeBundle(document), assets };
}
function sortedAssets(assets) {
  return [...assets].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
function nearLimit(source) {
  const document = structuredClone(source);
  let remaining = LIMITS.manifestBytes - 13 - encode(document).length;
  for (const asset of document.assets) {
    for (let i = asset.quality.evidence.length; i < 16 && remaining > 0; i++) {
      const overhead = 2 + (i ? 1 : 0),
        length = Math.min(2048, remaining - overhead);
      assert.ok(length > 0);
      asset.quality.evidence.push(String(i).padEnd(length, 'x'));
      remaining -= length + overhead;
    }
    if (!remaining) break;
  }
  assert.equal(remaining, 0, 'Fixture must reach the exact unchanged manifest ceiling');
  assert.equal(encode({ document }).length, LIMITS.manifestBytes);
  return validateThemeBundle(document);
}

test('fitting v1 exports retain exact legacy bytes, sorted unique payloads and duplicate history', async () => {
  const { document, assets } = await fixture(),
    sorted = sortedAssets(assets);
  const manifest = {
    document,
    assets: sorted.map(([sha256, blob]) => ({ sha256, bytes: blob.size })),
  };
  const expected = transfer(
    1,
    manifest,
    sorted.map(([, blob]) => blob),
  );
  const actual = await exportThemeBundle(document, assets);
  assert.deepEqual(await bytesOf(actual), await bytesOf(expected));
  assert.deepEqual((await importThemeBundle(actual, { decodeImage: null })).document, document);
});

test('only oversized v1 envelopes fall back to deterministic v2 without changing document or original bytes', async () => {
  const f = await fixture(),
    document = nearLimit(f.document),
    sorted = sortedAssets(f.assets);
  const legacy = {
    document,
    assets: sorted.map(([sha256, blob]) => ({ sha256, bytes: blob.size })),
  };
  assert.ok(encode(legacy).length > LIMITS.manifestBytes);
  const actual = await exportThemeBundle(document, f.assets);
  assert.deepEqual(
    await bytesOf(actual),
    await bytesOf(
      transfer(
        2,
        { document },
        sorted.map(([, blob]) => blob),
      ),
    ),
  );
  const restored = await importThemeBundle(actual, { decodeImage: null });
  assert.deepEqual(restored.document, document);
  assert.deepEqual(
    [...restored.assets.keys()],
    sorted.map(([hash]) => hash),
  );
  for (const [hash, blob] of f.assets)
    assert.deepEqual(await bytesOf(restored.assets.get(hash)), await bytesOf(blob));
  assert.deepEqual(
    await bytesOf(await exportThemeBundle(restored.document, restored.assets)),
    await bytesOf(actual),
  );
  const oversized = structuredClone(document);
  oversized.assets[0].description += 'x';
  await assert.rejects(exportThemeBundle(oversized, f.assets), /manifest exceeds/);
});

test('both headers reject malformed manifests, bad lengths, missing payloads and trailing bytes', async () => {
  const { document, assets } = await fixture(),
    sorted = sortedAssets(assets);
  for (const version of [1, 2]) {
    const manifest =
      version === 1
        ? { document, assets: sorted.map(([sha256, blob]) => ({ sha256, bytes: blob.size })) }
        : { document };
    const good = transfer(
      version,
      manifest,
      sorted.map(([, blob]) => blob),
    );
    assert.deepEqual((await importThemeBundle(good, { decodeImage: null })).document, document);
    await assert.rejects(
      importThemeBundle(good.slice(0, good.size - 1), { decodeImage: null }),
      /Truncated theme asset/,
    );
    await assert.rejects(
      importThemeBundle(new Blob([good, new Uint8Array([0])]), { decodeImage: null }),
      /trailing theme bytes/,
    );
    await assert.rejects(
      importThemeBundle(transfer(version, { ...manifest, unknown: true }), { decodeImage: null }),
      /not supported/,
    );
    await assert.rejects(importThemeBundle(transfer(version, {}), { decodeImage: null }));
    const raw = await bytesOf(good);
    new DataView(raw.buffer).setUint32(8, LIMITS.manifestBytes + 1);
    await assert.rejects(
      importThemeBundle(new Blob([raw]), { decodeImage: null }),
      /Invalid theme manifest length/,
    );
    const alteredPayload = await bytesOf(good);
    alteredPayload[alteredPayload.length - 1] ^= 1;
    await assert.rejects(
      importThemeBundle(new Blob([alteredPayload]), { decodeImage: null }),
      /Asset bytes\/hash do not match/,
    );
    const corrupt = await bytesOf(good);
    corrupt[12] = 255;
    await assert.rejects(importThemeBundle(new Blob([corrupt]), { decodeImage: null }), TypeError);
    const header = await bytesOf(good);
    header[5] = 57;
    await assert.rejects(
      importThemeBundle(new Blob([header]), { decodeImage: null }),
      /Unsupported/,
    );
    await assert.rejects(
      importThemeBundle(good.slice(0, 11), { decodeImage: null }),
      /Truncated theme bundle/,
    );
  }
  await assert.rejects(
    importThemeBundle(transfer(2, { document, assets: [] }), { decodeImage: null }),
    /not supported/,
  );
  await assert.rejects(
    importThemeBundle(new Blob([new Uint8Array(LIMITS.bundleBytes + 1)]), { decodeImage: null }),
    /byte budget/,
  );
});

test('inconsistent same-hash file metadata fails before accepting any payload in either format', async () => {
  const { document, assets } = await fixture(),
    sorted = sortedAssets(assets);
  for (const field of ['bytes', 'mime', 'width']) {
    const inconsistent = structuredClone(document),
      duplicate = inconsistent.assets.at(-1);
    if (field === 'mime') duplicate.file.mime = 'image/webp';
    else {
      duplicate.file[field]++;
      if (field === 'width') duplicate.geometry.frame.width++;
    }
    assert.throws(() => validateThemeBundle(inconsistent), /Conflicting/);
    await assert.rejects(verifyThemeAssets(inconsistent, assets), /Conflicting/);
    await assert.rejects(exportThemeBundle(inconsistent, assets), /Conflicting/);
    for (const version of [1, 2]) {
      const manifest =
        version === 1
          ? {
              document: inconsistent,
              assets: sorted.map(([sha256, blob]) => ({ sha256, bytes: blob.size })),
            }
          : { document: inconsistent };
      await assert.rejects(
        importThemeBundle(
          transfer(
            version,
            manifest,
            sorted.map(([, blob]) => blob),
          ),
          { decodeImage: null },
        ),
        /Conflicting/,
      );
    }
  }
});

test('v2 keeps finite structural and string limits and honours cancellation during decoding', async () => {
  const { document, assets } = await fixture(),
    sorted = sortedAssets(assets);
  const valid = transfer(
    2,
    { document },
    sorted.map(([, blob]) => blob),
  );
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(importThemeBundle(valid, { signal: stopped.signal }), {
    name: 'AbortError',
  });
  await assert.rejects(exportThemeBundle(document, assets, { signal: stopped.signal }), {
    name: 'AbortError',
  });
  const controller = new AbortController();
  await assert.rejects(
    importThemeBundle(valid, {
      signal: controller.signal,
      decodeImage: async () => {
        controller.abort();
        return { naturalWidth: 1, naturalHeight: 1 };
      },
    }),
    { name: 'AbortError' },
  );
  for (const malformed of [
    { document: { text: 'x'.repeat(8193) } },
    { document: { list: Array(2049).fill(null) } },
  ]) {
    await assert.rejects(
      importThemeBundle(transfer(2, malformed), { decodeImage: null }),
      /budget/,
    );
  }
  let deep = null;
  for (let i = 0; i < 22; i++) deep = { nested: deep };
  await assert.rejects(
    importThemeBundle(transfer(2, { document: deep }), { decodeImage: null }),
    /structural budget/,
  );
});
