import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountActorEditor } from '../../optional-practice/civilian-fpv/world-actor-editor.mjs';
import { validateWorldCourse } from '../../optional-practice/civilian-fpv/world-model.mjs';
import { EXPRESSIVE_HUNT_COURSES } from '../../optional-practice/civilian-fpv/expressive-hunt-courses.mjs';

const modes = ['self-level', 'acro'];
const settled = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};
const criterion = (ids) => ({
  type: 'hunt-contact-v1',
  targets: ids,
  ordered: false,
  tail: { linksPerCatch: 0, maxLinks: 0, neckDistance: 5000, radius: 250 },
});
function fixture(t, { hunt = false, locale = 'en', change = () => {} } = {}) {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  // The browser owns numeric parsing. Keep that DOM boundary in this fixture;
  // objective admission is always the production validator below.
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'input')
      Object.defineProperty(node, 'valueAsNumber', {
        get: () => (node.value.trim() === '' ? NaN : Number(node.value)),
      });
    return node;
  };
  let course = structuredClone(EXPRESSIVE_HUNT_COURSES[0]);
  for (const mode of modes)
    course.steps[mode] = [
      { type: 'survive', ticks: 50 },
      ...(hunt ? [criterion(course.actors.slice(0, 2).map((actor) => actor.id))] : []),
      { type: 'survive', ticks: 100 },
    ];
  change(course);
  course = validateWorldCourse(course);
  let bindings = Object.fromEntries(
    modes.map((mode) => [mode, course.steps[mode].map((_, index) => `${mode}-${index}`)]),
  );
  const history = [];
  const editor = mountActorEditor({
    container,
    locale,
    getCourse: () => course,
    onChange(mutator) {
      const next = structuredClone(course),
        refs = structuredClone(bindings);
      mutator(next, refs);
      const accepted = validateWorldCourse(next);
      history.push({ course, bindings });
      course = accepted;
      bindings = refs;
    },
  });
  t.after(() => editor.dispose());
  const $ = (selector) => container.querySelector(selector);
  const button = (label) =>
    [...container.querySelectorAll('button')].find((node) => node.textContent === label);
  return {
    doc,
    container,
    editor,
    $,
    button,
    history,
    course: () => course,
    bindings: () => bindings,
    field(name, value) {
      $(`[data-hunt-field="${name}"]`).value = String(value);
    },
    choose(selector, value) {
      const node = $(selector);
      node.value = value;
      node.emit('change');
    },
    async click(selector) {
      $(selector).click();
      await settled();
    },
    undo() {
      ({ course, bindings } = history.pop());
      editor.refresh();
    },
    externalEdit(mutator) {
      const next = structuredClone(course);
      mutator(next);
      course = validateWorldCourse(next);
    },
  };
}

test('the unarmed Hunt preset creates an immediately eligible native target without editing a weapon field', async (t) => {
  const f = fixture(t, {
    change(course) {
      course.actors = [];
    },
  });
  assert.equal(f.$('[data-hunt-action="add"]'), null);
  await f.click('[data-hunt-action="add-actor"]');
  const actor = f.course().actors[0];
  assert.equal(actor.type, 'patrol');
  assert.equal(actor.role, 'hostile');
  assert.equal(actor.fireEveryTicks, 0);
  assert.deepEqual(actor.path, []);
  assert.equal(f.editor.selected(), actor.id);
  await f.click('[data-hunt-action="add"]');
  for (const mode of modes) assert.deepEqual(f.course().steps[mode].at(-1).targets, [actor.id]);
});

test('Contact Hunt authoring admits ordered finite targets and native tail settings in both modes', async (t) => {
  const f = fixture(t),
    before = structuredClone(f.course()),
    ids = before.actors.map((actor) => actor.id);
  f.choose('[data-hunt-target]', ids[1]);
  await f.click('[data-hunt-action="add-target"]');
  f.$(`[data-hunt-target-id="${ids[1]}"]`).querySelector('[data-hunt-target-action="up"]').click();
  f.$('[data-hunt-ordered]').checked = true;
  f.$('[data-hunt-tail]').checked = true;
  f.$('[data-hunt-tail]').emit('change');
  f.field('linksPerCatch', 2);
  f.field('maxLinks', 16);
  f.field('neckDistance', 6);
  f.field('radius', 0.3);
  await f.click('[data-hunt-action="add"]');
  const expected = {
    ...criterion([ids[1], ids[0]]),
    ordered: true,
    tail: { linksPerCatch: 2, maxLinks: 16, neckDistance: 6000, radius: 300 },
  };
  for (const mode of modes) {
    assert.deepEqual(f.course().steps[mode].at(-1), expected);
    assert.deepEqual(f.bindings()[mode], [`${mode}-0`, `${mode}-1`, null]);
  }
  assert.deepEqual(
    f.course().actors,
    before.actors,
    'authoring a quota never spawns, arms or replaces an actor',
  );
  assert.deepEqual(
    validateWorldCourse(JSON.stringify(f.course())),
    f.course(),
    'native course JSON preserves accepted Hunt data',
  );
  f.undo();
  assert.deepEqual(f.course(), before, 'host undo restores the entire previous accepted recipe');
});

test('Contact Hunt edits and objective movement preserve the other mode and binding positions', async (t) => {
  const f = fixture(t, { hunt: true }),
    other = structuredClone(f.course().steps.acro),
    ids = f.course().actors.map((actor) => actor.id);
  assert.equal(f.editor.selectObjective('self-level', 1, { focus: true }), true);
  assert.equal(f.doc.activeElement, f.$('[data-hunt-objective]'));
  f.$(`[data-hunt-target-id="${ids[0]}"]`)
    .querySelector('[data-hunt-target-action="remove"]')
    .click();
  f.$('[data-hunt-ordered]').checked = true;
  await f.click('[data-hunt-action="apply"]');
  assert.deepEqual(f.course().steps['self-level'][1].targets, [ids[1]]);
  assert.equal(f.course().steps['self-level'][1].ordered, true);
  assert.deepEqual(f.course().steps.acro, other);
  await f.click('[data-hunt-action="up"]');
  assert.equal(f.course().steps['self-level'][0].type, 'hunt-contact-v1');
  assert.deepEqual(f.bindings()['self-level'], ['self-level-1', 'self-level-0', 'self-level-2']);
  await f.click('[data-hunt-action="remove"]');
  assert.deepEqual(f.bindings()['self-level'], ['self-level-0', 'self-level-2']);
  assert.deepEqual(f.course().steps.acro, other);
});

test('Contact Hunt refuses conflicts, invalid tail bounds and duplicate-mode creation atomically', async (t) => {
  const f = fixture(t, {
    change(course) {
      course.steps.acro.push({ type: 'eliminate', targets: [course.actors[0].id] });
    },
  });
  const original = structuredClone(f.course());
  await f.click('[data-hunt-action="add"]');
  assert.deepEqual(
    f.course(),
    original,
    'failure in the second requested mode cannot leave the first modified',
  );
  assert.match(f.$('[data-actor-status]').textContent, /defeat or tracking/);
  assert.equal(f.history.length, 0);
  f.choose('[data-hunt-modes]', 'self-level');
  f.$('[data-hunt-tail]').checked = true;
  f.$('[data-hunt-tail]').emit('change');
  f.field('radius', 0.451);
  await f.click('[data-hunt-action="add"]');
  assert.deepEqual(f.course(), original);
  assert.equal(f.$('[data-hunt-field="radius"]').getAttribute('aria-invalid'), 'true');
  f.field('radius', 0.3);
  await f.click('[data-hunt-action="add"]');
  const accepted = structuredClone(f.course());
  f.choose('[data-hunt-objective]', '');
  await f.click('[data-hunt-action="add"]');
  assert.deepEqual(f.course(), accepted);
  assert.match(f.$('[data-actor-status]').textContent, /already has a Hunt/);
});

test('deleting Hunt targets cleans both modes, preserves surviving order, and keeps last-objective fallback undoable', async (t) => {
  const f = fixture(t, {
    hunt: true,
    change(course) {
      for (const mode of modes)
        course.steps[mode] = [criterion(course.actors.slice(0, 2).map((actor) => actor.id))];
    },
  });
  const original = structuredClone(f.course()),
    ids = original.actors.map((actor) => actor.id);
  f.editor.select(ids[0]);
  f.button('Remove actor').click();
  await settled();
  for (const mode of modes) assert.deepEqual(f.course().steps[mode][0].targets, [ids[1]]);
  f.editor.select(ids[1]);
  f.button('Remove actor').click();
  await settled();
  for (const mode of modes) {
    assert.deepEqual(f.course().steps[mode], [{ type: 'survive', ticks: 50 }]);
    assert.deepEqual(f.bindings()[mode], [null]);
  }
  f.undo();
  f.undo();
  assert.deepEqual(f.course(), original);
});

test('changing a Hunt target to Rival removes only its catch references and cannot enable its weapon', async (t) => {
  const f = fixture(t, { hunt: true }),
    ids = f.course().actors.map((actor) => actor.id);
  f.editor.select(ids[0]);
  const fire = f.$('input[aria-label="Fire interval · ticks (0 = disabled)"]');
  assert.equal(fire.disabled, true);
  f.choose('select[aria-label="Actor role"]', 'rival');
  f.button('Apply actor settings').click();
  await settled();
  assert.equal(f.course().actors.find((actor) => actor.id === ids[0]).role, 'rival');
  for (const mode of modes) assert.deepEqual(f.course().steps[mode][1].targets, [ids[1]]);
  assert.equal(f.course().actors.find((actor) => actor.id === ids[0]).fireEveryTicks, 0);
});

test('a stale Contact Hunt panel cannot overwrite a newer objective and Ukrainian controls stay localized', async (t) => {
  const f = fixture(t, { hunt: true, locale: 'uk' });
  f.editor.selectObjective('acro', 1);
  f.externalEdit((course) => {
    course.steps.acro[1].ordered = true;
  });
  const accepted = structuredClone(f.course());
  await f.click('[data-hunt-action="apply"]');
  assert.deepEqual(f.course(), accepted);
  assert.equal(f.history.length, 0);
  assert.match(f.$('[data-actor-status]').textContent, /Виберіть його знову/);
  assert.equal(f.$('[data-hunt-action="apply"]').textContent, 'Застосувати налаштування полювання');
});

test('adding an unarmed actor preserves a new Hunt draft without silently adding it to the quota', async (t) => {
  const f = fixture(t),
    ids = f.course().actors.map((actor) => actor.id);
  f.choose('[data-hunt-target]', ids[1]);
  await f.click('[data-hunt-action="add-target"]');
  f.$('[data-hunt-ordered]').checked = true;
  f.$('[data-hunt-tail]').checked = true;
  f.$('[data-hunt-tail]').emit('change');
  f.field('linksPerCatch', 3);
  f.field('maxLinks', 18);
  f.field('neckDistance', 7);
  f.field('radius', 0.32);
  await f.click('[data-hunt-action="add-actor"]');
  assert.equal(f.course().actors.length, ids.length + 1);
  assert.equal(f.$('[data-hunt-objective]').value, '');
  assert.equal(f.$('[data-hunt-ordered]').checked, true);
  assert.equal(f.$('[data-hunt-field="maxLinks"]').value, '18');
  await f.click('[data-hunt-action="add"]');
  for (const mode of modes) {
    const step = f.course().steps[mode].at(-1);
    assert.deepEqual(step.targets, ids.slice(0, 2));
    assert.equal(step.ordered, true);
    assert.deepEqual(step.tail, {
      linksPerCatch: 3,
      maxLinks: 18,
      neckDistance: 7000,
      radius: 320,
    });
  }
});

test('mode-specific Hunt drafts survive actor addition and moving applies the draft atomically', async (t) => {
  const f = fixture(t, { hunt: true }),
    ids = f.course().actors.map((actor) => actor.id),
    other = structuredClone(f.course().steps.acro);
  f.editor.selectObjective('self-level', 1);
  f.$(`[data-hunt-target-id="${ids[0]}"]`)
    .querySelector('[data-hunt-target-action="remove"]')
    .click();
  f.$('[data-hunt-ordered]').checked = true;
  f.$('[data-hunt-tail]').checked = true;
  f.$('[data-hunt-tail]').emit('change');
  f.field('maxLinks', 20);
  await f.click('[data-hunt-action="add-actor"]');
  assert.equal(f.$('[data-hunt-objective]').value, 'self-level:1');
  f.choose('[data-hunt-objective]', 'acro:1');
  assert.equal(f.$('[data-hunt-ordered]').checked, false);
  f.choose('[data-hunt-objective]', 'self-level:1');
  assert.equal(f.$('[data-hunt-ordered]').checked, true);
  assert.equal(f.$('[data-hunt-field="maxLinks"]').value, '20');
  const accepted = structuredClone(f.course()),
    bindings = structuredClone(f.bindings());
  f.field('radius', 0.6);
  await f.click('[data-hunt-action="up"]');
  assert.deepEqual(f.course(), accepted, 'invalid draft cannot move or alter the accepted goal');
  assert.deepEqual(f.bindings(), bindings);
  f.field('radius', 0.3);
  await f.click('[data-hunt-action="up"]');
  const moved = f.course().steps['self-level'][0];
  assert.deepEqual(moved.targets, [ids[1]]);
  assert.equal(moved.ordered, true);
  assert.equal(moved.tail.maxLinks, 20);
  assert.equal(moved.tail.radius, 300);
  assert.deepEqual(f.course().steps.acro, other);
  assert.deepEqual(f.bindings()['self-level'], ['self-level-1', 'self-level-0', 'self-level-2']);
});
