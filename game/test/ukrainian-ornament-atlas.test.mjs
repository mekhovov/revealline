import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUkrainianOrnamentAtlasJourney,
  UKRAINIAN_ORNAMENT_ATLAS_IDS,
  UKRAINIAN_ORNAMENT_ATLAS_REVISION,
} from '../content-design/ukrainian-ornament-atlas.mjs';
import { createUkrainianOrnamentJourney } from '../content-design/ukrainian-ornament-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { prepareSpatialMission } from '../../scripts/lib/spatial-challenge-assessment.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';

const source = createUkrainianOrnamentAtlasJourney();
const previous = createUkrainianOrnamentJourney();
const project = compileContentProject(source);
const base = compileContentProject(previous);
const ids = new Set(UKRAINIAN_ORNAMENT_ATLAS_IDS);
const mapFor = (content, mission) =>
  content.maps.find((map) => map.id === mission.map.id && map.revision === mission.map.revision);

for (const artwork of [false, true])
  test(`nine copy-on-write successors preserve 82 missions, original art and historical editions: ${artwork}`, () => {
    const old = createUkrainianOrnamentJourney({ artwork });
    const before = structuredClone(old);
    const next = createUkrainianOrnamentAtlasJourney({ artwork, source: freezeDesign(old) });
    assert.deepEqual(old, before);
    assert.equal(next.missions.length, 91);
    assert.equal(next.maps.length, 91);
    assert.equal(ids.size, 9);
    assert(Object.isFrozen(UKRAINIAN_ORNAMENT_ATLAS_IDS));
    for (const key of ['assets', 'policyId', 'actorCatalogId', 'difficultyCatalogId'])
      assert.deepEqual(next[key], old[key]);
    for (const key of ['campaigns', 'packs'])
      assert.deepEqual(
        next[key].map((v) => ({ ...v, revision: null })),
        old[key].map((v) => ({ ...v, revision: null })),
      );
    for (const mission of next.missions) {
      const prior = old.missions.find((m) => m.id === mission.id);
      const map = mapFor(next, mission),
        oldMap = mapFor(old, prior);
      if (!ids.has(mission.id)) {
        assert.deepEqual(mission, prior);
        assert.deepEqual(map, oldMap);
        continue;
      }
      assert.equal(mission.revision, UKRAINIAN_ORNAMENT_ATLAS_REVISION);
      assert.equal(map.revision, UKRAINIAN_ORNAMENT_ATLAS_REVISION);
      for (const key of Object.keys(prior))
        if (!['revision', 'map', 'design'].includes(key))
          assert.deepEqual(mission[key], prior[key], `${mission.id}/${key}`);
      for (const key of Object.keys(oldMap))
        if (!['revision', 'walls'].includes(key))
          assert.deepEqual(map[key], oldMap[key], `${mission.id}/${key}`);
      assert.deepEqual(mission.design.difficulty, prior.design.difficulty);
      assert.deepEqual(mission.design.introduces, prior.design.introduces);
      assert.notDeepEqual(map.walls, oldMap.walls);
      for (const key of ['routeDecision', 'counterplay', 'captureConsequence', 'mastery'])
        assert.notEqual(mission.design[key], prior.design[key]);
    }
  });

test('copy-on-write retains a shared historical map and rejects incomplete sources', () => {
  const input = createUkrainianOrnamentJourney();
  const original = input.missions.find((m) => m.id === 'two-districts');
  const map = structuredClone(mapFor(input, original));
  input.missions.push({ ...structuredClone(original), id: 'shared-map-draft' });
  const next = createUkrainianOrnamentAtlasJourney({ source: input });
  assert.deepEqual(
    next.maps.find((m) => m.id === map.id && m.revision === map.revision),
    map,
  );
  assert.equal(next.maps.length, input.maps.length + 1);
  const missing = createUkrainianOrnamentJourney();
  missing.missions = missing.missions.filter((m) => m.id !== 'two-districts');
  assert.throws(() => createUkrainianOrnamentAtlasJourney({ source: missing }), /requires mission/);
});

for (const id of ids)
  test(`${id}: authored walls are real obstacles, with retained field and usable returns`, () => {
    const mission = project.missions.find((m) => m.id === id);
    const map = project.maps.find(
      (m) => m.source.id === mission.map.id && m.source.revision === mission.map.revision,
    );
    assert(map.source.walls.length > 0 && map.source.walls.length <= 100);
    assert.equal(map.geometry.fieldComponents.length, id === 'two-districts' ? 2 : 1);
    assert(map.geometry.safeComponents.every((c) => c.departures.length >= 4));
    assert(!map.geometry.diagnostics.some((d) => d.code === 'remote-chamber'));
    for (const rectangle of map.source.walls)
      for (let y = rectangle.y; y < rectangle.y + rectangle.h; y++)
        for (let x = rectangle.x; x < rectangle.x + rectangle.w; x++) {
          const i = y * 72 + x;
          assert.equal(map.geometry.cells[i], CELL.WALL);
          assert.equal(map.geometry.permanent[i], 0);
          assert.equal(map.geometry.eligible[i], 0);
        }
  });

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`all nine use actual shared gp4 rules and equal paired boards: ${difficulty}/${turnPolicy}`, () => {
      const actualCounts = [4, 3, 3, 3, 4, 5, 3, 3, 3];
      const expertCounts = [6, 4, 4, 4, 6, 6, 4, 4, 4];
      for (const [index, id] of UKRAINIAN_ORNAMENT_ATLAS_IDS.entries()) {
        const solo = resolveMission(project, id, { difficulty });
        const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
        const old = resolveMission(base, id, { difficulty });
        assert.deepEqual(solo.level, versus.level);
        assert.deepEqual(solo.level.rules, old.level.rules);
        assert.deepEqual(solo.level.goal, old.level.goal);
        assert.notEqual(solo.simulationIdentity, old.simulationIdentity);
        const prepared = prepareSpatialMission(project, id, { difficulty });
        assert.equal(prepared.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
        assert.equal(prepared.gameplayTuning.adminOverride, false);
        const run = createRun(prepared.level, { seed: 1, turnPolicy });
        const peer = createRun(prepared.level, { seed: 1, turnPolicy });
        assert.equal(
          run.enemies.length,
          (difficulty === 'expert' ? expertCounts : actualCounts)[index],
        );
        assert.equal(run.lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
        assert.equal(inspectCaptureSnapshot(run).filledCells.length, 0);
        assert(inspectCaptureSnapshot(run).components.every((c) => c.retained));
        assert.equal(
          run.cells[Math.floor(run.player.y) * 72 + Math.floor(run.player.x)],
          CELL.SAFE,
        );
        for (let tick = 0; tick < 60; tick++) {
          stepRun(run, { direction: null }, FIXED_DT);
          stepRun(peer, { direction: null }, FIXED_DT);
        }
        assert.equal(run.classic.livesLost, 0, id);
        assert.equal(run.coverage, 0, id);
        assert.equal(authoritativeCheckpoint(run).hash, authoritativeCheckpoint(peer).hash);
      }
    });

test('paired lens panels require a direct western crossing versus an eastern dogleg', () => {
  const run = createRun(prepareSpatialMission(project, 'twin-lens-chambers').level, { seed: 1 });
  const at = (x, y) => run.cells[y * 72 + x];
  for (let x = 22; x < 29; x++) assert.equal(at(x, 17), CELL.FIELD);
  for (const x of [46, 47]) for (let y = 14; y <= 20; y++) assert.equal(at(x, y), CELL.WALL);
  for (const y of [13, 21]) for (let x = 43; x <= 50; x++) assert.equal(at(x, y), CELL.FIELD);
  for (let y = 15; y <= 20; y++) assert.equal(at(50, y), CELL.SAFE);
  assert.notDeepEqual([...run.cells], [...run.cells].reverse());
});

test('specialized successor geometry preserves relay connectors and every arrow cell', () => {
  const relay = source.missions.find((m) => m.id === 'second-approach');
  const relayMap = mapFor(source, relay);
  assert.equal(relayMap.gates.length, 2);
  assert.equal(relay.objectives.length, 2);
  const wind = createRun(prepareSpatialMission(project, 'windbreak-weave').level, { seed: 1 });
  const windMap = mapFor(
    source,
    source.missions.find((m) => m.id === 'windbreak-weave'),
  );
  assert.equal(windMap.speedZones.length, 4);
  for (const rect of windMap.speedZones)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++)
        assert.equal(wind.cells[y * 72 + x], CELL.FIELD);
});
