import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import {
  ROVER_CULTURAL_ROUTES_REVISION,
  ROVER_CULTURAL_ROUTES_SELECTIONS,
  ROVER_CULTURAL_ROUTES_SOURCES,
  createRoverCulturalRoutesCandidates,
} from '../content-design/rover-cultural-routes-candidates.mjs';
import { createNeonCulturalRoutesFinaleCandidates } from '../content-design/neon-cultural-routes-finale-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const IDS = ROVER_CULTURAL_ROUTES_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createNeonCulturalRoutesFinaleCandidates({ artwork: true });
const source = createRoverCulturalRoutesCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is three unowned Rover identities with bounded cultural attribution', () => {
  assert.deepEqual(IDS, ['wake-the-yard', 'between-the-rows', 'rover-remix']);
  assert.equal(new Set(IDS).size, IDS.length);
  for (const selection of ROVER_CULTURAL_ROUTES_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 4);
    assert(selection.sourceIds.every((id) => ROVER_CULTURAL_ROUTES_SOURCES[id]));
  }
  assert.match(ROVER_CULTURAL_ROUTES_SOURCES.reshetylivkaWhitework.url, /unesco-centerbg\.org/);
  assert.match(ROVER_CULTURAL_ROUTES_SOURCES.kosivCeramics.url, /ich\.unesco\.org/);
  assert.match(ROVER_CULTURAL_ROUTES_SOURCES.petrykivkaPainting.url, /ich\.unesco\.org/);
  for (const item of Object.values(ROVER_CULTURAL_ROUTES_SOURCES)) {
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only selected missions and owners: artwork=${artwork}`, () => {
    const before = createNeonCulturalRoutesFinaleCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createRoverCulturalRoutesCandidates({ artwork });
    assert.deepEqual(createNeonCulturalRoutesFinaleCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, ROVER_CULTURAL_ROUTES_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, ROVER_CULTURAL_ROUTES_REVISION);
        for (const key of [
          'id',
          'name',
          'spawnId',
          'modes',
          'objectives',
          'bonuses',
          'timedBonuses',
          'coverage',
          'timeLimitSeconds',
          'presentation',
        ])
          assert.deepEqual(current[key], previous[key], `${current.id}/${key}`);
        assert.deepEqual(
          current.actors.map(({ role, tier }) => ({ role, tier })),
          previous.actors.map(({ role, tier }) => ({ role, tier })),
        );
        assert.deepEqual(current.design.introduces, previous.design.introduces);
      }
    }
  });

test('ornament obstacles keep one field and deliberate disconnected returns', () => {
  const expected = {
    'wake-the-yard': { foundations: 160, walls: 8, safeComponents: 4 },
    'between-the-rows': { foundations: 355, walls: 8, safeComponents: 5 },
    'rover-remix': { foundations: 294, walls: 8, safeComponents: 6 },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(current.geometry.foundationCount, expected[id].foundations);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert.equal(current.geometry.safeComponents.length, expected[id].safeComponents);
    assert.deepEqual(
      current.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    assert(current.geometry.safeComponents.every((component) => component.departures.length >= 4));
    for (const difficulty of PRESETS) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(inspectMissionTopology(manifest.level, current.geometry).diagnostics, []);
    }
  }
});

test('rules, roles, bonuses and objectives remain exact across presets and modes', () => {
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(solo.level.rules, before.level.rules);
      assert.deepEqual(solo.level.objectives, before.level.objectives);
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
  if (id === 'wake-the-yard' && approach === 'central-window-first') close('down');
  else if (id === 'wake-the-yard' && approach === 'east-window-first') {
    position('right', (state) => state.player.x >= 58.4);
    close('down');
  } else if (id === 'between-the-rows' && approach === 'west-panel-first') {
    position('right', (state) => state.player.x >= 24.4);
    position('down', (state) => state.player.y >= 16.4);
    close('left');
  } else if (id === 'between-the-rows' && approach === 'east-panel-first') {
    position('right', (state) => state.player.x >= 63.4);
    position('down', (state) => state.player.y >= 19.4);
    close('left');
  } else if (id === 'rover-remix' && approach === 'central-branch-first') close('down');
  else if (id === 'rover-remix' && approach === 'outer-cluster-first') {
    position('right', (state) => state.player.x >= 59.4);
    close('down');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

const EXPECTED_CLAIMS = Object.freeze({
  'central-window-first': 7,
  'east-window-first': 13,
  'west-panel-first': 19,
  'east-panel-first': 23,
  'central-branch-first': 6,
  'outer-cluster-first': 5,
});

for (const selection of ROVER_CULTURAL_ROUTES_SELECTIONS)
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

for (const selection of ROVER_CULTURAL_ROUTES_SELECTIONS)
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

test('registered v18 successor preserves v17 order and uses isolated progress ownership', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v18');
  const previous = createAuthoredJourneyRoute('whole-spatial-v17');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v18');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v18');
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
    team: 'team-cultural-specialist-originals-1',
  });
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v18');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v18&return=solo',
  );
  for (const key of ['campaigns', 'packs'])
    assert.deepEqual(
      current.source[key].map((item) =>
        key === 'campaigns' ? [item.id, item.missionIds] : [item.id, item.campaignIds],
      ),
      previous.source[key].map((item) =>
        key === 'campaigns' ? [item.id, item.missionIds] : [item.id, item.campaignIds],
      ),
    );
});

test('Studio retains v17 and v18 while its selector advances to v20', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    node.childNodes?.forEach(visit);
  };
  visit(parse(html));
  const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
  const selector = nodes.find((node) => attribute(node, 'id') === 'whole-variety-edition');
  const options = selector.childNodes.filter((node) => node.tagName === 'option');
  assert.equal(
    options.filter((node) => attribute(node, 'value') === 'neon-cultural-routes-2').length,
    1,
  );
  assert.deepEqual(
    options
      .filter((node) => attribute(node, 'selected') !== undefined)
      .map((node) => attribute(node, 'value')),
    ['apex-cultural-routes-1'],
  );
  assert.match(html, /journey=whole-spatial-v18/);
  assert.match(script, /'rover-cultural-routes-1': createRoverCulturalRoutesCandidates/);
});
