import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizedLevel } from '../core/level.mjs';
import { dataIdentity } from '../data-json.mjs';
import { STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN, masteryDefinitionIdentity } from '../mastery.mjs';
import { resolveMasteryRecord } from '../mastery-records.mjs';
import { masteryFor, masteryText, pictureMasteries } from '../ui/mastery-view.mjs';

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
function record(definition = STEADY_SIGNAL) {
  const selected = fixture.cases.find(
    (entry) =>
      entry.campaignId === campaign.id &&
      entry.level.id === definition.levelId &&
      entry.options.classId ===
        { 'steady-signal': 'fiber', 'supply-line': 'bomber', 'safe-return': 'impact' }[
          definition.id
        ],
  );
  const {
    ruleset,
    seed,
    turnPolicy,
    classId,
    classRevision,
    loadoutHash,
    rosterHash,
    classHistory,
  } = selected.summary;
  return resolveMasteryRecord({
    format: 'xonix-mastery-record.v1',
    campaignKey: campaign.key,
    levelId: selected.level.id,
    levelRevision: selected.level.revision,
    levelIdentity: `level-v1-${dataIdentity(normalizedLevel(selected.level))}`,
    definitionId: definition.id,
    definitionRevision: definition.revision,
    definitionHash: masteryDefinitionIdentity(definition),
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
  assert.equal(masteryFor(campaign.key, 'homeward-02'), SUPPLY_LINE);
  assert.equal(masteryFor(campaign.key, 'homeward-03'), SAFE_RETURN);
  assert.equal(masteryFor(campaign.key, 'homeward-04'), null);
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

for (const definition of [SUPPLY_LINE, SAFE_RETURN])
  test(`${definition.name} metadata labels require its exact registered content`, () => {
    const value = record(definition);
    const item = { campaignKey: value.campaignKey, levelId: value.levelId };
    const before = structuredClone(value);
    const [view] = pictureMasteries([value], item, definition, [
      { id: 'bomber', label: 'Light carrier' },
      { id: 'carrier', label: 'Heavy carrier' },
      { id: 'impact', label: 'Impact craft' },
    ]);
    assert.equal(view.name, definition.name);
    assert.equal(
      view.route,
      definition === SUPPLY_LINE ? 'Light carrier → Heavy carrier' : 'Impact craft',
    );
    for (const edit of [
      (entry) => (entry.levelIdentity = 'level-v1-0000000000000000'),
      (entry) => (entry.definitionRevision = '2'),
      (entry) => (entry.setup.rosterHash = 'roster-v1-00000000'),
    ]) {
      const changed = structuredClone(value);
      edit(changed);
      assert.match(pictureMasteries([changed], item, definition)[0].name, /^Archived seal:/);
    }
    assert.match(pictureMasteries([value], item, null)[0].name, /^Archived seal:/);
    assert.deepEqual(value, before);
  });

test('Supply Line names each requirement and distinguishes pending cuts from banked crossings', () => {
  const preview = {
    cleanSoFar: false,
    predicates: [
      { type: 'supply-pickups', collectedPadIds: ['west-supply'] },
      {
        type: 'suppressed-region-crossings',
        regions: [
          { zoneId: 'west-emitter', bestClosedCells: 4, pendingCells: 0, satisfied: true },
          { zoneId: 'south-emitter', bestClosedCells: 0, pendingCells: 3, satisfied: false },
        ],
      },
      { type: 'hangar-switch', satisfied: true },
    ],
  };
  const before = structuredClone(preview);
  const detailed = masteryText(SUPPLY_LINE, preview);
  assert.match(detailed, /✓ West pad: collected/);
  assert.match(detailed, /○ South pad: collect supplies/);
  assert.match(detailed, /West signal region: 2 \/ 2 suppressed cells in one closed cut/);
  assert.match(detailed, /South signal region: 0 \/ 2.*3 on your open line/);
  assert.match(detailed, /✓ Switched to Heavy carrier at the south hangar/);
  assert.match(detailed, /Finish the mission/);
  assert.doesNotMatch(detailed, /no lives|life lost|retry|Route complete/);
  const compact = masteryText(SUPPLY_LINE, preview, { compact: true, practice: true });
  assert.match(compact, /^Practice goal/);
  assert.match(compact, /Pads 1 \/ 2 · closed signal regions 1 \/ 2 · carrier switch complete/);
  assert.doesNotMatch(compact, /\n|life lost/);
  assert.deepEqual(preview, before);
});

test('Safe Return describes the live-cut requirement, pending recovery and separate clean finish', () => {
  const fresh = masteryText(SAFE_RETURN, null);
  assert.match(fresh, /cut of 3\+ cells.*cable cutter/);
  assert.match(fresh, /Finish without losing a life/);
  assert.ok(fresh.indexOf('cut of 3+') < fresh.indexOf('Finish without losing'));
  for (const [phase, expected] of [
    ['not-started', /During a cut/],
    ['awaiting-return', /pulse landed; wait for the craft to return/],
    ['returned', /pulse complete; craft returned safely/],
  ]) {
    const preview = {
      cleanSoFar: false,
      predicates: [{ type: 'live-cut-impact', phase }],
    };
    assert.match(masteryText(SAFE_RETURN, preview), expected);
    assert.match(masteryText(SAFE_RETURN, preview), /Life lost; retry for this seal/);
    assert.match(masteryText(SAFE_RETURN, preview, { compact: true }), /life lost; retry/);
  }
  const complete = masteryText(SAFE_RETURN, {
    qualified: true,
    cleanSoFar: true,
    predicates: [
      { type: 'live-cut-impact', phase: 'returned' },
      { type: 'clean-win', satisfied: true },
    ],
  });
  assert.match(complete, /✓ Finished without losing a life/);
  assert.doesNotMatch(complete, /saved your life|destroyed|necessary/);
});

test('an ordinary win marks its independent finish requirement complete and keeps missing equipment visible', () => {
  const award = {
    status: 'unqualified',
    message: 'Picture collected. The optional seal is waiting for another route.',
  };
  const preview = {
    status: 'won',
    qualified: false,
    cleanSoFar: true,
    predicates: [
      { type: 'clean-win', satisfied: true },
      { type: 'live-cut-impact', phase: 'not-started', satisfied: false },
    ],
  };
  const impact = masteryText(SAFE_RETURN, preview, { award });
  assert.match(impact, /Picture collected/);
  assert.match(impact, /○ During a cut/);
  assert.match(impact, /✓ Finished without losing a life/);
  assert.doesNotMatch(impact, /○ Finish without/);
  const supply = masteryText(SUPPLY_LINE, { status: 'won', qualified: false }, { award });
  assert.match(supply, /○ West pad: collect supplies/);
  assert.match(supply, /✓ Mission complete/);
  assert.doesNotMatch(supply, /○ Finish the mission/);
});

test('equipment result states never confuse a preview, verification and a persisted award', () => {
  for (const definition of [SUPPLY_LINE, SAFE_RETURN]) {
    assert.match(masteryText(definition, null, { practice: true }), /^Practice goal/);
    assert.equal(
      masteryText(definition, null, { award: { status: 'checking', message: 'Checking replay…' } }),
      `${definition.name} · Checking replay…`,
    );
    assert.equal(
      masteryText(definition, null, {
        award: { status: 'session', message: 'Earned for this session only.' },
      }),
      'Earned for this session only.',
    );
    assert.equal(
      masteryText(definition, null, {
        compact: true,
        award: { status: 'earned', message: `${definition.name} earned and saved.` },
      }),
      `${definition.name} earned and saved.`,
    );
  }
});
