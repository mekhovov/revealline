import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createActorEditor } from '../studio/actor-editor.mjs';

const patrol = {
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'standard',
  x: 60.5,
  y: 0.5,
  clockwise: true,
};

test('actor CRUD is immutable, preserves maps and shared tiers, and round trips through undo', () => {
  const source = createStarterProject(),
    original = structuredClone(source);
  const history = createDraftHistory(source);
  const added = editContentActor(source, 'nearby-shore', {
    action: 'add',
    id: patrol.id,
    actor: patrol,
  });
  assert.deepEqual(source, original);
  assert.deepEqual(added.maps, original.maps);
  assert.notEqual(added.missions[0].revision, original.missions[0].revision);
  for (const [difficulty, speed] of [
    ['gentle', 2.04],
    ['standard', 2.4],
    ['expert', 2.64],
  ])
    for (const mode of ['solo', 'versus']) {
      const level = resolveMission(compileContentProject(added), 'nearby-shore', {
        difficulty,
        mode,
      }).level;
      assert(Math.abs(level.enemies.find((actor) => actor.id === 'outer').speed - speed) < 1e-10);
      assert.equal(level.rules.moveSpeed, 10);
    }
  const replaced = editContentActor(added, 'nearby-shore', {
    action: 'replace',
    id: 'outer',
    actor: { ...patrol, clockwise: false },
  });
  assert.equal(replaced.missions[0].actors[1].clockwise, false);
  const removed = editContentActor(replaced, 'nearby-shore', { action: 'remove', id: 'outer' });
  assert.deepEqual(removed.missions[0].actors, source.missions[0].actors);
  history.replace(added);
  assert.deepEqual(history.undo(), original);
  assert.deepEqual(history.redo(), added);
});

test('invalid identity, extra fields, arbitrary speeds and illegal placement cannot partially edit', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  for (const command of [
    { action: 'add', id: 'keeper', actor: { ...patrol, id: 'keeper' } },
    { action: 'replace', id: 'missing', actor: { ...patrol, id: 'missing' } },
    { action: 'remove', id: 'missing' },
    { action: 'remove', id: 'keeper', actor: patrol },
    { action: 'add', id: 'different', actor: patrol },
    ...[{ speed: 99 }, { tier: 'turbo' }, { role: '__proto__' }, { x: 40.5, y: 10.5 }].map(
      (bad) => ({ action: 'add', id: 'outer', actor: { ...patrol, ...bad } }),
    ),
    {
      action: 'add',
      id: 'frontier',
      actor: {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 10, y: 10, side: 'east' },
        clockwise: true,
      },
    },
  ]) {
    assert.throws(() => editContentActor(source, 'nearby-shore', command));
    assert.deepEqual(source, before);
  }
  assert.throws(() =>
    editContentActor(source, 'missing', { action: 'add', id: 'outer', actor: patrol }),
  );
});

test('Team actor commands use the same compiler and do not change seats or lives', () => {
  const source = createTeamOpeningCandidates();
  assert.throws(
    () =>
      editContentActor(source, 'twin-landings', {
        action: 'add',
        id: 'outer',
        actor: patrol,
      }),
    /currently support field keepers/,
  );
  const next = editContentActor(source, 'twin-landings', {
    action: 'add',
    id: 'extra',
    actor: {
      id: 'extra',
      role: 'field-keeper',
      tier: 'measured',
      x: 60.5,
      y: 12.5,
      heading: [1, 0],
    },
  });
  assert.deepEqual(next.maps, source.maps);
  assert.deepEqual(next.missions[0].team, source.missions[0].team);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const before = resolveMission(compileContentProject(source), 'twin-landings', {
      mode: 'team',
      difficulty,
    });
    const after = resolveMission(compileContentProject(next), 'twin-landings', {
      mode: 'team',
      difficulty,
    });
    assert.deepEqual(after.level.rules, before.level.rules);
    assert.notEqual(after.simulationIdentity, before.simulationIdentity);
  }
});

function editorFixture() {
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
      textContent: '',
      disabled: false,
      hidden: false,
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
    selected = 'nearby-shore',
    difficulty = 'standard',
    cancelled = false;
  const editor = createActorEditor({
    document,
    getSource: () => source,
    getMission: () => source.missions.find((mission) => mission.id === selected),
    getDifficulty: () => difficulty,
    apply: (next) => {
      if (cancelled) return false;
      source = next;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  return {
    editor,
    node: (id) => document.getElementById(`actor-${id}`),
    source: () => source,
    preset: (next) => {
      difficulty = next;
      editor.sync();
    },
    mission: (next) => {
      selected = next;
      editor.sync();
    },
    cancel: () => {
      cancelled = true;
    },
    update: (next, sync = true) => {
      source = next;
      if (sync) editor.sync();
    },
  };
}
const submit = (f) => f.node('form').onsubmit({ preventDefault() {} });
test('a same-revision map replacement rejects stale actor coordinates', () => {
  const f = editorFixture();
  f.node('select').value = 'keeper';
  f.node('select').onchange();
  const next = structuredClone(f.source());
  next.maps[0].foundations[0].w = 6;
  f.update(next, false);
  f.node('x').value = '50.5';
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(f.source().missions[0].actors[0].x, 60.5);
});

test('actor controls add, replace and confirm removal; invalid fields retain the applied draft', () => {
  const f = editorFixture();
  f.node('id').value = 'outer';
  f.node('role').value = 'perimeter-patrol';
  f.node('role').onchange();
  f.node('tier').value = 'standard';
  f.node('x').value = '60.5';
  f.node('y').value = '0.5';
  submit(f);
  assert.equal(f.source().missions[0].actors.length, 2);
  assert.equal(f.node('select').value, 'outer');
  assert.equal(f.node('id').disabled, true);
  assert.match(f.node('result').textContent, /applied/);
  f.node('x').value = '40.5';
  f.node('y').value = '10.5';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(f.source().missions[0].actors[1].x, 60.5);
  f.node('select').onchange();
  f.node('clockwise').checked = false;
  submit(f);
  assert.equal(f.source().missions[0].actors[1].clockwise, false);
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].actors.length, 2);
  f.node('form').oninput(); // Editing cancels an armed removal.
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].actors.length, 2);
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].actors.length, 1);
  assert.equal(f.node('select').value, '');
});

test('stale actor fields cannot apply after a project or same-revision source replacement', () => {
  const f = editorFixture();
  f.node('select').value = 'keeper';
  f.node('select').onchange();
  const next = structuredClone(f.source());
  next.missions[0].actors[0].x = 55.5;
  f.update(next, false);
  f.node('x').value = '50.5';
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(f.source().missions[0].actors[0].x, 55.5);
  f.editor.sync();
  assert.equal(f.node('x').value, '55.5');
  f.node('remove').onclick();
  f.update({ ...f.source(), id: 'different-project' });
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].actors.length, 1, 'New context disarms removal.');
});

test('role controls explain domains, refresh preset tiers, clear absent missions and honor rejected adoption', () => {
  const f = editorFixture();
  f.node('select').value = 'keeper';
  f.node('select').onchange();
  assert.equal(f.node('heading-row').hidden, false);
  assert.equal(f.node('edge-row').hidden, true);
  f.node('role').value = 'frontier-patrol';
  f.node('role').onchange();
  assert.equal(f.node('heading-row').hidden, true);
  assert.equal(f.node('edge-row').hidden, false);
  assert.match(f.node('description').textContent, /Does not retain/);
  f.preset('gentle');
  assert.equal(f.node('role').value, 'field-keeper');
  assert.match(f.node('tier').children[0].textContent, /2.04 cells/);
  f.node('x').value = '55.5';
  f.cancel();
  submit(f);
  assert.equal(f.source().missions[0].actors[0].x, 60.5);
  f.mission('missing');
  assert.equal(f.node('tools').disabled, true);
  assert.equal(f.node('id').value, '');
});
