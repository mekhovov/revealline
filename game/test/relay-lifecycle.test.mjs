import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, CELL, FIXED_DT } from '../core/index.mjs';
import {
  classicContourGraph,
  contourEdgeId,
  repairClassicContours,
} from '../core/classic-contour.mjs';
import {
  fitsClassicDomain,
  commitClassicErosion,
  updateClassicAnchors,
} from '../core/classic-topology.mjs';
import { openCapturedRelays } from '../core/relay-gates.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { suspendSession, restoreSession, snapshotSession } from '../sessions.mjs';

// Mechanic contract fixture, not a campaign candidate or a pacing benchmark.
const source = (overrides = {}) => ({
  version: 'xonix-level.v6',
  id: 'relay-lifecycle',
  revision: '1',
  name: 'Relay lifecycle',
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
  test(`${turnPolicy}: timeout at closure and contact before closure cannot open a relay`, () => {
    const timed = createRun(source({ rules: { ...source().rules, timeLimitSeconds: 3.45 } }), {
      turnPolicy,
    });
    const contact = createRun(
      source({
        rules: { ...source().rules, moveSpeed: 13, lives: 1 },
        enemies: [{ id: 'guard', type: 'bouncer', x: 10.5, y: 34.5, vx: 0, vy: 0 }],
      }),
      { turnPolicy },
    );
    for (const [run, ticks] of [
      [timed, 414],
      [contact, 319],
    ]) {
      const events = advance(run, 'down', ticks);
      assert.equal(run.status, 'lost');
      assert.equal(run.claimedCount, 0);
      assert.equal(run.score, 0);
      assert.equal(run.objectives[0].captured, false);
      assert.equal(run.relay.gates[0].openedTick, null);
      assert.equal(run.cells[17 * 72 + 35], CELL.WALL);
      assert(
        !events.some((e) => ['cut.closed', 'relay.opened', 'capture.stopped'].includes(e.type)),
      );
    }
    assert.equal(timed.failureCause, 'mission-timeout');
    assert(['enemy-trail', 'enemy-player'].includes(contact.failureCause));
  });

  test(`${turnPolicy}: paired relay boards clear equally with independent mutable state`, () => {
    const match = createDuel(
      source({ goal: { coverage: 0.4 } }),
      { seed: 1, classId: 'scout', turnPolicy },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    for (const key of ['cells', 'relay', 'foundation'])
      assert.notEqual(match.runs[0][key], match.runs[1][key]);
    assert.notEqual(match.runs[0].relay.gates[0], match.runs[1].relay.gates[0]);
    assert.notEqual(match.runs[0].foundation.permanent, match.runs[1].foundation.permanent);
    resumeDuel(match);
    for (let tick = 0; tick < 500 && match.status === 'running'; tick++)
      stepDuel(match, [{ direction: 'down' }, { direction: 'down' }]);
    assert.equal(match.status, 'finished');
    assert.equal(match.reason, 'First clear');
    assert.equal(match.winner, null);
    for (const run of match.runs) {
      assert.equal(run.status, 'won');
      assert.equal(run.lives, 3);
      assert.notEqual(run.relay.gates[0].openedTick, null);
      assert.equal(run.cells[17 * 72 + 35], CELL.SAFE);
      const events = run.events.map((e) => e.type);
      assert(events.indexOf('relay.opened') < events.indexOf('run.completed'));
    }
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });

  test(`${turnPolicy}: suspend and verified restore retain closed/open state and deterministic continuation`, async () => {
    for (const ticks of [90, 420]) {
      const level = source(),
        options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(level, options),
        recorder = createRecorder(level, options);
      advance(run, 'down', ticks, recorder);
      const before = authoritativeCheckpoint(run);
      const saved = suspendSession({
        run,
        recorder,
        campaignKey: 'relay-lifecycle@1',
        themeId: 'fpv',
        bodyId: 'fpv-body',
        runId: 'relay-session',
        continuation: { direction: null },
      });
      const campaign = { id: 'relay-lifecycle', levels: [level], classRecipes: run.classRecipes };
      const restored = await restoreSession(snapshotSession(JSON.stringify(saved)), {
        campaign,
        campaignKey: saved.campaignKey,
      });
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      assert.deepEqual(authoritativeCheckpoint(run), before);
      assert.equal(restored.run.relay.gates[0].openedTick === null, ticks === 90);
      assert.notEqual(restored.run.relay, run.relay);
      for (const flight of [{ run, recorder }, restored])
        advance(flight.run, 'left', 24, flight.recorder);
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
      assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
      const changed = structuredClone(campaign);
      changed.levels[0].relayGates.gates[0].h = 3;
      await assert.rejects(
        restoreSession(saved, { campaign: changed, campaignKey: saved.campaignKey }),
        /Saved rules differ/,
      );
    }
  });
}

test('opening invalidates contour topology, permits reclaimed-domain travel, and blocks erosion', () => {
  const run = createRun(
    source({
      enemies: [
        ...source().enemies,
        {
          id: 'rim',
          type: 'contour-patrol',
          edge: { x: 20, y: 1, side: 'north' },
          clockwise: true,
          speed: 2,
        },
      ],
    }),
  );
  const before = classicContourGraph(run),
    index = 17 * 72 + 35;
  const edgeId = contourEdgeId({ x: 34, y: 17, side: 'east' }, 72);
  assert(!before.edges.has(edgeId));
  assert(!fitsClassicDomain(run, { x: 35.5, y: 17.5 }, 0.2, CELL.SAFE));
  // Isolate gate topology from separately tested capture fills and actor movement.
  run.objectives[0].captured = true;
  openCapturedRelays(run);
  const after = classicContourGraph(run);
  assert.notEqual(after, before);
  assert.equal(after.revision, before.revision + 1);
  assert(after.edges.has(edgeId));
  assert(fitsClassicDomain(run, { x: 35.5, y: 17.5 }, 0.2, CELL.SAFE));
  assert(!fitsClassicDomain(run, { x: 35.5, y: 17.5 }, 0.2, CELL.FIELD));
  const patrol = run.enemies.find((e) => e.id === 'rim'),
    priorEdge = patrol.classic.edgeId;
  repairClassicContours(run);
  assert.equal(patrol.classic.topologyRevision, after.revision);
  assert.equal(patrol.classic.edgeId, priorEdge);
  assert.equal(patrol.classic.mode, 'patrolling');
  // A due request is rechecked at commit, including a stale target on the new gate.
  run.enemies.push({
    id: 'stale-erosion',
    type: 'eroder',
    classic: { target: index, erosionAt: run.classic.actorTick },
  });
  const denominator = run.totalClaimable;
  assert.equal(commitClassicErosion(run), 0);
  assert.equal(run.cells[index], CELL.SAFE);
  assert.equal(run.totalClaimable, denominator);
  assert(run.events.some((e) => e.type === 'erosion.blocked' && e.reason === 'foundation'));
});

test('opened permanent connectors can anchor required captured objectives without an outer path', () => {
  const run = createRun(
    source({ objectives: [{ id: 'relay', x: 34.5, y: 17.5, required: true }] }),
  );
  const index = 17 * 72 + 34;
  // Isolated earned island to distinguish gate anchoring from an outer-border path.
  run.cells[index] = CELL.SAFE;
  run.objectives[0].captured = true;
  updateClassicAnchors(run);
  assert.equal(run.classic.anchors.find((anchor) => anchor.id === 'relay').path, null);
  openCapturedRelays(run);
  updateClassicAnchors(run);
  assert.deepEqual(run.classic.anchors.find((anchor) => anchor.id === 'relay').path, [
    index,
    index + 1,
  ]);
});
