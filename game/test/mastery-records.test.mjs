import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, getSummary, CLASSES, loadoutHash, rosterHash } from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { campaignKey } from '../library.mjs';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import { completionVariantKey } from '../progress.mjs';
import {
  MASTERY_RECORD_VERSION,
  MASTERY_RECORD_LIMITS,
  MasteryCapacityError,
  resolveMasteryRecord,
  validateMasteryRecord,
  masteryRecordKey,
  resolveMasteryRecords,
  validateMasteryRecords,
  mergeMasteryRecords,
} from '../mastery-records.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'orchard',
  revision: '1',
  name: 'Orchard',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'homeward-test',
  revision: '1',
  title: 'Homeward test',
  levels: [level],
  classRecipes: CLASSES,
};
const summary = getSummary(createRun(level, { classId: 'fiber', classRecipes: CLASSES }));
const definition = {
  version: 'xonix-mastery-definition.v1',
  id: 'steady-signal',
  revision: '1',
  campaignId: campaign.id,
  levelId: level.id,
  name: 'Steady Signal',
  description: 'Close a resistant cut and return cleanly.',
  all: [{ type: 'clean-win' }, { type: 'resistant-cut-cells', zoneId: 'broad-band', minCells: 8 }],
};
function record() {
  const {
    ruleset,
    seed,
    turnPolicy,
    classId,
    classRevision,
    loadoutHash,
    rosterHash,
    classHistory,
  } = summary;
  return {
    format: MASTERY_RECORD_VERSION,
    campaignKey: campaignKey(campaign),
    levelId: level.id,
    levelRevision: level.revision,
    levelIdentity: `level-v1-${dataIdentity(normalizedLevel(level))}`,
    definitionId: definition.id,
    definitionRevision: definition.revision,
    definitionHash: `mastery-v1-${dataIdentity(definition)}`,
    setup: {
      ruleset,
      seed,
      turnPolicy,
      classId,
      classRevision,
      loadoutHash,
      rosterHash,
      classHistory: structuredClone(classHistory),
    },
    runId: 'qualifying-run',
    earnedAt: '2026-09-12T12:00:00.000Z',
  };
}
function withSwitches(ticks = [120, 240]) {
  const value = record();
  const bomber = CLASSES.find((recipe) => recipe.id === 'bomber');
  value.setup.classHistory.push(
    {
      classId: bomber.id,
      classRevision: bomber.revision,
      loadoutHash: loadoutHash(bomber),
      tick: ticks[0],
    },
    { ...value.setup.classHistory[0], tick: ticks[1] },
  );
  return value;
}
function changed(change, original = record()) {
  const candidate = structuredClone(original);
  change(candidate);
  return candidate;
}

test('record resolves existing core identities into owned portable data without claiming qualification', () => {
  const original = withSwitches();
  const before = structuredClone(original);
  const resolved = resolveMasteryRecord(JSON.stringify(original));
  assert.deepEqual(resolved, original);
  assert.deepEqual(validateMasteryRecord(original), { valid: true, errors: [] });
  assert.equal(resolved.setup.rosterHash, rosterHash(CLASSES));
  assert.match(masteryRecordKey(resolved), /^mastery-record-v1-[0-9a-f]{16}$/);
  resolved.setup.classHistory[1].tick = 121;
  assert.deepEqual(original, before);
  assert.equal(
    summary.status,
    'running',
    'Structural metadata acceptance deliberately is not a win/award verifier.',
  );
  assert.equal(Object.hasOwn(resolved, 'qualified'), false);
});

test('collection resolution is deterministic, owned and accepts empty arrays', () => {
  const a = record(),
    b = changed((r) => r.setup.seed++);
  const input = [b, a],
    before = structuredClone(input);
  const output = resolveMasteryRecords(input);
  assert.deepEqual(output, resolveMasteryRecords(JSON.stringify([a, b])));
  output[0].setup.classHistory[0].classRevision = 'mutated';
  assert.deepEqual(input, before);
  assert.deepEqual(resolveMasteryRecords([]), []);
  assert.deepEqual(validateMasteryRecords([]), { valid: true, errors: [] });
});

test('setup grouping matches the ordinary route projection and retains exact attempt timing', () => {
  const earlier = withSwitches([120, 240]);
  earlier.runId = 'earlier';
  const later = withSwitches([600, 900]);
  later.runId = 'later';
  later.earnedAt = '2026-09-13T12:00:00.000Z';
  assert.equal(
    completionVariantKey({ ...summary, classHistory: earlier.setup.classHistory }),
    completionVariantKey({ ...summary, classHistory: later.setup.classHistory }),
  );
  assert.equal(masteryRecordKey(earlier), masteryRecordKey(later));
  assert.deepEqual(mergeMasteryRecords([later], [earlier]), [earlier]);
  assert.deepEqual(
    mergeMasteryRecords([earlier], [later])[0].setup.classHistory,
    earlier.setup.classHistory,
  );
});

test('definition revisions/hashes, maps, level data and qualifying setups stay separate', () => {
  const baseline = withSwitches();
  const variants = [
    (r) => (r.definitionId = 'other-seal'),
    (r) => (r.definitionRevision = '2'),
    (r) => (r.definitionHash = 'mastery-v1-1111111111111111'),
    (r) => (r.campaignKey = 'other/1/1111111111111111'),
    (r) => (r.levelId = 'other-map'),
    (r) => (r.levelRevision = '2'),
    (r) => (r.levelIdentity = 'level-v1-1111111111111111'),
    (r) => (r.setup.seed = 2),
    (r) => (r.setup.turnPolicy = 'grid-center'),
    (r) => (r.setup.rosterHash = 'roster-v1-11111111'),
    (r) => (r.setup.classHistory[1].classRevision = '2'),
    (r) => (r.setup.classHistory[1].loadoutHash = 'loadout-v1-11111111'),
    (r) => r.setup.classHistory.pop(),
    (r) => {
      r.setup.classId = 'trapper';
      r.setup.classHistory[0].classId = 'trapper';
    },
    (r) => {
      r.setup.classRevision = '2';
      r.setup.classHistory[0].classRevision = '2';
      r.setup.classHistory[2].classRevision = '2';
    },
    (r) => {
      r.setup.loadoutHash = 'loadout-v1-11111111';
      r.setup.classHistory[0].loadoutHash = r.setup.loadoutHash;
      r.setup.classHistory[2].loadoutHash = r.setup.loadoutHash;
    },
  ].map((change) => changed(change, baseline));
  for (const variant of variants) {
    assert.equal(validateMasteryRecord(variant).valid, true);
    assert.notEqual(masteryRecordKey(variant), masteryRecordKey(baseline));
    assert.equal(mergeMasteryRecords([baseline], [variant]).length, 2);
  }
});

test('union is idempotent, commutative and associative with deterministic earliest-earned ties', () => {
  const a = withSwitches([120, 240]);
  a.runId = 'b-run';
  const b = withSwitches([600, 900]);
  b.runId = 'a-run';
  const c = changed((r) => {
    r.setup.seed++;
    r.earnedAt = '2026-09-11T00:00:00.000Z';
  });
  const expected = resolveMasteryRecords([b, c]);
  assert.deepEqual(mergeMasteryRecords([a], [b]), [b]);
  assert.deepEqual(mergeMasteryRecords([b], [a]), [b]);
  assert.deepEqual(mergeMasteryRecords(expected, expected), expected);
  assert.deepEqual(mergeMasteryRecords(mergeMasteryRecords([a], [b]), [c]), expected);
  assert.deepEqual(mergeMasteryRecords([a], mergeMasteryRecords([b], [c])), expected);
  const sameRunOtherTiming = changed((r) => (r.setup.classHistory[1].tick = 601), b);
  const tie = [b, sameRunOtherTiming].sort((l, r) =>
    canonicalJSON(l) < canonicalJSON(r) ? -1 : 1,
  )[0];
  assert.deepEqual(mergeMasteryRecords([b], [sameRunOtherTiming]), [tie]);
  assert.deepEqual(mergeMasteryRecords([sameRunOtherTiming], [b]), [tie]);
});

test('a collection rejects duplicate identities while cross-collection delivery is idempotent', () => {
  const a = withSwitches(),
    b = changed((r) => {
      r.runId = 'duplicate';
      r.setup.classHistory[1].tick = 121;
    }, a);
  assert.throws(() => resolveMasteryRecords([a, b]), /duplicate definition\/setup/);
  assert.equal(validateMasteryRecords([a, b]).valid, false);
  assert.equal(mergeMasteryRecords([a], [b]).length, 1);
});

test('malformed records and partial goal fragments reject before union without changing inputs', () => {
  const valid = [withSwitches()],
    before = canonicalJSON(valid);
  const changes = [
    (r) => delete r.format,
    (r) => (r.format = 'xonix-mastery-record.v2'),
    (r) => (r.campaignKey = 'bad/percent%/0000000000000000'),
    (r) => (r.campaignKey = 'bad/encoded%2f/0000000000000000'),
    (r) => (r.levelId = '__proto__'),
    (r) => (r.levelRevision = ''),
    (r) => (r.levelIdentity = 'level-v2-0000000000000000'),
    (r) => (r.definitionHash = 'mastery-v1-ABCDEFABCDEFABCD'),
    (r) => (r.definitionRevision = 'x'.repeat(81)),
    (r) => (r.runId = ' '),
    (r) => (r.runId = 'line\nbreak'),
    (r) => (r.earnedAt = '2026-02-30T00:00:00.000Z'),
    (r) => (r.earnedAt = '2026-09-12T12:00:00+00:00'),
    (r) => (r.earnedAt = 'tomorrow'),
    (r) => (r.setup.ruleset = 'xonix-core.v3'),
    (r) => (r.setup.seed = -1),
    (r) => (r.setup.seed = 0x100000000),
    (r) => (r.setup.seed = NaN),
    (r) => (r.setup.turnPolicy = 'smooth'),
    (r) => (r.setup.rosterHash = 'roster-v1-wrong'),
    (r) => (r.setup.classHistory = []),
    (r) => (r.setup.classHistory[0].tick = 1),
    (r) => (r.setup.classHistory[0].classId = 'scout'),
    (r) => (r.setup.classHistory[0].classRevision = '2'),
    (r) => (r.setup.classHistory[0].loadoutHash = 'loadout-v1-11111111'),
    (r) => (r.setup.classHistory[1].tick = 0),
    (r) => (r.setup.classHistory[1].tick = 1.5),
    (r) => (r.setup.classHistory[1].tick = Number.MAX_SAFE_INTEGER + 1),
    (r) => (r.setup.classHistory[1].classId = 'fiber'),
    (r) => (r.setup.classHistory[2].classRevision = '2'),
    (r) => (r.setup.classHistory[2].loadoutHash = 'loadout-v1-11111111'),
    (r) => (r.setup.classHistory[1].goalProgress = 8),
    (r) => (r.setup.bodyId = 'fpv-body'),
    (r) => (r.criteria = { 'clean-win': true }),
    (r) => (r.qualified = true),
    (r) => (r.executable = 'award()'),
  ];
  for (const change of changes) {
    const invalid = changed(change, withSwitches());
    assert.equal(validateMasteryRecord(invalid).valid, false);
    assert.throws(() => mergeMasteryRecords(valid, [invalid]));
    assert.throws(() => mergeMasteryRecords([invalid], valid));
    assert.equal(canonicalJSON(valid), before);
  }
  for (const invalid of [null, {}, false, 1, '', 'not json', undefined])
    assert.throws(() => mergeMasteryRecords(valid, invalid));
});

test('getters, hidden or symbol fields, prototype keys and cyclic/sparse data never become records', () => {
  let getterCalls = 0;
  const accessor = record();
  Object.defineProperty(accessor.setup, 'seed', {
    enumerable: true,
    get() {
      getterCalls++;
      return 1;
    },
  });
  const hidden = record();
  Object.defineProperty(hidden, 'hidden', { value: 'payload', enumerable: false });
  const symbol = record();
  symbol[Symbol('payload')] = true;
  const polluted = JSON.parse(
    JSON.stringify(record()).replace('"setup":{', '"setup":{"__proto__":{"polluted":true},'),
  );
  const inherited = Object.assign(Object.create({ inherited: true }), record());
  const cyclic = record();
  cyclic.setup.extra = cyclic;
  const sparse = record();
  sparse.setup.classHistory = Array(1);
  const customArray = [record()];
  customArray.extra = true;
  for (const bad of [accessor, hidden, symbol, polluted, inherited, cyclic, sparse]) {
    assert.equal(validateMasteryRecord(bad).valid, false);
    assert.throws(() => mergeMasteryRecords([], [bad]));
  }
  assert.throws(() => resolveMasteryRecords(customArray));
  assert.equal(getterCalls, 0);
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
});

test('ordinary/null-prototype data canonicalizes without aliasing and normalizes negative zero', () => {
  const candidate = record();
  candidate.setup.seed = -0;
  candidate.setup.classHistory[0].tick = -0;
  const toNull = (value) =>
    Array.isArray(value)
      ? value.map(toNull)
      : value && typeof value === 'object'
        ? Object.assign(
            Object.create(null),
            Object.fromEntries(Object.entries(value).map(([key, child]) => [key, toNull(child)])),
          )
        : value;
  const result = resolveMasteryRecord(toNull(candidate));
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.is(result.setup.seed, -0), false);
  assert.equal(Object.is(result.setup.classHistory[0].tick, -0), false);
  assert.deepEqual(resolveMasteryRecord(JSON.stringify(result)), result);
});

test('full class history is bounded explicitly without truncating an existing attempt', () => {
  const candidate = record();
  const first = candidate.setup.classHistory[0];
  const bomber = CLASSES.find((recipe) => recipe.id === 'bomber');
  const other = {
    classId: bomber.id,
    classRevision: bomber.revision,
    loadoutHash: loadoutHash(bomber),
  };
  candidate.setup.classHistory = Array.from(
    { length: MASTERY_RECORD_LIMITS.classHistory },
    (_, tick) => ({ ...(tick % 2 ? other : first), tick }),
  );
  assert.equal(resolveMasteryRecord(candidate).setup.classHistory.length, 128);
  candidate.setup.classHistory.push({ ...first, tick: 128 });
  const before = canonicalJSON(candidate);
  assert.throws(
    () => resolveMasteryRecord(candidate),
    (error) => error instanceof MasteryCapacityError && error.resource === 'class history',
  );
  assert.equal(canonicalJSON(candidate), before);
});

test('4096 compact records fit, duplicate union stays idempotent and overflow preserves both collections', () => {
  const base = record();
  const all = Array.from({ length: MASTERY_RECORD_LIMITS.records }, (_, seed) => ({
    ...base,
    setup: { ...base.setup, seed },
  }));
  const before = canonicalJSON(all);
  const canonical = resolveMasteryRecords(all);
  assert.equal(canonical.length, 4096);
  assert.deepEqual(mergeMasteryRecords(all, all), canonical);
  const next = [{ ...base, setup: { ...base.setup, seed: 4096 } }];
  assert.throws(
    () => mergeMasteryRecords(all, next),
    (error) => error instanceof MasteryCapacityError && error.resource === 'record count',
  );
  assert.throws(
    () => resolveMasteryRecords([...all, ...next]),
    (error) => error instanceof MasteryCapacityError && error.resource === 'record count',
  );
  assert.equal(canonicalJSON(all), before);
  assert.equal(next[0].setup.seed, 4096);
});

test('aggregate byte overflow rejects without silently evicting records below the item cap', () => {
  const full = record();
  const first = full.setup.classHistory[0];
  full.setup.classHistory = Array.from({ length: 128 }, (_, tick) => ({
    ...first,
    classId: tick % 2 ? 'alternate' : first.classId,
    tick,
  }));
  const records = Array.from({ length: 512 }, (_, seed) => ({
    ...full,
    setup: { ...full.setup, seed },
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(records)) > MASTERY_RECORD_LIMITS.maxBytes);
  assert.throws(
    () => resolveMasteryRecords(records),
    (error) => error instanceof MasteryCapacityError && error.resource === 'collection bytes',
  );
  assert.equal(records.length, 512);
  assert.equal(records[0].setup.classHistory.length, 128);
});
