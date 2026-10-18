import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountFlightTuning } from '../../optional-practice/civilian-fpv/tuning-ui.mjs';
import { createTuningLibraryStore } from '../../optional-practice/civilian-fpv/tuning-library.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, { physical = false, prepare } = {}) {
  const document = new Document(),
    window = new Events(),
    data = new Map(),
    tested = [],
    frames = new Map();
  let frameId = 0;
  document.createElementNS = (_namespace, tag) => document.createElement(tag);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  Object.assign(window, {
    localStorage: storage,
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    matchMedia: () => ({ matches: false }),
  });
  const store = createTuningLibraryStore({ storage });
  if (physical)
    await store.createPresetSetup({
      presetId: 'meteor75-analog-2022',
      setupId: 'meteor',
      profileId: 'meteor-rates',
      rates: 'defaults',
    });
  await prepare?.(store);
  let returnFromCalibration;
  const ui = mountFlightTuning({
    document,
    window,
    store,
    onCalibration: (done) => {
      returnFromCalibration = done;
    },
    onTest: (configuration) => tested.push(configuration),
  });
  t.after(() => ui.dispose());
  for (const select of ui.root.querySelectorAll('select'))
    if (select.selectedIndex < 0 && select.options.length) select.value = select.options[0].value;
  ui.open();
  const field = (label, tag = 'input', scope = ui.root) => {
    const input = scope
      .querySelectorAll(tag)
      .find((node) => node.getAttribute('aria-label') === label && node.type !== 'range');
    assert.ok(input, `Missing ${label}`);
    return input;
  };
  const edit = (label, value, tag = 'input', scope = ui.root) => {
    const node = field(label, tag, scope);
    node.value = String(value);
    node.emit(tag === 'select' ? 'change' : 'input');
    return node;
  };
  const click = async (label) => {
    const button = ui.root.querySelectorAll('button').find((node) => node.textContent === label);
    assert.ok(button, `Missing ${label}`);
    button.click();
    await settle();
  };
  return {
    ui,
    document,
    store,
    tested,
    field,
    edit,
    click,
    frame(time) {
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(time);
    },
    returnFromCalibration: () => returnFromCalibration(),
  };
}

test('workbench undo restores each incomplete rate edit without converting the last valid command', async (t) => {
  const f = await fixture(t);
  f.edit('Maximum rate (°/s)', '360');
  f.edit('Maximum rate (°/s)', '');
  f.edit('Maximum rate (°/s)', '-');
  await f.click('Undo last edit');
  assert.equal(f.field('Maximum rate (°/s)').value, '');
  await f.click('Test draft · unscored');
  assert.equal(f.tested.length, 0, 'an undone incomplete value must still block flight testing');
  await f.click('Undo last edit');
  assert.equal(f.field('Maximum rate (°/s)').value, '360');
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].response.maxRate, 360);
  assert.equal(f.store.effective().response.maxRate, 240);
});

test('camera raw undo survives returnable calibration and never saves the draft', async (t) => {
  const f = await fixture(t),
    before = f.store.export();
  await f.click('Camera');
  f.edit('Camera tilt (degrees)', '21.75');
  f.edit('Camera tilt (degrees)', '');
  await f.click('Overview');
  await f.click('Check input & calibration');
  assert.equal(f.ui.root.open, false);
  f.returnFromCalibration();
  assert.equal(f.ui.root.open, true);
  assert.equal(f.field('Camera tilt (degrees)').value, '');
  await f.click('Undo last edit');
  assert.equal(f.field('Camera tilt (degrees)').value, '21.75');
  assert.equal(f.store.export(), before);
});

test('physical raw undo restores independent gain text and valid changes after reopening', async (t) => {
  const f = await fixture(t, { physical: true });
  const gain = (axis) =>
    f.ui.root
      .querySelectorAll('input')
      .find((node) => node.dataset.search?.includes(`controller.gains.${axis}.p`));
  const initial = Number(gain('pitch').value),
    changed = String(initial * 1.1);
  gain('pitch').value = changed;
  gain('pitch').emit('input');
  gain('roll').value = '';
  gain('roll').emit('input');
  f.ui.close();
  f.ui.open({ keepDraft: true });
  assert.equal(gain('pitch').value, changed);
  assert.equal(gain('roll').value, '');
  await f.click('Undo last edit');
  assert.equal(gain('pitch').value, changed);
  assert.ok(Number(gain('roll').value) > 0);
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].advanced.controller.gains.pitch.p, Number(changed));
});

test('native units and algorithm drafts survive invalid-number undo', async (t) => {
  const f = await fixture(t);
  f.edit('Rate algorithm', 'quick', 'select');
  const roll = () =>
    f.ui.root
      .querySelectorAll('fieldset')
      .find((node) => node.querySelector('legend')?.textContent === 'Roll');
  f.edit('RC rate', '1.23', 'input', roll());
  f.edit('RC rate', '', 'input', roll());
  f.edit('Rate algorithm', 'actual', 'select');
  await f.click('Undo last edit');
  assert.equal(f.field('Rate algorithm', 'select').value, 'quick');
  assert.equal(f.field('RC rate', 'input', roll()).value, '');
  await f.click('Undo last edit');
  assert.equal(f.field('RC rate', 'input', roll()).value, '1.23');
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].response.rates.algorithm, 'quick');
  assert.equal(f.tested[0].response.rates.axes.roll.rcRate, 123);
});

test('commanded rotation respects the aircraft top view and releases sticks outside Rates', async (t) => {
  const f = await fixture(t, { physical: true });
  await f.click('Rates & throttle');
  const quad = f.ui.root.querySelector('.tuning-quad');
  for (const [axis, transform] of [
    ['roll', 'rotateY'],
    ['pitch', 'rotateX'],
    ['yaw', 'rotateZ'],
  ]) {
    f.edit('Rotation preview axis', axis, 'select');
    f.frame(100);
    assert.equal(quad.style.transform, `${transform}(0deg)`);
  }
  const capture = f.field('Capture live sticks for preview');
  capture.checked = true;
  capture.emit('change');
  assert.equal(f.ui.captureActive(), true);
  await f.click('Camera');
  assert.equal(capture.checked, false);
  assert.equal(f.ui.captureActive(), false);
  await f.click('Rates & throttle');
  assert.equal(f.ui.captureActive(), false, 'returning must require explicit recapture');
});

test('restoring a saved custom controller keeps its customized gains visible in Basic', async (t) => {
  let savedGain;
  const f = await fixture(t, {
    physical: true,
    async prepare(store) {
      const setup = store.snapshot().setups.find((item) => item.id === 'meteor');
      setup.advanced.controller.gains.roll.p *= 1.2;
      savedGain = setup.advanced.controller.gains.roll.p;
      await store.saveSetup(setup);
    },
  });
  await f.click('Flight response / PID');
  const gain = f.field('Roll P (N·m/(rad/s))');
  const row = gain.closest('.workbench-physical-field');
  assert.equal(row.hidden, false);
  f.edit('Roll P (N·m/(rad/s))', savedGain * 1.1);
  await f.click('Restore saved controller');
  assert.equal(Number(gain.value), savedGain);
  assert.equal(row.dataset.customized, 'true');
  assert.equal(row.hidden, false, 'saved customizations still differ from the aircraft defaults');
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].advanced.controller.gains.roll.p, savedGain);
});

test('installed battery capacity owns the Expert mirror and the tested configuration', async (t) => {
  const f = await fixture(t, { physical: true });
  const capacity = f.field('Battery capacity (Ah)');
  assert.equal(capacity.readOnly, true);
  assert.equal(Number(capacity.value), 0.45);
  f.edit('Battery', 'custom', 'select');
  f.edit('Battery capacity (mAh)', '600');
  assert.equal(Number(capacity.value), 0.6);
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].advanced.aircraft.battery.capacityAh, 0.6);
  assert.equal(f.store.effective().advanced.aircraft.battery.capacityAh, 0.45);
  f.ui.open({ keepDraft: true });
  await f.click('Edit installed battery');
  assert.equal(f.document.activeElement, f.field('Battery', 'select'));
  f.edit('Battery capacity (mAh)', '');
  await f.click('Test draft · unscored');
  assert.equal(f.tested.length, 1, 'invalid editable capacity blocks testing');
  assert.equal(f.document.activeElement, f.field('Battery capacity (mAh)'));
  f.edit('Battery', 'reference', 'select');
  assert.equal(Number(capacity.value), 0.45);
  await f.click('Test draft · unscored');
  assert.equal(f.tested[1].advanced.aircraft.battery.capacityAh, 0.45);
});

test('commanded rotation geometry refreshes for geometry edits on the same aircraft', async (t) => {
  const f = await fixture(t, { physical: true });
  const quad = f.ui.root.querySelector('.tuning-quad');
  const originalSvg = quad.firstChild;
  const originalRotor = originalSvg
    .querySelector('[data-preview-part="rotor"]')
    .getAttribute('transform');
  const position = f.field('Rotor 1 position x (m)');
  f.edit('Rotor 1 position x (m)', Number(position.value) * 1.15);
  assert.notEqual(quad.firstChild, originalSvg);
  assert.notEqual(
    quad.firstChild.querySelector('[data-preview-part="rotor"]').getAttribute('transform'),
    originalRotor,
  );
  await f.click('Test draft · unscored');
  assert.equal(
    f.tested[0].advanced.aircraft.id,
    f.store.effective().advanced.aircraft.id,
    'geometry customization retains its aircraft identity',
  );
});

test('calibration returns preserve the original workbench opener', async (t) => {
  const f = await fixture(t);
  f.ui.close();
  const origin = f.ui.button(f.document.body);
  origin.click();
  await settle();
  await f.click('Check input & calibration');
  const calibrationClose = f.document.createElement('button');
  f.document.body.append(calibrationClose);
  calibrationClose.focus();
  f.returnFromCalibration();
  await f.click('Close');
  assert.equal(f.document.activeElement, origin);
});

test('Legacy commanded rotation has an illustrative fallback and never retains a previous aircraft', async (t) => {
  const f = await fixture(t);
  const quad = f.ui.root.querySelector('.tuning-quad');
  assert.match(quad.firstChild.getAttribute('aria-label'), /Generic commanded rotation/);
  f.edit('Aircraft preset', 'meteor75-analog-2022', 'select');
  await f.click('Use in draft');
  const physical = quad.firstChild;
  assert.doesNotMatch(physical.getAttribute('aria-label'), /Generic commanded rotation/);
  f.edit('Drone setup', 'my-drone', 'select');
  await f.click('Use saved setup in draft');
  assert.notEqual(quad.firstChild, physical);
  assert.match(quad.firstChild.getAttribute('aria-label'), /Generic commanded rotation/);
});
