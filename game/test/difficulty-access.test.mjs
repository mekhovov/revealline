import test from 'node:test';
import assert from 'node:assert/strict';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { difficultyAccess, newDifficultyAppearanceBodies } from '../difficulty-access.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import {
  emptyProgress,
  awardCompletion,
  appearanceMilestones,
  unlockedBodies,
} from '../progress.mjs';
import { emptyLibrary, validateLibrary } from '../library.mjs';

const chapter = (count) => ({
  version: 'xonix-campaign.v1',
  id: 'access-chapter',
  revision: '1',
  levels: Array.from({ length: count }, (_, i) => ({
    version: 'xonix-level.v1',
    id: `map-${i + 1}`,
    revision: '1',
    name: `Map ${i + 1}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    enemies: [{ id: 'east', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0 }],
    goal: { coverage: 0.3 },
  })),
});
const clone = (value) => structuredClone(value);
function addWin(progresses, context, index, runId) {
  const run = createRun(context.campaign.levels[index]);
  for (let i = 0; i < 2000 && run.status === 'running'; i++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  progresses[context.campaignKey] = awardCompletion(
    progresses[context.campaignKey] ?? emptyProgress(context.campaign),
    context.campaign,
    getSummary(run),
    { runId },
  );
}

for (const count of [1, 2, 3, 4, 12])
  test(`${count}-map mixed-mode chapters share only attainable distinct-clear access and appearances`, () => {
    const base = chapter(count),
      modes = ['standard', 'gentle'].map((m) => createDifficultyContext(base, m)),
      progresses = {};
    const empty = difficultyAccess(base, progresses);
    assert.equal(empty.count, 0);
    assert.equal(empty.nextLevelIndex, 0);
    assert.deepEqual(empty.unlockedBodyIds, [...unlockedBodies(emptyProgress(base), base)]);
    let previous = {};
    for (let i = 0; i < count; i++) {
      addWin(progresses, modes[i % 2], i, `run-${i}`);
      const before = JSON.stringify(progresses),
        access = difficultyAccess(base, progresses);
      assert.equal(access.count, i + 1);
      assert.equal(access.total, count);
      assert.equal(access.complete, i === count - 1);
      assert.equal(access.nextLevelIndex, i === count - 1 ? null : i + 1);
      assert.equal(access.milestones[0].earned, true);
      assert.equal(access.milestones[1].earned, i + 1 >= Math.min(4, count));
      const delta = newDifficultyAppearanceBodies(base, previous, progresses);
      const expected = new Set(difficultyAccess(base, previous).unlockedBodyIds);
      assert.deepEqual(
        delta,
        access.unlockedBodyIds.filter((id) => !expected.has(id)),
      );
      assert.equal(JSON.stringify(progresses), before);
      assert.equal(Object.hasOwn(access, 'clears'), false);
      assert.equal(Object.hasOwn(access, 'scores'), false);
      assert.equal(Object.hasOwn(access, 'seen'), false);
      previous = clone(progresses);
    }
    const completed = difficultyAccess(base, progresses);
    addWin(progresses, modes[1], 0, 'second-mode-revisit');
    assert.equal(difficultyAccess(base, progresses).count, count);
    assert.deepEqual(newDifficultyAppearanceBodies(base, previous, progresses), []);
    assert.deepEqual(difficultyAccess(base, progresses).unlockedBodyIds, completed.unlockedBodyIds);
  });

test('out-of-order Gentle clears remain replayable and do not open unrelated missing predecessors', () => {
  const base = chapter(4),
    gentle = createDifficultyContext(base, 'gentle'),
    progresses = {};
  addWin(progresses, gentle, 2, 'third-only');
  const access = difficultyAccess(base, progresses);
  assert.deepEqual(
    access.levels.map((l) => l.playable),
    [true, false, true, true],
  );
  assert.deepEqual(
    access.levels.map((l) => [l.standardCleared, l.gentleCleared]),
    [
      [false, false],
      [false, false],
      [false, true],
      [false, false],
    ],
  );
  assert.equal(access.nextLevelIndex, 0);
});

test('Standard-only access matches existing rewards without mixing or rewriting either mode statistics', () => {
  const base = chapter(3),
    standard = createDifficultyContext(base),
    gentle = createDifficultyContext(base, 'gentle'),
    progresses = {};
  addWin(progresses, standard, 0, 'standard-clear');
  assert.deepEqual(
    difficultyAccess(base, progresses).milestones,
    appearanceMilestones(progresses[standard.campaignKey], base),
  );
  const original = JSON.stringify(progresses[standard.campaignKey]);
  addWin(progresses, gentle, 0, 'gentle-clear');
  addWin(progresses, gentle, 1, 'gentle-next');
  const before = JSON.stringify(progresses),
    access = difficultyAccess(base, progresses);
  assert.equal(JSON.stringify(progresses), before);
  assert.equal(JSON.stringify(progresses[standard.campaignKey]), original);
  assert.equal(access.count, 2);
  assert.equal(access.levels[0].standardCleared, true);
  assert.equal(access.levels[0].gentleCleared, true);
  assert.throws(() => access.completedLevelIds.push('map-3'), TypeError);
  assert.throws(() => {
    access.levels[0].completed = false;
  }, TypeError);
  assert.throws(() => access.milestones[0].bodyIds.pop(), TypeError);
});

test('unknown IDs and old campaign revisions cannot grant shared access', () => {
  const base = chapter(3),
    gentle = createDifficultyContext(base, 'gentle'),
    progresses = {};
  addWin(progresses, gentle, 0, 'valid');
  progresses[gentle.campaignKey].clears.unknown = clone(
    progresses[gentle.campaignKey].clears['map-1'],
  );
  assert.equal(difficultyAccess(base, progresses).count, 1);
  const changed = clone(base);
  changed.levels[0].rules = { moveSpeed: 9 };
  assert.equal(difficultyAccess(changed, progresses).count, 0);
  const changedContext = createDifficultyContext(changed, 'gentle');
  progresses[changedContext.campaignKey] = clone(progresses[gentle.campaignKey]);
  assert.throws(() => difficultyAccess(changed, progresses), /does not match/);
});

test('access rejects malformed selected progress without getter execution and ignores unrelated contexts', () => {
  const base = chapter(1),
    standard = createDifficultyContext(base),
    progresses = {};
  let calls = 0;
  Object.defineProperty(progresses, 'unrelated/1/0000000000000000', {
    get() {
      calls++;
      return {};
    },
  });
  assert.equal(difficultyAccess(base, progresses).count, 0);
  Object.defineProperty(progresses, standard.campaignKey, {
    enumerable: true,
    get() {
      calls++;
      return {};
    },
  });
  assert.throws(() => difficultyAccess(base, progresses), /own JSON/);
  assert.equal(calls, 0);
  for (const value of [null, [], Object.create({})])
    assert.throws(() => difficultyAccess(base, value));
  const invalid = emptyProgress(base);
  invalid.campaignId = 'other';
  assert.throws(
    () => difficultyAccess(base, { [standard.campaignKey]: invalid }),
    /does not match/,
  );
  const getter = emptyProgress(base);
  Object.defineProperty(getter, 'clears', {
    enumerable: true,
    get() {
      calls++;
      return {};
    },
  });
  assert.throws(() => difficultyAccess(base, { [standard.campaignKey]: getter }));
  assert.equal(calls, 0);
});

test('selected access statistics respect the retained library time, score and variant bounds', () => {
  const base = chapter(1),
    standard = createDifficultyContext(base),
    progresses = {};
  addWin(progresses, standard, 0, 'real-win');
  const mutations = [
    (clear) => {
      clear.time = 7201;
    },
    (clear) => {
      clear.score = 1e9 + 1;
    },
    (clear) => {
      Object.values(clear.variants)[0].time = 7201;
    },
    (clear) => {
      clear.unexpected = true;
    },
    (clear) => {
      const [key, value] = Object.entries(clear.variants)[0];
      clear.variants = Object.fromEntries(
        Array.from({ length: 257 }, (_, i) => {
          const parts = key.split('/');
          parts[4] = String(i);
          return [parts.join('/'), clone(value)];
        }),
      );
    },
  ];
  for (const mutate of mutations) {
    const bad = clone(progresses);
    mutate(bad[standard.campaignKey].clears['map-1']);
    assert.equal(validateLibrary({ ...emptyLibrary(), campaigns: bad }).valid, false);
    assert.throws(() => difficultyAccess(base, bad));
  }
  const atLimit = clone(progresses),
    clear = atLimit[standard.campaignKey].clears['map-1'];
  clear.time = 7200;
  clear.score = 1e9;
  assert.equal(validateLibrary({ ...emptyLibrary(), campaigns: atLimit }).valid, true);
  assert.equal(difficultyAccess(base, atLimit).count, 1);
});
