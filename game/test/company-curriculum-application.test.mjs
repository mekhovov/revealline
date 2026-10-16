import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CURRICULUM_LESSONS } from '../company-campaigns/curriculum-lessons.mjs';
import { createCompanyLearningProofStore } from '../company-campaigns/learning-proofs.mjs';
import { createLearningAttempt, reduceLearningAttempt } from '../company-campaigns/learning.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';
import { projectRewardProgress, reconcileEarnedRewards } from '../rewards/model.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';
import { companySimulationIdentity } from '../company-session.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
import { createCompanyPresets, createCompanyThemes } from '../company-campaigns/brands.mjs';
import {
  createRewardCosmeticRegistry,
  projectEarnedRewardCosmetics,
} from '../rewards/cosmetics.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
const root = new URL('../../', import.meta.url);
const json = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const catalog = await json('game/editions/catalog.json');
const routes = await json('game/test/fixtures/curriculum-campaign-routes.json');

for (const lesson of CURRICULUM_LESSONS.filter(
  (entry) =>
    ['fpv-meet-aircraft', 'ukraine-threads'].includes(entry.campaignId) &&
    entry.missionId.endsWith('-06'),
)) {
  test(`${lesson.campaignId}: exact optional application requires all six wins and a verified corrected transcript`, async () => {
    const descriptor = catalog.campaigns.find((entry) => entry.id === lesson.campaignId);
    const source = await json(descriptor.sourcePath);
    const lessons = await json(descriptor.lessonPath);
    assert.deepEqual(
      lessons,
      CURRICULUM_LESSONS.filter((entry) => entry.campaignId === lesson.campaignId),
    );
    const rewards = await json(descriptor.rewardPath);
    const bonus = rewards.find(
      (entry) => entry.id === `${lesson.campaignId}-application-discovery`,
    );
    const finale = rewards.find((entry) => entry.id === `${lesson.campaignId}-finale`);
    assert.deepEqual(bonus.requirements.learning, [completionLearningReference(lesson)]);
    assert.deepEqual(finale.requirements.learning, []);
    const route = routes.rows.find(
      (entry) =>
        entry.id === lesson.missionId &&
        entry.difficulty === 'standard' &&
        entry.turnPolicy === 'immediate',
    );
    const manifest = resolveMission(compileContentProject(source), lesson.missionId, {
      difficulty: route.difficulty,
    });
    assert.equal(manifest.simulationIdentity, route.simulationIdentity);
    const level = applyGameplayTuning(manifest.level, route.gameplayTuning);
    const options = { seed: route.seed, classId: 'scout', turnPolicy: route.turnPolicy };
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    for (const segment of route.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        const input = { direction: segment.direction };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
    assert.equal(run.status, 'won');
    const replay = exportReplay(recorder, run),
      simulationIdentity = companySimulationIdentity(run);
    const editionId = lesson.campaignId === 'ukraine-threads' ? 'ukraine-culture' : 'fpv-learning';
    const values = new Map();
    const store = createCompanyLearningProofStore({
      editionId,
      lessons,
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
      acceptSimulation: (id, identity) =>
        id === lesson.missionId && identity === simulationIdentity,
    });
    const context = {
      editionId,
      brandId: editionId,
      campaignIds: [lesson.campaignId],
      learning: [],
      mastery: [],
      clears: Object.fromEntries(
        bonus.requirements.missions.map((entry) => [
          entry.missionId,
          {
            runId: `accepted-${entry.missionId}`,
            ...entry.bindings.find((binding) => binding.difficulty === 'standard'),
          },
        ]),
      ),
    };
    assert.equal(projectRewardProgress(finale, context).eligible, true);
    assert.equal(projectRewardProgress(bonus, context).eligible, false);
    let attempt = createLearningAttempt(lesson, { simulationIdentity, seed: run.seed });
    const anchor = { tick: run.tick, kind: 'result' };
    for (const record of lesson.records)
      attempt = reduceLearningAttempt(lesson, attempt, {
        type: 'inspect',
        recordId: record.id,
        anchor,
      });
    for (const field of lesson.fields)
      attempt = reduceLearningAttempt(lesson, attempt, {
        type: 'configure',
        fieldId: field.id,
        value: field.options.find((option) => option.value !== field.expected).value,
        anchor,
      });
    attempt = reduceLearningAttempt(lesson, attempt, { type: 'commit', anchor });
    await assert.rejects(store.prove({ attempt, replay }));
    await assert.rejects(store.prove({ attempt: { ...attempt, status: 'complete' }, replay }));
    assert.equal(store.rewardEvidence().learning.length, 0);
    for (const field of lesson.fields)
      attempt = reduceLearningAttempt(lesson, attempt, {
        type: 'configure',
        fieldId: field.id,
        value: field.expected,
        anchor,
      });
    attempt = reduceLearningAttempt(lesson, attempt, { type: 'commit', anchor });
    assert.equal(store.saveVerified(await store.prove({ attempt, replay })), true);
    context.learning = store.rewardEvidence().durableLearning;
    const earned = reconcileEarnedRewards([bonus], context);
    assert.equal(earned.granted.length, 1);
    const registry = createRewardCosmeticRegistry({
      presets: createCompanyPresets(editionId),
      themes: createCompanyThemes(editionId),
      assets: catalog.assets,
    });
    const appearance = projectEarnedRewardCosmetics(earned.state, {
      editionId,
      brandId: editionId,
      campaignIds: [lesson.campaignId],
      registry,
    });
    assert.equal(appearance.available.length, 1);
    assert.equal(appearance.unavailable.length, 0);
    assert.equal(
      appearance.available[0].recipeId,
      bonus.payloads.find((entry) => entry.type === 'cosmetic').recipeId,
    );
    assert.equal(projectEarnedRewardCosmetics(null, { registry }).available.length, 0);
    assert.equal(reconcileEarnedRewards([bonus], context, earned.state).granted.length, 0);
    for (const missing of bonus.requirements.missions) {
      const partial = structuredClone(context);
      delete partial.clears[missing.missionId];
      assert.equal(projectRewardProgress(bonus, partial).eligible, false);
    }
    const changed = structuredClone(context);
    changed.learning[0].fixtureRevision = 'unaccepted';
    assert.equal(projectRewardProgress(bonus, changed).eligible, false);
  });
}

test('all four exact pre-feedback editions retain prior promises and unchanged gameplay identities', async () => {
  const recordedAfter = {
    'victory-drones': {
      path: 'game/editions/retained/victory-drones-before-showcase-learning.json',
      sha256: '490ed135f5d9e8cb55172dc584a671f6d385afb62c360545b848edfaa1521b2b',
      revision: 5,
    },
    'social-drone-ua': {
      path: 'game/editions/retained/social-drone-ua-before-mission-alt.json',
      sha256: '13d119e2e5aa67bd6636a2d83d9e1374d792a05edc33c462654f19d965efe409',
      revision: 6,
    },
    'ukraine-culture': {
      path: 'game/editions/retained/ukraine-culture-before-textile-and-motion.json',
      sha256: 'c7122ae0c8f17932986df03fc636c02900d83a30c235529789f0a90f253c7555',
      revision: 6,
    },
    'fpv-learning': {
      path: 'game/editions/retained/fpv-learning-before-textile-and-motion.json',
      sha256: 'e50b6a3c0197f4944756942af314e31a76a2db559b505a23d310185e834a0289',
      revision: 7,
    },
  };
  for (const edition of catalog.editions.filter((entry) =>
    ['social-drone-ua', 'victory-drones', 'ukraine-culture', 'fpv-learning'].includes(entry.id),
  )) {
    const history = edition.presentationHistory.find((entry) =>
      entry.path.endsWith('before-discovery-feedback.json'),
    );
    assert.ok(history);
    const raw = await readFile(new URL(history.path, root), 'utf8');
    const { snapshot } = await validateRetainedPresentation(raw, { edition });
    const after = recordedAfter[edition.id];
    let afterFiles;
    if (after) {
      const afterBytes = await readFile(new URL(after.path, root));
      assert.equal(createHash('sha256').update(afterBytes).digest('hex'), after.sha256);
      const { snapshot: recorded } = await validateRetainedPresentation(
        afterBytes.toString('utf8'),
        { edition },
      );
      assert.equal(recorded.catalog.editions[0].revision, after.revision);
      afterFiles = new Map(recorded.files.map((file) => [file.path, file.data]));
    } else {
      assert.equal(edition.id, 'victory-drones');
      assert.equal(edition.revision, 5, 'Victory has no changed presentation in this media batch.');
    }
    for (const descriptor of snapshot.catalog.campaigns) {
      const oldSource = snapshot.files.find((entry) => entry.path === descriptor.sourcePath).data;
      const currentSource =
        afterFiles?.get(descriptor.sourcePath) ?? (await json(descriptor.sourcePath));
      assert.deepEqual(
        createRewardMissionBindings(currentSource),
        createRewardMissionBindings(oldSource),
      );
      assert.equal(oldSource.campaigns[0].discovery.feedback, undefined);
      const oldRewards = snapshot.files.find((entry) => entry.path === descriptor.rewardPath).data;
      const currentRewards =
        afterFiles?.get(descriptor.rewardPath) ?? (await json(descriptor.rewardPath));
      for (const reward of oldRewards) {
        assert.equal(reward.teaserImage, undefined);
        const next = currentRewards.find((entry) => entry.id === reward.id);
        assert.deepEqual(next.requirements, reward.requirements);
        const authoredAdditions = {
          'social-drone-community-connections-finale': [
            'social-community-listening-guide',
            'social-community-listening-jellyfish',
            'social-community-listening-thanks',
          ],
          'fpv-meet-aircraft-01-discovery': ['fpv-meet-aircraft-01-structure-exploration'],
          'ukraine-threads-01-discovery': [
            'reference-ukraine-met-shirt-fragment-image',
            'reference-ukraine-met-shirt-fragment-credit',
            'ukraine-threads-01-object-exploration',
          ],
        }[reward.id];
        if (authoredAdditions) {
          assert.deepEqual(
            next.payloads.slice(0, reward.payloads.length),
            reward.payloads,
            'The named visual and listening pilots append discoveries without rewriting historical payloads.',
          );
          assert.deepEqual(
            next.payloads.slice(reward.payloads.length).map((entry) => entry.id),
            authoredAdditions,
          );
        } else assert.deepEqual(next.payloads, reward.payloads);
        assert.equal(reward.audioGroups, undefined);
        if (reward.id === 'social-drone-community-connections-finale') {
          assert.deepEqual(next.audioGroups, [
            {
              format: 'revealline-ordered-audio-group.v1',
              id: 'social-community-listening-pair',
              locales: {
                en: { title: 'A shared pause · two instrumentals' },
                uk: { title: 'Спільна пауза · два інструментальні треки' },
              },
              payloadIds: [
                'social-community-listening-jellyfish',
                'social-community-listening-thanks',
              ],
            },
          ]);
        } else assert.equal(next.audioGroups, undefined);
        assert.notEqual(next.revision, reward.revision);
        assert.ok(next.teaserImage);
      }
    }
  }
});
