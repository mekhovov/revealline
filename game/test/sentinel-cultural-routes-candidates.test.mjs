import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SENTINEL_CULTURAL_ROUTES_REVISION,
  SENTINEL_CULTURAL_ROUTES_SELECTIONS,
  SENTINEL_CULTURAL_ROUTES_SOURCES,
  createSentinelCulturalRoutesCandidates,
} from '../content-design/sentinel-cultural-routes-candidates.mjs';
import { createCrosswindCulturalRoutesCandidates } from '../content-design/crosswind-cultural-routes-candidates.mjs';
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
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';

const IDS = SENTINEL_CULTURAL_ROUTES_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createCrosswindCulturalRoutesCandidates({ artwork: true });
const source = createSentinelCulturalRoutesCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is three Sentinel identities with bounded museum attribution', () => {
  assert.deepEqual(IDS, ['first-relay', 'relay-perimeter', 'crown-audience']);
  for (const selection of SENTINEL_CULTURAL_ROUTES_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 4);
    assert(selection.sourceIds.every((id) => SENTINEL_CULTURAL_ROUTES_SOURCES[id]));
  }
  for (const item of Object.values(SENTINEL_CULTURAL_ROUTES_SOURCES)) {
    assert.match(item.url, /(honchar\.org\.ua|museum\.mincult\.gov\.ua)/);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only selected Sentinel missions and owners: artwork=${artwork}`, () => {
    const before = createCrosswindCulturalRoutesCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createSentinelCulturalRoutesCandidates({ artwork });
    assert.deepEqual(createCrosswindCulturalRoutesCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, SENTINEL_CULTURAL_ROUTES_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, SENTINEL_CULTURAL_ROUTES_REVISION);
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

test('ornament obstacles preserve deliberate Sentinel topology and shield systems', () => {
  const expected = {
    'first-relay': { walls: 9, safe: 5 },
    'relay-perimeter': { walls: 8, safe: 6 },
    'crown-audience': { walls: 8, safe: 6 },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert.equal(current.geometry.safeComponents.length, expected[id].safe);
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

test('rules, Sentinel roles, objectives, relays and bonuses remain exact across presets and modes', () => {
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(solo.level.rules, before.level.rules);
      assert.deepEqual(solo.level.objectives, before.level.objectives);
      assert.deepEqual(solo.level.relays, before.level.relays);
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
  if (id === 'first-relay' && approach === 'central-ridge') close('down');
  else if (id === 'first-relay' && approach === 'west-upper-landing') {
    position('left', (state) => state.player.x <= 13.5);
    close('down');
  } else if (id === 'relay-perimeter' && approach === 'left-zone-close') close('down');
  else if (id === 'relay-perimeter' && approach === 'central-focus-close') {
    position('right', (state) => state.player.x >= 35.5);
    close('down');
  } else if (id === 'crown-audience' && approach === 'north-centre-close') close('up');
  else if (id === 'crown-audience' && approach === 'west-side-close') close('left');
  else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

for (const selection of SENTINEL_CULTURAL_ROUTES_SELECTIONS)
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

for (const selection of SENTINEL_CULTURAL_ROUTES_SELECTIONS)
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

test('registered v24 successor preserves v23 order and uses isolated progress ownership', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v24');
  const previous = createAuthoredJourneyRoute('whole-spatial-v23');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v24');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v24');
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
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v24');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v24&return=solo',
  );
});
