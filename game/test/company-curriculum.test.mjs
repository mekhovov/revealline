import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { readFile } from 'node:fs/promises';
import {
  CURRICULUM_CAMPAIGNS,
  CURRICULUM_MISSIONS,
  CURRICULUM_SOURCES,
} from '../company-campaigns/curriculum.mjs';
import { createCurriculumProject } from '../company-campaigns/curriculum-content.mjs';
import { createCurriculumRewards } from '../company-campaigns/curriculum-rewards.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { selectCurrentCompanyArtwork } from '../company-campaigns/artwork.mjs';
import {
  COMPANY_BRANDS,
  COMPANY_EDITIONS,
  createCompanyThemes,
} from '../company-campaigns/brands.mjs';
import { validateTheme } from '../content.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
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
const [assets, artwork, catalog, assetSources] = await Promise.all(
  [
    '../editions/assets.json',
    '../editions/artwork.json',
    '../editions/catalog.json',
    '../editions/asset-sources.json',
  ].map(json),
);
const projects = CURRICULUM_CAMPAIGNS.map((definition) => {
  const source = createCurriculumProject({ campaignId: definition.id, artwork });
  const missionBindings = createRewardMissionBindings(source);
  const rewards = validateCompletionRewards(
    createCurriculumRewards({
      definition,
      source,
      assets,
      assetSources: assetSources.assets,
      missionBindings,
    }),
  );
  return { definition, source, missionBindings, rewards };
});

test('eighteen real six-mission curricula preserve shared rules and use 108 distinct authored geometries', () => {
  assert.equal(CURRICULUM_CAMPAIGNS.length, 18);
  assert.equal(CURRICULUM_MISSIONS.length, 108);
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
  assert.equal(current.size, 108);
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
      assert.equal(
        reward.payloads.filter(
          (entry) => entry.id === `${missionId}-knowledge` && entry.type === 'knowledge',
        ).length,
        1,
      );
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

test('all eighteen finales stay locked with any one required win absent and reject wrong exact gameplay', () => {
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

test('explicit public dependencies include only selected campaign art and seven source comparison images', () => {
  const firstMissionPictures = [
    'social-drone-people-workshop-01',
    'ukraine-threads-03',
    'fpv-meet-aircraft-01',
  ];
  const distinctMissionIds = new Set(
    CURRICULUM_MISSIONS.filter((mission) =>
      artwork.some((asset) => asset.id === `${mission.id}-picture`),
    ).map((mission) => mission.id),
  );
  for (const id of firstMissionPictures) assert.ok(distinctMissionIds.has(id), id);
  for (const { definition, source, rewards, missionBindings } of projects) {
    const descriptor = catalog.campaigns.find((entry) => entry.id === definition.id);
    // Each admitted composition has its own asset; all other missions explicitly
    // reuse one campaign scene rather than pretending that aliases are new artwork.
    const expectedPictures = definition.missionIds.map((id) =>
      distinctMissionIds.has(id) ? `${id}-picture` : `${definition.id}-key-picture`,
    );
    assert.deepEqual(
      source.assets.map((asset) => asset.id),
      [...new Set(expectedPictures)],
    );
    assert.deepEqual(
      source.missions.map((mission) => mission.presentation.backgroundAssetId),
      expectedPictures,
    );
    const keyPicture = selectCurrentCompanyArtwork(artwork).find(
      (asset) => asset.id === `${definition.id}-key-picture`,
    );
    const keyAsset = assets.find((asset) => asset.path === 'game/' + keyPicture.path);
    assert.deepEqual(descriptor.assetIds, [
      ...new Set([
        ...source.assets.map(
          (picture) => assets.find((asset) => asset.path === 'game/' + picture.path).id,
        ),
        keyAsset.id,
        ...definition.rewardAssetIds,
      ]),
    ]);
    assert.equal(descriptor.heroAssetId, keyAsset.id);
    if (source.assets.some((asset) => asset.id === keyPicture.id))
      assert.ok(
        completionRewardAssetReferences(
          rewards.filter((reward) => reward.scope.kind === 'campaign'),
        ).some((ref) => ref.assetId === keyAsset.id && ref.sha256 === keyAsset.sha256),
        'The campaign finale retains its exact campaign composition.',
      );
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
    Object.fromEntries(
      CURRICULUM_CAMPAIGNS.filter((entry) => entry.rewardAssetIds.length).map((entry) => [
        entry.id,
        entry.rewardAssetIds,
      ]),
    ),
    {
      'ukraine-threads': ['met-degas-ukrainian-dress-436157'],
      'ukraine-cities-symbols-time': ['reference-ukraine-state-flag', 'reference-ukraine-state-emblem'],
      'fpv-meet-aircraft': ['reference-fpv-pixhawk-controller', 'reference-fpv-brushless-motor'],
      'fpv-soldering-workshop': [
        'reference-fpv-solder-iron',
        'reference-fpv-solder-spool-label',
        'reference-fpv-solder-joint',
      ],
      'fpv-drone-families': ['reference-fpv-ar-drone-prototype'],
    },
  );
});

test('generated new campaign and reward files match their authoring sources', async () => {
  for (const { definition, source, rewards } of projects) {
    const descriptor = catalog.campaigns.find((entry) => entry.id === definition.id);
    assert.deepEqual(await json('../../' + descriptor.sourcePath), source);
    assert.deepEqual(await json('../../' + descriptor.rewardPath), rewards);
  }
});

test('four edition art upgrades preserve all36 first-discovery missions and exact old rewards', async () => {
  let missionCount = 0;
  for (const editionId of [
    'social-drone-ua',
    'victory-drones',
    'ukraine-culture',
    'fpv-learning',
  ]) {
    const edition = catalog.editions.find((entry) => entry.id === editionId);
    assert.ok(edition.revision >= 2);
    const retained = edition.presentationHistory.find((entry) =>
      entry.path.endsWith('-first-discoveries.json'),
    );
    assert.ok(retained, editionId);
    const { snapshot } = await validateRetainedPresentation(await json('../../' + retained.path), {
      edition,
    });
    assert.equal(snapshot.catalog.editions[0].revision, 1);
    for (const descriptor of snapshot.catalog.campaigns) {
      const oldSource = snapshot.files.find((file) => file.path === descriptor.sourcePath).data;
      const current = projects.find(({ definition }) => definition.id === descriptor.id);
      assert.deepEqual(createRewardMissionBindings(oldSource), current.missionBindings);
      const oldRewards = snapshot.files.find((file) => file.path === descriptor.rewardPath).data;
      for (const oldReward of oldRewards) {
        const next = current.rewards.find((reward) => reward.id === oldReward.id);
        assert.deepEqual(next.requirements, oldReward.requirements);
        assert.equal(oldReward.revision, '1');
        assert.ok(Number(next.revision) >= 2);
        for (const ref of completionRewardAssetReferences([oldReward]))
          assert.ok(
            snapshot.catalog.assets.some(
              (asset) => asset.id === ref.assetId && asset.sha256 === ref.sha256,
            ),
          );
      }
      assert.equal(oldSource.packs[0].revision, '1');
      assert.ok(Number(current.source.packs[0].revision) >= 2);
      for (const before of oldSource.missions) {
        const after = current.source.missions.find((mission) => mission.id === before.id);
        assert.notEqual(
          before.presentation.backgroundAssetId,
          after.presentation.backgroundAssetId,
        );
        missionCount++;
      }
    }
  }
  assert.equal(missionCount, 36);
});

test('later curricula use canonical progression with registered distinct presentations', () => {
  const advanced = projects.filter(({ definition }) => definition.progression);
  assert.deepEqual(
    advanced.map(({ definition }) => definition.id),
    [
      'social-drone-community-connections',
      'victory-drones-ideas-understanding',
      'ukraine-colour-clay-spring',
      'ukraine-crimea-ornek',
      'ukraine-voices-travel',
      'ukraine-cities-symbols-time',
      'ukraine-everyday-culture',
      'fpv-parts-bench',
      'fpv-soldering-workshop',
      'fpv-four-controls',
      'fpv-first-flight',
      'fpv-drone-families',
      'fpv-drones-ukraine',
      'fpv-care-repair',
    ],
  );
  for (const { definition, source } of advanced) {
    const { stage, band } = definition.progression;
    assert.equal(source.campaigns[0].band, band);
    for (const [index, mission] of source.missions.entries()) {
      const roles = mission.actors.map((actor) => actor.role);
      if (stage <= 3) {
        assert.equal(roles.includes('frontier-patrol'), stage === 2 || index >= 3);
        assert.equal(roles.includes('reclaimed-roamer'), stage === 3 || index >= 3);
        assert.equal(roles.includes('territory-eroder'), stage === 3);
      } else {
        const expectedRole =
          stage === 4
            ? index < 2
              ? 'trail-pursuer'
              : 'heading-interceptor'
            : stage === 5
              ? index < 3
                ? 'frontier-patrol'
                : 'lane-emitter'
              : index < 3
                ? 'lane-emitter'
                : 'relay-sentinel';
        assert.ok(roles.includes(expectedRole), mission.id + ': declared campaign pressure');
        if (index === 5) {
          assert.ok(mission.relayLinks.length > 0, mission.id + ': finale connecting returns');
          if (stage >= 5) assert.equal(source.maps[index].speedZones.length, 2);
          if (stage === 6) assert.equal(mission.encounter.recipeId, 'shield-relays-v1');
        }
      }
      assert.equal(mission.design.difficulty.band, band + (index >= 3 ? 1 : 0));
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

test('mission-art expansion retains every prior gameplay binding and revises each changed reward payload', async () => {
  for (const editionId of ['ukraine-culture', 'fpv-learning']) {
    const edition = catalog.editions.find((entry) => entry.id === editionId);
    const retained = edition.presentationHistory.find((entry) =>
      entry.path.endsWith('-before-mission-art-2.json'),
    );
    assert.ok(retained);
    const { snapshot } = await validateRetainedPresentation(await json('../../' + retained.path), {
      edition,
    });
    assert.equal(snapshot.catalog.editions[0].revision, 2);
    for (const descriptor of snapshot.catalog.campaigns) {
      const previous = snapshot.files.find((file) => file.path === descriptor.sourcePath).data;
      const current = projects.find(({ definition }) => definition.id === descriptor.id);
      assert.deepEqual(createRewardMissionBindings(previous), current.missionBindings);
      const oldRewards = snapshot.files.find((file) => file.path === descriptor.rewardPath).data;
      for (const before of oldRewards) {
        const after = current.rewards.find((reward) => reward.id === before.id);
        assert.deepEqual(after.requirements, before.requirements);
        if (canonicalJSON(after.payloads) !== canonicalJSON(before.payloads))
          assert.notEqual(
            after.revision,
            before.revision,
            before.id + ' changed without a reward revision',
          );
      }
    }
  }
});
