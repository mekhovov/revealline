import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createTeamRoamerCandidates } from '../content-design/team-roamer-candidates.mjs';
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
    /qualified actor roles/,
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

function editorFixture({ deferredSource = false } = {}) {
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
    cancelled = false,
    ready = !deferredSource;
  const editor = createActorEditor({
    document,
    getSource: () => {
      assert(ready, 'Studio has not adopted its draft session yet.');
      return source;
    },
    getMission: () => source.missions.find((mission) => mission.id === selected),
    getDifficulty: () => difficulty,
    apply: (next) => {
      if (cancelled) return false;
      source = next;
      editor.sync();
      return true;
    },
  });
  if (!deferredSource) editor.sync();
  return {
    editor,
    node: (id) => document.getElementById(`actor-${id}`),
    source: () => source,
    adopt: () => {
      ready = true;
      editor.sync();
    },
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
test('Studio reads the pinned difficulty catalog for effective movement and attack rests', () => {
  const f = editorFixture();
  const next = structuredClone(f.source());
  next.difficultyCatalogId = 'journey-difficulty-v2';
  next.actorCatalogId = 'journey-actors-v5';
  f.update(next);
  assert.match(f.node('tier').children[0].textContent, /3.36 cells\/s/);
  f.node('role').value = 'lane-emitter';
  f.node('role').onchange();
  assert.match(
    f.node('tier').children[0].textContent,
    /1.5s warning \/ 0.7s active \/ 5.4333s cycle/,
  );
  f.preset('expert');
  assert.match(f.node('tier').children[0].textContent, /4.2 cells\/s/);
  f.node('role').value = 'lane-emitter';
  f.node('role').onchange();
  assert.match(f.node('tier').children[0].textContent, /4.6667s cycle/);
});
test('Studio emitter controls use shared cadence and an explicit axis without motion overrides', () => {
  const f = editorFixture();
  assert(!f.node('role').children.some((row) => row.value === 'lane-emitter'));
  const next = structuredClone(f.source());
  next.actorCatalogId = 'journey-actors-v5';
  f.update(next);
  f.node('role').value = 'lane-emitter';
  f.node('role').onchange();
  assert.match(f.node('tier-label').textContent, /Cadence/);
  assert(f.node('tier').children.every((row) => /1.5s warning/.test(row.textContent)));
  assert.equal(f.node('axis-row').hidden, false);
  assert.equal(f.node('heading-row').hidden, true);
  assert.equal(f.node('clockwise-row').hidden, true);
  f.node('id').value = 'emitter';
  f.node('x').value = '45.5';
  f.node('y').value = '15.5';
  f.node('axis').value = 'vertical';
  submit(f);
  const actor = f.source().missions[0].actors.find((row) => row.id === 'emitter');
  assert.deepEqual(actor, {
    id: 'emitter',
    role: 'lane-emitter',
    tier: 'measured',
    x: 45.5,
    y: 15.5,
    axis: 'vertical',
  });
  assert.match(f.node('result').textContent, /Actor applied/);
  const labels = f.node('tier').children.map((row) => row.textContent);
  f.preset('expert');
  assert.deepEqual(
    f.node('tier').children.map((row) => row.textContent),
    labels,
  );
  assert.equal(f.node('axis').value, 'vertical');
  f.node('role').value = 'field-keeper';
  f.node('role').onchange();
  assert.equal(f.node('axis-row').hidden, true);
  assert.match(f.node('tier-label').textContent, /Speed/);
});
test('Studio may create actor controls before its asynchronous draft session is adopted', () => {
  const f = editorFixture({ deferredSource: true });
  assert.equal(f.node('tools').disabled, true);
  assert.equal(f.node('role').children, undefined);
  f.adopt();
  assert.equal(f.node('tools').disabled, false);
  assert.deepEqual(
    f.node('role').children.map((row) => row.value),
    ['field-keeper', 'perimeter-patrol', 'frontier-patrol'],
  );
  assert.equal(f.node('role').value, 'field-keeper');
});
test('Studio exposes roamer fields only for the exact v2 Solo catalogue and rejects stale upgrade fields', () => {
  const f = editorFixture();
  assert(!f.node('role').children.some((row) => row.value === 'reclaimed-roamer'));
  f.node('select').value = 'keeper';
  f.node('select').onchange();
  const next = structuredClone(f.source());
  next.actorCatalogId = 'journey-actors-v2';
  f.update(next, false);
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  f.editor.sync();
  assert(f.node('role').children.some((row) => row.value === 'reclaimed-roamer'));
  f.node('select').value = '';
  f.node('select').onchange();
  f.node('id').value = 'roamer';
  f.node('role').value = 'reclaimed-roamer';
  f.node('role').onchange();
  assert.equal(f.node('heading-row').hidden, false);
  assert.equal(f.node('clockwise-row').hidden, true);
  assert.match(f.node('position-help').textContent, /120 actor ticks/);
  f.node('x').value = '4.5';
  f.node('y').value = '10.5';
  f.node('heading').value = '1,0';
  submit(f);
  assert.match(f.node('result').textContent, /applied/);
  assert.deepEqual(f.source().missions[0].actors.at(-1).heading, [1, 0]);
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = 'journey-actors-v2';
  f.update(team);
  f.mission('twin-landings');
  assert.deepEqual(
    f.node('role').children.map((row) => row.value),
    ['field-keeper'],
  );
});

test('Team v3 actor picker and compiler share roamer qualification without upgrading earlier missions', () => {
  const source = createTeamRoamerCandidates(),
    before = structuredClone(source),
    f = editorFixture();
  f.update(source);
  f.mission('shared-lookout');
  assert.deepEqual(
    f.node('role').children.map((row) => row.value),
    ['field-keeper', 'reclaimed-roamer'],
  );
  f.node('select').value = 'roamer-1';
  f.node('select').onchange();
  assert.equal(f.node('role').value, 'reclaimed-roamer');
  assert.equal(f.node('tier').children[0].textContent, 'measured · 1.6 cells/s');
  assert.match(f.node('description').textContent, /Does not retain field regions/);
  assert.match(f.node('position-help').textContent, /120 actor ticks/);
  f.node('x').value = '28.5';
  submit(f);
  assert.match(f.node('result').textContent, /Actor applied/);
  assert.equal(f.source().missions[0].actors.find((actor) => actor.id === 'roamer-1').x, 28.5);
  assert.deepEqual(f.source().maps, before.maps);
  assert.deepEqual(source, before);
  for (const difficulty of ['gentle', 'standard', 'expert'])
    assert.equal(
      resolveMission(compileContentProject(f.source()), 'shared-lookout', {
        mode: 'team',
        difficulty,
      }).level.version,
      'revealline-coop-level.v4',
    );
  const accepted = f.source();
  f.node('role').value = 'perimeter-patrol';
  f.node('role').onchange();
  submit(f);
  assert.match(f.node('result').textContent, /Not applied.*qualified actor roles/);
  assert.deepEqual(f.source(), accepted);
  for (const format of ['TeamMissionV1', 'TeamMissionV2']) {
    const old = createTeamOpeningCandidates();
    old.actorCatalogId = 'journey-actors-v2';
    old.missions[0].team.format = format;
    f.update(old);
    f.mission('twin-landings');
    assert.deepEqual(
      f.node('role').children.map((row) => row.value),
      ['field-keeper'],
    );
  }
});

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

test('Studio exposes the eroder only in v3, with shared warning rules and validated heading fields', () => {
  const f = editorFixture();
  assert(!f.node('role').children.some((row) => row.value === 'territory-eroder'));
  const next = structuredClone(f.source());
  next.actorCatalogId = 'journey-actors-v3';
  f.update(next);
  assert(f.node('role').children.some((row) => row.value === 'territory-eroder'));
  f.node('id').value = 'eroder';
  f.node('role').value = 'territory-eroder';
  f.node('role').onchange();
  assert.equal(f.node('heading-row').hidden, false);
  assert.equal(f.node('clockwise-row').hidden, true);
  assert.match(f.node('position-help').textContent, /60 actor ticks/);
  assert.match(f.node('description').textContent, /Retains its field region/);
  f.node('x').value = '45.5';
  f.node('y').value = '15.5';
  f.node('heading').value = '-1,0';
  submit(f);
  assert.match(f.node('result').textContent, /applied/);
  assert.equal(f.source().missions[0].actors.at(-1).role, 'territory-eroder');
  f.node('x').value = '32.5';
  f.node('y').value = '17.5';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(f.source().missions[0].actors.at(-1).x, 45.5);
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = 'journey-actors-v3';
  f.update(team);
  f.mission('twin-landings');
  assert.deepEqual(
    f.node('role').children.map((row) => row.value),
    ['field-keeper'],
  );
});

test('Studio carrier controls are catalogue-gated and compile selected IDs without affecting keepers', () => {
  const f = editorFixture();
  assert(!f.node('role').children.some((row) => row.value === 'impact-carrier'));
  const next = structuredClone(f.source());
  next.actorCatalogId = 'journey-actors-v4';
  f.update(next);
  assert(f.node('role').children.some((row) => row.value === 'impact-carrier'));
  f.node('id').value = 'carrier';
  f.node('role').value = 'impact-carrier';
  f.node('role').onchange();
  assert.equal(f.node('heading-row').hidden, false);
  assert.equal(f.node('clockwise-row').hidden, true);
  assert.match(f.node('position-help').textContent, /24 cells\/s in every preset/);
  assert.match(f.node('description').textContent, /Ordinary field keepers/);
  f.node('x').value = '45.5';
  f.node('y').value = '15.5';
  f.node('heading').value = '-1,0';
  submit(f);
  assert.match(f.node('result').textContent, /applied/);
  assert.deepEqual(
    resolveMission(compileContentProject(f.source()), 'nearby-shore').level.classic.lineImpact
      .actorIds,
    ['carrier'],
  );
  const team = createTeamOpeningCandidates();
  team.actorCatalogId = 'journey-actors-v4';
  f.update(team);
  f.mission('twin-landings');
  assert.deepEqual(
    f.node('role').children.map((row) => row.value),
    ['field-keeper'],
  );
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
