import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCurriculumMissionExplorations } from '../company-campaigns/curriculum-mission-explorations.mjs';
import { createCurriculumTextileLighting } from '../company-campaigns/curriculum-textile-lighting.mjs';
import { createCurriculumAtlasPayloads } from '../company-campaigns/curriculum-atlases.mjs';
import { CURRICULUM_MISSIONS, CURRICULUM_SOURCES } from '../company-campaigns/curriculum.mjs';
import {
  applyExplorationAction,
  createExplorationState,
  validateExplorationPayload,
} from '../rewards/exploration.mjs';
import { projectRewardProgress } from '../rewards/model.mjs';

const assets = JSON.parse(
  await readFile(new URL('../editions/assets.json', import.meta.url), 'utf8'),
);

test('two published finale atlases use exact source-linked cards and bilingual optional predictions', async () => {
  for (const [campaignId, count, cardIds] of [
    ['fpv-meet-aircraft', 6, ['frame', 'motion', 'esc', 'controller', 'links', 'energy']],
    ['ukraine-threads', 3, ['poltava-shirt', 'volyn-shirt', 'rushnyk-record']],
  ]) {
    const [payload] = createCurriculumAtlasPayloads(campaignId);
    validateExplorationPayload(payload);
    assert.equal(payload.recipe.cards.length, count);
    assert.deepEqual(
      payload.recipe.cards.map((card) => card.id),
      cardIds,
    );
    assert.equal(payload.recipe.predictions.length, 2);
    for (const source of payload.recipe.sources)
      assert.deepEqual(source, { id: source.id, ...CURRICULUM_SOURCES[source.id] });
    for (const card of payload.recipe.cards) {
      assert.equal(card.asset, undefined, 'No unlicensed museum or uncredited component images');
      for (const locale of ['en', 'uk'])
        assert.ok(
          CURRICULUM_MISSIONS.some(
            (mission) =>
              mission.campaignId === campaignId &&
              mission.locales[locale].paragraphs.join('\n\n') === card.locales[locale].body,
          ),
          'Atlas statements reuse the reviewed discovery with its source and limits.',
        );
    }
    const rewards = JSON.parse(
      await readFile(
        new URL(`../content/company-campaigns/${campaignId}.rewards.json`, import.meta.url),
        'utf8',
      ),
    );
    const finale = rewards.find((reward) => reward.scope.kind === 'campaign');
    const source = JSON.parse(
      await readFile(
        new URL(`../content/company-campaigns/${campaignId}.json`, import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual(
      source.campaigns.find((item) => item.id === campaignId).discovery.finaleRewardRef,
      { id: finale.id, revision: finale.revision },
    );
    assert.ok(
      Number(finale.revision) >= 2,
      'The atlas remains in its first admitted or a newer immutable presentation.',
    );
    assert.deepEqual(
      finale.payloads.find((item) => item.type === 'exploration'),
      payload,
    );
    assert.equal(finale.requirements.missions.length, 6);
    assert.deepEqual(finale.requirements.learning, []);
    assert.deepEqual(finale.requirements.mastery, []);
    const pilotMissionId = campaignId + '-01';
    const missionExplorations = rewards
      .filter((reward) => reward.scope.kind === 'mission')
      .flatMap((reward) =>
        reward.payloads
          .filter((item) => item.type === 'exploration')
          .map((payload) => ({ missionId: reward.scope.id, payload })),
      );
    assert.deepEqual(
      missionExplorations,
      [
        ...createCurriculumMissionExplorations(pilotMissionId, assets).map((payload) => ({
          missionId: pilotMissionId,
          payload,
        })),
        ...(campaignId === 'ukraine-threads'
          ? createCurriculumTextileLighting('ukraine-threads-03', assets).map((payload) => ({
              missionId: 'ukraine-threads-03',
              payload,
            }))
          : []),
      ],
      'Only the explicitly authored mission image atlas and textile study accompany each unchanged finale.',
    );
    assert.equal(missionExplorations.length, campaignId === 'ukraine-threads' ? 2 : 1);
    assert.equal(missionExplorations[0].payload.recipe.id, 'inspect-image-atlas');
    const noWins = {
      editionId: finale.brandId,
      brandId: finale.brandId,
      campaignIds: [campaignId],
      clears: {},
      learning: [],
      mastery: [],
    };
    const before = projectRewardProgress(finale, noWins);
    let state = createExplorationState(payload.recipe);
    for (const prediction of payload.recipe.predictions) {
      const wrong = prediction.choices.find((choice) => choice.id !== prediction.expectedChoiceId);
      state = applyExplorationAction(payload.recipe, state, {
        type: 'predict',
        predictionId: prediction.id,
        choiceId: wrong.id,
      });
      assert.equal(state.answers[prediction.id], wrong.id);
      assert.ok(wrong.locales.en.feedback.length > 30);
      assert.ok(wrong.locales.uk.feedback.length > 30);
      state = applyExplorationAction(payload.recipe, state, {
        type: 'predict',
        predictionId: prediction.id,
        choiceId: prediction.expectedChoiceId,
      });
      assert.equal(state.answers[prediction.id], prediction.expectedChoiceId);
    }
    assert.deepEqual(
      projectRewardProgress(finale, noWins),
      before,
      'Optional predictions cannot supply a mission win or unlock a finale.',
    );
    assert.deepEqual(
      createExplorationState(payload.recipe).answers,
      {},
      'Reopening starts a fresh untimed exploration.',
    );
  }
  assert.deepEqual(createCurriculumAtlasPayloads('ukraine-crimea-ornek'), []);
});

test('worked atlas predictions preserve role distinctions and documented object uncertainty', () => {
  const [aircraft] = createCurriculumAtlasPayloads('fpv-meet-aircraft');
  assert.deepEqual(
    aircraft.recipe.predictions.map((item) => item.expectedChoiceId),
    ['controller', 'control-branch'],
  );
  const [textile] = createCurriculumAtlasPayloads('ukraine-threads');
  assert.deepEqual(
    textile.recipe.predictions.map((item) => item.expectedChoiceId),
    ['specific-records', 'donation'],
  );
  const rushnyk = textile.recipe.cards.find((card) => card.id === 'rushnyk-record');
  assert.match(rushnyk.locales.en.body, /first half of the nineteenth century/);
  assert.match(rushnyk.locales.en.body, /donation by Petro Honchar in 2001/);
  assert.match(textile.recipe.cards[0].locales.en.body, /maker is unknown/);
});
