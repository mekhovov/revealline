import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTESTED_WALL_TRIPTYCH_REVISION,
  CONTESTED_WALL_TRIPTYCH_SELECTIONS,
  CONTESTED_WALL_TRIPTYCH_SOURCES,
  createContestedWallTriptychCandidates,
} from '../content-design/contested-wall-triptych-candidates.mjs';
import { createCurrentRemixPressureCandidates } from '../content-design/current-remix-pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

const IDS = CONTESTED_WALL_TRIPTYCH_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createCurrentRemixPressureCandidates({ artwork: true });
const source = createContestedWallTriptychCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('triptych selects open Neon, Fracture and Livewire identities with bounded cultural sources', () => {
  assert.deepEqual(IDS, ['side-door-bays', 'staggered-reserve', 'crossbar-depot']);
  assert.deepEqual(
    CONTESTED_WALL_TRIPTYCH_SELECTIONS.map((item) => item.sourceIds),
    [['opishnePaintedBowls'], ['borshchivEmbroidery'], ['kyivWovenBelt']],
  );
  for (const selection of CONTESTED_WALL_TRIPTYCH_SELECTIONS) {
    assert.equal(selection.approaches.length, 2);
    assert(selection.pressurePoints.length >= 4);
    assert(selection.sourceIds.every((id) => CONTESTED_WALL_TRIPTYCH_SOURCES[id]));
  }
  for (const item of Object.values(CONTESTED_WALL_TRIPTYCH_SOURCES)) {
    assert.match(item.url, /^https:\/\//);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /no .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write preserves every unselected mission and selected runtime owner: artwork=${artwork}`, () => {
    const before = createCurrentRemixPressureCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createContestedWallTriptychCandidates({ artwork });
    assert.deepEqual(createCurrentRemixPressureCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, CONTESTED_WALL_TRIPTYCH_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, CONTESTED_WALL_TRIPTYCH_REVISION);
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

test('three wall fields remain communicating and preserve effective pressure across presets', () => {
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(previous.source.walls.length, 0);
    assert.equal(current.source.walls.length, 8);
    assert.deepEqual(current.source.foundations, previous.source.foundations);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.spawns, previous.source.spawns);
    assert.equal(current.geometry.fieldComponents.length, 1);
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

test('all presets give the stationary opening a safe readable window', () => {
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const { level } = resolveMission(project, id, { difficulty, mode: 'solo' });
      const run = createRun(level, { seed: 1, turnPolicy: 'immediate' });
      for (let tick = 0; tick < 180; tick++) stepRun(run, { direction: null }, FIXED_DT);
      assert.equal(run.status, 'running', `${id}/${difficulty}`);
      assert.equal(run.classic.livesLost, 0, `${id}/${difficulty}`);
    }
});

test('v36 is an immutable opt-in route and preserves v35', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v36');
  const previous = createAuthoredJourneyRoute('whole-spatial-v35');
  const loaded = await loadAuthoredJourneyRoute('whole-spatial-v36');
  assert.equal(current.profileKey, 'journey-whole-spatial-v36');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v36');
  assert.equal(current.source.revision, CONTESTED_WALL_TRIPTYCH_REVISION);
  assert.equal(previous.source.revision, beforeSource.revision);
  assert.deepEqual(loaded, current);
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(Object.isFrozen(current));
  assert(Object.isFrozen(current.source));
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v36');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v36&return=solo',
  );
});
