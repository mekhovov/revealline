import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL, CLASSES } from '../core/index.mjs';
import { planClassicEnemy } from '../core/classic-motion.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

// Minimal owned geometry from the R5 trial: pressure/contour/material do not cause
// this overlap. These are legal inputs from a fresh run, with no injected state.
const level = {
  version: 'xonix-level.v4',
  id: 'mixed-domain-edge',
  revision: '1',
  name: 'Captured edge overlap',
  width: 72,
  height: 36,
  encounter: null,
  spawn: { x: 36.5, y: 0.5 },
  goal: { coverage: 0.99 },
  walls: [
    { x: 18, y: 11, w: 2, h: 9 },
    { x: 51, y: 18, w: 2, h: 9 },
  ],
  classic: {
    version: 'classic.v1',
    terrain: [],
    powerups: [],
    lineImpact: { version: 'line-impact.v1', speed: 24 },
  },
  enemies: [
    { id: 'west', type: 'bouncer', x: 17.5, y: 7.5, vx: 9, vy: 6, radius: 0.3 },
    { id: 'east', type: 'bouncer', x: 57.5, y: 27.5, vx: -8, vy: -7, radius: 0.3 },
    { id: 'south', type: 'bouncer', x: 29.5, y: 28.5, vx: 7, vy: -8, radius: 0.3 },
  ],
  rules: { moveSpeed: 15, lives: 3, stopOnCapture: true },
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7);
function advance(run, recorder, direction, ticks) {
  for (let i = 0; i < ticks; i++) {
    const input = { direction };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
}
for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: a captured cell with a simultaneous boundary normal recovers and advances through a saved idle`, async () => {
    const options = { turnPolicy, classId: 'scout', seed: 1 },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    for (const [direction, ticks] of [
      ['left', 288],
      ['down', 264],
      ['right', 564],
    ])
      advance(run, recorder, direction, ticks);
    assert.equal(run.tick, 1116);
    assert.ok(run.events.some((e) => e.type === 'capture.stopped'));
    const enemy = run.enemies[2],
      before = { ...enemy },
      stopped = { ...run.player },
      coverage = run.coverage,
      score = run.score;
    assert.equal(fitsClassicDomain(run, enemy, enemy.radius, CELL.FIELD), false);
    const plan = planClassicEnemy(run, enemy, FIXED_DT);
    assert.equal(plan.event.time, 0);
    assert.equal(plan.enemy.vx, enemy.vx, 'A real vertical normal reverses only one component.');
    assert.equal(plan.enemy.vy, -enemy.vy);
    const campaign = {
        version: 'xonix-campaign.v1',
        id: 'domain-edge',
        revision: '1',
        levels: [level],
        classRecipes: CLASSES,
      },
      key = campaignKey(campaign);
    const saved = suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'quad',
      runId: `domain-edge-${turnPolicy}`,
      continuation: { direction: null },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    for (const value of [{ run, recorder }, restored]) {
      advance(value.run, value.recorder, null, 1);
      const actor = value.run.enemies[2];
      near(value.run.time, 1117 * FIXED_DT);
      assert.equal(fitsClassicDomain(value.run, actor, actor.radius, CELL.FIELD), true);
      assert.equal(actor.vx, before.vx);
      assert.equal(actor.vy, -Math.abs(before.vy));
      near(actor.x, before.x + before.vx * FIXED_DT);
      near(actor.y, 33 - actor.radius - Math.abs(before.vy) * FIXED_DT);
      advance(value.run, value.recorder, null, 119);
      near(value.run.time, 1236 * FIXED_DT);
      assert.notEqual(actor.x, before.x);
      assert.equal(fitsClassicDomain(value.run, actor, actor.radius, CELL.FIELD), true);
      assert.deepEqual(value.run.player, stopped);
      assert.equal(value.run.coverage, coverage);
      assert.equal(value.run.score, score);
      assert.equal(value.run.classic.livesLost, 0);
      const verified = verifyReplay(exportReplay(value.recorder, value.run));
      assert.equal(verified.match, true);
      assert.deepEqual(authoritativeCheckpoint(verified.state), authoritativeCheckpoint(value.run));
    }
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  });
}
