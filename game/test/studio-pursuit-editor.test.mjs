import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePursuitWaypoints,
  selectedMissionPursuitSource,
  createPursuitEditor,
} from '../studio/pursuit-editor.mjs';
import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('route text accepts cell centres and rejects incomplete, executable or non-finite entries', () => {
  assert.deepEqual(parsePursuitWaypoints('12.5, 8.5\n20.5, 8.5'), [
    { x: 12.5, y: 8.5 },
    { x: 20.5, y: 8.5 },
  ]);
  assert.deepEqual(parsePursuitWaypoints(''), []);
  for (const value of [
    '12.5',
    '12.5,',
    ',8.5',
    '12, 8, 9',
    'Infinity, 3',
    'window.alert(1), 4',
    '1'.repeat(2049),
  ])
    assert.throws(() => parsePursuitWaypoints(value));
});

test('Studio pursuit applies through the runtime compiler and preserves unrelated mission source', () => {
  for (const team of [false, true]) {
    const source = createPursuitPilotCandidates({ team });
    const before = JSON.stringify(source);
    const mission = source.missions[0];
    const next = selectedMissionPursuitSource(source, mission.id, mission.pursuit.actors);
    assert.equal(JSON.stringify(source), before);
    assert.equal(next.missions[0].format, 'MissionDesignV5');
    assert.deepEqual(next.missions[0].pursuit.actors, mission.pursuit.actors);
    assert.notEqual(next.missions[0].revision, mission.revision);
    assert.deepEqual(next.missions.slice(1), source.missions.slice(1));
    assert.deepEqual(compileContentProject(JSON.parse(JSON.stringify(next))).source, next);
  }
});

test('Studio requires a compiler-admitted non-empty population and cannot apply a broken reciprocal pair', () => {
  const source = createPursuitPilotCandidates({ team: true });
  const mission = source.missions.find((entry) => entry.id === 'relay-rendezvous');
  assert.throws(() => selectedMissionPursuitSource(source, mission.id, []));
  assert.throws(() => selectedMissionPursuitSource(source, 'missing', mission.pursuit.actors));
  const population = structuredClone(mission.pursuit.actors);
  population[0].partnerId = 'missing-partner';
  assert.throws(() => selectedMissionPursuitSource(source, mission.id, population));
});

test('pursuit editor creation does not read an unadopted Studio draft', () => {
  const document = new Document();
  const container = document.createElement('div');
  const editor = createPursuitEditor({
    container,
    getSource() {
      throw Error('not adopted');
    },
    getMission() {
      throw Error('not adopted');
    },
    apply() {},
  });
  const previous = getLocale();
  try {
    setLocale(previous === 'en' ? 'uk' : 'en', { persist: false });
  } finally {
    editor.dispose();
    setLocale(previous, { persist: false });
  }
});
