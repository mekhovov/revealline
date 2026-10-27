import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
  chooseOverflightUpgrade,
  rerollOverflightUpgrades,
  spawnOverflightEnemy,
  dropOverflightSalvage,
  damageOverflightArea,
} from '../overflight/core.mjs';
import { compileOverflightProject, createOverflightProject } from '../overflight/project.mjs';
import { createOverflightClock, createOverflightInputGate } from '../overflight/host-loop.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import { pilot, selectCard } from '../overflight/review-pilot.mjs';
import {
  overflightTerrainWaypoint,
  damageOverflightTerrain,
  createOverflightTerrainFixture,
} from '../overflight/terrain.mjs';
import { createOverflightMastery, OVERFLIGHT_MASTERY_FORMAT } from '../overflight/mastery.mjs';
import {
  assessmentIdentity,
  assessmentDigest,
  encodeSurvivalAssessment,
  decodeSurvivalAssessment,
  pauseAssessment,
  MAX_ASSESSMENT_BYTES,
} from './helpers/survival-roundtrip.mjs';

// The assessment has no packaged build. This exact core-source digest supplies
// the required opaque compatibility token; F04b must use the real package ID.
const build = createHash('sha256')
  .update(await readFile(new URL('../overflight/core.mjs', import.meta.url)))
  .digest('hex');
const create = (options = {}, settings = {}) => {
  const run = createOverflightRun(
    compileOverflightProject(createOverflightProject(options)),
    settings,
  );
  startOverflight(run);
  return run;
};
function advance(run, count) {
  for (let index = 0; index < count && ['playing', 'upgrade'].includes(run.phase); index++) {
    if (run.phase === 'upgrade')
      chooseOverflightUpgrade(run, (selectCard(run, 'fan') ?? run.offers[0]).id);
    else stepOverflight(run, pilot(run));
  }
}
function roundTrip(run) {
  const source = pauseAssessment(run, build);
  const restored = decodeSurvivalAssessment(source, assessmentIdentity(run, build));
  assert.deepEqual(
    restored,
    run,
    'Every live field survives, including inactive slots and scratch state',
  );
  assert.notEqual(restored.enemies, run.enemies);
  assert.equal(restored._grid.records, restored.enemies);
  for (const support of restored._supportSources)
    if (support) assert.equal(support, restored.enemies[support._slot]);
  assert(restored.projectiles.every((entry) => entry.hits instanceof Set));
  const before = assessmentDigest(restored);
  stepOverflight(restored, { x: 1, boost: true });
  assert.equal(assessmentDigest(restored), before, 'Restored state does not advance before Resume');
  return { source, restored };
}

for (const options of [
  { legacy: true, seed: 7 },
  { rulesVersion: 2, seed: 42, encounterSet: 'crossing' },
  { rulesVersion: 3, seed: 7, difficulty: 'veteran', world: 'field-crossing' },
  ...[
    'field-crossing',
    'freight-depot',
    'relay-ruins',
    'river-port',
    'chalk-quarry',
    'orchard-strongpoint',
  ].map((world, index) => ({
    rulesVersion: 4,
    world,
    seed: index % 2 ? 42 : 7,
    difficulty: index % 2 ? 'relaxed' : 'standard',
  })),
]) {
  test(`complete JSON graph round-trip continues ${JSON.stringify(options)}`, () => {
    const run = create(options, {
      characterId: 'carrier',
      flightTraits: true,
      airframes: options.seed === 7 ? 3 : 1,
    });
    advance(run, 600);
    assert.equal(run.phase, 'playing');
    assert(run.enemies.some((entry) => entry.active));
    const { restored } = roundTrip(run);
    resumeOverflight(run);
    resumeOverflight(restored);
    advance(run, 240);
    advance(restored, 240);
    assert.equal(
      assessmentDigest(restored),
      assessmentDigest(run),
      'Uninterrupted and restored trajectories match',
    );
  });
}

test('pending upgrade, reroll stream, consumed choice and held-confirm release survive', () => {
  const run = create({ rulesVersion: 4, world: 'field-crossing' });
  dropOverflightSalvage(run, run.player.x, run.player.y, run.progression.nextThreshold);
  stepOverflight(run);
  assert.equal(run.phase, 'upgrade');
  const { restored } = roundTrip(run);
  assert.equal(restored._resumePhase, 'upgrade');
  resumeOverflight(run);
  resumeOverflight(restored);
  assert(rerollOverflightUpgrades(run));
  assert(rerollOverflightUpgrades(restored));
  assert.deepEqual(restored.offers, run.offers);
  const choice = run.offers[0].id;
  chooseOverflightUpgrade(run, choice);
  chooseOverflightUpgrade(restored, choice);
  assert.equal(
    chooseOverflightUpgrade(restored, choice),
    false,
    'Same offer cannot be consumed twice',
  );
  for (const boost of [true, true, false, true]) {
    stepOverflight(run, { x: 1, boost });
    stepOverflight(restored, { x: 1, boost });
  }
  assert.equal(restored.stats.boostsUsed, 1);
  assert.equal(assessmentDigest(restored), assessmentDigest(run));
});

test('a full earned Single Drone attempt remains identical through repeated late-run checkpoints', (t) => {
  const run = create({ rulesVersion: 4, world: 'field-crossing', seed: 7, difficulty: 'relaxed' });
  advance(run, 3600);
  assert.equal(run.phase, 'playing');
  let { restored, source } = roundTrip(run);
  let largest = Buffer.byteLength(source);
  resumeOverflight(run);
  resumeOverflight(restored);
  advance(run, 22000);
  assert.equal(run.phase, 'won', 'The unchanged ordinary-input policy completes the encounter');
  for (const boundary of [6000, 11400, 16500, 19200]) {
    while (restored.tick < boundary && ['playing', 'upgrade'].includes(restored.phase))
      advance(restored, 1);
    assert.equal(restored.phase, 'playing');
    const next = roundTrip(restored);
    largest = Math.max(largest, Buffer.byteLength(next.source));
    restored = next.restored;
    resumeOverflight(restored);
  }
  advance(restored, 5000);
  assert.equal(assessmentDigest(restored), assessmentDigest(run));
  assert.equal(restored.progression.choices, 10);
  assert(restored.goals.eliteDefeated && restored.goals.finalDefeated);
  t.diagnostic(
    `Full attempt: ${restored.tick} ticks, ${restored.progression.choices} earned choices; largest assessment checkpoint ${largest} bytes.`,
  );
});

test('an armed supply reward is claimed once after restoring, including a second suspension', () => {
  const run = create({ rulesVersion: 3, seed: 7 });
  run.tick = 5399;
  stepOverflight(run);
  const cache = run.caches[0];
  assert.equal(cache.state, 'locked');
  for (const enemy of run.enemies) if (cache.guardIds.includes(enemy.id)) enemy.warning = 0;
  rebuildOverflightGrid(run._grid, run.enemies);
  damageOverflightArea(run, cache.x, cache.y, 150, 10000);
  stepOverflight(run);
  while (run.phase === 'upgrade') chooseOverflightUpgrade(run, run.offers[0].id);
  assert.equal(cache.state, 'open');
  Object.assign(run.player, { x: cache.x + 200, y: cache.y });
  stepOverflight(run);
  assert(cache.armed);
  const { restored } = roundTrip(run);
  resumeOverflight(run);
  resumeOverflight(restored);
  const reward = cache.rewards.find((entry) => entry.id === 'overdrive');
  for (const candidate of [run, restored]) {
    Object.assign(candidate.player, { x: reward.x, y: reward.y });
    stepOverflight(candidate);
    assert.equal(candidate.stats.cachesClaimed, 1);
    assert(candidate.player.overdriveReady);
    assert.equal(candidate.caches[0].selectedReward, 'overdrive');
  }
  assert.equal(assessmentDigest(restored), assessmentDigest(run));
  const next = roundTrip(restored).restored;
  resumeOverflight(next);
  for (let index = 0; index < 10; index++) stepOverflight(next);
  assert.equal(next.stats.cachesClaimed, 1, 'The claimed cache is not a new reward after restart');
});

test('three-airframe replacement protection, retained build and final defeat continue identically', () => {
  const run = create({ legacy: true }, { airframes: 3 });
  run.build.primary = { rank: 2, branch: 'double', evolved: false };
  run.player.hull = 20;
  const enemy = spawnOverflightEnemy(run, {
    x: run.player.x,
    y: run.player.y,
    hp: 1000,
    warning: 0,
    speed: 0,
  });
  stepOverflight(run);
  assert.equal(run.airframesRemaining, 2);
  assert.equal(run.player.invulnerable, 1.5);
  const { restored } = roundTrip(run);
  resumeOverflight(run);
  resumeOverflight(restored);
  advance(run, 30);
  advance(restored, 30);
  assert.equal(assessmentDigest(restored), assessmentDigest(run));
  for (let loss = 0; loss < 2; loss++) {
    for (const candidate of [run, restored]) {
      candidate.player.hull = 20;
      candidate.player.invulnerable = 0;
      Object.assign(candidate.enemies[enemy._slot], {
        x: candidate.player.x,
        y: candidate.player.y,
      });
      stepOverflight(candidate);
    }
    assert.equal(assessmentDigest(restored), assessmentDigest(run));
  }
  assert.equal(restored.phase, 'lost');
  assert.equal(restored.airframesRemaining, 0);
  assert.equal(restored.build.primary.branch, 'double');
});

test('terrain maps, Infinity, support aliases, hit sets and pool order survive a fresh process', () => {
  const project = createOverflightProject({ rulesVersion: 3, seed: 31 });
  project.terrain = createOverflightTerrainFixture(project.arena);
  const run = createOverflightRun(compileOverflightProject(project));
  startOverflight(run);
  advance(run, 180);
  const support = spawnOverflightEnemy(run, {
    family: 'radar-truck',
    x: run.player.x + 200,
    y: run.player.y,
    warning: 0,
  });
  assert(support && run._supportSources.includes(support));
  rebuildOverflightGrid(run._grid, run.enemies);
  const obstacle = run.terrain.obstacles.find((entry) => entry.breakable);
  assert(obstacle);
  damageOverflightTerrain(
    run.terrain,
    obstacle.x + obstacle.width / 2,
    obstacle.y + obstacle.height / 2,
    100,
    77,
  );
  // Populate real navigation Maps even when the short opening route has not yet
  // crossed cover. No invented typed-array or reference fixtures are injected.
  for (const cover of run.terrain.obstacles.filter((entry) => !entry.breakable)) {
    overflightTerrainWaypoint(
      run.terrain,
      { x: cover.x - 30, y: cover.y + cover.height / 2, radius: 9 },
      { x: cover.x + cover.width + 30, y: cover.y + cover.height / 2 },
      run.compiled.arena,
    );
  }
  assert(run.terrain.graphs.size > 0 && run.terrain.fields.size > 0);
  assert(run.terrain.obstacles.some((entry) => entry.hp === Infinity));
  // A previously hit actor must remain remembered by a live piercing projectile.
  const projectile = run.projectiles[run._projectileFree.pop()];
  Object.assign(projectile, {
    active: true,
    x: support.x,
    y: support.y,
    vx: 0,
    vy: 0,
    radius: 20,
    remaining: 0.5,
    damage: 10,
    piercing: true,
  });
  projectile.hits.add(support.id);
  const { source, restored } = roundTrip(run);
  assert(restored.projectiles[projectile.id].hits.has(support.id));
  assert(restored.terrain.graphs instanceof Map);
  const helper = new URL('./helpers/survival-roundtrip.mjs', import.meta.url).href;
  const core = new URL('../overflight/core.mjs', import.meta.url).href;
  const worker = `import { readFileSync } from 'node:fs';
    import { decodeSurvivalAssessment, assessmentDigest } from ${JSON.stringify(helper)};
    import { resumeOverflight, stepOverflight } from ${JSON.stringify(core)};
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const run = decodeSurvivalAssessment(input.source, input.identity);
    resumeOverflight(run);
    for (let tick = 0; tick < 90; tick++) stepOverflight(run, { x: 1, y: 0, boost: tick > 30 });
    process.stdout.write(assessmentDigest(run));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', worker], {
    input: JSON.stringify({ source, identity: assessmentIdentity(run, build) }),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 15000,
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  resumeOverflight(run);
  for (let tick = 0; tick < 90; tick++) stepOverflight(run, { x: 1, y: 0, boost: tick > 30 });
  assert.equal(child.stdout, assessmentDigest(run), 'New process reaches the same complete state');
});

test('exact build, compiled content, unsupported hosts and terminal states are rejected', () => {
  const run = create();
  const source = pauseAssessment(run, build),
    identity = assessmentIdentity(run, build);
  for (const expected of [
    { ...identity, build: '0'.repeat(64) },
    { ...identity, project: 'different' },
    { ...identity, compiled: '0'.repeat(64) },
  ])
    assert.throws(() => decodeSurvivalAssessment(source, expected), /Incompatible/);
  const future = JSON.parse(source);
  future.format = 'Future';
  assert.throws(() => decodeSurvivalAssessment(JSON.stringify(future), identity), /format/);
  assert.throws(
    () => decodeSurvivalAssessment(' '.repeat(MAX_ASSESSMENT_BYTES + 1), identity),
    /byte limit/,
  );
  for (const changes of [
    { phase: 'won' },
    { phase: 'lost' },
    { airframes: 2 },
    { review: true },
    { fixture: 'reference' },
    { hunt: {} },
    { riy: {} },
    { upgradePolicy: { apply() {} } },
  ])
    assert.throws(() => encodeSurvivalAssessment({ ...run, ...changes }, identity));
  assert.throws(
    () => encodeSurvivalAssessment({ ...run, unexpectedCallback() {} }, identity),
    /executable/,
  );
  assert.throws(() => encodeSurvivalAssessment({ ...run, missingNumber: NaN }, identity), /NaN/);
  assert.throws(() =>
    encodeSurvivalAssessment(
      { ...run, compiled: { ...run.compiled, difficulty: 'veteran' } },
      identity,
    ),
  );
});

test('fresh host clock and input gate introduce no absent-time catch-up or held confirm', () => {
  const run = create();
  advance(run, 10);
  const { restored } = roundTrip(run),
    tick = restored.tick;
  const clock = createOverflightClock(),
    gate = createOverflightInputGate();
  const step = () => stepOverflight(restored, gate.sample({ x: 1, boost: true }));
  clock.advance(86_400_000, false, step);
  clock.advance(86_410_000, false, step);
  assert.equal(restored.tick, tick);
  resumeOverflight(restored);
  clock.reset(86_410_000);
  clock.advance(86_410_017, true, step);
  assert.equal(restored.tick, tick + 1);
  assert.equal(restored.stats.boostsUsed, 0);
  assert.equal(gate.sample({ boost: false }).boost, false);
  assert.equal(gate.sample({ boost: true }).boost, true);
});

test('assessment records remaining cross-restart result ownership without claiming durable deduplication', async () => {
  let state = { format: OVERFLIGHT_MASTERY_FORMAT, entries: {} },
    writes = 0;
  const backend = {
    async read() {
      return structuredClone(state);
    },
    async update(fn) {
      writes++;
      state = fn(state);
      return structuredClone(state);
    },
  };
  const run = create();
  run.phase = 'won';
  run.time = 360;
  run.tick = 21600;
  const first = createOverflightMastery({ backend });
  const saved = await first.record(run);
  await first.record(run);
  assert.equal(writes, 1, 'Current owner protects the same object');
  first.dispose();
  const reopened = createOverflightMastery({ backend });
  const repeated = await reopened.record(structuredClone(run));
  assert.equal(writes, 2, 'A reopened owner has no durable attempt-consumption token');
  assert.deepEqual(
    repeated.achieved,
    saved.achieved,
    'Flags are monotonic, not duplicated counters',
  );
  assert.deepEqual(
    repeated.previous,
    repeated.last,
    'Previous-attempt comparison changes on replay',
  );
  reopened.dispose();
});
