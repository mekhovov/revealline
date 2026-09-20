import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editContentGeometry } from '../content-design/geometry-edit.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createGeometryEditor } from '../studio/geometry-editor.mjs';

const command = (source, extra = {}) => ({
  action: 'replace',
  surface: 'foundations',
  index: 0,
  expectedMap: dataIdentity(source.maps[0]),
  rectangle: { x: 30, y: 15, w: 6, h: 5 },
  ...extra,
});

test('replace and remove rectangles fork only the selected mission and preserve immutable history', () => {
  const source = createStarterProject();
  source.missions.push({ ...structuredClone(source.missions[0]), id: 'shared' });
  const original = structuredClone(source),
    history = createDraftHistory(source);
  const next = editContentGeometry(source, 'nearby-shore', command(source));
  assert.deepEqual(source, original);
  assert.deepEqual(next.maps[0], original.maps[0]);
  assert.deepEqual(next.missions[1], original.missions[1]);
  const selectedMap = next.maps.find(
    (map) => map.id === next.missions[0].map.id && map.revision === next.missions[0].map.revision,
  );
  assert.equal(selectedMap.foundations[0].w, 6);
  history.replace(next);
  assert.deepEqual(history.undo(), original);
  assert.deepEqual(history.redo(), next);
  const remove = {
    action: 'remove',
    surface: 'foundations',
    index: 0,
    expectedMap: dataIdentity(selectedMap),
  };
  const removed = editContentGeometry(next, 'nearby-shore', remove);
  const preview = resolveMission(compileContentProject(removed), 'nearby-shore');
  assert.deepEqual(preview.level.foundations, []);
  assert.deepEqual(removed.maps[0], original.maps[0]);
});

test('terrain replacement preserves its ID and changes material through the same map compiler', () => {
  const source = createStarterProject();
  source.maps[0].terrain = [{ id: 'patch', kind: 'slow', x: 10, y: 10, w: 4, h: 3 }];
  const next = editContentGeometry(
    source,
    'nearby-shore',
    command(source, {
      surface: 'terrain',
      rectangle: { kind: 'lethal', x: 12, y: 10, w: 4, h: 3 },
    }),
  );
  assert.deepEqual(next.maps.at(-1).terrain, [
    { id: 'patch', kind: 'lethal', x: 12, y: 10, w: 4, h: 3 },
  ]);
  assert.equal(source.maps[0].terrain[0].kind, 'slow');
});

test('stale map pins, wrong indexes, malformed geometry and invalidated spawns fail atomically', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  for (const extra of [
    { expectedMap: 'stale' },
    { index: -1 },
    { index: 1 },
    { index: 0.5 },
    { surface: 'spawns' },
    { rectangle: { x: 0, y: 0, w: 2, h: 2 } },
    { rectangle: { x: 59, y: 17, w: 4, h: 4 } },
    { rectangle: { x: 1, y: 1, w: 2, h: 2, kind: 'lethal' } },
    { published: true },
  ]) {
    assert.throws(() => editContentGeometry(source, 'nearby-shore', command(source, extra)));
    assert.deepEqual(source, before);
  }
  const once = editContentGeometry(source, 'nearby-shore', command(source));
  assert.throws(() => editContentGeometry(once, 'nearby-shore', command(source)), /map changed/);
  const team = createTeamOpeningCandidates(),
    original = structuredClone(team);
  assert.throws(
    () =>
      editContentGeometry(team, 'twin-landings', {
        action: 'remove',
        surface: 'foundations',
        index: 0,
        expectedMap: dataIdentity(team.maps[0]),
      }),
    /permanent reclaimed ground/,
  );
  assert.deepEqual(team, original);
});

function fixture() {
  const nodes = new Map();
  function element() {
    let value = '';
    return {
      get value() {
        return value;
      },
      set value(next) {
        value = String(next);
      },
      disabled: false,
      hidden: false,
      textContent: '',
      replaceChildren(...children) {
        this.children = children;
        this.value = children[0]?.value ?? '';
      },
    };
  }
  const document = {
    createElement: element,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
  };
  let source = createStarterProject(),
    cancelled = false;
  const editor = createGeometryEditor({
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
    node: (id) => document.getElementById(`geometry-edit-${id}`),
    source: () => source,
    cancel() {
      cancelled = true;
    },
    update(next, sync = true) {
      source = next;
      if (sync) editor.sync();
    },
  };
}
const submit = (f) => f.node('form').onsubmit({ preventDefault() {} });

test('geometry controls preserve failures, cancel armed removal on edits and require two activations', () => {
  const f = fixture();
  f.node('w').value = '6';
  submit(f);
  assert.equal(f.source().maps.at(-1).foundations[0].w, 6);
  f.node('x').value = '0';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(f.source().maps.at(-1).foundations[0].x, 30);
  f.node('select').onchange();
  f.node('remove').onclick();
  f.node('form').oninput();
  f.node('remove').onclick();
  assert.equal(f.source().maps.at(-1).foundations.length, 1);
  f.node('remove').onclick();
  assert.equal(f.source().maps.at(-1).foundations.length, 0);
  assert.equal(f.node('submit').disabled, true);
  assert.equal(f.node('remove').disabled, true);
});

test('stale UI edits cannot target another map revision; rejected adoption and empty missions stay safe', () => {
  const f = fixture();
  const next = editContentGeometry(f.source(), 'nearby-shore', command(f.source()));
  f.update(next, false); // Delayed host redraw must not retarget the old index.
  f.node('w').value = '8';
  submit(f);
  assert.match(f.node('result').textContent, /map or mission changed/);
  assert.equal(f.source().maps.at(-1).foundations[0].w, 6);
  f.editor.sync();
  f.cancel();
  f.node('w').value = '8';
  submit(f);
  assert.equal(f.source().maps.at(-1).foundations[0].w, 6);
  f.update({ ...f.source(), missions: [] });
  assert.equal(f.node('tools').disabled, true);
  assert.equal(f.node('select').children.length, 0);
  assert.equal(f.node('x').value, '');
});
