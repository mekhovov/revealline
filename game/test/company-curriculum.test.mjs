import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CURRICULUM_CAMPAIGNS,
  CURRICULUM_MISSIONS,
  CURRICULUM_SOURCES,
} from '../company-campaigns/curriculum.mjs';
import { createCurriculumProject } from '../company-campaigns/curriculum-content.mjs';
import { createCurriculumRewards } from '../company-campaigns/curriculum-rewards.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import {
  COMPANY_BRANDS,
  COMPANY_EDITIONS,
  createCompanyThemes,
} from '../company-campaigns/brands.mjs';
import { validateTheme } from '../content.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import {
  completionRewardAssetReferences,
  projectRewardProgress,
  validateCompletionRewards,
} from '../rewards/model.mjs';
import {
  DISCOVERY_PACING_BEATS,
  validateDiscoveryRewardBindings,
} from '../content-design/discovery-schema.mjs';
import {
  TRAIL_IMPACT_JOURNEY_POLICY,
  CURRENT_PRESSURE_ACTOR_CATALOG,
  PRESSURE_DIFFICULTY_CATALOG,
} from '../content-design/catalogs.mjs';

const json = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const [assets, artwork, catalog] = await Promise.all(
  ['../editions/assets.json', '../editions/artwork.json', '../editions/catalog.json'].map(json),
);
const projects = CURRICULUM_CAMPAIGNS.map((definition) => {
  const source = createCurriculumProject({ campaignId: definition.id, artwork });
  const missionBindings = createRewardMissionBindings(source);
  const rewards = validateCompletionRewards(
    createCurriculumRewards({ definition, source, assets, missionBindings }),
  );
  return { definition, source, missionBindings, rewards };
});

test('six real six-mission curricula preserve shared rules and use 36 distinct authored geometries', () => {
  assert.equal(CURRICULUM_CAMPAIGNS.length, 6);
  assert.equal(CURRICULUM_MISSIONS.length, 36);
  const geometry = (map) => JSON.stringify([map.walls, map.foundations, map.terrain, map.spawns]);
  const old = new Set(
    ['coupa', 'droneaid', 'droneaid-nl'].flatMap((brandId) =>
      createCompanyProject({ brandId }).maps.map(geometry),
    ),
  );
  const current = new Set();
  for (const { definition, source, missionBindings, rewards } of projects) {
    const compiled = compileContentProject(source);
    assert.equal(source.policyId, TRAIL_IMPACT_JOURNEY_POLICY.id);
    assert.equal(source.actorCatalogId, CURRENT_PRESSURE_ACTOR_CATALOG.id);
    assert.equal(source.difficultyCatalogId, PRESSURE_DIFFICULTY_CATALOG.id);
    assert.equal(compiled.missions.length, 6);
    assert.deepEqual(
      source.missions.map((mission) => mission.design.pacingBeat),
      DISCOVERY_PACING_BEATS,
    );
    validateDiscoveryRewardBindings(source, rewards, definition.id);
    for (const map of source.maps) {
      assert.ok(!old.has(geometry(map)), map.id + ' must not relabel an existing map');
      assert.ok(!current.has(geometry(map)), map.id + ' must not reuse another new map');
      current.add(geometry(map));
    }
    for (const entry of missionBindings)
      assert.deepEqual(entry.bindings.map((binding) => binding.difficulty).sort(), [
        'expert',
        'gentle',
        'standard',
      ]);
  }
  assert.equal(current.size, 36);
});

test('every new mission has sourced bilingual discovery content and an exact first-win binding', () => {
  for (const { definition, rewards, missionBindings } of projects) {
    assert.equal(rewards.length, 7);
    for (const missionId of definition.missionIds) {
      const row = CURRICULUM_MISSIONS.find((entry) => entry.id === missionId);
      const reward = rewards.find((entry) => entry.scope.id === missionId);
      assert.deepEqual(reward.requirements.missions, [
        {
          missionId,
          bindings: missionBindings.find((entry) => entry.levelId === missionId).bindings,
        },
      ]);
      assert.equal(reward.payloads.filter((entry) => entry.type === 'knowledge').length, 1);
      for (const locale of ['en', 'uk']) {
        assert.ok(row.locales[locale].brief.length > 25);
        assert.equal(row.locales[locale].paragraphs.length, 2);
        assert.ok(reward.locales[locale].teaser.length > 20);
        assert.ok(row.refs.every((ref) => CURRICULUM_SOURCES[ref].url.startsWith('https://')));
      }
      assert.notEqual(row.locales.en.name, row.locales.uk.name);
      assert.notEqual(row.locales.en.paragraphs[0], row.locales.uk.paragraphs[0]);
      assert.deepEqual(reward.requirements.learning, []);
      assert.deepEqual(reward.requirements.mastery, []);
    }
  }
});

test('all six finales stay locked with any one required win absent and reject wrong exact gameplay', () => {
  for (const { definition, rewards } of projects) {
    const finale = rewards.find((reward) => reward.scope.kind === 'campaign');
    assert.deepEqual(
      finale.requirements.missions.map((entry) => entry.missionId),
      definition.missionIds,
    );
    const context = {
      editionId: definition.brandId,
      brandId: definition.brandId,
      campaignIds: [definition.id],
      learning: [],
      mastery: [],
      clears: Object.fromEntries(
        finale.requirements.missions.map((entry, index) => [
          entry.missionId,
          {
            runId: `accepted-${index}`,
            ...entry.bindings.find((binding) => binding.difficulty === 'standard'),
          },
        ]),
      ),
    };
    assert.equal(projectRewardProgress(finale, context).eligible, true);
    for (const missing of definition.missionIds) {
      const partial = structuredClone(context);
      delete partial.clears[missing];
      const result = projectRewardProgress(finale, partial);
      assert.equal(result.eligible, false);
      assert.equal(result.completed, 5);
      assert.deepEqual(result.missingMissionIds, [missing]);
    }
    const changed = structuredClone(context);
    changed.clears[definition.missionIds[0]].gameplayId = 'another-gameplay';
    assert.equal(projectRewardProgress(finale, changed).eligible, false);
  }
});

test('explicit public dependencies include reusable home scenes and only the Ukraine painting comparison', () => {
  for (const { definition, source, rewards, missionBindings } of projects) {
    const descriptor = catalog.campaigns.find((entry) => entry.id === definition.id);
    // Four homes are four compositions, not twenty-four claimed distinct images.
    assert.equal(source.assets.length, 1);
    assert.equal(source.assets[0].id, `${definition.brandId}-home-picture`);
    assert.ok(
      source.missions.every(
        (mission) => mission.presentation.backgroundAssetId === source.assets[0].id,
      ),
    );
    assert.deepEqual(descriptor.assetIds, [
      `${definition.brandId}-home`,
      ...definition.rewardAssetIds,
    ]);
    for (const ref of completionRewardAssetReferences(rewards)) {
      assert.ok(descriptor.assetIds.includes(ref.assetId));
      assert.equal(assets.find((asset) => asset.id === ref.assetId).sha256, ref.sha256);
    }
    assert.throws(
      () => createCurriculumRewards({ definition, source, missionBindings, assets: [] }),
      /exact public inventory/,
    );
    assert.throws(
      () => createCurriculumProject({ campaignId: definition.id, artwork: [] }),
      /Missing admitted/,
    );
    assert.deepEqual(
      createRewardMissionBindings(createCurriculumProject({ campaignId: definition.id })),
      missionBindings,
    );
  }
  assert.deepEqual(
    CURRICULUM_CAMPAIGNS.filter((entry) => entry.rewardAssetIds.length).map((entry) => entry.id),
    ['ukraine-threads'],
  );
});

test('generated new campaign and reward files match their authoring sources', async () => {
  for (const { definition, source, rewards } of projects) {
    const descriptor = catalog.campaigns.find((entry) => entry.id === definition.id);
    assert.deepEqual(await json('../../' + descriptor.sourcePath), source);
    assert.deepEqual(await json('../../' + descriptor.rewardPath), rewards);
  }
});

test('second community campaigns use canonical frontier and roamer progression with registered distinct presentations', () => {
  const advanced = projects.filter(({ definition }) => definition.progression);
  assert.deepEqual(
    advanced.map(({ definition }) => definition.id),
    ['social-drone-community-connections', 'victory-drones-ideas-understanding'],
  );
  for (const { definition, source } of advanced) {
    assert.equal(source.campaigns[0].band, 3);
    for (const [index, mission] of source.missions.entries()) {
      const roles = mission.actors.map((actor) => actor.role);
      assert.ok(roles.includes('frontier-patrol'));
      assert.equal(roles.includes('reclaimed-roamer'), index >= 3);
      assert.equal(mission.design.difficulty.band, index >= 3 ? 4 : 3);
      assert.ok(mission.design.introduces.length <= 1);
    }
    const edition = COMPANY_EDITIONS.find((entry) => entry.id === definition.brandId);
    const campaignIds = CURRICULUM_CAMPAIGNS.filter(
      (entry) => entry.brandId === definition.brandId,
    ).map((entry) => entry.id);
    assert.deepEqual(edition.campaignIds, campaignIds);
    assert.equal(edition.entryCampaignId, campaignIds[0]);
    const themes = createCompanyThemes(definition.brandId);
    assert.deepEqual(
      themes.map((entry) => entry.id),
      COMPANY_BRANDS.find((entry) => entry.id === definition.brandId).themeIds,
    );
    for (const theme of themes) assert.equal(validateTheme(theme).valid, true);
    const next = themes.find((entry) => entry.id === `${definition.id}-theme`);
    const first = themes.find((entry) => entry.id === `${campaignIds[0]}-theme`);
    assert.notDeepEqual(next.actorRecipes, first.actorRecipes);
    assert.notEqual(next.soundtrack.id, first.soundtrack.id);
    assert.notEqual(next.palette.field, first.palette.field);
  }
});
