import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createCoop } from '../coop/core.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';

function fixture() {
  const source = createStarterProject('team-shared-map');
  source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  const mission = source.missions[0];
  mission.modes = ['team'];
  mission.team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  mission.design.difficulty.coordination = 1;
  return source;
}

test('shared project registry compiles explicit Team missions and preserves exact map/preset identities', () => {
  const source = fixture(),
    before = structuredClone(source),
    project = compileContentProject(source);
  for (const [difficulty, lives, speed] of [
    ['gentle', 5, 2.04],
    ['standard', 3, 2.4],
    ['expert', 2, 2.64],
  ]) {
    const mission = resolveMission(project, 'nearby-shore', { mode: 'team', difficulty });
    const run = createCoop(mission.level);
    assert.equal(run.ruleset, 'revealline-coop.v4');
    assert.equal(run.team.reserves + 1, lives);
    assert.equal(run.rules.moveSpeed, 10);
    assert.equal(run.rules.boostMultiplier, 1);
    assert.deepEqual([...run.cells], project.maps[0].geometry.cells);
    assert(Math.abs(Math.hypot(run.enemies[0].vx, run.enemies[0].vy) - speed) < 1e-10);
    assert.equal(mission.officialProgressEligible, false);
    assert.equal(mission.format, 'ResolvedTeamMissionV1');
    assert(Object.isFrozen(mission.level));
  }
  assert.deepEqual(source, before);
});

test('Team Journey, execution catalog, CLI and pack reader share one compiled edition', () => {
  const source = fixture();
  const journey = resolveContentJourney(source, { mode: 'team', difficulty: 'expert' });
  const pack = journey.campaigns[0].runtime;
  assert.equal(pack.version, 'revealline-coop-pack.v2');
  assert.equal(validateCoopPack(pack).valid, true);
  assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
  assert.deepEqual(journey.missions[0].modes, ['team']);
  const catalog = createContentExecutionCatalog(source, { mode: 'team' });
  assert.equal(catalog.entries.length, 3);
  assert.deepEqual(catalog.select('opening', 'horizon-school', 'expert').campaign, pack);
  const cli = spawnSync(
    process.execPath,
    [
      'scripts/compile-content-project.mjs',
      '-',
      '--journey',
      '--mode',
      'team',
      '--difficulty',
      'expert',
    ],
    { input: JSON.stringify(source), encoding: 'utf8' },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), journey);
});

test('Team qualification fails closed instead of silently dropping unimplemented mechanics or seats', () => {
  for (const mutate of [
    (s) => {
      delete s.missions[0].team;
    },
    (s) => {
      s.missions[0].team.spawnIds = ['home', 'home'];
    },
    (s) => {
      s.missions[0].team.spawnIds[1] = 'missing';
    },
    (s) => {
      s.missions[0].design.difficulty.coordination = 0;
    },
    (s) => {
      s.missions[0].timeLimitSeconds = 30;
    },
    (s) => {
      s.missions[0].bonuses.push({ id: 'freeze', kind: 'freeze', x: 4, y: 4 });
    },
    (s) => {
      s.maps[0].terrain.push({ id: 'slow', kind: 'slow', x: 3, y: 3, w: 2, h: 2 });
    },
    (s) => {
      s.missions[0].actors[0].role = 'perimeter-patrol';
    },
    (s) => {
      s.missions[0].modes = ['solo'];
    },
  ]) {
    const source = fixture();
    mutate(source);
    assert.throws(() => compileContentProject(source));
  }
  const source = fixture();
  source.missions[0].modes = ['solo', 'versus', 'team'];
  source.missions[0].timeLimitSeconds = 30;
  assert.throws(
    () => compileContentProject(source),
    /timers/,
    'all advertised modes must validate, not only the first',
  );
});

test('foundation pack versions cannot mix old engines or preset-bound missions', () => {
  const pack = structuredClone(
    resolveContentJourney(fixture(), { mode: 'team' }).campaigns[0].runtime,
  );
  pack.levels.push({
    ...structuredClone(pack.levels[0]),
    id: 'different',
    journeyDifficulty: 'expert',
  });
  assert.equal(validateCoopPack(pack).valid, false);
  assert.match(validateCoopPack(pack).errors.join(' '), /consistent difficulty/);
  pack.levels.pop();
  pack.ruleset = 'revealline-coop.v3';
  assert.equal(validateCoopPack(pack).valid, false);
});

test('Studio inspects the real Team topology and both seats without substituting Solo gameplay', () => {
  const source = fixture();
  const before = structuredClone(source);
  const preview = prepareContentPreview(source, 'nearby-shore', { mode: 'team' });
  assert.equal(preview.manifest.format, 'ResolvedTeamMissionV1');
  assert.deepEqual(
    preview.markers.spawns.map(({ x, y }) => ({ x, y })),
    [
      { x: 32.5, y: 0.5 },
      { x: 32.5, y: 17.5 },
    ],
  );
  assert.equal(preview.capture.components.length, 1);
  assert.equal(preview.capture.components[0].retained, true);
  assert.deepEqual(preview.capture.components[0].enemyIds, ['keeper']);
  assert.equal(preview.scenario, null);
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) => {
          assert(args.every((value) => typeof value !== 'number' || Number.isFinite(value)));
          calls.push([method, ...args]);
        },
    },
  );
  assert.match(paintContentMap(ctx, preview), /Field anchors: keeper/);
  assert(
    calls.some(
      ([method, x, y, w, h]) =>
        method === 'strokeRect' && x === 445 && y === 235 && w === 20 && h === 20,
    ),
    'second seat gets an independent shape marker',
  );
  assert.throws(
    () => prepareContentPreview(source, 'nearby-shore', { mode: 'team', theme: {} }),
    /Only Solo has a Studio gameplay preview/,
  );
  assert.deepEqual(source, before);
});

test('Team topology diagnostics account for either seat reaching a chamber', () => {
  const source = fixture();
  source.maps[0].walls = [
    { x: 40, y: 8, w: 22, h: 1 },
    { x: 40, y: 28, w: 22, h: 1 },
    { x: 40, y: 9, w: 1, h: 19 },
    { x: 61, y: 9, w: 1, h: 19 },
  ];
  source.missions[0].actors[0].x = 50.5;
  source.missions[0].coverage = 0.99;
  let manifest = resolveMission(compileContentProject(source), 'nearby-shore', { mode: 'team' });
  assert(manifest.diagnostics.some((item) => item.code === 'unreachable-coverage-quota'));
  source.maps[0].foundations.push({ x: 44, y: 15, w: 3, h: 3 });
  source.maps[0].spawns[1] = { id: 'island', x: 45.5, y: 16.5 };
  manifest = resolveMission(compileContentProject(source), 'nearby-shore', { mode: 'team' });
  assert.equal(manifest.topology.inaccessibleRetainedCells, 0);
  assert.equal(manifest.topology.optimisticCoverageCeiling, 1);
  assert.equal(
    manifest.diagnostics.some((item) => item.code === 'unreachable-coverage-quota'),
    false,
  );
});
