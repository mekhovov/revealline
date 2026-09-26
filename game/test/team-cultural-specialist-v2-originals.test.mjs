import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamCulturalSpecialistV2OriginalCandidates,
  TEAM_CULTURAL_SPECIALIST_V2_REVISION,
  TEAM_CULTURAL_SPECIALIST_V2_SELECTIONS,
  TEAM_CULTURAL_SPECIALIST_V2_SOURCES,
} from '../content-design/team-cultural-specialist-v2-originals.mjs';
import { createTeamCulturalSpecialistOriginalCandidates } from '../content-design/team-cultural-specialist-originals.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';

const IDS = TEAM_CULTURAL_SPECIALIST_V2_SELECTIONS.map(({ id }) => id);
const source = createTeamCulturalSpecialistV2OriginalCandidates();
const previous = createTeamCulturalSpecialistOriginalCandidates();
const project = compileContentProject(source);
const previousProject = compileContentProject(previous);
const command = () => ({ direction: null, boost: false, support: false });
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('the second Team slice uses three additional bounded Ukrainian records', () => {
  assert.deepEqual(IDS, ['crossed-gardens', 'split-orchards', 'weaver-crossing']);
  for (const selection of TEAM_CULTURAL_SPECIALIST_V2_SELECTIONS) {
    assert(previous.missions.some(({ id }) => id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.partnerBenefit.length > 60);
    assert(selection.sourceIds.every((id) => TEAM_CULTURAL_SPECIALIST_V2_SOURCES[id]));
  }
  for (const item of Object.values(TEAM_CULTURAL_SPECIALIST_V2_SOURCES)) {
    assert.match(item.url, /^https:\/\/museum\.mincult\.gov\.ua\/collections\//);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

test('copy-on-write preserves every previous Team edition and unrelated mission', () => {
  const snapshot = structuredClone(previous);
  assert.deepEqual(createTeamCulturalSpecialistOriginalCandidates(), snapshot);
  assert.equal(source.revision, TEAM_CULTURAL_SPECIALIST_V2_REVISION);
  assert.deepEqual(source.assets, previous.assets);
  assert.deepEqual(
    source.missions.map(({ id }) => id),
    previous.missions.map(({ id }) => id),
  );
  for (const current of source.missions) {
    const old = previous.missions.find(({ id }) => id === current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, old);
    else {
      assert.equal(current.revision, TEAM_CULTURAL_SPECIALIST_V2_REVISION);
      for (const key of [
        'id',
        'name',
        'spawnId',
        'modes',
        'actors',
        'objectives',
        'bonuses',
        'coverage',
        'timeLimitSeconds',
        'presentation',
        'team',
      ])
        assert.deepEqual(current[key], old[key], `${current.id}/${key}`);
      assert.deepEqual(current.design.introduces, old.design.introduces);
      assert(current.design.combines.includes('complementary-routes'));
    }
  }
});

test('the new ornament layouts remain connected and expose deliberate return components', () => {
  const expected = {
    'crossed-gardens': { walls: 6, terrain: 4 },
    'split-orchards': { walls: 8, terrain: 2 },
    'weaver-crossing': { walls: 8, terrain: 4 },
  };
  for (const id of IDS) {
    const before = map(previousProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, before.geometryIdentity);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.source.terrain.length, expected[id].terrain);
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert(current.geometry.safeComponents.length >= 4);
    assert.deepEqual(
      current.geometry.diagnostics.map(({ code }) => code),
      ['disconnected-foundations'],
    );
  }
});

test('all presets preserve actors and keep both opening spawns safe while idle', () => {
  for (const id of IDS)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const before = resolveMission(previousProject, id, { mode: 'team', difficulty });
      const current = resolveMission(project, id, { mode: 'team', difficulty });
      assert.deepEqual(current.level.rules, before.level.rules);
      assert.deepEqual(current.level.enemies, before.level.enemies);
      assert.deepEqual(current.level.goal, before.level.goal);
      assert.deepEqual(current.level.lineImpact, before.level.lineImpact);
      assert.deepEqual(current.level.supportRoles, ['interceptor', 'disruptor']);
      assert.notEqual(current.simulationIdentity, before.simulationIdentity);

      for (const seed of [1, 7, 19]) {
        const run = startCoop(createCoop(current.level, { seed, jointCuts: false }));
        const positions = run.players.map(({ x, y }) => [x, y]);
        for (let tick = 0; tick < 300; tick++) stepCoop(run, [command(), command()]);
        assert.equal(run.status, 'running');
        assert.equal(run.coverage, 0);
        assert.equal(
          run.events.some(({ type }) => type === 'player.downed'),
          false,
        );
        assert.deepEqual(
          run.players.map(({ x, y }) => [x, y]),
          positions,
        );
      }
    }
});
