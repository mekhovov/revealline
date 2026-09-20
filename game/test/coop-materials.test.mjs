import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, validateCoopLevel, FIELD, SAFE } from '../coop/core.mjs';
import { COOP_TERRAIN_LEVEL_VERSION, COOP_TERRAIN_RULESET } from '../coop/foundations.mjs';
import { coopTerrainContact } from '../coop/terrain.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { coopArenaGuidance } from '../couch/coop-briefing.mjs';
import { coopFailureFeedback } from '../couch/coop-feedback.mjs';
import { terrainTransitionCaption } from '../ui/terrain-feedback.mjs';

const command = (direction = null, support = false) => ({ direction, boost: false, support });
function fixture(terrain = []) {
  return {
    version: COOP_TERRAIN_LEVEL_VERSION,
    id: 'team-material-contract',
    revision: '1',
    name: 'Team material contract',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 0.5, y: 18.5 },
      { x: 71.5, y: 18.5 },
    ],
    walls: [],
    safeRects: [
      { x: 5, y: 16, w: 3, h: 5 },
      { x: 64, y: 16, w: 3, h: 5 },
    ],
    terrain,
    enemies: [
      { id: 'north', type: 'drifter', x: 20.5, y: 8.5, vx: 1, vy: 0, radius: 0.25 },
      { id: 'south', type: 'drifter', x: 50.5, y: 28.5, vx: -1, vy: 0, radius: 0.25 },
    ],
    goal: { coverage: 0.95 },
    rules: { moveSpeed: 10, boostMultiplier: 1 },
  };
}
const slow = { id: 'slow', kind: 'slow', x: 1, y: 18, w: 3, h: 1 };
const lethal = { id: 'lethal', kind: 'lethal', x: 2, y: 18, w: 1, h: 1 };

test('new Team terrain edition is explicit; old foundation/historical editions reject terrain rather than reinterpret it', () => {
  assert.equal(validateCoopLevel(fixture([slow])).valid, true);
  for (const version of ['revealline-coop-level.v1', 'revealline-coop-level.v2']) {
    const old = { ...fixture([slow]), version };
    assert.equal(validateCoopLevel(old).valid, false);
  }
  for (const terrain of [undefined, [{ ...slow, kind: 'ice' }], [slow, slow], [{ ...slow, x: 0 }]])
    assert.equal(validateCoopLevel(fixture(terrain)).valid, terrain === undefined);
  const absent = fixture();
  delete absent.terrain;
  assert.equal(validateCoopLevel(absent).valid, false);
  assert.throws(() => createCoop(fixture(), { difficulty: 'expert' }), /compiled Journey edition/);
});

test('slow field halves only the affected active craft speed and does not alter enemy motion or its partner', () => {
  const run = createCoop(fixture([slow])),
    plain = createCoop(fixture());
  startCoop(run);
  startCoop(plain);
  for (let tick = 0; tick < 12; tick++) {
    stepCoop(run, [command('right'), command('left')]);
    stepCoop(plain, [command('right'), command('left')]);
  }
  assert.equal(run.ruleset, COOP_TERRAIN_RULESET);
  assert(Math.abs(run.players[0].x - 1.25) < 1e-8);
  assert(Math.abs(plain.players[0].x - 1.5) < 1e-8);
  assert.deepEqual(run.enemies, plain.enemies);
  assert.deepEqual(run.players[1], plain.players[1]);
  assert.equal(run.totalClaimable, plain.totalClaimable);
});

test('swept lethal contact downs only its craft, explains the material and cannot be cancelled by Support', () => {
  for (const support of [false, true]) {
    const run = createCoop(fixture([lethal]));
    startCoop(run);
    let hit;
    for (let tick = 0; tick < 40 && !hit; tick++) {
      stepCoop(run, [command('right', support), command()]);
      hit = run.events.find((event) => event.type === 'player.downed');
    }
    assert.equal(hit?.cause, 'lethal-terrain');
    assert.equal(hit.player, 0);
    assert.equal(Object.hasOwn(hit, 'enemy'), false);
    assert.equal(run.players[0].cutting, false);
    assert.equal(run.players[1].status, 'active');
    assert.equal(run.claimedCount, 0);
    assert.equal(run.cells[18 * 72 + 2], FIELD);
    assert.match(coopFailureFeedback(run, hit).advice, /Support affects enemies, not terrain/);
  }
});

test('lethal sweep uses the expanded-box radius, including corners, and inactive/material-free cases stay silent', () => {
  const run = createCoop(fixture([lethal]));
  const player = { ...run.players[0], x: 1.5, y: 18.5 };
  const hit = coopTerrainContact(run, player, { x: 10, y: 0 }, 0.1);
  assert(Math.abs(hit.time - 0.032) < 1e-10);
  assert.equal(hit.index, 18 * 72 + 2);
  const corner = coopTerrainContact(run, { ...player, y: 17.9 }, { x: 10, y: 0 }, 0.1);
  assert(Math.abs(corner.time - 0.032) < 1e-10, 'Expanded-box corner matches Solo contact.');
  assert.equal(coopTerrainContact(run, { ...player, y: 17.81 }, { x: 10, y: 0 }, 0.1), null);
  assert.equal(
    coopTerrainContact(run, { ...player, status: 'downed' }, { x: 10, y: 0 }, 0.1),
    null,
  );
  const protectedLevel = fixture([{ ...lethal, x: 5 }]);
  const protectedRun = createCoop(protectedLevel);
  assert.equal(protectedRun.terrain[18 * 72 + 5], 2);
  assert.equal(coopTerrainContact(protectedRun, { ...player, x: 4.5 }, { x: 10, y: 0 }, 0.1), null);
});

test('both legal closures neutralize slow ground, retain material definitions and stop with fresh controls deterministically', () => {
  const level = fixture([slow, { ...slow, id: 'east-slow', x: 68 }]);
  const run = createCoop(level),
    twin = createCoop(level),
    before = structuredClone(level);
  startCoop(run);
  startCoop(twin);
  const captions = [],
    closed = [];
  for (let tick = 0; tick < 150; tick++) {
    const commands = [command('right'), command('left')];
    stepCoop(run, commands);
    stepCoop(twin, commands);
    for (const event of run.events) {
      if (event.type === 'cut.closed') closed.push(event.player);
      if (event.type === 'cells.claimed') captions.push(terrainTransitionCaption(run, event));
    }
  }
  assert.deepEqual(run, twin);
  assert.deepEqual(level, before);
  assert.deepEqual(closed.sort(), [0, 1]);
  for (const x of [1, 2, 3, 68, 69, 70]) {
    assert.equal(run.cells[18 * 72 + x], SAFE);
    assert.equal(run.terrain[18 * 72 + x], 1);
  }
  assert(captions.some((caption) => /slow-field cells neutralized/.test(caption)));
  assert(run.players.every((player) => player.status === 'active' && player.direction === null));
  assert.equal(run.totalClaimable, createCoop(level).totalClaimable);
});

test('a legal enclosure neutralizes lethal ground for both partners without changing the quota', () => {
  const level = fixture([{ ...lethal, y: 17 }]);
  level.spawns[1] = { x: 0.5, y: 17.5 };
  const run = createCoop(level),
    total = run.totalClaimable,
    events = [];
  startCoop(run);
  const advance = (direction, ticks, seat = 0) => {
    for (let tick = 0; tick < ticks; tick++) {
      stepCoop(run, seat === 0 ? [command(direction), command()] : [command(), command(direction)]);
      events.push(...run.events);
    }
  };
  advance('right', 80);
  advance('up', 240);
  assert.equal(run.cells[17 * 72 + 2], SAFE);
  assert.equal(run.terrain[17 * 72 + 2], 2);
  assert.equal(run.totalClaimable, total);
  assert(events.filter((event) => event.type === 'cut.closed').length >= 2);
  advance('right', 45, 1);
  assert(run.players[1].x > 3.5, 'Partner crosses the formerly lethal tile.');
  assert.equal(
    events.some((event) => event.type === 'player.downed'),
    false,
  );
  assert(run.players.every((player) => player.status === 'active'));
});

test('explicit TeamMissionV2 uses the shared map compiler, exact export/import and Journey edition for every preset', () => {
  const source = createTeamOpeningCandidates();
  source.missions[0].team.format = 'TeamMissionV2';
  source.maps[0].terrain = [
    { ...slow, x: 28, y: 12 },
    { ...lethal, x: 40, y: 20 },
  ];
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const project = compileContentProject(source);
    const manifest = resolveMission(project, 'twin-landings', { mode: 'team', difficulty });
    const run = createCoop(manifest.level);
    assert.deepEqual([...run.terrain], project.maps[0].geometry.terrain);
    const pack = createTeamTestPack(source, 'twin-landings', difficulty);
    assert.equal(pack.version, 'revealline-coop-pack.v3');
    assert.equal(pack.ruleset, COOP_TERRAIN_RULESET);
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert.deepEqual(
      resolveContentJourney(source, { mode: 'team', difficulty }).campaigns[0].runtime.levels,
      pack.levels,
    );
    const guidance = coopArenaGuidance(manifest.level);
    assert.match(guidance.threatText, /Paired dashes/);
    assert.match(guidance.threatText, /Framed crosses/);
    assert.match(guidance.threatText, /both craft/);
  }
  const old = structuredClone(source);
  old.missions[0].team.format = 'TeamMissionV1';
  assert.throws(
    () => resolveMission(compileContentProject(old), 'twin-landings', { mode: 'team' }),
    /unqualified terrain/,
  );
});
