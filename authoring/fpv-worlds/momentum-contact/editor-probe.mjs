/** Manual DOM-boundary probe of the production actor editor, not a browser claim. */
import { Document } from '../../../game/test/helpers/couch-dom.mjs';
import { mountActorEditor } from '../../../optional-practice/civilian-fpv/world-actor-editor.mjs';
import {
  validateWorldCourse,
  exportWorldCourse,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { momentumPracticeCourse } from './course.mjs';

export async function probeEditor({ check, equal }) {
  const rows = [];
  for (const policy of [undefined, 'retain-momentum-v1']) {
    const doc = new Document(),
      container = doc.createElement('section');
    doc.body.append(container);
    const create = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const node = create(tag);
      if (tag === 'input')
        Object.defineProperty(node, 'valueAsNumber', {
          get: () => (node.value.trim() === '' ? NaN : Number(node.value)),
        });
      return node;
    };
    const source = momentumPracticeCourse();
    for (const steps of Object.values(source.steps))
      if (policy === undefined) delete steps[0].contactPolicy;
    let course = validateWorldCourse(source);
    let bindings = Object.fromEntries(
      Object.entries(course.steps).map(([mode, steps]) => [
        mode,
        steps.map((_, i) => `${mode}-${i}`),
      ]),
    );
    const original = structuredClone(course),
      history = [];
    const editor = mountActorEditor({
      container,
      locale: 'en',
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
    const $ = (selector) => container.querySelector(selector);
    const click = async (selector) => {
      const control = $(selector);
      check(control && !control.disabled, `Editor control available: ${selector}`);
      control.click();
      await new Promise((resolve) => setImmediate(resolve));
    };
    const undo = () => {
      ({ course, bindings } = history.pop());
      editor.refresh();
    };
    const criterion = () =>
      course.steps['self-level'].find((step) => step.type === 'hunt-contact-v1');
    const preserved = (label) => {
      equal(criterion().contactPolicy, policy, `${label}: accepted policy retained`);
      equal(
        Object.hasOwn(criterion(), 'contactPolicy'),
        policy !== undefined,
        `${label}: absence remains absence`,
      );
      equal(
        validateWorldCourse(exportWorldCourse(course)),
        course,
        `${label}: normalized JSON round-trip exact`,
      );
    };
    try {
      check(editor.selectObjective('self-level', 0), 'Select existing Hunt objective');
      await click('[data-hunt-action="apply"]');
      equal(course, original, 'No-op Apply preserves the entire normalized course');
      preserved('Apply');
      await click('[data-hunt-action="down"]');
      equal(
        bindings['self-level'],
        ['self-level-1', 'self-level-0'],
        'Move preserves objective bindings',
      );
      preserved('Move');
      equal(course.steps.acro, original.steps.acro, 'Move leaves the other mode exact');
      undo();
      equal(course, original, 'Host Undo restores exact pre-move accepted course');
      check(editor.selectObjective('self-level', 0), 'Reselect restored objective');
      await click('[data-hunt-target-id="runner-02"] [data-hunt-target-action="up"]');
      await click('[data-hunt-action="apply"]');
      equal(criterion().targets, ['runner-02', 'runner-01'], 'Target order edit applied');
      preserved('Target order');
      undo();
      equal(course, original, 'Host Undo restores exact pre-order accepted course');
      editor.select('runner-01');
      const remove = [...container.querySelectorAll('button')].find(
        (node) => node.textContent === 'Remove actor',
      );
      check(!!remove, 'Remove actor control exists');
      remove.click();
      await new Promise((resolve) => setImmediate(resolve));
      equal(criterion().targets, ['runner-02'], 'Actor removal normalizes Hunt references');
      preserved('Actor-reference normalization');
      for (const mode of ['self-level', 'acro'])
        equal(
          course.steps[mode].find((step) => step.type === 'hunt-contact-v1').contactPolicy,
          policy,
          `${mode}: actor normalization preserves policy`,
        );
      undo();
      equal(course, original, 'Host Undo restores exact pre-removal course');
      rows.push({
        kind: 'editor-preservation',
        policy: policy ?? 'absent',
        apply: true,
        move: true,
        targetOrder: true,
        actorRemoval: true,
        hostUndo: true,
        jsonRoundTrip: true,
      });
    } finally {
      editor.dispose();
    }
  }
  return rows;
}
