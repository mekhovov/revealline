import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, FIXED_DT, stepRun, getSummary } from '../core/index.mjs';
import { CLASSES, DEFAULT_RULES, RULESET, loadoutHash } from '../core/registry.mjs';
import { EPS } from '../core/geometry.mjs';
import {
  emptyProgress,
  validateProgress,
  awardCompletion,
  canPlay,
  achievements,
  unlockedBodies,
  loadProgress,
  saveProgress,
} from '../progress.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'first',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'right', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'fixture',
  revision: '1',
  levels: [level, { ...level, id: 'second' }],
};
function completion(overrides = {}) {
  const recipe = CLASSES.find((c) => c.id === (overrides.classId ?? 'scout')) ?? CLASSES[0];
  return {
    ruleset: RULESET,
    levelId: level.id,
    revision: level.revision,
    seed: 1,
    turnPolicy: 'immediate',
    classId: 'scout',
    classRevision: recipe.revision,
    loadoutHash: loadoutHash(recipe),
    status: 'won',
    won: true,
    time: 30,
    lives: 3,
    score: 100,
    coverage: 0.6,
    medal: 'gold',
    ...overrides,
  };
}
const variantKey = (result) =>
  `${result.turnPolicy}/${result.classId}/${encodeURIComponent(result.classRevision)}/${result.loadoutHash}/${result.seed}`;
function storage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test('actual core win on a level with default rules awards once without mutating inputs', () => {
  const state = createRun(level, { turnPolicy: 'grid-center' });
  for (let i = 0; i < 900 && state.status === 'running'; i++)
    stepRun(state, { direction: 'down' }, FIXED_DT);
  assert.equal(state.status, 'won');
  const result = getSummary(state),
    before = emptyProgress(campaign),
    copy = structuredClone(before);
  const awarded = awardCompletion(before, campaign, result, { runId: 'actual-core-win' });
  assert.deepEqual(before, copy);
  assert.notEqual(awarded, before);
  assert.equal(awarded.clears.first.clean, true);
  assert.equal(awarded.clears.first.medals, 3);
  assert.equal(validateProgress(awarded, campaign), true);
  assert.equal(awardCompletion(awarded, campaign, result, { runId: 'actual-core-win' }), awarded);
});

test('malformed clear containers, variant records and seen IDs cannot load as valid progress', () => {
  const empty = emptyProgress(campaign);
  for (const clears of [7, true, [], null, 'text'])
    assert.equal(validateProgress({ ...empty, clears }, campaign), false);
  const good = awardCompletion(empty, campaign, completion(), { runId: 'a' });
  assert.equal(validateProgress(good, campaign), true);
  for (const variants of [
    null,
    [],
    {},
    7,
    { 'immediate/scout/1': { score: 0, time: 0, medals: 3, clean: 'yes' } },
    { 'immediate/unknown/1': { score: 0, time: 0, medals: 3, clean: true } },
  ]) {
    const bad = structuredClone(good);
    bad.clears.first.variants = variants;
    assert.equal(validateProgress(bad, campaign), false);
  }
  assert.equal(validateProgress({ ...empty, seen: ['a', 'a'] }, campaign), false);
  assert.equal(validateProgress({ ...empty, seen: [''] }, campaign), false);
  assert.equal(
    validateProgress(
      { ...empty, seen: Array.from({ length: 257 }, (_, i) => String(i)) },
      campaign,
    ),
    false,
  );
  assert.equal(validateProgress({ ...empty, revision: 'old' }, campaign), false);
});

test('practice, losing, absent and already consumed results grant no progress', () => {
  const empty = emptyProgress(campaign),
    result = completion();
  assert.equal(
    awardCompletion(empty, campaign, result, { runId: 'practice', practice: true }),
    empty,
  );
  for (const value of [
    null,
    undefined,
    {},
    completion({ practice: true }),
    completion({ status: 'lost', won: false }),
    completion({ won: false }),
  ])
    assert.equal(awardCompletion(empty, campaign, value, { runId: 'invalid' }), empty);
  assert.equal(awardCompletion(empty, campaign, result, {}), empty);
  const first = awardCompletion(empty, campaign, result, { runId: 'once' });
  assert.equal(
    awardCompletion(first, campaign, completion({ score: 9000 }), { runId: 'once' }),
    first,
  );
  assert.equal(unlockedBodies(empty).has('fpv-racer'), false);
  assert.equal(unlockedBodies(first).has('fpv-racer'), true);
});

test('completion identity, ranges and medal coherence match the current core contract', () => {
  const empty = emptyProgress(campaign);
  for (const change of [
    { ruleset: 'study' },
    { revision: 'older' },
    { levelId: 'unknown' },
    { classId: 'invented' },
    { classRevision: 'old' },
    { loadoutHash: 'loadout-v1-00000000' },
    { turnPolicy: 'diagonal' },
    { seed: -1 },
    { seed: 2 ** 32 },
    { score: Infinity },
    { time: -1 },
    { coverage: 0.2 },
    { coverage: 1.1 },
    { lives: 0 },
    { lives: 4 },
    { medal: 'bronze' },
  ])
    assert.equal(
      awardCompletion(empty, campaign, completion(change), { runId: 'bad' }),
      empty,
      JSON.stringify(change),
    );
  const threshold = DEFAULT_RULES.timeMedals[0];
  const edge = awardCompletion(
    empty,
    campaign,
    completion({ time: threshold + EPS / 2, medal: 'gold' }),
    { runId: 'edge' },
  );
  assert.equal(edge.clears.first.medals, 3);
  const silver = awardCompletion(
    empty,
    campaign,
    completion({ time: threshold + EPS * 2, medal: 'silver' }),
    { runId: 'silver' },
  );
  assert.equal(silver.clears.first.medals, 2);
  const damaged = awardCompletion(empty, campaign, completion({ lives: 2, medal: 'silver' }), {
    runId: 'damaged',
  });
  assert.equal(damaged.clears.first.clean, false);
});

test('replays preserve best records per setup and keep turn policies and classes separate', () => {
  const first = awardCompletion(emptyProgress(campaign), campaign, completion(), {
    runId: 'first',
  });
  const slower = awardCompletion(
    first,
    campaign,
    completion({ score: 50, time: 120, medal: 'silver', lives: 2 }),
    { runId: 'slower' },
  );
  assert.deepEqual(
    slower.clears.first.variants[variantKey(completion())],
    first.clears.first.variants[variantKey(completion())],
  );
  const grid = awardCompletion(
    slower,
    campaign,
    completion({ turnPolicy: 'grid-center', classId: 'carrier', score: 150 }),
    { runId: 'grid' },
  );
  assert.equal(Object.keys(grid.clears.first.variants).length, 2);
  assert.equal(grid.clears.first.score, 150);
  assert.equal(grid.clears.first.time, 30);
  assert.equal(Object.keys(grid.clears).length, 1);
  assert.equal(achievements(grid, campaign).find((a) => a.id === 'last-light').earned, false);
});

test('tuned recipe identity separates setup records while labels do not change physics identity', () => {
  const original = completion({ classId: 'carrier' }),
    first = awardCompletion(emptyProgress(campaign), campaign, original, { runId: 'original' });
  const recipes = CLASSES.map((c) =>
    c.id === 'carrier' ? { ...c, capacity: 3, revision: '2/custom' } : { ...c },
  );
  const tuned = { ...campaign, classRecipes: recipes },
    recipe = recipes.find((c) => c.id === 'carrier');
  assert.equal(validateProgress(first, tuned), true);
  assert.equal(awardCompletion(first, tuned, original, { runId: 'stale-result' }), first);
  const result = completion({
    classId: 'carrier',
    classRevision: recipe.revision,
    loadoutHash: loadoutHash(recipe),
    score: 200,
  });
  const second = awardCompletion(first, tuned, result, { runId: 'tuned' });
  assert.equal(Object.keys(second.clears.first.variants).length, 2);
  assert.deepEqual(
    second.clears.first.variants[variantKey(original)],
    first.clears.first.variants[variantKey(original)],
  );
  assert.equal(validateProgress(second, tuned), true);
  const labelled = {
    ...tuned,
    classRecipes: recipes.map((c) => ({
      ...c,
      label: `Look ${c.label}`,
      description: 'Presentation words changed',
    })),
  };
  const third = awardCompletion(second, labelled, result, { runId: 'labels-only' });
  assert.equal(Object.keys(third.clears.first.variants).length, 2);
  const custom = { ...recipe, id: 'parcel-special' },
    customCampaign = { ...campaign, classRecipes: [custom] };
  const customResult = completion({
    classId: custom.id,
    classRevision: custom.revision,
    loadoutHash: loadoutHash(custom),
  });
  assert.equal(
    validateProgress(
      awardCompletion(emptyProgress(customCampaign), customCampaign, customResult, {
        runId: 'custom',
      }),
      customCampaign,
    ),
    true,
  );
});

test('campaign sequencing checks real indices and own clear records', () => {
  const empty = emptyProgress(campaign);
  assert.equal(canPlay(empty, campaign, 0), true);
  assert.equal(canPlay(empty, campaign, 1), false);
  for (const index of [-1, 2, 1.5, '0']) assert.equal(canPlay(empty, campaign, index), false);
  const next = awardCompletion(empty, campaign, completion(), { runId: 'clear' });
  assert.equal(canPlay(next, campaign, 1), true);
  const special = {
    ...campaign,
    levels: [
      { ...level, id: 'constructor' },
      { ...level, id: 'after' },
    ],
  };
  assert.equal(canPlay(emptyProgress(special), special, 1), false);
});

test('corrupt saves remain available for recovery and round-trip valid saves', () => {
  const store = storage(),
    key = 'game';
  store.setItem(key, '{broken');
  const loaded = loadProgress(store, key, campaign);
  assert.equal(loaded.recovery, '{broken');
  assert.ok(loaded.warning);
  assert.deepEqual(loaded.progress, emptyProgress(campaign));
  const result = saveProgress(store, key, loaded.progress, loaded.recovery);
  assert.equal(result.ok, true);
  const backup = [...store.map].find(([name]) => name.startsWith('game.recovery.'));
  assert.equal(backup[1], '{broken');
  const read = loadProgress(store, key, campaign);
  assert.equal(read.warning, '');
  assert.equal(read.recovery, null);
  assert.deepEqual(read.progress, loaded.progress);
  store.setItem(key, JSON.stringify({ ...loaded.progress, clears: 7 }));
  assert.ok(loadProgress(store, key, campaign).recovery);
});

test('storage failures preserve the old primary value when recovery cannot be written', () => {
  const store = storage(),
    key = 'game';
  store.setItem(key, 'old corrupt bytes');
  const unavailable = {
    getItem: store.getItem,
    setItem() {
      throw new Error('quota');
    },
  };
  assert.equal(
    saveProgress(unavailable, key, emptyProgress(campaign), 'old corrupt bytes').ok,
    false,
  );
  assert.equal(store.getItem(key), 'old corrupt bytes');
  const denied = loadProgress(
    {
      getItem() {
        throw new Error('denied');
      },
    },
    key,
    campaign,
  );
  assert.ok(denied.warning);
  assert.deepEqual(denied.progress, emptyProgress(campaign));
});

test('recovery collisions retain each original and a full campaign unlocks by distinct clears', () => {
  const store = storage(),
    originalNow = Date.now;
  Date.now = () => 12345;
  try {
    saveProgress(store, 'game', emptyProgress(campaign), 'first original');
    saveProgress(store, 'game', emptyProgress(campaign), 'second original');
  } finally {
    Date.now = originalNow;
  }
  assert.equal(store.getItem('game.recovery.12345'), 'first original');
  assert.equal(store.getItem('game.recovery.12345.1'), 'second original');
  let progress = awardCompletion(emptyProgress(campaign), campaign, completion(), { runId: 'one' });
  progress = awardCompletion(progress, campaign, completion({ levelId: 'second' }), {
    runId: 'two',
  });
  assert.equal(achievements(progress, campaign).find((a) => a.id === 'last-light').earned, true);
});
