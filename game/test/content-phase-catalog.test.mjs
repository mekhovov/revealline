import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  ACTOR_CATALOG,
  ROVER_ACTOR_CATALOG,
  FRACTURE_ACTOR_CATALOG,
  PHASE_ACTOR_CATALOG,
  compileActor,
  journeyActors,
} from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createMissionCard, paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { traceContentActor } from '../content-design/actor-marker.mjs';
import { createRun } from '../core/index.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { drawClassicEnemy } from '../ui/classic-view.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';

const carrier = {
  id: 'carrier',
  role: 'impact-carrier',
  tier: 'measured',
  x: 45.5,
  y: 15.5,
  heading: [-1, 0],
};
function source() {
  const project = createStarterProject();
  project.actorCatalogId = PHASE_ACTOR_CATALOG.id;
  project.missions[0].actors.push(structuredClone(carrier));
  return project;
}
const resolve = (project, options) =>
  resolveMission(compileContentProject(project), 'nearby-shore', options);
function surface() {
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
  return { ctx, calls };
}

test('v4 preserves all prior roles, physics and identities until a carrier is explicitly authored', () => {
  assert.equal(journeyActors(PHASE_ACTOR_CATALOG.id), PHASE_ACTOR_CATALOG);
  for (const prior of [ACTOR_CATALOG, ROVER_ACTOR_CATALOG, FRACTURE_ACTOR_CATALOG]) {
    assert(!Object.hasOwn(prior.roles, carrier.role));
    assert.throws(() => compileActor(carrier, 'standard', prior.id), /Unsupported actor role/);
    for (const [id, role] of Object.entries(prior.roles))
      assert.equal(PHASE_ACTOR_CATALOG.roles[id], role);
    const old = createStarterProject();
    old.actorCatalogId = prior.id;
    const next = structuredClone(old);
    next.actorCatalogId = PHASE_ACTOR_CATALOG.id;
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const before = resolve(old, { difficulty }),
        after = resolve(next, { difficulty });
      assert.deepEqual(after.level, before.level);
      assert.equal(after.simulationIdentity, before.simulationIdentity);
      assert.equal(after.level.classic.lineImpact, undefined);
    }
  }
});

test('the shared compiler selects only carrier IDs in Solo and equal-board Versus for every preset', () => {
  for (const [difficulty, factor] of [
    ['gentle', 0.85],
    ['standard', 1],
    ['expert', 1.1],
  ]) {
    const solo = resolve(source(), { difficulty });
    assert.deepEqual(resolve(source(), { difficulty, mode: 'versus' }).level, solo.level);
    assert.deepEqual(solo.level.classic.lineImpact, {
      version: 'line-impact.v2',
      speed: 24,
      actorIds: ['carrier'],
    });
    const actor = solo.level.enemies.find((row) => row.id === 'carrier');
    assert.equal(actor.type, 'bouncer');
    assert(Math.abs(Math.hypot(actor.vx, actor.vy) - 2.4 * factor) < 1e-12);
    assert.equal(solo.level.rules.moveSpeed, 10);
    const preview = prepareContentPreview(source(), 'nearby-shore', { difficulty });
    assert.deepEqual(preview.capture.components.flatMap((c) => c.enemyIds).sort(), [
      'carrier',
      'keeper',
    ]);
  }
  const two = source();
  two.missions[0].actors.push({ ...carrier, id: 'another', x: 50.5 });
  assert.deepEqual(resolve(two).level.classic.lineImpact.actorIds, ['another', 'carrier']);
});

test('carrier CRUD cannot override front speeds and removing the final carrier removes only its opt-in contract', () => {
  const draft = source(),
    before = structuredClone(draft);
  for (const change of [
    { speed: 99 },
    { impactSpeed: 60 },
    { warningSeconds: 0 },
    { tier: 'turbo' },
    { heading: [0, 0] },
  ])
    assert.throws(() =>
      editContentActor(draft, 'nearby-shore', {
        action: 'replace',
        id: 'carrier',
        actor: { ...carrier, ...change },
      }),
    );
  assert.deepEqual(draft, before);
  const removed = editContentActor(draft, 'nearby-shore', { action: 'remove', id: 'carrier' });
  assert.equal(resolve(removed).level.classic.lineImpact, undefined);
  assert.deepEqual(resolve(removed).level.enemies, resolve(createStarterProject()).level.enemies);
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = PHASE_ACTOR_CATALOG.id;
  assert.throws(
    () =>
      editContentActor(team, 'twin-landings', {
        action: 'add',
        id: 'carrier',
        actor: carrier,
      }),
    /qualified actor roles/,
  );
});

test('Studio, chooser and gameplay share a distinct static bolt; ordinary keepers keep their circle', () => {
  const preview = prepareContentPreview(source(), 'nearby-shore');
  const card = createMissionCard(preview.manifest);
  assert.deepEqual(
    card.actors.map((row) => row.type),
    ['bouncer', 'impact-carrier'],
  );
  const shapes = [
    'bouncer',
    'border-patrol',
    'contour-patrol',
    'claimed-rover',
    'eroder',
    'impact-carrier',
  ].map((type) => {
    const s = surface();
    traceContentActor(s.ctx, type, 0, 0, 4);
    return JSON.stringify(s.calls);
  });
  assert.equal(new Set(shapes).size, 6);
  for (const [unit, radius, paint] of [
    [14, 6.3, (ctx) => paintContentMap(ctx, preview, { showCapture: false })],
    [4, 4, (ctx) => paintMissionThumbnail(ctx, card)],
  ]) {
    const s = surface();
    paint(s.ctx);
    assert(
      s.calls.some(
        ([method, x, y]) =>
          method === 'moveTo' &&
          Math.abs(x - (carrier.x * unit + radius * 0.2)) < 1e-9 &&
          Math.abs(y - (carrier.y * unit - radius)) < 1e-9,
      ),
    );
  }
  const run = createRun(preview.manifest.level);
  const view = foundationCompatibleView(run);
  assert(view);
  assert.deepEqual(
    view.enemies.map((enemy) => enemy.impactCarrier),
    [undefined, true],
  );
  assert.match(view.summary, /1 field enemy/);
  assert.match(view.summary, /1 trail-impact carrier/);
  const s = surface(),
    palette = { danger: '#d33', muted: '#888' };
  assert.equal(drawClassicEnemy(s.ctx, view.enemies[0], palette), false);
  for (const presentation of [null, { diameter: 28 }])
    assert.equal(drawClassicEnemy(s.ctx, view.enemies[1], palette, {}, presentation), true);
  assert.equal(s.calls.filter(([method]) => method === 'moveTo').length, 2);
});

test('carrier projection rejects accessors and forged IDs without changing simulation', () => {
  const run = createRun(resolve(source()).level);
  let reads = 0;
  const descriptors = Object.getOwnPropertyDescriptors(run);
  for (const impact of [
    { version: 'line-impact.v2', actorIds: ['missing'] },
    { version: 'line-impact.v2', actorIds: ['carrier', 'carrier'] },
    { version: 'line-impact.v2', actorIds: [] },
    {
      version: 'line-impact.v2',
      get actorIds() {
        reads++;
        return ['carrier'];
      },
    },
  ]) {
    descriptors.level = { value: { classic: { lineImpact: impact } }, enumerable: true };
    assert.equal(foundationCompatibleView(Object.create(null, descriptors)), null);
  }
  assert.equal(reads, 0);
  assert(foundationCompatibleView(run));
});

test('accessible field details distinguish carriers from immediate-damage keepers without relying on color', () => {
  const run = createRun(resolve(source()).level);
  const snapshot = flightInformationSnapshot(run, { started: true, paused: true });
  assert.equal(snapshot.classic.enemies[1].impactCarrier, true);
  const details = flightDetailsModel(
    {
      snapshot,
    },
    { mission: 'Carrier lesson', goal: 'Close a cut', steering: 'Immediate', actions: [] },
  );
  const lines = details.find((part) => part.id === 'threats').lines;
  assert(
    lines.some(
      (line) =>
        line.startsWith('Trail-impact carrier:') &&
        line.includes('close before') &&
        line.includes('live endpoint'),
    ),
  );
  assert(
    lines.some((line) => line.startsWith('Field hunter:') && line.includes('unfinished line')),
  );
});
