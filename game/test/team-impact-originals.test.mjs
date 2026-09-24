import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { TEAM_LIBRARY_JOURNEY_EDITION } from '../mission-library/team-source.mjs';

const historical = createTeamSpatialOriginalCandidates();
const source = createTeamImpactOriginalCandidates();
const project = compileContentProject(source);

test('Team impact successor preserves all twelve maps, pictures, actors and objectives', () => {
  assert.equal(source.missions.length, 12);
  assert.deepEqual(source.maps, historical.maps);
  assert.deepEqual(source.assets, historical.assets);
  assert.deepEqual(
    source.missions.map(
      ({ revision: _revision, team: _team, design: _design, ...mission }) => mission,
    ),
    historical.missions.map(
      ({ revision: _revision, team: _team, design: _design, ...mission }) => mission,
    ),
  );
  for (let index = 0; index < source.missions.length; index++) {
    const successor = source.missions[index];
    const previous = historical.missions[index];
    assert.equal(successor.team.format, 'TeamMissionV5');
    assert.deepEqual(successor.team.spawnIds, previous.team.spawnIds);
    assert.deepEqual(successor.actors, previous.actors);
    assert.deepEqual(successor.objectives, previous.objectives);
  }
});

test('all36 Team successor manifests own the v2 line-impact policy and isolated identities', () => {
  const previous = compileContentProject(historical);
  let resolved = 0;
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const options = { mode: 'team', difficulty };
      const manifest = resolveMission(project, mission.id, options);
      const old = resolveMission(previous, mission.id, options);
      assert.equal(manifest.policyId, 'journey-trail-impact-v3');
      assert.equal(manifest.level.version, 'revealline-coop-level.v6');
      assert.deepEqual(manifest.level.lineImpact, {
        version: 'team-line-impact.v2',
        speed: 24,
      });
      assert.notEqual(manifest.simulationIdentity, old.simulationIdentity);
      assert.equal(Object.hasOwn(old.level, 'lineImpact'), false);
      resolved++;
    }
  assert.equal(resolved, 36);
});

test('current Team entry and unified-library launch use the successor while historical route stays intact', () => {
  assert.equal(DEFAULT_JOURNEY_ROUTES.team, 'team-trail-impact-originals-1');
  assert.equal(TEAM_LIBRARY_JOURNEY_EDITION, 'team-trail-impact-originals-1');
  const current = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const old = createCandidateTeamHost(historical, {
    corePackIds: historical.packs.map((pack) => pack.id),
  });
  assert.equal(current.catalog.missions.length, 12);
  assert.equal(old.catalog.missions.length, 12);
  assert.notEqual(
    current.row(current.catalog.missions[0], 'standard').executionKey,
    old.row(old.catalog.missions[0], 'standard').executionKey,
  );
});

test('safe exposure precedes the explicit lesson and the first three spatial missions stay unchanged', () => {
  assert.equal(source.missions[1].id, historical.missions[1].id);
  assert(source.missions[1].design.introduces.includes('travelling-trail-impact'));
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(source.missions[index].map, historical.missions[index].map);
    assert.deepEqual(source.missions[index].objectives, historical.missions[index].objectives);
  }
  for (const mission of source.missions.slice(2))
    assert(
      [...mission.design.introduces, ...mission.design.practices].includes(
        'travelling-trail-impact',
      ),
      mission.id,
    );
});
