import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CULTURAL_PRESSURE_TRIPTYCH_REVISION,
  CULTURAL_PRESSURE_TRIPTYCH_SELECTIONS,
  CULTURAL_PRESSURE_TRIPTYCH_SOURCES,
  createCulturalPressureTriptychCandidates,
} from '../content-design/cultural-pressure-triptych-candidates.mjs';
import { createCulturalTimedBonusPressureCandidates } from '../content-design/cultural-timed-bonus-pressure-candidates.mjs';
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

const IDS = CULTURAL_PRESSURE_TRIPTYCH_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createCulturalTimedBonusPressureCandidates({ artwork: true });
const source = createCulturalPressureTriptychCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('triptych selects one still-generic identity in each of Signal, Rover and Fracture', () => {
  assert.deepEqual(IDS, ['garden-refuges', 'broken-yard', 'island-reserve']);
  assert.deepEqual(
    CULTURAL_PRESSURE_TRIPTYCH_SELECTIONS.map((item) => item.sourceIds),
    [['reshetylivkaWhitework'], ['kosivCeramics'], ['crimeanTatarOrnek']],
  );
  for (const selection of CULTURAL_PRESSURE_TRIPTYCH_SELECTIONS) {
    assert.equal(selection.approaches.length, 2);
    assert(selection.pressurePoints.length >= 4);
    assert(selection.sourceIds.every((id) => CULTURAL_PRESSURE_TRIPTYCH_SOURCES[id]));
  }
  for (const item of Object.values(CULTURAL_PRESSURE_TRIPTYCH_SOURCES)) {
    assert.match(item.url, /^https:\/\//);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /no .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write preserves every unselected mission and selected runtime owner: artwork=${artwork}`, () => {
    const before = createCulturalTimedBonusPressureCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createCulturalPressureTriptychCandidates({ artwork });
    assert.deepEqual(createCulturalTimedBonusPressureCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, CULTURAL_PRESSURE_TRIPTYCH_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, CULTURAL_PRESSURE_TRIPTYCH_REVISION);
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

test('all three wall fields remain communicating and preserve effective pressure across presets', () => {
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

test('v34 is an immutable opt-in route and preserves v33', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v34');
  const previous = createAuthoredJourneyRoute('whole-spatial-v33');
  const loaded = await loadAuthoredJourneyRoute('whole-spatial-v34');
  assert.equal(current.profileKey, 'journey-whole-spatial-v34');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v34');
  assert.equal(current.source.revision, CULTURAL_PRESSURE_TRIPTYCH_REVISION);
  assert.equal(previous.source.revision, beforeSource.revision);
  assert.deepEqual(loaded, current);
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(Object.isFrozen(current));
  assert(Object.isFrozen(current.source));
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v34');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v34&return=solo',
  );
});
