import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)),
);
const base = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7);
function flight(campaign, turnPolicy) {
  const level = campaign.levels[0],
    options = { classId: 'scout', classRecipes: campaign.classRecipes, turnPolicy, seed: 1 };
  return { run: createRun(level, options), recorder: createRecorder(level, options) };
}

test('a due erosion resolves penetration in historical order before any recovery projection', () => {
  // Controlled simultaneous topology fixture: both body and erosion state are
  // core-owned. This isolates the old successful zero-time ordering; the R4
  // cases below create the regression entirely through legal player inputs.
  const level = {
    version: 'xonix-level.v4',
    id: 'erosion-before-repair',
    revision: '1',
    name: 'Erosion before repair',
    width: 72,
    height: 36,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    encounter: null,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
    enemies: [
      { id: 'overlap', type: 'bouncer', x: 20.5, y: 18.5, vx: 2, vy: 1, radius: 0.25 },
      { id: 'reopen', type: 'eroder', x: 60.5, y: 10.5, vx: 0, vy: 0, radius: 0.25 },
    ],
  };
  const run = createRun(level),
    index = 18 * run.width + 20;
  run.cells[index] = CELL.SAFE;
  run.claimedCount = 1;
  run.coverage = 1 / run.totalClaimable;
  run.classic.everClaimed[index] = 1;
  run.classic.uniqueClaimedCount = 1;
  run.classic.topologyRevision = 1;
  Object.assign(run.enemies[1].classic, { target: index, erosionAt: 1 });
  stepRun(run, { direction: null }, FIXED_DT);
  assert.equal(run.cells[index], CELL.FIELD);
  assert.equal(run.events.filter((event) => event.type === 'cells.eroded').length, 1);
  near(run.enemies[0].x, 20.5 - 2 * FIXED_DT);
  near(run.enemies[0].y, 18.5 - FIXED_DT);
  assert.equal(run.enemies[0].vx, -2);
  assert.equal(run.enemies[0].vy, -1);
  assert.equal(run.claimedCount, 0);
  near(run.time, FIXED_DT);
});
function advance(flight, direction, ticks) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    const input = { direction };
    assert.equal(flight.run.status, 'running');
    stepRun(flight.run, input, FIXED_DT);
    recordInput(flight.recorder, input);
    events.push(...flight.run.events);
  }
  return events;
}
async function restore(flight, campaign, id) {
  const before = authoritativeCheckpoint(flight.run),
    key = campaignKey(campaign),
    saved = suspendSession({
      ...flight,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      runId: id,
      savedAt: '2026-09-13T05:00:00.000Z',
      continuation: { direction: null },
    }),
    restored = await restoreSession(saved, { campaign, campaignKey: key });
  assert.deepEqual(authoritativeCheckpoint(flight.run), before);
  assert.deepEqual(authoritativeCheckpoint(restored.run), before);
  return restored;
}
function checkReplay(flight) {
  const checked = verifyReplay(exportReplay(flight.recorder, flight.run));
  assert.equal(checked.match, true);
  assert.deepEqual(authoritativeCheckpoint(checked.state), authoritativeCheckpoint(flight.run));
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: shipped Standard R4 first Down capture continues through idle and saved return`, async () => {
    const current = flight(base, turnPolicy),
      { run } = current;
    const events = advance(current, 'down', 316);
    assert.equal(events.filter((event) => event.type === 'capture.stopped').length, 1);
    near(run.coverage, 36 / 70);
    assert.equal(run.score, 12240);
    const stopped = { ...run.player },
      beforeEnemy = { ...run.enemies[0] };
    assert.equal(stopped.cutting, false);
    assert.equal(stopped.speed, 0);
    // This is an actual legal input result, not an injected invalid actor position.
    assert.equal(
      run.cells[Math.floor(beforeEnemy.y) * run.width + Math.floor(beforeEnemy.x)],
      CELL.SAFE,
    );
    assert.equal(fitsClassicDomain(run, beforeEnemy, beforeEnemy.radius, CELL.FIELD), false);
    const resumed = await restore(current, base, `r4-domain-before-${turnPolicy}`);
    for (const value of [current, resumed]) {
      assert.deepEqual(advance(value, null, 1), []);
      near(value.run.time, 317 * FIXED_DT);
      const enemy = value.run.enemies[0];
      assert.equal(fitsClassicDomain(value.run, enemy, enemy.radius, CELL.FIELD), true);
      // The repair preserves the tangential coordinate, then integrates the full tick.
      near(enemy.x, 37 + enemy.radius + enemy.vx * FIXED_DT);
      near(enemy.y, beforeEnemy.y + enemy.vy * FIXED_DT);
      assert.equal(enemy.vx, beforeEnemy.vx);
      assert.equal(enemy.vy, beforeEnemy.vy);
      assert.equal(
        advance(value, null, 119).some((event) => event.type === 'capture.stopped'),
        false,
      );
      near(value.run.time, 436 * FIXED_DT);
      near(enemy.x, 37 + enemy.radius + enemy.vx);
      near(enemy.y, beforeEnemy.y + enemy.vy);
      assert.deepEqual(value.run.player, stopped);
      near(value.run.coverage, 36 / 70);
      assert.equal(value.run.score, 12240);
      assert.equal(value.run.classic.livesLost, 0);
      for (const actor of value.run.enemies.filter((actor) => actor.type === 'bouncer'))
        assert.equal(fitsClassicDomain(value.run, actor, actor.radius, CELL.FIELD), true);
    }
    assert.deepEqual(authoritativeCheckpoint(resumed.run), authoritativeCheckpoint(run));
    const after = await restore(current, base, `r4-domain-after-${turnPolicy}`);
    for (const value of [current, after]) {
      advance(value, 'left', 12);
      assert.ok(value.run.player.x < stopped.x);
      assert.equal(value.run.player.cutting, false);
      checkReplay(value);
    }
    assert.deepEqual(authoritativeCheckpoint(after.run), authoritativeCheckpoint(run));
  });

  test(`${turnPolicy}: same authored Gentle map retains legal capture and moving field actors`, () => {
    const { campaign } = createDifficultyContext(base, 'gentle'),
      current = flight(campaign, turnPolicy);
    let closed = false;
    for (let i = 0; i < 600 && !closed; i++)
      closed = advance(current, 'down', 1).some((event) => event.type === 'capture.stopped');
    assert.equal(closed, true);
    const tick = current.run.tick,
      position = { x: current.run.player.x, y: current.run.player.y },
      actor = { ...current.run.enemies[0] };
    advance(current, null, 120);
    near(current.run.time, (tick + 120) * FIXED_DT);
    assert.deepEqual({ x: current.run.player.x, y: current.run.player.y }, position);
    assert.notDeepEqual(
      { x: current.run.enemies[0].x, y: current.run.enemies[0].y },
      { x: actor.x, y: actor.y },
    );
    for (const enemy of current.run.enemies.filter((enemy) => enemy.type === 'bouncer'))
      assert.equal(fitsClassicDomain(current.run, enemy, enemy.radius, CELL.FIELD), true);
    checkReplay(current);
  });

  test(`${turnPolicy}: a closing impact trail repairs an embedded field actor without recapture or lost world time`, () => {
    for (const vx of [-2, 2]) {
      const campaign = {
        version: 'xonix-campaign.v1',
        id: 'domain-overlap-recovery',
        revision: '1',
        classRecipes: pack.classRecipes,
        levels: [
          {
            version: 'xonix-level.v4',
            id: 'overlap-at-closure',
            revision: '1',
            name: 'Closing trail overlap',
            width: 72,
            height: 36,
            spawn: { x: 36.5, y: 0.5 },
            goal: { coverage: 0.99 },
            encounter: null,
            classic: {
              version: 'classic.v1',
              terrain: [],
              powerups: [],
              lineImpact: { version: 'line-impact.v1', speed: 4 },
            },
            enemies: [
              {
                id: 'crossing',
                type: 'bouncer',
                x: 36.6 - vx * 2.3,
                y: 18.5,
                vx,
                vy: 0,
                radius: 0.25,
              },
              { id: 'retained', type: 'bouncer', x: 60.5, y: 10.5, vx: 0, vy: 0, radius: 0.25 },
            ],
            rules: { moveSpeed: 15, lives: 3, stopOnCapture: true },
          },
        ],
      };
      const current = flight(campaign, turnPolicy),
        events = advance(current, 'down', 276);
      assert.ok(events.some((event) => event.type === 'lineImpact.seeded'));
      assert.ok(events.some((event) => event.type === 'capture.stopped'));
      assert.equal(current.run.classic.lineImpact.fronts.length, 0);
      assert.equal(current.run.classic.livesLost, 0);
      const coverage = current.run.coverage,
        score = current.run.score;
      const later = advance(current, null, 120),
        actor = current.run.enemies[0];
      near(current.run.time, 396 * FIXED_DT);
      assert.equal(fitsClassicDomain(current.run, actor, actor.radius, CELL.FIELD), true);
      assert.equal(actor.vx, 2, 'An opposing normal component reflects into the retained field.');
      assert.equal(actor.vy, 0);
      near(actor.x, 37.25 + 2);
      near(actor.y, 18.5);
      assert.equal(current.run.coverage, coverage);
      assert.equal(current.run.score, score);
      assert.equal(
        later.some((event) => event.type === 'capture.stopped'),
        false,
      );
      checkReplay(current);
    }
  });
}
