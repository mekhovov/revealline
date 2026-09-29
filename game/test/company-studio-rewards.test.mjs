import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createStudioReward,
  previewStudioReward,
} from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioData } from '../../authoring/company-studio/model.mjs';
import { validateEditionRuntimeCatalog } from '../editions/model.mjs';
import { createCompanyWorkspaceFiles } from '../../scripts/company-studio.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';

const json = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const catalog = await json('../editions/catalog.json');
const campaign = catalog.campaigns.find((item) => item.id === 'coupa-spend-in-motion');
const source = await json(`../../${campaign.sourcePath}`);
const edition = catalog.editions.find((item) => item.id === 'coupa-adventure');
const locales = {
  en: {
    title: 'Our connected village',
    teaser: 'Win the declared missions to discover the story.',
    paragraph: 'An original fictional story for the campaign.',
  },
  uk: {
    title: 'Наше з’єднане містечко',
    teaser: 'Завершіть указані місії, щоб відкрити історію.',
    paragraph: 'Оригінальна вигадана історія цієї кампанії.',
  },
};
const create = (extra = {}) =>
  createStudioReward({ campaign, source, id: 'authored-reward', locales, ...extra });

test('authors explicitly select exact learning requirements without silently adding a mission or granting preview progress', () => {
  const lesson = {
    ...structuredClone(COMPANY_LESSONS[0]),
    campaignId: campaign.id,
    missionId: source.missions[1].id,
  };
  const reward = create({ rule: 'all-missions', lessons: [lesson], learningIds: [lesson.id] });
  assert.deepEqual(reward.requirements.learning, [completionLearningReference(lesson)]);
  assert.equal(previewStudioReward(reward, { edition, state: 'locked' }).eligible, false);
  assert.equal(previewStudioReward(reward, { edition, state: 'partial' }).eligible, false);
  assert.equal(previewStudioReward(reward, { edition, state: 'eligible' }).eligible, true);
  assert.equal(
    Object.hasOwn(previewStudioReward(reward, { edition, state: 'eligible' }), 'receipt'),
    false,
  );
  assert.throws(
    () =>
      create({
        rule: 'mission-win',
        missionId: source.missions[0].id,
        lessons: [lesson],
        learningIds: [lesson.id],
      }),
    /mission selected explicitly/,
  );
  for (const learningIds of [['unknown'], [lesson.id, lesson.id]])
    assert.throws(
      () => create({ rule: 'all-missions', lessons: [lesson], learningIds }),
      /distinct learning/,
    );
  assert.deepEqual(create({ rule: 'all-missions', lessons: [lesson] }).requirements.learning, []);
});

test('the studio requires an explicit completion rule and a valid selected mission', () => {
  for (const rule of [undefined, '', 'default', 'last-mission'])
    assert.throws(() => create({ rule }), /Choose a completion rule explicitly/);
  assert.throws(() => create({ rule: 'mission-win' }), /Choose a mission/);
  assert.throws(
    () => create({ rule: 'mission-win', missionId: 'foreign-mission' }),
    /Choose a mission/,
  );
  const reward = create({ rule: 'mission-win', missionId: source.missions[3].id });
  assert.equal(reward.scope.kind, 'mission');
  assert.deepEqual(
    reward.requirements.missions.map((item) => item.missionId),
    [source.missions[3].id],
  );
});

test('all-mission authoring includes every actual campaign mission and preserves both locales', () => {
  const reward = create({ rule: 'all-missions' });
  assert.equal(reward.scope.kind, 'campaign');
  assert.deepEqual(
    reward.requirements.missions.map((item) => item.missionId),
    source.campaigns.find((item) => item.id === campaign.id).missionIds,
  );
  for (const locale of ['en', 'uk']) {
    assert.equal(reward.locales[locale].teaser, locales[locale].teaser);
    assert.deepEqual(reward.payloads[0].locales[locale].paragraphs, [locales[locale].paragraph]);
  }
  assert.deepEqual(
    validateStudioData(
      campaign.rewardPath,
      JSON.stringify([reward]),
      catalog,
      new Map([[campaign.sourcePath, source]]),
    ),
    [reward],
  );
});

test('an explicit mission checklist creates a bounded campaign promise without inferring the last level', () => {
  const missionIds = [source.missions[1].id, source.missions[4].id];
  const reward = create({ rule: 'selected-missions', missionIds });
  assert.equal(reward.scope.kind, 'campaign');
  assert.deepEqual(
    reward.requirements.missions.map((item) => item.missionId),
    missionIds,
  );
  for (const invalid of [undefined, [], [missionIds[0], missionIds[0]], ['foreign-mission']])
    assert.throws(
      () => create({ rule: 'selected-missions', missionIds: invalid }),
      /distinct missions/,
    );
});

test('locked, partial and eligible previews project synthetic evidence without changing definitions', () => {
  const reward = create({ rule: 'all-missions' });
  const before = JSON.stringify({ reward, edition });
  const locked = previewStudioReward(reward, { edition, state: 'locked' });
  const partial = previewStudioReward(reward, { edition, state: 'partial' });
  const eligible = previewStudioReward(reward, { edition, state: 'eligible' });
  assert.equal(locked.completed, 0);
  assert.equal(partial.completed, 5);
  assert.equal(partial.eligible, false);
  assert.equal(eligible.completed, 6);
  assert.equal(eligible.eligible, true);
  assert.equal(JSON.stringify({ reward, edition }), before);
  assert.equal(Object.hasOwn(eligible, 'receipt'), false);
});

test('new generic company campaigns can author knowledge rewards without company-specific code', () => {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'museum',
    editionId: 'museum-public',
    name: 'Museum',
  });
  const original = workspace.catalog.campaigns[0];
  const custom = {
    ...original,
    rewardPath: original.sourcePath.replace(/\.json$/, '.rewards.json'),
  };
  const fixtureSource = JSON.parse(workspace.files.get(custom.sourcePath).toString('utf8'));
  const fixtureCatalog = validateEditionRuntimeCatalog({
    ...workspace.catalog,
    campaigns: [custom],
  });
  const reward = createStudioReward({
    campaign: custom,
    source: fixtureSource,
    rule: 'all-missions',
    id: 'museum-guide',
    locales,
  });
  assert.equal(reward.brandId, 'museum');
  assert.deepEqual(
    validateStudioData(
      custom.rewardPath,
      [reward],
      fixtureCatalog,
      new Map([[custom.sourcePath, fixtureSource]]),
    ),
    [reward],
  );
});
