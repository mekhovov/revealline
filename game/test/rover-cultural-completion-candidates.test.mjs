import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROVER_CULTURAL_COMPLETION_REVISION,
  ROVER_CULTURAL_COMPLETION_SELECTIONS,
  ROVER_CULTURAL_COMPLETION_SOURCES,
  createRoverCulturalCompletionCandidates,
} from '../content-design/rover-cultural-completion-candidates.mjs';
import { createNeonCulturalCompletionCandidates } from '../content-design/neon-cultural-completion-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { inspectJourneySpatialVariety } from '../content-design/spatial-variety.mjs';
import { WHOLE_JOURNEY_CORE_PACK_IDS } from '../content-design/whole-journey-order.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';

const IDS = ROVER_CULTURAL_COMPLETION_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createNeonCulturalCompletionCandidates({ artwork: true });
const source = createRoverCulturalCompletionCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection adopts the reviewed Rover FPV and Ukrainian spatial pair with bounded sources', () => {
  assert.deepEqual(IDS, ['split-berths', 'stepped-return']);
  for (const selection of ROVER_CULTURAL_COMPLETION_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 4);
    assert(selection.sourceIds.every((id) => ROVER_CULTURAL_COMPLETION_SOURCES[id]));
  }
  for (const item of Object.values(ROVER_CULTURAL_COMPLETION_SOURCES)) {
    assert.match(item.url, /(museum\.mincult\.gov\.ua|museum\.kh\.ua)/);
    assert(item.observedVocabulary.length >= 4);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only the Rover pair and its owners: artwork=${artwork}`, () => {
    const before = createNeonCulturalCompletionCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createRoverCulturalCompletionCandidates({ artwork });
    assert.deepEqual(createNeonCulturalCompletionCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, ROVER_CULTURAL_COMPLETION_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, ROVER_CULTURAL_COMPLETION_REVISION);
        for (const key of [
          'id',
          'name',
          'spawnId',
          'modes',
          'actors',
          'objectives',
          'relayLinks',
          'bonuses',
          'timedBonuses',
          'coverage',
          'timeLimitSeconds',
          'presentation',
        ])
          assert.deepEqual(current[key], previous[key], `${current.id}/${key}`);
        assert.deepEqual(current.design.introduces, previous.design.introduces);
      }
    }
  });

test('FPV berths and gerdan lattice add deliberate returns without changing pressure actors', () => {
  const expected = {
    'split-berths': { walls: 10, foundations: 4, terrain: 1, safe: 5 },
    'stepped-return': { walls: 8, foundations: 7, terrain: 2, safe: 4 },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.source.foundations.length, expected[id].foundations);
    assert.equal(current.source.terrain.length, expected[id].terrain);
    assert(current.source.terrain.every((area) => area.kind === 'slow'));
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert.equal(current.geometry.safeComponents.length, expected[id].safe);
    assert.deepEqual(
      current.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(solo.level.rules, before.level.rules);
      assert.deepEqual(solo.level.enemies, before.level.enemies);
      assert.deepEqual(solo.level.objectives, before.level.objectives);
      assert.deepEqual(solo.level.relays, before.level.relays);
      assert.deepEqual(solo.level.powerups, before.level.powerups);
      assert.deepEqual(solo.level.timedBonuses, before.level.timedBonuses);
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
      assert.deepEqual(inspectMissionTopology(solo.level, current.geometry).diagnostics, []);
    }
  }
});

test('the successor removes both Rover missions from the open/plain review queue', () => {
  const report = inspectJourneySpatialVariety(source, {
    packIds: WHOLE_JOURNEY_CORE_PACK_IDS,
    mode: 'solo',
    difficulty: 'standard',
  });
  assert.equal(
    report.rows.filter((row) => row.packId !== WHOLE_JOURNEY_CORE_PACK_IDS[0] && row.openPlain)
      .length,
    7,
  );
  for (const id of IDS)
    assert.equal(report.rows.find((row) => row.missionId === id).openPlain, false);
});

const approaches = Object.freeze({
  'split-berths': Object.freeze({ workbenchFirst: 35.5, batteryBerthFirst: 52.5 }),
  'stepped-return': Object.freeze({ diamondFirst: 35.5, latticeOpeningFirst: 58.5 }),
});

function executeFirstClosure(run, targetX, sidecars = {}) {
  for (let ticks = 0; run.player.x < targetX && ticks < 1000; ticks++) {
    if (sidecars.recorder) recordInput(sidecars.recorder, { direction: 'right' });
    stepRun(run, { direction: 'right' }, FIXED_DT);
    if (sidecars.duel) stepDuel(sidecars.duel, [{ direction: 'right' }, { direction: 'right' }]);
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
  }
  for (let ticks = 0; ticks < 1000; ticks++) {
    if (sidecars.recorder) recordInput(sidecars.recorder, { direction: 'down' });
    stepRun(run, { direction: 'down' }, FIXED_DT);
    if (sidecars.duel) stepDuel(sidecars.duel, [{ direction: 'down' }, { direction: 'down' }]);
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
    if (run.events.some((event) => event.type === 'cut.closed')) return;
  }
  assert.fail('first closure did not reach its intended return');
}

for (const [id, routes] of Object.entries(approaches))
  for (const difficulty of PRESETS)
    for (const turnPolicy of ['immediate', 'grid-center'])
      test(`${id} executes both approaches on ${difficulty}/${turnPolicy} across seeds`, () => {
        for (const targetX of Object.values(routes))
          for (const seed of [1, 2]) {
            const manifest = resolveMission(project, id, { difficulty });
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            executeFirstClosure(run, targetX);
            assert(run.claimedCount > 0);
            assert.equal(run.player.cutting, false);
            assert.equal(run.player.speed, 0);
          }
      });

for (const [id, routes] of Object.entries(approaches))
  for (const [name, targetX] of Object.entries(routes))
    test(`${id}/${name} is replay-stable and equal on both Versus boards`, () => {
      const manifest = resolveMission(project, id, { difficulty: 'standard' });
      const options = { seed: 1, classId: 'scout', turnPolicy: 'grid-center' };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(manifest.level, options);
      const duel = createDuel(manifest.level, options, {
        protocol: UNTIMED_DUEL_PROTOCOL,
        seconds: 0,
      });
      resumeDuel(duel);
      executeFirstClosure(run, targetX, { recorder, duel });
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      assert(duel.runs.every((candidate) => candidate.classic.livesLost === 0));
      assert.deepEqual(
        authoritativeCheckpoint(duel.runs[0]),
        authoritativeCheckpoint(duel.runs[1]),
      );
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(duel.runs[0]));
    });

for (const id of IDS)
  for (const difficulty of PRESETS)
    test(`${id} has a safe idle opening on ${difficulty} across seeds`, () => {
      const manifest = resolveMission(project, id, { difficulty });
      for (const seed of [1, 2]) {
        const run = createRun(manifest.level, { seed, classId: 'scout' });
        for (let tick = 0; tick < 720; tick++) stepRun(run, { direction: null }, FIXED_DT);
        assert.equal(run.status, 'running');
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.claimedCount, 0);
      }
    });

test('registered v30 successor preserves v29 and remains an explicit review route', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v30');
  const previous = createAuthoredJourneyRoute('whole-spatial-v29');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v30');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v30');
  assert.notEqual(current.profileKey, previous.profileKey);
  assert.notEqual(current.sessionKey, previous.sessionKey);
  assert.deepEqual(previous.source, beforeSource);
  assert.deepEqual(current.source, source);
  assert.deepEqual(current.corePackIds, previous.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, previous.optionalCampaignIds);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, 'whole-spatial-v25');
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v30');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v30&return=solo',
  );
});
