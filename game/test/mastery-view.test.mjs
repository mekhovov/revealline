import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizedLevel } from '../core/level.mjs';
import { dataIdentity } from '../data-json.mjs';
import { STEADY_SIGNAL, masteryDefinitionIdentity } from '../mastery.mjs';
import { resolveMasteryRecord } from '../mastery-records.mjs';
import { masteryFor, pictureMasteries } from '../ui/mastery-view.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/compatibility-v060.json', import.meta.url), 'utf8'),
);
const campaign = fixture.campaigns.find((entry) => entry.id === 'homeward-skies');
const route = fixture.cases.find(
  (entry) =>
    entry.campaignId === campaign.id &&
    entry.level.id === 'homeward-01' &&
    entry.options.classId === 'fiber',
);
const picture = { campaignKey: campaign.key, levelId: route.level.id };
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
  } = route.summary;
  return resolveMasteryRecord({
    format: 'xonix-mastery-record.v1',
    ...picture,
    levelRevision: route.level.revision,
    levelIdentity: `level-v1-${dataIdentity(normalizedLevel(route.level))}`,
    definitionId: STEADY_SIGNAL.id,
    definitionRevision: STEADY_SIGNAL.revision,
    definitionHash: masteryDefinitionIdentity(STEADY_SIGNAL),
    setup: {
      ruleset,
      seed,
      turnPolicy,
      classId,
      classRevision,
      loadoutHash,
      rosterHash,
      classHistory,
    },
    runId: 'metadata-view-test',
    earnedAt: '2026-09-12T12:00:00.000Z',
  });
}

test('built-in registration requires the exact reviewed campaign key and map', () => {
  assert.equal(campaign.key, 'homeward-skies/1/0d01f5687b3c38ff');
  assert.equal(masteryFor(campaign.key, picture.levelId), STEADY_SIGNAL);
  for (const key of [
    'homeward-skies',
    'homeward-skies/2/0d01f5687b3c38ff',
    'homeward-skies/1/0000000000000000',
    'other/1/0d01f5687b3c38ff',
    null,
    undefined,
  ])
    assert.equal(masteryFor(key, picture.levelId), null, `Not the registered board: ${key}`);
  assert.equal(masteryFor(campaign.key, 'homeward-02'), null);
});

test('archived Homeward metadata recognizes the current goal in both steering modes', () => {
  const value = record();
  assert.equal(value.levelIdentity, 'level-v1-5983ec4eaf745012');
  assert.equal(value.setup.rosterHash, 'roster-v1-e159e435');
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const input = structuredClone(value);
    input.setup.turnPolicy = turnPolicy;
    const [view] = pictureMasteries([input], picture, STEADY_SIGNAL);
    assert.equal(view.name, 'Steady Signal');
    assert.equal(view.steering, turnPolicy === 'immediate' ? 'Immediate' : 'Grid + buffer');
  }
});

for (const [field, alter] of [
  ['definition ID', (value) => (value.definitionId = 'different-goal')],
  ['definition revision', (value) => (value.definitionRevision = '77')],
  ['definition hash', (value) => (value.definitionHash = 'mastery-v1-0000000000000000')],
  ['normalized map identity', (value) => (value.levelIdentity = 'level-v1-0000000000000000')],
  ['map revision', (value) => (value.levelRevision = '2')],
  ['equipment roster', (value) => (value.setup.rosterHash = 'roster-v1-00000000')],
])
  test(`imported metadata with a different ${field} is preserved as archived`, () => {
    const value = record();
    alter(value);
    const accepted = resolveMasteryRecord(value),
      before = structuredClone(accepted);
    const views = pictureMasteries([accepted], picture, STEADY_SIGNAL);
    assert.equal(views.length, 1);
    assert.equal(views[0].name, `Archived seal: ${accepted.definitionId}`);
    assert.deepEqual(accepted, before);
  });

test('unknown rules and coherently changed definitions cannot be labeled as the current seal', () => {
  const future = record();
  // The current library rejects unsupported rules. The view still must not
  // mistake future metadata for this known core-v2 content if supplied later.
  future.setup.ruleset = 'xonix-core.v3';
  assert.match(pictureMasteries([future], picture, STEADY_SIGNAL)[0].name, /^Archived seal:/);
  const revised = { ...STEADY_SIGNAL, revision: '2', name: 'Revised goal' },
    value = record();
  value.definitionRevision = revised.revision;
  value.definitionHash = masteryDefinitionIdentity(revised);
  assert.match(pictureMasteries([value], picture, revised)[0].name, /^Archived seal:/);
  assert.match(pictureMasteries([record()], picture, null)[0].name, /^Archived seal:/);
});

test('different campaign variants stay separate, even when IDs and a definition hash are reused', () => {
  const value = record(),
    changedPicture = { ...picture, campaignKey: 'homeward-skies/2/0000000000000000' },
    changedRecord = { ...value, campaignKey: changedPicture.campaignKey };
  assert.deepEqual(pictureMasteries([changedRecord], picture, STEADY_SIGNAL), []);
  assert.deepEqual(pictureMasteries([value], changedPicture, STEADY_SIGNAL), []);
  assert.deepEqual(
    pictureMasteries([value], { ...picture, levelId: 'homeward-02' }, STEADY_SIGNAL),
    [],
  );
  assert.match(
    pictureMasteries([changedRecord], changedPicture, STEADY_SIGNAL)[0].name,
    /^Archived seal:/,
  );
  assert.deepEqual(pictureMasteries(null, picture, STEADY_SIGNAL), []);
});

test('friendly recipe labels and unknown-ID fallbacks preserve record data and output ownership', () => {
  const value = record();
  value.setup.classHistory.push({
    classId: 'archived-craft',
    classRevision: '1',
    loadoutHash: 'loadout-v1-00000000',
    tick: 120,
  });
  value.definitionRevision = '2';
  const before = structuredClone(value),
    recipes = [{ id: 'fiber', label: 'Fiber craft' }];
  const [view] = pictureMasteries([value], picture, STEADY_SIGNAL, recipes);
  assert.equal(view.route, 'Fiber craft → archived-craft');
  assert.equal(view.seed, route.options.seed);
  assert.equal(view.earnedAt, value.earnedAt);
  view.route = 'Changed display';
  assert.deepEqual(value, before);
  assert.equal(
    pictureMasteries([value], picture, STEADY_SIGNAL, recipes)[0].route,
    'Fiber craft → archived-craft',
  );
});
