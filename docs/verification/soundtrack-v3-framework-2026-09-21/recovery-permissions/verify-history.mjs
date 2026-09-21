import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { importThemeBundle } from '../../../../game/presentation/bundle.mjs';
import { resolvePresentation } from '../../../../game/presentation/model.mjs';
import { canonicalJSON } from '../../../../game/data-json.mjs';
import { fieldKitRecipeSources } from '../../../../scripts/produce-field-kit-theme.mjs';

const baselineHead = '2248f7f35ac5ad75b8bdff5aaa66ca45417180be';
const ledger = 'authoring/library/fpv-field-kit/production.rltheme';
const expectedRevision = Number(process.argv[2]);
const expectedStage = process.argv[3];
assert.ok([42, 43].includes(expectedRevision));
assert.equal(expectedStage, expectedRevision === 42 ? 'source' : 'reviewed');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const beforeBytes = execFileSync('git', ['show', `${baselineHead}:${ledger}`], {
  maxBuffer: 16 * 1024 ** 2,
});
const afterBytes = await fs.readFile(ledger);
const before = await importThemeBundle(new Blob([beforeBytes]), { decodeImage: null });
const after = await importThemeBundle(new Blob([afterBytes]), { decodeImage: null });
assert.equal(before.document.revision, 41);
assert.equal(after.document.revision, expectedRevision);
const groups = {};
for (const [name, value] of Object.entries(before.document)) {
  if (!Array.isArray(value)) continue;
  assert.deepEqual(after.document[name].slice(0, value.length), value, name);
  groups[name] = {
    retained: value.length,
    appended: after.document[name].length - value.length,
    retainedSha256: sha(canonicalJSON(value)),
    totalCount: after.document[name].length,
    sha256: sha(canonicalJSON(after.document[name])),
  };
}
if (expectedRevision === 43) {
  const source42 = JSON.parse(
    await fs.readFile(new URL('./source42-complete.json', import.meta.url)),
  );
  assert.equal(source42.revision, 42);
  for (const [name, pin] of Object.entries(source42.groups))
    assert.equal(
      sha(canonicalJSON(after.document[name].slice(0, pin.totalCount))),
      pin.sha256,
      `Source-stage 42 ${name}`,
    );
}
assert.equal(groups.slots.appended, 0);
assert.equal(groups.collections.appended, 0);
assert.equal(groups.assets.appended, 8 * (expectedRevision - 41));
assert.equal(groups.themes.appended, expectedRevision - 41);
for (const asset of after.document.assets.slice(before.document.assets.length))
  assert.match(asset.id, /^audio\./);
for (const theme of after.document.themes.slice(before.document.themes.length))
  assert.ok(Object.keys(theme.bindings).every((key) => key.startsWith('audio.')));
assert.equal(before.assets.size, 127);
assert.equal(after.assets.size, before.assets.size);
for (const [hash, blob] of before.assets) {
  const original = Buffer.from(await blob.arrayBuffer());
  const retained = Buffer.from(await after.assets.get(hash).arrayBuffer());
  assert.deepEqual(retained, original, hash);
  assert.equal(sha(retained), hash);
}
const oldSelected = resolvePresentation(before.document).assets;
const selected = resolvePresentation(after.document).assets;
const recipes = await fieldKitRecipeSources((file) => fs.readFile(file));
for (const [slot, asset] of Object.entries(selected)) {
  if (!slot.startsWith('audio.')) assert.deepEqual(asset, oldSelected[slot], slot);
  else {
    assert.equal(asset.quality.stage, expectedStage, slot);
    assert.equal(asset.provenance.source, recipes.audio, slot);
  }
}
const result = {
  baselineHead,
  baselineRevision: before.document.revision,
  revision: after.document.revision,
  stage: expectedStage,
  ledger: { bytes: afterBytes.length, sha256: sha(afterBytes) },
  groups,
  exactPreservedPayloads: after.assets.size,
  unchangedOtherSelectedSlots: true,
  recipeSources: recipes,
  approvedRecordings: 0,
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
