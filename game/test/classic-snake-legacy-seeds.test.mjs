import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { exportClassicSnakeReplay } from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  restoreClassicSnakeLegacyMatch,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';

const level = CLASSIC_SNAKE_LEVELS[0].level;
function recorded(seed, mode = 'versus') {
  const match = createClassicSnakeMatch(level, { seed, mode });
  advanceClassicSnakeMatchTo(match, 91.5);
  assert.equal(queueClassicSnakeMatchTurn(match, 0, 'down'), true);
  if (mode !== 'solo') assert.equal(queueClassicSnakeMatchTurn(match, 1, 'up'), true);
  advanceClassicSnakeMatchTo(match, 517.25);
  return {
    replays: match.runs.map(exportClassicSnakeReplay),
    mode,
    elapsedMs: match.elapsedMs,
  };
}

for (const mode of ['solo', 'versus', 'team']) {
  test(`historical ${mode} preserves each verified seed, fractional clock and Retry population`, () => {
    for (const seed of [0, 71, 0xffffffff]) {
      const source = recorded(seed, mode),
        original = structuredClone(source),
        restored = restoreClassicSnakeLegacyMatch(source, { level });
      assert.equal(restored.options.seed, seed);
      assert.equal(restored.elapsedMs, 517.25);
      assert.deepEqual(restored.runs.map(exportClassicSnakeReplay), source.replays);
      assert.deepEqual(source, original);
      const exported = exportClassicSnakeMatch(restored);
      assert.deepEqual(exportClassicSnakeMatch(restoreClassicSnakeMatch(exported)), exported);
      const retry = createClassicSnakeMatch(restored.runs[0].level, restored.options),
        fresh = createClassicSnakeMatch(level, { seed, mode });
      assert.deepEqual(
        retry.runs.map(exportClassicSnakeReplay),
        fresh.runs.map(exportClassicSnakeReplay),
      );
    }
  });
}

test('historical Versus rejects two individually valid boards with different seeds', () => {
  const source = recorded(17);
  source.replays[1] = recorded(71).replays[1];
  assert.throws(
    () => restoreClassicSnakeLegacyMatch(source, { level }),
    /Historical Snake setup differs/,
  );
});

test('historical seed migration still requires verified board journals and the exact level', () => {
  const source = recorded(71, 'solo');
  const altered = structuredClone(source);
  altered.replays[0].seed = 72;
  assert.throws(() => restoreClassicSnakeLegacyMatch(altered, { level }), /verification/);
  assert.throws(
    () => restoreClassicSnakeLegacyMatch(source, { level: { ...level, goal: level.goal + 1 } }),
    /different level/,
  );
});
