import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, validateThemeBundle } from '../presentation/model.mjs';
import { importThemeBundle } from '../presentation/bundle.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { PRESENTATION_METADATA_LIMITS } from '../presentation/document-codec.mjs';
import { canonicalJSON } from '../data-json.mjs';

test('serialized metadata stays at 5MiB and logical ownership at 8MiB; other limits stay bounded', async () => {
  assert.equal(LIMITS.manifestBytes, 5 * 1024 * 1024);
  assert.equal(LIMITS.bundleBytes, 32 * 1024 * 1024);
  assert.equal(LIMITS.assetBytes, 4 * 1024 * 1024);
  assert.equal(LIMITS.assets, 4096);
  assert.equal(PRESENTATION_METADATA_LIMITS.logicalBytes, 8 * 1024 * 1024);
  assert.equal(LIMITS.slots, 512);
  const source = structuredClone(createDefaultThemeBundle());
  // Valid, bounded individual evidence strings aggregate beyond the document cap.
  for (const asset of source.assets) asset.quality.evidence = Array(16).fill('x'.repeat(2048));
  assert.ok(Buffer.byteLength(canonicalJSON(source)) > PRESENTATION_METADATA_LIMITS.logicalBytes);
  assert.throws(() => validateThemeBundle(source), /byte budget/);
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('RLTHM1\r\n'));
  new DataView(header.buffer).setUint32(8, LIMITS.manifestBytes + 1);
  // Enough bytes exist: reject specifically the declared metadata ceiling before parsing.
  await assert.rejects(
    importThemeBundle(new Blob([header, new Uint8Array(LIMITS.manifestBytes + 1)]), {
      decodeImage: null,
    }),
    /Invalid theme manifest length/,
  );
  await assert.rejects(
    importThemeBundle(new Blob([new Uint8Array(LIMITS.bundleBytes + 1)]), { decodeImage: null }),
    /File exceeds its byte budget/,
  );
});

test('exact metadata boundary is accepted; one extra byte, malformed JSON and deep JSON are refused', async () => {
  const source = createDefaultThemeBundle(),
    body = canonicalJSON(source);
  const exact = body + ' '.repeat(LIMITS.manifestBytes - Buffer.byteLength(body));
  assert.equal(Buffer.byteLength(exact), LIMITS.manifestBytes);
  assert.deepEqual(validateThemeBundle(exact), source);
  assert.throws(() => validateThemeBundle(exact + ' '), /byte budget/);
  assert.throws(() => validateThemeBundle('{broken'), /valid JSON/);
  let deep = null;
  for (let depth = 0; depth < 32; depth++) deep = { nested: deep };
  const manifest = new TextEncoder().encode(JSON.stringify({ document: deep, assets: [] }));
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('RLTHM1\r\n'));
  new DataView(header.buffer).setUint32(8, manifest.length);
  await assert.rejects(
    importThemeBundle(new Blob([header, manifest]), { decodeImage: null }),
    /structural budget/,
  );
});
