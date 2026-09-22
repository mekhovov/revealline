import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFormFocus } from '../studio/form-focus.mjs';
import { createTimedBonusEditor } from '../studio/timed-bonus-editor.mjs';
import { createStarterProject } from '../content-design/starter.mjs';

function fixture() {
  const doc = new EventTarget(),
    view = new EventTarget(),
    form = new EventTarget();
  const frames = [],
    scrolls = [],
    nodes = new Set([form]);
  Object.assign(view, {
    visualViewport: { height: 568 },
    requestAnimationFrame(fn) {
      frames.push(fn);
    },
  });
  Object.assign(doc, {
    defaultView: view,
    hidden: false,
    hasFocus: () => true,
    documentElement: { clientHeight: 568 },
  });
  Object.assign(form, {
    isConnected: true,
    contains: (node) => nodes.has(node),
    noValidate: false,
  });
  function field(name, { top = -22.90625, height = 67, controlHeight = 44 } = {}) {
    const label = {
      getBoundingClientRect: () => ({ top, bottom: top + height, height }),
      scrollIntoView: (options) => scrolls.push({ name, label: true, options }),
    };
    const input = {
      isConnected: true,
      disabled: false,
      required: true,
      value: '',
      getClientRects: () => [{}],
      closest: (selector) => (selector === 'label' ? label : null),
      getBoundingClientRect: () => ({
        top: 0.09375,
        bottom: 0.09375 + controlHeight,
        height: controlHeight,
      }),
      focus() {
        throw new Error('The adapter must never choose focus.');
      },
      scrollIntoView: (options) => scrolls.push({ name, label: false, options }),
    };
    nodes.add(label);
    nodes.add(input);
    return { input, label };
  }
  function event(type, target) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    form.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'Native validation/focus behavior stays intact');
  }
  return {
    doc,
    view,
    form,
    frames,
    scrolls,
    field,
    event,
    flush() {
      for (const run of frames.splice(0)) run();
    },
  };
}

test('native validation reveals the selected field label after all invalid events, without choosing focus', () => {
  const f = fixture(),
    id = f.field('id'),
    anchors = f.field('anchors');
  attachFormFocus({ form: f.form, document: f.doc });
  f.event('invalid', id.input);
  f.event('invalid', anchors.input);
  assert.equal(f.frames.length, 1, 'One bounded frame for the native validation pass');
  assert.equal(f.scrolls.length, 0);
  f.doc.activeElement = id.input; // The browser selects the first invalid field.
  f.flush();
  assert.deepEqual(f.scrolls, [
    { name: 'id', label: true, options: { block: 'nearest', inline: 'nearest', behavior: 'auto' } },
  ]);
  assert.equal(f.doc.activeElement, id.input);
  assert.equal(id.input.required, true);
  assert.equal(f.form.noValidate, false);
});

test('ordinary forward/reverse focus reveals labels and oversized labels fall back to the control', () => {
  const f = fixture(),
    id = f.field('id'),
    tall = f.field('tall', { height: 900 });
  attachFormFocus({ form: f.form, document: f.doc });
  for (const field of [id.input, tall.input, id.input]) {
    f.doc.activeElement = field;
    f.event('focusin', field);
    f.flush();
  }
  assert.deepEqual(
    f.scrolls.map(({ name, label }) => [name, label]),
    [
      ['id', true],
      ['tall', false],
      ['id', true],
    ],
  );
});

test('stale validation, background, hidden controls and disposal cannot scroll a new target', () => {
  for (const change of [
    'other-focus',
    'background',
    'blur-return',
    'hidden',
    'disabled',
    'detach',
    'dispose',
  ]) {
    const f = fixture(),
      id = f.field('id'),
      other = f.field('other');
    const owner = attachFormFocus({ form: f.form, document: f.doc });
    f.event('invalid', id.input);
    f.doc.activeElement = id.input;
    if (change === 'other-focus') f.doc.activeElement = other.input;
    if (change === 'background') f.doc.hidden = true;
    if (change === 'blur-return') f.view.dispatchEvent(new Event('blur'));
    if (change === 'hidden')
      id.input.closest = (selector) => (selector === 'label' ? id.label : {});
    if (change === 'disabled') id.input.disabled = true;
    if (change === 'detach') f.form.isConnected = false;
    if (change === 'dispose') owner.destroy();
    f.flush();
    assert.equal(f.scrolls.length, 0, change);
    if (change === 'dispose') {
      f.event('focusin', id.input);
      assert.equal(f.frames.length, 0);
    }
  }
});

test('layout callbacks cannot scroll a field that lost focus while its label was measured', () => {
  const f = fixture(),
    id = f.field('id'),
    other = f.field('other');
  attachFormFocus({ form: f.form, document: f.doc });
  id.label.getBoundingClientRect = () => {
    f.doc.activeElement = other.input;
    return { height: 67 };
  };
  f.doc.activeElement = id.input;
  f.event('focusin', id.input);
  f.flush();
  assert.equal(f.scrolls.length, 0);
});

test('timed editor keeps invalid drafts unchanged and still applies a real valid schedule', () => {
  const f = fixture(),
    id = f.field('id');
  const nodes = new Map([
    ['timed-bonus-form', f.form],
    ['timed-bonus-id', id.input],
  ]);
  const element = () => ({
    value: '',
    disabled: false,
    replaceChildren(...children) {
      this.children = children;
      this.value = children[0]?.value ?? '';
    },
  });
  f.doc.createElement = element;
  f.doc.getElementById = (name) => {
    if (!nodes.has(name)) nodes.set(name, element());
    return nodes.get(name);
  };
  let source = createStarterProject(),
    applies = 0;
  const editor = createTimedBonusEditor({
    document: f.doc,
    getSource: () => source,
    getMission: () => source.missions[0],
    apply(next) {
      source = next;
      applies++;
      return true;
    },
  });
  editor.sync();
  const before = JSON.stringify(source);
  f.event('invalid', id.input);
  f.doc.activeElement = id.input;
  f.flush();
  assert.equal(applies, 0);
  assert.equal(f.scrolls.length, 1, 'The mounted editor reveals the native invalid field label');
  assert.equal(JSON.stringify(source), before);
  assert.equal(id.input.value, '');
  const node = (name) => f.doc.getElementById(`timed-bonus-${name}`);
  id.input.value = 'focus-regression';
  node('anchors').value = '8.5, 8.5; 24.5, 8.5';
  for (const name of ['delay', 'announce', 'available', 'cooldown', 'appearances', 'collections'])
    node(name).value = String(node(name).value);
  f.form.onsubmit({ preventDefault() {} });
  assert.equal(applies, 1);
  assert.equal(source.missions[0].timedBonuses.schedules[0].id, 'focus-regression');
  editor.destroy();
});
