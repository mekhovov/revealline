import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  createFieldKitProduction,
  fieldKitEquipmentSource,
  fieldKitEquipmentQuality,
} from '../../scripts/produce-field-kit-theme.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = new URL('../../', import.meta.url);
const directory = new URL('docs/verification/team-equipment-five-review/', root);
const reviewBytes = await readFile(new URL('review.json', directory));
const review = JSON.parse(reviewBytes);
const inputs = JSON.parse(await readFile(new URL('inputs.json', directory)));
const originals = JSON.parse(await readFile(new URL('originals.json', directory)));
const read = (name) => readFile(new URL(name, root));

test('five-image review authenticates exact originals, dependency closure and attributed evidence', async () => {
  assert.deepEqual(
    originals.map(({ slot }) => slot),
    [
      'team.anchor.available',
      'team.anchor.captured',
      'team.core.shielded',
      'team.core.exposed',
      'team.core.secured',
    ],
  );
  for (const entry of review.evidence)
    assert.equal(sha(await readFile(new URL(entry.path, directory))), entry.sha256, entry.path);
  for (const entry of inputs.inputs)
    assert.equal(sha(await read(entry.path)), entry.sha256, entry.path);
  assert.equal(inputs.inputs.length, 29);
  assert.equal(await fieldKitEquipmentSource(read), review.sourceFingerprint);
  for (const image of originals) {
    const quality = fieldKitEquipmentQuality(image.slot, review.sourceFingerprint, image.sha256);
    assert.equal(quality.stage, 'reviewed');
    assert.ok(
      quality.evidence.some((value) => value.includes(`review.json sha256:${sha(reviewBytes)}`)),
    );
  }
});

test('every reviewed art or renderer input change reopens only the equipment image gate', async () => {
  const original = await fieldKitEquipmentSource(read);
  for (const entry of inputs.inputs) {
    const changed = await fieldKitEquipmentSource(async (name) => {
      const bytes = await read(name);
      return name === entry.path
        ? Buffer.concat([bytes, Buffer.from('\n/* Unreviewed change. */\n')])
        : bytes;
    });
    assert.notEqual(changed, original, entry.path);
    for (const image of originals)
      assert.equal(
        fieldKitEquipmentQuality(image.slot, changed, image.sha256).stage,
        'produced',
        entry.path,
      );
  }
  for (const image of originals) {
    assert.equal(fieldKitEquipmentQuality(image.slot, original, '0'.repeat(64)).stage, 'produced');
    assert.equal(
      fieldKitEquipmentQuality(
        image.slot,
        original,
        originals.find((other) => other.slot !== image.slot).sha256,
      ).stage,
      'produced',
    );
  }
  for (const unknown of ['team.support.pulse', 'team.core.unknown', '__proto__'])
    assert.equal(
      fieldKitEquipmentQuality(unknown, original, originals[0].sha256).stage,
      'produced',
    );
});

test('actual production assembly reviews only exact five image originals and leaves all37 Team recipes source', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const imageIds = new Set(originals.map(({ slot }) => slot));
  const team = Object.entries(resolved.assets).filter(([slot]) => slot.startsWith('team.'));
  assert.equal(team.length, 42);
  assert.equal(team.filter(([slot]) => !imageIds.has(slot)).length, 37);
  for (const [slot, asset] of team) {
    if (!imageIds.has(slot)) {
      assert.equal(asset.kind, 'recipe', slot);
      assert.equal(asset.quality.stage, 'source', slot);
      continue;
    }
    const expected = originals.find((image) => image.slot === slot);
    assert.equal(asset.kind, 'image');
    assert.equal(asset.quality.stage, 'reviewed');
    assert.equal(asset.file.sha256, expected.sha256);
    assert.equal(asset.file.width, expected.width);
    assert.equal(asset.file.height, expected.height);
    assert.deepEqual(asset.geometry, expected.geometry);
    const raw = Buffer.from(await production.assets.get(asset.file.sha256).arrayBuffer());
    assert.equal(raw.length, expected.bytes);
    assert.equal(sha(raw), expected.sha256);
    assert.deepEqual(
      asset.quality,
      fieldKitEquipmentQuality(slot, review.sourceFingerprint, expected.sha256),
    );
  }
});
