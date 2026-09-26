import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROSSWIND_CULTURAL_COMPLETION_REVISION,
  CROSSWIND_CULTURAL_COMPLETION_SELECTIONS,
  CROSSWIND_CULTURAL_COMPLETION_SOURCES,
  createCrosswindCulturalCompletionCandidates,
} from '../content-design/crosswind-cultural-completion-candidates.mjs';
import { createRelayCulturalCompletionCandidates } from '../content-design/relay-cultural-completion-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
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
import { inspectJourneySpatialVariety } from '../content-design/spatial-variety.mjs';
import { WHOLE_JOURNEY_CORE_PACK_IDS } from '../content-design/whole-journey-order.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';

const IDS = CROSSWIND_CULTURAL_COMPLETION_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createRelayCulturalCompletionCandidates({ artwork: true });
const source = createCrosswindCulturalCompletionCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection completes three open Crosswind identities with bounded museum attribution', () => {
  assert.deepEqual(IDS, ['survey-markers', 'compass-array', 'outer-loop']);
  for (const selection of CROSSWIND_CULTURAL_COMPLETION_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 4);
    assert(selection.sourceIds.every((id) => CROSSWIND_CULTURAL_COMPLETION_SOURCES[id]));
  }
  for (const item of Object.values(CROSSWIND_CULTURAL_COMPLETION_SOURCES)) {
    assert.match(item.url, /(honchar\.org\.ua|museum\.mincult\.gov\.ua)/);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only selected Crosswind missions and owners: artwork=${artwork}`, () => {
    const before = createRelayCulturalCompletionCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createCrosswindCulturalCompletionCandidates({ artwork });
    assert.deepEqual(createRelayCulturalCompletionCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, CROSSWIND_CULTURAL_COMPLETION_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, CROSSWIND_CULTURAL_COMPLETION_REVISION);
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

test('ornament walls create distinct Crosswind approaches without changing established fields', () => {
  const expected = {
    'survey-markers': { walls: 6, safe: 5, zones: 3 },
    'compass-array': { walls: 8, safe: 6, zones: 6 },
    'outer-loop': { walls: 6, safe: 5, zones: 3 },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.geometry.safeComponents.length, expected[id].safe);
    assert.equal(current.geometry.speedZones.length, expected[id].zones);
    assert.deepEqual(current.source.foundations, previous.source.foundations);
    assert.deepEqual(current.source.speedZones, previous.source.speedZones);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.gates, previous.source.gates);
    assert.deepEqual(
      current.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    for (const difficulty of PRESETS) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(inspectMissionTopology(manifest.level, current.geometry).diagnostics, []);
    }
  }
});

test('v27 removes three Crosswind open-plain repetitions while retaining the rest of the queue', () => {
  const report = inspectJourneySpatialVariety(source, {
    packIds: WHOLE_JOURNEY_CORE_PACK_IDS,
    mode: 'solo',
    difficulty: 'standard',
  });
  const crosswind = report.campaigns.find((item) => item.campaignId === 'crosswind-array');
  assert.deepEqual(
    {
      missionsWithWalls: crosswind.missionsWithWalls,
      missionsWithTerrain: crosswind.missionsWithTerrain,
      openPlainMissions: crosswind.openPlainMissions,
    },
    { missionsWithWalls: 6, missionsWithTerrain: 1, openPlainMissions: [] },
  );
  assert.equal(
    report.rows.filter((row) => row.packId !== WHOLE_JOURNEY_CORE_PACK_IDS[0] && row.openPlain)
      .length,
    15,
  );
});

test('rules, actors, directional fields, bonuses and objectives remain exact across presets and modes', () => {
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(solo.level.rules, before.level.rules);
      assert.deepEqual(solo.level.objectives, before.level.objectives);
      assert.deepEqual(solo.level.relays, before.level.relays);
      assert.deepEqual(solo.level.directionalZones, before.level.directionalZones);
      assert.deepEqual(solo.level.powerups, before.level.powerups);
      assert.deepEqual(solo.level.timedBonuses, before.level.timedBonuses);
      assert.deepEqual(
        solo.level.enemies.map((enemy) => enemy.type).sort(),
        before.level.enemies.map((enemy) => enemy.type).sort(),
      );
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
    }
});

function stepUntil(run, direction, predicate, sidecars = {}, maxTicks = 9000) {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (sidecars.recorder) recordInput(sidecars.recorder, { direction });
    stepRun(run, { direction }, FIXED_DT);
    if (sidecars.duel) stepDuel(sidecars.duel, [{ direction }, { direction }]);
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
    if (predicate(run)) return;
  }
  assert.fail(`route did not reach its authored decision within ${maxTicks} ticks`);
}

function closeRoute(run, id, approach, sidecars = {}) {
  const position = (direction, predicate) => stepUntil(run, direction, predicate, sidecars);
  const close = (direction) =>
    stepUntil(
      run,
      direction,
      (state) => state.events.some((event) => event.type === 'cut.closed'),
      sidecars,
    );
  if (id === 'survey-markers' && approach === 'north-receiver-first') close('up');
  else if (id === 'survey-markers' && approach === 'east-receiver-first') close('right');
  else if (id === 'compass-array' && approach === 'north-neck-first') close('up');
  else if (id === 'compass-array' && approach === 'west-arm-first') {
    position(null, (state) => {
      const keeper = state.enemies.find((enemy) => enemy.id === 'west');
      return keeper.y >= 24 && keeper.vy > 0;
    });
    close('left');
  } else if (id === 'outer-loop' && approach === 'inner-post-first') close('right');
  else if (id === 'outer-loop' && approach === 'outer-post-first') {
    position('up', (state) => state.player.y <= 7.6);
    position('right', (state) => state.player.x >= 60.4);
    position('down', (state) => state.player.y >= 11.4);
    close('right');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

for (const selection of CROSSWIND_CULTURAL_COMPLETION_SELECTIONS)
  for (const difficulty of PRESETS)
    for (const turnPolicy of ['immediate', 'grid-center'])
      test(`${selection.id} executes both approaches on ${difficulty}/${turnPolicy} across seeds`, () => {
        for (const approach of selection.approaches)
          for (const seed of [1, 2]) {
            const manifest = resolveMission(project, selection.id, { difficulty });
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            closeRoute(run, selection.id, approach);
            assert(run.claimedCount > 0);
            assert.equal(run.player.cutting, false);
            assert.equal(run.player.speed, 0);
          }
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

for (const selection of CROSSWIND_CULTURAL_COMPLETION_SELECTIONS)
  for (const approach of selection.approaches)
    test(`${selection.id}/${approach} is replay-stable and equal on both Versus boards`, () => {
      const manifest = resolveMission(project, selection.id, { difficulty: 'standard' });
      const options = { seed: 1, classId: 'scout', turnPolicy: 'grid-center' };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(manifest.level, options);
      const duel = createDuel(manifest.level, options, {
        protocol: UNTIMED_DUEL_PROTOCOL,
        seconds: 0,
      });
      resumeDuel(duel);
      closeRoute(run, selection.id, approach, { recorder, duel });
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      assert(duel.runs.every((candidate) => candidate.classic.livesLost === 0));
      assert.deepEqual(
        authoritativeCheckpoint(duel.runs[0]),
        authoritativeCheckpoint(duel.runs[1]),
      );
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(duel.runs[0]));
    });

test('registered v27 successor preserves v26 and remains an explicit review route', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v27');
  const previous = createAuthoredJourneyRoute('whole-spatial-v26');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v27');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v27');
  assert.notEqual(current.profileKey, previous.profileKey);
  assert.notEqual(current.sessionKey, previous.sessionKey);
  assert.deepEqual(previous.source, beforeSource);
  assert.deepEqual(current.source, source);
  assert.deepEqual(current.corePackIds, previous.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, previous.optionalCampaignIds);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: 'team-cultural-specialist-originals-2',
  });
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v27');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v27&return=solo',
  );
});
