import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BORDER_FRONTIER_POCKET_REVISION,
  BORDER_FRONTIER_POCKET_SELECTIONS,
  BORDER_FRONTIER_POCKET_SOURCES,
  createBorderFrontierPocketCandidates,
} from '../content-design/border-frontier-pocket-candidates.mjs';
import { createBorderCulturalCompletionCandidates } from '../content-design/border-cultural-completion-candidates.mjs';
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

const IDS = BORDER_FRONTIER_POCKET_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createBorderCulturalCompletionCandidates({ artwork: true });
const source = createBorderFrontierPocketCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection completes only the two remaining Border redesign dispositions', () => {
  assert.deepEqual(IDS, ['turn-the-corner', 'return-pocket']);
  assert.deepEqual(
    BORDER_FRONTIER_POCKET_SELECTIONS.map((item) => item.sourceIds),
    [['bukovynaPysanka'], ['podilliaStarRushnyk']],
  );
  for (const selection of BORDER_FRONTIER_POCKET_SELECTIONS) {
    assert.equal(selection.approaches.length, 2);
    assert(selection.pressurePoints.length >= 4);
    assert.match(selection.disposition, /wall-field$/);
    assert(selection.sourceIds.every((id) => BORDER_FRONTIER_POCKET_SOURCES[id]));
  }
  for (const item of Object.values(BORDER_FRONTIER_POCKET_SOURCES)) {
    assert.match(item.url, /^https:\/\//);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /no .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only selected Border missions and owners: artwork=${artwork}`, () => {
    const before = createBorderCulturalCompletionCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createBorderFrontierPocketCandidates({ artwork });
    assert.deepEqual(createBorderCulturalCompletionCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, BORDER_FRONTIER_POCKET_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, BORDER_FRONTIER_POCKET_REVISION);
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

test('wave and pocket wall fields retain one connected field and exact gameplay pressure', () => {
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(current.source.walls.length, 8);
    assert.deepEqual(current.source.foundations, previous.source.foundations);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.spawns, previous.source.spawns);
    assert.equal(current.geometry.fieldComponents.length, 1);
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
      assert.deepEqual(solo.level.powerups, before.level.powerups);
      assert.deepEqual(solo.level.timedBonuses, before.level.timedBonuses);
      assert.deepEqual(versus.level, solo.level);
      assert.deepEqual(inspectMissionTopology(solo.level, current.geometry).diagnostics, []);
    }
  }
});

test('only the two intentional open-layout lessons remain in the review queue', () => {
  const report = inspectJourneySpatialVariety(source, {
    packIds: WHOLE_JOURNEY_CORE_PACK_IDS,
    mode: 'solo',
    difficulty: 'standard',
  });
  assert.deepEqual(
    report.rows
      .filter((row) => row.packId !== WHOLE_JOURNEY_CORE_PACK_IDS[0] && row.openPlain)
      .map((row) => row.missionId),
    ['behind-the-patrol', 'side-door-bays'],
  );
});

function stepUntil(run, direction, predicate, sidecars = {}, maxTicks = 7000) {
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
  if (id === 'turn-the-corner' && approach === 'inner-wave-first') {
    position('left', (state) => state.player.x <= 22.4);
    close('up');
  } else if (id === 'turn-the-corner' && approach === 'outer-shoulder-first') {
    position('right', (state) => state.player.x >= 41.4);
    close('down');
  } else if (id === 'return-pocket' && approach === 'upper-mouth-first') {
    position('up', (state) => state.player.y <= 11.6);
    position('right', (state) => state.player.x >= 40.4);
    close('up');
  } else if (id === 'return-pocket' && approach === 'lower-mouth-first') {
    position('down', (state) => state.player.y >= 24.4);
    position('right', (state) => state.player.x >= 40.4);
    close('down');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

for (const selection of BORDER_FRONTIER_POCKET_SELECTIONS)
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

for (const selection of BORDER_FRONTIER_POCKET_SELECTIONS)
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

test('registered v32 successor preserves v31 and remains an explicit review route', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v32');
  const previous = createAuthoredJourneyRoute('whole-spatial-v31');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v32');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v32');
  assert.deepEqual(previous.source, beforeSource);
  assert.deepEqual(current.source, source);
  assert.deepEqual(current.corePackIds, previous.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, previous.optionalCampaignIds);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, 'whole-spatial-v25');
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v32');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v32&return=solo',
  );
});
