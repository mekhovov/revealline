import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWholeImpactCandidates,
  createWholePressureCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { CURRENT_PRESSURE_ACTOR_CATALOG, journeyActors } from '../content-design/catalogs.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createRun } from '../core/index.mjs';
import { pressureWaypoint, updateEnemyPressure } from '../core/enemy-pressure.mjs';

const pursuit = ['return-in-reserve', 'two-ways-home', 'dogleg-transfer'];
const interception = ['crossed-bands', 'pressure-ladder', 'signal-channels'];
const changed = new Set([...pursuit, ...interception]);
const baseline = createWholeImpactCandidates({ artwork: true });
const source = createWholePressureCandidates({ artwork: true });
const project = compileContentProject(source);
const effectiveRoute = createAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
const effectiveProject = compileContentProject(effectiveRoute.source);
const effectiveRoster = Object.freeze({
  'return-in-reserve': {
    pressureId: 'carrier',
    enemyIds: ['carrier', 'keeper', 'outer', 'lower-keeper'],
  },
  'two-ways-home': {
    pressureId: 'carrier',
    enemyIds: ['carrier', 'keeper', 'frontier'],
  },
  'dogleg-transfer': {
    pressureId: 'upper-carrier',
    enemyIds: ['upper-carrier', 'lower-carrier', 'keeper'],
  },
  'crossed-bands': {
    pressureId: 'carrier',
    enemyIds: ['carrier', 'keeper', 'frontier'],
  },
  'pressure-ladder': {
    pressureId: 'east-carrier',
    enemyIds: ['east-carrier', 'west-carrier', 'frontier'],
  },
  'signal-channels': {
    pressureId: 'carrier',
    enemyIds: ['keeper', 'carrier', 'roamer'],
  },
});

test('v7 preserves the 91-mission v6 library and replaces exactly six ordinary keepers', () => {
  assert.equal(source.missions.length, 91);
  assert.deepEqual(source.maps, baseline.maps);
  assert.deepEqual(source.assets, baseline.assets);
  for (let index = 0; index < source.missions.length; index++) {
    const before = baseline.missions[index],
      after = source.missions[index];
    assert.equal(after.id, before.id);
    if (!changed.has(after.id)) {
      assert.deepEqual(after, before, after.id);
      continue;
    }
    assert.equal(after.actors.length, before.actors.length, after.id);
    const role = pursuit.includes(after.id) ? 'trail-pursuer' : 'heading-interceptor';
    assert.equal(after.actors.filter((actor) => actor.role === role).length, 1, after.id);
    const differences = after.actors.filter(
      (actor, actorIndex) => actor.role !== before.actors[actorIndex].role,
    );
    assert.equal(differences.length, 1, after.id);
    assert.equal(
      before.actors.find((actor) => actor.id === differences[0].id).role,
      'field-keeper',
      after.id,
    );
    assert.equal(
      after.design.introduces.length,
      [pursuit[0], interception[0]].includes(after.id) ? 1 : 0,
    );
  }
});

test('current pressure catalog preserves old roles and resolves Pressure Lines timing once', () => {
  assert.equal(project.actors.id, CURRENT_PRESSURE_ACTOR_CATALOG.id);
  for (let version = 1; version <= 8; version++) {
    const old = journeyActors(`journey-actors-v${version}`);
    for (const [id, role] of Object.entries(old.roles))
      if (!['trail-pursuer', 'heading-interceptor'].includes(id))
        assert.deepEqual(CURRENT_PRESSURE_ACTOR_CATALOG.roles[id], role, `${version}/${id}`);
  }
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const id of changed) {
      for (const mode of ['solo', 'versus']) {
        const manifest = resolveMission(project, id, { difficulty, mode });
        const pressure = manifest.level.classic.enemyPressure.actors;
        assert.equal(pressure.length, 1, `${id}/${mode}/${difficulty}`);
        assert.equal(pressure[0].warningTicks, 90);
        assert.equal(pressure[0].commitTicks, 144);
        assert.equal(
          pressure[0].cooldownTicks,
          { gentle: 441, standard: 300, expert: 229 }[difficulty],
        );
        assert.equal(pressure[0].mode, pursuit.includes(id) ? 'trail-pursuit' : 'head-intercept');
        assert.equal(pressure[0].leadTicks, pursuit.includes(id) ? 0 : 36);
        const actor = manifest.level.enemies.find((enemy) => enemy.id === pressure[0].id);
        assert(
          Math.abs(
            Math.hypot(actor.vx, actor.vy) -
              { gentle: 2.4, standard: 3.36, expert: 4.2 }[difficulty],
          ) < 1e-9,
        );
      }
    }
});

test('v6 remains historical while v7 keeps isolated progress after the normal entry advances', async () => {
  const old = createAuthoredJourneyRoute('whole-spatial-v6');
  const route = createAuthoredJourneyRoute('whole-spatial-v7');
  assert.deepEqual(await loadAuthoredJourneyRoute(route.id), route);
  assert.equal(route.profileKey, 'journey-whole-spatial-v7');
  assert.notEqual(route.profileKey, old.profileKey);
  assert.equal(
    old.source.missions
      .flatMap((mission) => mission.actors)
      .some((actor) => ['trail-pursuer', 'heading-interceptor'].includes(actor.role)),
    false,
  );
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v7');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?journey=whole-spatial-v7&return=solo',
  );
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, 'whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.team, 'team-cultural-specialist-originals-1');
});

test('pressure successor leaves the first three Prologue missions byte-equivalent', () => {
  assert.deepEqual(source.missions.slice(0, 3), baseline.missions.slice(0, 3));
  for (const id of changed) {
    const mission = source.missions.find((candidate) => candidate.id === id);
    assert(
      [...mission.design.introduces, ...mission.design.practices].includes(
        pursuit.includes(id) ? 'trail-pursuer' : 'heading-interceptor',
      ),
      id,
    );
  }
});

test('the actual default route resolves one effective pressure role and its exact roster for every preset', () => {
  assert.equal(effectiveRoute.id, 'whole-spatial-v25');
  for (const [id, expected] of Object.entries(effectiveRoster))
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const manifest = resolveMission(effectiveProject, id, { difficulty, mode });
        const pressure = manifest.level.classic.enemyPressure.actors;
        assert.deepEqual(
          manifest.level.enemies.map((enemy) => enemy.id),
          expected.enemyIds,
          `${id}/${mode}/${difficulty} effective enemy roster`,
        );
        assert.equal(pressure.length, 1, `${id}/${mode}/${difficulty} pressure count`);
        assert.equal(pressure[0].id, expected.pressureId, `${id}/${mode}/${difficulty}`);
        assert.equal(
          pressure[0].mode,
          pursuit.includes(id) ? 'trail-pursuit' : 'head-intercept',
          `${id}/${mode}/${difficulty}`,
        );
        assert.deepEqual(
          {
            warningTicks: pressure[0].warningTicks,
            commitTicks: pressure[0].commitTicks,
            cooldownTicks: pressure[0].cooldownTicks,
          },
          {
            warningTicks: 90,
            commitTicks: 144,
            cooldownTicks: { gentle: 441, standard: 300, expert: 229 }[difficulty],
          },
          `${id}/${mode}/${difficulty} resolved timing`,
        );
      }
});

test('default-route pressure actors lock once and keep the committed target after the player changes course', () => {
  for (const [id, expected] of Object.entries(effectiveRoster)) {
    const manifest = resolveMission(effectiveProject, id, {
      difficulty: 'standard',
      mode: 'solo',
    });
    const run = createRun(manifest.level, { seed: 1 });
    const enemy = run.enemies.find((candidate) => candidate.id === expected.pressureId);
    const pressure = enemy.classic.pressure;

    run.player.cutting = true;
    run.player.direction = 'right';
    run.player.speed = 0;
    run.player.x = enemy.x + 0.4;
    run.player.y = enemy.y;
    run.trail = [1];
    run.trailSegments = [{ x1: enemy.x + 0.35, y1: enemy.y, x2: enemy.x + 0.45, y2: enemy.y }];
    updateEnemyPressure(run);
    assert.equal(pressure.phase, 'warning', `${id} acquires a warning target`);
    const locked = structuredClone(pressure.target);

    run.player.direction = 'left';
    run.player.x = enemy.x - 0.4;
    run.trailSegments = [{ x1: enemy.x - 0.45, y1: enemy.y, x2: enemy.x - 0.35, y2: enemy.y }];
    run.classic.actorTick = pressure.warningUntil;
    updateEnemyPressure(run);

    assert.equal(pressure.phase, 'committed', `${id} enters one finite commitment`);
    assert.deepEqual(pressure.target, locked, `${id} does not retarget after warning`);
    const waypoint = pressureWaypoint(enemy, 1, 1);
    assert(waypoint, `${id} exposes its committed waypoint`);
    assert.deepEqual(waypoint.target, locked, `${id} steers only toward the locked target`);
  }
});
