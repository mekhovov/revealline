import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, CLASSES, FIXED_DT } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const resolve = (source, mode = 'solo') =>
  resolveMission(compileContentProject(source), 'nearby-shore', { mode });

test('new Journey projects explicitly select Arcade while legacy imports retain their simulation', () => {
  const source = createStarterProject();
  const current = resolve(source);
  assert.equal(current.policyId, 'journey-arcade-v2');
  assert.deepEqual(current.level, resolve(source, 'versus').level);
  assert.equal(arcadeActionCapabilities(current.level).manualAbility, false);
  source.policyId = 'journey-v1';
  const legacy = resolve(source);
  assert.equal(legacy.policyId, 'journey-v1');
  assert.equal(Object.hasOwn(legacy.level.classic, 'arcadeActions'), false);
  assert.equal(arcadeActionCapabilities(legacy.level).manualBoost, true);
  assert.notEqual(legacy.simulationIdentity, current.simulationIdentity);
  const withoutPolicy = structuredClone(current.level);
  delete withoutPolicy.classic.arcadeActions;
  assert.deepEqual(withoutPolicy, legacy.level);
  for (const id of ['__proto__', 'unknown', null]) {
    source.policyId = id;
    assert.throws(() => compileContentProject(source), /registered Journey policy/);
  }
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: Journey's actual compiled missions ignore manual commands and replay exactly`, () => {
    const { level } = resolve(createStarterProject());
    for (const { id: classId } of CLASSES) {
      const options = { classId, turnPolicy };
      const expected = createRun(level, options);
      const actual = createRun(level, options);
      const recorder = createRecorder(level, options);
      for (let tick = 0; tick < 30; tick++) {
        const input = { direction: 'down', action: true, pickup: true, boost: true };
        stepRun(expected, { direction: 'down' }, FIXED_DT);
        recordInput(recorder, input);
        stepRun(actual, input, FIXED_DT);
      }
      assert.deepEqual(authoritativeCheckpoint(actual), authoritativeCheckpoint(expected), classId);
      assert.equal(verifyReplay(exportReplay(recorder, actual)).match, true, classId);
    }
  });
  test(`${turnPolicy}: authored contact bonuses remain automatic without a manual action`, () => {
    const source = createStarterProject();
    source.missions[0].bonuses = ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'].map(
      (kind, i) => ({ id: kind, kind, x: 32.5, y: i + 1.5 }),
    );
    const run = createRun(resolve(source).level, { turnPolicy });
    const collected = [];
    for (let tick = 0; tick < 60; tick++) {
      stepRun(run, { direction: 'down' }, FIXED_DT);
      collected.push(...run.events.filter((event) => event.type === 'powerup.collected'));
    }
    assert.equal(collected.length, 4);
    assert.equal(run.lives, 4);
    assert(run.classic.powerups.every((bonus) => Number.isInteger(bonus.collectedTick)));
  });
}
