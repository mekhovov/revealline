import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  CLASSES,
  validateClassRecipes,
  getSummary,
  replayRun,
} from '../core/index.mjs';
const level = {
  version: 'xonix-level.v1',
  id: 'ability',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 1 },
  enemies: [{ id: 'e', type: 'bouncer', x: 24.5, y: 3.5, vx: 0, vy: 2 }],
  supplies: [{ id: 's', x: 24.5, y: 0.5, radius: 2 }],
  objectives: [{ id: 'hidden', x: 8.5, y: 9.5, hidden: true }],
};

test('scout reveals objectives and trajectory window without changing enemy speed', () => {
  const a = createRun(level),
    b = createRun(level);
  assert.equal(a.objectives[0].revealed, false);
  stepRun(a, { action: true });
  stepRun(b, {});
  assert.equal(a.objectives[0].revealed, true);
  assert.ok(a.ability.scanUntil > a.time);
  assert.equal(a.enemies[0].y, b.enemies[0].y);
  assert.equal(a.enemies[0].stunnedUntil, 0);
});

test('pickup fills declared capacity; held action/pickup are not repeated and cooldown holds', () => {
  const s = createRun(level, { classId: 'carrier' });
  stepRun(s, { action: true });
  assert.equal(s.ability.ammo, 0);
  assert.equal(s.events[0].reason, 'empty');
  stepRun(s, { pickup: true });
  assert.equal(s.ability.ammo, 2);
  stepRun(s, { pickup: true, action: true });
  assert.equal(s.ability.ammo, 1);
  assert.equal(s.ability.fields.length, 1);
  stepRun(s, { pickup: true, action: true }, 0.5);
  assert.equal(s.ability.ammo, 1);
  assert.equal(s.ability.fields.length, 1);
  stepRun(s, {});
  stepRun(s, { action: true });
  assert.equal(s.ability.ammo, 1);
  assert.ok(s.events.some((e) => e.reason === 'cooldown'));
});

test('drop stun and slow field have distinct outcomes and expire on simulation time', () => {
  for (const id of ['bomber', 'trapper']) {
    const s = createRun(level, { classId: id });
    stepRun(s, { pickup: true });
    const y = s.enemies[0].y;
    stepRun(s, { action: true }, 0.5);
    if (id === 'bomber') assert.ok(Math.abs(s.enemies[0].y - y) < 1e-8);
    else assert.ok(s.enemies[0].y - y > 0.2 && s.enemies[0].y - y < 0.3);
    const before = s.enemies[0].y;
    stepRun(s, {}, 5);
    assert.equal(s.ability.fields.length, 0);
    assert.ok(s.enemies[0].y > before);
  }
});

test('out-of-range pickup cannot refill and ability state is independent of supplied art metadata', () => {
  const s = createRun(level, { classId: 'bomber' });
  s.player.x = 2.5;
  stepRun(s, { pickup: true });
  assert.equal(s.ability.ammo, 0);
  assert.equal(s.events[0].reason, 'out-of-range');
  for (const c of CLASSES) assert.ok(!('sprite' in c));
  assert.equal(CLASSES.length, 5);
});

test('shield absorbs one enemy hit, cancels trail, preserves lives and recovers with grace', () => {
  const s = createRun(level, { classId: 'interceptor' });
  s.player = { ...s.player, x: 24.5, y: 8.5, cutting: true };
  s.trail = [{ x: 24, y: 4, index: 4 * 48 + 24 }];
  s.trailSegments = [{ x1: 24.5, y1: 4, x2: 24.5, y2: 8.5 }];
  Object.assign(s.enemies[0], { x: 25.3, y: 4.5, vx: -20, vy: 0 });
  stepRun(s, { action: true });
  assert.equal(s.lives, 3);
  assert.equal(s.trail.length, 0);
  assert.equal(s.claimedCount, 0);
  assert.equal(s.status, 'respawning');
  assert.ok(s.events.some((e) => e.type === 'shield.absorbed'));
  stepRun(s, {}, 1);
  assert.equal(s.status, 'running');
  assert.equal(s.player.x, 24.5);
  assert.equal(s.player.y, 0.5);
  assert.ok(s.player.graceUntil > s.time);
  const y = s.player.y;
  stepRun(s, { direction: 'down' }, 0.2);
  assert.ok(s.player.y <= 1 + 1e-8);
  assert.ok(s.player.y >= y);
  assert.equal(s.player.cutting, false);
});

test('respawning rejects action and pickup without changing cooldown or ammo', () => {
  const s = createRun(level, { classId: 'bomber' });
  s.status = 'respawning';
  s.respawnAt = 10;
  stepRun(s, { action: true, pickup: true });
  assert.equal(s.ability.ammo, 0);
  assert.equal(s.ability.cooldownUntil, 0);
  assert.equal(s.events.length, 0);
});

test('boss lane warns before activation, then can fail a live cut; safe wait is harmless', () => {
  const source = {
    ...level,
    enemies: [
      {
        id: 'boss',
        type: 'lane-boss',
        x: 35.5,
        y: 20.5,
        axis: 'horizontal',
        warningSeconds: 0.5,
        activeSeconds: 0.2,
        period: 3,
      },
    ],
  };
  const s = createRun(source);
  stepRun(s, {}, 2.1);
  assert.equal(s.enemies[0].bossPhase, 'warning');
  assert.equal(s.lives, 3);
  stepRun(s, {}, 0.6);
  assert.equal(s.lives, 3);
  const danger = createRun(source);
  danger.time = 2;
  danger.player.x = 24.5;
  danger.player.y = 8.5;
  danger.player.cutting = true;
  danger.trail = [{ x: 24, y: 8, index: 8 * 48 + 24 }];
  danger.trailSegments = [{ x1: 24.5, y1: 1, x2: 24.5, y2: 8.5 }];
  stepRun(danger, {}, 0.6);
  assert.equal(danger.lives, 2);
  assert.ok(danger.status === 'respawning');
});

test('custom JSON recipes validate supported primitives, copy into a run and change loadout identity', () => {
  const recipes = structuredClone(CLASSES),
    stock = createRun(level, { classId: 'carrier' });
  recipes.find((c) => c.id === 'carrier').capacity = 3;
  assert.equal(validateClassRecipes(recipes).valid, true);
  const s = createRun(level, { classId: 'carrier', classRecipes: recipes });
  assert.notEqual(getSummary(s).loadoutHash, getSummary(stock).loadoutHash);
  assert.equal(s.ability.capacity, 3);
  recipes.find((c) => c.id === 'carrier').capacity = 8;
  assert.equal(s.classRecipe.capacity, 3);
  const malformed = structuredClone(CLASSES);
  malformed[0].primitive = 'unimplemented-dash';
  assert.equal(validateClassRecipes(malformed).valid, false);
  assert.throws(() => createRun(level, { classRecipes: malformed }), /Invalid classRecipes/);
  malformed[0] = { ...CLASSES[0], speed: 50 };
  assert.equal(validateClassRecipes(malformed).valid, false);
});

test('custom-recipe replay uses the same data and cosmetic wording leaves physics identity unchanged', () => {
  const recipes = structuredClone(CLASSES);
  recipes[0].cooldown = 2;
  const options = { classRecipes: recipes, classId: 'scout' };
  const inputs = Array.from({ length: 500 }, (_, i) => ({ action: i === 0 || i === 300 })),
    a = replayRun(level, options, inputs),
    b = replayRun(level, options, inputs);
  assert.deepEqual(a, b);
  const original = createRun(level);
  const labels = structuredClone(CLASSES);
  labels[0].label = 'Archive keeper';
  labels[0].description = 'Cultural theme text';
  assert.equal(createRun(level, { classRecipes: labels }).loadoutHash, original.loadoutHash);
});
