import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountFlightTuning } from '../../optional-practice/civilian-fpv/tuning-ui.mjs';
import { createTuningLibraryStore } from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { CONTROLLER_TUNE_LIBRARY_KEY } from '../../optional-practice/civilian-fpv/controller-tune-library.mjs';
import { canonicalJSON } from '../data-json.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(
  t,
  {
    physical = false,
    prepare,
    enableBench = false,
    conditions = null,
    workerURL,
    getFlightConfiguration = () => null,
    onApply = () => {},
  } = {},
) {
  const document = new Document(),
    window = new Events(),
    data = new Map(),
    tested = [],
    frames = new Map(),
    workers = [];
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
  if (enableBench)
    window.Worker = class extends Events {
      constructor(url, options) {
        super();
        this.url = url;
        this.options = options;
        this.messages = [];
        this.terminated = false;
        workers.push(this);
      }
      postMessage(message) {
        this.messages.push(message);
      }
      terminate() {
        this.terminated = true;
      }
      reply(data) {
        this.emit('message', { data });
      }
    };
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
    getFlightConfiguration,
    onApply,
    getPracticeConditions: () => conditions,
    responseBenchWorkerURL: workerURL,
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
  const click = async (label, scope = ui.root) => {
    const button = scope.querySelectorAll('button').find((node) => node.textContent === label);
    assert.ok(button, `Missing ${label}`);
    button.click();
    await settle();
  };
  return {
    ui,
    document,
    window,
    data,
    workers,
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
  gain.focus();
  assert.equal(Number(gain.value), savedGain);
  assert.equal(row.dataset.customized, 'true');
  assert.equal(row.hidden, false, 'saved customizations still differ from the aircraft defaults');
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].advanced.controller.gains.roll.p, savedGain);
});

for (const recovery of ['Revert draft', 'Undo last edit', 'Use in draft'])
  test(`${recovery} clears stale PID errors and restores a valid comparison`, async (t) => {
    const f = await fixture(t, { physical: true, enableBench: true });
    await f.click('Flight response / PID');
    const gain = f.field('Roll P (N·m/(rad/s))'),
      before = f.store.export(),
      original = f.store.effective().advanced.controller.gains.roll.p,
      summary = () => f.ui.root.querySelector('.workbench-summary').textContent,
      bench = f.ui.root.querySelector('.tuning-bench');
    f.edit('Roll P (N·m/(rad/s))', '');
    await f.click('Save for next flight');
    assert.equal(f.store.export(), before);
    assert.equal(gain.getAttribute('aria-invalid'), 'true');
    assert.match(summary(), /1 unfinished values.*Draft$/);
    assert.match(bench.textContent, /Unavailable for this backend/);
    if (recovery === 'Use in draft') {
      f.edit('Aircraft preset', 'meteor75-analog-2022', 'select');
      await f.click('Use in draft');
    } else await f.click(recovery);
    assert.equal(gain.getAttribute('aria-invalid'), 'false');
    assert.equal(f.ui.root.querySelector('[aria-invalid="true"]'), null);
    if (recovery === 'Use in draft') assert.match(summary(), /1 changes.*Draft$/);
    else assert.match(summary(), /0 changes.*Saved for next flight$/);
    assert.doesNotMatch(summary(), /unfinished values/);
    assert.match(bench.textContent, /Available for this aircraft controller/);
    await f.click('Run simulation bench', bench);
    assert.equal(f.workers.length, 1, 'a valid restored controller can start a comparison');
    assert.equal(f.workers[0].messages[0].request.draft.advanced.controller.gains.roll.p, original);
    assert.equal(f.store.export(), before, 'restoring validity does not persist a new setup');
  });

for (const raw of ['', '-', '1001'])
  test(`refresh preserves genuinely invalid PID text ${JSON.stringify(raw)} and its error`, async (t) => {
    const f = await fixture(t, { physical: true, enableBench: true });
    const gain = f.field('Roll P (N·m/(rad/s))'),
      before = f.store.export();
    f.edit('Roll P (N·m/(rad/s))', raw);
    f.ui.refresh();
    assert.equal(gain.value, raw);
    assert.equal(gain.getAttribute('aria-invalid'), 'true');
    assert.match(
      f.ui.root.querySelector('.workbench-summary').textContent,
      /1 unfinished values.*Draft$/,
    );
    await f.click('Save for next flight');
    await f.click('Run simulation bench', f.ui.root.querySelector('.tuning-bench'));
    assert.equal(f.workers.length, 0);
    assert.equal(f.store.export(), before);
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

const gainLabel = 'Roll P (N·m/(rad/s))';
const inputReviewLabel = 'I checked my input connection, mapping and stick centres';
const practiceConditions = () => ({
  host: 'Regional',
  courseId: 'regional-comparison-course',
  mode: 'acro',
  label: 'Regional · saved launch · Acro',
  input: { source: 'controller', mapping: 'standard-mode-2' },
});
function panelControl(panel, label, tag = 'select') {
  const node = panel
    .querySelectorAll(tag)
    .find((element) => element.parentNode.firstChild?.textContent === label);
  assert.ok(node, `Missing panel control ${label}`);
  return node;
}

test('reusable controller tunes copy explicitly into an undoable draft without saving a setup', async (t) => {
  const f = await fixture(t, { physical: true });
  const tunes = f.ui.root.querySelector('.controller-tune-panel');
  const saved = f.store.export(),
    original = f.store.effective().advanced.controller.gains.roll.p,
    tuned = original * 1.1,
    alternate = original * 1.2;
  f.edit(gainLabel, tuned);
  f.edit('New controller tune name', 'Meteor smooth controller', 'input', tunes);
  await f.click('Save draft as controller tune', tunes);
  const tuneLibrary = JSON.parse(f.data.get(CONTROLLER_TUNE_LIBRARY_KEY));
  assert.equal(tuneLibrary.tunes.length, 1);
  assert.equal(tuneLibrary.tunes[0].controller.gains.roll.p, tuned);
  assert.equal(f.store.export(), saved, 'saving a reusable tune cannot save the setup');
  f.edit(gainLabel, alternate);
  f.edit('Saved controller tune', tuneLibrary.tunes[0].id, 'select', tunes);
  assert.equal(Number(f.field(gainLabel).value), alternate, 'browsing cannot apply a tune');
  await f.click('Use in draft', tunes);
  f.field(gainLabel).focus();
  assert.equal(Number(f.field(gainLabel).value), tuned);
  assert.equal(f.store.export(), saved, 'copying cannot save the setup');
  await f.click('Use in draft', tunes);
  await f.click('Undo last edit');
  assert.equal(Number(f.field(gainLabel).value), alternate, 'same-value copying adds no undo step');
  await f.click('Use in draft', tunes);
  f.edit(gainLabel, original * 0.9);
  assert.deepEqual(JSON.parse(f.data.get(CONTROLLER_TUNE_LIBRARY_KEY)), tuneLibrary);
  await f.click('Undo last edit');
  f.field(gainLabel).focus();
  assert.equal(Number(f.field(gainLabel).value), tuned);
  await f.click('Save for next flight');
  assert.equal(f.store.effective().advanced.controller.gains.roll.p, tuned);
  assert.deepEqual(JSON.parse(f.data.get(CONTROLLER_TUNE_LIBRARY_KEY)), tuneLibrary);
});

test('workbench comparison snapshots stay immutable and only configuration edits cancel their worker', async (t) => {
  const workerURL = new URL('https://example.test/worlds/response-bench-worker.mjs');
  const f = await fixture(t, { physical: true, enableBench: true, workerURL });
  const bench = f.ui.root.querySelector('.tuning-bench'),
    tunes = f.ui.root.querySelector('.controller-tune-panel'),
    saved = f.store.export(),
    original = f.store.effective().advanced.controller.gains.roll.p;
  f.edit(gainLabel, original * 1.1);
  await f.click('Run simulation bench', bench);
  assert.equal(f.workers.length, 1);
  const first = f.workers[0],
    request = first.messages[0],
    frozen = structuredClone(request);
  assert.equal(first.url.href, workerURL.href);
  assert.equal(first.options.type, 'module');
  assert.equal(request.type, 'compare');
  assert.equal(request.request.saved.advanced.controller.gains.roll.p, original);
  assert.equal(request.request.draft.advanced.controller.gains.roll.p, original * 1.1);
  const pitch = f.field('Pitch P (N·m/(rad/s))');
  pitch.focus();
  assert.equal(pitch.value, String(request.request.saved.advanced.controller.gains.pitch.p));
  f.ui.refresh();
  pitch.blur();
  pitch.emit('focusout');
  f.ui.refresh();
  assert.equal(first.terminated, false, 'focus and blur cannot invalidate a running comparison');
  assert.deepEqual(first.messages[0], frozen);
  const lateMessage = [...first.listeners.get('message')][0];
  const notes = panelControl(bench, 'Draft setup: control and comfort', 'textarea');
  notes.value = 'Manual feedback is independent of the running bench.';
  notes.emit('input');
  f.edit('New controller tune name', 'An unsaved library title', 'input', tunes);
  f.edit('Rate profile', 'meteor-rates', 'select');
  f.edit('Aircraft preset', 'air65-ii-racing-2026', 'select');
  assert.equal(
    first.terminated,
    false,
    'notes and browsing cannot cancel the flight configuration',
  );
  assert.deepEqual(first.messages[0], frozen);
  f.edit(gainLabel, original * 1.2);
  assert.equal(first.terminated, true);
  assert.deepEqual(first.messages[0], frozen, 'draft edits cannot mutate a sent worker snapshot');
  lateMessage({ data: { id: request.id, progress: { stage: 'draft', completed: 99, total: 99 } } });
  lateMessage({ data: { id: request.id, result: { status: 'no-clear-improvement' } } });
  await settle();
  assert.doesNotMatch(bench.textContent, /99\/99|No clear improvement/);
  await f.click('Run simulation bench', bench);
  assert.equal(f.workers.length, 2);
  const second = f.workers[1];
  assert.equal(second.messages[0].request.draft.advanced.controller.gains.roll.p, original * 1.2);
  f.ui.close();
  assert.equal(second.terminated, true);
  assert.equal(f.store.export(), saved);
});

test('unfinished physical text cancels comparison and cannot enter a new worker snapshot', async (t) => {
  const f = await fixture(t, { physical: true, enableBench: true });
  const bench = f.ui.root.querySelector('.tuning-bench'),
    original = f.field(gainLabel).value;
  await f.click('Run simulation bench', bench);
  f.edit(gainLabel, '');
  assert.equal(f.workers[0].terminated, true);
  await f.click('Run simulation bench', bench);
  assert.equal(f.workers.length, 1);
  assert.equal(f.field(gainLabel).value, '');
  f.edit(gainLabel, original);
  await f.click('Run simulation bench', bench);
  assert.equal(f.workers.length, 2);
  const axis = panelControl(bench, 'Response axis');
  axis.value = 'yaw';
  axis.emit('change');
  assert.equal(f.workers[1].terminated, true, 'changing bench conditions cancels the old job');
  await f.click('Run simulation bench', bench);
  assert.equal(f.workers[2].messages[0].request.axis, 'yaw');
});

test('saving a shared rate baseline cancels pending comparisons and clears completed results even when the draft is unchanged', async (t) => {
  const f = await fixture(t, {
    physical: true,
    enableBench: true,
    prepare: async (store) => {
      // Complete numerical setups do not require optional catalog/component metadata.
      // Keep the editor signature stable rather than relying on inventory key order.
      const setup = store.snapshot().setups.find((item) => item.id === 'meteor');
      delete setup.preset;
      delete setup.components;
      await store.saveSetup(setup);
    },
  });
  const bench = f.ui.root.querySelector('.tuning-bench');
  f.edit('When saving edited rates', 'update', 'select');
  f.edit('Comparison scope', 'setup', 'select', bench);
  f.edit('Maximum rate (°/s)', '700');
  await f.click('Run simulation bench', bench);
  const pending = f.workers[0],
    oldRequest = pending.messages[0],
    lateMessage = [...pending.listeners.get('message')][0];
  assert.equal(oldRequest.request.saved.response.rates.axes.roll.rate, 60);
  assert.equal(oldRequest.request.draft.response.rates.axes.roll.rate, 70);
  await f.click('Save for next flight');
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 70);
  assert.equal(f.field('Maximum rate (°/s)').value, '700');
  assert.equal(pending.terminated, true, 'saving replaced the baseline of the pending comparison');
  lateMessage({
    data: { id: oldRequest.id, progress: { stage: 'draft', completed: 99, total: 99 } },
  });
  await settle();
  assert.doesNotMatch(bench.textContent, /99\/99/);

  f.edit('Maximum rate (°/s)', '800');
  await f.click('Run simulation bench', bench);
  const completed = f.workers[1],
    request = completed.messages[0];
  assert.equal(request.request.saved.response.rates.axes.roll.rate, 70);
  completed.reply({
    id: request.id,
    result: {
      kind: 'comparison',
      axis: 'roll',
      changedGroups: ['rates'],
      baseline: {
        metrics: { trackingError: 2 },
        trace: [
          { seconds: 0, requested: 0, achieved: 0 },
          { seconds: 3, requested: 70, achieved: 68 },
        ],
      },
      candidate: {
        metrics: { trackingError: 1 },
        trace: [
          { seconds: 0, requested: 0, achieved: 0 },
          { seconds: 3, requested: 80, achieved: 79 },
        ],
      },
    },
  });
  await settle();
  assert.match(bench.textContent, /Comparison complete/);
  assert.ok(bench.querySelector('.tuning-bench-results').children.length);
  await f.click('Save for next flight');
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 80);
  assert.equal(f.field('Maximum rate (°/s)').value, '800');
  assert.doesNotMatch(bench.textContent, /Comparison complete/);
  assert.equal(bench.querySelector('.tuning-bench-results').children.length, 0);
});

test('SIM suggestions require input review for the current input conditions', async (t) => {
  const conditions = practiceConditions();
  const f = await fixture(t, { physical: true, enableBench: true, conditions });
  const bench = f.ui.root.querySelector('.tuning-bench');
  await f.click('Find a SIM tuning suggestion', bench);
  assert.equal(f.workers.length, 0);
  const reviewed = f.field(inputReviewLabel);
  reviewed.checked = true;
  reviewed.emit('change');
  await f.click('Find a SIM tuning suggestion', bench);
  assert.equal(f.workers.length, 1);
  assert.equal(f.workers[0].messages[0].type, 'suggest');
  assert.equal(f.workers[0].messages[0].request.inputReady, true);
  await f.click('Cancel comparison', bench);
  conditions.input.mapping = 'changed-mapping';
  await f.click('Find a SIM tuning suggestion', bench);
  assert.equal(
    f.workers.length,
    1,
    'prior mapping review cannot authorize a new input configuration',
  );
  assert.match(bench.textContent, /Complete the input check first/);
  reviewed.checked = true;
  reviewed.emit('change');
  await f.click('Find a SIM tuning suggestion', bench);
  assert.equal(f.workers.length, 2);
});

test('manual A/B flies the frozen saved and draft pair and returns to the latest unsaved editor', async (t) => {
  const conditions = practiceConditions();
  const f = await fixture(t, { physical: true, conditions });
  const bench = f.ui.root.querySelector('.tuning-bench'),
    saved = f.store.export(),
    original = f.store.effective().advanced.controller.gains.roll.p,
    prepared = original * 1.1,
    later = original * 1.2;
  await f.click('Flight response / PID');
  f.edit(gainLabel, prepared);
  await f.click('Prepare A/B practice', bench);
  assert.match(bench.textContent, /Regional · saved launch · Acro/);
  f.edit(gainLabel, later);
  await f.click('Fly saved setup', bench);
  assert.equal(f.tested.length, 1);
  assert.equal(f.tested[0].advanced.controller.gains.roll.p, original);
  assert.equal(f.ui.root.open, false);
  assert.equal(f.ui.returnButton.hidden, false);
  f.ui.returnButton.click();
  await settle();
  assert.equal(Number(f.field(gainLabel).value), later);
  assert.equal(f.ui.root.querySelector('[data-section="controller"]').hidden, false);
  await f.click('Fly draft setup', bench);
  assert.equal(f.tested.length, 2);
  assert.equal(f.tested[1].advanced.controller.gains.roll.p, prepared);
  f.tested[1].advanced.controller.gains.roll.p = 99;
  f.ui.returnButton.click();
  await settle();
  await f.click('Fly draft setup', bench);
  assert.equal(f.tested[2].advanced.controller.gains.roll.p, prepared);
  f.ui.returnButton.click();
  await settle();
  conditions.mode = 'self-level';
  await f.click('Fly draft setup', bench);
  assert.equal(f.tested.length, 3);
  assert.match(bench.textContent, /Practice or input conditions changed/);
  assert.equal(Number(f.field(gainLabel).value), later);
  assert.equal(f.store.export(), saved);
});

test('manual PID-only comparison rejects camera changes until complete-setup comparison is selected', async (t) => {
  const f = await fixture(t, { physical: true, conditions: practiceConditions() });
  const bench = f.ui.root.querySelector('.tuning-bench');
  f.edit('Camera tilt (degrees)', 27);
  await f.click('Prepare A/B practice', bench);
  assert.match(bench.textContent, /PID comparison changes controller settings only/);
  await f.click('Fly draft setup', bench);
  assert.equal(f.tested.length, 0);
  const scope = panelControl(bench, 'Comparison scope');
  scope.value = 'setup';
  scope.emit('change');
  await f.click('Prepare A/B practice', bench);
  assert.match(bench.textContent, /Changed groups: camera/);
  await f.click('Fly draft setup', bench);
  assert.equal(f.tested[0].camera.tilt, 27);
});

test('SIM reduced effects and system reduced motion each pause commanded rotation without changing rates', async (t) => {
  const f = await fixture(t, { physical: true });
  await f.click('Rates & throttle');
  const motion = f.field('Animate rotation preview');
  motion.checked = true;
  motion.emit('change');
  const quad = f.ui.root.querySelector('.tuning-quad'),
    saved = f.store.export();
  f.frame(0);
  f.frame(50);
  const running = quad.style.transform;
  assert.notEqual(running, 'rotateY(0deg)');
  f.document.body.dataset.effects = 'reduced';
  f.frame(100);
  f.frame(150);
  assert.equal(quad.style.transform, running, 'SIM preference stops frame-driven rotation');
  f.document.body.dataset.effects = 'full';
  f.window.matchMedia = () => ({ matches: true });
  f.frame(200);
  assert.equal(quad.style.transform, running, 'system preference independently stops rotation');
  f.window.matchMedia = () => ({ matches: false });
  f.frame(250);
  assert.notEqual(quad.style.transform, running);
  assert.equal(f.store.export(), saved);
});

test('Airmode-only customizations remain visible in Basic after save and can be undone to defaults', async (t) => {
  const f = await fixture(t, { physical: true });
  await f.click('Aircraft');
  const airmode = f.field('Airmode · retain rotation authority at low throttle'),
    physical = airmode.closest('fieldset'),
    original = airmode.checked;
  assert.equal(physical.hidden, true);
  await f.click('Expert');
  airmode.checked = !original;
  airmode.emit('change');
  await f.click('Basic');
  assert.equal(airmode.parentNode.dataset.customized, 'true');
  assert.equal(physical.hidden, false, 'a checkbox-only customization discloses its group');
  await f.click('Undo last edit');
  assert.equal(airmode.checked, original);
  assert.equal(physical.hidden, true, 'undo clears customization disclosure');
  await f.click('Expert');
  airmode.checked = !original;
  airmode.emit('change');
  await f.click('Basic');
  await f.click('Save for next flight');
  assert.equal(f.store.effective().advanced.aircraft.propulsion.airmode, !original);
  f.ui.close();
  f.ui.open();
  await f.click('Aircraft');
  assert.equal(airmode.checked, !original);
  assert.equal(physical.hidden, false, 'saved customization remains discoverable on reopening');
  airmode.checked = original;
  airmode.emit('change');
  assert.equal(physical.hidden, true, 'returning to aircraft defaults removes stale disclosure');
});

test('Basic never hides a focused customized control while it is being restored to its default', async (t) => {
  const f = await fixture(t, { physical: true });
  await f.click('Flight response / PID');
  await f.click('Expert');
  const gain = f.field('Roll P (N·m/(rad/s))'),
    row = gain.closest('.workbench-physical-field'),
    original = String(f.store.effective().advanced.controller.gains.roll.p);
  f.edit('Roll P (N·m/(rad/s))', Number(original) * 1.1);
  await f.click('Basic');
  gain.focus();
  f.edit('Roll P (N·m/(rad/s))', original);
  assert.equal(row.dataset.customized, 'false');
  assert.equal(row.hidden, false, 'editing to the default cannot remove the focused field');
  assert.equal(f.document.activeElement, gain);
  f.field('Search all settings').focus();
  f.ui.refresh();
  assert.equal(row.hidden, true, 'ordinary refresh conceals it after focus moves elsewhere');
});

test('saved configuration stays next-flight-only until Apply & restart uses it', async (t) => {
  let flight = null;
  const f = await fixture(t, {
    physical: true,
    getFlightConfiguration: () => flight,
    onApply: (configuration) => {
      flight = structuredClone(configuration);
    },
  });
  flight = JSON.parse(canonicalJSON(f.store.effective()));
  const originalFlight = structuredClone(flight);
  const summary = () => f.ui.root.querySelector('.workbench-summary').textContent;
  f.ui.refresh();
  assert.match(summary(), /Used by this flight$/, 'storage key order does not change ownership');
  f.edit('Camera tilt (degrees)', 25);
  assert.match(summary(), /Draft$/);
  await f.click('Save for next flight');
  assert.match(summary(), /Saved for next flight$/);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Saved for the next flight/);
  assert.deepEqual(flight, originalFlight, 'saving never changes the running attempt');
  f.ui.close();
  f.ui.open();
  assert.match(summary(), /Saved for next flight$/);
  await f.click('Apply & restart');
  assert.equal(flight.camera.tilt, 25);
  f.ui.open();
  assert.match(summary(), /Used by this flight$/);
  assert.doesNotMatch(
    f.ui.root.querySelector('[role="status"]').textContent,
    /current attempt keeps its original configuration/,
    'the previous save confirmation cannot contradict the newly restarted flight',
  );
  f.edit('Camera tilt (degrees)', '');
  assert.match(summary(), /unfinished values.*Draft$/);
  assert.equal(flight.camera.tilt, 25, 'unfinished edits remain separate from the active flight');
  await f.click('Save for next flight');
  const failure = f.ui.root.querySelector('[role="status"]').textContent;
  assert.match(failure, /Camera tilt.*enter a value/);
  f.ui.close();
  f.ui.open({ keepDraft: true });
  assert.equal(f.ui.root.querySelector('[role="status"]').textContent, failure);
});

test('no-op saves and later launches report the actual frozen flight configuration', async (t) => {
  let flight = null;
  const f = await fixture(t, { getFlightConfiguration: () => flight });
  const summary = () => f.ui.root.querySelector('.workbench-summary').textContent;
  flight = f.store.effective();
  f.ui.refresh();
  await f.click('Save for next flight');
  assert.match(summary(), /Used by this flight$/, 'an unchanged save is already active');
  f.edit('Maximum rate (°/s)', 360);
  await f.click('Save for next flight');
  assert.match(summary(), /Saved for next flight$/);
  flight = f.store.effective();
  f.ui.refresh();
  assert.match(
    summary(),
    /Used by this flight$/,
    'a launch outside the workbench activates the saved configuration',
  );
  flight = null;
  f.ui.refresh();
  assert.match(summary(), /Saved for next flight$/, 'without a flight no configuration is active');
});

test('rate curve pointer inspection compares saved and draft values at the responsive plot position', async (t) => {
  const f = await fixture(t);
  await f.click('Rates & throttle');
  f.edit('Maximum rate (°/s)', 360);
  const chart = f.ui.root.querySelector('[aria-label="Rate curves: zero to full stick"]');
  chart._rect = { x: 10, y: 20, width: 300, height: 122.5 };
  const state = f.store.export();
  const draftSummary = f.ui.root.querySelector('.workbench-summary').textContent;
  const inspection = () => chart.querySelector('[data-curve-inspection]');
  const readout = () => f.ui.root.querySelector('[aria-label="Inspected rate"]').textContent;
  assert.equal(
    chart.nextSibling,
    f.ui.root.querySelector('[aria-label="Inspected rate"]'),
    'saved/draft inspection remains immediately beside the graph being pointed at',
  );
  assert.equal(f.ui.root.querySelectorAll('[aria-label="Inspected rate"]').length, 1);
  let escaped = 0;
  f.document.body.addEventListener('pointermove', () => escaped++);
  chart.emit('pointermove', { clientX: 292, pointerType: 'mouse', buttons: 0, isPrimary: true });
  assert.equal(f.field('Preview stick position · exact (%)').value, '100');
  assert.equal(readout(), '100% · Roll · Saved 240.0 °/s · Draft 360.0 °/s');
  assert.equal(inspection().querySelector('line').getAttribute('x1'), '564');
  assert.equal(inspection().querySelectorAll('circle').length, 6);
  assert.match(inspection().textContent, /Roll saved: 240\.0 °\/s/);
  assert.match(inspection().textContent, /Roll draft: 360\.0 °\/s/);
  chart.emit('pointermove', { clientX: 164, pointerType: 'mouse', buttons: 0, isPrimary: true });
  assert.equal(f.field('Preview stick position · exact (%)').value, '50');
  assert.equal(inspection().querySelector('line').getAttribute('x1'), '308');
  assert.equal(escaped, 0, 'chart pointer events stay inside the paused editor');
  const roll = f.field('Roll');
  roll.checked = false;
  roll.emit('change');
  assert.equal(inspection().querySelectorAll('circle').length, 4);
  assert.doesNotMatch(inspection().textContent, /Roll/);
  f.edit('Preview stick position · exact (%)', -50);
  assert.match(readout(), /^-50% · Roll · Saved -[\d.]+ °\/s · Draft -[\d.]+ °\/s$/);
  assert.equal(inspection().querySelector('line').getAttribute('x1'), '308');
  assert.equal(f.store.export(), state);
  assert.equal(f.ui.root.querySelector('.workbench-summary').textContent, draftSummary);
  assert.equal(f.tested.length, 0);
});

test('touch curve inspection owns one pointer and releases it on cancellation, hiding and close', async (t) => {
  const f = await fixture(t);
  await f.click('Rates & throttle');
  const chart = f.ui.root.querySelector('[aria-label="Rate curves: zero to full stick"]');
  // A wider SVG element letterboxes its centered viewBox; pointer mapping
  // must use the plotted coordinates instead of the full element width.
  chart._rect = { x: 10, y: 20, width: 400, height: 122.5 };
  const exact = f.field('Preview stick position · exact (%)');
  const down = () =>
    chart.emit('pointerdown', {
      clientX: 214,
      pointerType: 'touch',
      pointerId: 7,
      isPrimary: true,
      button: 0,
      buttons: 1,
    });
  assert.equal(down().defaultPrevented, true);
  assert.equal(exact.value, '50');
  assert.equal(chart.hasPointerCapture(7), true);
  chart.emit('pointermove', { clientX: 0, pointerId: 8, pointerType: 'touch', buttons: 1 });
  assert.equal(exact.value, '50', 'a second touch cannot take over');
  chart.emit('pointermove', { clientX: 10000, pointerId: 7, pointerType: 'touch', buttons: 1 });
  assert.equal(exact.value, '100', 'captured dragging clamps to the plotted range');
  chart.emit('pointercancel', { pointerId: 7 });
  assert.equal(chart.hasPointerCapture(7), false);
  chart.emit('pointermove', { clientX: 0, pointerId: 7, pointerType: 'touch', buttons: 0 });
  assert.equal(exact.value, '100', 'touch needs a new explicit press after cancellation');
  down();
  await f.click('Overview');
  assert.equal(chart.hasPointerCapture(7), false);
  chart.emit('pointermove', { clientX: 0, pointerType: 'mouse', buttons: 0 });
  assert.equal(exact.value, '50', 'hidden charts do not inspect input');
  await f.click('Rates & throttle');
  down();
  f.document.hidden = true;
  f.document.emit('visibilitychange');
  assert.equal(chart.hasPointerCapture(7), false);
  f.document.hidden = false;
  down();
  const disclosure = chart.closest('details');
  disclosure.open = false;
  disclosure.emit('toggle');
  assert.equal(chart.hasPointerCapture(7), false);
  disclosure.open = true;
  down();
  f.ui.close();
  assert.equal(chart.hasPointerCapture(7), false);
  chart.emit('pointerdown', { clientX: 0, pointerId: 7, pointerType: 'touch', button: 0 });
  assert.equal(chart.hasPointerCapture(7), false, 'closed editors cannot acquire pointer input');
});
