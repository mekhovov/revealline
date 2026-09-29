import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { decodePresentationDocument } from '../presentation/document-codec.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import {
  CUMULATIVE_NATIVE_REVIEW_PATH,
  readCumulativeNativeContinuation,
} from '../../scripts/cumulative-native-source-continuation.mjs';

const read = (p) => readFile(new URL('../../' + p, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const raw = await read('authoring/library/fpv-field-kit/production.rltheme');
const candidate = await importThemeBundle(new Blob([raw]), { decodeImage: null });
const oracle = JSON.parse(await read('game/test/fixtures/production-main321-fpv101.json'));
const review = JSON.parse(await read(CUMULATIVE_NATIVE_REVIEW_PATH));
const priorSource = structuredClone(oracle.metadata);
for (const [group, pin] of Object.entries(oracle.groups)) {
  const prefix = candidate.document[group].slice(0, pin.count);
  assert.equal(prefix.length, pin.count);
  assert.equal(sha(canonicalJSON(prefix)), pin.sha256, group);
  priorSource[group] = prefix;
}
const prior = validateThemeBundle(priorSource);

test('cumulative102 retains every exact accepted101 record and all132 original payloads', async () => {
  assert.equal(raw.length, 8579791);
  assert.equal(sha(raw), '256a9edbe79fa2234607e32c7e0ace9646873a69b07482c5ee7e21a04cb08628');
  assert.equal(candidate.document.revision, 102);
  assert.equal(candidate.document.selection.theme.revision, 102);
  validateThemeBundle(candidate.document, { previous: prior, expectedRevision: 101 });
  assert.equal(candidate.document.slots.length, 335);
  assert.equal(candidate.document.assets.length, 2712);
  assert.equal(candidate.document.themes.length, 103);
  assert.equal(candidate.document.collections.length, 1);
  const payloads = [];
  for (const [hash, blob] of candidate.assets) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(sha(bytes), hash);
    payloads.push([hash, bytes.length]);
  }
  payloads.sort(([a], [b]) => a.localeCompare(b));
  assert.equal(payloads.length, 132);
  assert.equal(
    payloads.reduce((sum, entry) => sum + entry[1], 0),
    4009342,
  );
  assert.equal(sha(canonicalJSON(payloads)), oracle.payloads.sha256);
  const original = Buffer.from(
    await (await exportThemeBundle(prior, candidate.assets)).arrayBuffer(),
  );
  assert.equal(original.length, oracle.provenance.bytes);
  assert.equal(sha(original), oracle.provenance.sha256, 'byte-identical accepted101 bundle');
});

test('only98 scoped metadata successors are added, preserving every recipe, media byte and evidence string', async () => {
  await readCumulativeNativeContinuation(read);
  const before = resolvePresentation(prior);
  const after = resolvePresentation(candidate.document);
  assert.deepEqual(after.tokens, before.tokens);
  const newAssets = candidate.document.assets.slice(2614);
  const groups = {};
  const shape = (asset) => {
    const copy = structuredClone(asset);
    delete copy.revision;
    delete copy.quality;
    delete copy.provenance.source;
    delete copy.provenance.parent;
    return copy;
  };
  for (const asset of newAssets) {
    const slot = Object.keys(after.assets).find((id) => after.assets[id].id === asset.id);
    assert.ok(slot, asset.id);
    const old = before.assets[slot];
    assert.deepEqual(shape(asset), shape(old), slot);
    assert.equal(asset.revision, old.revision + 1);
    assert.deepEqual(asset.provenance.parent, { id: old.id, revision: old.revision });
    assert.equal(asset.quality.stage, 'reviewed');
    const group = Object.entries(review.fingerprints).find(([name, pin]) =>
      name === 'equipment'
        ? pin.slots.includes(slot) &&
          asset.provenance.source.endsWith('; consumer-sha256:' + pin.currentSHA256)
        : asset.provenance.source === pin.paths.join('; ') + ' sha256:' + pin.currentSHA256,
    )?.[0];
    assert.ok(group, slot);
    groups[group] = (groups[group] ?? 0) + 1;
    for (const entry of old.quality.evidence)
      assert.ok(
        asset.quality.evidence.some((value) => value.includes(entry)),
        slot,
      );
    if (group === 'audio') {
      assert.equal(asset.revision, 54);
      assert.equal(old.revision, 53);
      assert.equal(asset.quality.evidence.length, 16);
      assert.ok(asset.quality.evidence[0].endsWith('\n' + old.quality.evidence[0]));
      assert.deepEqual(asset.quality.evidence.slice(1), old.quality.evidence.slice(1));
    }
  }
  assert.deepEqual(groups, {
    audio: 8,
    effects: 10,
    motion: 7,
    screens: 7,
    ui: 24,
    equipment: 5,
    team: 37,
  });
  for (const [slot, old] of Object.entries(before.assets))
    if (!newAssets.some((asset) => asset.id === old.id))
      assert.deepEqual(after.assets[slot], old, slot);
  const theme = candidate.document.themes.at(-1);
  assert.equal(theme.revision, 102);
  assert.deepEqual(theme.parent, { id: 'fpv', revision: 101 });
  assert.deepEqual(theme.tokens, {});
  assert.deepEqual(
    Object.values(theme.bindings)
      .map((row) => row.id + '@' + row.revision)
      .sort(),
    newAssets.map((row) => row.id + '@' + row.revision).sort(),
  );
});

test('all140 compiled files are pinned and the runtime and Studio resolve exact production102', async () => {
  const manifest = JSON.parse(await read('game/presentation/compiled/manifest.json'));
  assert.deepEqual(manifest.source, { id: 'field-kit', revision: 102 });
  assert.equal(manifest.files.length, 139);
  assert.equal(new Set(manifest.files.map((row) => row.path)).size, 139);
  for (const pin of manifest.files) {
    assert.ok(!pin.path.startsWith('/') && !pin.path.split('/').includes('..'));
    const bytes = await read('game/presentation/compiled/' + pin.path);
    assert.equal(bytes.length, pin.bytes, pin.path);
    assert.equal(sha(bytes), pin.sha256, pin.path);
  }
  const runtime = validateCompiledPresentation(
    JSON.parse(await read('game/presentation/compiled/runtime.json')),
  );
  assert.equal(runtime.resolved.theme.revision, 102);
  assert.deepEqual(runtime.resolved, resolvePresentation(candidate.document));
  const studio = decodePresentationDocument(
    (await read('game/presentation/compiled/studio.json')).toString('utf8'),
  );
  assert.deepEqual(studio, candidate.document);
});
