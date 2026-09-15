import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_STARTER_PACK, readCoopPack, coopGoalText } from '../coop/library.mjs';
import { COOP_PACK_MAX_BYTES } from '../coop/recipes.mjs';
import { createCoop, validateCoopLevel } from '../coop/core.mjs';
import { COOP_ENCOUNTER_BOUNDS } from '../coop/threats.mjs';

test('a created pack round-trips into independent playable territory and stronghold levels', () => {
  const source = JSON.stringify(COOP_STARTER_PACK);
  const imported = readCoopPack(source);
  assert.deepEqual(imported, COOP_STARTER_PACK);
  assert.notEqual(imported, COOP_STARTER_PACK);
  assert.ok(imported.levels.some((level) => level.goal.coverage));
  assert.ok(imported.levels.some((level) => level.goal.cores));
  for (const level of imported.levels) {
    const run = createCoop(level);
    assert.equal(run.level.id, level.id);
    run.cells.fill(1);
    assert.equal(JSON.stringify(COOP_STARTER_PACK), source);
  }
});

test('pack import rejects malformed, oversize and incompatible content without changing defaults', () => {
  const source = JSON.stringify(COOP_STARTER_PACK);
  assert.throws(() => readCoopPack('{'), /valid JSON/);
  assert.throws(() => readCoopPack(' '.repeat(COOP_PACK_MAX_BYTES + 1)), /1 MiB/);
  assert.throws(() => readCoopPack('é'.repeat(COOP_PACK_MAX_BYTES)), /1 MiB/);
  assert.throws(() => readCoopPack(JSON.stringify({ ...COOP_STARTER_PACK, ruleset: 'solo' })));
  assert.throws(() => readCoopPack(JSON.stringify({ ...COOP_STARTER_PACK, levels: [] })));
  assert.equal(JSON.stringify(COOP_STARTER_PACK), source);
});

test('every authored encounter field rejects nonfinite, out-of-range and unknown values', () => {
  const level = COOP_STARTER_PACK.levels[0];
  for (const [name, [low, high]] of Object.entries(COOP_ENCOUNTER_BOUNDS)) {
    for (const value of [low - 0.01, high + 0.01, NaN, Infinity, '1']) {
      assert.equal(validateCoopLevel({ ...level, encounter: { [name]: value } }).valid, false);
    }
    for (const value of [low, high])
      assert.equal(validateCoopLevel({ ...level, encounter: { [name]: value } }).valid, true);
  }
  assert.equal(validateCoopLevel({ ...level, encounter: { hiddenDifficulty: true } }).valid, false);
});

test('goal instructions follow authored coverage and required core counts', () => {
  assert.equal(coopGoalText({ goal: { coverage: 0.72 } }), 'Reveal 72% together');
  assert.equal(coopGoalText({ goal: { coverage: 0.724 } }), 'Reveal 72.4% together');
  assert.equal(coopGoalText({ goal: { coverage: 0.72401 } }), 'Reveal 72.41% together');
  assert.equal(
    coopGoalText({ goal: { cores: ['a'] } }),
    'Capture both anchors, then the exposed core',
  );
  assert.match(coopGoalText({ goal: { cores: ['a', 'b'] } }), /2 strongholds/);
});
