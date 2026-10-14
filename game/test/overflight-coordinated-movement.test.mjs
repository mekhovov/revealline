import { createOverflightTerrain, overflightTerrainClear } from '../overflight/terrain.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightRun,
  startOverflight,
  spawnOverflightEnemy,
  stepOverflight,
} from '../overflight/core.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  spawnOverflightHuntEnemy,
  stepOverflightHunt,
} from '../overflight/raid-core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import {
  hasOverflightEscape,
  admitOverflightMotion,
  admitOverflightBodyState,
} from '../overflight/tactics.mjs';
import { overflightEnemyVelocity, overflightMotionLeg } from '../overflight/motion.mjs';
import { overflightMovementTarget } from '../overflight/coordinated-movement.mjs';

const profile = (preset) => ({
  preset,
  anchors: [],
  commitmentSeconds: 3,
  formationWidth: 240,
  coordinatedFraction: 0.25,
});
function quiet(raid = false, version = 4) {
  const source = structuredClone(
    raid
      ? compileOverflightHuntProject(createOverflightHuntProject({ rulesVersion: 3 }))
      : compileOverflightProject(createOverflightProject({ rulesVersion: 3 })),
  );
  source.format = `${raid ? 'OverflightHunt' : 'Overflight'}CompiledV${version}`;
  source.rulesVersion = version;
  source.encounters = [];
  if (!raid) source.goals = { eliteAt: 10000, finalAt: 20000, finalHp: 2400 };
  const run = raid ? createOverflightHuntRun(source) : createOverflightRun(source);
  (raid ? startOverflightHunt : startOverflight)(run);
  run.player.x = 1200;
  run.player.y = 540;
  run.caches = [];
  run._cooldowns.primary = 10000;
  return run;
}
function body(run, options = {}) {
  return spawnOverflightEnemy(run, {
    x: 800,
    y: 540,
    speed: 60,
    warning: 0,
    hp: 10000,
    ...options,
  });
}
function advance(run, ticks, input = {}) {
  for (let i = 0; i < ticks; i++) (run.hunt ? stepOverflightHunt : stepOverflight)(run, input);
}

test('actual Raid bodies use finite velocity and contact semantics in warning escape', () => {
  const run = quiet(true, 3);
  const warning = { kind: 'ground', x: 1200, y: 540, radius: 45, remaining: 1.2 };
  const ring = [];
  for (let i = 0; i < 8; i++)
    ring.push(
      spawnOverflightHuntEnemy(run, {
        family: 'brace-trooper',
        behavior: 'brace',
        behaviorPhase: 'windup',
        phaseRemaining: 100,
        x: 1200 + Math.cos((i * Math.PI) / 4) * 70,
        y: 540 + Math.sin((i * Math.PI) / 4) * 70,
        speed: 0,
        warning: 0,
        radius: 30,
      }),
    );
  assert.ok(ring.every(Boolean));
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.deepEqual(overflightEnemyVelocity(ring[0]), { x: 0, y: 0 });
  assert.equal(hasOverflightEscape(run, warning), false, 'guarded Raid bodies close every escape');
  for (const actor of ring) actor.behaviorPhase = 'recovery';
  assert.equal(
    hasOverflightEscape(run, warning),
    true,
    'exposed infantry are legal strike-through exits',
  );
  ring[0].vx = 120;
  ring[0].vy = -40;
  assert.deepEqual(overflightEnemyVelocity(ring[0]), { x: 120, y: -40 });
});

test('committed motion prediction stops at the end of a leg', () => {
  const enemy = { x: 0, y: 0, huntRulesVersion: 4, vx: 100, vy: 0, _motionTarget: { x: 50, y: 0 } };
  assert.deepEqual(overflightMotionLeg(enemy, 2), { x: 100, y: 0, duration: 0.5 });
  assert.deepEqual(overflightMotionLeg(enemy, 2, { x: 0, y: 0 }), { x: 0, y: 0, duration: 2 });
});

test('split groups preserve different approach lanes at equal speed and legacy rules stay straight', () => {
  const modern = quiet(),
    legacy = quiet(false, 3);
  const actors = [0, 3].map((member) =>
    body(modern, {
      movement: profile('split-front'),
      movementGroup: 'front',
      movementMember: member,
    }),
  );
  const plain = body(legacy, { movement: profile('split-front'), movementMember: 0 });
  advance(modern, 120);
  advance(legacy, 120);
  assert.ok(actors[0].y < 505 && actors[1].y > 575, 'split groups approach opposite sides');
  assert.ok(Math.abs(actors[0].y - actors[1].y) > 80);
  assert.equal(plain.y, 540);
  for (const actor of actors) assert.ok(Math.hypot(actor._motionVX, actor._motionVY) <= 60.00001);
});

test('crosscut announces its snapshot then commits without tracking later player movement', () => {
  const run = quiet();
  const enemy = body(run, { movement: profile('crosscut'), movementMember: 0 });
  advance(run, 1);
  const target = { ...enemy._coordinated.pending };
  assert.equal(enemy.movementPhase, 'preparing');
  assert.ok(enemy.movementRemaining >= 1.2);
  const start = [enemy.x, enemy.y];
  advance(run, 60, { y: 1 });
  assert.deepEqual([enemy.x, enemy.y], start);
  advance(run, 30, { y: 1 });
  assert.equal(enemy.movementPhase, 'committed');
  assert.deepEqual(enemy._coordinated.target, target);
  assert.equal(enemy.y, 540, 'commitment keeps the warned crossing instead of following the drone');
});

test('standoff relocation moves laterally and halts during a real attack warning', () => {
  const run = quiet();
  const enemy = body(run, {
    family: 'brace-trooper',
    x: 980,
    movement: profile('standoff'),
    movementMember: 0,
  });
  enemy.attackCooldown = 1000;
  advance(run, 60);
  assert.ok(Math.abs(enemy.y - 540) > 20);
  enemy.attackWarning = 1;
  const before = [enemy.x, enemy.y];
  advance(run, 12);
  assert.deepEqual([enemy.x, enemy.y], before, 'combat stops do not wait for a steering update');
});

test('a new committed leg cannot take the final warned exit', () => {
  const run = quiet();
  const warning = {
    active: true,
    stage: 'warning',
    kind: 'ground',
    x: 1200,
    y: 540,
    radius: 45,
    remaining: 1.2,
  };
  Object.assign(run.priorityAttacks[0], warning);
  for (let i = 2; i < 23; i++)
    body(run, {
      x: 1200 + Math.cos((i * Math.PI) / 12) * 70,
      y: 540 + Math.sin((i * Math.PI) / 12) * 70,
      speed: 0,
      radius: 8,
    });
  const closer = body(run, { x: 1270, y: 540, radius: 30, speed: 150 });
  closer.steeringX = 1;
  closer.steeringY = 0;
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.equal(hasOverflightEscape(run), true);
  assert.equal(
    admitOverflightMotion(run, closer, { x: -150, y: 0, target: { x: 1200, y: 540 } }),
    false,
  );
  assert.equal(run.stats.motionDeferrals, 1);
  assert.equal(
    hasOverflightEscape(run),
    true,
    'rejected hypothetical motion never leaks into runtime',
  );
});

test('actual burst speed cannot close a warned exit on entry or between steering decisions', () => {
  for (const alreadyCommitted of [false, true]) {
    const run = quiet();
    let owner;
    for (let i = 2; i < 23; i++) {
      const blocker = body(run, {
        x: 1200 + Math.cos((i * Math.PI) / 12) * 70,
        y: 540 + Math.sin((i * Math.PI) / 12) * 70,
        speed: 0,
        radius: 8,
      });
      owner ??= blocker;
    }
    Object.assign(run.priorityAttacks[0], {
      active: true,
      owner: owner.id,
      stage: 'warning',
      kind: 'ground',
      x: 1200,
      y: 540,
      radius: 45,
      remaining: 1.2,
    });
    const target = { x: 1250, y: 540 };
    const sprinter = body(run, {
      family: 'sprinter',
      x: 1250,
      y: 478,
      speed: 60,
      radius: 8,
      movement: { ...profile('committed-flank'), anchors: [target] },
      movementMember: 0,
    });
    rebuildOverflightGrid(run._grid, run.enemies);
    assert.equal(admitOverflightMotion(run, sprinter, { x: 0, y: 60, target }), true);
    assert.equal(admitOverflightMotion(run, sprinter, { x: 0, y: 120, target }), false);
    if (alreadyCommitted) {
      assert.ok(overflightMovementTarget(run, sprinter, null, 60).target);
      assert.ok(sprinter._coordinated.nextDecision > run.time + 1 / 60);
    }
    sprinter._behaviorAge = 60;
    const before = { x: sprinter.x, y: sprinter.y };
    advance(run, 1);
    assert.equal(sprinter.behaviorPhase, 'burst');
    assert.equal(sprinter.movementPhase, 'holding');
    assert.deepEqual({ x: sprinter.x, y: sprinter.y }, before);
    assert.equal(hasOverflightEscape(run), true);
    run.priorityAttacks[0].active = false;
    advance(run, 8);
    assert.ok(sprinter.y > before.y, 'the existing burst resumes once its route is safe');
  }
});

test('Raid convoy reaches a firing stop, warns, recovers and leaves for another stop', () => {
  const run = quiet(true);
  const enemy = spawnOverflightHuntEnemy(run, {
    family: 'utility-car',
    behavior: 'vehicle',
    objectiveId: 'probe',
    x: 950,
    y: 540,
    speed: 40,
    warning: 0,
    armorSegments: 1,
    route: [
      { x: 1010, y: 540 },
      { x: 950, y: 650 },
    ],
    movement: profile('convoy'),
    movementMember: 0,
  });
  let warned = false,
    recovered = false,
    departed = false;
  for (let i = 0; i < 900 && run.phase === 'playing'; i++) {
    stepOverflightHunt(run, { x: 0, y: 0 });
    warned ||= enemy.behaviorPhase === 'windup';
    recovered ||= enemy.behaviorPhase === 'recovery';
    departed ||= recovered && enemy.y > 555;
  }
  assert.equal(warned, true);
  assert.equal(recovered, true);
  assert.equal(departed, true);
});

test('same coordinated inputs preserve deterministic trajectories without consuming gameplay RNG', () => {
  const traces = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = quiet();
    const actors = ['committed-flank', 'screen-support'].map((preset, i) =>
      body(run, {
        family: i ? 'shield-bearer' : 'patroller',
        x: 800 + i * 50,
        movement: profile(preset),
        movementGroup: preset,
        movementMember: 0,
      }),
    );
    const random = run._randomState;
    advance(run, 240, { y: -0.25 });
    assert.equal(run._randomState, random);
    traces.push(actors.map(({ x, y, movementPhase }) => ({ x, y, movementPhase })));
  }
  assert.deepEqual(traces[0], traces[1]);
});

test('a timed bent escape is admitted around cover when straight rays are body-blocked', () => {
  const run = quiet();
  run.terrain = createOverflightTerrain(
    {
      format: 'OverflightTerrainV2',
      id: 'corner-test',
      experimental: false,
      obstacles: [{ id: 'cover', x: 1240, y: 480, width: 120, height: 120, breakable: false }],
    },
    run.compiled.arena,
  );
  const points = [
    [1149.5520513347624, 468.91237676256696],
    [1206.6233555147937, 470.17944473718734],
    [1174.6242351822116, 488.3619817272088],
    [1109.6448674440026, 635.6495925403292],
    [1217.5294981347777, 644.9962847650349],
    [1109.7616803831306, 517.04631516474],
    [1275.4090437819987, 427.92204606987855],
    [1224.9996967331622, 417.61649633297026],
    [1093.5226927244569, 593.8510717212491],
    [1147.520129650037, 495.49210112831213],
    [1151.5413952297608, 635.4813257006535],
    [1101.7650537107195, 570.2747408573543],
  ];
  for (const [x, y] of points) {
    assert.equal(overflightTerrainClear(run.terrain, x, y, x, y, 12), true);
    body(run, { x, y, radius: 12, speed: 0 });
  }
  rebuildOverflightGrid(run._grid, run.enemies);
  const warning = { kind: 'ground', x: 1200, y: 540, radius: 70, remaining: 1.2 };
  run.rulesVersion = 3;
  assert.equal(hasOverflightEscape(run, warning), false);
  run.rulesVersion = 4;
  assert.equal(hasOverflightEscape(run, warning), true);
});

test('a shield cannot turn its protected half into the only live warned exit', () => {
  const run = quiet(true);
  for (let i = 1; i < 8; i++)
    spawnOverflightHuntEnemy(run, {
      family: 'brace-trooper',
      behavior: 'brace',
      behaviorPhase: 'windup',
      phaseRemaining: 100,
      x: 1200 + Math.cos((i * Math.PI) / 4) * 70,
      y: 540 + Math.sin((i * Math.PI) / 4) * 70,
      radius: 30,
      speed: 0,
      warning: 0,
    });
  const shield = spawnOverflightHuntEnemy(run, {
    family: 'shield-bearer',
    behavior: 'shield',
    x: 1270,
    y: 540,
    heading: 0,
    radius: 30,
    speed: 0,
    warning: 0,
  });
  Object.assign(run.priorityAttacks[0], {
    active: true,
    stage: 'warning',
    kind: 'ground',
    x: 1200,
    y: 540,
    radius: 45,
    remaining: 1.2,
  });
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.equal(hasOverflightEscape(run), true);
  assert.equal(admitOverflightBodyState(run, shield, { heading: Math.PI }), false);
  assert.equal(shield.heading, 0);
});

test('resting against cover still admits an outward escape with the physical hull', () => {
  const run = quiet();
  run.terrain = createOverflightTerrain(
    {
      format: 'OverflightTerrainV2',
      id: 'wall-test',
      experimental: false,
      obstacles: [{ id: 'cover', x: 1100, y: 400, width: 400, height: 280, breakable: false }],
    },
    run.compiled.arena,
  );
  run.player.x = 1179.57;
  run.player.y = 400 - run.player.radius - 0.00001;
  assert.equal(
    overflightTerrainClear(
      run.terrain,
      run.player.x,
      run.player.y,
      run.player.x,
      run.player.y,
      run.player.radius,
    ),
    true,
  );
  assert.equal(
    overflightTerrainClear(
      run.terrain,
      run.player.x,
      run.player.y,
      run.player.x,
      run.player.y,
      run.player.radius + 2,
    ),
    false,
  );
  assert.equal(
    hasOverflightEscape(run, {
      kind: 'ground',
      x: run.player.x,
      y: run.player.y,
      radius: 70,
      remaining: 1.2,
    }),
    true,
  );
});

test('a finite eight-member Raid split pack sends its two coordinated members to opposite sides', () => {
  const run = quiet(true);
  const actors = [0, 1].map((member) =>
    spawnOverflightHuntEnemy(run, {
      family: 'patroller',
      x: 800,
      y: 540,
      speed: 60,
      warning: 0,
      movement: profile('split-front'),
      movementGroup: 'small-pack',
      movementMember: member,
      count: 8,
    }),
  );
  advance(run, 120);
  assert.ok(actors[0].y < 505 && actors[1].y > 575);
});
