import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { inspectPresentationDependencies } from '../presentation/dependencies.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { BUILTIN_SIM_VISUAL_COLLECTIONS } from '../../optional-practice/civilian-fpv/world-themes.mjs';
import {
  compileStudioRuntime,
  exportRuntimeTheme,
  importRuntimeTheme,
  RUNTIME_THEME_MIME,
} from '../presentation/runtime-transfer.mjs';

function fixture() {
  const runtime = JSON.parse(
    readFileSync(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  let document = createDefaultThemeBundle();
  const selected = structuredClone(runtime.resolved.assets['terrain.wall']),
    unused = structuredClone(runtime.resolved.assets['terrain.slow']);
  selected.id = 'test-wall';
  selected.revision = 1;
  selected.provenance.parent = null;
  unused.id = 'unused-ground';
  unused.revision = 1;
  unused.provenance.parent = null;
  document = reviseStudioTheme(document, {
    assets: [selected, unused],
    bindings: {
      'terrain.wall': { id: selected.id, revision: selected.revision },
    },
  });
  document = reviseStudioTheme(document, { tokens: { amber: '#edc978' } });
  const assets = new Map(
    [selected, unused].map((asset) => [
      asset.file.sha256,
      new Blob(
        [
          readFileSync(
            new URL(`../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
          ),
        ],
        { type: asset.file.mime },
      ),
    ]),
  );
  return { document, assets, selected, unused };
}

test('compact runtime preserves selected revisions/provenance while pruning authoring and unbound files', async () => {
  const { document, assets, selected, unused } = fixture(),
    original = structuredClone(document),
    expected = resolvePresentation(document),
    complete = await exportThemeBundle(document, assets),
    output = await exportRuntimeTheme(document, assets),
    roundtrip = await importRuntimeTheme(output);
  assert.equal(output.type, RUNTIME_THEME_MIME);
  assert.equal(roundtrip.version, 2);
  assert.deepEqual(roundtrip.candidate, createThemeCandidate(document));
  assert.deepEqual(roundtrip.candidate.simDependency, {
    kind: 'installed-engine-builtin',
    collection: BUILTIN_SIM_VISUAL_COLLECTIONS['industrial-workshop'],
  });
  assert.equal(roundtrip.candidate.interfaceTheme.tokens.accent, '#edc978');
  assert.ok(output.size < complete.size);
  assert.deepEqual(roundtrip.manifest.resolved, expected);
  assert.deepEqual(roundtrip.manifest.source, { id: document.id, revision: document.revision });
  assert.deepEqual(roundtrip.manifest.resolved.assets['terrain.wall'], selected);
  assert.equal(roundtrip.assets.size, 1);
  assert.equal(roundtrip.assets.has(unused.file.sha256), false);
  assert.deepEqual(
    new Uint8Array(await roundtrip.assets.get(selected.file.sha256).arrayBuffer()),
    new Uint8Array(await assets.get(selected.file.sha256).arrayBuffer()),
  );
  assert.equal(roundtrip.status, 'verified-bytes');
  assert.equal(roundtrip.mediaDecoded, false);
  assert.equal(Object.hasOwn(roundtrip.manifest, 'themes'), false);
  assert.deepEqual(compileStudioRuntime(document), roundtrip.manifest);
  assert.deepEqual(document, original);
  assert.deepEqual(validateThemeBundle(document), original);
  const editable = await importThemeBundle(complete, { decodeImage: null });
  assert.deepEqual(editable.document, document);
  assert.equal(editable.assets.has(unused.file.sha256), true);
  await assert.rejects(importThemeBundle(output), /Unsupported theme bundle/);
});

test('RLRUN1 files remain readable without inventing missing cross-domain descriptors', async () => {
  const { document, assets } = fixture();
  const bytes = new TextEncoder().encode(canonicalJSON(compileStudioRuntime(document)) + '\n');
  const inventory = await inspectPresentationDependencies(bytes);
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('RLRUN1\r\n'));
  new DataView(header.buffer).setUint32(8, bytes.length);
  const result = await importRuntimeTheme(
    new Blob([header, bytes, ...inventory.files.map((item) => assets.get(item.sha256))]),
  );
  assert.equal(result.version, 1);
  assert.equal(result.candidate, null);
  assert.equal(result.envelope, null);
  assert.deepEqual(result.manifest, compileStudioRuntime(document));
  assert.equal(result.assets.size, 1);
});

test('v2 verifies the envelope checksum and binds candidate identity/tokens/SIM to the selected snapshot', async () => {
  const { document, assets } = fixture(),
    output = await exportRuntimeTheme(document, assets);
  const bytes = new Uint8Array(await output.arrayBuffer());
  const originalLength = new DataView(bytes.buffer).getUint32(8);
  const changed = new Uint8Array(bytes);
  changed[50] ^= 1;
  await assert.rejects(importRuntimeTheme(new Blob([changed])), /manifest hash differs/);
  const repack = async (mutate) => {
    const value = JSON.parse(new TextDecoder().decode(bytes.slice(44, 44 + originalLength)));
    mutate(value);
    const manifest = new TextEncoder().encode(canonicalJSON(value) + '\n'),
      header = bytes.slice(0, 44);
    new DataView(header.buffer).setUint32(8, manifest.length);
    header.set(
      Uint8Array.from((await hashPresentationBytes(manifest)).match(/../g), (byte) =>
        parseInt(byte, 16),
      ),
      12,
    );
    return new Blob([header, manifest, bytes.slice(44 + originalLength)]);
  };
  await assert.rejects(
    importRuntimeTheme(
      await repack((value) => {
        value.candidate.source.revision++;
      }),
    ),
    /content identity differs|source presentation/,
  );
  await assert.rejects(
    importRuntimeTheme(
      await repack((value) => {
        value.candidate.simDependency.collection.assets.drone = 'builtin:substitute';
      }),
    ),
    /builtin dependency differs/,
  );
  await assert.rejects(
    importRuntimeTheme(
      await repack((value) => {
        value.candidate.interfaceTheme.fonts.ui = 'url(https:\/\/example.test/font)';
      }),
    ),
    /font stack/,
  );
  const legacy = await importRuntimeTheme(
    await exportRuntimeTheme(document, assets, { familyId: 'legacy' }),
  );
  assert.equal(legacy.candidate.simDependency, null);
  assert.equal(legacy.candidate.family.arcade, null);
});

test('runtime reader rejects tampered, truncated and trailing bytes before exposing a snapshot', async () => {
  const { document, assets } = fixture(),
    output = await exportRuntimeTheme(document, assets),
    bytes = new Uint8Array(await output.arrayBuffer());
  bytes[bytes.length - 1] ^= 1;
  await assert.rejects(importRuntimeTheme(new Blob([bytes])), /hash differs/);
  await assert.rejects(
    importRuntimeTheme(output.slice(0, output.size - 1)),
    /Truncated runtime asset/,
  );
  await assert.rejects(
    importRuntimeTheme(new Blob([output, new Uint8Array([0])])),
    /trailing runtime/,
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(exportRuntimeTheme(document, assets, { signal: abort.signal }), {
    name: 'AbortError',
  });
});

test('runtime snapshots retain collection identity and the resolved binding priority', async () => {
  const { document, assets, selected } = fixture(),
    source = structuredClone(document),
    collection = {
      format: 'revealline-asset-collection.v1',
      id: 'wall-collection',
      revision: 1,
      name: 'Wall collection',
      themeId: source.selection.theme.id,
      requiredSlots: ['terrain.wall'],
      bindings: { 'terrain.wall': { id: selected.id, revision: selected.revision } },
    };
  source.collections.push(collection);
  source.selection.collection = { id: collection.id, revision: collection.revision };
  const checked = validateThemeBundle(source),
    result = await importRuntimeTheme(await exportRuntimeTheme(checked, assets));
  assert.deepEqual(result.manifest.resolved.collection, source.selection.collection);
  assert.deepEqual(
    result.manifest.resolved.bindings['terrain.wall'],
    collection.bindings['terrain.wall'],
  );
});
