import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editContentObjective } from '../content-design/objectives.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createObjectiveEditor } from '../studio/objective-editor.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
function fixture() {
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
    cancel = false;
  const editor = createObjectiveEditor({
    document,
    getSource: () => source,
    getMission: () => source.missions[0],
    apply(next) {
      if (cancel) return false;
      source = next;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  return {
    editor,
    node: (id) => document.getElementById(`objective-${id}`),
    source: () => source,
    cancel() {
      cancel = true;
    },
    update(next, sync = true) {
      source = next;
      if (sync) editor.sync();
    },
  };
}
const submit = (f) => f.node('form').onsubmit({ preventDefault() {} });
test('objective UI validates add/update and requires a fresh two-action removal', () => {
  const f = fixture();
  f.node('id').value = 'detour';
  f.node('x').value = '20.5';
  f.node('y').value = '10.5';
  submit(f);
  assert.equal(f.source().missions[0].objectives.length, 1);
  assert.equal(f.node('id').disabled, true);
  f.node('x').value = '20';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(f.source().missions[0].objectives[0].x, 20.5);
  f.node('select').onchange();
  f.node('required').checked = true;
  f.node('hidden').checked = true;
  submit(f);
  assert.equal(f.source().missions[0].objectives[0].required, true);
  assert.equal(f.source().missions[0].objectives[0].hidden, true);
  f.node('remove').onclick();
  f.node('form').oninput();
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].objectives.length, 1);
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].objectives.length, 0);
});
test('objective controls reject stale adoption, honor cancellation and disable unqualified Team/empty contexts', () => {
  const f = fixture();
  f.node('id').value = 'detour';
  f.node('x').value = '20.5';
  f.node('y').value = '10.5';
  f.update({ ...f.source(), id: 'other-project' }, false);
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(f.source().missions[0].objectives.length, 0);
  f.editor.sync();
  f.node('id').value = 'detour';
  f.node('x').value = '20.5';
  f.node('y').value = '10.5';
  f.cancel();
  submit(f);
  assert.equal(f.source().missions[0].objectives.length, 0);
  f.update(createTeamOpeningCandidates());
  assert.equal(f.node('tools').disabled, true);
  assert.match(f.node('qualification').textContent, /not yet qualified/);
  f.update({ ...f.source(), missions: [] });
  assert.equal(f.node('tools').disabled, true);
  assert.equal(f.node('id').value, '');
});

const objective = { id: 'capture-east', x: 50.5, y: 10.5, required: true, hidden: false };
test('same-revision map and policy replacement invalidate unsaved objective fields', () => {
  for (const change of [
    (source) => {
      source.maps[0].foundations[0].w = 6;
    },
    (source) => {
      source.policyId = 'journey-v1';
    },
  ]) {
    const f = fixture();
    f.node('id').value = 'stale';
    f.node('x').value = '20.5';
    f.node('y').value = '10.5';
    const next = structuredClone(f.source());
    change(next);
    f.update(next, false);
    submit(f);
    assert.match(f.node('result').textContent, /context changed/);
    assert.equal(f.source().missions[0].objectives.length, 0);
  }
});
const add = (source, patch = {}) =>
  editContentObjective(source, 'nearby-shore', {
    action: 'add',
    id: patch.id ?? objective.id,
    objective: { ...objective, ...patch },
  });
test('objective CRUD is immutable, undoable and shared across all qualified presets and modes', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  const next = add(source),
    history = createDraftHistory(source);
  history.replace(next);
  assert.deepEqual(history.undo(), before);
  assert.deepEqual(history.redo(), next);
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const mode of ['solo', 'versus'])
      assert.deepEqual(
        resolveMission(compileContentProject(next), 'nearby-shore', { difficulty, mode }).level
          .objectives,
        [objective],
      );
  const replaced = editContentObjective(next, 'nearby-shore', {
    action: 'replace',
    id: objective.id,
    objective: { ...objective, required: false, hidden: true },
  });
  assert.equal(replaced.missions[0].objectives[0].hidden, true);
  const removed = editContentObjective(replaced, 'nearby-shore', {
    action: 'remove',
    id: objective.id,
  });
  assert.deepEqual(removed.missions[0].objectives, []);
  assert.deepEqual(removed.maps, before.maps);
  assert.deepEqual(source, before);
});
test('invalid objective positions, identities, effect injection and unsupported Team edits fail atomically', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  for (const patch of [
    { x: 0.5 },
    { x: 32.5, y: 16.5 },
    { x: 20 },
    { x: -0.5 },
    { required: 'yes' },
    { hidden: null },
    { id: 'keeper' },
    { gateId: 'secret' },
  ])
    assert.throws(() => add(source, patch));
  const next = add(source);
  assert.throws(() => add(next), /already exists/);
  assert.throws(() => add(next, { id: 'duplicate-cell' }), /occupies/);
  assert.throws(
    () => editContentObjective(source, 'nearby-shore', { action: 'remove', id: 'absent' }),
    /existing/,
  );
  assert.throws(
    () =>
      editContentObjective(createTeamOpeningCandidates(), 'twin-landings', {
        action: 'add',
        id: objective.id,
        objective,
      }),
    /not yet qualified/,
  );
  assert.deepEqual(source, before);
});
test('required capture markers genuinely gate completion in addition to quota', () => {
  for (const required of [false, true]) {
    const source = editContentObjective(createOpeningCandidates(), 'first-return', {
      action: 'add',
      id: objective.id,
      objective: { ...objective, required },
    });
    const manifest = resolveMission(compileContentProject(source), 'first-return');
    const run = createRun(manifest.level, { seed: 1, classId: 'scout' });
    for (let tick = 0; tick < 414; tick++) stepRun(run, { direction: 'down' }, FIXED_DT);
    assert(run.coverage >= manifest.level.goal.coverage);
    assert.equal(run.objectives[0].captured, false);
    assert.equal(run.status, required ? 'running' : 'won');
  }
});
test('Studio visibly distinguishes required, optional and hidden markers even without capture overlays', () => {
  let source = createStarterProject();
  for (const [i, flags] of [{ required: true }, { required: false }, { hidden: true }].entries())
    source = add(source, { id: `marker-${i}`, x: 40.5 + i * 2, ...flags });
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  paintContentMap(ctx, prepareContentPreview(source, 'nearby-shore'), { showCapture: false });
  assert.deepEqual(
    calls.filter(([name]) => name === 'fillText').map(([, text]) => text),
    ['!', 'o', '?'],
  );
});
