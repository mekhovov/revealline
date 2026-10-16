import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  fieldKitRecipeSources,
  verifyFieldKitNativeMenuContinuationReview,
  verifyFieldKitSteamDeckAudioContinuationReview,
  verifyFieldKitDiscoveryAudioContinuationReview,
  verifyFieldKitDiscoveryWebPUIContinuationReview,
  verifyFieldKitGP4RestoreAudioContinuationReview,
  verifyFieldKitSelectorAudioContinuationReview,
  verifyFieldKitMainReconciliationReview,
  verifyFieldKitAudioStyleMenuCorrectionReview,
  verifyFieldKitAudioStyleMenuReview,
  verifyFieldKitPlayerReadinessAudioReview,
  verifyFieldKitLocalizationAudioReview,
  verifyFieldKitSteamDeckPresentationContinuationReview,
  verifyFieldKitMainBulkAudioReview,
  verifyFieldKitAudioContinuationReview,
  verifyFieldKitCanonicalSoundtrackReview,
  verifyFieldKitBulkQueueReview,
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
    ['game/ui/contact-cue.mjs', ['effects', 'team']],
    ['game/ui/combat-view.mjs', ['effects']],
    ['game/ui/combat-presentation.mjs', ['effects']],
    ['game/core/registry.mjs', ['effects']],
    ['game/core/combat-definition.mjs', ['effects']],
    ['game/core/geometry.mjs', ['effects']],
    ['game/core/classic-motion.mjs', ['effects']],
    ['game/core/classic-topology.mjs', ['effects']],
    ['game/core/movement.mjs', ['effects']],
    ['game/core/versions.mjs', ['effects']],
    ['game/ui/relay-view.mjs', ['effects']],
    ['game/ui/directional-view.mjs', ['effects']],
    ['game/enemy-catalog.mjs', ['effects', 'team']],
    ['game/presentation/journey-actor-materials.mjs', ['motion', 'team']],
    ['game/ui/actor-presentation.mjs', ['effects', 'motion', 'team']],
    ['game/ui/rotor-presentation.mjs', ['motion', 'team']],
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
    ['game/text-size.mjs', ['team']],
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
    ['game/journey/campaign-feedback.mjs', ['audio']],
    ['game/rewards/audio-original.mjs', ['audio']],
    ['game/rewards/media-format.mjs', ['audio']],
    ['game/ui/edition-solo.mjs', ['audio']],
    ['game/ui/edition-rewards.mjs', ['audio']],
    ['game/ui/reward-media.mjs', ['audio']],
    ['game/ui/reward-audio-group.mjs', ['audio']],
    ['game/rewards/audio-groups.mjs', ['audio']],
    ['game/studio-preview-session.mjs', ['audio']],
    ['game/audio-preferences.mjs', ['audio']],
    ['game/ui/story-dialog.mjs', ['audio']],
    ['game/ui/victory-story.mjs', ['audio']],
    ['game/ui/music.mjs', ['audio']],
    ['game/data-json.mjs', ['audio', 'effects']],
    ['game/mp3.mjs', ['audio']],
    ['game/media-audio.mjs', ['audio']],
    ['game/video-poster.mjs', ['audio']],
    ['game/rewards/model.mjs', ['audio']],
    ['game/rewards/media.mjs', ['audio']],
    ['game/editions/assets.mjs', ['audio']],
    ['game/editions/model.mjs', ['audio']],
    ['game/editions/retained-presentation.mjs', ['audio']],
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
    'game/ui/contact-cue.mjs',
    'game/ui/combat-view.mjs',
    'game/ui/combat-presentation.mjs',
    'game/ui/actor-presentation.mjs',
    'game/data-json.mjs',
    'game/core/registry.mjs',
    'game/core/combat-definition.mjs',
    'game/core/geometry.mjs',
    'game/core/classic-motion.mjs',
    'game/core/classic-topology.mjs',
    'game/core/movement.mjs',
    'game/core/versions.mjs',
    'game/ui/lane-presentation.mjs',
    'game/text-size.mjs',
    'game/journey/campaign-feedback.mjs',
    'game/rewards/audio-original.mjs',
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

test('bulk queue continuation binds current review and all six immutable predecessors', async () => {
  const current = await readFile(
    new URL(
      '../docs/verification/bulk-queue-audio-effects-2026-09-28/review.json',
      import.meta.url,
    ),
  );
  const paths = [
    'docs/verification/canonical-soundtrack-main-rebase-2026-09-28/review.json',
    'docs/verification/fpv-family-effects-continuation-2026-09-28/review.json',
    'docs/verification/bulk-integration-presentation-continuation-2026-09-27/review.json',
    'docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
    'docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json',
    'docs/verification/v0.141.0-managed-media-audio-continuation/review.json',
  ];
  const prior = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitBulkQueueReview(current, prior), true);
  assert.equal(
    verifyFieldKitBulkQueueReview(Buffer.concat([current, Buffer.from(' ')]), prior),
    false,
  );
  assert.equal(verifyFieldKitBulkQueueReview(current, prior.slice(1)), false);
  for (let i = 0; i < prior.length; i++) {
    const changed = [...prior];
    changed[i] = Buffer.concat([changed[i], Buffer.from(' ')]);
    assert.equal(verifyFieldKitBulkQueueReview(current, changed), false);
  }
  assert.equal(verifyFieldKitBulkQueueReview(current, [...prior].reverse()), false);
});

test('Steam Deck Confirm presentation continuation and all immutable predecessors fail closed', async () => {
  const paths = [
    'docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json',
    'docs/verification/actor-only-ui-continuation-2026-09-24/review.json',
    'docs/verification/v0.131.0-localization-presentation-continuation/review.json',
    'docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
    'docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json',
    'docs/verification/v0.141.0-managed-media-audio-continuation/review.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitSteamDeckPresentationContinuationReview(...bytes), true);
  for (let index = 0; index < bytes.length; index++) {
    const changed = [...bytes];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitSteamDeckPresentationContinuationReview(...changed), false);
  }
});

test('main and bulk continuation rejects every altered immutable review byte string', async () => {
  const paths = [
    'docs/verification/bulk-main320-audio-continuation-2026-09-28/review.json',
    'docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json',
    'docs/verification/bulk-queue-audio-effects-2026-09-28/review.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitMainBulkAudioReview(...bytes), true);
  for (let i = 0; i < bytes.length; i++) {
    const changed = [...bytes];
    changed[i] = Buffer.concat([changed[i], Buffer.from(' ')]);
    assert.equal(verifyFieldKitMainBulkAudioReview(...changed), false);
  }
});

test('localization audio continuation rejects either altered immutable review', async () => {
  const paths = [
    'docs/verification/localization14-audio-continuation-2026-09-28/review.json',
    'docs/verification/bulk-main320-audio-continuation-2026-09-28/review.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitLocalizationAudioReview(...bytes), true);
  for (let i = 0; i < bytes.length; i++) {
    const changed = [...bytes];
    changed[i] = Buffer.concat([changed[i], Buffer.from(' ')]);
    assert.equal(verifyFieldKitLocalizationAudioReview(...changed), false);
  }
  assert.equal(verifyFieldKitLocalizationAudioReview(bytes[1], bytes[0]), false);
});

test('player readiness audio continuation rejects either altered immutable review', async () => {
  const paths = [
    'docs/verification/player-readiness17-audio-continuation-2026-09-28/review.json',
    'docs/verification/localization14-audio-continuation-2026-09-28/review.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitPlayerReadinessAudioReview(...bytes), true);
  for (let i = 0; i < bytes.length; i++) {
    const changed = [...bytes];
    changed[i] = Buffer.concat([changed[i], Buffer.from(' ')]);
    assert.equal(verifyFieldKitPlayerReadinessAudioReview(...changed), false);
  }
  assert.equal(verifyFieldKitPlayerReadinessAudioReview(bytes[1], bytes[0]), false);
});

test('Audio style-menu continuation and its immutable predecessor fail closed', async () => {
  const paths = [
    'docs/verification/audio-style-menu-2026-09-28/review.json',
    'docs/verification/player-readiness17-audio-continuation-2026-09-28/review.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitAudioStyleMenuReview(...bytes), true);
  for (let index = 0; index < bytes.length; index++) {
    const changed = [...bytes];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitAudioStyleMenuReview(...changed), false);
  }
  assert.equal(verifyFieldKitAudioStyleMenuReview(bytes[1], bytes[0]), false);
});

test('Audio style-menu correction and production98 predecessor oracle fail closed', async () => {
  const paths = [
    'docs/verification/audio-style-menu-correction-2026-09-28/review.json',
    'docs/verification/audio-style-menu-2026-09-28/review.json',
    'game/test/fixtures/production-pr770-0d165-audio50.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitAudioStyleMenuCorrectionReview(...bytes), true);
  for (let index = 0; index < bytes.length; index++) {
    const changed = [...bytes];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitAudioStyleMenuCorrectionReview(...changed), false);
  }
  assert.equal(verifyFieldKitAudioStyleMenuCorrectionReview(...bytes.toReversed()), false);
});

test('Steam Deck audio continuation and exact production99 predecessor fail closed', async () => {
  const paths = [
    'docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json',
    'docs/verification/audio-style-menu-correction-2026-09-28/review.json',
    'game/test/fixtures/production-v01422-a585-fpv99.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitSteamDeckAudioContinuationReview(...bytes), true);
  for (let index = 0; index < bytes.length; index++) {
    const changed = [...bytes];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitSteamDeckAudioContinuationReview(...changed), false);
  }
  assert.equal(verifyFieldKitSteamDeckAudioContinuationReview(...bytes.toReversed()), false);
});

test('discovery audio continuation pins the new review, unchanged predecessors and independent production100 oracle', async () => {
  const paths = [
    'docs/verification/discovery-audio-continuation-2026-09-29/review.json',
    'docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json',
    'docs/verification/audio-style-menu-correction-2026-09-28/review.json',
    'game/test/fixtures/production-v01423-6a67-fpv100.json',
  ];
  const originals = await Promise.all(
    paths.map((name) => readFile(new URL('../' + name, import.meta.url))),
  );
  assert.equal(verifyFieldKitDiscoveryAudioContinuationReview(...originals), true);
  for (const index of originals.keys()) {
    for (const changed of [Buffer.alloc(0), Buffer.concat([originals[index], Buffer.from(' ')])]) {
      const candidate = [...originals];
      candidate[index] = changed;
      assert.equal(
        verifyFieldKitDiscoveryAudioContinuationReview(...candidate),
        false,
        paths[index],
      );
    }
  }
});

test('discovery WebP UI continuation pins its review and immutable source-stage production101', async () => {
  const paths = [
    'docs/verification/discovery-webp-ui-continuation-2026-09-29/review.json',
    'docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json',
    'game/test/fixtures/production-discovery-source-ui-fpv101.json',
  ];
  const originals = await Promise.all(
    paths.map((name) => readFile(new URL('../' + name, import.meta.url))),
  );
  assert.equal(verifyFieldKitDiscoveryWebPUIContinuationReview(...originals), true);
  for (const index of originals.keys()) {
    for (const changed of [Buffer.alloc(0), Buffer.concat([originals[index], Buffer.from(' ')])]) {
      const candidate = [...originals];
      candidate[index] = changed;
      assert.equal(
        verifyFieldKitDiscoveryWebPUIContinuationReview(...candidate),
        false,
        paths[index],
      );
    }
  }
  assert.equal(verifyFieldKitDiscoveryWebPUIContinuationReview(...originals.toReversed()), false);
});

test('gp4 restore audio continuation pins the scoped review and complete production102 predecessor', async () => {
  const paths = [
    'docs/verification/discovery-gp4-restore-audio-continuation-2026-09-29/review.json',
    'docs/verification/discovery-audio-continuation-2026-09-29/review.json',
    'game/test/fixtures/production-discovery-reviewed-ui-fpv102.json',
  ];
  const originals = await Promise.all(
    paths.map((name) => readFile(new URL('../' + name, import.meta.url))),
  );
  assert.equal(verifyFieldKitGP4RestoreAudioContinuationReview(...originals), true);
  for (const index of originals.keys()) {
    for (const changed of [Buffer.alloc(0), Buffer.concat([originals[index], Buffer.from(' ')])]) {
      const candidate = [...originals];
      candidate[index] = changed;
      assert.equal(
        verifyFieldKitGP4RestoreAudioContinuationReview(...candidate),
        false,
        paths[index],
      );
    }
  }
  assert.equal(verifyFieldKitGP4RestoreAudioContinuationReview(...originals.toReversed()), false);
});

test('Selector audio continuation and exact production100 predecessor fail closed', async () => {
  const paths = [
    'docs/verification/v0.142.4-selector-audio-continuation/review.json',
    'docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json',
    'game/test/fixtures/production-v01423-b5ab-fpv100.json',
  ];
  const bytes = await Promise.all(
    paths.map((path) => readFile(new URL('../' + path, import.meta.url))),
  );
  assert.equal(verifyFieldKitSelectorAudioContinuationReview(...bytes), true);
  for (let index = 0; index < bytes.length; index++) {
    const changed = [...bytes];
    changed[index] = Buffer.concat([changed[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitSelectorAudioContinuationReview(...changed), false);
  }
  assert.equal(verifyFieldKitSelectorAudioContinuationReview(...bytes.toReversed()), false);
});

test('main reconciliation authenticates both review lineages, original archive and retained inputs', async () => {
  const paths = [
    'docs/verification/discovery-main321-reconciliation/review.json',
    'docs/verification/v0.142.4-selector-audio-continuation/review.json',
    'docs/verification/discovery-gp4-restore-audio-continuation-2026-09-29/review.json',
    'game/test/fixtures/production-v01424-main321-fpv101.json',
    'game/test/fixtures/production-discovery-db4-fpv103.json',
    'docs/verification/discovery-main321-reconciliation/discovery-production103.rltheme.gz',
    'docs/verification/discovery-main321-reconciliation/retained-inputs.json',
  ];
  const inputs = await Promise.all(
    paths.map((name) => readFile(new URL('../' + name, import.meta.url))),
  );
  assert.equal(verifyFieldKitMainReconciliationReview(...inputs), true);
  for (const index of inputs.keys()) {
    const changed = [...inputs];
    changed[index] = Buffer.concat([inputs[index], Buffer.from(' ')]);
    assert.equal(verifyFieldKitMainReconciliationReview(...changed), false, paths[index]);
  }
  assert.equal(verifyFieldKitMainReconciliationReview(...inputs.toReversed()), false);
});

test('native-menu continuation requires all four exact historical/source pins', async () => {
  const paths = [
    'docs/verification/native-menu-ui-audio-20260930/review.json',
    'docs/verification/discovery-webp-ui-continuation-2026-09-29/review.json',
    'docs/verification/radio-audio-20260929/review.json',
    'game/test/fixtures/production-native-main1b-fpv103.json',
  ];
  const inputs = await Promise.all(
    paths.map((name) => readFile(new URL('../' + name, import.meta.url))),
  );
  assert.equal(verifyFieldKitNativeMenuContinuationReview(...inputs), true);
  for (let index = 0; index < inputs.length; index += 1) {
    const changed = inputs.map((bytes) => Buffer.from(bytes));
    changed[index][changed[index].length - 1] ^= 1;
    assert.equal(verifyFieldKitNativeMenuContinuationReview(...changed), false, paths[index]);
    assert.equal(
      verifyFieldKitNativeMenuContinuationReview(...inputs.filter((_, i) => i !== index)),
      false,
    );
  }
  assert.equal(verifyFieldKitNativeMenuContinuationReview(...inputs, inputs[0]), false);
  assert.equal(verifyFieldKitNativeMenuContinuationReview(...inputs.toReversed()), false);
  assert.equal(verifyFieldKitNativeMenuContinuationReview(), false);
});
