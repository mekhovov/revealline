import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  PHASE_ACTOR_CATALOG,
  LIVEWIRE_ACTOR_CATALOG,
  compileActor,
  journeyActors,
} from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { contentActorDescription, traceContentActor } from '../content-design/actor-marker.mjs';
import { createMissionCard, paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { missionBriefing } from '../mission-brief.mjs';

const emitter = {
  id: 'emitter',
  role: 'lane-emitter',
  tier: 'measured',
  x: 45.5,
  y: 15.5,
  axis: 'horizontal',
};
function source() {
  const project = createStarterProject();
  project.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  project.missions[0].actors.push(structuredClone(emitter));
  return project;
}
const resolve = (project, options) =>
  resolveMission(compileContentProject(project), 'nearby-shore', options);

test('v5 preserves previous catalogue roles and unchanged missions exactly', () => {
  assert.equal(journeyActors(LIVEWIRE_ACTOR_CATALOG.id), LIVEWIRE_ACTOR_CATALOG);
  for (const [id, role] of Object.entries(PHASE_ACTOR_CATALOG.roles))
    assert.equal(LIVEWIRE_ACTOR_CATALOG.roles[id], role);
  assert.throws(
    () => compileActor(emitter, 'standard', PHASE_ACTOR_CATALOG.id),
    /Unsupported actor role/,
  );
  const before = createStarterProject();
  before.actorCatalogId = PHASE_ACTOR_CATALOG.id;
  const after = structuredClone(before);
  after.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    assert.deepEqual(resolve(after, { difficulty }).level, resolve(before, { difficulty }).level);
    assert.equal(
      resolve(after, { difficulty }).simulationIdentity,
      resolve(before, { difficulty }).simulationIdentity,
    );
  }
});

test('shared stationary cadence compiles equally for Solo/Versus without shortening warnings by preset', () => {
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const tier of ['measured', 'standard', 'brisk']) {
      const project = source();
      project.missions[0].actors[1].tier = tier;
      const solo = resolve(project, { difficulty });
      assert.deepEqual(resolve(project, { difficulty, mode: 'versus' }).level, solo.level);
      const actor = solo.level.enemies.find((row) => row.id === 'emitter');
      assert.deepEqual(actor, {
        id: 'emitter',
        type: 'lane-boss',
        x: 45.5,
        y: 15.5,
        axis: 'horizontal',
        warningSeconds: 1.5,
        activeSeconds: 0.7,
        period: LIVEWIRE_ACTOR_CATALOG.roles['lane-emitter'].timings[tier].period,
        laneWidth: 1.2,
      });
      assert.equal(solo.level.classic.lineImpact, undefined);
      assert.equal(solo.level.rules.moveSpeed, 10);
      const preview = prepareContentPreview(project, 'nearby-shore', { difficulty });
      assert.deepEqual(preview.capture.components.flatMap((c) => c.enemyIds).sort(), [
        'emitter',
        'keeper',
      ]);
    }
});

test('lane authoring rejects arbitrary timing, motion and axis; Team does not silently substitute it', () => {
  const original = source(),
    before = structuredClone(original);
  for (const bad of [
    { axis: 'diagonal' },
    { axis: undefined },
    { tier: 'turbo' },
    { speed: 99 },
    { warningSeconds: 0 },
    { activeSeconds: 99 },
    { period: 0 },
    { laneWidth: 30 },
    { clockwise: true },
    { heading: [1, 0] },
  ])
    assert.throws(() =>
      editContentActor(original, 'nearby-shore', {
        action: 'replace',
        id: 'emitter',
        actor: { ...emitter, ...bad },
      }),
    );
  assert.deepEqual(original, before);
  assert.throws(
    () => compileActor(emitter, 'unknown', LIVEWIRE_ACTOR_CATALOG.id),
    /Unsupported Journey difficulty/,
  );
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  assert.throws(
    () => editContentActor(team, 'twin-landings', { action: 'add', id: 'emitter', actor: emitter }),
    /qualified actor roles/,
  );
});

test('the compiled emitter uses the existing engine warning/active/rest clock and public replay', () => {
  const level = resolve(source()).level;
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const options = { seed: 1, classId: 'scout', turnPolicy },
      run = createRun(level, options);
    const recorder = createRecorder(level, options, 'lane-contract-not-playtest');
    const phases = new Set(),
      warnings = [];
    for (let tick = 0; tick < 120 * 7; tick++) {
      recordInput(recorder, { direction: null });
      stepRun(run, { direction: null }, FIXED_DT);
      const actor = run.enemies.find((e) => e.id === 'emitter');
      phases.add(actor.bossPhase);
      assert.equal(actor.x, 45.5);
      assert.equal(actor.y, 15.5);
      assert.equal(run.classic.livesLost, 0);
      warnings.push(...run.events.filter((e) => e.type === 'boss.warning' && e.id === 'emitter'));
    }
    assert.deepEqual([...phases].sort(), ['active', 'idle', 'warning']);
    assert.equal(warnings.length, 1);
    assert(Math.abs(warnings[0].time - 2) < FIXED_DT * 2);
    assert.equal(warnings[0].axis, 'horizontal');
    assert.equal(warnings[0].lane, 1.5);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  }
});

const surface = () => {
  const calls = [];
  return {
    calls,
    ctx: new Proxy(
      {},
      {
        get:
          (_, method) =>
          (...args) =>
            calls.push([method, ...args]),
      },
    ),
  };
};

test('Studio and chooser distinguish stationary emitters from every existing moving role', () => {
  const preview = prepareContentPreview(source(), 'nearby-shore');
  const marker = preview.markers.actors.find((row) => row.id === 'emitter');
  assert.deepEqual(Object.keys(marker).sort(), ['id', 'type', 'x', 'y']);
  assert.equal(
    contentActorDescription(preview.manifest.level, marker),
    'stationary lane emitter, horizontal lane, 1.5s warning / 0.7s active / 6s cycle',
  );
  const shapes = [
    'bouncer',
    'border-patrol',
    'contour-patrol',
    'claimed-rover',
    'eroder',
    'impact-carrier',
    'lane-boss',
  ].map((type) => {
    const s = surface();
    traceContentActor(s.ctx, type, 0, 0, 4);
    return JSON.stringify(s.calls);
  });
  assert.equal(new Set(shapes).size, 7);
  const card = createMissionCard(preview.manifest);
  for (const [unit, radius, paint] of [
    [14, 6.3, (ctx) => paintContentMap(ctx, preview, { showCapture: false })],
    [4, 4, (ctx) => paintMissionThumbnail(ctx, card)],
  ]) {
    const s = surface();
    paint(s.ctx);
    assert(
      s.calls.some(
        ([method, x, y, w, h]) =>
          method === 'rect' &&
          Math.abs(x - (emitter.x * unit - radius)) < 1e-9 &&
          Math.abs(y - (emitter.y * unit - radius)) < 1e-9 &&
          Math.abs(w - radius * 0.45) < 1e-9 &&
          Math.abs(h - radius * 2) < 1e-9,
      ),
    );
  }
});

test('foundation ready cards prioritize the lane warning without hiding selective trail collision', () => {
  const project = source();
  for (const carrier of [false, true]) {
    if (carrier)
      project.missions[0].actors.push({
        id: 'carrier',
        role: 'impact-carrier',
        tier: 'measured',
        x: 55.5,
        y: 20.5,
        heading: [-1, 0],
      });
    const level = resolve(project).level;
    const before = structuredClone(level);
    const card = missionBriefing(level);
    assert.match(card.copy, /Lanes lock, warn, then fire/);
    assert.match(card.copy, /secure exposed trail/);
    assert.equal(card.copy.includes('other trail hits are instant'), carrier);
    assert(card.copy.length <= 240, card.copy);
    assert.deepEqual(level, before);
  }
});
