import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  fieldKitRecipeSources,
  verifyFieldKitAudioContinuationReview,
  verifyFieldKitCanonicalSoundtrackReview,
  verifyFieldKitCompanyAudioContinuationReview,
} from './produce-field-kit-theme.mjs';

test('every declared helper invalidates all sharing groups and leaves nonconsumers unchanged', async () => {
  const inputs = new Map();
  const before = await fieldKitRecipeSources(async (name) => {
    inputs.set(name, Buffer.from(name));
    return inputs.get(name);
  });
  const consumers = new Map();
  for (const [group, source] of Object.entries(before)) {
    const paths = source.split(' sha256:')[0].split('; ');
    assert.equal(new Set(paths).size, paths.length, `${group}: duplicate input`);
    for (const name of paths) {
      assert(inputs.has(name), `${group}: unread input ${name}`);
      if (!consumers.has(name)) consumers.set(name, []);
      consumers.get(name).push(group);
    }
  }
  // These independent sharing contracts guard against a missing dependency
  // being accepted just because it vanished from the declaration under test.
  for (const [name, groups] of [
    ['game/presentation/dom-ownership.mjs', ['ui']],
    ['game/presentation/host.mjs', ['ui']],
    ['game/ui/field-kit-compiled.css', ['screens', 'ui']],
    ['game/presentation/team-runtime-slots.mjs', ['team', 'ui']],
    ['game/content-design/actor-marker.mjs', ['effects', 'team']],
    ['game/ui/lane-presentation.mjs', ['effects']],
    ['game/ui/render.mjs', ['effects']],
    ['game/ui/relay-view.mjs', ['effects']],
    ['game/ui/directional-view.mjs', ['effects']],
    ['game/enemy-catalog.mjs', ['effects', 'team']],
    ['game/presentation/journey-actor-materials.mjs', ['motion', 'team']],
    ['game/ui/actor-presentation.mjs', ['motion', 'team']],
    ['game/ui/actor-recipes.mjs', ['effects', 'motion', 'team']],
    ['game/ui/fpv-body-recipes.mjs', ['effects', 'motion', 'team']],
    ['game/ui/body-backing.mjs', ['effects', 'motion', 'team']],
    ['game/ui/body-motion.mjs', ['effects', 'motion', 'team']],
    ['authoring/motion-lab/render-character.mjs', ['motion', 'team']],
    ['authoring/motion-lab/animation.mjs', ['effects', 'motion', 'team']],
    ['authoring/motion-lab/presets.json', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/scout.png', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/bomber.png', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/carrier.png', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/interceptor.png', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/fiber.png', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/impact.png', ['motion']],
    ['authoring/library/fpv-role-presentations/originals/trapper.png', ['motion']],
    ['game/ui/classic-view.mjs', ['effects', 'team']],
    ['game/couch/coop-view.mjs', ['team']],
    ['game/soundtrack-bundled.mjs', ['audio']],
    ['game/soundtrack-portable.mjs', ['audio']],
    ['game/content/soundtrack-catalogue.mjs', ['audio']],
    ['game/online-soundtrack-catalogue.mjs', ['audio']],
    ['game/official-downloads.mjs', ['audio']],
    ['game/soundtrack-download-volumes.mjs', ['audio']],
    ['game/installed-app.mjs', ['audio']],
    ['game/managed-media-store.mjs', ['audio']],
    ['game/media-storage-record.mjs', ['audio']],
    ['game/soundtrack-private-intake.mjs', ['audio']],
    ['game/ui/soundtrack-error-copy.mjs', ['audio']],
  ])
    assert.deepEqual([...(consumers.get(name) ?? [])].sort(), groups, name);
  assert.equal(consumers.size, inputs.size, 'Every read belongs to a declared group');
  for (const [name, groups] of consumers) {
    const after = await fieldKitRecipeSources(async (file) =>
      file === name ? Buffer.from(`${file}: changed`) : inputs.get(file),
    );
    for (const group of Object.keys(before))
      assert.equal(before[group] !== after[group], groups.includes(group), `${name}/${group}`);
  }
  assert.deepEqual(await fieldKitRecipeSources(async (file) => inputs.get(file)), before);
});

test('missing helper bytes cannot produce a supposedly valid fingerprint', async () => {
  for (const missing of [
    'game/ui/lane-presentation.mjs',
    'authoring/library/fpv-role-presentations/originals/impact.png',
  ])
    await assert.rejects(
      fieldKitRecipeSources(async (file) => {
        if (file === missing) throw new Error('Missing required helper');
        return Buffer.from(file);
      }),
      /Missing required helper/,
    );
});

test('audio continuation pins both current review and immutable predecessor bytes', async () => {
  const current = await readFile(
    new URL(
      '../docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json',
      import.meta.url,
    ),
  );
  const predecessor = await readFile(
    new URL(
      '../docs/verification/v0.141.0-managed-media-audio-continuation/review.json',
      import.meta.url,
    ),
  );
  assert.equal(verifyFieldKitAudioContinuationReview(current, predecessor), true);
  assert.equal(
    verifyFieldKitAudioContinuationReview(Buffer.concat([current, Buffer.from(' ')]), predecessor),
    false,
  );
  assert.equal(
    verifyFieldKitAudioContinuationReview(current, Buffer.concat([predecessor, Buffer.from(' ')])),
    false,
  );
});

test('current presentation continuation authenticates each immutable predecessor', async () => {
  const {
    readBulkPresentationContinuation,
    bulkPresentationContinuation,
    BULK_PRESENTATION_REVIEW_PATH,
  } = await import('./bulk-presentation-continuation.mjs');
  const read = (name) => readFile(new URL('../' + name, import.meta.url));
  const bytes = await readBulkPresentationContinuation(read);
  const review = bulkPresentationContinuation(bytes);
  assert.equal(review.format, 'revealline-bulk-presentation-continuation.v1');
  assert.equal(bulkPresentationContinuation(Buffer.concat([bytes, Buffer.from(' ')])), null);
  for (const changed of [
    BULK_PRESENTATION_REVIEW_PATH,
    ...Object.values(review.priorReviews).map((entry) => entry.path),
  ]) {
    await assert.rejects(
      readBulkPresentationContinuation(async (name) => {
        const body = await read(name);
        return name === changed ? Buffer.concat([body, Buffer.from(' ')]) : body;
      }),
      /review bytes changed/,
    );
    await assert.rejects(
      readBulkPresentationContinuation(async (name) => {
        if (name === changed) throw new Error('Missing review bytes');
        return read(name);
      }),
      /Missing review bytes/,
    );
  }
});

test('scoped current Team and equipment approval retains every semantic guard', async () => {
  const { createFieldKitProduction, fieldKitEquipmentQuality, fieldKitEquipmentSource } =
    await import('./produce-field-kit-theme.mjs');
  const { fieldKitTeamRecipeQuality } = await import('./team-recipe-review.mjs');
  const { createDefaultThemeBundle } = await import('../game/presentation/catalog.mjs');
  const { readBulkPresentationContinuation, bulkPresentationContinuation } = await import(
    './bulk-presentation-continuation.mjs'
  );
  const read = (name) => readFile(new URL('../' + name, import.meta.url));
  const bulkContinuationReviewBytes = await readBulkPresentationContinuation(read);
  const review = bulkPresentationContinuation(bulkContinuationReviewBytes);
  const [reviewBytes, successorReviewBytes, continuationReviewBytes] = await Promise.all([
    read(review.priorReviews.team.path),
    read(review.priorReviews.teamSuccessor.path),
    read(review.priorReviews.teamContinuation.path),
  ]);
  const production = await createFieldKitProduction();
  const baseline = createDefaultThemeBundle();
  const inheritedAssets = Object.fromEntries(
    production.document.assets
      .filter((asset) => asset.kind === 'image')
      .map((asset) => [asset.id, asset]),
  );
  const original = JSON.parse(reviewBytes);
  for (const slotId of review.fingerprints.team.slots) {
    const asset = production.document.assets.find((entry) => entry.id === slotId + '.field-kit');
    const args = {
      slotId,
      source: asset.provenance.source,
      recipe: asset.recipe,
      defaultAsset: baseline.assets.find((entry) => entry.id === asset.provenance.parent.id),
      inheritedAssets,
      reviewBytes,
      successorReviewBytes,
      continuationReviewBytes,
      bulkContinuationReviewBytes,
    };
    assert.equal(fieldKitTeamRecipeQuality(args).stage, 'reviewed', slotId);
    for (const override of [
      { slotId: 'team.not-reviewed' },
      { source: args.source + ' altered' },
      { recipe: { ...args.recipe, id: 'unknown.recipe' } },
      { defaultAsset: { ...args.defaultAsset, description: 'altered' } },
      { reviewBytes: Buffer.concat([reviewBytes, Buffer.from(' ')]) },
      { successorReviewBytes: Buffer.concat([successorReviewBytes, Buffer.from(' ')]) },
      { continuationReviewBytes: Buffer.concat([continuationReviewBytes, Buffer.from(' ')]) },
      {
        bulkContinuationReviewBytes: Buffer.concat([bulkContinuationReviewBytes, Buffer.from(' ')]),
      },
      { bulkContinuationReviewBytes: undefined },
    ])
      assert.equal(fieldKitTeamRecipeQuality({ ...args, ...override }).stage, 'source', slotId);
    for (const expected of original.inheritedImages) {
      const changed = {
        ...inheritedAssets,
        [expected.asset.id]: { ...inheritedAssets[expected.asset.id], description: 'altered' },
      };
      assert.equal(
        fieldKitTeamRecipeQuality({ ...args, inheritedAssets: changed }).stage,
        'source',
        slotId + '/' + expected.asset.id,
      );
    }
  }
  const source = await fieldKitEquipmentSource(read);
  for (const slotId of review.fingerprints.equipment.slots) {
    const asset = production.document.assets.find((entry) => entry.id === slotId + '.field-kit');
    assert.equal(asset.quality.stage, 'reviewed', slotId);
    const quality = (id, fingerprint, png, current = bulkContinuationReviewBytes) =>
      fieldKitEquipmentQuality(
        id,
        fingerprint,
        png,
        successorReviewBytes,
        continuationReviewBytes,
        current,
      ).stage;
    assert.equal(quality(slotId, source, asset.file.sha256), 'reviewed');
    assert.equal(quality(slotId, source + ' altered', asset.file.sha256), 'produced');
    assert.equal(quality(slotId, source, '0'.repeat(64)), 'produced');
    assert.equal(quality('team.not-reviewed', source, asset.file.sha256), 'produced');
    assert.equal(quality(slotId, source, asset.file.sha256, Buffer.alloc(0)), 'produced');
  }
});

test('company startup audio review and both immutable predecessor byte strings fail closed', async () => {
  const current = await readFile(
    new URL(
      '../docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
      import.meta.url,
    ),
  );
  const prior = await readFile(
    new URL(
      '../docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json',
      import.meta.url,
    ),
  );
  const managed = await readFile(
    new URL(
      '../docs/verification/v0.141.0-managed-media-audio-continuation/review.json',
      import.meta.url,
    ),
  );
  assert.equal(verifyFieldKitCompanyAudioContinuationReview(current, prior, managed), true);
  for (let index = 0; index < 3; index++) {
    const changed = [current, prior, managed];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitCompanyAudioContinuationReview(...changed), false);
  }
});

test('canonical soundtrack review and both reconciled review byte strings fail closed', async () => {
  const current = await readFile(
    new URL(
      '../docs/verification/canonical-soundtrack-main-rebase-2026-09-28/review.json',
      import.meta.url,
    ),
  );
  const company = await readFile(
    new URL(
      '../docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
      import.meta.url,
    ),
  );
  const external = await readFile(
    new URL(
      '../docs/verification/external-soundtrack-delivery-2026-09-27/review.json',
      import.meta.url,
    ),
  );
  const branchRebase = await readFile(
    new URL(
      '../docs/verification/canonical-soundtrack-rebase-audio-continuation-2026-09-27/review.json',
      import.meta.url,
    ),
  );
  assert.equal(
    verifyFieldKitCanonicalSoundtrackReview(current, company, branchRebase, external),
    true,
  );
  for (let index = 0; index < 4; index++) {
    const changed = [current, company, branchRebase, external];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitCanonicalSoundtrackReview(...changed), false);
  }
});
