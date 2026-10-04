import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CURRICULUM_LESSONS } from '../company-campaigns/curriculum-lessons.mjs';
import { CURRICULUM_SHOWCASE_LESSONS } from '../company-campaigns/curriculum-showcase-lessons.mjs';
import {
  CURRICULUM_SHOWCASE_STEPS,
  createCurriculumShowcaseContent,
} from '../company-campaigns/curriculum-showcase.mjs';
import {
  createCompanyLearningStore,
  createLearningAttempt,
  reduceLearningAttempt,
  validateCompanyLessons,
  verifyLearningAttempt,
} from '../company-campaigns/learning.mjs';
import { localizeCompanyLesson } from '../company-campaigns/lesson-localization.mjs';
import { createCompanyLearningProofStore } from '../company-campaigns/learning-proofs.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { projectRewardProgress, reconcileEarnedRewards } from '../rewards/model.mjs';
import { resolveEditionAssets } from '../editions/model.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';
import { companySimulationIdentity } from '../company-session.mjs';

const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await json('game/editions/catalog.json');
const showcase = [
  [
    'social-drone-ua',
    'social-drone-community-connections',
    7,
    '1a360b73d74bfec5bae456e15e1e1f1a42f7c400bc04f0275b342c46160be98f',
    9, // The later Sky Watch addition preserves the showcase snapshot below.
  ],
  [
    'victory-drones',
    'victory-drones-ideas-understanding',
    5,
    '490ed135f5d9e8cb55172dc584a671f6d385afb62c360545b848edfaa1521b2b',
  ],
  [
    'ukraine-culture',
    'ukraine-threads',
    7,
    '953829f1b939d98e7bcd66860977504caaa4a2c5a847a1d389aa9398deabcea2',
  ],
  [
    'fpv-learning',
    'fpv-meet-aircraft',
    8,
    '80dd4e88f348c3ec62f9a12069e897de690f87169eb1280dc9e4b7da694b83e2',
  ],
];

for (const [
  editionId,
  campaignId,
  oldRevision,
  snapshotHash,
  currentRevision = oldRevision + 1,
] of showcase)
  test(`${campaignId}: six learning beats keep all old promises, finals and exact gameplay`, async () => {
    const edition = catalog.editions.find((entry) => entry.id === editionId);
    assert.equal(edition.revision, currentRevision);
    const history = edition.presentationHistory.find((entry) =>
      entry.path.endsWith(`${editionId}-before-showcase-learning.json`),
    );
    const raw = await readFile(new URL(history.path, root));
    assert.equal(createHash('sha256').update(raw).digest('hex'), snapshotHash);
    assert.equal(history.sha256, snapshotHash);
    const { snapshot } = await validateRetainedPresentation(raw.toString('utf8'), { edition });
    assert.equal(snapshot.catalog.editions[0].revision, oldRevision);
    assert.equal(CURRICULUM_SHOWCASE_STEPS[campaignId].length, 6);
    const oldFiles = new Map(snapshot.files.map((file) => [file.path, file.data]));
    for (const descriptor of snapshot.catalog.campaigns) {
      const source = await json(descriptor.sourcePath),
        beforeSource = oldFiles.get(descriptor.sourcePath);
      assert.deepEqual(
        createRewardMissionBindings(source),
        createRewardMissionBindings(beforeSource),
      );
      assert.deepEqual(source.maps, beforeSource.maps);
      const rewards = await json(descriptor.rewardPath),
        beforeRewards = oldFiles.get(descriptor.rewardPath);
      const context = {
        editionId,
        brandId: editionId,
        campaignIds: [descriptor.id],
        clears: {},
        learning: [],
        mastery: [],
      };
      const oldPromises = reconcileEarnedRewards(beforeRewards, context);
      const carried = reconcileEarnedRewards(rewards, context, oldPromises.state);
      for (const old of beforeRewards) {
        const current = rewards.find((entry) => entry.id === old.id);
        assert.deepEqual(current.requirements, old.requirements);
        assert.deepEqual(
          carried.state.promises.find((entry) => entry.id === old.id),
          old,
        );
        if (descriptor.id !== campaignId || old.scope.kind !== 'mission')
          assert.deepEqual(current, old);
        else {
          assert.equal(Number(current.revision), Number(old.revision) + 1);
          for (const payload of old.payloads)
            assert.deepEqual(
              current.payloads.find((entry) => entry.id === payload.id),
              payload,
            );
          assert.deepEqual(
            current.payloads.filter((entry) => entry.id.endsWith('-learning-journey')),
            createCurriculumShowcaseContent(old.scope.id),
          );
        }
      }
      if (descriptor.lessonPath) {
        const currentLessons = await json(descriptor.lessonPath);
        for (const old of oldFiles.get(descriptor.lessonPath))
          assert.deepEqual(
            currentLessons.find((entry) => entry.id === old.id),
            old,
          );
      }
    }
    const currentDescriptor = catalog.campaigns.find((entry) => entry.id === campaignId);
    const lessons = await json(currentDescriptor.lessonPath);
    assert.deepEqual(
      lessons,
      CURRICULUM_LESSONS.filter((entry) => entry.campaignId === campaignId),
    );
    assert.deepEqual(
      lessons.map((entry) => entry.missionId).sort(),
      [2, 4, 6].map((n) => `${campaignId}-0${n}`),
    );
    assert.equal(validateCompanyLessons(lessons).length, 3);
    assert(
      resolveEditionAssets(catalog, { editionId }).reduce((sum, asset) => sum + asset.bytes, 0) <=
        32 * 1024 * 1024,
    );
  });

for (const lesson of CURRICULUM_SHOWCASE_LESSONS)
  test(`${lesson.id}: wrong choice, restored partial work, correction and transcript tampering`, () => {
    const memory = new Map(),
      storage = {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => memory.set(key, value),
      };
    const editionId = showcase.find((entry) => entry[1] === lesson.campaignId)[0];
    let store = createCompanyLearningStore({ editionId, storage, lessons: [lesson] });
    let attempt = createLearningAttempt(lesson);
    const anchor = { kind: 'practice', tick: 0 };
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
    assert.equal(attempt.status, 'working');
    assert.equal(attempt.feedback.length, lesson.fields.length);
    assert.equal(store.save(attempt), true);
    store = createCompanyLearningStore({ editionId, storage, lessons: [lesson] });
    attempt = store.load(lesson.missionId);
    assert.deepEqual(
      attempt.configuration,
      Object.fromEntries(
        lesson.fields.map((field) => [
          field.id,
          field.options.find((option) => option.value !== field.expected).value,
        ]),
      ),
    );
    assert.equal(store.progress(lesson.missionId).complete, false);
    const uk = localizeCompanyLesson(lesson, 'uk');
    assert.notEqual(uk.title, lesson.title);
    assert.deepEqual(
      uk.fields.map((field) => field.options.map((option) => option.value)),
      lesson.fields.map((field) => field.options.map((option) => option.value)),
    );
    for (const field of lesson.fields)
      attempt = reduceLearningAttempt(lesson, attempt, {
        type: 'configure',
        fieldId: field.id,
        value: field.expected,
        anchor,
      });
    attempt = reduceLearningAttempt(lesson, attempt, { type: 'commit', anchor });
    assert.equal(attempt.status, 'complete');
    assert.equal(verifyLearningAttempt(lesson, attempt).valid, true);
    assert.equal(store.save(attempt), true);
    const tampered = structuredClone(attempt);
    tampered.actions.find((action) => action.type === 'configure').value = 'invented';
    assert.equal(verifyLearningAttempt(lesson, tampered).valid, false);
    assert.equal(verifyLearningAttempt({ ...lesson, fixtureRevision: '2' }, attempt).valid, false);
    assert.equal(
      store.progress(lesson.missionId).complete,
      false,
      'An unanchored exercise is not an arcade win.',
    );
  });

for (const [editionId, campaignId] of showcase.slice(0, 2))
  test(`${campaignId}: new application bonus needs six accepted wins and its real replay-bound lesson`, async () => {
    const descriptor = catalog.campaigns.find((entry) => entry.id === campaignId),
      source = await json(descriptor.sourcePath);
    const rewards = await json(descriptor.rewardPath),
      bonus = rewards.find((entry) => entry.id === `${campaignId}-application-discovery`),
      finale = rewards.find((entry) => entry.id === `${campaignId}-finale`);
    const lesson = CURRICULUM_LESSONS.find((entry) => entry.id === `${campaignId}-06-lesson`);
    const routes = await json('game/test/fixtures/curriculum-campaign-routes.json');
    const route = routes.rows.find(
      (entry) =>
        entry.id === lesson.missionId &&
        entry.difficulty === 'standard' &&
        entry.turnPolicy === 'immediate',
    );
    const manifest = resolveMission(compileContentProject(source), lesson.missionId, {
      difficulty: 'standard',
    });
    const level = applyGameplayTuning(manifest.level, route.gameplayTuning),
      options = { seed: route.seed, classId: 'scout', turnPolicy: route.turnPolicy };
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    for (const segment of route.segments)
      for (let i = 0; i < segment.ticks; i++) {
        const input = { direction: segment.direction };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
    assert.equal(run.status, 'won');
    const replay = exportReplay(recorder, run),
      simulationIdentity = companySimulationIdentity(run),
      values = new Map();
    const store = createCompanyLearningProofStore({
      editionId,
      lessons: [lesson],
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
      campaignIds: [campaignId],
      clears: Object.fromEntries(
        bonus.requirements.missions.map((entry) => [
          entry.missionId,
          {
            runId: `accepted-${entry.missionId}`,
            ...entry.bindings.find((binding) => binding.difficulty === 'standard'),
          },
        ]),
      ),
      learning: [],
      mastery: [],
    };
    assert.deepEqual(bonus.requirements.learning, [completionLearningReference(lesson)]);
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
        value: field.expected,
        anchor,
      });
    attempt = reduceLearningAttempt(lesson, attempt, { type: 'commit', anchor });
    const falsified = structuredClone(attempt);
    falsified.actions.pop();
    await assert.rejects(store.prove({ attempt: falsified, replay }));
    assert.equal(store.saveVerified(await store.prove({ attempt, replay })), true);
    context.learning = store.rewardEvidence().durableLearning;
    assert.equal(projectRewardProgress(bonus, context).eligible, true);
    for (const missing of bonus.requirements.missions) {
      const partial = structuredClone(context);
      delete partial.clears[missing.missionId];
      assert.equal(projectRewardProgress(bonus, partial).eligible, false);
      assert.equal(projectRewardProgress(finale, partial).eligible, false);
    }
    const earned = reconcileEarnedRewards([bonus], context);
    assert.equal(earned.granted.length, 1);
    assert.equal(reconcileEarnedRewards([bonus], context, earned.state).granted.length, 0);
  });

test('the second Met object has exact approved original bytes and a single explicitly selected campaign', async () => {
  const id = 'reference-ukraine-met-shirt-fragment-157571';
  const asset = catalog.assets.find((entry) => entry.id === id),
    bytes = await readFile(new URL(asset.path, root));
  assert.equal(bytes.length, 1761339);
  assert.equal(asset.bytes, bytes.length);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '4a5913f8a42a58165353e44bf492df473f9a90b12bf7b060cc49e3819e6de6bd',
  );
  assert.equal(asset.approved, true);
  assert.equal(asset.publication, 'public');
  assert.deepEqual(
    catalog.campaigns.filter((entry) => entry.assetIds.includes(id)).map((entry) => entry.id),
    ['ukraine-threads'],
  );
  const ledger = await json('game/editions/asset-sources.json'),
    source = ledger.assets.find((entry) => entry.id === id);
  assert.equal(source.rights, 'CC0-1.0');
  assert.equal(source.accession, '2009.300.2713');
  assert.equal(source.source, 'https://www.metmuseum.org/art/collection/search/157571');
  assert.equal(source.sha256, asset.sha256);
  assert.equal(
    source.download,
    'https://images.metmuseum.org/CRDImages/es/original/31.529_CP4.jpg',
  );
});
