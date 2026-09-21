import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, CELL, FIXED_DT } from '../core/index.mjs';
import { directionalSpeedFactor } from '../core/directional-fields.mjs';
import { commitClassicErosion } from '../core/classic-topology.mjs';
import { directionalView } from '../ui/directional-view.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { suspendSession, restoreSession, snapshotSession } from '../sessions.mjs';

// Mechanic fixture, not a campaign route or human pacing claim.
const source = (overrides = {}) => ({
  version: 'xonix-level.v7',
  id: 'directional-lifecycle',
  revision: '1',
  name: 'Marked return',
  width: 72,
  height: 36,
  spawn: { x: 10.5, y: 0.5 },
  foundations: [],
  walls: [
    { x: 35, y: 1, w: 1, h: 15 },
    { x: 35, y: 20, w: 1, h: 15 },
  ],
  relayGates: {
    version: 'relay-gates.v1',
    gates: [{ id: 'link', x: 35, y: 16, w: 1, h: 4, objectiveId: 'relay' }],
  },
  directionalFields: {
    version: 'directional-fields.v1',
    zones: [{ id: 'departure', x: 9, y: 1, w: 3, h: 33, direction: 'down' }],
  },
  goal: { coverage: 0.99 },
  encounter: null,
  classic: { version: 'classic.v1', terrain: [], powerups: [] },
  enemies: [{ id: 'keeper', type: 'bouncer', x: 20.5, y: 30.5, vx: 0, vy: 0 }],
  objectives: [{ id: 'relay', x: 50.5, y: 17.5, required: true }],
  supplies: [],
  rules: { lives: 3, moveSpeed: 10, stopOnCapture: true },
  ...overrides,
});
function advance(run, direction, ticks, recorder) {
  const events = [];
  for (let i = 0; i < ticks && run.status === 'running'; i++) {
    const input = { direction };
    if (recorder) recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    events.push(...structuredClone(run.events));
  }
  return events;
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: accelerated contact and closure-time timeout cannot award captures or open gates`, () => {
    const options = { turnPolicy },
      baseline = createRun(source(), options);
    while (!baseline.claimedCount && baseline.tick < 500) advance(baseline, 'down', 1);
    assert(baseline.claimedCount > 0);
    assert(baseline.tick < 414, 'The marked lane must accelerate this closure.');
    const closureTime = baseline.events.find((event) => event.type === 'cut.closed').time;
    const timed = createRun(
      source({ rules: { ...source().rules, timeLimitSeconds: closureTime } }),
      options,
    );
    const contact = createRun(
      source({
        rules: { ...source().rules, lives: 1 },
        enemies: [{ id: 'guard', type: 'bouncer', x: 10.5, y: 34.5, vx: 0, vy: 0 }],
      }),
      options,
    );
    for (const run of [timed, contact]) {
      const recorder = createRecorder(run.level, options);
      const events = advance(run, 'down', 500, recorder);
      assert.equal(run.status, 'lost');
      assert.equal(run.claimedCount, 0);
      assert.equal(run.score, 0);
      assert.equal(run.relay.gates[0].openedTick, null);
      assert(!events.some((e) => ['cut.closed', 'relay.opened'].includes(e.type)));
      assert.equal(directionalView(run).fields[0].activeCells, 99);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    }
    assert.equal(timed.failureCause, 'mission-timeout');
    assert(['enemy-trail', 'enemy-player'].includes(contact.failureCause));
  });

  test(`${turnPolicy}: independent paired boards use the same marked-speed race conditions`, () => {
    const match = createDuel(
      source({ goal: { coverage: 0.4 } }),
      { seed: 1, turnPolicy },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    for (const key of ['cells', 'relay', 'foundation'])
      assert.notEqual(match.runs[0][key], match.runs[1][key]);
    assert.notEqual(match.runs[0].level.directionalFields, match.runs[1].level.directionalFields);
    resumeDuel(match);
    for (let tick = 0; tick < 500 && match.status === 'running'; tick++)
      stepDuel(match, [{ direction: 'down' }, { direction: 'down' }]);
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    for (const run of match.runs) {
      assert.equal(run.status, 'won');
      assert.equal(run.lives, 3);
      assert.notEqual(run.relay.gates[0].openedTick, null);
      assert.equal(directionalSpeedFactor(run, 10 * 72 + 10, 'down'), 1);
    }
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });

  test(`${turnPolicy}: suspended field/captured state restores exactly and rejects edited arrow rules`, async () => {
    for (const ticks of [90, 350]) {
      const level = source(),
        options = { seed: 1, classId: 'scout', turnPolicy },
        run = createRun(level, options),
        recorder = createRecorder(level, options);
      advance(run, 'down', ticks, recorder);
      const before = authoritativeCheckpoint(run),
        saved = suspendSession({
          run,
          recorder,
          campaignKey: 'directional-lifecycle@1',
          themeId: 'fpv',
          bodyId: 'fpv-body',
          runId: 'directional-session',
          continuation: { direction: null },
        });
      const campaign = {
        id: 'directional-lifecycle',
        levels: [level],
        classRecipes: run.classRecipes,
      };
      const restored = await restoreSession(snapshotSession(JSON.stringify(saved)), {
        campaign,
        campaignKey: saved.campaignKey,
      });
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      assert.deepEqual(directionalView(restored.run), directionalView(run));
      assert.equal(restored.run.relay.gates[0].openedTick === null, ticks === 90);
      for (const flight of [{ run, recorder }, restored])
        advance(flight.run, 'left', 24, flight.recorder);
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
      assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
      const changed = structuredClone(campaign);
      changed.levels[0].directionalFields.zones[0].direction = 'up';
      await assert.rejects(
        restoreSession(saved, { campaign: changed, campaignKey: saved.campaignKey }),
        /Saved rules differ/,
      );
    }
  });

  test(`${turnPolicy}: life recovery preserves neutralized fields; a wall is never a return`, () => {
    const level = source(),
      options = { turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    advance(run, 'down', 350, recorder);
    const claimed = run.claimedCount,
      view = directionalView(run),
      denominator = run.totalClaimable;
    advance(run, 'right', 120, recorder);
    assert(Math.abs(run.player.x - 20.5) < 1e-7);
    advance(run, 'up', 80, recorder);
    assert.equal(run.classic.livesLost, 1);
    assert.equal(run.lives, 2);
    assert.equal(run.claimedCount, claimed);
    assert.equal(run.totalClaimable, denominator);
    assert.deepEqual(directionalView(run), view);
    assert.equal(run.player.cutting, false);
    assert.notEqual(run.relay.gates[0].openedTick, null);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);

    const wallRun = createRun(level, options);
    advance(wallRun, 'down', 350);
    const before = wallRun.claimedCount;
    advance(wallRun, 'right', 300);
    const events = advance(wallRun, 'up', 60);
    assert.equal(
      wallRun.player.y,
      turnPolicy === 'grid-center' ? 35.5 : 35 + wallRun.rules.playerRadius,
    );
    assert.equal(wallRun.player.speed, 0);
    assert.equal(wallRun.claimedCount, before);
    assert(!events.some((event) => event.type === 'cut.closed'));
    assert.equal(wallRun.lives, 3);
  });
}

test('committed erosion restores speed and arrows together; fresh attempts restore authored fields', () => {
  const level = source(),
    run = createRun(level);
  advance(run, 'down', 350);
  const index = 10 * 72 + 10,
    denominator = run.totalClaimable,
    score = run.score,
    claimed = run.claimedCount,
    visible = directionalView(run).cells.length;
  assert.equal(run.cells[index], CELL.SAFE);
  assert.equal(directionalSpeedFactor(run, index, 'down'), 1);
  // A due erosion request isolates the real commit boundary, not eroder AI or a legal playthrough.
  run.enemies.push({
    id: 'due-erosion',
    type: 'eroder',
    classic: { target: index, erosionAt: run.classic.actorTick },
  });
  assert.equal(commitClassicErosion(run), 1);
  assert.equal(run.cells[index], CELL.FIELD);
  assert.equal(directionalSpeedFactor(run, index, 'down'), 1.25);
  assert.equal(directionalSpeedFactor(run, index, 'up'), 0.8);
  assert.equal(directionalView(run).cells.length, visible + 1);
  assert.equal(run.claimedCount, claimed - 1);
  assert.equal(run.totalClaimable, denominator);
  assert.equal(run.score, score);
  const fresh = createRun(level);
  assert.equal(directionalView(fresh).fields[0].activeCells, 99);
  assert.equal(fresh.claimedCount, 0);
  assert.equal(fresh.relay.gates[0].openedTick, null);
});

test('Studio legend explains arrows without promising automatic movement', () => {
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(
    html,
    /Arrow field: faster with, slower against, unchanged across; never forced drift\./,
  );
});
