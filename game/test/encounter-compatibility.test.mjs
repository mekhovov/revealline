import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  LEGACY_VERSIONS,
  ENCOUNTER_VERSIONS,
  resolveVersions,
  versionsForLevel,
  versionsForCampaign,
} from '../core/versions.mjs';
import {
  createRun,
  stepRun,
  releaseInputs,
  getSummary,
  RULESET,
  FIXED_DT,
} from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/compatibility-v060.json', import.meta.url), 'utf8'),
);
const sha = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');

test('version defaults retain the old public ruleset and exact legacy pair', () => {
  assert.equal(RULESET, 'xonix-core.v2');
  assert.deepEqual(resolveVersions(), {
    levelVersion: 'xonix-level.v1',
    ruleset: 'xonix-core.v2',
    replayVersion: 'xonix-replay.v3',
    checkpointAlgorithm: 'fnv1a64-state-v2',
  });
  assert.deepEqual(resolveVersions({}), LEGACY_VERSIONS);
  assert.equal(Object.isFrozen(LEGACY_VERSIONS), true);
  assert.equal(Object.isFrozen(ENCOUNTER_VERSIONS), true);
  const owned = resolveVersions();
  owned.ruleset = 'bad';
  assert.equal(resolveVersions().ruleset, RULESET);
});

test('every explicit selector selects only its complete supported pair', () => {
  for (const pair of [LEGACY_VERSIONS, ENCOUNTER_VERSIONS]) {
    assert.deepEqual(resolveVersions(pair), pair);
    for (const key of Object.keys(pair))
      assert.deepEqual(resolveVersions({ [key]: pair[key] }), pair);
  }
  for (const key of Object.keys(LEGACY_VERSIONS)) {
    const mixed = { ...LEGACY_VERSIONS, [key]: ENCOUNTER_VERSIONS[key] };
    assert.throws(() => resolveVersions(mixed), /mismatched/);
  }
});

test('version dispatch rejects malformed, unknown, inherited and accessor input atomically', () => {
  let called = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'ruleset', {
    enumerable: true,
    get() {
      called++;
      return RULESET;
    },
  });
  for (const value of [
    null,
    true,
    [],
    'xonix-core.v3',
    '{}',
    { version: 'xonix-level.v2' },
    { ruleset: null },
    { ruleset: undefined },
    { ruleset: 'xonix-core.v1' },
    Object.create({ ruleset: RULESET }),
    accessor,
  ])
    assert.throws(() => resolveVersions(value));
  assert.equal(called, 0);
  const levelAccessor = {};
  Object.defineProperty(levelAccessor, 'version', {
    get() {
      called++;
      return 'xonix-level.v2';
    },
  });
  assert.throws(() => versionsForLevel(levelAccessor));
  const campaignAccessor = {};
  Object.defineProperty(campaignAccessor, 'levels', {
    get() {
      called++;
      return [];
    },
  });
  assert.throws(() => versionsForCampaign(campaignAccessor));
  assert.equal(called, 0);
});

test('campaign dispatch requires a nonempty dense uniformly versioned map list', () => {
  const old = { version: 'xonix-level.v1' },
    next = { version: 'xonix-level.v2' };
  assert.deepEqual(versionsForLevel(old), LEGACY_VERSIONS);
  assert.deepEqual(versionsForCampaign({ levels: [old, old] }), LEGACY_VERSIONS);
  assert.deepEqual(versionsForCampaign({ levels: [next, next] }), ENCOUNTER_VERSIONS);
  for (const levels of [
    [],
    [old, next],
    new Array(1),
    Array.from({ length: 129 }, () => old),
    [{ version: 'xonix-level.v0' }],
  ])
    assert.throws(() => versionsForCampaign({ levels }));
  let calls = 0;
  const entries = [old];
  Object.defineProperty(entries, 0, {
    get() {
      calls++;
      return old;
    },
  });
  assert.throws(() => versionsForCampaign({ levels: entries }));
  assert.equal(calls, 0);
});

for (const entry of fixture.cases)
  test(`${entry.id}: new version branch leaves frozen old normalization, state shape, events and checkpoints exact`, () => {
    const level = normalizedLevel(entry.level);
    const normalized = fixture.campaigns
      .find((campaign) => campaign.id === entry.campaignId)
      .levels.find((map) => map.id === entry.level.id);
    assert.equal(sha(level), normalized.normalizedSha256);
    const run = createRun(entry.level, { ...entry.options, classRecipes: fixture.roster.recipes });
    const keys = Object.keys(run),
      events = [];
    assert.equal(Object.hasOwn(run, 'encounter'), false);
    assert.equal(Object.hasOwn(run.level, 'encounter'), false);
    for (const segment of entry.segments) {
      if (segment.releaseBefore) releaseInputs(run);
      for (let tick = 0; tick < segment.ticks; tick++) {
        stepRun(run, segment.input, FIXED_DT);
        events.push(...run.events);
      }
    }
    if (entry.releaseAfter) releaseInputs(run);
    assert.deepEqual(Object.keys(run), keys);
    assert.equal(Object.hasOwn(getSummary(run), 'encounter'), false);
    assert.deepEqual(getSummary(run), entry.summary);
    assert.deepEqual(authoritativeCheckpoint(run), entry.checkpoint);
    assert.equal(sha(events), entry.eventsSha256);
  });
