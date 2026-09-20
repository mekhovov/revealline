import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editContentEncounter } from '../content-design/encounters.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectManualImageMap } from '../content-design/image-authoring.mjs';
import { createEncounterEditor } from '../studio/encounter-editor.mjs';
import { createActorEditor } from '../studio/actor-editor.mjs';
import { dataIdentity } from '../data-json.mjs';
import { sentinelProjectFixture } from './helpers/sentinel-project.mjs';

const mapFor = (p) =>
  p.maps.find(
    (map) => map.id === p.missions[0].map.id && map.revision === p.missions[0].map.revision,
  );
function source() {
  const project = createStarterProject();
  project.missions[0].objectives = sentinelProjectFixture().missions[0].objectives;
  return project;
}
const command = (p, action = 'set', overrides = {}) => ({
  action,
  expectedMap: dataIdentity(mapFor(p)),
  expectedMission: dataIdentity(p.missions[0]),
  ...(action === 'set'
    ? {
        enemyId: p.missions[0].actors[0].id,
        coreObjectiveId: 'core',
        shieldObjectiveIds: ['west', 'east'],
      }
    : {}),
  ...overrides,
});
const edit = (p, input = command(p)) => editContentEncounter(p, 'nearby-shore', input);

test('explicit boss opt-in is atomic, copy-on-write and undoable without changing shared missions', () => {
  const project = source();
  project.missions.push({ ...structuredClone(project.missions[0]), id: 'shared' });
  const before = structuredClone(project),
    history = createDraftHistory(project),
    next = edit(project);
  assert.deepEqual(project, before);
  assert.deepEqual(next.maps[0], before.maps[0]);
  assert.deepEqual(next.missions[1], before.missions[1]);
  assert.equal(next.missions[0].format, 'MissionDesignV4');
  assert.equal(mapFor(next).format, 'MapDesignV3');
  assert.equal(next.missions[0].actors[0].role, 'relay-sentinel');
  const compiled = compileContentProject(next);
  assert.equal(resolveMission(compiled, 'nearby-shore').level.version, 'xonix-level.v8');
  assert.deepEqual(
    resolveMission(compiled, 'shared').level,
    resolveMission(compileContentProject(before), 'shared').level,
  );
  history.replace(next);
  assert.deepEqual(history.undo(), before);
  assert.deepEqual(history.redo(), next);
});

test('replacement/removal preserve geometry and objectives; tracing keeps the encounter intact', () => {
  const project = edit(source());
  const replaced = edit(project, command(project, 'set', { shieldObjectiveIds: ['east'] }));
  assert.equal(replaced.maps.length, project.maps.length);
  assert.deepEqual(mapFor(replaced), mapFor(project));
  assert.deepEqual(replaced.missions[0].encounter.shieldObjectiveIds, ['east']);
  const removed = edit(replaced, command(replaced, 'remove'));
  assert.equal(removed.missions[0].format, 'MissionDesignV4');
  assert.equal(removed.missions[0].encounter, null);
  assert.equal(removed.missions[0].actors.length, 0);
  assert.deepEqual(removed.missions[0].objectives, project.missions[0].objectives);
  assert.deepEqual(removed.maps, project.maps);
  const traced = inspectManualImageMap(project, 'nearby-shore', [
    { surface: 'walls', x: 50, y: 22, w: 2, h: 2 },
  ]).candidate;
  assert.deepEqual(traced.missions[0].encounter, project.missions[0].encounter);
  assert.throws(() =>
    inspectManualImageMap(project, 'nearby-shore', [
      { surface: 'foundations', x: 54, y: 18, w: 1, h: 1 },
    ]),
  );
});

test('invalid and stale encounter commands reject without a partial actor, map or catalog change', () => {
  const project = source(),
    before = structuredClone(project);
  for (const patch of [
    { expectedMap: 'stale' },
    { expectedMission: 'stale' },
    { coreObjectiveId: 'west' },
    { shieldObjectiveIds: [] },
    { shieldObjectiveIds: ['west', 'west'] },
    { shieldObjectiveIds: ['missing'] },
    { enemyId: 'new-boss-leaving-other-field-seed' },
    { warningTicks: 1 },
    { speed: 99 },
    { action: 'unknown' },
  ])
    assert.throws(() => edit(project, command(project, 'set', patch)));
  assert.deepEqual(project, before);
  const team = createTeamOpeningCandidates();
  assert.throws(
    () =>
      editContentEncounter(team, team.missions[0].id, {
        action: 'set',
        expectedMap: '',
        expectedMission: '',
        enemyId: 'sentinel',
        coreObjectiveId: 'core',
        shieldObjectiveIds: ['shield'],
      }),
    /not qualified for Team/,
  );
  let calls = 0;
  const hostile = command(project);
  Object.defineProperty(hostile, 'shieldObjectiveIds', {
    enumerable: true,
    get() {
      calls++;
      return ['west'];
    },
  });
  assert.throws(() => edit(project, hostile));
  assert.equal(calls, 0);
});

function uiFixture() {
  const nodes = new Map();
  const element = () => {
    let value = '';
    return {
      get value() {
        return value;
      },
      set value(next) {
        value = String(next);
      },
      disabled: false,
      textContent: '',
      replaceChildren(...children) {
        this.children = children;
        this.value = children[0]?.value ?? '';
      },
    };
  };
  const document = {
    createElement: element,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
  };
  let project = source(),
    cancelled = false;
  const editor = createEncounterEditor({
    document,
    getSource: () => project,
    getMission: () => project.missions[0],
    apply(next) {
      if (cancelled) return false;
      project = next;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  return {
    document,
    editor,
    node: (id) => document.getElementById('sentinel-' + id),
    source: () => project,
    update(next, sync = true) {
      project = next;
      if (sync) editor.sync();
    },
    cancel() {
      cancelled = true;
    },
  };
}
function fill(f) {
  f.node('core').value = 'core';
  f.node('shield-0').value = 'west';
  f.node('shield-1').value = 'east';
}
const submit = (f) => f.node('form').onsubmit({ preventDefault() {} });

test('Studio applies all boss bindings together and re-arms destructive removal after edits', () => {
  const f = uiFixture();
  fill(f);
  submit(f);
  assert.equal(f.source().missions[0].format, 'MissionDesignV4');
  assert.equal(f.source().missions[0].encounter.shieldObjectiveIds.length, 2);
  assert(f.node('enemy').disabled);
  f.node('shield-1').value = 'west';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(f.source().missions[0].encounter.shieldObjectiveIds[1], 'east');
  f.node('shield-1').value = '';
  submit(f);
  assert.equal(f.source().missions[0].encounter.shieldObjectiveIds.length, 1);
  f.node('remove').onclick();
  f.node('form').oninput();
  f.node('remove').onclick();
  assert(f.source().missions[0].encounter);
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].encounter, null);
  assert.equal(f.source().missions[0].objectives.length, 3);
});

test('Studio rejects stale fields, honors cancelled adoption, and disables Team or missing selection', () => {
  const f = uiFixture();
  fill(f);
  f.source().missions[0].coverage = 0.9;
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(f.source().missions[0].format, 'MissionDesignV1');
  f.editor.sync();
  fill(f);
  f.cancel();
  submit(f);
  assert.equal(f.source().missions[0].format, 'MissionDesignV1');
  f.update(createTeamOpeningCandidates());
  assert(f.node('tools').disabled);
  f.update({ ...createStarterProject(), missions: [], campaigns: [], packs: [] });
  assert(f.node('tools').disabled);
});

test('generic actor panel can inspect Sentinel without treating its fixed cadence as speed', () => {
  const f = uiFixture();
  f.update(edit(source()));
  const editor = createActorEditor({
    document: f.document,
    getSource: f.source,
    getMission: () => f.source().missions[0],
    getDifficulty: () => 'standard',
    apply: (next) => f.update(next),
  });
  editor.sync();
  const node = (id) => f.document.getElementById('actor-' + id);
  node('select').value = f.source().missions[0].actors[0].id;
  node('select').onchange();
  assert.equal(node('role').value, 'relay-sentinel');
  assert.equal(node('tier').value, 'measured');
  assert.match(node('tier-label').textContent, /fixed cadence/);
  assert(node('clockwise-row').hidden);
  assert(node('heading-row').hidden);
  assert(node('axis-row').hidden);
  node('form').onsubmit({ preventDefault() {} });
  assert.doesNotMatch(node('result').textContent, /Not applied/);
});
