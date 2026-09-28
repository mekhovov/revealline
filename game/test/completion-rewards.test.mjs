import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardContext } from '../rewards/context.mjs';
import {
  COMPLETION_REWARD_FORMAT,
  acknowledgeReward,
  completionRewardAssetReferences,
  completionRewardIdentity,
  createRewardState,
  mergeRewardStates,
  mergeImportedRewardStates,
  RewardImportConflictError,
  projectRewardProgress,
  reconcileEarnedRewards,
  validateCompletionReward,
  validateCompletionRewards,
  validateEarnedRewardReceipt,
  validateRewardState,
} from '../rewards/model.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const translation = (value) => ({ en: { ...value }, uk: { ...value } });
const media = (assetId, char = 'a') => ({ assetId, sha256: char.repeat(64) });
function reward() {
  return {
    format: COMPLETION_REWARD_FORMAT,
    id: 'workshop-atlas',
    revision: 'r1',
    brandId: 'test-brand',
    campaignId: 'workshop',
    scope: { kind: 'campaign', id: 'workshop' },
    locales: translation({ title: 'Workshop atlas', teaser: 'Complete six discoveries.' }),
    requirements: {
      missions: Array.from({ length: 6 }, (_, index) => ({
        missionId: `workshop-${index + 1}`,
        bindings: [
          { gameplayId: `game-${index + 1}-normal`, difficulty: 'normal' },
          { gameplayId: `game-${index + 1}-easy`, difficulty: 'easy' },
        ],
      })),
      learning: [],
      mastery: [],
    },
    payloads: [
      {
        id: 'atlas',
        type: 'knowledge',
        locales: translation({
          title: 'The full picture',
          paragraphs: ['Six pieces make one illustrated atlas.'],
          sources: [{ title: 'Official reference', url: 'https://example.org/reference' }],
        }),
      },
    ],
  };
}
function context(count = 6) {
  return {
    editionId: 'test-edition',
    brandId: 'test-brand',
    campaignIds: ['workshop'],
    clears: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `workshop-${index + 1}`,
        { runId: `run-${index + 1}`, gameplayId: `game-${index + 1}-normal`, difficulty: 'normal' },
      ]),
    ),
    learning: [],
    mastery: [],
  };
}

test('all six distinct compatible mission wins are needed, not reaching the final mission', () => {
  const definition = reward();
  const five = projectRewardProgress(definition, context(5));
  assert.equal(five.eligible, false);
  assert.equal(five.completed, 5);
  assert.equal(five.total, 6);
  assert.deepEqual(five.missingMissionIds, ['workshop-6']);
  const lastOnly = context();
  lastOnly.clears = { 'workshop-6': lastOnly.clears['workshop-6'] };
  assert.equal(projectRewardProgress(definition, lastOnly).completed, 1);
  assert.equal(projectRewardProgress(definition, lastOnly).eligible, false);
  assert.equal(projectRewardProgress(definition, context()).eligible, true);
  assert.equal(projectRewardProgress(definition, context(0)).completed, 0);
});

test('gameplay and difficulty must match one authored pair; unrelated ownership is unavailable', () => {
  for (const change of [
    (value) => {
      value.clears['workshop-1'].gameplayId = 'stale-map';
    },
    (value) => {
      value.clears['workshop-1'].difficulty = 'hard';
    },
    (value) => {
      value.clears['workshop-1'].difficulty = 'easy';
    },
  ]) {
    const value = context();
    change(value);
    assert.equal(projectRewardProgress(reward(), value).eligible, false);
  }
  const easy = context();
  easy.clears['workshop-1'] = { runId: 'easy-run', gameplayId: 'game-1-easy', difficulty: 'easy' };
  assert.equal(projectRewardProgress(reward(), easy).eligible, true);
  for (const change of [
    (value) => {
      value.brandId = 'other-brand';
    },
    (value) => {
      value.campaignIds = ['other-campaign'];
    },
  ]) {
    const value = context();
    change(value);
    assert.equal(projectRewardProgress(reward(), value).available, false);
    assert.equal(projectRewardProgress(reward(), value).completed, 0);
  }
  const editionReward = reward();
  editionReward.scope = { kind: 'edition', id: 'test-edition' };
  assert.equal(
    projectRewardProgress(editionReward, { ...context(), editionId: 'foreign-edition' }).available,
    false,
  );
});

test('a later selected pack clear can qualify and receipts retain only the matching run', () => {
  const definition = reward();
  definition.requirements.missions[0].bindings = [
    { gameplayId: 'game-1-expert', difficulty: 'expert' },
  ];
  const accepted = context();
  accepted.clears['workshop-1'] = {
    runId: 'gentle-first',
    gameplayId: 'game-1-gentle',
    difficulty: 'gentle',
  };
  assert.equal(projectRewardProgress(definition, accepted).eligible, false);
  const expert = { runId: 'expert-second', gameplayId: 'game-1-expert', difficulty: 'expert' };
  accepted.clearAlternatives = { 'workshop-1': [expert] };
  assert.equal(projectRewardProgress(definition, accepted).eligible, true);
  const result = reconcileEarnedRewards([definition], accepted);
  assert.equal(result.granted.length, 1);
  assert.deepEqual(result.granted[0].evidence.clears['workshop-1'], expert);
  assert.equal(Object.hasOwn(result.granted[0].evidence, 'clearAlternatives'), false);
  const normalized = context();
  normalized.clears['workshop-1'] = expert;
  assert.deepEqual(result.state, reconcileEarnedRewards([definition], normalized).state);
  const alteredReceipt = clone(result.granted[0]);
  alteredReceipt.evidence.clearAlternatives = { 'workshop-1': [accepted.clears['workshop-1']] };
  assert.throws(() => validateEarnedRewardReceipt(alteredReceipt), /normalized clear/);
});

test('Journey adaptation includes distinct clears only from selected mission IDs', () => {
  const provider = {
    editionId: 'test-edition',
    selection: { brand: { id: 'test-brand' }, edition: { campaignIds: ['workshop'] } },
  };
  const bindings = [
    {
      missionId: 'workshop-1',
      journeyMissionIds: [
        'candidate/gentle/workshop/workshop-1',
        'candidate/expert/workshop/workshop-1',
      ],
    },
  ];
  const gentle = { runId: 'gentle', gameplayId: 'gentle-game', difficulty: 'gentle' };
  const expert = { runId: 'expert', gameplayId: 'expert-game', difficulty: 'expert' };
  const foreign = { runId: 'foreign', gameplayId: 'foreign-game', difficulty: 'expert' };
  const profile = {
    clears: {
      solo: {
        [bindings[0].journeyMissionIds[0]]: gentle,
        [bindings[0].journeyMissionIds[1]]: expert,
        'candidate/foreign/workshop/workshop-1': foreign,
        'candidate/expert/workshop/workshop-2': foreign,
      },
    },
  };
  const adapted = rewardContext(provider, bindings, profile);
  assert.deepEqual(adapted.clears, { 'workshop-1': gentle });
  assert.deepEqual(adapted.clearAlternatives, { 'workshop-1': [expert] });
  profile.clears.solo[bindings[0].journeyMissionIds[1]] = clone(gentle);
  const deduplicated = rewardContext(provider, bindings, profile);
  assert.equal(Object.hasOwn(deduplicated, 'clearAlternatives'), false);
  assert.deepEqual(deduplicated, { ...context(0), clears: { 'workshop-1': gentle } });
});

test('clear alternatives are bounded, typed and must belong to a selected primary mission', () => {
  const alt = { runId: 'other-run', gameplayId: 'game-1-easy', difficulty: 'easy' };
  for (const [alternatives, message] of [
    [{ unknown: [alt] }, /not supported/],
    [{ 'workshop-1': [] }, /clear alternatives/],
    [{ 'workshop-1': [context().clears['workshop-1']] }, /Duplicate accepted/],
    [{ 'workshop-1': [{ ...alt, complete: true }] }, /not supported/],
    [
      {
        'workshop-1': Array.from({ length: 129 }, (_, index) => ({
          ...alt,
          runId: `run-${index}`,
        })),
      },
      /clear alternatives/,
    ],
  ])
    assert.throws(
      () => projectRewardProgress(reward(), { ...context(), clearAlternatives: alternatives }),
      message,
    );
});

test('mastery chooses one qualifying run and cannot combine incompatible run evidence', () => {
  const definition = reward();
  const mastery = { id: 'all-records', revision: 'r1', missionId: 'workshop-1' };
  const explanation = { id: 'explain', revision: 'r1', missionId: 'workshop-1' };
  definition.requirements.mastery = [mastery, explanation];
  const accepted = context();
  const second = { runId: 'second-run', gameplayId: 'game-1-easy', difficulty: 'easy' };
  accepted.clearAlternatives = { 'workshop-1': [second] };
  accepted.mastery = [
    { ...mastery, runId: accepted.clears['workshop-1'].runId },
    { ...explanation, runId: second.runId },
  ];
  assert.equal(projectRewardProgress(definition, accepted).eligible, false);
  assert.equal(reconcileEarnedRewards([definition], accepted).granted.length, 0);
  accepted.mastery.push({ ...mastery, runId: second.runId });
  assert.equal(projectRewardProgress(definition, accepted).eligible, true);
  const receipt = reconcileEarnedRewards([definition], accepted).granted[0];
  assert.deepEqual(receipt.evidence.clears['workshop-1'], second);
  assert(receipt.evidence.mastery.every((item) => item.runId === second.runId));
  assert.deepEqual(validateEarnedRewardReceipt(receipt), receipt);
});

test('mission scope needs its own clear and malformed/duplicate required missions are rejected', () => {
  const definition = reward();
  definition.scope = { kind: 'mission', id: 'workshop-1' };
  assert.throws(() => validateCompletionReward(definition), /own mission/);
  definition.requirements.missions = definition.requirements.missions.slice(0, 1);
  assert.equal(projectRewardProgress(definition, context(1)).eligible, true);
  definition.requirements.missions.push(clone(definition.requirements.missions[0]));
  assert.throws(() => validateCompletionReward(definition), /Duplicate required/);
  assert.throws(() => validateCompletionRewards([reward(), reward()]), /Duplicate completion/);
});

test('learning and mastery use named exact revisions and accepted evidence, not status flags', () => {
  const definition = reward();
  const learning = {
    lessonId: 'connections',
    lessonRevision: 'r1',
    fixtureRevision: 'f1',
    lessonIdentity: 'a'.repeat(16),
    missionId: 'workshop-1',
  };
  const mastery = { id: 'all-records', revision: 'r2', missionId: 'workshop-2' };
  definition.requirements.learning = [learning];
  definition.requirements.mastery = [mastery];
  assert.equal(projectRewardProgress(definition, context()).eligible, false);
  const accepted = context();
  accepted.learning.push({ ...learning, attemptId: 'attempt-1' });
  accepted.mastery.push({ ...mastery, runId: 'run-2' });
  assert.equal(projectRewardProgress(definition, accepted).eligible, true);
  accepted.learning[0].fixtureRevision = 'f2';
  assert.equal(projectRewardProgress(definition, accepted).eligible, false);
  accepted.learning[0].fixtureRevision = 'f1';
  accepted.mastery[0].runId = 'practice-run';
  assert.equal(projectRewardProgress(definition, accepted).eligible, false);
  assert.throws(
    () => projectRewardProgress(definition, { ...context(), completed: true }),
    /not supported/,
  );
  assert.throws(
    () =>
      projectRewardProgress(definition, {
        ...context(),
        learning: [{ ...learning, attemptId: 'attempt-1', status: 'complete' }],
      }),
    /not supported/,
  );
});

test('first accepted completion grants once; acknowledgement is independent and cannot grant', () => {
  let result = reconcileEarnedRewards([reward()], context(5));
  assert.equal(result.granted.length, 0);
  assert.equal(result.state.promises.length, 1);
  assert.throws(() => acknowledgeReward(result.state, 'workshop-atlas'), /unearned/);
  result = reconcileEarnedRewards([reward()], context(), result.state);
  assert.equal(result.granted.length, 1);
  assert.equal(result.state.receipts.length, 1);
  assert.deepEqual(result.state.acknowledged, []);
  const acknowledged = acknowledgeReward(result.state, 'workshop-atlas');
  assert.deepEqual(acknowledged.acknowledged, ['workshop-atlas']);
  assert.deepEqual(acknowledgeReward(acknowledged, 'workshop-atlas'), acknowledged);
  const repeated = reconcileEarnedRewards([reward()], context(), acknowledged);
  assert.equal(repeated.granted.length, 0);
  assert.deepEqual(repeated.state, acknowledged);
  assert(Object.isFrozen(repeated.state.receipts[0].definition.payloads[0]));
});

test('campaign expansion cannot move a promised finish line and earned references remain exact', () => {
  const first = reward();
  first.payloads.push({
    id: 'art',
    type: 'image',
    asset: media('atlas-art'),
    locales: translation({ title: 'Atlas', alt: 'Illustrated aircraft' }),
  });
  let result = reconcileEarnedRewards([first], context(5));
  const expanded = clone(first);
  expanded.revision = 'r2';
  expanded.requirements.missions.push({
    missionId: 'workshop-7',
    bindings: [{ difficulty: 'normal', gameplayId: 'game-7-normal' }],
  });
  expanded.payloads[1].asset = media('atlas-art-r2', 'b');
  result = reconcileEarnedRewards([expanded], context(), result.state);
  assert.equal(result.granted.length, 1);
  assert.equal(result.granted[0].definition.revision, 'r1');
  assert.deepEqual(result.granted[0].definition.payloads[1].asset, media('atlas-art'));
  const serialized = JSON.parse(JSON.stringify(result.state));
  assert.deepEqual(validateRewardState(serialized, { editionId: 'test-edition' }), result.state);
  const missingCurrentAssets = reconcileEarnedRewards([], context(0), serialized);
  assert.deepEqual(missingCurrentAssets.state.receipts, result.state.receipts);
  assert.equal(missingCurrentAssets.granted.length, 0);
});

test('explicit import rejects exact promise conflicts instead of silently dropping earned revisions', () => {
  const original = reward();
  const incoming = reconcileEarnedRewards([original], context()).state;
  for (const change of [
    (definition) => {
      definition.revision = 'r2';
    },
    (definition) => {
      definition.payloads[0].locales.en.paragraphs = ['A changed exact payload.'];
    },
  ]) {
    const changed = clone(original);
    change(changed);
    for (const wins of [0, 6]) {
      const current = reconcileEarnedRewards([changed], context(wins)).state;
      const before = JSON.stringify(current);
      assert.throws(
        () => mergeImportedRewardStates(current, incoming),
        (error) =>
          error instanceof RewardImportConflictError &&
          error.code === 'REWARD_IMPORT_CONFLICT' &&
          JSON.stringify(error.rewardIds) === JSON.stringify([original.id]),
      );
      assert.equal(JSON.stringify(current), before);
      assert.deepEqual(mergeRewardStates(current, incoming).promises, current.promises);
    }
  }
  const compatible = reconcileEarnedRewards([original], context(0)).state;
  assert.deepEqual(mergeImportedRewardStates(compatible, incoming), incoming);
  assert.deepEqual(mergeImportedRewardStates(incoming, incoming), incoming);
});

test('receipt import recomputes requirements and rejects changed pins or foreign edition', () => {
  const { state } = reconcileEarnedRewards([reward()], context());
  const receipt = clone(state.receipts[0]);
  delete receipt.evidence.clears['workshop-3'];
  assert.throws(() => validateEarnedRewardReceipt(receipt), /does not satisfy/);
  const changed = clone(state.receipts[0]);
  changed.definition.payloads[0].locales.en.paragraphs = ['Different reward'];
  assert.throws(() => validateEarnedRewardReceipt(changed), /identity/);
  assert.throws(
    () => validateRewardState(state, { editionId: 'other-edition' }),
    /another edition/,
  );
  assert.throws(
    () => reconcileEarnedRewards([reward()], { ...context(), editionId: 'other-edition' }, state),
    /another edition/,
  );
  const repeated = clone(state);
  repeated.receipts.push(repeated.receipts[0]);
  assert.throws(() => validateRewardState(repeated), /Duplicate earned/);
});

test('concurrent state merge preserves first promises/receipts and merges acknowledgements', () => {
  const original = reconcileEarnedRewards([reward()], context());
  const replacement = reward();
  replacement.revision = 'r2';
  const newer = reconcileEarnedRewards([replacement], context());
  const result = mergeRewardStates(original.state, acknowledgeReward(newer.state, replacement.id));
  assert.equal(result.receipts[0].definition.revision, 'r1');
  assert.deepEqual(result.acknowledged, ['workshop-atlas']);
  const oldPromise = reconcileEarnedRewards([reward()], context(5));
  const conflicted = mergeRewardStates(oldPromise.state, newer.state);
  assert.equal(conflicted.receipts.length, 0);
  assert.equal(conflicted.promises[0].revision, 'r1');
  const reconciled = reconcileEarnedRewards([replacement], context(), conflicted);
  assert.equal(reconciled.granted[0].definition.revision, 'r1');
  assert.throws(
    () => mergeRewardStates(original.state, createRewardState('other-edition')),
    /another edition/,
  );
});

test('strict data boundary rejects getters, injected fields, invalid URLs and impossible dates', () => {
  const getter = reward();
  Object.defineProperty(getter, 'revision', {
    enumerable: true,
    get() {
      throw new Error('Getter ran');
    },
  });
  assert.throws(() => validateCompletionReward(getter), /accessors and hidden fields/);
  for (const url of [
    'javascript:alert(1)',
    'http://example.org',
    'https://name:secret@example.org',
    ' https://example.org',
    'https://example.org/\nnext',
    'https:\\example.org',
  ]) {
    const definition = reward();
    definition.payloads = [
      { id: 'link', type: 'url', url, locales: translation({ title: 'Open resource' }) },
    ];
    assert.throws(() => validateCompletionReward(definition), /URL/);
  }
  const code = reward();
  code.payloads = [
    {
      id: 'offer',
      type: 'public-code',
      issuer: 'Example issuer',
      code: 'PUBLIC',
      expiresOn: '2026-02-30',
      locales: translation({ title: 'Public offer', terms: 'Issuer terms apply.' }),
    },
  ];
  assert.throws(() => validateCompletionReward(code), /expiry/);
  const extra = reward();
  extra.payloads[0].html = '<script>run()</script>';
  assert.throws(() => validateCompletionReward(extra), /not supported/);
});

test('media inventories retain exact typed dependencies including captions and transcripts', () => {
  const definition = reward();
  definition.payloads.push({
    id: 'film',
    type: 'video',
    asset: media('film'),
    poster: media('poster'),
    captions: { en: media('captions-en'), uk: media('captions-uk') },
    transcript: { en: media('transcript-en'), uk: media('transcript-uk') },
    locales: translation({ title: 'Workshop story' }),
  });
  definition.payloads.push({
    id: 'poster',
    type: 'image',
    asset: media('poster'),
    locales: translation({ title: 'Workshop poster', alt: 'A community workshop' }),
  });
  assert.equal(completionRewardAssetReferences([definition]).length, 6);
  const reversed = Object.fromEntries(Object.entries(definition).reverse());
  assert.equal(completionRewardIdentity(definition), completionRewardIdentity(reversed));
  const conflict = clone(definition);
  conflict.payloads[2].asset.sha256 = 'b'.repeat(64);
  assert.throws(() => completionRewardAssetReferences([conflict]), /conflicting revisions/);
  delete definition.payloads[1].transcript;
  assert.throws(() => validateCompletionReward(definition), /object/);
});
