import test from 'node:test';
import assert from 'node:assert/strict';
import { arcadeEnemyDefeats } from '../ui/enemy-stats-events.mjs';

test('defeat projection counts accepted removals once and ignores visual/objective duplicates', () => {
  const run = {
    level: {
      hunt: { targets: [{ id: 'runner-1', kind: 'humanoid' }] },
      pursuit: { actors: [{ id: 'runner-1', behavior: 'refuge' }] },
    },
    events: [
      { type: 'combat.eliminated', id: 'runner-1' },
      { type: 'objective.captured', id: 'runner-1' },
      { type: 'combat.eliminated', id: 'runner-1' },
      { type: 'projectile.destroyed', id: 'projectile-1' },
      { type: 'pickup.collected', id: 'battery' },
    ],
  };
  assert.deepEqual(arcadeEnemyDefeats(run), [{ family: 'refuge' }]);
});

test('core/Team defeats retain mechanical families and authoritative player credit', () => {
  const run = {
    level: {},
    classic: { combatPatrols: { actors: [{ id: 'guard', role: 'sentry' }] } },
    enemies: [{ id: 'hunter', type: 'hunter' }],
    events: [
      { type: 'combat.eliminated', id: 'guard', player: 1 },
      { type: 'enemy.defeated', enemy: 'hunter' },
      { type: 'core.defeated', stronghold: 'relay' },
    ],
  };
  assert.deepEqual(arcadeEnemyDefeats(run), [
    { family: 'sentry', playerId: 1 },
    { family: 'bouncer' },
    { family: 'relay-sentinel' },
  ]);
});
