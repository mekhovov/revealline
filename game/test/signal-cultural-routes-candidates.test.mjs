import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGNAL_CULTURAL_ROUTES_REVISION,
  SIGNAL_CULTURAL_ROUTES_SELECTIONS,
  SIGNAL_CULTURAL_ROUTES_SOURCES,
  createSignalCulturalRoutesCandidates,
} from '../content-design/signal-cultural-routes-candidates.mjs';
import { createEarlyCulturalRoutesCandidates } from '../content-design/early-cultural-routes-candidates.mjs';
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

const IDS = SIGNAL_CULTURAL_ROUTES_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createEarlyCulturalRoutesCandidates({ artwork: true });
const source = createSignalCulturalRoutesCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is exactly three baseline Signal identities with bounded cultural attribution', () => {
  assert.deepEqual(IDS, ['soft-crossing', 'cool-the-crossing', 'signal-remix']);
  assert.equal(new Set(IDS).size, IDS.length);
  for (const selection of SIGNAL_CULTURAL_ROUTES_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 4 && selection.pressurePoints.length <= 5);
    assert(selection.sourceIds.every((id) => SIGNAL_CULTURAL_ROUTES_SOURCES[id]));
  }
  assert.match(SIGNAL_CULTURAL_ROUTES_SOURCES.reshetylivkaWhitework.url, /unesco-centerbg\.org/);
  assert.match(SIGNAL_CULTURAL_ROUTES_SOURCES.kosivCeramics.url, /ich\.unesco\.org/);
  assert.match(SIGNAL_CULTURAL_ROUTES_SOURCES.petrykivkaPainting.url, /ich\.unesco\.org/);
  for (const item of Object.values(SIGNAL_CULTURAL_ROUTES_SOURCES)) {
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only selected missions and owners: artwork=${artwork}`, () => {
    const before = createEarlyCulturalRoutesCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createSignalCulturalRoutesCandidates({ artwork });
    assert.deepEqual(createEarlyCulturalRoutesCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, SIGNAL_CULTURAL_ROUTES_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, SIGNAL_CULTURAL_ROUTES_REVISION);
        for (const key of [
          'id',
          'name',
          'spawnId',
          'modes',
          'actors',
          'objectives',
          'bonuses',
          'timedBonuses',
          'coverage',
          'timeLimitSeconds',
          'presentation',
        ])
          assert.deepEqual(current[key], previous[key], `${current.id}/${key}`);
        assert.deepEqual(current.design.difficulty, previous.design.difficulty);
        assert.deepEqual(current.design.introduces, previous.design.introduces);
        assert.deepEqual(current.design.practices, previous.design.practices);
        assert.deepEqual(current.design.combines, previous.design.combines);
      }
    }
    for (const current of revised.campaigns) {
      const previous = before.campaigns.find((item) => item.id === current.id);
      if (['signal-gardens', 'signal-remixes'].includes(current.id)) {
        assert.equal(current.revision, SIGNAL_CULTURAL_ROUTES_REVISION);
        assert.deepEqual(current.missionIds, previous.missionIds);
      } else assert.deepEqual(current, previous);
    }
  });

test('geometry adds distinct returns without increasing permanent foundation area', () => {
  const expected = {
    'soft-crossing': { before: 27, after: 27, safeComponents: 3 },
    'cool-the-crossing': { before: 42, after: 40, safeComponents: 4 },
    'signal-remix': { before: 220, after: 181, safeComponents: 3 },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(previous.geometry.foundationCount, expected[id].before);
    assert.equal(current.geometry.foundationCount, expected[id].after);
    assert(current.geometry.eligibleCount >= previous.geometry.eligibleCount);
    assert.equal(current.geometry.safeComponents.length, expected[id].safeComponents);
    assert(current.geometry.safeComponents.every((component) => component.departures.length >= 4));
    assert.deepEqual(current.source.walls, previous.source.walls);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.speedZones, previous.source.speedZones);
    for (const difficulty of PRESETS) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(inspectMissionTopology(manifest.level, current.geometry).diagnostics, []);
    }
  }
});

test('actors, rules, hazards, bonuses and objectives remain exact across presets and modes', () => {
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(solo.level.enemies, before.level.enemies);
      assert.deepEqual(solo.level.rules, before.level.rules);
      assert.deepEqual(solo.level.terrain, before.level.terrain);
      assert.deepEqual(solo.level.objectives, before.level.objectives);
      assert.deepEqual(solo.level.powerups, before.level.powerups);
      assert.deepEqual(solo.level.timedBonuses, before.level.timedBonuses);
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
  if (id === 'soft-crossing' && approach === 'slow-band-first') close('down');
  else if (id === 'soft-crossing' && approach === 'clear-edge-first') {
    position('right', (state) => state.player.x >= 50.4);
    position('down', (state) => state.player.y >= 21.4);
    close('left');
  } else if (id === 'cool-the-crossing' && approach === 'near-panel-first') close('down');
  else if (id === 'cool-the-crossing' && approach === 'far-panel-first') {
    position('right', (state) => state.player.x >= 53.4);
    close('down');
  } else if (id === 'signal-remix' && approach === 'upper-branch-first') {
    position('up', (state) => state.player.y <= 11.6);
    position('right', (state) => state.player.x >= 34.4);
    close('up');
  } else if (id === 'signal-remix' && approach === 'lower-branch-first') {
    position('up', (state) => state.player.y <= 11.6);
    position('right', (state) => state.player.x >= 34.4);
    position('down', (state) => state.player.y >= 22.4);
    position('right', (state) => state.player.x >= 54.4);
    close('down');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

const EXPECTED_CLAIMS = Object.freeze({
  'slow-band-first': 12,
  'clear-edge-first': 28,
  'near-panel-first': 7,
  'far-panel-first': 23,
  'upper-branch-first': 10,
  'lower-branch-first': 8,
});

for (const selection of SIGNAL_CULTURAL_ROUTES_SELECTIONS)
  for (const difficulty of PRESETS)
    for (const turnPolicy of ['immediate', 'grid-center'])
      test(`${selection.id} executes both approaches on ${difficulty}/${turnPolicy} across seeds`, () => {
        for (const approach of selection.approaches)
          for (const seed of [1, 2]) {
            const manifest = resolveMission(project, selection.id, { difficulty });
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            closeRoute(run, selection.id, approach);
            assert.equal(run.claimedCount, EXPECTED_CLAIMS[approach]);
            assert.equal(run.player.cutting, false);
            assert.equal(run.player.speed, 0);
            assert.equal(run.events.filter((event) => event.type === 'cut.closed').length, 1);
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

for (const selection of SIGNAL_CULTURAL_ROUTES_SELECTIONS)
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
