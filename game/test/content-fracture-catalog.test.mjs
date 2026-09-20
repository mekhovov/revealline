import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  ACTOR_CATALOG,
  ROVER_ACTOR_CATALOG,
  FRACTURE_ACTOR_CATALOG,
  journeyActors,
  compileActor,
} from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { classicErosionReason } from '../core/classic-topology.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { traceContentActor } from '../content-design/actor-marker.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { createMissionCard, paintMissionThumbnail } from '../content-design/mission-card.mjs';

const eroder = {
  id: 'eroder',
  role: 'territory-eroder',
  tier: 'measured',
  x: 66.5,
  y: 18.5,
  heading: [-1, 0],
};
function source() {
  const project = createStarterProject();
  project.actorCatalogId = FRACTURE_ACTOR_CATALOG.id;
  project.maps[0].spawns[0] = { id: 'home', x: 36.5, y: 0.5 };
  project.maps[0].foundations = [{ x: 10, y: 10, w: 3, h: 3 }];
  project.maps[0].terrain = [{ id: 'repair-seam', kind: 'slow', x: 36, y: 18, w: 1, h: 1 }];
  project.missions[0].coverage = 0.99;
  project.missions[0].actors = [structuredClone(eroder)];
  project.missions[0].objectives = [{ id: 'anchor', x: 10.5, y: 20.5, required: true }];
  return project;
}

test('explicit catalogue v3 preserves both historical role sets and compiled physics', () => {
  assert.equal(journeyActors('journey-actors-v3'), FRACTURE_ACTOR_CATALOG);
  for (const prior of [ACTOR_CATALOG, ROVER_ACTOR_CATALOG]) {
    assert(!Object.hasOwn(prior.roles, 'territory-eroder'));
    assert.throws(() => compileActor(eroder, 'standard', prior.id), /Unsupported actor role/);
    for (const [id, role] of Object.entries(prior.roles))
      assert.equal(FRACTURE_ACTOR_CATALOG.roles[id], role);
  }
  assert.equal(FRACTURE_ACTOR_CATALOG.roles['territory-eroder'].retainsField, true);
  assert(Object.isFrozen(FRACTURE_ACTOR_CATALOG.roles['territory-eroder'].speeds));
  const old = createStarterProject(),
    next = structuredClone(old);
  next.actorCatalogId = FRACTURE_ACTOR_CATALOG.id;
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const before = resolveMission(compileContentProject(old), 'nearby-shore', { difficulty });
    const after = resolveMission(compileContentProject(next), 'nearby-shore', { difficulty });
    assert.deepEqual(after.level, before.level);
    assert.equal(after.simulationIdentity, before.simulationIdentity);
  }
});

test('eroder commands use shared tiers and all-mode validation, never arbitrary timings or Team substitution', () => {
  for (const [difficulty, factor] of [
    ['gentle', 0.85],
    ['standard', 1],
    ['expert', 1.1],
  ])
    for (const [tier, speed] of Object.entries(
      FRACTURE_ACTOR_CATALOG.roles['territory-eroder'].speeds,
    )) {
      const actor = compileActor(
        { ...eroder, tier, heading: [-1, 1] },
        difficulty,
        FRACTURE_ACTOR_CATALOG.id,
      );
      assert.equal(actor.type, 'eroder');
      assert(Math.abs(Math.hypot(actor.vx, actor.vy) - speed * factor) < 1e-12);
    }
  const draft = source(),
    before = structuredClone(draft);
  for (const change of [
    { speed: 99 },
    { warningSeconds: 0 },
    { tier: 'turbo' },
    { heading: [0, 0] },
    { x: 11.5, y: 11.5 },
  ])
    assert.throws(() =>
      editContentActor(draft, 'nearby-shore', {
        action: 'replace',
        id: eroder.id,
        actor: { ...eroder, ...change },
      }),
    );
  assert.deepEqual(draft, before);
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = FRACTURE_ACTOR_CATALOG.id;
  assert.throws(
    () =>
      editContentActor(team, 'twin-landings', {
        action: 'add',
        id: eroder.id,
        actor: eroder,
      }),
    /currently support field keepers/,
  );
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: authored erosion warns, restores terrain, repairs without score farming and replays exactly`, () => {
      const project = compileContentProject(source());
      const manifest = resolveMission(project, 'nearby-shore', { difficulty });
      assert.deepEqual(
        resolveMission(project, 'nearby-shore', { difficulty, mode: 'versus' }).level,
        manifest.level,
      );
      const preview = prepareContentPreview(source(), 'nearby-shore', { difficulty });
      assert.deepEqual(
        preview.capture.components.flatMap((c) => c.enemyIds),
        ['eroder'],
      );
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      const step = (direction) => {
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.status, 'running');
        assert.equal(run.lives, manifest.level.rules.lives);
      };
      const until = (direction, predicate, max = 1800) => {
        for (let n = 0; n < max; n++) {
          step(direction);
          if (predicate()) return;
        }
        assert.fail('Bounded legal input did not reach the expected interaction.');
      };
      const denominator = run.totalClaimable;
      until('down', () => run.claimedCount > 0);
      const count = run.claimedCount,
        score = run.score,
        unique = run.classic.uniqueClaimedCount;
      assert.equal(run.objectives[0].captured, true);
      assert.equal(classicErosionReason(run, 10 * 72 + 10), 'foundation');
      const anchor = run.classic.anchors.find((a) => a.id === 'anchor');
      assert(anchor.path.length > 0);
      for (const index of anchor.path)
        assert.notEqual(
          classicErosionReason(run, index),
          null,
          'Captured anchor path remains protected.',
        );
      assert.deepEqual(foundationCompatibleView(run).terrain, []);
      until(null, () => run.events.some((e) => e.type === 'erosion.warning'));
      const warning = run.events.find((e) => e.type === 'erosion.warning');
      assert.equal(warning.index, 18 * 72 + 36);
      assert.equal(warning.erosionAt - run.classic.actorTick, 60);
      while (run.classic.actorTick < warning.erosionAt - 1) step(null);
      assert.equal(run.cells[warning.index], CELL.SAFE);
      step(null);
      assert.equal(run.cells[warning.index], CELL.FIELD);
      assert.equal(run.claimedCount, count - 1);
      assert.equal(run.score, score);
      assert.equal(run.enemies[0].classic.cooldownUntil - run.classic.actorTick, 120);
      assert.equal(foundationCompatibleView(run).terrain.length, 1);
      until('up', () => run.events.some((e) => e.type === 'cut.closed'));
      assert.equal(run.cells[warning.index], CELL.SAFE);
      assert.equal(run.claimedCount, count);
      assert.equal(run.totalClaimable, denominator);
      assert.equal(run.classic.uniqueClaimedCount, unique);
      assert.equal(run.score, score);
      assert.deepEqual(foundationCompatibleView(run).terrain, []);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    });

test('field keeper, two patrol domains, roamer and eroder have distinct color-independent diagram paths', () => {
  const signatures = [];
  for (const type of ['bouncer', 'border-patrol', 'contour-patrol', 'claimed-rover', 'eroder']) {
    const calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_, method) =>
          (...args) =>
            calls.push([method, ...args]),
      },
    );
    traceContentActor(ctx, type, 30, 30, 4);
    assert(calls.length > 0);
    signatures.push(JSON.stringify(calls));
  }
  assert.equal(new Set(signatures).size, 5);
});

test('both actual Studio and mission-thumbnail renderers use the eroder blade marker', () => {
  const preview = prepareContentPreview(source(), 'nearby-shore');
  for (const [unit, radius, paint] of [
    [14, 14 * 0.45, (ctx) => paintContentMap(ctx, preview, { showCapture: false })],
    [4, 4, (ctx) => paintMissionThumbnail(ctx, createMissionCard(preview.manifest))],
  ]) {
    const calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_, method) =>
          (...args) =>
            calls.push([method, ...args]),
      },
    );
    paint(ctx);
    assert(
      calls.some(
        ([method, x, y, w, h]) =>
          method === 'rect' &&
          x === eroder.x * unit - radius &&
          y === eroder.y * unit - radius * 0.6 &&
          w === radius * 2 &&
          h === radius * 0.5,
      ),
    );
  }
});
