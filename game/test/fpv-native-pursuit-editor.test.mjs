import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { renderPursuitEditor } from '../../optional-practice/civilian-fpv/world-pursuit-editor.mjs';
import { NATIVE_PURSUIT_COURSES } from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { validateWorldCourse } from '../../optional-practice/civilian-fpv/world-model.mjs';

function setup() {
  const document = new Document(),
    draft = {};
  let course = validateWorldCourse(NATIVE_PURSUIT_COURSES[2]);
  const history = [];
  const render = () =>
    renderPursuitEditor({
      document,
      course,
      selected: 'pursuit-1',
      locale: 'en',
      draft,
      change(mutator) {
        const next = structuredClone(course);
        mutator(next);
        const accepted = validateWorldCourse(next);
        history.push(course);
        course = accepted;
      },
    });
  return {
    draft,
    render,
    course: () => course,
    undo() {
      course = history.pop();
    },
    source(value) {
      course = value;
    },
  };
}
const click = (panel, text) =>
  [...panel.querySelectorAll('button')].find((node) => node.textContent === text).click();

test('graph edits survive refresh, explicitly synchronize Hunt quotas and Undo restores source', () => {
  const editor = setup();
  let panel = editor.render();
  const source = structuredClone(editor.course());
  const input = panel.querySelector('textarea');
  const value = JSON.parse(input.value);
  value.actors[1].family = 'runner';
  input.value = JSON.stringify(value);
  input.emit('input');
  panel = editor.render();
  assert.equal(JSON.parse(panel.querySelector('textarea').value).actors[1].family, 'runner');
  click(panel, 'Apply graph and Hunt targets');
  assert.ok(
    Object.values(editor.course().steps).every((steps) => steps[0].targets.includes('pursuit-2')),
  );
  editor.undo();
  panel = editor.render();
  assert.deepEqual(editor.course(), source);
  assert.equal(JSON.parse(panel.querySelector('textarea').value).actors[1].family, 'courier');
});

test('invalid numeric nodes cannot replace accepted source; explicit discard recovers the editor', () => {
  const editor = setup();
  const panel = editor.render(),
    input = panel.querySelector('textarea');
  const before = structuredClone(editor.course());
  const value = JSON.parse(input.value);
  value.nodes[0].position.x = 1.5;
  input.value = JSON.stringify(value);
  input.emit('input');
  assert.throws(() => click(panel, 'Apply graph and Hunt targets'));
  assert.deepEqual(editor.course(), before);
  click(panel, 'Discard graph edits');
  assert.deepEqual(JSON.parse(input.value), before.pursuit);
});

test('external return to a legacy source removes an unrelated pending pursuit draft', () => {
  const editor = setup();
  let panel = editor.render();
  const input = panel.querySelector('textarea');
  input.value = '{';
  input.emit('input');
  const older = structuredClone(editor.course());
  delete older.pursuit;
  older.format = 'FlightCourse.v2';
  for (const actor of older.actors) delete actor.vehicleModel;
  editor.source(validateWorldCourse(older));
  panel = editor.render();
  assert.equal(panel.querySelector('textarea'), null);
  assert.deepEqual(editor.draft, {});
});

test('existing v1 graphs upgrade only through an explicit, undoable action without discarding text edits', () => {
  const editor = setup(),
    original = structuredClone(editor.course());
  let panel = editor.render();
  const input = panel.querySelector('textarea');
  input.value = input.value + ' ';
  input.emit('input');
  click(panel, 'Upgrade to committed pursuit v2');
  assert.deepEqual(editor.course(), original);
  click(panel, 'Discard graph edits');
  click(panel, 'Upgrade to committed pursuit v2');
  assert.equal(editor.course().pursuit.format, 'FlightPursuit.v2');
  assert.deepEqual(editor.course().steps, original.steps);
  editor.undo();
  panel = editor.render();
  assert.equal(JSON.parse(panel.querySelector('textarea').value).format, 'FlightPursuit.v1');
});
