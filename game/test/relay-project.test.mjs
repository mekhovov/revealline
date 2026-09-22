import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { projectFixture } from './content-project.test.mjs';

function relayProject() {
  const project = projectFixture();
  project.maps[0].format = 'MapDesignV2';
  project.maps[0].gates = [{ id: 'shortcut', x: 40, y: 10, w: 2, h: 3 }];
  project.missions[0].format = 'MissionDesignV2';
  project.missions[0].objectives = [{ id: 'relay', x: 20.5, y: 10.5, required: true }];
  project.missions[0].relayLinks = [{ gateId: 'shortcut', objectiveId: 'relay' }];
  return project;
}

test('shared registry projects explicit relay editions equally to Solo and Versus in every preset', () => {
  const source = relayProject(),
    project = compileContentProject(source);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const solo = resolveMission(project, 'nearby-shore', { difficulty });
    const versus = resolveMission(project, 'nearby-shore', { difficulty, mode: 'versus' });
    assert.equal(solo.format, 'ResolvedMissionV2');
    assert.equal(solo.level.version, 'xonix-level.v6');
    assert.deepEqual(solo.level, versus.level);
    assert.equal(solo.simulationIdentity, versus.simulationIdentity);
    assert.deepEqual(solo.level.relayGates.gates, [
      { ...source.maps[0].gates[0], objectiveId: 'relay' },
    ]);
    assert(Object.isFrozen(solo.level.relayGates.gates[0]));
    assert.equal(solo.level.rules.moveSpeed, 10);
  }
  assert.throws(() => resolveMission(project, 'nearby-shore', { mode: 'team' }), /mode/);
});

test('relay links fail closed for dangling, duplicate, unsupported and mixed-edition authoring', () => {
  for (const modify of [
    (p) => {
      p.missions[0].format = 'MissionDesignV1';
    },
    (p) => {
      p.maps[0].format = 'MapDesignV1';
      delete p.maps[0].gates;
    },
    (p) => {
      delete p.missions[0].relayLinks;
    },
    (p) => {
      p.missions[0].relayLinks = [];
    },
    (p) => {
      p.missions[0].relayLinks[0].gateId = 'missing';
    },
    (p) => {
      p.missions[0].relayLinks[0].objectiveId = 'missing';
    },
    (p) => {
      p.missions[0].relayLinks[0].timer = 10;
    },
    (p) => {
      p.missions[0].modes.push('team');
      p.missions[0].team = {};
    },
    (p) => {
      p.maps[0].gates.push({ id: 'second', x: 50, y: 10, w: 2, h: 3 });
      p.missions[0].relayLinks.push({ ...p.missions[0].relayLinks[0] });
    },
  ]) {
    const source = relayProject();
    modify(source);
    assert.throws(() => compileContentProject(source));
  }
});

test('objective links change mission authority without altering shared map authority', () => {
  const source = relayProject();
  source.missions[0].objectives.push({ id: 'alternate', x: 22.5, y: 12.5, required: true });
  const before = compileContentProject(source);
  source.missions[0].relayLinks[0].objectiveId = 'alternate';
  const after = compileContentProject(source);
  assert.equal(before.maps[0].geometryIdentity, after.maps[0].geometryIdentity);
  assert.notEqual(
    resolveMission(before, 'nearby-shore').simulationIdentity,
    resolveMission(after, 'nearby-shore').simulationIdentity,
  );
  assert.equal(before.missions[0].relayLinks[0].objectiveId, 'relay');
});
