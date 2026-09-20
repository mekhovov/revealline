import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { BONUS_CHOICES, editContentBonus } from '../content-design/bonuses.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createBonusEditor } from '../studio/bonus-editor.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';

const bonus = { id: 'detour', kind: 'extra-life', x: 20.5, y: 0.5 };
test('map previews show every contact effect with a distinct framed glyph even without capture overlay', () => {
  let source = createStarterProject();
  for (const [i, [kind]] of BONUS_CHOICES.entries())
    source = editContentBonus(source, 'nearby-shore', {
      action: 'add',
      id: kind,
      bonus: { id: kind, kind, x: 20.5 + i * 2, y: 0.5 },
    });
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(target, property) {
        return target[property] ?? ((...args) => calls.push([property, ...args]));
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
  paintContentMap(ctx, prepareContentPreview(source, 'nearby-shore'), { showCapture: false });
  assert.deepEqual(
    calls.filter(([name]) => name === 'fillText').map(([, glyph]) => glyph),
    ['+', '>', 'v', '*'],
  );
  assert.equal(calls.filter(([name]) => name === 'strokeRect').length, 4);
});
test('all four contact effects compile for every preset and paired mode without changing physics', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  for (const [kind] of BONUS_CHOICES) {
    const next = editContentBonus(source, 'nearby-shore', {
      action: 'add',
      id: 'detour',
      bonus: { ...bonus, kind },
    });
    assert.deepEqual(next.maps, source.maps);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const old = resolveMission(compileContentProject(source), 'nearby-shore', {
          difficulty,
          mode,
        });
        const after = resolveMission(compileContentProject(next), 'nearby-shore', {
          difficulty,
          mode,
        });
        assert.deepEqual(after.level.rules, old.level.rules);
        assert.deepEqual(after.level.classic.powerups, [{ ...bonus, kind }]);
      }
  }
  assert.deepEqual(source, before);
});
test('bonus replacement/removal preserve maps and undo; invalid or privileged edits fail atomically', () => {
  const source = createStarterProject(),
    history = createDraftHistory(source);
  const next = editContentBonus(source, 'nearby-shore', { action: 'add', id: 'detour', bonus });
  history.replace(next);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), next);
  const replaced = editContentBonus(next, 'nearby-shore', {
    action: 'replace',
    id: 'detour',
    bonus: { ...bonus, kind: 'enemy-freeze' },
  });
  assert.equal(replaced.missions[0].bonuses[0].kind, 'enemy-freeze');
  assert.deepEqual(
    editContentBonus(replaced, 'nearby-shore', { action: 'remove', id: 'detour' }).missions[0]
      .bonuses,
    [],
  );
  for (const bad of [
    { x: 20 },
    { kind: 'shield' },
    { duration: 999 },
    { x: -0.5 },
    { id: 'keeper' },
  ]) {
    assert.throws(() =>
      editContentBonus(source, 'nearby-shore', {
        action: 'add',
        id: bad.id ?? 'detour',
        bonus: { ...bonus, ...bad },
      }),
    );
  }
  assert.throws(() =>
    editContentBonus(next, 'nearby-shore', { action: 'add', id: 'detour', bonus }),
  );
  assert.throws(
    () =>
      editContentBonus(next, 'nearby-shore', {
        action: 'add',
        id: 'other',
        bonus: { ...bonus, id: 'other' },
      }),
    /blocked or duplicated/,
  );
  assert.throws(
    () =>
      editContentBonus(createTeamOpeningCandidates(), 'twin-landings', {
        action: 'add',
        id: 'detour',
        bonus,
      }),
    /not yet qualified/,
  );
  assert.equal(next.missions[0].bonuses[0].kind, 'extra-life');
});
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
  const editor = createBonusEditor({
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
    node: (id) => document.getElementById(`bonus-${id}`),
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
test('bonus UI validates add/update and requires a fresh two-action removal', () => {
  const f = fixture();
  f.node('id').value = 'detour';
  f.node('x').value = '20.5';
  f.node('y').value = '0.5';
  submit(f);
  assert.equal(f.source().missions[0].bonuses.length, 1);
  assert.equal(f.node('id').disabled, true);
  f.node('x').value = '20';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(f.source().missions[0].bonuses[0].x, 20.5);
  f.node('select').onchange();
  f.node('kind').value = 'enemy-slow';
  submit(f);
  assert.equal(f.source().missions[0].bonuses[0].kind, 'enemy-slow');
  f.node('remove').onclick();
  f.node('form').oninput();
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].bonuses.length, 1);
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].bonuses.length, 0);
});
test('bonus controls reject stale adoption, honor cancellation and disable unqualified Team/empty contexts', () => {
  const f = fixture();
  f.node('id').value = 'detour';
  f.node('x').value = '20.5';
  f.node('y').value = '0.5';
  f.update({ ...f.source(), id: 'other-project' }, false);
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(f.source().missions[0].bonuses.length, 0);
  f.editor.sync();
  f.node('id').value = 'detour';
  f.node('x').value = '20.5';
  f.node('y').value = '0.5';
  f.cancel();
  submit(f);
  assert.equal(f.source().missions[0].bonuses.length, 0);
  f.update(createTeamOpeningCandidates());
  assert.equal(f.node('tools').disabled, true);
  assert.match(f.node('qualification').textContent, /not yet qualified/);
  f.update({ ...f.source(), missions: [] });
  assert.equal(f.node('tools').disabled, true);
  assert.equal(f.node('id').value, '');
});
