import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  ACTOR_CATALOG,
  ROVER_ACTOR_CATALOG,
  journeyActors,
  compileActor,
} from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const rover = {
  id: 'roamer',
  role: 'reclaimed-roamer',
  tier: 'measured',
  x: 4.5,
  y: 10.5,
  heading: [1, 0],
};
function source() {
  const project = createStarterProject();
  project.actorCatalogId = ROVER_ACTOR_CATALOG.id;
  project.maps[0].foundations = [];
  project.maps[0].spawns[0] = { id: 'home', x: 10.5, y: 0.5 };
  project.missions[0].coverage = 0.9;
  project.missions[0].actors = [
    { id: 'keeper', role: 'field-keeper', tier: 'measured', x: 60.5, y: 25.5, heading: [0, -1] },
    structuredClone(rover),
  ];
  return project;
}

test('actor catalogue v2 extends explicit authored capability without rewriting v1', () => {
  assert.equal(journeyActors(), ACTOR_CATALOG);
  assert.equal(journeyActors('journey-actors-v2'), ROVER_ACTOR_CATALOG);
  assert.deepEqual(Object.keys(ACTOR_CATALOG.roles), [
    'field-keeper',
    'perimeter-patrol',
    'frontier-patrol',
  ]);
  for (const [id, role] of Object.entries(ACTOR_CATALOG.roles))
    assert.equal(ROVER_ACTOR_CATALOG.roles[id], role);
  assert.equal(ROVER_ACTOR_CATALOG.roles['reclaimed-roamer'].retainsField, false);
  assert(Object.isFrozen(ROVER_ACTOR_CATALOG.roles['reclaimed-roamer'].speeds));
  assert.throws(() => journeyActors('latest'), /registered/);
  assert.throws(() => journeyActors('__proto__'), /registered/);
  assert.throws(() => compileActor(rover), /Unsupported actor role/);
  const legacy = createStarterProject();
  const promoted = structuredClone(legacy);
  promoted.actorCatalogId = ROVER_ACTOR_CATALOG.id;
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const mode of ['solo', 'versus']) {
      const before = resolveMission(compileContentProject(legacy), 'nearby-shore', {
        difficulty,
        mode,
      });
      const after = resolveMission(compileContentProject(promoted), 'nearby-shore', {
        difficulty,
        mode,
      });
      assert.deepEqual(after.level, before.level);
      assert.equal(after.simulationIdentity, before.simulationIdentity);
    }
});

test('roamer authoring uses bounded shared tiers and fails closed for unqualified Team', () => {
  for (const [difficulty, factor] of [
    ['gentle', 0.85],
    ['standard', 1],
    ['expert', 1.1],
  ])
    for (const [tier, speed] of Object.entries(
      ROVER_ACTOR_CATALOG.roles['reclaimed-roamer'].speeds,
    )) {
      const actor = compileActor(
        { ...rover, tier, heading: [-1, 1] },
        difficulty,
        ROVER_ACTOR_CATALOG.id,
      );
      assert.equal(actor.type, 'claimed-rover');
      assert(Math.abs(Math.hypot(actor.vx, actor.vy) - speed * factor) < 1e-12);
    }
  for (const bad of [
    { speed: 99 },
    { heading: [0, 0] },
    { tier: 'turbo' },
    { clockwise: true },
    { x: 4.2 },
  ]) {
    const draft = source();
    Object.assign(draft.missions[0].actors[1], bad);
    assert.throws(() => compileContentProject(draft));
  }
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = ROVER_ACTOR_CATALOG.id;
  assert.throws(
    () => editContentActor(team, 'twin-landings', { action: 'add', id: rover.id, actor: rover }),
    /qualified actor roles/,
  );
});

test('the project boundary requires an explicit catalogue and never inherits the standalone legacy default', () => {
  for (const create of [createStarterProject, createTeamOpeningCandidates, source]) {
    const missing = create();
    delete missing.actorCatalogId;
    assert.throws(() => compileContentProject(missing), /explicit registered actor catalogue/);
    for (const actorCatalogId of [null, '', 'unknown', '__proto__']) {
      const invalid = create();
      invalid.actorCatalogId = actorCatalogId;
      assert.throws(() => compileContentProject(invalid), /registered actor catalog/);
    }
  }
  assert.equal(journeyActors(), ACTOR_CATALOG, 'Intentional standalone compatibility stays exact');
  const explicit = compileContentProject(createStarterProject());
  assert.equal(explicit.actors, ACTOR_CATALOG);
  assert.equal(compileContentProject(explicit), explicit, 'Owned compiled projects retain reuse');
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`authored roamer keeps the existing dormant → warning → reclaimed-domain contract: ${difficulty}/${turnPolicy}`, () => {
      const project = compileContentProject(source());
      const manifest = resolveMission(project, 'nearby-shore', { difficulty });
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(manifest.level, options, 'roamer-catalogue-contract');
      const step = (direction) => {
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
      };
      const actor = run.enemies.find((e) => e.id === 'roamer');
      assert.equal(actor.classic.mode, 'dormant');
      const snapshot = inspectCaptureSnapshot(run);
      assert.deepEqual(
        snapshot.components.flatMap((c) => c.enemyIds),
        ['keeper'],
      );
      const preview = prepareContentPreview(source(), 'nearby-shore', { difficulty });
      assert.equal(preview.markers.actors.find((e) => e.id === 'roamer').type, 'claimed-rover');
      const denominator = run.totalClaimable;
      for (let tick = 0; tick < 600 && run.claimedCount === 0; tick++) step('down');
      assert(run.claimedCount > 0);
      assert.equal(run.status, 'running');
      assert.equal(run.cells[10 * run.width + 4], CELL.SAFE);
      assert.equal(actor.classic.mode, 'warning');
      const activation = actor.classic.activationTick;
      while (run.classic.actorTick < activation - 1) step(null);
      assert.equal(actor.classic.mode, 'warning');
      step(null);
      assert.equal(actor.classic.mode, 'active');
      const cells = run.cells.slice(),
        count = run.claimedCount;
      for (let tick = 0; tick < 600; tick++) {
        step(null);
        assert.equal(fitsClassicDomain(run, actor, actor.radius, CELL.SAFE), true);
        assert.equal(run.classic.livesLost, 0);
      }
      assert.deepEqual(run.cells, cells, 'The roamer does not erode territory');
      assert.equal(run.claimedCount, count);
      assert.equal(run.totalClaimable, denominator);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    });
