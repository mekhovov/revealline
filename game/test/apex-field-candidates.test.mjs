import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexSpatialCandidates } from '../content-design/apex-spatial-candidates.mjs';
import { createApexFieldCandidates } from '../content-design/apex-field-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const original = compileContentProject(createApexSpatialCandidates());
const field = compileContentProject(createApexFieldCandidates());
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];

test('explicit field alternative preserves maps, immutable boss edition and every other mission runtime', () => {
  assert.equal(field.source.revision, 'home-field-2');
  assert.deepEqual(field.source.maps, original.source.maps);
  assert.deepEqual(createApexSpatialCandidates(), original.source);
  assert.equal(field.source.difficultyCatalogId, 'journey-difficulty-v2');
  assert.equal(field.source.actorCatalogId, original.source.actorCatalogId);
  assert.equal(field.source.policyId, original.source.policyId);
  for (const mission of field.missions)
    for (const difficulty of presets) {
      const before = resolveMission(original, mission.id, { difficulty });
      const after = resolveMission(field, mission.id, { difficulty });
      assert.equal(after.officialProgressEligible, false);
      assert.deepEqual(
        after.level,
        resolveMission(field, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== 'home-signal') assert.deepEqual(after.level, before.level);
      else {
        assert.notEqual(after.simulationIdentity, before.simulationIdentity);
        assert.equal(after.level.encounter, null);
        assert(before.level.encounter);
        for (const key of ['rules', 'goal']) assert.deepEqual(after.level[key], before.level[key]);
        assert.deepEqual(mission.design.introduces, []);
        assert.deepEqual(
          mission.bonuses,
          original.missions.find((item) => item.id === mission.id).bonuses,
        );
      }
    }
  const mutation = createApexFieldCandidates();
  mutation.missions.find((item) => item.id === 'home-signal').actors[0].x = 30;
  assert.deepEqual(createApexFieldCandidates(), field.source);
});

test('field alternative retains asset pins without silently enrolling a release or replacing boss art', () => {
  const before = createApexSpatialCandidates({ artwork: true });
  const after = createApexFieldCandidates({ artwork: true });
  assert.deepEqual(after.assets, before.assets);
  assert.deepEqual(after.maps, before.maps);
  assert.deepEqual(
    after.missions.map((m) => m.presentation),
    before.missions.map((m) => m.presentation),
  );
});

test('ordinary objectives, both field anchors and unchanged dock are inspectable through the common compiler', () => {
  const mission = field.missions.find((item) => item.id === 'home-signal');
  const prior = original.missions.find((item) => item.id === 'home-signal');
  assert.deepEqual(mission.actors, [
    {
      id: 'north-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 22.5,
      y: 6.5,
      heading: [1, 1],
    },
    {
      id: 'south-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 57.5,
      y: 21.5,
      heading: [-1, -1],
    },
    ...prior.actors.filter((actor) => actor.id !== 'sentinel'),
  ]);
  assert.deepEqual(mission.objectives, [
    { id: 'dock-relay', x: 33.5, y: 12.5, required: true, hidden: false },
    { id: 'east-relay', x: 62.5, y: 17.5, required: true, hidden: false },
    { id: 'south-relay', x: 50.5, y: 29.5, required: true, hidden: false },
    { id: 'north-relay', x: 20.5, y: 4.5, required: true, hidden: false },
  ]);
  const run = createRun(resolveMission(field, 'home-signal').level);
  assert.equal(run.encounter, null);
  assert.equal(run.totalClaimable, 1921);
  assert.equal(run.relay.gates[0].cells.length, 24);
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.components.length, 1);
  assert.deepEqual(snapshot.components[0].enemyIds, ['north-keeper', 'south-keeper']);
  assert.equal(snapshot.filledCells.length, 0);
  assert(run.objectives.every((item) => item.required && !item.hidden));
  assert(
    run.objectives.every(
      (item) => run.cells[Math.floor(item.y) * run.width + Math.floor(item.x)] === CELL.FIELD,
    ),
  );
  assert.deepEqual(field.missions.find((m) => m.id === 'home-signal').relayLinks, [
    { gateId: 'home-dock', objectiveId: 'dock-relay' },
  ]);
  const map = field.maps.find((m) => m.source.id === 'home-signal-map');
  assert(map.geometry.safeComponents.every((component) => component.departures.length >= 4));
  assert.deepEqual(
    map.geometry.diagnostics.map((d) => d.code),
    ['disconnected-foundations'],
  );
});

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`field finale idle and harmless three first returns: ${difficulty}/${turnPolicy}`, () => {
      const level = resolveMission(field, 'home-signal', { difficulty }).level;
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const idle = createRun(level, options);
      for (let tick = 0; tick < 1200; tick++) stepRun(idle, { direction: null }, FIXED_DT);
      assert.equal(idle.classic.livesLost, 0);
      assert.equal(idle.claimedCount, 0);
      for (const [direction, ticks, earned] of [
        ['up', 102, 5],
        ['down', 114, 5],
        ['left', 174, 9],
      ]) {
        const run = createRun(level, options);
        for (let tick = 0; tick < ticks; tick++) stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.claimedCount, earned);
        assert.equal(run.totalClaimable, 1921);
        assert.equal(run.player.speed, 0);
        assert(run.events.some((e) => e.type === 'cut.closed'));
        assert(run.objectives.every((item) => !item.captured));
        assert.equal(run.status, 'running');
      }
    });

test('Studio inspects the pending study and requires explicit Apply, without launching or publishing', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert(
    html.includes(
      'id="apex-field">Inspect Home Signal field-finale study · balance pending</button>',
    ),
  );
  const action = host.slice(
    host.indexOf("$('apex-field').onclick"),
    host.indexOf("$('whole-journey').onclick"),
  );
  assert.match(action, /discardSource\(\)/);
  assert.match(action, /createApexFieldCandidates\(\)/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session\.replace|launchPreview/);
});
