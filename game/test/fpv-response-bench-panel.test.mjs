import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountResponseBenchPanel } from '../../optional-practice/civilian-fpv/response-bench-panel.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

const config = () => createPresetConfiguration('meteor75-analog-2022');
const copy = (value) => structuredClone(value);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const metrics = () => ({
  trackingError: 2,
  riseTimeSeconds: 0.2,
  settlingTimeSeconds: 0.4,
  releaseSettlingTimeSeconds: 0.3,
  overshootRate: 1,
  crossAxisRate: 0.1,
  saturationSeconds: 0.002,
  controlEffort: 0.000001,
});
const comparison = () => ({
  kind: 'comparison',
  axis: 'roll',
  changedGroups: ['controller'],
  baseline: {
    metrics: metrics(),
    trace: [
      { seconds: 0, requested: 0, achieved: 0 },
      { seconds: 3, requested: 100, achieved: 101 },
    ],
  },
  candidate: {
    metrics: { ...metrics(), trackingError: 1 },
    trace: [
      { seconds: 0, requested: 0, achieved: 0 },
      { seconds: 3, requested: 100, achieved: 100 },
    ],
  },
});
function fixture(t, { ready = true, storageFailure = false } = {}) {
  const document = new Document(),
    window = new Events(),
    data = new Map(),
    jobs = [],
    applied = [],
    errors = [],
    flights = [];
  document.createElementNS = (_namespace, tag) => document.createElement(tag);
  const saved = config(),
    draft = config();
  const conditions = {
    label: 'Hover course · Acro',
    course: 'hover',
    mode: 'acro',
    inputSource: 'keyboard',
  };
  let currentLocale = 'en',
    cancelled = 0,
    disposed = false,
    clientOptions;
  window.Worker = class {};
  window.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (storageFailure) throw new Error('quota');
      data.set(key, value);
    },
  };
  const fakeClient = {
    compare: (request, options) =>
      new Promise((resolve, reject) => jobs.push({ request, options, resolve, reject })),
    suggest: (request, options) =>
      new Promise((resolve, reject) => jobs.push({ request, options, resolve, reject })),
    cancel: () => {
      cancelled++;
    },
    dispose: () => {
      disposed = true;
    },
  };
  const panel = mountResponseBenchPanel({
    document,
    window,
    locale: () => currentLocale,
    getSaved: () => saved,
    getDraft: () => draft,
    getInputReadiness: () => ({ ready, summary: 'Keyboard' }),
    onUse: (value) => applied.push(value),
    report: (error) => errors.push(error),
    workerURL: new URL('https://example.com/worlds/response-bench-worker.mjs'),
    createClient: (options) => {
      clientOptions = options;
      return fakeClient;
    },
    getPracticeConditions: () => conditions,
    onManualTest: (value, context) => flights.push({ value, context }),
  });
  document.body.append(panel.root);
  t.after(() => panel.dispose());
  const button = (text) => {
    const found = panel.root.querySelectorAll('button').find((node) => node.textContent === text);
    assert.ok(found, `Missing button ${text}`);
    return found;
  };
  return {
    panel,
    window,
    saved,
    draft,
    jobs,
    applied,
    errors,
    flights,
    data,
    conditions,
    button,
    get clientOptions() {
      return clientOptions;
    },
    get cancelled() {
      return cancelled;
    },
    get disposed() {
      return disposed;
    },
    async click(text) {
      button(text).emit('click');
      await flush();
    },
    locale(value) {
      currentLocale = value;
      panel.refresh();
    },
  };
}

test('panel runs only explicit jobs with frozen draft data and World worker URL', async (t) => {
  const f = fixture(t);
  assert.equal(f.jobs.length, 0);
  await f.click('Run simulation bench');
  assert.equal(f.jobs.length, 1);
  assert.equal(f.clientOptions.url.href, 'https://example.com/worlds/response-bench-worker.mjs');
  const job = f.jobs[0];
  f.draft.controller.gains.roll.p = 2;
  assert.notEqual(job.request.draft.controller.gains.roll.p, 2);
  job.options.onProgress({ stage: 'draft', completed: 1, total: 2 });
  assert.match(f.panel.root.textContent, /Measuring draft · 1\/2/);
  job.resolve(comparison());
  await flush();
  assert.match(f.panel.root.textContent, /Changed groups: controller/);
  assert.match(f.panel.root.textContent, /0.002 s/);
  assert.equal(f.panel.root.querySelectorAll('svg').length, 1);
  assert.equal(f.applied.length, 0);
  assert.equal(f.data.size, 0);
});

test('edit invalidation and close ignore late results and progress even from a non-cooperative client', async (t) => {
  const f = fixture(t);
  await f.click('Run simulation bench');
  const old = f.jobs[0];
  f.panel.invalidate();
  old.options.onProgress({ stage: 'draft', completed: 1, total: 2 });
  old.resolve(comparison());
  await flush();
  assert.doesNotMatch(f.panel.root.textContent, /Changed groups: controller|Measuring draft/);
  assert.equal(f.panel.root.querySelectorAll('svg').length, 0);
  assert.ok(f.cancelled > 0);
  await f.click('Run simulation bench');
  const closing = f.jobs[1];
  f.panel.dispose();
  closing.resolve(comparison());
  await flush();
  assert.equal(f.disposed, true);
  assert.equal(f.panel.root.querySelectorAll('svg').length, 0);
});

test('input readiness gates suggestions and changing language preserves selects and notes', async (t) => {
  const f = fixture(t, { ready: false });
  assert.equal(f.button('Find a SIM tuning suggestion').disabled, true);
  assert.equal(f.button('Run simulation bench').disabled, false);
  await f.click('Find a SIM tuning suggestion');
  assert.equal(f.jobs.length, 0);
  const fields = f.panel.root.querySelectorAll('textarea');
  fields[0].value = 'Keep my notes';
  f.locale('uk');
  assert.equal(f.panel.root.querySelectorAll('select').length, 2);
  assert.equal(f.panel.root.querySelectorAll('textarea').length, 2);
  assert.equal(fields[0].value, 'Keep my notes');
  assert.match(f.panel.root.textContent, /Перед порадою з налаштування/);
  assert.equal(f.button('Знайти пораду для налаштування SIM').disabled, true);
});

test('suggestions show exact gains and require selection before copying into the draft', async (t) => {
  const f = fixture(t),
    controller = copy(f.draft.controller);
  const previous = controller.gains.roll.p,
    value = previous * 1.1;
  controller.gains.roll.p = value;
  await f.click('Find a SIM tuning suggestion');
  f.jobs[0].resolve({
    kind: 'suggestions',
    status: 'suggestions',
    suggestions: [
      {
        axis: 'roll',
        gain: 'p',
        previous,
        value,
        multiplier: 1.1,
        controller,
        fittingBaseline: metrics(),
        fit: { metrics: metrics() },
        validation: [
          {
            testCase: { shape: 'step', direction: -1, throttle: 0.25 },
            baseline: metrics(),
            candidate: metrics(),
          },
        ],
      },
    ],
  });
  await flush();
  assert.equal(f.applied.length, 0);
  assert.match(
    f.panel.root.textContent,
    new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
  assert.match(f.panel.root.textContent, /Validation cases and tradeoffs/);
  await f.click('Use suggestion in draft');
  assert.deepEqual(f.applied[0], controller);
  f.applied[0].gains.roll.p = 7;
  assert.equal(controller.gains.roll.p, value);
  assert.equal(f.data.size, 0);
});

test('manual A/B freezes both configurations and persists notes without saving setups', async (t) => {
  const f = fixture(t);
  f.draft.controller.gains.roll.p *= 1.1;
  const frozen = copy(f.draft);
  await f.click('Prepare A/B practice');
  assert.match(f.panel.root.textContent, /Changed groups: controller/);
  assert.match(f.panel.root.textContent, /Hover course · Acro/);
  f.draft.controller.gains.roll.p = 5;
  await f.click('Fly draft setup');
  assert.deepEqual(f.flights[0].value, frozen);
  assert.equal(f.flights[0].context.variant, 'draft');
  await f.click('Fly saved setup');
  assert.deepEqual(f.flights[0].context.conditions, f.flights[1].context.conditions);
  const notes = f.panel.root.querySelectorAll('textarea');
  notes[0].value = 'Calm around center';
  notes[1].value = 'Better control';
  await f.click('Save comparison notes on this device');
  assert.equal(f.data.size, 1);
  const stored = JSON.parse([...f.data.values()][0]);
  assert.equal(stored.format, 'FpvManualComparisonNotes.v1');
  assert.equal(stored.entries[0].draft, 'Better control');
  assert.equal(f.applied.length, 0);
});

test('manual comparisons identify broader changes and storage failure retains visible notes', async (t) => {
  const f = fixture(t, { storageFailure: true });
  f.draft.camera.tilt++;
  await f.click('Prepare A/B practice');
  assert.match(f.panel.root.textContent, /Choose Compare complete setups/);
  assert.equal(f.button('Fly draft setup').disabled, true);
  const scope = f.panel.root.querySelectorAll('select')[0];
  scope.value = 'setup';
  scope.emit('change');
  await f.click('Prepare A/B practice');
  assert.match(f.panel.root.textContent, /Changed groups: camera/);
  const note = f.panel.root.querySelectorAll('textarea')[0];
  note.value = 'Still here';
  await f.click('Save comparison notes on this device');
  assert.equal(note.value, 'Still here');
  assert.match(f.panel.root.textContent, /Notes could not be saved/);
  assert.equal(f.data.size, 0);
});

test('manual A/B rejects changed host or input conditions before launching either frozen setup', async (t) => {
  const f = fixture(t);
  await f.click('Prepare A/B practice');
  f.conditions.course = 'another-course';
  await f.click('Fly saved setup');
  assert.equal(f.flights.length, 0);
  assert.match(f.panel.root.textContent, /Practice or input conditions changed/);
  await f.click('Prepare A/B practice');
  f.conditions.inputSource = 'controller';
  await f.click('Fly draft setup');
  assert.equal(f.flights.length, 0);
  await f.click('Prepare A/B practice');
  await f.click('Fly draft setup');
  assert.equal(f.flights.length, 1);
  assert.equal(f.flights[0].context.conditions.inputSource, 'controller');
});
