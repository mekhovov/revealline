import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyRelaySpatialPairCandidates } from '../content-design/journey-relay-spatial-pair.mjs';
import { createJourneyPhaseworksSpatialPairCandidates } from '../content-design/journey-phaseworks-spatial-pair.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['first-link', 'second-approach'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createJourneyPhaseworksSpatialPairCandidates({ artwork: true });
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyRelaySpatialPairCandidates({ artwork: true });
const oldProject = compileContentProject(oldSource);
const project = compileContentProject(revisedSource);

function mission(compiledProject, id) {
  return compiledProject.missions.find((item) => item.id === id);
}

function map(compiledProject, id) {
  const current = mission(compiledProject, id);
  return compiledProject.maps.find(
    (item) => item.source.id === current.map.id && item.source.revision === current.map.revision,
  );
}

function stepUntil(run, direction, predicate, maxTicks = 1200) {
  let ticks = 0;
  while (!predicate(run) && ticks < maxTicks) {
    stepRun(run, { direction }, FIXED_DT);
    ticks++;
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
  }
  assert.equal(predicate(run), true, `route did not finish within ${maxTicks} ticks`);
  return ticks;
}

test('Relay pair preserves mission identities, historical source, art, gates and authored order', () => {
  assert.deepEqual(createJourneyPhaseworksSpatialPairCandidates({ artwork: true }), oldSnapshot);
  assert.equal(revisedSource.revision, 'relay-spatial-pair-1');
  assert.equal(revisedSource.policyId, oldSource.policyId);
  assert.equal(revisedSource.actorCatalogId, oldSource.actorCatalogId);
  assert.equal(revisedSource.difficultyCatalogId, oldSource.difficultyCatalogId);
  assert.deepEqual(revisedSource.assets, oldSource.assets);
  assert.deepEqual(
    revisedSource.campaigns.map((campaign) => [campaign.id, campaign.missionIds]),
    oldSource.campaigns.map((campaign) => [campaign.id, campaign.missionIds]),
  );
  assert.deepEqual(
    revisedSource.packs.map((pack) => [pack.id, pack.missionIds]),
    oldSource.packs.map((pack) => [pack.id, pack.missionIds]),
  );
  for (const current of project.missions) {
    const previous = mission(oldProject, current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
    else {
      assert.equal(current.revision, 'relay-spatial-pair-1');
      assert.equal(current.id, previous.id);
      assert.equal(current.name, previous.name);
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.relayLinks, previous.relayLinks);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.deepEqual(current.modes, previous.modes);
      assert.deepEqual(current.actors, previous.actors);
      assert.equal(current.design.routeDecision.includes(' or '), true);
      assert.match(current.design.mastery, /without losing a life/);
    }
  }
});

test('diversity-link and stepped-arch layouts retain one governed field and valid relay topology', () => {
  const expected = {
    'first-link': { walls: 8, foundations: 3, retainers: 2, gates: ['south-bridge'] },
    'second-approach': {
      walls: 10,
      foundations: 3,
      retainers: 2,
      gates: ['east-bridge', 'west-bridge'],
    },
  };
  for (const id of IDS) {
    const previousMission = mission(oldProject, id);
    const currentMission = mission(project, id);
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'relay-spatial-pair-1');
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(currentMap.source.foundations.length, expected[id].foundations);
    assert.deepEqual(currentMap.source.gates, previousMap.source.gates);
    assert.deepEqual(currentMission.objectives, previousMission.objectives);
    assert.equal(currentMap.geometry.fieldComponents.length, 1);
    assert.equal(currentMap.geometry.safeComponents.length, 4);
    assert.deepEqual(
      currentMap.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    assert(currentMap.geometry.safeComponents.every((item) => item.departures.length >= 8));
    for (const difficulty of PRESETS) {
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      const previous = resolveMission(oldProject, id, { difficulty, mode: 'solo' });
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
      assert.deepEqual(solo.level.relayGates, previous.level.relayGates);
      assert.deepEqual(
        solo.level.relayGates.gates.map((gate) => gate.id).sort(),
        expected[id].gates,
      );
      const run = createRun(solo.level, { seed: 1, classId: 'scout' });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, 1);
      assert.equal(capture.filledCells.length, 0);
      assert.equal(capture.components[0].retained, true);
      assert.equal(capture.components[0].enemyIds.length, expected[id].retainers);
      assert.deepEqual(inspectMissionTopology(solo.level, currentMap.geometry).diagnostics, []);
    }
  }
});

for (const id of IDS)
  for (const difficulty of PRESETS)
    test(`${id} has no unavoidable idle opening pressure on ${difficulty}`, () => {
      const manifest = resolveMission(project, id, { difficulty });
      for (const seed of [1, 2]) {
        const run = createRun(manifest.level, { seed, classId: 'scout' });
        for (let tick = 0; tick < 720; tick++) stepRun(run, { direction: null }, FIXED_DT);
        assert.equal(run.status, 'running');
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.claimedCount, 0);
      }
    });

const firstReturns = Object.freeze({
  'first-link': Object.freeze({
    directRelay: { targetX: 35.5 },
    westService: { targetX: 13.5 },
  }),
  'second-approach': Object.freeze({
    eastRelay: { targetX: 37.5 },
    westArch: { targetX: 5.5 },
  }),
});

for (const [id, approaches] of Object.entries(firstReturns))
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${id} supports two safe first approaches on ${difficulty} with ${turnPolicy}`, () => {
        const manifest = resolveMission(project, id, { difficulty });
        for (const [name, approach] of Object.entries(approaches)) {
          const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
          if (run.player.x > approach.targetX)
            stepUntil(run, 'left', (state) => state.player.x <= approach.targetX);
          else if (run.player.x < approach.targetX)
            stepUntil(run, 'right', (state) => state.player.x >= approach.targetX);
          stepUntil(run, 'down', (state) =>
            state.events.some((event) => event.type === 'cut.closed'),
          );
          assert(run.claimedCount > 0, `${id}/${name}`);
          assert.equal(run.player.speed, 0, `${id}/${name}`);
          assert.equal(run.classic.livesLost, 0, `${id}/${name}`);
        }
      });

const signatureRoutes = Object.freeze({
  'first-link': { gateId: 'south-bridge', objectiveId: 'landing-relay' },
  'second-approach': { gateId: 'east-bridge', objectiveId: 'east-relay' },
});

for (const [id, signature] of Object.entries(signatureRoutes))
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${id} opens and safely traverses its signature relay on ${difficulty} with ${turnPolicy}`, () => {
        const manifest = resolveMission(project, id, { difficulty });
        const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
        stepUntil(run, 'down', (state) =>
          state.events.some((event) => event.type === 'cut.closed'),
        );
        const gate = run.relay.gates.find((item) => item.id === signature.gateId);
        assert.notEqual(gate.openedTick, null);
        assert(
          run.events.some(
            (event) => event.type === 'objective.captured' && event.id === signature.objectiveId,
          ),
        );
        assert(
          run.events.some(
            (event) => event.type === 'relay.opened' && event.id === signature.gateId,
          ),
        );
        stepRun(run, { direction: null }, FIXED_DT);
        let usedGate = false;
        const noteGateUse = () => {
          const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
          if (gate.cells.includes(cell)) usedGate = true;
        };
        if (id === 'first-link') {
          stepUntil(run, 'down', (state) => {
            noteGateUse();
            return state.player.y >= 27.5;
          });
        } else {
          stepUntil(run, 'down', (state) => state.player.y >= 17.5);
          stepRun(run, { direction: null }, FIXED_DT);
          stepUntil(run, 'right', (state) => {
            noteGateUse();
            return state.player.x >= 57.5;
          });
        }
        noteGateUse();
        const endCell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
        assert.equal(usedGate, true);
        assert.equal(run.cells[endCell], CELL.SAFE);
        assert.equal(run.foundation.permanent[endCell], 1);
        assert.equal(run.classic.livesLost, 0);
      });
