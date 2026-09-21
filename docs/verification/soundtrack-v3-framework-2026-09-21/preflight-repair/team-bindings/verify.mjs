// Run from the repository root. Writes only this review's small JSON receipt.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { canonicalJSON } from '../../../../../game/data-json.mjs';
import { importThemeBundle } from '../../../../../game/presentation/bundle.mjs';
import { validateCompiledPresentation } from '../../../../../game/presentation/host.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
} from '../../../../../game/couch/coop-picture-bindings.mjs';

const baseline = 'ed039c08b68c7b2a59824a9e78f38ee5734308ef';
const directory =
  'docs/verification/soundtrack-v3-framework-2026-09-21/preflight-repair/team-bindings';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const historical = (path) =>
  execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const ledgerPath = 'authoring/library/fpv-field-kit/production.rltheme';
const originalBytes = historical(ledgerPath);
const finalBytes = await readFile(ledgerPath);
const original = await importThemeBundle(new Blob([originalBytes]), { decodeImage: null });
const final = await importThemeBundle(new Blob([finalBytes]), { decodeImage: null });
assert.equal(original.document.revision, 38);
assert.equal(final.document.revision, 41);
const stage40Path =
  'docs/verification/soundtrack-v3-framework-2026-09-21/preflight-repair/ledger/source-stage-40.json';
const stage40Bytes = await readFile(stage40Path);
const stage40 = JSON.parse(stage40Bytes);
assert.equal(stage40.revision, 40);
const groups = {};
for (const group of ['assets', 'themes', 'slots', 'collections']) {
  const prior = original.document[group];
  const current = final.document[group];
  assert.equal(canonicalJSON(current.slice(0, prior.length)), canonicalJSON(prior));
  const intermediate = stage40.groups[group];
  const prefixSha256 = sha(canonicalJSON(current.slice(0, intermediate.count)));
  assert.equal(prefixSha256, intermediate.sha256);
  groups[group] = {
    baselineCount: prior.length,
    baselinePreserved: true,
    stage40Count: intermediate.count,
    stage40PrefixSha256: prefixSha256,
    stage40Preserved: true,
    finalCount: current.length,
  };
}
assert.equal(original.assets.size, 127);
assert.equal(final.assets.size, 127);
const payloads = [];
for (const [hash, blob] of original.assets) {
  const before = Buffer.from(await blob.arrayBuffer());
  const after = Buffer.from(await final.assets.get(hash).arrayBuffer());
  assert.ok(before.equals(after));
  assert.equal(sha(after), hash);
  payloads.push({ sha256: hash, bytes: after.length });
}
const runtimePath = 'game/presentation/compiled/runtime.json';
const originalRuntime = validateCompiledPresentation(JSON.parse(historical(runtimePath)));
const runtime = validateCompiledPresentation(JSON.parse(await readFile(runtimePath)));
assert.equal(runtime.resolved.theme.id, 'fpv');
assert.equal(runtime.resolved.theme.revision, 41);
assert.equal(runtime.resolved.collection, null);
const pictures = [];
const actorSlots = [
  'player.scout.compact',
  'player.scout.detailed',
  'enemy.bouncer',
  'enemy.border-patrol',
  'enemy.relay-sentinel',
];
for (const slot of actorSlots)
  assert.equal(
    canonicalJSON(runtime.resolved.assets[slot]),
    canonicalJSON(originalRuntime.resolved.assets[slot]),
  );
for (const binding of COOP_PICTURE_BINDINGS) {
  assert.equal(binding.themeRevision, 41);
  const { picture } = binding;
  const asset = runtime.resolved.assets[picture.slot];
  assert.equal(canonicalJSON(asset), canonicalJSON(originalRuntime.resolved.assets[picture.slot]));
  assert.equal(picture.assetId, asset.id);
  assert.equal(picture.assetRevision, asset.revision);
  for (const key of ['sha256', 'bytes', 'width', 'height', 'mime'])
    assert.equal(picture[key], asset.file[key]);
  assert.deepEqual(asset.geometry.frame, { x: 0, y: 0, width: 1152, height: 576 });
  const path = `game/presentation/compiled/${runtime.urls[picture.sha256]}`;
  const bytes = await readFile(path);
  assert.equal(bytes.length, picture.bytes);
  assert.equal(sha(bytes), picture.sha256);
  assert.equal(bytes.readUInt32BE(16), picture.width);
  assert.equal(bytes.readUInt32BE(20), picture.height);
  assert.ok(bytes.equals(Buffer.from(await final.assets.get(picture.sha256).arrayBuffer())));
  pictures.push({
    levelId: binding.levelId,
    ...picture,
    geometry: asset.geometry,
    descriptorUnchanged: true,
    compiledBytesMatchLedger: true,
  });
}
assert.equal(COOP_HISTORICAL_IMPORT_PICTURE_POLICY.themeRevision, 41);
assert.deepEqual(COOP_HISTORICAL_IMPORT_PICTURE_POLICY.picture, COOP_PICTURE_BINDINGS[0].picture);
const bindingPath = 'game/couch/coop-picture-bindings.mjs';
assert.equal(
  await readFile(bindingPath, 'utf8'),
  historical(bindingPath)
    .toString()
    .replace(
      'fpv38 is an exact reviewed metadata successor: all127 original payloads',
      'fpv41 is an exact reviewed metadata successor: all 127 original payloads',
    )
    .replaceAll('themeRevision: 38', 'themeRevision: 41'),
);
const unchangedFiles = ['game/couch/coop-presentation.mjs', 'game/coop/library.mjs'];
for (const path of unchangedFiles) assert.ok((await readFile(path)).equals(historical(path)));
const tests = [
  'coop-picture-bindings',
  'coop-historical-import-picture',
  'coop-presentation',
  'coop-picture-host',
  'coop-import-production-reader',
  'coop-local-artwork-picture',
  'coop-presentation-bootstrap-retry',
  'coop-presentation-envelope',
  'coop-view-presentation',
  'coop-actor-presentation',
  'coop-picture-recovery-focus',
  'coop-victory-picture',
].map((name) => `game/test/${name}.test.mjs`);
const pins = [];
for (const path of [
  bindingPath,
  ...unchangedFiles,
  runtimePath,
  'game/presentation/compiled/manifest.json',
  'game/presentation/compiled/studio.json',
  ...tests,
]) {
  const bytes = await readFile(path);
  pins.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}
const receipt = {
  format: 'revealline-team-picture-metadata-successor-review.v1',
  baselineSource: baseline,
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
  node: process.version,
  scope: 'Exact three theme revision pins 38 to 41; unchanged lease, pack, pictures and geometry.',
  baselineLedger: { revision: 38, bytes: originalBytes.length, sha256: sha(originalBytes) },
  finalLedger: { revision: 41, bytes: finalBytes.length, sha256: sha(finalBytes) },
  stage40Receipt: { path: stage40Path, sha256: sha(stage40Bytes) },
  groups,
  payloads: {
    count: payloads.length,
    allBodiesByteEqual: true,
    tableSha256: sha(canonicalJSON(payloads)),
  },
  pictures,
  unchangedActorDescriptors: actorSlots,
  unchangedFiles,
  pins,
  limitations: [
    'No native browser decoding or play was performed by this review.',
    'No new picture, music, visual, offline or public-release approval is inferred.',
  ],
};
await writeFile(`${directory}/verification.json`, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  'PASS: 127 payload bodies, all baseline and stage-40 record prefixes, both compiled full-frame pictures, three exact revision-41 bindings, unchanged lease and starter pack.',
);
