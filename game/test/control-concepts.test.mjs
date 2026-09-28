import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createControlLabModel,
  validateControlLabFixture,
  exportControlLabFixture,
} from '../learning/control-lab.mjs';
import { FOUR_CONTROLS_FIXTURE } from '../learning/control-lab-fixture.mjs';
import { mountControlLab } from '../ui/control-lab.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const copy = (value) => structuredClone(value);
const neutral = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
test('civilian fixture import/export preserves both languages and exact cited sources', () => {
  const serialized = exportControlLabFixture(FOUR_CONTROLS_FIXTURE);
  assert.deepEqual(validateControlLabFixture(serialized), FOUR_CONTROLS_FIXTURE);
  assert.equal(exportControlLabFixture(serialized), serialized);
  const model = createControlLabModel(serialized);
  assert.equal(
    model.snapshot('uk').controls.find((control) => control.id === 'yaw').copy.title,
    'Рискання',
  );
  const external = model.fixture();
  external.controls[0].id = 'roll';
  assert.equal(model.fixture().controls[0].id, 'throttle');
});
test('fixture boundary rejects rewiring, progress, malformed links, missing translations and executable data', () => {
  for (const mutate of [
    (fixture) => {
      fixture.controls[0].axis = 3;
    },
    (fixture) => {
      fixture.completion = 'won';
    },
    (fixture) => {
      fixture.controls[0].id = fixture.controls[1].id;
    },
    (fixture) => {
      fixture.sources[0].url = 'javascript:alert(1)';
    },
    (fixture) => {
      fixture.sources[0].url = 'https://user:password@example.org/';
    },
    (fixture) => {
      fixture.sources[0].url = 'https://example.org/\\bad';
    },
    (fixture) => {
      delete fixture.controls[0].locales.uk;
    },
    (fixture) => {
      fixture.controls[0].sourceIds = ['missing'];
    },
    (fixture) => {
      fixture.layout = 'universal';
    },
    (fixture) => {
      fixture.controls.push(copy(fixture.controls[0]));
    },
  ]) {
    const fixture = copy(FOUR_CONTROLS_FIXTURE);
    mutate(fixture);
    assert.throws(() => validateControlLabFixture(fixture));
  }
  let accessed = false;
  const executable = copy(FOUR_CONTROLS_FIXTURE);
  Object.defineProperty(executable, 'id', {
    enumerable: true,
    get() {
      accessed = true;
      return 'bad';
    },
  });
  assert.throws(() => validateControlLabFixture(executable));
  assert.equal(accessed, false);
  assert.throws(() => validateControlLabFixture(' '.repeat(65537)));
});
test('control projection is bounded, deterministic, resettable and has no simulated flight state', () => {
  const model = createControlLabModel(FOUR_CONTROLS_FIXTURE);
  assert.deepEqual(model.snapshot().values, neutral);
  model.set('throttle', -1);
  assert.equal(model.snapshot().values.throttle, 0);
  model.set('yaw', 5);
  model.set('pitch', -0.5);
  model.set('roll', 0.25);
  const first = model.snapshot();
  assert.deepEqual(model.snapshot(), first);
  assert.equal(first.controls.find((item) => item.id === 'yaw').diagramAngle, 45);
  assert.match(first.controls.find((item) => item.id === 'pitch').description, /nose-up/);
  assert.equal(first.controls.find((item) => item.id === 'roll').diagramAngle, 6.25);
  assert.throws(() => model.set('pitch', NaN));
  assert.throws(() => model.set('arm', 1));
  assert.equal(Object.hasOwn(first, 'completion'), false);
  assert.equal(Object.hasOwn(first, 'position'), false);
  const staticView = model.snapshot('en', true);
  assert.deepEqual(staticView.values, first.values);
  assert.ok(staticView.controls.every((item) => item.diagramAngle === 0));
  assert.deepEqual(
    staticView.controls.map((item) => item.description),
    first.controls.map((item) => item.description),
  );
  model.reset();
  assert.deepEqual(model.snapshot().values, neutral);
});

function setup(t) {
  const doc = new Document(),
    win = new Events(),
    media = new Events();
  media.matches = false;
  win.matchMedia = () => media;
  win.setInterval = () => {
    throw new Error('Control diagrams must not simulate flight');
  };
  win.open = () => {
    throw new Error('Sources must require a link click');
  };
  Object.defineProperty(win, 'localStorage', {
    get() {
      throw new Error('No progress storage authority');
    },
  });
  doc.defaultView = win;
  const button = doc.createElement('button');
  doc.body.append(button);
  let released = 0;
  const view = mountControlLab({
    document: doc,
    window: win,
    fixture: FOUR_CONTROLS_FIXTURE,
    beforeOpen: () => {
      released++;
    },
  });
  t.after(() => view.dispose());
  const input = (id, value) => {
    const control = doc.getElementById(`control-lab-${id}`);
    control.value = String(value);
    control.emit('input');
    return control;
  };
  return { doc, win, media, button, view, input, released: () => released };
}
test('viewer opens in isolation, exposes native keyboard/touch sliders and restores focus without starting a run', (t) => {
  const { doc, button, view, input, released } = setup(t);
  button.focus();
  assert.equal(view.open(button), true);
  assert.equal(released(), 1);
  assert.equal(doc.getElementById('control-lab').open, true);
  assert.equal(doc.activeElement, doc.getElementById('control-lab-throttle'));
  for (const id of ['throttle', 'yaw', 'pitch', 'roll']) {
    const control = doc.getElementById(`control-lab-${id}`);
    assert.equal(control.type, 'range');
    assert.equal(control.step, '0.05');
    assert.ok(doc.querySelector(`label[for="${control.id}"]`));
    assert.ok(doc.getElementById(control.getAttribute('aria-describedby')));
  }
  const yaw = input('yaw', 0.5);
  assert.match(yaw.getAttribute('aria-valuetext'), /right/);
  assert.equal(view.snapshot().values.yaw, 0.5);
  doc.getElementById('control-lab-reset').click();
  assert.deepEqual(view.snapshot().values, neutral);
  input('pitch', 0.6);
  view.close();
  assert.equal(doc.activeElement, button);
  assert.deepEqual(view.snapshot().values, neutral);
  assert.equal(released(), 1, 'Closing does not resume or reconnect the old game');
  assert.ok(
    [...doc.querySelectorAll('a')].every(
      (link) => link.target === '_blank' && link.rel === 'noopener noreferrer',
    ),
  );
});
test('blur, background, controller disconnect and history transitions leave all conceptual controls neutral', (t) => {
  const { doc, win, button, view, input } = setup(t);
  view.open(button);
  for (const type of ['blur', 'gamepaddisconnected', 'pagehide']) {
    input('roll', 0.8);
    input('throttle', 0.7);
    win.emit(type);
    assert.deepEqual(view.snapshot().values, neutral, type);
  }
  input('yaw', 0.3);
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.deepEqual(view.snapshot().values, neutral);
  doc.hidden = false;
  assert.deepEqual(view.snapshot().values, neutral);
});
test('reduced motion preserves every explanation and updates diagrams without a timer', (t) => {
  const { doc, media, button, view, input } = setup(t);
  view.open(button);
  input('pitch', 0.7);
  const text = view.snapshot().controls.find((item) => item.id === 'pitch').description;
  media.emit('change', { matches: true });
  assert.equal(doc.getElementById('control-lab-static').checked, true);
  assert.equal(view.snapshot().controls.find((item) => item.id === 'pitch').diagramAngle, 0);
  assert.equal(view.snapshot().controls.find((item) => item.id === 'pitch').description, text);
  const old = getLocale();
  t.after(() => setLocale(old));
  setLocale('uk');
  assert.equal(
    doc.getElementById('control-lab-title').textContent,
    FOUR_CONTROLS_FIXTURE.locales.uk.title,
  );
  assert.match(doc.getElementById('control-lab-pitch').getAttribute('aria-valuetext'), /опущений/);
});
test('authoring import is atomic and preserves complete bilingual fixture on export', (t) => {
  const { doc, view, button, input } = setup(t);
  view.open(button);
  input('roll', 0.5);
  const before = view.export();
  const editor = doc.getElementById('control-lab-fixture');
  editor.value = '{"format":"other"}';
  doc.getElementById('control-lab-import').click();
  assert.equal(view.export(), before);
  assert.equal(view.snapshot().values.roll, 0.5);
  const custom = copy(FOUR_CONTROLS_FIXTURE);
  custom.id = 'classroom-example';
  custom.locales.en.title = '<img src=x onerror=bad>';
  editor.value = JSON.stringify(custom);
  doc.getElementById('control-lab-import').click();
  assert.deepEqual(view.snapshot().values, neutral);
  assert.equal(
    doc.getElementById('control-lab-title').textContent,
    custom.locales[getLocale()].title,
  );
  assert.equal(doc.querySelector('img'), null);
  doc.getElementById('control-lab-export').click();
  assert.deepEqual(validateControlLabFixture(editor.value), custom);
});
test('twenty visits reuse the same controls; disposal removes external listeners and cannot reopen', (t) => {
  const { doc, win, media, button, view, input } = setup(t);
  const control = doc.getElementById('control-lab-roll');
  for (let index = 0; index < 20; index++) {
    view.open(button);
    input('roll', 0.5);
    view.close();
    assert.equal(doc.getElementById('control-lab-roll'), control);
  }
  assert.equal(doc.querySelectorAll('dialog').length, 1);
  view.dispose();
  assert.equal(doc.querySelectorAll('dialog').length, 0);
  assert.equal(view.open(button), false);
  for (const type of ['blur', 'gamepaddisconnected', 'pagehide'])
    assert.equal(win.listeners.get(type)?.size ?? 0, 0);
  assert.equal(media.listeners.get('change')?.size ?? 0, 0);
  assert.equal(doc.listeners.get('visibilitychange')?.size ?? 0, 0);
});
