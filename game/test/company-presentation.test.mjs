import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  COMPANY_BRANDS,
  createCompanyTheme,
  createCompanyThemes,
  createCompanyPresets,
} from '../company-campaigns/brands.mjs';
import { validateTheme } from '../content.mjs';
import { createActorPresentation } from '../ui/actor-presentation.mjs';
import { bodyMotionPose } from '../ui/body-motion.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

test('company presentation is data-only and rejects unknown recipes or invalid sound', () => {
  for (const id of ['coupa', 'droneaid', 'droneaid-nl']) {
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

test('every advanced company actor keeps a registered company body and the canonical core role', () => {
  for (const brandId of ['coupa', 'droneaid-nl']) {
    const project = compileContentProject(createCompanyProject({ brandId }));
    const themes = createCompanyThemes(brandId);
    const seen = new Set();
    for (const mission of project.missions) {
      const manifest = resolveMission(project, mission.id);
      const theme = themes.find((item) => item.id === manifest.presentation.themeId);
      for (const actor of manifest.level.enemies) {
        seen.add(actor.type);
        assert.equal(
          typeof theme.actorRecipes[actor.type],
          'string',
          `${mission.id}: ${actor.type}`,
        );
      }
    }
    for (const type of [
      'bouncer',
      'border-patrol',
      'contour-patrol',
      'claimed-rover',
      'eroder',
      'lane-boss',
      'relay-sentinel',
    ])
      assert(seen.has(type), `${brandId}: ${type} exercised`);
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

test('campaign-specific cosmetics stay within the selected brand and valid recipe registry', () => {
  for (const brand of COMPANY_BRANDS) {
    const themes = createCompanyThemes(brand.id);
    assert.deepEqual(
      themes.map((theme) => theme.id),
      brand.themeIds ?? [brand.themeId],
    );
    for (const theme of themes) {
      assert.equal(validateTheme(theme).valid, true, theme.id);
      assert.equal(theme.player, brand.actorSetId);
      assert(Object.values(theme.classBodies).every((id) => id === brand.actorSetId));
    }
    if (brand.id !== 'droneaid') {
      assert.equal(
        new Set(themes.slice(1).map((theme) => theme.palette.field)).size,
        themes.length - 1,
      );
      assert.equal(
        new Set(themes.slice(1).map((theme) => theme.soundtrack.id)).size,
        themes.length - 1,
      );
    }
  }
});

test('official gameplay symbols spin at fixed chosen rates without travel-dependent speed', () => {
  const flower = createCompanyPresets('coupa').characters['coupa-flower'];
  const propeller = createCompanyPresets('droneaid-nl').characters['droneaid-nl-propeller'];
  assert.equal(flower.bodyMotion.radiansPerSecond, Math.PI);
  assert.equal(propeller.bodyMotion.radiansPerSecond, 4 * Math.PI);
  assert.deepEqual(flower.bodyBacking, { kind: 'opaque-interior', color: '#FFFFFF' });
  for (const body of [flower, propeller]) {
    assert.equal(body.bodyMotion.travelGain, 0);
    assert.deepEqual(
      bodyMotionPose(body, { seconds: 0.2, speedRatio: 0 }),
      bodyMotionPose(body, { seconds: 0.2, speedRatio: 1 }),
    );
    assert.deepEqual(bodyMotionPose(body, { seconds: 0.2, reduced: true }), {
      heading: 0,
      bank: 0,
    });
  }
});

test('Dutch propeller retains the four original official paths and pinned source bytes', () => {
  const source = readFileSync(
    new URL('../editions/assets/droneaid-nl/logo-source.svg', import.meta.url),
    'utf8',
  );
  const extracted = readFileSync(
    new URL('../editions/assets/droneaid-nl/propeller-source.svg', import.meta.url),
    'utf8',
  );
  const paths = (text) => [...text.matchAll(/<path\b.*?<\/path>/gs)].map((match) => match[0]);
  assert.equal(paths(source).length, 21);
  assert.deepEqual(paths(extracted), paths(source).slice(-4));
  assert(extracted.includes('viewBox="27.7458 6.12565 32 32"'));
  const assets = JSON.parse(
    readFileSync(new URL('../editions/assets.json', import.meta.url), 'utf8'),
  );
  for (const id of [
    'droneaid-nl-logo-source',
    'droneaid-nl-propeller-source',
    'droneaid-nl-propeller',
  ]) {
    const asset = assets.find((entry) => entry.id === id);
    const data = readFileSync(new URL(`../../${asset.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
    assert.equal(data.length, asset.bytes);
  }
});
