import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  INDUSTRIAL_ENVIRONMENT_REVISION as revision,
  INDUSTRIAL_ENVIRONMENT_MATERIALS,
  industrialMaterialPixels,
} from '../presentation/industrial-materials.mjs';
import { createWorkshopTexture } from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import { militaryFieldPixels } from '../presentation/military-field-art.mjs';
import { createSharedActorStudy } from '../../authoring/motion-lab/shared-actor-study.mjs';
import { INDUSTRIAL_ROSTER_SAMPLES, OVERHEAD_ACTOR_SAMPLES } from '../hunt/actor-art.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('released material pixels retain their exact historical identity', () => {
  const historical = {
    concrete: 'd128ca4d4118eea9e6151fcd7a05ff5cee593a5fecb46e59ca42c5d3a043c0f0',
    earth: '223e5db77e1c33267c9b263ea1ffd95ed6cdce502fbd0e672dd0cb9fea7bfa76',
    metal: 'aa5d46de93eff22fc59045b50c0be8cacf7e1fce471ae6c0dc3478f76602a465',
  };
  for (const [material, expected] of Object.entries(historical))
    assert.equal(
      digest(industrialMaterialPixels({ width: 32, height: 32 }, material).rgba),
      expected,
    );
});

test('six bounded material families retain opaque concealment and deterministic authored variations', () => {
  for (const size of [16, 24, 32, 128]) {
    const identities = new Set();
    for (const material of INDUSTRIAL_ENVIRONMENT_MATERIALS) {
      const variants = new Set();
      for (let variant = 0; variant < 4; variant++) {
        const frame = industrialMaterialPixels({ width: size, height: size }, material, {
          revision,
          variant,
        });
        assert.equal(frame.rgba.length, size * size * 4);
        for (let at = 3; at < frame.rgba.length; at += 4) assert.equal(frame.rgba[at], 255);
        assert.deepEqual(
          frame,
          industrialMaterialPixels({ width: size, height: size }, material, { revision, variant }),
        );
        variants.add(digest(frame.rgba));
        identities.add(digest(frame.rgba));
      }
      assert.equal(variants.size, 4, `${material} must have four actual variations at ${size}px`);
    }
    assert.equal(identities.size, 24);
  }
  for (const options of [
    { revision: 'unknown' },
    { revision, variant: -1 },
    { revision, variant: 4 },
    { variant: 1 },
  ])
    assert.throws(() => industrialMaterialPixels({ width: 32, height: 32 }, 'concrete', options));
  assert.throws(() => industrialMaterialPixels({ width: 32, height: 32 }, 'timber'));
});

test('native Capture and SIM keep material rules while sharing only the selected versioned pixels', () => {
  for (const [slot, role, material] of [
    ['terrain.wall', 'concrete', 'concrete'],
    ['terrain.slow', 'grass', 'earth'],
    ['terrain.lethal', 'steel', 'metal'],
  ]) {
    assert.deepEqual(
      militaryFieldPixels({ width: 32, height: 32 }, slot, { revision }).rgba,
      industrialMaterialPixels({ width: 32, height: 32 }, material, { revision }).rgba,
    );
    const texture = createWorkshopTexture(role, {
      collectionId: 'military-field',
      reviewRevision: revision,
    });
    try {
      assert.equal(texture.userData.materialRole, role);
      assert.equal(texture.userData.materialReviewRevision, revision);
      assert.equal(
        digest(texture.image.data),
        digest(industrialMaterialPixels({ width: 128, height: 128 }, material, { revision }).rgba),
      );
    } finally {
      texture.dispose();
    }
  }
});

test('Motion Lab v3 drafts round-trip every family without replacing historical defaults', () => {
  const old = createSharedActorStudy();
  assert.deepEqual(old.snapshot().descriptor, OVERHEAD_ACTOR_SAMPLES.courier);
  const study = createSharedActorStudy({ artRevision: revision });
  for (const [family, descriptor] of Object.entries(INDUSTRIAL_ROSTER_SAMPLES)) {
    study.selectFamily(family);
    assert.deepEqual(study.snapshot().descriptor, descriptor);
    study.selectClip('move');
    study.editFrame({ durationMs: 137 });
    const exported = study.exportJSON(),
      imported = createSharedActorStudy({ artRevision: revision, family });
    imported.importJSON(exported);
    assert.deepEqual(imported.snapshot().descriptor, study.snapshot().descriptor);
    assert.deepEqual(old.snapshot().descriptor, OVERHEAD_ACTOR_SAMPLES.courier);
  }
});
