import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import {
  PROGRESS_VERSION,
  emptyProgress,
  awardCompletion,
  validateProgress,
  appearanceMilestones,
  unlockedBodies,
  newAppearanceBodies,
  achievements,
  canPlay,
} from '../progress.mjs';

const STARTERS = [
  'fpv-body',
  'scout-quad',
  'heavy-lift',
  'ukrainian-bird',
  'retro-craft',
  'navi-avatar',
  'neutral-marker',
];
const FIRST = ['fpv-racer', 'fixedwing-body', 'ukrainian-falcon', 'retro-vector', 'navi-auditor'];
const FINAL = ['fpv-night', 'delta-interceptor'];
const ALL = [...STARTERS, ...FIRST, ...FINAL];
function chapter(length) {
  return {
    version: 'xonix-campaign.v1',
    id: 'appearance-fixture',
    revision: '1',
    levels: Array.from({ length }, (_, i) => ({
      version: 'xonix-level.v1',
      id: `map-${i + 1}`,
      revision: '1',
      name: `Map ${i + 1}`,
      width: 48,
      height: 36,
      spawn: { x: 24.5, y: 0.5 },
      walls: [],
      enemies: [{ id: 'east', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
      objectives: [],
      supplies: [],
      goal: { coverage: 0.3 },
    })),
  };
}
function result(campaign, index, options = {}) {
  const state = createRun(campaign.levels[index], options);
  for (let tick = 0; tick < 2000 && state.status === 'running'; tick++)
    stepRun(state, { direction: 'down' }, FIXED_DT);
  assert.equal(state.status, 'won');
  return getSummary(state);
}
const win = (before, campaign, index, options = {}) =>
  awardCompletion(before, campaign, result(campaign, index, options), {
    runId: `${index}-${options.turnPolicy ?? 'immediate'}-${options.seed ?? 1}-${options.classId ?? 'scout'}`,
  });
const byId = (values, id) => values.find((value) => value.id === id);

for (const length of [1, 2, 3, 4, 12])
  test(`${length}-map campaign has attainable, distinct-clear appearance and achievement thresholds`, () => {
    const campaign = chapter(length);
    let progress = emptyProgress(campaign);
    for (let count = 0; count <= length; count++) {
      const rows = appearanceMilestones(progress, campaign);
      assert.deepEqual(rows, [
        {
          id: 'first-clear',
          name: 'First clear',
          bodyIds: FIRST,
          count,
          target: 1,
          earned: count >= 1,
        },
        {
          id: 'chapter-explorer',
          name: 'Chapter explorer',
          bodyIds: FINAL,
          count,
          target: Math.min(4, length),
          earned: count >= Math.min(4, length),
        },
      ]);
      assert.deepEqual(
        [...unlockedBodies(progress, campaign)],
        [...STARTERS, ...(count >= 1 ? FIRST : []), ...(count >= Math.min(4, length) ? FINAL : [])],
      );
      const badges = achievements(progress, campaign);
      assert.deepEqual(
        badges.map((badge) => badge.id),
        ['first-light', 'clear-skies', 'pathfinder', 'golden-line', 'last-light'],
      );
      assert.equal(byId(badges, 'pathfinder').earned, count >= Math.min(4, length));
      assert.equal(
        byId(badges, 'pathfinder').description,
        `Complete ${Math.min(4, length)} different ${length === 1 ? 'mission' : 'missions'} in this campaign.`,
      );
      assert.equal(byId(badges, 'last-light').earned, count === length);
      assert.equal(byId(badges, 'first-light').earned, count >= 1);
      assert.equal(byId(badges, 'clear-skies').earned, count >= 1);
      assert.equal(byId(badges, 'golden-line').earned, count >= 1);
      if (count < length) progress = win(progress, campaign, count);
    }
    assert.equal(validateProgress(progress, campaign), true);
  });

test('duplicate declared map IDs neither raise the target nor count a clear twice', () => {
  const original = chapter(2);
  const campaign = {
    ...original,
    levels: [
      original.levels[0],
      original.levels[0],
      original.levels[1],
      original.levels[1],
      original.levels[1],
    ],
  };
  let progress = win(emptyProgress(campaign), campaign, 0);
  assert.deepEqual(
    appearanceMilestones(progress, campaign).map((row) => [row.count, row.target, row.earned]),
    [
      [1, 1, true],
      [1, 2, false],
    ],
  );
  assert.equal(byId(achievements(progress, campaign), 'last-light').earned, false);
  progress = win(progress, campaign, 2);
  assert.equal(appearanceMilestones(progress, campaign)[1].earned, true);
  assert.equal(byId(achievements(progress, campaign), 'last-light').earned, true);
});

test('unknown clear keys supply neither cosmetic progress nor clean/gold achievements', () => {
  const campaign = chapter(3),
    progress = emptyProgress(campaign);
  const foreign = win(emptyProgress(chapter(4)), chapter(4), 3).clears['map-4'];
  for (const id of ['outside-a', 'outside-b', 'outside-c', 'outside-d'])
    progress.clears[id] = foreign;
  Object.defineProperty(progress.clears, 'unknown-accessor', {
    enumerable: true,
    get() {
      assert.fail('Unknown clear values must not be read');
    },
  });
  assert.deepEqual([...unlockedBodies(progress, campaign)], STARTERS);
  assert.ok(
    appearanceMilestones(progress, campaign).every((row) => row.count === 0 && !row.earned),
  );
  assert.ok(achievements(progress, campaign).every((badge) => !badge.earned));
  assert.deepEqual(newAppearanceBodies(progress, progress, campaign), []);
});

test('different seeds, classes and both turn policies remain one map clear', () => {
  const campaign = chapter(3);
  let progress = emptyProgress(campaign);
  for (const options of [{}, { seed: 2 }, { turnPolicy: 'grid-center' }, { classId: 'carrier' }])
    progress = win(progress, campaign, 0, options);
  assert.equal(Object.keys(progress.clears['map-1'].variants).length, 4);
  assert.equal(appearanceMilestones(progress, campaign)[1].count, 1);
  assert.equal(appearanceMilestones(progress, campaign)[1].earned, false);
  assert.equal(byId(achievements(progress, campaign), 'last-light').earned, false);
});

test('legacy one-argument API preserves starter order and exact one/four thresholds', () => {
  for (const count of [0, 1, 2, 3, 4, 12]) {
    const progress = {
      clears: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), {}])),
    };
    const expected = [...STARTERS, ...(count >= 1 ? FIRST : []), ...(count >= 4 ? FINAL : [])];
    assert.deepEqual([...unlockedBodies(progress)], expected);
    assert.deepEqual([...unlockedBodies(progress, undefined)], expected);
  }
});

test('four-clear campaigns retain every existing starter and reward body', () => {
  for (const length of [4, 12]) {
    const campaign = chapter(length);
    let progress = emptyProgress(campaign);
    for (let i = 0; i < 4; i++) progress = win(progress, campaign, i);
    assert.deepEqual([...unlockedBodies(progress, campaign)], ALL);
    assert.deepEqual(unlockedBodies(progress, campaign), unlockedBodies(progress));
    assert.equal(byId(achievements(progress, campaign), 'last-light').earned, length === 4);
  }
});

test('owned results do not mutate progress, campaign, future tier definitions or caller body sets', () => {
  const campaign = chapter(3),
    progress = win(emptyProgress(campaign), campaign, 0);
  const before = structuredClone({ progress, campaign });
  const rows = appearanceMilestones(progress, campaign),
    allowed = unlockedBodies(progress, campaign);
  rows[0].bodyIds.push('invented');
  rows[1].target = 0;
  rows.push({ id: 'invented' });
  allowed.clear();
  achievements(progress, campaign)[0].earned = false;
  assert.deepEqual({ progress, campaign }, before);
  assert.deepEqual(appearanceMilestones(progress, campaign)[0].bodyIds, FIRST);
  assert.equal(appearanceMilestones(progress, campaign)[1].target, 3);
  assert.deepEqual([...unlockedBodies(progress, campaign)], [...STARTERS, ...FIRST]);
});

test('nonempty valid campaign projection and matching progress identity are required', () => {
  const campaign = chapter(3),
    progress = emptyProgress(campaign);
  for (const invalid of [
    undefined,
    null,
    {},
    { ...campaign, version: 'other' },
    { ...campaign, id: '' },
    { ...campaign, revision: '' },
    { ...campaign, levels: [] },
    { ...campaign, levels: [{ id: '' }] },
    { ...campaign, levels: [{ id: 'constructor' }] },
    { ...campaign, levels: new Array(2) },
    { ...campaign, levels: Array(129).fill(campaign.levels[0]) },
  ]) {
    assert.throws(() => appearanceMilestones(progress, invalid), TypeError);
    assert.throws(() => achievements(progress, invalid), TypeError);
    assert.throws(() => newAppearanceBodies(progress, progress, invalid), TypeError);
    if (invalid !== undefined) assert.throws(() => unlockedBodies(progress, invalid), TypeError);
  }
  for (const mismatch of [
    { ...progress, campaignId: 'other' },
    { ...progress, revision: '2' },
    { ...progress, version: 'other' },
  ]) {
    assert.throws(() => appearanceMilestones(mismatch, campaign), /identity/);
    assert.throws(() => unlockedBodies(mismatch, campaign), /identity/);
    assert.throws(() => newAppearanceBodies(progress, mismatch, campaign), /identity/);
  }
});

test('projection rejects consumed accessors without executing them or validating unrelated physics', () => {
  const campaign = chapter(1),
    progress = emptyProgress(campaign);
  let executed = 0;
  const altered = { ...campaign };
  Object.defineProperty(altered, 'levels', {
    enumerable: true,
    get() {
      executed++;
      return campaign.levels;
    },
  });
  assert.throws(() => appearanceMilestones(progress, altered), /own data field/);
  const plainProjection = { ...campaign, levels: [{ id: 'map-1' }] };
  Object.defineProperty(plainProjection.levels[0], 'enemies', {
    get() {
      executed++;
      return [];
    },
  });
  assert.equal(appearanceMilestones(progress, plainProjection)[1].target, 1);
  const won = win(progress, campaign, 0);
  Object.defineProperty(won.clears['map-1'], 'medals', {
    get() {
      executed++;
      return 3;
    },
  });
  assert.throws(() => appearanceMilestones(won, campaign), /own data field/);
  assert.equal(executed, 0);
});

test('existing complete short-chapter saves gain availability without schema or notification history changes', () => {
  const campaign = chapter(3);
  let progress = emptyProgress(campaign);
  for (let i = 0; i < 3; i++) progress = win(progress, campaign, i);
  const saved = JSON.stringify(progress),
    restored = JSON.parse(saved);
  assert.equal(validateProgress(restored, campaign), true);
  assert.equal(restored.version, PROGRESS_VERSION);
  assert.deepEqual([...unlockedBodies(restored, campaign)], ALL);
  assert.equal(unlockedBodies(restored).has('fpv-night'), false);
  assert.deepEqual(newAppearanceBodies(restored, restored, campaign), []);
  assert.equal(JSON.stringify(restored), saved);
  assert.deepEqual(Object.keys(restored), ['version', 'campaignId', 'revision', 'clears', 'seen']);
});

test('real live transitions return each newly crossed tier once, including two tiers in one-map chapters', () => {
  const campaign = chapter(3),
    empty = emptyProgress(campaign);
  const first = win(empty, campaign, 0),
    second = win(first, campaign, 1),
    last = win(second, campaign, 2);
  assert.deepEqual(newAppearanceBodies(empty, first, campaign), FIRST);
  assert.deepEqual(newAppearanceBodies(first, second, campaign), []);
  assert.deepEqual(newAppearanceBodies(second, last, campaign), FINAL);
  assert.deepEqual(newAppearanceBodies(last, win(last, campaign, 2, { seed: 9 }), campaign), []);
  assert.deepEqual(newAppearanceBodies(last, empty, campaign), []);
  const one = chapter(1),
    before = emptyProgress(one),
    after = win(before, one, 0);
  assert.deepEqual(newAppearanceBodies(before, after, one), [...FIRST, ...FINAL]);
});

test('practice and already-consumed completions leave transition projection empty', () => {
  const campaign = chapter(1),
    before = emptyProgress(campaign),
    summary = result(campaign, 0);
  const practice = awardCompletion(before, campaign, summary, {
    runId: 'practice',
    practice: true,
  });
  assert.equal(practice, before);
  assert.deepEqual(newAppearanceBodies(before, practice, campaign), []);
  const earned = awardCompletion(before, campaign, summary, { runId: 'once' });
  const repeated = awardCompletion(earned, campaign, summary, { runId: 'once' });
  assert.equal(repeated, earned);
  assert.deepEqual(newAppearanceBodies(earned, repeated, campaign), []);
});

test('an out-of-order real clear remains replayable while uncleared predecessors and bounds stay guarded', () => {
  const campaign = chapter(4),
    before = emptyProgress(campaign);
  const after = win(before, campaign, 2);
  assert.equal(validateProgress(after, campaign), true);
  assert.equal(canPlay(after, campaign, 0), true);
  assert.equal(canPlay(after, campaign, 1), false);
  assert.equal(canPlay(after, campaign, 2), true);
  assert.equal(canPlay(after, campaign, 3), true);
  for (const index of [-1, 4, 1.5, '2', null, NaN, Infinity])
    assert.equal(canPlay(after, campaign, index), false);
  const inherited = { ...before, clears: Object.create(after.clears) };
  assert.equal(canPlay(inherited, campaign, 2), false);
  assert.equal(canPlay(inherited, campaign, 3), false);
});
