import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  startCoop,
  stepCoop,
  pauseCoop,
  resumeCoop,
  validateCoopLevel,
  SAFE,
  FIELD,
} from '../coop/core.mjs';
import { COOP_ROVER_LEVEL_VERSION, COOP_ROVER_RULESET } from '../coop/foundations.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import { captureSeedEnemies, inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { coopArenaGuidance } from '../couch/coop-briefing.mjs';
import { coopFailureFeedback, coopRoamerCaption } from '../couch/coop-feedback.mjs';

const command = (direction = null, support = false) => ({ direction, boost: false, support });
const idle = [command(), command()];
function fixture({ reclaimed = false, contact = false } = {}) {
  return {
    version: COOP_ROVER_LEVEL_VERSION,
    id: 'team-roamer-contract',
    revision: '1',
    name: 'Team roamer contract',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: contact ? 5.5 : 10.5, y: contact ? 18.5 : 0.5 },
      { x: 71.5, y: 30.5 },
    ],
    walls: [],
    safeRects: reclaimed ? [{ x: 4, y: 15, w: 10, h: 6 }] : [],
    terrain: [],
    enemies: [
      { id: 'keeper', type: 'drifter', x: 50.5, y: 10.5, vx: 0, vy: 0, radius: 0.25 },
      { id: 'roamer', type: 'claimed-rover', x: 5.5, y: 18.5, vx: 1.6, vy: 0, radius: 0.25 },
    ],
    goal: { coverage: 0.95 },
    rules: { moveSpeed: 10, boostMultiplier: 1 },
  };
}
const rover = (run) => run.enemies.find((enemy) => enemy.id === 'roamer');
const advance = (run, ticks, commands = idle) => {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    stepCoop(run, commands);
    events.push(...structuredClone(run.events));
  }
  return events;
};

test('Team roamers require explicit v4 content/v6 rules; historical editions reject them', () => {
  const level = fixture();
  assert.equal(validateCoopLevel(level).valid, true);
  assert.equal(createCoop(level).ruleset, COOP_ROVER_RULESET);
  for (const version of [
    'revealline-coop-level.v1',
    'revealline-coop-level.v2',
    'revealline-coop-level.v3',
  ]) {
    const old = { ...level, version };
    if (version !== 'revealline-coop-level.v3') delete old.terrain;
    assert.equal(validateCoopLevel(old).valid, false);
  }
  const seam = fixture({ reclaimed: true });
  seam.enemies[1].x = 4;
  assert.equal(
    validateCoopLevel(seam).valid,
    false,
    'A body straddling field/reclaimed ground is not a valid authored spawn.',
  );
  const noTerrain = fixture();
  delete noTerrain.terrain;
  assert.equal(validateCoopLevel(noTerrain).valid, false);
  assert.throws(() => createCoop(level, { difficulty: 'expert' }), /compiled Journey edition/);
});

test('a dormant roamer does not move or retain field; legal closure activates the warning, not an alternate fill rule', () => {
  const level = fixture(),
    original = structuredClone(level),
    run = startCoop(createCoop(level));
  advance(run, 600);
  assert.equal(rover(run).x, 5.5);
  assert.equal(rover(run).rover.mode, 'dormant');
  assert.deepEqual(
    captureSeedEnemies(run).map((e) => e.id),
    ['keeper'],
  );
  const snapshot = inspectCaptureSnapshot(run, {
    trailCells: Array.from({ length: 34 }, (_, y) => (y + 1) * 72 + 10),
  });
  assert(snapshot.components.some((c) => !c.retained && c.cells.includes(18 * 72 + 5)));
  const events = [];
  while (run.players[0].y < 35 && !events.some((e) => e.type === 'cut.closed')) {
    stepCoop(run, [command('down'), command()]);
    events.push(...structuredClone(run.events));
    assert(run.tick < 1200);
  }
  assert.equal(run.cells[18 * 72 + 5], SAFE);
  assert.equal(run.cells[10 * 72 + 50], FIELD);
  assert.equal(rover(run).rover.mode, 'warning');
  const warning = events.find((e) => e.type === 'rover.warning');
  assert(warning);
  assert.equal(warning.activationTick - run.roverActorTick, 120);
  assert.equal(
    events.some((e) => e.type === 'player.downed'),
    false,
  );
  assert.equal(run.totalClaimable, createCoop(level).totalClaimable);
  advance(run, 119);
  assert.equal(rover(run).rover.mode, 'warning');
  assert.equal(rover(run).x, 5.5);
  const activation = advance(run, 1);
  assert.equal(rover(run).rover.mode, 'active');
  assert(activation.some((e) => e.type === 'rover.activated'));
  assert(rover(run).x > 5.5);
  assert.deepEqual(level, original);
});

test('full footprint, not the center, starts the warning; losing partial qualification cancels and rearms it', () => {
  const run = startCoop(createCoop(fixture()));
  const actor = rover(run);
  actor.x = 5.9;
  run.cells[18 * 72 + 5] = SAFE; // Unit arrangement: only one of two footprint cells reclaimed.
  advance(run, 1);
  assert.equal(actor.rover.mode, 'dormant');
  run.cells[18 * 72 + 6] = SAFE;
  assert(advance(run, 1).some((e) => e.type === 'rover.warning'));
  const first = actor.rover.activationTick;
  run.cells[18 * 72 + 6] = FIELD;
  assert(advance(run, 1).some((e) => e.type === 'rover.activationCancelled'));
  assert.equal(actor.rover.mode, 'dormant');
  run.cells[18 * 72 + 6] = SAFE;
  advance(run, 1);
  assert(actor.rover.activationTick > first);
});

test('warning is harmless to a reclaimed craft; activation can hit its body without an unfinished cut', () => {
  const run = startCoop(createCoop(fixture({ reclaimed: true, contact: true })));
  const warnings = advance(run, 120);
  assert.equal(run.players[0].cutting, false);
  assert.equal(run.players[0].status, 'active');
  assert.equal(
    warnings.some((e) => e.type === 'player.downed'),
    false,
  );
  const hits = advance(run, 1);
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[1].status, 'active');
  assert(
    hits.some(
      (e) => e.type === 'player.downed' && e.cause === 'enemy-player' && e.enemy === 'roamer',
    ),
  );
  assert.match(
    coopFailureFeedback(
      run,
      hits.find((e) => e.type === 'player.downed'),
    ).advice,
    /does not protect/,
  );
  assert.match(coopArenaGuidance(run.level).threatText, /do not retain field/);
  assert.match(coopArenaGuidance(run.level).startMessage, /escape corridor/);
  assert.match(
    coopRoamerCaption(warnings.find((e) => e.type === 'rover.warning')),
    /one active second/,
  );
  assert.match(
    coopRoamerCaption(hits.find((e) => e.type === 'rover.activated')),
    /reclaimed ground/,
  );
});

test('active roamers can hit either unfinished trail; dormant and warning bodies cannot', () => {
  for (const seat of [0, 1])
    for (const mode of ['dormant', 'warning', 'active']) {
      const run = startCoop(createCoop(fixture({ reclaimed: true })));
      const actor = rover(run),
        player = run.players[seat];
      // Unit contact arrangement: an unfinished field cell touches the reclaimed
      // boundary. A radius overlap can hit the trail without leaving the domain.
      actor.x = 4.25;
      actor.y = 18.5;
      actor.rover = { mode, activationTick: mode === 'warning' ? 121 : null };
      player.x = 3.5;
      player.y = 10.5;
      player.cellIndex = 10 * 72 + 3;
      player.cutting = true;
      player.trail = [{ index: 18 * 72 + 3, x: 3, y: 18 }];
      const events = advance(run, 1);
      assert.equal(
        events.some(
          (e) => e.type === 'player.downed' && e.player === seat && e.cause === 'enemy-trail',
        ),
        mode === 'active',
      );
    }
});

test('pause freezes the full warning and per-craft recovery grace protects reclaimed body contact', () => {
  const run = startCoop(createCoop(fixture({ reclaimed: true, contact: true })));
  advance(run, 60);
  pauseCoop(run);
  const before = structuredClone(run);
  advance(run, 600);
  assert.deepEqual(run, before);
  resumeCoop(run);
  run.players[0].graceUntil = run.time + 2;
  advance(run, 61);
  assert.equal(rover(run).rover.mode, 'active');
  assert.equal(run.players[0].status, 'active');
  assert.equal(run.players[1].status, 'active');
});

test('reclaimed roamers reflect at every domain edge and the world perimeter without entering field or walls', () => {
  for (const world of [false, true]) {
    const level = fixture({ reclaimed: true });
    level.enemies[1].vx = -1.6;
    if (world) level.safeRects = [{ x: 1, y: 15, w: 13, h: 6 }];
    const run = startCoop(createCoop(level)),
      actor = rover(run);
    let reversed = false;
    for (let tick = 0; tick < 1600; tick++) {
      stepCoop(run, idle);
      assert(fitsClassicDomain(run, actor, actor.radius, SAFE));
      assert(actor.x >= actor.radius && actor.x <= run.width - actor.radius);
      if (actor.vx > 0) reversed = true;
    }
    assert(reversed);
  }
});

test('Support can slow an active or about-to-activate roamer without shortening its warning and restores bounded speed', () => {
  for (const supportAt of [60, 130]) {
    const level = fixture({ reclaimed: true });
    level.spawns[0] = { x: 10.5, y: 20.5 };
    const run = startCoop(createCoop(level));
    advance(run, supportAt);
    advance(run, 1, [command(null, true), command()]);
    advance(run, Math.max(0, 121 - run.tick));
    assert.equal(rover(run).rover.mode, 'active');
    assert.equal(Math.hypot(rover(run).vx, rover(run).vy), 0.8);
    advance(run, 200);
    assert.equal(Math.hypot(rover(run).vx, rover(run).vy), 1.6);
  }
});

test('TeamMissionV3 compiles exact catalog speed tiers, nonretaining preview, importer and Journey at every preset', () => {
  const source = createTeamOpeningCandidates();
  source.actorCatalogId = 'journey-actors-v2';
  source.missions[0].team.format = 'TeamMissionV3';
  source.missions[0].actors.push({
    id: 'roamer',
    role: 'reclaimed-roamer',
    tier: 'measured',
    x: 10.5,
    y: 17.5,
    heading: [1, 0],
  });
  const project = compileContentProject(source);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const manifest = resolveMission(project, 'twin-landings', { mode: 'team', difficulty });
    assert.equal(manifest.level.version, COOP_ROVER_LEVEL_VERSION);
    assert.equal(manifest.level.enemies.find((e) => e.id === 'roamer').type, 'claimed-rover');
    assert.equal(
      inspectCaptureSnapshot(createCoop(manifest.level)).components.some((c) =>
        c.enemyIds.includes('roamer'),
      ),
      false,
    );
    const pack = createTeamTestPack(source, 'twin-landings', difficulty);
    assert.equal(pack.version, 'revealline-coop-pack.v4');
    assert.equal(pack.ruleset, COOP_ROVER_RULESET);
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert.deepEqual(
      resolveContentJourney(source, { mode: 'team', difficulty }).campaigns[0].runtime.levels,
      pack.levels,
    );
    assert.throws(
      () =>
        readCoopPack(
          JSON.stringify({
            ...pack,
            version: 'revealline-coop-pack.v3',
            ruleset: 'revealline-coop.v5',
          }),
        ),
      /matching Team runtime/,
    );
  }
  for (const format of ['TeamMissionV1', 'TeamMissionV2']) {
    const old = structuredClone(source);
    old.missions[0].team.format = format;
    assert.throws(
      () => resolveMission(compileContentProject(old), 'twin-landings', { mode: 'team' }),
      /unqualified/,
    );
  }
});
