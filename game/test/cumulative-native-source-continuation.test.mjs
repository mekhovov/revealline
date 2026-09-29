import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CUMULATIVE_NATIVE_REVIEW_PATH,
  cumulativeNativeContinuation,
  readCumulativeNativeContinuation,
  cumulativeSourceReviewed,
} from '../../scripts/cumulative-native-source-continuation.mjs';
import {
  fieldKitRecipeQuality,
  fieldKitEquipmentQuality,
} from '../../scripts/produce-field-kit-theme.mjs';
import { fieldKitTeamRecipeQuality } from '../../scripts/team-recipe-review.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, validateAssetRevision } from '../presentation/model.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_SUPPORTED_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
} from '../couch/coop-picture-bindings.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';

const read = (name) => readFile(new URL('../../' + name, import.meta.url));
const reviewBytes = await read(CUMULATIVE_NATIVE_REVIEW_PATH);
const review = cumulativeNativeContinuation(reviewBytes);
const paths = new Set([
  CUMULATIVE_NATIVE_REVIEW_PATH,
  ...review.priorReviews.map((pin) => pin.path),
  ...review.originalReceipts.map((pin) => pin.path),
  ...Object.values(review.fingerprints).flatMap((group) => group.paths),
]);
const original = new Map(await Promise.all([...paths].map(async (p) => [p, await read(p)])));
const source = (group) => {
  const row = review.fingerprints[group];
  return group === 'equipment'
    ? row.currentSHA256
    : `${row.paths.join('; ')} sha256:${row.currentSHA256}`;
};
const changed = (bytes) => Buffer.concat([bytes, Buffer.from('\nchanged')]);

test('current seven-group review authenticates original evidence and exact ordered source inputs', async () => {
  assert.deepEqual(
    await readCumulativeNativeContinuation(async (p) => original.get(p)),
    reviewBytes,
  );
  assert.deepEqual(Object.keys(review.fingerprints), [
    'ui',
    'screens',
    'motion',
    'effects',
    'team',
    'audio',
    'equipment',
  ]);
  assert.equal(review.acceptedPredecessor.productionRevision, 101);
  assert.equal(review.acceptedPredecessor.audioRevision, 53);
  for (const [group, row] of Object.entries(review.fingerprints)) {
    assert.equal(new Set(row.paths).size, row.paths.length);
    assert.deepEqual(
      row.inputs.map((pin) => pin.path),
      row.paths,
    );
    for (const slot of row.slots ?? [undefined]) {
      assert.equal(cumulativeSourceReviewed(group, source(group), reviewBytes, slot), true);
      assert.equal(
        cumulativeSourceReviewed(group, source(group) + ' changed', reviewBytes, slot),
        false,
      );
      assert.equal(
        cumulativeSourceReviewed(group, source(group), changed(reviewBytes), slot),
        false,
      );
    }
  }
  assert.equal(cumulativeSourceReviewed('__proto__', source('audio'), reviewBytes), false);
  assert.equal(
    cumulativeSourceReviewed('team', source('team'), reviewBytes, 'team.unknown'),
    false,
  );
  assert.equal(
    cumulativeSourceReviewed('equipment', source('equipment'), reviewBytes, 'trail.active'),
    false,
  );
});

test('every original evidence record and source dependency fails closed when bytes change or disappear', async () => {
  for (const target of paths) {
    await assert.rejects(
      readCumulativeNativeContinuation(async (p) =>
        p === target ? changed(original.get(p)) : original.get(p),
      ),
      /changed/,
      target,
    );
    await assert.rejects(
      readCumulativeNativeContinuation(async (p) => {
        if (p === target) throw new Error('missing ' + target);
        return original.get(p);
      }),
      /missing/,
      target,
    );
  }
  assert.equal(cumulativeNativeContinuation(null), null);
  assert.equal(cumulativeNativeContinuation(Buffer.from('{}')), null);
});

test('current ordinary recipe evidence appends without losing any historical audio evidence', () => {
  const defaults = createDefaultThemeBundle();
  for (const group of ['ui', 'screens', 'motion', 'effects', 'audio']) {
    const row = review.fingerprints[group];
    const oldSource = `${row.priorPaths.join('; ')} sha256:${row.priorSHA256}`;
    const previous = fieldKitRecipeQuality(group, oldSource);
    const current = fieldKitRecipeQuality(group, source(group), reviewBytes);
    assert.equal(previous.stage, 'reviewed', group);
    assert.equal(current.stage, 'reviewed', group);
    const compact = previous.evidence.length === 16;
    if (compact) {
      assert.equal(current.evidence.length, 16);
      assert.ok(current.evidence[0].endsWith('\n' + previous.evidence[0]));
      assert.deepEqual(current.evidence.slice(1), previous.evidence.slice(1));
    } else assert.deepEqual(current.evidence.slice(0, -1), previous.evidence, group);
    assert.match(
      current.evidence[compact ? 0 : current.evidence.length - 1],
      /generated, packaged, public, physical and human acceptance remain separate/,
    );
    if (group === 'audio') assert.equal(previous.evidence.length, 16);
    const slot = defaults.slots.find((row) => row.group === group);
    const asset = defaults.assets.find((row) => row.id === `${slot.id}.default`);
    assert.doesNotThrow(() => validateAssetRevision({ ...asset, quality: current }));
    if (group === 'audio')
      assert.throws(
        () =>
          validateAssetRevision({
            ...asset,
            quality: { ...current, evidence: [...current.evidence, 'unbounded'] },
          }),
        /quality evidence/,
      );
    assert.equal(fieldKitRecipeQuality(group, source(group)).stage, 'source');
    assert.equal(
      fieldKitRecipeQuality(group, source(group) + ' changed', reviewBytes).stage,
      'source',
    );
  }
  assert.equal(fieldKitRecipeQuality('team', source('team'), reviewBytes).stage, 'source');
});

test('new Team source review cannot bypass original role, default, image or ancestor gates', async () => {
  const bytes = await read('docs/verification/team37/review.json');
  const team = JSON.parse(bytes);
  const defaults = createDefaultThemeBundle().assets;
  const sprites = JSON.parse(await read('game/assets/field-kit/sprites/sprites.json'));
  const inheritedAssets = Object.fromEntries(
    team.inheritedImages.map((expected) => {
      const sprite = sprites.assets.find((entry) => entry.slotId === expected.slot);
      const { path: filePath, ...file } = sprite.file;
      assert.ok(filePath);
      const asset = {
        format: FORMATS.asset,
        id: expected.assemblyAsset.id,
        revision: 1,
        kind: 'image',
        description: sprite.description,
        file,
        recipe: null,
        geometry: sprite.geometry,
        provenance: {
          ...sprite.provenance,
          parent: { id: `${sprite.slotId}.default`, revision: 1 },
        },
        quality: sprite.quality,
      };
      return [asset.id, asset];
    }),
  );
  const ancestors = {
    reviewBytes: bytes,
    successorReviewBytes: await read(
      'docs/verification/team-specialist-cues-2026-09-24/review.json',
    ),
    continuationReviewBytes: await read(
      'docs/verification/v0.132.5-presentation-continuation/review.json',
    ),
    bulkContinuationReviewBytes: await read(
      'docs/verification/bulk-integration-presentation-continuation-2026-09-27/review.json',
    ),
    cumulativeReviewBytes: reviewBytes,
  };
  assert.equal(team.recipes.length, 37);
  for (const role of team.recipes) {
    const args = {
      ...ancestors,
      slotId: role.slot,
      source: source('team'),
      recipe: role.defaultRecipePayload,
      defaultAsset: defaults.find((asset) => asset.id === role.defaultAsset.id),
      inheritedAssets,
    };
    const current = fieldKitTeamRecipeQuality(args);
    assert.equal(current.stage, 'reviewed', role.slot);
    const prior = review.fingerprints.team;
    const previous = fieldKitTeamRecipeQuality({
      ...args,
      source: `${prior.priorPaths.join('; ')} sha256:${prior.priorSHA256}`,
      cumulativeReviewBytes: null,
    });
    assert.equal(previous.stage, 'reviewed');
    for (const entry of previous.evidence)
      assert.ok(
        current.evidence.some((value) => value.includes(entry)),
        role.slot,
      );
    for (const key of Object.keys(ancestors)) {
      assert.equal(fieldKitTeamRecipeQuality({ ...args, [key]: null }).stage, 'source', key);
      assert.equal(
        fieldKitTeamRecipeQuality({ ...args, [key]: changed(args[key]) }).stage,
        'source',
        key,
      );
    }
    for (const patch of [
      { slotId: 'team.unknown' },
      { recipe: { id: 'unreviewed' } },
      { defaultAsset: { ...args.defaultAsset, description: 'changed' } },
      { inheritedAssets: {} },
      { source: source('team') + ' changed' },
    ])
      assert.equal(fieldKitTeamRecipeQuality({ ...args, ...patch }).stage, 'source');
    for (const id of Object.keys(inheritedAssets)) {
      const altered = structuredClone(inheritedAssets);
      altered[id].file.sha256 = '0'.repeat(64);
      assert.equal(
        fieldKitTeamRecipeQuality({ ...args, inheritedAssets: altered }).stage,
        'source',
        id,
      );
    }
  }
});

test('five-image continuation requires unchanged original PNG identity and every ancestor', async () => {
  const equipment = JSON.parse(
    await read('docs/verification/team-equipment-five-review/review.json'),
  );
  const ancestors = await Promise.all(
    [
      'docs/verification/team-specialist-cues-2026-09-24/review.json',
      'docs/verification/v0.132.5-presentation-continuation/review.json',
      'docs/verification/bulk-integration-presentation-continuation-2026-09-27/review.json',
    ].map(read),
  );
  for (const row of equipment.originals) {
    const args = [row.slot, source('equipment'), row.sha256, ...ancestors, reviewBytes];
    const current = fieldKitEquipmentQuality(...args);
    assert.equal(current.stage, 'reviewed', row.slot);
    const previous = fieldKitEquipmentQuality(
      row.slot,
      review.fingerprints.equipment.priorSHA256,
      row.sha256,
      ...ancestors,
    );
    assert.equal(previous.stage, 'reviewed');
    assert.equal(previous.evidence.length, 2, 'retain both exact predecessor scopes');
    assert.equal(current.evidence.length, 3, 'append only the current scoped review');
    for (const entry of previous.evidence) assert.ok(current.evidence.includes(entry), row.slot);
    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      const altered = [...args];
      altered[index] = index < 3 ? 'unreviewed' : changed(args[index]);
      assert.equal(fieldKitEquipmentQuality(...altered).stage, 'produced', row.slot + ':' + index);
    }
  }
});

test('only explicit102 is added to finite Team picture authority;101 is preserved and98 excluded', () => {
  const revisions = [
    58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
    82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102,
  ];
  assert.deepEqual(
    [...new Set(COOP_SUPPORTED_PICTURE_BINDINGS.map((r) => r.themeRevision))].sort((a, b) => a - b),
    revisions,
  );
  assert.equal(COOP_SUPPORTED_PICTURE_BINDINGS.length, 88);
  assert.equal(COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.length, 44);
  for (const revision of revisions) {
    assert.deepEqual(
      COOP_SUPPORTED_PICTURE_BINDINGS.filter((r) => r.themeRevision === revision),
      COOP_PICTURE_BINDINGS.map((r) => ({ ...r, themeRevision: revision })),
    );
  }
  const create = (historicalImportPolicy) =>
    createCoopPresentation({
      bindings: COOP_SUPPORTED_PICTURE_BINDINGS,
      historicalImportPolicy,
      getSnapshot: () => null,
      readPicture: () => {
        throw new Error('must not read');
      },
      decodeImage: () => {
        throw new Error('must not decode');
      },
    });
  create(COOP_HISTORICAL_IMPORT_PICTURE_POLICIES).dispose();
  assert.throws(
    () =>
      create([
        ...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
        { ...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES[0], themeRevision: 103 },
      ]),
    /array exceeds/,
  );
  assert.throws(
    () =>
      create([
        ...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.slice(0, 43),
        COOP_HISTORICAL_IMPORT_PICTURE_POLICIES[0],
      ]),
    /Duplicate Team historical picture identity/,
  );
  assert.equal(
    COOP_SUPPORTED_PICTURE_BINDINGS.some((r) => [98, 103].includes(r.themeRevision)),
    false,
  );
});
