import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, FIXED_DT } from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { finishEncounterCapture } from '../core/encounter.mjs';
import { SENTINEL_VERSIONS, DIRECTIONAL_VERSIONS, resolveVersions } from '../core/versions.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { suspendSession, restoreSession, snapshotSession } from '../sessions.mjs';

// Independent engine fixture, not an authored campaign or a human playability claim.
const source = () => ({
  version: 'xonix-level.v8',
  id: 'sentinel-contract',
  revision: '1',
  name: 'Two shields',
  width: 72,
  height: 36,
  spawn: { x: 0.5, y: 18.5 },
  walls: [],
  foundations: [],
  relayGates: { version: 'relay-gates.v1', gates: [] },
  directionalFields: { version: 'directional-fields.v1', zones: [] },
  classic: { version: 'classic.v1', terrain: [], powerups: [] },
  goal: { coverage: 0.75 },
  enemies: [{ id: 'sentinel', type: 'relay-sentinel', x: 54.5, y: 18.5 }],
  objectives: [
    { id: 'west', x: 8.5, y: 8.5, required: true, hidden: false },
    { id: 'middle', x: 25.5, y: 8.5, required: true, hidden: false },
    { id: 'core', x: 54.5, y: 18.5, required: true, hidden: false },
  ],
  supplies: [],
  rules: { moveSpeed: 10, lives: 3, stopOnCapture: true },
  encounter: {
    version: 'xonix-encounter.v2',
    kind: 'relay-sentinel',
    enemyId: 'sentinel',
    shieldObjectiveIds: ['west', 'middle'],
    coreObjectiveId: 'core',
    minReleaseCutCells: 8,
    initialDelayTicks: 240,
    transitionTicks: 180,
    shielded: { warningTicks: 240, activeTicks: 84, restTicks: 396 },
    exposed: { warningTicks: 240, activeTicks: 84, openTicks: 480 },
    laneWidth: 1.2,
  },
});

test('multi-shield encounter has an explicit successor, not a reinterpretation of old editions', () => {
  assert.equal(validateLevel(source()).valid, true);
  const run = createRun(source());
  assert.equal(run.ruleset, SENTINEL_VERSIONS.ruleset);
  assert.equal(authoritativeCheckpoint(run).algorithm, SENTINEL_VERSIONS.checkpointAlgorithm);
  assert.deepEqual(resolveVersions({ levelVersion: 'xonix-level.v8' }), SENTINEL_VERSIONS);
  assert.throws(
    () => resolveVersions({ ...DIRECTIONAL_VERSIONS, levelVersion: 'xonix-level.v8' }),
    /mismatched/,
  );
  for (let version = 2; version <= 7; version++) {
    const old = source();
    old.version = `xonix-level.v${version}`;
    if (version < 7) delete old.directionalFields;
    if (version < 6) delete old.relayGates;
    if (version < 5) delete old.foundations;
    if (version < 4) delete old.classic;
    assert.match(validateLevel(old).errors.join(' '), /editions must match/);
  }
  const mixed = source();
  mixed.encounter.version = 'xonix-encounter.v1';
  mixed.encounter.shieldObjectiveId = 'west';
  delete mixed.encounter.shieldObjectiveIds;
  assert.equal(validateLevel(mixed).valid, false);
});

test('shield list is bounded, owned, unique, visible, claimable and distinct from the core', () => {
  const level = source(),
    owned = normalizedLevel(level);
  level.encounter.shieldObjectiveIds.reverse();
  assert.deepEqual(owned.encounter.shieldObjectiveIds, ['west', 'middle']);
  for (const change of [
    (l) => {
      l.encounter.shieldObjectiveIds = [];
    },
    (l) => {
      l.encounter.shieldObjectiveIds = ['west', 'middle', 'a', 'b', 'c'];
    },
    (l) => {
      l.encounter.shieldObjectiveIds = ['west', 'west'];
    },
    (l) => {
      l.encounter.shieldObjectiveIds = ['west', 'core'];
    },
    (l) => {
      l.encounter.shieldObjectiveIds = ['west', 'missing'];
    },
    (l) => {
      l.encounter.shieldObjectiveIds = 'west';
    },
    (l) => {
      l.encounter.shieldObjectiveId = 'west';
    },
    (l) => {
      l.objectives[1].hidden = true;
    },
    (l) => {
      l.objectives[1].required = false;
    },
    (l) => {
      l.objectives[1].x = 8.9;
    },
    (l) => {
      l.objectives[1].x = 0.5;
    },
    (l) => {
      l.foundations.push({ x: 25, y: 8, w: 1, h: 1 });
    },
    (l) => {
      l.encounter.version = 'xonix-encounter.v3';
    },
  ]) {
    const candidate = source();
    change(candidate);
    assert.equal(validateLevel(candidate).valid, false, change.toString());
  }
  let calls = 0;
  const hostile = source();
  Object.defineProperty(hostile.encounter.shieldObjectiveIds, '0', {
    enumerable: true,
    get() {
      calls++;
      return 'west';
    },
  });
  assert.equal(validateLevel(hostile).valid, false);
  assert.equal(calls, 0);
});

test('new release-cut bound excludes foundations and permanent relay connectors', () => {
  const level = source();
  level.foundations = [
    { x: 1, y: 1, w: 70, h: 17 },
    { x: 1, y: 19, w: 70, h: 16 },
  ];
  level.objectives[0].y = level.objectives[1].y = 18.5;
  level.encounter.minReleaseCutCells = 71;
  assert.match(validateLevel(level).errors.join(' '), /claimable/);
  level.encounter.minReleaseCutCells = 70;
  assert.equal(validateLevel(level).valid, true);
  level.relayGates.gates = [{ id: 'link', x: 40, y: 18, w: 1, h: 1, objectiveId: 'west' }];
  assert.match(validateLevel(level).errors.join(' '), /claimable/);
});

test('each shield order waits for all relays and produces exactly one transition', () => {
  for (const order of [
    ['west', 'middle'],
    ['middle', 'west'],
  ]) {
    const run = createRun(source());
    // Isolated transaction preconditions; legal movement is tested separately below.
    run.objectives.find((o) => o.id === order[0]).captured = true;
    finishEncounterCapture(run, 0);
    assert.equal(run.encounter.stage, 'shielded');
    assert.equal(run.encounter.transitionTick, null);
    run.objectives.find((o) => o.id === order[1]).captured = true;
    finishEncounterCapture(run, 0);
    assert.equal(run.encounter.stage, 'transition');
    assert.equal(run.encounter.lane, null);
    assert.equal(run.encounter.phaseEndTick - run.encounter.phaseStartTick, 180);
    finishEncounterCapture(run, 0);
    assert.equal(run.events.filter((e) => e.type === 'encounter.stageChanged').length, 1);
  }
});

test('one through four shield relays are accepted without changing the shared cadence', () => {
  for (let count = 1; count <= 4; count++) {
    const level = source();
    level.objectives = Array.from({ length: count }, (_, i) => ({
      id: `shield-${i}`,
      x: 4.5 + i * 4,
      y: 8.5,
      required: true,
      hidden: false,
    })).concat(level.objectives.at(-1));
    level.encounter.shieldObjectiveIds = level.objectives.slice(0, -1).map((o) => o.id);
    const run = createRun(level);
    assert.equal(run.encounter.phaseEndTick, 241);
    for (const objective of run.objectives.slice(0, -1)) objective.captured = true;
    finishEncounterCapture(run, 0);
    assert.equal(run.encounter.stage, 'transition');
    assert.equal(run.events.filter((e) => e.type === 'encounter.stageChanged').length, 1);
  }
});

test('freeze and pause do not consume shield warning or transition windows', () => {
  for (const transition of [false, true]) {
    const run = createRun(source());
    if (transition) {
      run.objectives.slice(0, -1).forEach((o) => {
        o.captured = true;
      });
      finishEncounterCapture(run, 0);
    }
    const before = structuredClone(run.encounter);
    // Isolated effect-clock precondition, not evidence of collecting a bonus.
    run.classic.effects['enemy-freeze'] = { from: 0, until: 240 };
    for (let i = 0; i < 120; i++) stepRun(run, { direction: null }, FIXED_DT);
    assert.deepEqual(run.encounter, before);
    assert.equal(run.classic.actorTick, 0);
    stepRun(run, { direction: null }, 0);
    assert.deepEqual(run.encounter, before);
    assert.equal(run.tick, 120);
  }
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: two real captures retain shield until the last relay, then a fresh cut releases the core`, async () => {
    const level = source(),
      options = { turnPolicy, seed: 1 },
      run = createRun(level, options);
    const recorder = createRecorder(level, options),
      events = [];
    const tick = (direction) => {
      assert.equal(run.status, 'running');
      const input = { direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      events.push(...structuredClone(run.events));
      assert.equal(
        run.classic.livesLost,
        0,
        JSON.stringify({ tick: run.tick, encounter: run.encounter, events: run.events }),
      );
    };
    const move = (direction, ticks) => {
      for (let i = 0; i < ticks && run.status !== 'won'; i++) tick(direction);
    };
    const wait = (predicate) => {
      for (let i = 0; !predicate(); i++) {
        assert(i < 3000);
        tick(null);
      }
    };
    const verifyRestoration = async () => {
      const before = authoritativeCheckpoint(run);
      const saved = suspendSession({
        run,
        recorder,
        campaignKey: 'sentinel-contract@1',
        themeId: 'fpv',
        bodyId: 'fpv-body',
        runId: 'sentinel-session',
        continuation: { direction: null },
      });
      const campaign = { id: 'sentinel-contract', levels: [level], classRecipes: run.classRecipes };
      const restored = await restoreSession(snapshotSession(JSON.stringify(saved)), {
        campaign,
        campaignKey: saved.campaignKey,
      });
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      const changed = structuredClone(campaign);
      changed.levels[0].encounter.shieldObjectiveIds.reverse();
      await assert.rejects(
        restoreSession(saved, { campaign: changed, campaignKey: saved.campaignKey }),
        /Saved rules differ/,
      );
      return restored;
    };
    move('up', 216);
    move('right', 144);
    wait(
      () =>
        run.encounter.phase === 'rest' && run.encounter.phaseEndTick - run.classic.actorTick >= 390,
    );
    move('down', 420);
    assert.equal(run.objectives[0].captured, true);
    assert.equal(run.objectives[1].captured, false);
    assert.equal(run.encounter.stage, 'shielded');
    const recovery = await verifyRestoration();
    // Independent legal-input failure after the first shield, not a winning route.
    for (const [direction, ticks] of [
      ['right', 504],
      ['up', 250],
    ]) {
      for (let i = 0; i < ticks && !recovery.run.classic.livesLost; i++) {
        recordInput(recovery.recorder, { direction });
        stepRun(recovery.run, { direction }, FIXED_DT);
      }
    }
    assert.equal(recovery.run.classic.livesLost, 1);
    assert.equal(recovery.run.objectives[0].captured, true);
    assert.equal(recovery.run.objectives[1].captured, false);
    assert.equal(recovery.run.encounter.stage, 'shielded');
    assert.equal(verifyReplay(exportReplay(recovery.recorder, recovery.run)).match, true);
    assert(createRun(level, options).objectives.every((o) => !o.captured));
    move('up', 420);
    move('right', 216);
    wait(
      () =>
        run.encounter.phase === 'rest' && run.encounter.phaseEndTick - run.classic.actorTick >= 390,
    );
    move('down', 420);
    assert.equal(run.objectives[1].captured, true);
    assert.equal(run.encounter.stage, 'transition');
    await verifyRestoration();
    move('right', 96);
    wait(() => run.encounter.phase === 'open');
    move('up', 90);
    move('left', 120);
    assert.equal(run.status, 'won');
    assert.equal(run.encounter.defeatCause, 'cut-release');
    assert.equal(events.filter((e) => e.type === 'encounter.defeated').length, 1);
    assert.equal(events.filter((e) => e.type === 'run.completed').length, 1);
    const replay = exportReplay(recorder, run);
    assert.equal(replay.version, 'xonix-replay.v10');
    assert.equal(verifyReplay(replay).match, true);
    replay.level.encounter.shieldObjectiveIds.reverse();
    assert.equal(verifyReplay(replay).match, false);
    const before = authoritativeCheckpoint(run);
    run.level.encounter.shieldObjectiveIds.reverse();
    assert.notEqual(
      authoritativeCheckpoint(run).sections.configuration,
      before.sections.configuration,
    );
  });
}
