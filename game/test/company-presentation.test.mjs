import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanyTheme, createCompanyPresets } from '../company-campaigns/brands.mjs';
import { validateTheme } from '../content.mjs';
import { createActorPresentation } from '../ui/actor-presentation.mjs';
import { bodyMotionPose } from '../ui/body-motion.mjs';

test('company presentation is data-only and rejects unknown recipes or invalid sound', () => {
  for (const id of ['coupa', 'droneaid']) {
    const theme = createCompanyTheme(id);
    assert.equal(validateTheme(theme).valid, true);
    assert.equal(validateTheme({ ...theme, actorRecipes: { bouncer: 'script:run' } }).valid, false);
    assert.equal(
      validateTheme({ ...theme, soundtrack: { ...theme.soundtrack, tempo: Infinity } }).valid,
      false,
    );
    assert.equal(validateTheme({ ...theme, coverColor: 'url(external)' }).valid, false);
  }
});

test('rigid logo motion stops with reduced motion and never changes collision records', () => {
  const body = createCompanyPresets('coupa').characters['coupa-flower'];
  const before = structuredClone(body);
  assert.notEqual(
    bodyMotionPose(body, { seconds: 1 }).heading,
    bodyMotionPose(body, { seconds: 2 }).heading,
  );
  assert.deepEqual(
    bodyMotionPose(body, { seconds: 500, heading: 2, speedRatio: 1, reduced: true }),
    { heading: 0, bank: 0 },
  );
  assert.equal(bodyMotionPose(body, { seconds: 2, bank: 1 }).bank, 0);
  assert.deepEqual(body, before);
});

test('fictional enemy silhouettes preserve physical contact and supported movement identities', () => {
  const enemies = [{ id: 'paper', type: 'bouncer', x: 8, y: 9, radius: 0.25 }];
  const before = structuredClone(enemies);
  const sample = (options) => createActorPresentation().sample(enemies, options).get('paper');
  const original = sample({}),
    themed = sample({ bodyRecipes: createCompanyTheme('coupa').actorRecipes });
  assert.equal(themed.bodyRecipe, 'paper-tangle');
  for (const property of ['type', 'x', 'y', 'radius', 'diameter'])
    assert.equal(themed[property], original[property]);
  assert.deepEqual(enemies, before);
});
