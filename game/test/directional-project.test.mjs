import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { editContentRelay } from '../content-design/relays.mjs';
import { dataIdentity } from '../data-json.mjs';

function source() {
  const project = createStarterProject();
  project.maps[0].format = 'MapDesignV3';
  project.maps[0].gates = [];
  project.maps[0].speedZones = [{ id: 'east-lane', x: 2, y: 2, w: 10, h: 4, direction: 'right' }];
  project.missions[0].format = 'MissionDesignV3';
  project.missions[0].relayLinks = [];
  return project;
}

test('shared project compilation resolves explicit directional maps identically for Solo and Versus', () => {
  const project = compileContentProject(source());
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const solo = resolveMission(project, 'nearby-shore', { difficulty });
    assert.equal(solo.format, 'ResolvedMissionV3');
    assert.equal(solo.level.version, 'xonix-level.v7');
    assert.equal(solo.level.rules.moveSpeed, 10);
    assert.deepEqual(solo.level.directionalFields.zones, project.maps[0].source.speedZones);
    assert.deepEqual(
      resolveMission(project, 'nearby-shore', { difficulty, mode: 'versus' }).level,
      solo.level,
    );
    assert.equal(solo.officialProgressEligible, false);
  }
  const changed = source();
  changed.maps[0].speedZones[0].direction = 'left';
  assert.notEqual(
    resolveMission(compileContentProject(changed), 'nearby-shore').simulationIdentity,
    resolveMission(project, 'nearby-shore').simulationIdentity,
  );
});

test('mission/map editions cannot silently mix or downgrade and Team stays fail-closed', () => {
  for (const format of ['MissionDesignV1', 'MissionDesignV2']) {
    const project = source();
    project.missions[0].format = format;
    if (format === 'MissionDesignV1') delete project.missions[0].relayLinks;
    assert.throws(() => compileContentProject(project), /editions/);
  }
  const oldMap = source();
  oldMap.maps[0].format = 'MapDesignV2';
  delete oldMap.maps[0].speedZones;
  assert.throws(() => compileContentProject(oldMap), /editions/);
  const team = source();
  team.missions[0].modes.push('team');
  team.missions[0].team = {};
  assert.throws(() => compileContentProject(team), /not qualified for Team/);
});

test('relay editing on a directional mission preserves fields and its V3 edition', () => {
  const project = source(),
    mission = project.missions[0];
  mission.objectives.push({ id: 'trigger', x: 20.5, y: 20.5, required: true });
  const result = editContentRelay(project, mission.id, {
    action: 'add',
    id: 'connector',
    expectedMap: dataIdentity(project.maps[0]),
    expectedMission: dataIdentity(mission),
    gate: { x: 50, y: 20, w: 2, h: 3, objectiveId: 'trigger' },
  });
  const current = result.missions[0],
    map = result.maps.find(
      (map) => map.id === current.map.id && map.revision === current.map.revision,
    );
  assert.equal(current.format, 'MissionDesignV3');
  assert.equal(map.format, 'MapDesignV3');
  assert.deepEqual(map.speedZones, project.maps[0].speedZones);
  assert.equal(map.gates.length, 1);
  assert.deepEqual(project.maps[0].gates, []);
});
