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
const successorBytes = await readFile(
  new URL('../team-specialist-cues-2026-09-24/review.json', directory),
);
const successor = JSON.parse(successorBytes);
const continuationBytes = await readFile(
  new URL('../v0.132.5-presentation-continuation/review.json', directory),
);
const continuation = JSON.parse(continuationBytes);
const read = (name) => readFile(new URL(name, root));

test('five-image continuation authenticates exact originals, dependency closure and attributed evidence', async () => {
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
  const changes = new Map(
    [
      ...successor.changedInputs,
      ...continuation.teamChangedInputs,
      ...continuation.equipmentOnlyChangedInputs,
    ].map((entry) => [entry.path, entry]),
  );
  for (const entry of inputs.inputs) {
    const current = sha(await read(entry.path));
    if (changes.has(entry.path)) {
      assert.equal(changes.get(entry.path).currentSHA256, current, entry.path);
    } else assert.equal(current, entry.sha256, entry.path);
  }
  assert.equal(inputs.inputs.length, 29);
  const current = await fieldKitEquipmentSource(read);
  assert.equal(current, continuation.fingerprints.equipment.currentSHA256);
  for (const image of originals) {
    const quality = fieldKitEquipmentQuality(
      image.slot,
      current,
      image.sha256,
      successorBytes,
      continuationBytes,
    );
    assert.equal(quality.stage, 'reviewed');
    assert.ok(
      quality.evidence.some((value) => value.includes(`review.json sha256:${sha(reviewBytes)}`)),
    );
    assert.ok(quality.evidence.some((value) => value.includes(sha(continuationBytes))));
  }
});

test('every reviewed art or renderer input change reopens only the equipment image gate', async () => {
  const dependencies = [];
  const original = await fieldKitEquipmentSource(async (name) => {
    dependencies.push(name);
    return read(name);
  });
  for (const dependency of dependencies) {
    const changed = await fieldKitEquipmentSource(async (name) => {
      const bytes = await read(name);
      return name === dependency
        ? Buffer.concat([bytes, Buffer.from('\n/* Unreviewed change. */\n')])
        : bytes;
    });
    assert.notEqual(changed, original, dependency);
    for (const image of originals)
      assert.equal(
        fieldKitEquipmentQuality(
          image.slot,
          changed,
          image.sha256,
          successorBytes,
          continuationBytes,
        ).stage,
        'produced',
        dependency,
      );
  }
  for (const image of originals) {
    assert.equal(
      fieldKitEquipmentQuality(
        image.slot,
        original,
        '0'.repeat(64),
        successorBytes,
        continuationBytes,
      ).stage,
      'produced',
    );
    assert.equal(
      fieldKitEquipmentQuality(
        image.slot,
        original,
        originals.find((other) => other.slot !== image.slot).sha256,
        successorBytes,
        continuationBytes,
      ).stage,
      'produced',
    );
  }
  for (const unknown of ['team.support.pulse', 'team.core.unknown', '__proto__'])
    assert.equal(
      fieldKitEquipmentQuality(
        unknown,
        original,
        originals[0].sha256,
        successorBytes,
        continuationBytes,
      ).stage,
      'produced',
    );
  for (const image of originals)
    assert.equal(
      fieldKitEquipmentQuality(
        image.slot,
        original,
        image.sha256,
        successorBytes,
        Buffer.concat([continuationBytes, Buffer.from('\n')]),
      ).stage,
      'produced',
      'changed continuation review bytes fail closed',
    );
  for (const image of originals)
    assert.equal(
      fieldKitEquipmentQuality(image.slot, review.sourceFingerprint, image.sha256).stage,
      'reviewed',
      'the immutable prior review remains usable for its exact source',
    );
});

test('actual production assembly reviews only exact five image originals with the separately reviewed37 Team recipes', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const imageIds = new Set(originals.map(({ slot }) => slot));
  const team = Object.entries(resolved.assets).filter(([slot]) => slot.startsWith('team.'));
  assert.equal(team.length, 42);
  assert.equal(team.filter(([slot]) => !imageIds.has(slot)).length, 37);
  for (const [slot, asset] of team) {
    if (!imageIds.has(slot)) {
      assert.equal(asset.kind, 'recipe', slot);
      assert.equal(asset.quality.stage, 'reviewed', slot);
      assert.ok(
        asset.quality.evidence[0].includes(
          'docs/verification/v0.132.5-presentation-continuation/review.json',
        ),
        slot,
      );
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
      fieldKitEquipmentQuality(
        slot,
        continuation.fingerprints.equipment.currentSHA256,
        expected.sha256,
        successorBytes,
        continuationBytes,
      ),
    );
  }
});
