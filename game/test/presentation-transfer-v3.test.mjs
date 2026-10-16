import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, LIMITS, validateThemeBundle } from '../presentation/model.mjs';
import {
  encodePresentationDocument,
  PRESENTATION_METADATA_FORMAT,
} from '../presentation/document-codec.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
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
function nearLimit(source, reserve = 0) {
  const document = structuredClone(source);
  let remaining = LIMITS.manifestBytes - reserve - encode(document).length;
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
  assert.equal(encode(document).length, LIMITS.manifestBytes - reserve);
  return validateThemeBundle(document);
}

const magic = async (blob) => new TextDecoder().decode((await bytesOf(blob)).subarray(0, 8));
async function largeFixture() {
  const f = await fixture();
  const document = structuredClone(f.document);
  const recipe = document.assets.find((asset) => asset.kind === 'recipe');
  while (document.assets.length <= 2048) {
    const asset = structuredClone(recipe);
    asset.id = `transfer.history.${document.assets.length}`;
    asset.provenance.parent = null;
    document.assets.push(asset);
  }
  return { document: validateThemeBundle(document), assets: f.assets };
}

test('V3 carries more than 2048 immutable records while retaining exact original payloads and deterministic re-export', async () => {
  const { document, assets } = await largeFixture();
  assert.equal(document.assets.length, 2049);
  const metadata = JSON.parse(encodePresentationDocument(document));
  assert.equal(metadata.format, PRESENTATION_METADATA_FORMAT);
  const bundle = await exportThemeBundle(document, assets);
  assert.equal(await magic(bundle), 'RLTHM3\r\n');
  const restored = await importThemeBundle(bundle, { decodeImage: null });
  assert.deepEqual(restored.document, document);
  for (const [hash, blob] of assets)
    assert.deepEqual(await bytesOf(restored.assets.get(hash)), await bytesOf(blob));
  assert.deepEqual(
    await bytesOf(await exportThemeBundle(restored.document, restored.assets)),
    await bytesOf(bundle),
  );
  for (const version of [1, 2]) {
    const manifest = version === 1 ? { document, assets: [] } : { document };
    await assert.rejects(
      importThemeBundle(transfer(version, manifest), { decodeImage: null }),
      /array exceeds/,
    );
  }
});

test('V3 direct raw metadata accepts exactly 5 MiB without charging an unused outer wrapper', async () => {
  const f = await fixture();
  const document = nearLimit(f.document);
  assert.equal(encode(document).length, LIMITS.manifestBytes);
  assert.equal(JSON.parse(encodePresentationDocument(document)).format, FORMATS.bundle);
  const bundle = await exportThemeBundle(document, f.assets);
  assert.equal(await magic(bundle), 'RLTHM3\r\n');
  const bytes = await bytesOf(bundle);
  assert.equal(new DataView(bytes.buffer).getUint32(8), LIMITS.manifestBytes);
  assert.deepEqual(bytes.subarray(12, 12 + LIMITS.manifestBytes), encode(document));
  const restored = await importThemeBundle(bundle, { decodeImage: null });
  assert.deepEqual(restored.document, document);
  assert.deepEqual(
    await bytesOf(await exportThemeBundle(restored.document, restored.assets)),
    bytes,
  );
});

test('V3 rejects invalid codec references, semantic file conflicts, corrupt/truncated/trailing bytes and oversized framing before acceptance', async () => {
  const { document, assets } = await largeFixture();
  const metadata = JSON.parse(encodePresentationDocument(document));
  const payloads = sortedAssets(assets).map(([, blob]) => blob);
  const good = transfer(3, metadata, payloads);
  const malformed = structuredClone(metadata);
  malformed.document.assets[0].provenance.source = malformed.strings.length;
  await assert.rejects(
    importThemeBundle(transfer(3, malformed, payloads), { decodeImage: null }),
    /dictionary reference/,
  );
  const conflicting = structuredClone(metadata);
  const duplicate = conflicting.document.assets.find(
    (asset) => asset.id === 'transfer.shared-image',
  );
  duplicate.file.bytes++;
  await assert.rejects(
    importThemeBundle(transfer(3, conflicting, payloads), { decodeImage: null }),
    /Conflicting/,
  );
  await assert.rejects(
    importThemeBundle(transfer(3, { ...metadata, unknown: true }, payloads), { decodeImage: null }),
    /not supported/,
  );
  await assert.rejects(
    importThemeBundle(good.slice(0, good.size - 1), { decodeImage: null }),
    /Truncated theme asset/,
  );
  await assert.rejects(
    importThemeBundle(new Blob([good, new Uint8Array([0])]), { decodeImage: null }),
    /trailing theme bytes/,
  );
  const corrupt = await bytesOf(good);
  corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(
    importThemeBundle(new Blob([corrupt]), { decodeImage: null }),
    /Asset bytes\/hash do not match/,
  );
  const oversized = await bytesOf(good);
  new DataView(oversized.buffer).setUint32(8, LIMITS.manifestBytes + 1);
  await assert.rejects(
    importThemeBundle(new Blob([oversized]), { decodeImage: null }),
    /Invalid theme manifest length/,
  );
});

test('V3 cancellation and failed decoding cannot return a partial accepted document', async () => {
  const f = await largeFixture();
  const bundle = await exportThemeBundle(f.document, f.assets);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    importThemeBundle(bundle, { signal: controller.signal, decodeImage: null }),
    { name: 'AbortError' },
  );
  await assert.rejects(exportThemeBundle(f.document, f.assets, { signal: controller.signal }), {
    name: 'AbortError',
  });
  const held = new AbortController();
  let decodes = 0;
  await assert.rejects(
    importThemeBundle(bundle, {
      signal: held.signal,
      decodeImage: async () => {
        decodes++;
        held.abort();
        return { naturalWidth: 1, naturalHeight: 1 };
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(decodes, 1);
  await assert.rejects(
    importThemeBundle(bundle, {
      decodeImage: async () => {
        throw new Error('decoder refused');
      },
    }),
    /decoder refused/,
  );
});
