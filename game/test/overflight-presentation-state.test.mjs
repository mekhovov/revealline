import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightPresentationState,
  overflightEnemyPresentation,
} from '../overflight/presentation-state.mjs';
import { overflightEnemyFrame, overflightAtlasInventory } from '../overflight/atlas.mjs';

test('combat sprite states follow accepted state and preserve fixed aiming in both visual settings', () => {
  const frames = new Set(overflightAtlasInventory().frames.map((frame) => frame.id));
  for (const family of ['runner', 'shield-bearer', 'tracked-tank']) {
    for (const [behaviorPhase, clip] of [
      ['windup', 'preparing'],
      ['burst', 'attacking'],
      ['recovery', 'exposed'],
    ]) {
      const enemy = Object.freeze({
        id: 3,
        family,
        behaviorPhase,
        heading: 1.5,
        guardHeading: 0.3,
        maxGuardIntegrity: 2,
        guardIntegrity: 1,
      });
      const state = overflightEnemyPresentation(enemy, 7);
      assert.equal(state.state, clip);
      assert.equal(state.heading, 0.3);
      for (const reduced of [false, true]) {
        const id = overflightEnemyFrame(enemy, 7, reduced, 'tactical', state);
        assert.ok(frames.has(id));
        assert.ok(id.includes(`:${clip}:`));
      }
    }
  }
});

test('damage presentation freezes with gameplay time, does not mask warnings, and resets for pooled actors', () => {
  const reader = createOverflightPresentationState();
  const enemy = { id: 1, family: 'tracked-tank', hp: 100, armorSegments: 3 };
  reader.enemy(enemy, 1);
  enemy.armorSegments = 2;
  assert.equal(reader.enemy(enemy, 2).state, 'armor-break');
  assert.equal(reader.enemy(enemy, 2).state, 'armor-break');
  assert.equal(reader.enemy(enemy, 2.26).state, 'moving');
  enemy.hp = 90;
  assert.equal(reader.enemy(enemy, 3).state, 'stagger');
  enemy.attackWarning = 1;
  assert.equal(reader.enemy(enemy, 3.01).state, 'preparing');
  enemy.attackWarning = 0;
  enemy.id = 2;
  enemy.hp = 5;
  assert.equal(reader.enemy(enemy, 3.02).state, 'moving');
  const source = structuredClone(enemy);
  reader.enemy(enemy, 10);
  assert.deepEqual(enemy, source, 'presentation does not write onto simulation actors');
});
