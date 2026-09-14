import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCompactArcadeArena } from '../input-presentation.mjs';

// Small presentation fixtures represent an already validated original level.
// No phase, caller preference, current actor list, command or save is authority here.
const arcade = (types = ['bouncer']) => ({
  classic: { arcadeActions: { version: 'arcade-actions.v1' } },
  encounter: null,
  enemies: types.map((type) => ({ type })),
});

test('explicit Arcade non-card roles can reclaim status space without changing authored data', () => {
  const level = arcade(['bouncer', 'border-patrol', 'contour-patrol']);
  const before = structuredClone(level);
  Object.freeze(level.classic.arcadeActions);
  Object.freeze(level.classic);
  level.enemies.forEach(Object.freeze);
  Object.freeze(level.enemies);
  Object.freeze(level);
  assert.equal(hasCompactArcadeArena(level), true);
  assert.deepEqual(level, before);
});

test('Tactical, unknown policy, encounters and every warning-capable or future role retain space', () => {
  const ordinary = arcade();
  delete ordinary.classic.arcadeActions;
  for (const level of [
    undefined,
    null,
    ordinary,
    { ...arcade(), classic: { arcadeActions: { version: 'future' } } },
    { ...arcade(), encounter: { version: 'encounter.v1' } },
    { ...arcade(), encounter: undefined },
    { ...arcade(), enemies: undefined },
    ...['claimed-rover', 'eroder', 'lane-boss', 'relay-sentinel', 'future-role'].map((type) =>
      arcade([type]),
    ),
  ])
    assert.equal(hasCompactArcadeArena(level), false);
});

test('warning transitions and removal of a live enemy cannot release its authored warning reserve', () => {
  const run = { level: arcade(['bouncer', 'eroder']), enemies: [{ type: 'eroder', mode: null }] };
  assert.equal(hasCompactArcadeArena(run.level), false);
  run.enemies[0].mode = 'warning';
  assert.equal(hasCompactArcadeArena(run.level), false);
  run.enemies.length = 0;
  assert.equal(hasCompactArcadeArena(run.level), false);
  const pressure = {
    level: arcade(),
    enemies: [{ type: 'bouncer', pressure: { phase: 'patrol' } }],
  };
  for (const phase of ['patrol', 'warning', 'committed', 'cooldown']) {
    pressure.enemies[0].pressure.phase = phase;
    assert.equal(hasCompactArcadeArena(pressure.level), true);
  }
});
