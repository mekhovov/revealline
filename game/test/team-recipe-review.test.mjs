import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  createFieldKitProduction,
  fieldKitRecipeSources,
} from '../../scripts/produce-field-kit-theme.mjs';
import { fieldKitTeamRecipeQuality } from '../../scripts/team-recipe-review.mjs';
const root = new URL('../../', import.meta.url);
const read = (name) => readFile(new URL(name, root));
const bytes = await read('docs/verification/team37/review.json');
const review = JSON.parse(bytes);
const successorBytes = await read('docs/verification/team-specialist-cues-2026-09-24/review.json');
const successor = JSON.parse(successorBytes);
const fingerprint = (await fieldKitRecipeSources(read)).team;
const reviewedSuccessorFingerprint = `${successor.fingerprint.paths} sha256:${successor.fingerprint.sha256}`;
const defaults = createDefaultThemeBundle().assets;
const production = await createFieldKitProduction();
const resolved = resolvePresentation(production.document);
const images = Object.fromEntries(
  review.inheritedImages.map(({ slot }) => {
    const image = structuredClone(resolved.assets[slot]);
    image.revision = 1;
    return [image.id, image];
  }),
);
const input = (role, source = fingerprint) => ({
  slotId: role.slot,
  source,
  recipe: structuredClone(role.defaultRecipePayload),
  defaultAsset: defaults.find((asset) => asset.id === role.defaultAsset.id),
  inheritedAssets: images,
  reviewBytes: bytes,
  successorReviewBytes: successorBytes,
});
const stage = (args) => fieldKitTeamRecipeQuality(args).stage;

test('current Team motion sources fail closed while the exact reviewed predecessor remains usable', () => {
  assert.equal(review.recipes.length, 37);
  assert.equal(new Set(review.recipes.map(({ slot }) => slot)).size, 37);
  assert.equal(review.inheritedImages.length, 4);
  for (const role of review.recipes) {
    assert.equal(stage(input(role)), 'source', role.slot);
    assert.equal(stage(input(role, reviewedSuccessorFingerprint)), 'reviewed', role.slot);
    const asset = resolved.assets[role.slot];
    assert.equal(asset.kind, 'recipe');
    assert.deepEqual(asset.recipe, role.defaultRecipePayload);
    assert.deepEqual(asset.quality, fieldKitTeamRecipeQuality(input(role)));
    assert.equal(asset.quality.stage, 'source');
    const reviewed = fieldKitTeamRecipeQuality(input(role, reviewedSuccessorFingerprint));
    assert.match(reviewed.evidence[0], /Team specialist functional successor:/);
    assert.ok(
      reviewed.evidence[0].includes(createHash('sha256').update(successorBytes).digest('hex')),
    );
  }
  // Default ancestor records remain source and are not mutated by the gate.
  assert.ok(
    defaults
      .filter((asset) => asset.id.startsWith('team.'))
      .every((asset) => asset.quality.stage === 'source'),
  );
});

test('changed/unknown roles, payloads, default records and review bytes remain source', () => {
  for (const role of review.recipes) {
    const original = input(role);
    assert.equal(
      stage({ ...original, recipe: { ...original.recipe, unreviewed: true } }),
      'source',
      role.slot,
    );
    assert.equal(stage({ ...original, recipe: { id: 'team-unknown' } }), 'source');
    assert.equal(
      stage({ ...original, defaultAsset: { ...original.defaultAsset, description: 'changed' } }),
      'source',
    );
    assert.equal(stage({ ...original, defaultAsset: null }), 'source');
    assert.equal(
      stage({ ...original, reviewBytes: Buffer.concat([bytes, Buffer.from('\n')]) }),
      'source',
    );
    assert.equal(stage({ ...original, reviewBytes: null }), 'source');
    assert.equal(
      stage({
        ...original,
        successorReviewBytes: Buffer.concat([successorBytes, Buffer.from('\n')]),
      }),
      'source',
    );
    assert.equal(stage({ ...original, successorReviewBytes: null }), 'source');
  }
  for (const slotId of ['team.unknown', 'team.anchor.available', '__proto__', 'trail.active'])
    assert.equal(stage({ ...input(review.recipes[0]), slotId }), 'source');
});

test('the exact predecessor remains reviewed and every current renderer dependency fails closed', async () => {
  assert.equal(successor.priorReview.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.notEqual(fingerprint, reviewedSuccessorFingerprint);
  assert.match(fingerprint, /game\/ui\/enemy-body-assets\.mjs/);
  for (const entry of review.fingerprint.inputs) {
    const changed = (
      await fieldKitRecipeSources(async (name) => {
        const value = await read(name);
        return name === entry.path
          ? Buffer.concat([value, Buffer.from('\n// unreviewed\n')])
          : value;
      })
    ).team;
    for (const role of review.recipes)
      assert.equal(stage({ ...input(role), source: changed }), 'source', entry.path);
  }
  assert.equal(
    stage({
      ...input(review.recipes[0]),
      source: 'wrong paths sha256:' + review.fingerprint.sha256,
    }),
    'source',
  );
  const legacy = `${review.fingerprint.inputs.map((entry) => entry.path).join('; ')} sha256:${review.fingerprint.sha256}`;
  assert.equal(
    stage({ ...input(review.recipes[0], legacy), successorReviewBytes: null }),
    'reviewed',
    'the immutable prior declaration remains independently usable for its exact source',
  );
  assert.equal(stage(input(review.recipes[0], reviewedSuccessorFingerprint)), 'reviewed');
});

test('every inherited image identity, bytes, geometry and record must remain exact', () => {
  for (const expected of review.inheritedImages) {
    const id = expected.asset.id;
    for (const mutate of [
      (image) => {
        image.id = 'different-image';
      },
      (image) => {
        image.file.sha256 = '0'.repeat(64);
      },
      (image) => {
        image.geometry = null;
      },
      (image) => {
        image.description += ' changed';
      },
      (image) => {
        image.quality.stage = 'reviewed';
      },
      (image) => {
        image.revision = 99;
      },
    ]) {
      const changed = structuredClone(images);
      mutate(changed[id]);
      for (const role of review.recipes)
        assert.equal(stage({ ...input(role), inheritedAssets: changed }), 'source', expected.slot);
    }
    const missing = { ...images };
    delete missing[id];
    assert.equal(stage({ ...input(review.recipes[0]), inheritedAssets: missing }), 'source');
  }
});

test('raw inherited PNG changes fail production authentication before a recipe can be reviewed', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'team-reviewed-originals-'));
  const write = async (name, value) => {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), value);
  };
  try {
    const sources = await fieldKitRecipeSources(read);
    for (const name of new Set(
      Object.values(sources).flatMap((source) => source.split(' sha256:')[0].split('; ')),
    ))
      await write(name, await read(name));
    const manifest = JSON.parse(await read('game/assets/field-kit/sprites/sprites.json'));
    for (const expected of review.inheritedImages) {
      const sprite = manifest.assets.find((entry) => entry.slotId === expected.slot);
      assert.ok(sprite, expected.slot);
      await write(
        'game/assets/field-kit/sprites/sprites.json',
        JSON.stringify({ ...manifest, assets: [sprite] }),
      );
      const name = `game/assets/field-kit/sprites/${sprite.file.path}`;
      const raw = Buffer.from(await read(name));
      raw[raw.length - 1] ^= 1;
      await write(name, raw);
      await assert.rejects(createFieldKitProduction({ projectRoot: directory }), {
        message: `Production bytes changed for ${expected.slot}.`,
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
