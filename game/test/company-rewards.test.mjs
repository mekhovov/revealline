import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { COMPANY_CAMPAIGNS } from '../company-campaigns/catalog.mjs';
import { CURRICULUM_CAMPAIGNS } from '../company-campaigns/curriculum.mjs';
import { COMPANY_LEARNING_REWARD_CAMPAIGN_IDS } from '../company-campaigns/learning-rewards.mjs';
import {
  COMPANY_REWARD_CAMPAIGN_IDS,
  createCompanyRewards,
} from '../company-campaigns/rewards.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import {
  completionRewardAssetReferences,
  projectRewardProgress,
  validateCompletionRewards,
} from '../rewards/model.mjs';
import { produceCompanyContent } from '../../scripts/produce-company-content.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';

const root = new URL('../../', import.meta.url);
const json = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const [assets, artwork, classes, catalog] = await Promise.all(
  [
    'game/editions/assets.json',
    'game/editions/artwork.json',
    'game/content/classes.json',
    'game/editions/catalog.json',
  ].map(json),
);
const campaigns = await Promise.all(
  COMPANY_REWARD_CAMPAIGN_IDS.map(async (id) => {
    const descriptor = catalog.campaigns.find((entry) => entry.id === id);
    const source = await json(descriptor.sourcePath);
    return {
      descriptor,
      source,
      definition: COMPANY_CAMPAIGNS.find((entry) => entry.id === id),
      rewards: validateCompletionRewards(await json(descriptor.rewardPath)),
      missionBindings: createRewardMissionBindings(source),
    };
  }),
);

test('reward pilots are complete bilingual discoveries with exact existing campaign pictures', () => {
  assert.deepEqual(
    catalog.campaigns
      .filter((entry) => entry.rewardPath)
      .map((entry) => entry.id)
      .sort(),
    [
      ...COMPANY_REWARD_CAMPAIGN_IDS,
      ...COMPANY_LEARNING_REWARD_CAMPAIGN_IDS,
      ...CURRICULUM_CAMPAIGNS.map((entry) => entry.id),
    ].sort(),
  );
  for (const { descriptor, source, definition, rewards, missionBindings } of campaigns) {
    assert.deepEqual(
      createCompanyRewards({ definition, source, assets, missionBindings }),
      rewards,
    );
    const discoveries = rewards.filter((reward) => reward.scope.kind === 'mission');
    const finale = rewards.find((reward) => reward.scope.kind === 'campaign');
    assert.equal(discoveries.length, 6);
    assert.equal(rewards.length, 7);
    assert.deepEqual(
      discoveries.map((reward) => reward.scope.id),
      definition.missionIds,
    );
    assert.deepEqual(
      finale.requirements.missions.map((entry) => entry.missionId),
      definition.missionIds,
    );
    assert.equal(finale.payloads.filter((payload) => payload.type === 'image').length, 6);
    for (const reward of rewards) {
      assert.equal(reward.brandId, descriptor.brandId);
      assert.equal(reward.campaignId, descriptor.id);
      assert.notEqual(reward.locales.en.title, reward.locales.uk.title);
      assert.notEqual(reward.locales.en.teaser, reward.locales.uk.teaser);
      assert.deepEqual(reward.requirements.learning, []);
      assert.deepEqual(reward.requirements.mastery, []);
      for (const requirement of reward.requirements.missions) {
        assert.deepEqual(requirement.bindings.map((binding) => binding.difficulty).sort(), [
          'expert',
          'gentle',
          'standard',
        ]);
      }
      for (const payload of reward.payloads) {
        assert.ok(['knowledge', 'image', 'url'].includes(payload.type));
        if (payload.type === 'knowledge') {
          for (const locale of ['en', 'uk']) {
            assert.ok(payload.locales[locale].paragraphs.length >= 2);
            assert.ok(payload.locales[locale].sources.length > 0);
          }
        }
      }
    }
    for (const reference of completionRewardAssetReferences(rewards)) {
      assert.ok(descriptor.assetIds.includes(reference.assetId));
      const asset = assets.find((entry) => entry.id === reference.assetId);
      assert.equal(asset.sha256, reference.sha256);
      assert.ok(
        source.assets.some(
          (entry) => entry.sha256 === reference.sha256 && asset.path === `game/${entry.path}`,
        ),
      );
    }
  }
});

test('finishing mission six with any other mission missing does not unlock either pilot finale', () => {
  for (const { descriptor, rewards } of campaigns) {
    const finale = rewards.find((reward) => reward.scope.kind === 'campaign');
    const accepted = Object.fromEntries(
      finale.requirements.missions.map((entry, index) => [
        entry.missionId,
        {
          runId: `accepted-${index}`,
          ...entry.bindings.find((binding) => binding.difficulty === 'standard'),
        },
      ]),
    );
    const context = {
      editionId: descriptor.id,
      brandId: descriptor.brandId,
      campaignIds: [descriptor.id],
      clears: accepted,
      learning: [],
      mastery: [],
    };
    assert.equal(projectRewardProgress(finale, context).eligible, true);
    for (const requirement of finale.requirements.missions) {
      const partial = structuredClone(context);
      delete partial.clears[requirement.missionId];
      const progress = projectRewardProgress(finale, partial);
      assert.equal(progress.eligible, false);
      assert.equal(progress.completed, 5);
      assert.deepEqual(progress.missingMissionIds, [requirement.missionId]);
    }
    const wrongIdentity = structuredClone(context);
    wrongIdentity.clears[finale.requirements.missions[0].missionId].gameplayId = 'other-gameplay';
    assert.equal(projectRewardProgress(finale, wrongIdentity).eligible, false);
    assert.equal(
      projectRewardProgress(finale, { ...context, brandId: 'unrelated' }).eligible,
      false,
    );
    assert.equal(projectRewardProgress(finale, { ...context, campaignIds: [] }).eligible, false);
    // Same campaign is permitted in both aggregate and standalone editions.
    // The runtime remains responsible for supplying only that edition's clears.
    assert.equal(
      projectRewardProgress(finale, { ...context, editionId: 'permitted-standalone' }).eligible,
      true,
    );
  }
});

test('pilot factory rejects a picture that is absent from the exact public asset inventory', () => {
  const { definition, source, missionBindings } = campaigns[0];
  assert.throws(
    () => createCompanyRewards({ definition, source, missionBindings, assets: [] }),
    /exact public asset/,
  );
  assert.throws(
    () => createCompanyRewards({ definition, source, assets, missionBindings: [] }),
    /Missing reward binding/,
  );
});

test('generated reward sidecars and catalog are deterministic and checked in', async () => {
  const generated = await produceCompanyContent({ assets, artwork, classes });
  for (const { descriptor } of campaigns) {
    assert.deepEqual(
      generated.files.get(descriptor.rewardPath),
      await readFile(new URL(descriptor.rewardPath, root)),
    );
    assert.deepEqual(
      generated.files.get(descriptor.sourcePath),
      await readFile(new URL(descriptor.sourcePath, root)),
    );
  }
  assert.deepEqual(
    generated.files.get('game/editions/catalog.json'),
    await readFile(new URL('game/editions/catalog.json', root)),
  );
});

test('all four updated editions retain their exact pre-reward presentation without changing gameplay source', async () => {
  for (const id of [
    'coupa-all',
    'coupa-adventure',
    'droneaid-nl-community',
    'droneaid-nl-workshop-lights',
  ]) {
    const edition = catalog.editions.find((item) => item.id === id);
    const descriptor = edition.presentationHistory.find((item) =>
      item.path.endsWith('-before-discovery-rewards.json'),
    );
    assert.ok(descriptor, id);
    const bytes = await readFile(new URL(descriptor.path, root));
    assert.equal(bytes.length, descriptor.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
    const { snapshot } = await validateRetainedPresentation(bytes.toString('utf8'), { edition });
    assert.equal(snapshot.authoredPresentationSha256, descriptor.id);
    assert.ok(edition.revision > snapshot.catalog.editions[0].revision);
    for (const priorCampaign of snapshot.catalog.campaigns) {
      assert.equal(priorCampaign.rewardPath, undefined);
      assert.deepEqual(
        snapshot.files.find((file) => file.path === priorCampaign.sourcePath).data,
        await json(priorCampaign.sourcePath),
      );
    }
  }
});
