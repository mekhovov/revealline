import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import {
  COMPLETION_REWARD_FORMAT,
  COMPLETION_REWARD_V2_FORMAT,
  EARNED_REWARD_FORMAT,
  EARNED_REWARD_V2_FORMAT,
  REWARD_STATE_FORMAT,
  REWARD_STATE_V2_FORMAT,
  createRewardState,
  validateCompletionReward,
  validateAcceptedPracticeEvidence,
  validateEarnedRewardReceipt,
  validateRewardState,
  completionRewardIdentity,
  projectRewardProgress,
  reconcileEarnedRewards,
  mergeRewardStates,
  mergeImportedRewardStates,
  RewardImportConflictError,
} from '../rewards/model.mjs';
import { createRewardBackend, createRewardStore } from '../rewards/store.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const editionId = 'flight-edition';
const clone = structuredClone;
const identity = (index) => index.toString(16).padStart(16, '0');
const course = (index) => `flight-${String(index).padStart(2, '0')}`;
function practiceRequirement(index = 1, modes = ['self-level', 'acro']) {
  return {
    model: 'civilian-quad-fixed.v1',
    course: course(index),
    courseIdentity: identity(index),
    modes,
    responseIdentities: null,
  };
}
function accepted(index = 1, mode = 'self-level', responseIdentity = identity(101)) {
  const requirement = practiceRequirement(index);
  return {
    model: requirement.model,
    course: requirement.course,
    courseIdentity: requirement.courseIdentity,
    mode,
    responseIdentity,
    attemptId: `attempt-${index}-${mode}-${responseIdentity}`,
  };
}
function definition(count = 1, modes) {
  return {
    format: COMPLETION_REWARD_V2_FORMAT,
    id: count === 1 ? 'flight-01-discovery' : 'flight-finale',
    revision: 'r1',
    brandId: 'flight-brand',
    campaignId: 'flight-learning',
    scope:
      count === 1
        ? { kind: 'practice', id: 'flight-01' }
        : { kind: 'campaign', id: 'flight-learning' },
    locales: {
      en: { title: 'Flight notebook', teaser: 'Complete the declared courses.' },
      uk: { title: 'Нотатник польотів', teaser: 'Завершіть зазначені вправи.' },
    },
    requirements: {
      missions: [],
      learning: [],
      mastery: [],
      practice: Array.from({ length: count }, (_, i) => practiceRequirement(i + 1, modes)),
    },
    payloads: [
      {
        id: 'notebook',
        type: 'knowledge',
        locales: {
          en: { title: 'Control notebook', paragraphs: ['Throttle changes upward force.'] },
          uk: { title: 'Нотатник керування', paragraphs: ['Газ змінює підйомну силу.'] },
        },
      },
    ],
  };
}
function context(count = 1) {
  return {
    editionId,
    brandId: 'flight-brand',
    campaignIds: ['flight-learning'],
    clears: {},
    learning: [],
    mastery: [],
    practice: Array.from({ length: count }, (_, i) => accepted(i + 1)),
  };
}
function arcade() {
  const value = definition();
  value.format = COMPLETION_REWARD_FORMAT;
  value.id = 'arcade-discovery';
  value.scope = { kind: 'mission', id: 'arcade-01' };
  delete value.requirements.practice;
  value.requirements.missions = [
    { missionId: 'arcade-01', bindings: [{ gameplayId: 'arcade-game', difficulty: 'normal' }] },
  ];
  return value;
}
function arcadeContext() {
  const value = context(0);
  delete value.practice;
  value.clears['arcade-01'] = {
    runId: 'real-arcade-clear',
    gameplayId: 'arcade-game',
    difficulty: 'normal',
  };
  return value;
}

test('v1 promise, receipt and state bytes remain v1 with no practice additions', () => {
  const input = arcade(),
    evidence = arcadeContext();
  assert.equal(completionRewardIdentity(input), dataIdentity(input));
  const result = reconcileEarnedRewards([input], evidence);
  const expectedReceipt = {
    format: EARNED_REWARD_FORMAT,
    editionId,
    definition: input,
    definitionIdentity: dataIdentity(input),
    evidence,
  };
  assert.equal(canonicalJSON(result.granted[0]), canonicalJSON(expectedReceipt));
  assert.equal(
    canonicalJSON(result.state),
    canonicalJSON({
      format: REWARD_STATE_FORMAT,
      editionId,
      promises: [input],
      receipts: [expectedReceipt],
      acknowledged: [],
    }),
  );
  assert.deepEqual(
    reconcileEarnedRewards([input], { ...evidence, practice: [accepted()] }).state,
    result.state,
  );
  assert.throws(
    () =>
      validateCompletionReward({ ...input, requirements: { ...input.requirements, practice: [] } }),
    /reward requirements\.practice is not supported/,
  );
  assert.equal(Object.hasOwn(projectRewardProgress(input, evidence), 'practice'), false);
});

test('twelve distinct exact courses are required, independent of arcade clears', () => {
  const finale = definition(12);
  const eleven = projectRewardProgress(finale, context(11));
  assert.equal(eleven.eligible, false);
  assert.equal(eleven.completed, 11);
  assert.deepEqual(eleven.missingCourseIds, ['flight-12']);
  const lastOnly = context(0);
  lastOnly.practice = [accepted(12)];
  assert.equal(projectRewardProgress(finale, lastOnly).completed, 1);
  assert.equal(projectRewardProgress(finale, context(12)).eligible, true);
  const result = reconcileEarnedRewards([finale], context(12));
  assert.deepEqual(result.state.receipts[0].evidence.clears, {});
  assert.equal(result.state.format, REWARD_STATE_V2_FORMAT);
  assert.equal(result.granted[0].format, EARNED_REWARD_V2_FORMAT);
  assert.equal(result.granted[0].evidence.practice.length, 12);
  assert.equal(reconcileEarnedRewards([finale], context(12), result.state).granted.length, 0);
});

test('main reward accepts either declared mode; Acro distinction requires all twelve Acro attempts', () => {
  const main = definition(12),
    acro = definition(12, ['acro']);
  acro.id = 'flight-acro';
  const mixed = context(12);
  mixed.practice[6] = accepted(7, 'acro');
  assert.equal(projectRewardProgress(main, mixed).eligible, true);
  assert.equal(projectRewardProgress(acro, mixed).completed, 1);
  const full = context(12);
  full.practice = full.practice.map((_, i) => accepted(i + 1, 'acro'));
  full.practice.push(accepted(1));
  const result = reconcileEarnedRewards([main, acro], full);
  assert.equal(result.granted.length, 2);
  assert.equal(result.granted[1].evidence.practice.length, 12);
  assert.ok(result.granted[1].evidence.practice.every((item) => item.mode === 'acro'));
});

test('exact model, course, mode and explicit response policy constrain verifier projections', () => {
  for (const [field, changed] of Object.entries({
    model: 'other-model.v1',
    course: 'other-course',
    courseIdentity: identity(77),
    mode: 'demonstration',
  })) {
    const value = context();
    value.practice[0][field] = changed;
    assert.equal(projectRewardProgress(definition(), value).eligible, false, field);
  }
  const exact = definition();
  exact.requirements.practice[0].responseIdentities = [identity(101), identity(102)];
  assert.equal(projectRewardProgress(exact, context()).eligible, true);
  const custom = context();
  custom.practice[0] = accepted(1, 'self-level', identity(103));
  assert.equal(projectRewardProgress(exact, custom).eligible, false);
  assert.equal(projectRewardProgress(definition(), custom).eligible, true);
  for (const field of [
    'model',
    'course',
    'courseIdentity',
    'mode',
    'responseIdentity',
    'attemptId',
  ]) {
    const item = accepted();
    delete item[field];
    assert.throws(() => validateAcceptedPracticeEvidence(item));
  }
  assert.throws(
    () => validateAcceptedPracticeEvidence({ ...accepted(), completed: true }),
    /accepted practice evidence\.completed is not supported/,
  );
});

test('v2 requirements are explicit and bounded; practice scope cannot smuggle arcade or other courses', () => {
  for (const mutate of [
    (value) => {
      delete value.requirements.practice;
    },
    (value) => {
      value.requirements.practice = [];
    },
    (value) => {
      delete value.requirements.practice[0].responseIdentities;
    },
    (value) => {
      value.requirements.practice[0].responseIdentities = [];
    },
    (value) => {
      value.requirements.practice[0].modes = [];
    },
    (value) => {
      value.requirements.practice[0].modes = ['acro', 'acro'];
    },
    (value) => {
      value.requirements.practice.push(practiceRequirement(1));
    },
    (value) => {
      value.requirements.practice.push(practiceRequirement(2));
    },
    (value) => {
      value.scope.id = 'flight-02';
    },
    (value) => {
      value.requirements.missions = arcade().requirements.missions;
    },
  ]) {
    const value = definition();
    mutate(value);
    assert.throws(() => validateCompletionReward(value));
  }
  const excessive = definition(129);
  assert.throws(() => validateCompletionReward(excessive), /practice requirements|large/);
  const duplicate = context();
  duplicate.practice.push(accepted());
  assert.throws(
    () => projectRewardProgress(definition(), duplicate),
    /Duplicate accepted practice attempt/,
  );
});

test('mixed v1/v2 state round-trips with strict container/receipt versions and exact evidence pins', () => {
  const evidence = { ...arcadeContext(), practice: context().practice };
  const mixed = reconcileEarnedRewards([arcade(), definition()], evidence).state;
  assert.equal(mixed.format, REWARD_STATE_V2_FORMAT);
  assert.equal(mixed.receipts[0].format, EARNED_REWARD_FORMAT);
  assert.equal(mixed.receipts[1].format, EARNED_REWARD_V2_FORMAT);
  assert.deepEqual(validateRewardState(JSON.parse(JSON.stringify(mixed))), mixed);
  assert.throws(() => validateRewardState({ ...mixed, format: REWARD_STATE_FORMAT }), /format/);
  assert.throws(
    () => validateRewardState({ ...createRewardState(editionId), format: REWARD_STATE_V2_FORMAT }),
    /format/,
  );
  for (const mutate of [
    (receipt) => {
      receipt.format = EARNED_REWARD_FORMAT;
    },
    (receipt) => {
      receipt.evidence.practice[0].courseIdentity = identity(99);
    },
    (receipt) => {
      receipt.evidence.practice.push(accepted(2));
    },
    (receipt) => {
      receipt.evidence.practice = [];
    },
    (receipt) => {
      receipt.evidence.practice[0].responseIdentity = 'unvalidated';
    },
    (receipt) => {
      receipt.definitionIdentity = identity(99);
    },
  ]) {
    const receipt = clone(mixed.receipts[1]);
    mutate(receipt);
    assert.throws(() => validateEarnedRewardReceipt(receipt));
  }
  const old = clone(mixed.receipts[0]);
  old.evidence.practice = [];
  assert.throws(() => validateEarnedRewardReceipt(old), /version/);
  assert.throws(() => validateRewardState(mixed, { editionId: 'other-edition' }), /edition/);
});

test('practice inputs are copied and deeply frozen; external frozen graphs are still validated', () => {
  const input = definition(),
    owned = validateCompletionReward(input);
  input.requirements.practice[0].modes.push('injected');
  assert.deepEqual(owned.requirements.practice[0].modes, ['self-level', 'acro']);
  assert.ok(Object.isFrozen(owned.requirements.practice[0].modes));
  const bad = clone(owned);
  bad.requirements.practice[0].responseIdentities = ['bad'];
  assert.throws(() => validateCompletionReward(Object.freeze(bad)), /response/);
  const source = accepted(),
    result = validateAcceptedPracticeEvidence(source);
  source.mode = 'invalid';
  assert.equal(result.mode, 'self-level');
});

test('practice promises do not overwrite old promises and explicit conflicting imports fail closed', () => {
  const original = reconcileEarnedRewards([definition()], context()).state;
  const changed = definition();
  changed.revision = 'r2';
  changed.payloads[0].locales.en.paragraphs = ['A different payload.'];
  const newer = reconcileEarnedRewards([changed], context()).state;
  assert.deepEqual(mergeRewardStates(original, newer), original);
  assert.throws(() => mergeImportedRewardStates(original, newer), RewardImportConflictError);
  assert.deepEqual(mergeImportedRewardStates(createRewardState(editionId), original), original);
});

test('shared store persists/reloads mixed practice and arcade rewards without manufactured Journey clears', async () => {
  const memory = managedIndexedDB();
  const make = () =>
    createRewardStore({
      editionId,
      backend: createRewardBackend({ editionId, indexedDB: memory.indexedDB }),
    });
  const store = make();
  await store.load();
  store.reconcile([arcade()], arcadeContext());
  await store.settled();
  store.reconcile([definition()], { ...arcadeContext(), practice: context().practice });
  await store.settled();
  assert.equal(store.status().durable, true);
  assert.equal(store.current().format, REWARD_STATE_V2_FORMAT);
  assert.equal(store.current().receipts.length, 2);
  const backup = JSON.parse(store.export());
  await store.close();
  const restored = make();
  await restored.load();
  assert.deepEqual(restored.current(), backup);
  assert.deepEqual(
    restored.current().receipts.find((entry) => entry.definition.id === 'flight-01-discovery')
      .evidence.clears,
    {},
  );
  await restored.close();
});

test('v2 explicit import uses versioned reservation fragments and rejects a conflicting durable promise', async () => {
  const incoming = reconcileEarnedRewards([definition()], context()).state;
  const memory = managedIndexedDB();
  const backend = createRewardBackend({ editionId, indexedDB: memory.indexedDB });
  const store = createRewardStore({ editionId, backend });
  await store.load();
  await store.restore(incoming);
  assert.deepEqual(store.current(), incoming);
  await store.restore(incoming);
  assert.equal(store.current().receipts.length, 1);
  const changed = definition();
  changed.revision = 'r2';
  await assert.rejects(
    store.restore(reconcileEarnedRewards([changed], context()).state),
    RewardImportConflictError,
  );
  assert.deepEqual(await backend.read(), incoming);
  assert.equal(store.status().pending, false);
  await store.close();
});

test('late mixed-version reconciliation releases a practice reservation without changing committed pins', async () => {
  const incoming = reconcileEarnedRewards([definition()], context()).state;
  const memory = managedIndexedDB();
  const backend = createRewardBackend({ editionId, indexedDB: memory.indexedDB });
  const store = createRewardStore({ editionId, backend });
  await store.load();
  const changed = definition();
  changed.revision = 'r2';
  let refreshed = false;
  memory.afterAnyCommit = () => {
    if (refreshed) return;
    refreshed = true;
    const result = store.reconcile(
      [changed, arcade()],
      { ...arcadeContext(), practice: context().practice },
      { persist: false },
    );
    assert.deepEqual(
      result.granted.map((receipt) => receipt.definition.id),
      ['arcade-discovery'],
    );
    assert.equal(
      store.current().format,
      REWARD_STATE_FORMAT,
      'Only the unrelated arcade fragment is visible before commit resumes.',
    );
  };
  await store.restore(incoming);
  assert.equal(refreshed, true);
  assert.equal(store.current().format, REWARD_STATE_V2_FORMAT);
  assert.deepEqual(
    store.current().receipts.map((receipt) => [receipt.definition.id, receipt.definition.revision]),
    [
      ['flight-01-discovery', 'r1'],
      ['arcade-discovery', 'r1'],
    ],
  );
  assert.deepEqual(
    await backend.read(),
    incoming,
    'Session-only unrelated receipts cannot leak into the imported save.',
  );
  assert.equal(store.status().pending, false);
  assert.equal(store.status().error, null);
  await store.close();
});
