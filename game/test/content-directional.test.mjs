import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editContentDirectional } from '../content-design/directional.mjs';
import { editContentRelay } from '../content-design/relays.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectManualImageMap } from '../content-design/image-authoring.mjs';
import { createDirectionalEditor } from '../studio/directional-editor.mjs';

const missionId = 'nearby-shore';
const mapFor = (p) =>
  p.maps.find(
    (map) => map.id === p.missions[0].map.id && map.revision === p.missions[0].map.revision,
  );
const command = (p, action, rest = {}) => ({
  action,
  expectedMap: dataIdentity(mapFor(p)),
  expectedMission: dataIdentity(p.missions[0]),
  ...rest,
});
const enable = (p = createStarterProject()) =>
  editContentDirectional(p, missionId, command(p, 'enable'));
const add = (p) =>
  editContentDirectional(
    p,
    missionId,
    command(p, 'add', { id: 'lane', zone: { x: 10, y: 2, w: 5, h: 8, direction: 'down' } }),
  );

test('directional opt-in forks one mission without changing shared historical maps and remains undoable', () => {
  const source = createStarterProject();
  source.missions.push({ ...structuredClone(source.missions[0]), id: 'shared' });
  const original = structuredClone(source),
    history = createDraftHistory(source),
    next = add(enable(source));
  assert.deepEqual(source, original);
  assert.deepEqual(next.maps[0], original.maps[0]);
  assert.deepEqual(next.missions[1], original.missions[1]);
  assert.equal(next.missions[0].format, 'MissionDesignV3');
  assert.equal(mapFor(next).format, 'MapDesignV3');
  const compiled = compileContentProject(next);
  assert.equal(resolveMission(compiled, missionId).level.version, 'xonix-level.v7');
  assert.equal(resolveMission(compiled, 'shared').level.version, 'xonix-level.v5');
  history.replace(next);
  assert.deepEqual(history.undo(), original);
  assert.deepEqual(history.redo(), next);
});

test('directional opt-in retains existing relay gates and links; removing a field never downgrades them', () => {
  let project = createStarterProject();
  project.missions[0].objectives = [{ id: 'trigger', x: 20.5, y: 10.5, required: true }];
  project = editContentRelay(project, missionId, command(project, 'enable'));
  project = editContentRelay(
    project,
    missionId,
    command(project, 'add', {
      id: 'connector',
      gate: { x: 40, y: 10, w: 2, h: 3, objectiveId: 'trigger' },
    }),
  );
  const next = add(enable(project));
  assert.deepEqual(mapFor(next).gates, mapFor(project).gates);
  assert.deepEqual(next.missions[0].relayLinks, project.missions[0].relayLinks);
  const removed = editContentDirectional(next, missionId, command(next, 'remove', { id: 'lane' }));
  assert.deepEqual(mapFor(removed).speedZones, []);
  assert.equal(removed.missions[0].format, 'MissionDesignV3');
  assert.deepEqual(mapFor(removed).gates, mapFor(project).gates);
});

test('invalid, stale and unqualified directional edits reject atomically', () => {
  const source = add(enable()),
    original = structuredClone(source);
  const valid = command(source, 'replace', {
    id: 'lane',
    zone: { x: 10, y: 2, w: 5, h: 8, direction: 'up' },
  });
  for (const change of [
    (c) => {
      c.expectedMap = 'stale';
    },
    (c) => {
      c.expectedMission = 'stale';
    },
    (c) => {
      c.zone.direction = 'diagonal';
    },
    (c) => {
      c.zone.x = 0;
    },
    (c) => {
      c.zone.speed = 2;
    },
    (c) => {
      c.action = 'add';
    },
  ]) {
    const input = structuredClone(valid);
    change(input);
    assert.throws(() => editContentDirectional(source, missionId, input));
  }
  assert.deepEqual(source, original);
  const next = editContentDirectional(source, missionId, valid);
  assert.equal(mapFor(next).speedZones[0].direction, 'up');
  assert.equal(mapFor(source).speedZones[0].direction, 'down');
  const team = createTeamOpeningCandidates(),
    mission = team.missions[0];
  assert.throws(
    () =>
      editContentDirectional(team, mission.id, {
        action: 'enable',
        expectedMap: '',
        expectedMission: '',
      }),
    /not qualified for Team/,
  );
});

test('manual image workflow retains directional fields and rejects trace-over-field geometry', () => {
  const source = add(enable()),
    before = structuredClone(source);
  const { candidate } = inspectManualImageMap(source, missionId, [
    { surface: 'walls', x: 50, y: 22, w: 2, h: 2 },
  ]);
  assert.deepEqual(mapFor(candidate).speedZones, mapFor(source).speedZones);
  assert.equal(candidate.missions[0].format, 'MissionDesignV3');
  for (const surface of ['walls', 'foundations', 'slow', 'lethal'])
    assert.throws(
      () => inspectManualImageMap(source, missionId, [{ surface, x: 10, y: 2, w: 1, h: 1 }]),
      /overlap/,
    );
  assert.deepEqual(source, before);
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
  let source = createStarterProject(),
    cancelled = false;
  const editor = createDirectionalEditor({
    document,
    getSource: () => source,
    getMission: () => source.missions[0],
    apply(next) {
      if (cancelled) return false;
      source = next;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  return {
    editor,
    node: (id) => document.getElementById(`directional-${id}`),
    source: () => source,
    update(next, sync = true) {
      source = next;
      if (sync) editor.sync();
    },
    cancel() {
      cancelled = true;
    },
  };
}
function fill(f) {
  f.node('id').value = 'lane';
  for (const [key, value] of Object.entries({ x: 10, y: 2, w: 5, h: 8, direction: 'down' }))
    f.node(key).value = value;
}
const submit = (f) => f.node('form').onsubmit({ preventDefault() {} });

test('directional controls enable explicitly, edit direction and require renewed two-action removal', () => {
  const f = uiFixture();
  assert(f.node('tools').disabled);
  f.node('enable').onclick();
  assert(!f.node('tools').disabled);
  assert(f.node('enable').disabled);
  fill(f);
  submit(f);
  assert.equal(mapFor(f.source()).speedZones.length, 1);
  f.node('direction').value = 'left';
  submit(f);
  assert.equal(mapFor(f.source()).speedZones[0].direction, 'left');
  f.node('x').value = '0';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(mapFor(f.source()).speedZones[0].x, 10);
  f.node('select').onchange();
  f.node('remove').onclick();
  f.node('form').oninput();
  f.node('remove').onclick();
  assert.equal(mapFor(f.source()).speedZones.length, 1);
  f.node('remove').onclick();
  assert.equal(mapFor(f.source()).speedZones.length, 0);
});

test('directional controls reject stale context, honor cancelled adoption and disable Team/empty selection', () => {
  const f = uiFixture();
  f.node('enable').onclick();
  fill(f);
  const changed = f.source();
  changed.missions[0].coverage = 0.9;
  f.update(changed, false);
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(mapFor(f.source()).speedZones.length, 0);
  f.editor.sync();
  fill(f);
  f.cancel();
  submit(f);
  assert.equal(mapFor(f.source()).speedZones.length, 0);
  f.update(createTeamOpeningCandidates());
  assert(f.node('enable').disabled);
  assert(f.node('tools').disabled);
  f.update({ ...createStarterProject(), missions: [], campaigns: [], packs: [] });
  assert(f.node('tools').disabled);
});
