import test from 'node:test';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { sourceSimGlobalTools, menuPad } from './helpers/global-tools-fixture.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { mountFlightApp } from '../../optional-practice/civilian-fpv/app.mjs';
import {
  createFlightInput,
  createFlightGamepad,
  createFlightInputDiagnostics,
} from '../../optional-practice/civilian-fpv/input.mjs';
import { createFlightRenderer } from '../../optional-practice/civilian-fpv/renderer.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { replayFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import {
  createFlightProfileStore,
  defaultRadioProfile,
  radioDeviceIdentity,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { mountFlightNotebook } from '../../optional-practice/civilian-fpv/notebook.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const html = parse(
  await readFile(
    new URL('../../optional-practice/civilian-fpv/index.html', import.meta.url),
    'utf8',
  ),
);
async function fixture(
  t,
  {
    available = true,
    storage,
    url = 'https://example.test/optional-practice/civilian-fpv/?lang=en',
    serviceWorker,
    home = false,
    blurOnTitleMount = false,
    windowOptions = {},
    ...factories
  } = {},
) {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    deliveries = [],
    renders = [];
  doc.createElementNS = (_namespace, name) => doc.createElement(name);
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  function copy(source, parent) {
    if (!source.tagName) return;
    const element = doc.createElement(source.tagName);
    for (const attribute of source.attrs ?? []) {
      element.setAttribute(attribute.name, attribute.value);
      if (attribute.name === 'hidden') element.hidden = true;
      if (attribute.name === 'class') element.className = attribute.value;
      if (attribute.name === 'value') element.value = attribute.value;
      if (attribute.name === 'min' || attribute.name === 'max')
        element[attribute.name] = attribute.value;
    }
    parent.append(element);
    for (const child of source.childNodes ?? []) copy(child, element);
    if (source.tagName === 'select') element.value = element.children[0]?.value ?? '';
  }
  for (const child of body.childNodes) copy(child, doc.body);
  const originalSettingsControls = [
    ...doc.querySelector('.academy-input-controls').querySelectorAll('button,select,input'),
    ...doc.querySelector('.academy-options-panel').querySelectorAll('button,select,input'),
    doc.getElementById('language'),
  ].filter((node) => node.id !== 'academy-close-options');
  let id = 0,
    now = 0,
    lost,
    disposed = false,
    pads = [];
  Object.assign(win, {
    location: new URL(url),
    performance: { now: () => 0 },
    navigator: { getGamepads: () => pads, ...(serviceWorker ? { serviceWorker } : {}) },
    requestAnimationFrame: (fn) => {
      frames.set(++id, fn);
      return id;
    },
    cancelAnimationFrame: (key) => frames.delete(key),
    matchMedia: () => ({ matches: false }),
    // Fullscreen observes the native setup button. These flight-domain tests
    // do not synthesize attribute mutations; provide its browser lifecycle API.
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout: (fn) => fn(),
    URL: { createObjectURL: () => 'blob:flight-test', revokeObjectURL() {} },
    ...windowOptions,
  });
  Object.defineProperty(win, 'localStorage', {
    get() {
      if (storage) return storage;
      throw new Error('No persistent test storage');
    },
  });
  if (blurOnTitleMount) {
    const createElement = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const node = createElement(tag);
      if (tag === 'dialog') {
        const showModal = node.showModal;
        node.showModal = function () {
          showModal.call(this);
          if (blurOnTitleMount && this.id === 'academy-shell-home-dialog') {
            blurOnTitleMount = false;
            win.emit('blur');
          }
        };
      }
      return node;
    };
  }
  const view = mountFlightApp({
    document: doc,
    window: win,
    onAttempt: (result) => deliveries.push(result),
    rendererFactory: (options) => {
      lost = options.onContextLost;
      return {
        available,
        setCourse() {},
        setPath() {},
        draw: (state) => renders.push(state),
        dispose() {
          disposed = true;
        },
      };
    },
    ...factories,
  });
  t.after(() => view.dispose());
  await view.settled();
  // Existing flight-domain tests enter the prepared, disarmed scene explicitly.
  // Title-shell regressions opt in to retaining the initial menu.
  if (!home) doc.getElementById('academy-shell-home-dialog').close();
  return {
    doc,
    win,
    view,
    deliveries,
    originalSettingsControls,
    renders,
    frames,
    contextLoss: () => lost(),
    rendererDisposed: () => disposed,
    setPads(value) {
      pads = value;
    },
    tick(count = 1, elapsed = 20) {
      for (let i = 0; i < count; i++) {
        const [key, callback] = frames.entries().next().value;
        frames.delete(key);
        callback(now);
        now += elapsed;
      }
    },
    jump(milliseconds) {
      now += milliseconds;
    },
    key(code, type = 'keydown') {
      win.emit(type, { code, target: doc.activeElement, repeat: false });
    },
    $: (id) => doc.getElementById(id),
  };
}
function radioProfile(pad) {
  return {
    format: 'RadioProfile.v1',
    id: 'test-usb',
    name: 'Synthetic test radio',
    device: radioDeviceIdentity(pad),
    stickMode: 2,
    throttleStyle: 'full-travel',
    verified: true,
    channels: Object.fromEntries(
      ['roll', 'pitch', 'yaw', 'throttle'].map((key, axis) => [
        key,
        {
          axis,
          min: -1,
          max: 1,
          center: key === 'throttle' ? null : 0,
          invert: false,
          deadZone: 0,
        },
      ]),
    ),
    switches: { arm: null, pause: null, reset: null },
  };
}

test('Academy prepares a saved aircraft and waits for a pending flight step before explicit resume', async (t) => {
  const [tuning, presets, workers] = await Promise.all([
    import('../../optional-practice/civilian-fpv/tuning-library.mjs'),
    import('../../optional-practice/civilian-fpv/aircraft-presets.mjs'),
    import('../../optional-practice/civilian-fpv/advanced-worker.mjs'),
  ]);
  const data = new Map(),
    storage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    };
  const library = tuning.createTuningLibraryStore({ storage });
  await library.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'whoop',
    profileId: 'whoop-rates',
    rates: 'defaults',
  });
  let worker;
  class Worker extends Events {
    constructor() {
      super();
      worker = this;
      this.closed = false;
      this.handler = workers.createAdvancedWorkerHandler((data) => {
        if (!this.closed) this.emit('message', { data });
      });
    }
    postMessage(value) {
      if (this.holdStep && ['step', 'propose'].includes(value.type)) {
        this.pendingStep = value;
        return;
      }
      void this.handler.receive(value).finally(() => {
        if (this.closed) this.handler.dispose();
      });
    }
    terminate() {
      this.closed = true;
      this.handler.dispose();
    }
  }
  let shownAircraft;
  const h = await fixture(t, {
    storage,
    windowOptions: { Worker, setTimeout, clearTimeout },
    rendererFactory: () => ({
      available: true,
      setCourse() {},
      setPath() {},
      setAircraft(value) {
        shownAircraft = structuredClone(value);
      },
      draw() {},
      dispose() {},
    }),
  });
  const preset = presets.createPresetConfiguration('meteor75-analog-2022');
  assert.equal(h.view.snapshot().reason, 'prepared');
  assert.equal(h.view.snapshot().advancedTelemetry.frequency, 500);
  assert.deepEqual(shownAircraft.geometry, preset.aircraft.geometry);
  assert.match(h.doc.body.textContent, /All courses remain available in practice/);
  assert.equal(h.doc.querySelector('.aircraft-practice-controls').hidden, false);
  h.$('arm').click();
  for (let tick = 0; tick < 8; tick++) {
    h.tick();
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(h.view.snapshot().ticks > 0);
  assert.equal(h.view.snapshot().advancedTelemetry.usedAh, 0);
  h.key('KeyW');
  h.key('ArrowRight');
  worker.holdStep = true;
  h.tick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(worker.pendingStep);
  h.view.pause();
  assert.equal(h.view.arm(), false);
  assert.equal(h.view.snapshot().status, 'paused');
  assert.match(h.$('status').textContent, /Finishing the current flight step/);
  worker.holdStep = false;
  worker.postMessage(worker.pendingStep);
  await new Promise((resolve) => setImmediate(resolve));
  const paused = h.view.snapshot();
  assert.ok(paused.lastInput.throttle > 0);
  assert.equal(paused.status, 'paused', 'worker completion cannot arm on its own');
  assert.equal(h.view.arm(), true);
  for (let tick = 0; tick < 3; tick++) {
    h.tick();
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(h.view.snapshot().lastInput.throttle, paused.lastInput.throttle);
  for (const axis of ['roll', 'pitch', 'yaw']) assert.equal(h.view.snapshot().lastInput[axis], 0);
  const challengeKind = h.doc.querySelector('[data-aircraft-challenge="kind"]'),
    challengeDuration = h.doc.querySelector('[data-aircraft-challenge="duration"]'),
    challengeRestart = h.doc.querySelector('[data-aircraft-challenge="restart"]');
  assert.equal(h.view.snapshot().challenge, undefined);
  for (const kind of ['timed-practice', 'battery-endurance', 'none']) {
    h.view.pause();
    challengeKind.value = kind;
    challengeKind.emit('change');
    challengeDuration.value = '30';
    challengeDuration.emit('input');
    challengeRestart.click();
    await new Promise((resolve) => setImmediate(resolve));
    await h.view.settled();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(challengeRestart.disabled, false);
    assert.equal(h.view.snapshot().ticks, 0);
    assert.equal(shownAircraft.battery.depletion, kind === 'battery-endurance');
    assert.equal(h.view.snapshot().advancedTelemetry.usedAh, 0);
    assert.equal(h.view.snapshot().challenge?.missionTick, kind === 'none' ? undefined : 0);
    h.$('arm').click();
    for (let tick = 0; tick < 8; tick++) {
      h.tick();
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.ok(h.view.snapshot().ticks > 0);
    assert.equal(h.view.snapshot().advancedTelemetry.usedAh > 0, kind === 'battery-endurance');
    const recorded = await h.view.exportRecording();
    assert.equal(recorded.config.configuration.challenge?.kind, kind === 'none' ? undefined : kind);
  }
  assert.equal(library.effective().advanced.aircraft.battery.depletion, false);
  for (const [action, fov] of [
    ['Apply & restart', '106'],
    ['Test draft · unscored', '108'],
  ]) {
    h.view.pause();
    h.$('academy-shell-action-settings').click();
    const settings = h.$('academy-shell-settings-dialog');
    assert.equal(settings.open, true);
    await openAcademyTuning(h);
    const camera = academyTuningControl(h, 'Vertical FOV (degrees)');
    camera.value = fov;
    camera.emit('input');
    await academyTuningClick(h, action);
    await h.view.settled();
    assert.equal(h.doc.querySelector('.fpv-tuning').open, false, action);
    assert.equal(settings.open, false, `${action} must leave Settings before flight`);
    assert.equal(h.view.snapshot().reason, 'prepared', action);
    assert.equal(h.view.snapshot().ticks, 0, action);
    h.$('arm').click();
    for (let tick = 0; tick < 8; tick++) {
      h.tick();
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.ok(h.view.snapshot().ticks > 0, `${action} must allow arming from the flight button`);
  }
});

test('SIM world selection freezes on first arm and applies queued preference only on reset', async (t) => {
  const h = await fixture(t);
  const select = h.$('sim-appearance-world');
  select.value = 'industrial-workshop';
  select.emit('change');
  assert.equal(h.view.appearance().accepted.collectionId, 'industrial-workshop');
  await h.view.settled();
  assert.equal(h.view.arm(), true);
  h.view.pause();
  select.value = 'authored';
  select.emit('change');
  assert.equal(h.view.appearance().accepted.collectionId, 'industrial-workshop');
  assert.equal(h.view.appearance().pending, true);
  assert.equal(h.view.appearance().appearance.collectionId, 'authored');
  const saved = h.view.exportRecording();
  assert.equal(saved.presentation.collectionId, 'industrial-workshop');
  assert.deepEqual(saved.proof, h.view.exportAttempt());
  h.view.reset();
  assert.equal(h.view.appearance().accepted.collectionId, 'authored');
  assert.equal(h.view.appearance().pending, false);
});

test('a superseded appearance preparation cannot arm or overwrite the newer flight appearance', async (t) => {
  const preparations = [];
  let initial = true;
  const h = await fixture(t, {
    rendererFactory: () => ({
      available: true,
      setCourse() {},
      prepare({ signal }) {
        if (initial) {
          initial = false;
          return true;
        }
        return new Promise((resolve) => preparations.push({ signal, resolve }));
      },
      dispose() {},
    }),
  });
  const select = h.$('sim-appearance-world');
  select.value = 'industrial-workshop';
  select.emit('change');
  assert.equal(h.view.arm(), false, 'graphics must be ready before the first arm');
  select.value = 'dos';
  select.emit('change');
  assert.equal(preparations[0].signal.aborted, true);
  preparations[1].resolve(true);
  await h.view.settled();
  assert.equal(h.view.appearance().accepted.collectionId, 'dos');
  assert.equal(h.view.arm(), true);
  preparations[0].resolve(true);
  await Promise.resolve();
  assert.equal(h.view.exportRecording().presentation.collectionId, 'dos');
  assert.equal(h.view.snapshot().status, 'active');
});

test('unavailable recorded appearance remains visible after graphics preparation without altering its proof', async (t) => {
  const h = await fixture(t);
  const proof = FLIGHT_DEMONSTRATIONS[0];
  const recording = {
    format: 'FlightRecording.v1',
    proof: structuredClone(proof),
    presentation: { collectionId: 'industrial-workshop', revision: 'missing-r2' },
  };
  await h.view.review(recording);
  assert.match(h.$('status').textContent, /Recorded appearance unavailable/);
  assert.deepEqual(recording.proof, proof);
  assert.equal(h.view.appearance().accepted.revision, 'missing-r2');
  assert.equal(h.view.exportAttempt().frames.length, 0);
  assert.deepEqual(h.deliveries, []);
});

test('Academy explicit keyboard resume keeps consumed throttle and releases held keys', async (t) => {
  for (const action of ['button', 'shortcut'])
    await t.test(action, async (t) => {
      const h = await fixture(t);
      h.$('arm').click();
      h.key('KeyW');
      h.key('ArrowRight');
      h.tick(12);
      const before = h.view.snapshot();
      assert.ok(before.lastInput.throttle > 0);
      if (action === 'button') h.$('pause').click();
      else h.key('KeyP');
      h.tick(3);
      assert.equal(h.view.snapshot().ticks, before.ticks, 'pause consumes no input or time');
      h.win.emit('keydown', { code: 'KeyW', target: h.$('viewport'), repeat: true });
      if (h.$('academy-shell-pause-dialog').open)
        h.$('academy-shell-pause-dialog').emit('cancel', { bubbles: false });
      assert.equal(h.view.snapshot().status, 'paused', 'closing a menu never resumes');
      if (action === 'shortcut') {
        h.key('KeyP');
        if (h.$('academy-shell-pause-dialog').open)
          h.$('academy-shell-pause-dialog').emit('cancel', { bubbles: false });
      }
      h.$('academy-flight-resume').click();
      h.tick(3);
      assert.deepEqual(h.view.snapshot().lastInput, {
        roll: 0,
        pitch: 0,
        yaw: 0,
        throttle: before.lastInput.throttle,
      });
      h.view.pause();
      h.win.emit('blur');
      h.win.emit('focus');
      h.$('arm').click();
      h.tick(3);
      assert.equal(
        h.view.snapshot().lastInput.throttle,
        0,
        'focus loss invalidates resume throttle',
      );
      h.$('reset').click();
      h.$('arm').click();
      h.tick(3);
      assert.equal(h.view.snapshot().lastInput.throttle, 0, 'new attempts start at zero');
    });
});

test('native optional shell lists twelve drills, uses exclusive keyboard input, and neutralizes blur/dialog/reset', async (t) => {
  const f = await fixture(t);
  f.$('academy-shell-action-missions').click();
  assert.equal(f.$('journey-chooser').open, true);
  assert.equal(f.doc.querySelectorAll('.journey-card').length, 12);
  f.$('journey-chooser').close();
  assert.equal(f.$('fallback').hidden, true);
  f.$('arm').click();
  assert.equal(f.doc.activeElement, f.$('viewport'));
  f.tick();
  f.key('ArrowUp');
  f.key('KeyW');
  f.tick(20);
  assert(f.view.snapshot().lastInput.throttle > 0);
  assert(f.view.snapshot().lastInput.pitch > 0);
  f.win.emit('blur');
  const paused = f.view.snapshot();
  f.tick(10);
  assert.deepEqual(f.view.snapshot(), paused);
  assert.equal(f.view.arm(), false, 'background controls cannot resume physics');
  f.win.emit('focus');
  f.$('arm').click();
  f.tick(2);
  assert.deepEqual(f.view.snapshot().lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  f.$('help').click();
  const reading = f.view.snapshot();
  f.tick(10);
  assert.deepEqual(f.view.snapshot(), reading);
  f.doc.querySelector('[data-close="help-dialog"]').click();
  assert.equal(f.view.snapshot().status, 'paused');
  f.$('input-source').value = 'touch';
  f.$('input-source').emit('change');
  await f.view.settled();
  assert.equal(f.view.snapshot().ticks, 0);
  f.$('arm').click();
  f.tick();
  f.key('KeyW');
  f.tick(2);
  assert.equal(f.view.snapshot().lastInput.pitch, 0);
  f.$('touch-throttle').value = '60';
  f.$('touch-throttle').emit('input');
  f.tick();
  assert.equal(f.view.snapshot().lastInput.throttle, 600);
  f.$('reset').click();
  assert.equal(f.view.snapshot().status, 'disarmed');
  assert.equal(f.view.snapshot().lastInput.throttle, 0);
  assert.equal(f.deliveries.length, 0);
});

test('synthetic USB samples drive the real shell/model to one verified practice completion; reviewing and demonstrations never deliver evidence', async (t) => {
  const f = await fixture(t),
    pad = {
      id: 'Fixture USB',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [],
    };
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.view.radio.select(0);
  f.view.radio.setProfile(radioProfile(pad));
  f.view.radio.verify();
  assert.equal(f.view.arm(), true);
  f.tick();
  const example = FLIGHT_DEMONSTRATIONS.find(
    (item) => item.course === 'flight-01' && item.mode === 'self-level',
  );
  for (const values of example.frames) {
    pad.axes = [values[0] / 1000, values[1] / 1000, values[2] / 1000, values[3] / 500 - 1];
    f.tick();
  }
  await f.view.settled();
  assert.equal(f.view.snapshot().status, 'complete');
  assert.equal(f.doc.querySelector('[data-mode-play-shell]').dataset.phase, 'results');
  assert.equal(f.$('academy-shell-action-primary').textContent, 'Retry');
  assert.equal(
    f.$('academy-shell-action-pause').disabled,
    false,
    'Pause can cancel the victory transition',
  );
  assert.equal(f.deliveries.length, 1, f.$('status').textContent);
  assert.equal(f.deliveries[0].attempt.session, 'practice');
  assert.equal(f.deliveries[0].verification.proof.session, 'practice');
  assert.match(f.deliveries[0].verification.hash, /^[a-f0-9]{64}$/);
  assert.equal(replayFlight(FLIGHT_COURSES[0], f.deliveries[0].attempt).state.status, 'complete');
  assert.equal(f.$('complete').hidden, false);
  const completedState = f.view.snapshot(),
    nativeOutcome = f.$('complete');
  for (const action of ['results', 'back']) {
    f.$('academy-shell-action-menu').click();
    assert.equal(f.$('academy-shell-home-dialog').open, true);
    if (action === 'results') f.$('academy-shell-action-home-results').click();
    else f.$('academy-shell-home-dialog').emit('cancel');
    assert.equal(f.$('academy-shell-home-dialog').open, false);
    assert.equal(f.$('academy-shell-results-dialog').open, false);
    assert.equal(f.$('complete'), nativeOutcome);
    assert.equal(nativeOutcome.hidden, false);
    assert.equal(f.doc.activeElement, f.$('retry'));
    f.tick(3);
    assert.deepEqual(f.view.snapshot(), completedState);
    assert.equal(f.deliveries.length, 1, 'Results must not readmit a completion.');
  }
  f.$('review').click();
  await f.view.settled();
  f.tick(example.frames.length + 4);
  assert.equal(f.deliveries.length, 1);
  f.$('try').click();
  await f.view.settled();
  assert.equal(f.view.snapshot().ticks, 0);
  assert.equal(f.view.snapshot().status, 'disarmed');
  f.$('watch').click();
  await f.view.settled();
  f.tick(example.frames.length + 4);
  assert.equal(f.deliveries.length, 1);
  assert.match(f.$('status').textContent, /Replay finished/);
  f.$('try').click();
  await f.view.settled();
  assert.equal(f.view.exportAttempt().frames.length, 0);
});

test('radio switch edges while blurred or hidden cannot rearm; return requires a fresh visible OFF then ON', async (t) => {
  const f = await fixture(t),
    pad = {
      id: 'Fixture USB',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [{ value: 0 }],
    },
    profile = radioProfile(pad);
  profile.switches.arm = { button: 0, threshold: 0.5, invert: false };
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.view.radio.select(0);
  f.view.radio.setProfile(profile);
  f.view.radio.verify();
  f.tick();
  pad.buttons[0].value = 1;
  f.tick(3);
  assert.equal(f.view.snapshot().status, 'active');
  f.win.emit('blur');
  const before = f.view.snapshot();
  pad.buttons[0].value = 0;
  f.tick(3);
  pad.buttons[0].value = 1;
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), before);
  assert.equal(f.view.arm(), false);
  f.win.emit('focus');
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), before, 'held switch after focus does not arm');
  pad.buttons[0].value = 0;
  f.tick();
  pad.buttons[0].value = 1;
  f.tick(3);
  assert.equal(f.view.snapshot().status, 'active');
  f.doc.visibilityState = 'hidden';
  f.doc.emit('visibilitychange');
  const hidden = f.view.snapshot();
  pad.buttons[0].value = 0;
  f.tick();
  pad.buttons[0].value = 1;
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), hidden);
  f.doc.visibilityState = 'visible';
  f.doc.emit('visibilitychange');
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), hidden);
});

test('immediate Retry preserves the completed proof while notebook verification yields', async (t) => {
  let release, book;
  const f = await fixture(t, {
      notebookFactory(options) {
        book = mountFlightNotebook(options);
        return {
          ...book,
          accept: (proof) =>
            new Promise((resolve, reject) => {
              release = () => book.accept(proof).then(resolve, reject);
            }),
        };
      },
    }),
    pad = {
      id: 'Fixture USB',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [],
    };
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.view.radio.select(0);
  f.view.radio.setProfile(radioProfile(pad));
  f.view.radio.verify();
  f.view.arm();
  f.tick();
  const example = FLIGHT_DEMONSTRATIONS.find(
    (item) => item.course === 'flight-01' && item.mode === 'self-level',
  );
  for (const values of example.frames) {
    pad.axes = [values[0] / 1000, values[1] / 1000, values[2] / 1000, values[3] / 500 - 1];
    f.tick();
  }
  assert.equal(f.view.snapshot().status, 'complete');
  assert.equal(f.$('complete').hidden, false);
  assert.equal(f.deliveries.length, 0);
  f.$('retry').click();
  assert.equal(f.view.snapshot().status, 'disarmed');
  assert.equal(f.view.exportAttempt().frames.length, 0);
  release();
  await f.view.settled();
  assert.equal(f.deliveries.length, 1);
  assert(f.deliveries[0].verification.summary.ticks > 0);
  assert.equal(book.snapshot().rewards.receipts.length, 1);
  assert.equal(book.snapshot().rewards.receipts[0].definition.id, 'flight-01-discovery');
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal(f.view.exportAttempt().frames.length, 0);
});

test('Controls camera chooser and toolbar stay synchronized for the narrow layout', async (t) => {
  const f = await fixture(t);
  f.$('help').click();
  f.$('camera-help').value = 'overview';
  f.$('camera-help').emit('change');
  assert.equal(f.$('camera').value, 'overview');
  f.doc.querySelector('[data-close="help-dialog"]').click();
  f.$('camera').value = 'chase';
  f.$('camera').emit('change');
  assert.equal(f.$('camera-help').value, 'chase');
});

test('Studio preview runs the actual course as authoring and never reaches the notebook earning callback', async (t) => {
  let preview;
  const accepted = [],
    f = await fixture(t, {
      studioFactory({ onPreview }) {
        preview = onPreview;
        return { dispose() {}, setLocale() {} };
      },
      notebookFactory() {
        return { ready: Promise.resolve(), accept: (proof) => accepted.push(proof), dispose() {} };
      },
    }),
    pad = {
      id: 'Fixture USB',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [],
    };
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.view.radio.select(0);
  f.view.radio.setProfile(radioProfile(pad));
  f.view.radio.verify();
  f.$('help').click();
  f.$('studio-button').click();
  assert.equal(f.$('help-dialog').open, false);
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.revision = 'authoring-r2';
  preview(course);
  await f.view.settled();
  assert.equal(f.$('studio-dialog').open, false);
  assert.equal(f.view.exportAttempt().session, 'authoring');
  assert.equal(f.$('try').hidden, false);
  f.$('academy-shell-action-start').click();
  assert.equal(f.view.snapshot().status, 'active');
  f.tick();
  const example = FLIGHT_DEMONSTRATIONS.find(
    (item) => item.course === course.id && item.mode === 'self-level',
  );
  for (const values of example.frames) {
    pad.axes = [values[0] / 1000, values[1] / 1000, values[2] / 1000, values[3] / 500 - 1];
    f.tick();
  }
  await f.view.settled();
  assert.equal(f.view.snapshot().status, 'complete');
  assert.equal(f.$('complete').hidden, false);
  assert.equal(accepted.length, 0);
  assert.equal(f.deliveries.length, 0);
  f.$('try').click();
  await f.view.settled();
  assert.equal(f.view.exportAttempt().session, 'practice');
  assert.equal(f.view.snapshot().status, 'disarmed');
});

test('radio loss pauses instead of borrowing keyboard and reset drops old throttle pickup', async (t) => {
  const f = await fixture(t),
    pad = {
      id: 'Fixture USB',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [],
    };
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.view.radio.select(0);
  f.view.radio.setProfile(radioProfile(pad));
  f.view.radio.verify();
  f.view.arm();
  f.tick();
  pad.axes[3] = 0.3;
  f.tick(4);
  f.key('KeyW');
  f.tick();
  assert.equal(f.view.snapshot().lastInput.pitch, 0);
  f.setPads([]);
  f.tick();
  assert.equal(f.view.snapshot().status, 'paused');
  const state = f.view.snapshot();
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), state);
  f.setPads([pad]);
  f.view.radio.verify();
  f.$('reset').click();
  await f.view.settled();
  assert.equal(f.view.radio.status().pickup, null);
  assert.equal(f.view.arm(), false);
  assert.equal(f.view.radio.status().reason, 'throttle-high');
  pad.axes[3] = -1;
  assert.equal(f.view.arm(), true);
});

test('graphics failure leaves readable choices and never advances; context loss freezes an existing attempt', async (t) => {
  const fallback = await fixture(t, { available: false });
  assert.equal(fallback.$('fallback').hidden, false);
  assert.match(fallback.$('fallback').textContent, /WebGL/);
  fallback.$('arm').click();
  fallback.tick(5);
  assert.equal(fallback.view.snapshot().ticks, 0);
  assert.throws(() => fallback.view.review(FLIGHT_DEMONSTRATIONS[0]), /WebGL/);
  const live = await fixture(t);
  live.$('arm').click();
  live.tick(3);
  live.contextLoss();
  const frozen = live.view.snapshot();
  live.tick(10);
  assert.deepEqual(live.view.snapshot(), frozen);
  assert.equal(live.view.arm(), false);
  live.view.dispose();
  assert.equal(live.frames.size, 0);
  assert.equal(live.rendererDisposed(), true);
});

test('replay owns a verified clone, rejects forged course data and cannot be used as a practice source', async (t) => {
  const f = await fixture(t),
    proof = structuredClone(FLIGHT_DEMONSTRATIONS[0]);
  const pending = f.view.review(proof);
  proof.frames[0] = [1000, 1000, 1000, 1000];
  await pending;
  f.tick(2);
  assert.equal(f.renders.at(-1).lastInput.roll, 0);
  assert.equal(f.deliveries.length, 0);
  await assert.rejects(
    () => f.view.review({ ...proof, courseIdentity: '0000000000000000' }),
    /Exact flight/,
  );
  f.$('language').value = 'uk';
  f.$('language').emit('change');
  assert.match(f.$('course-title').textContent, /Підйом/);
  f.$('try').click();
  await f.view.settled();
  assert.equal(f.view.exportAttempt().session, 'practice');
  assert.equal(f.view.exportAttempt().frames.length, 0);
});

test('Academy shared menu resumes paused playback without restarting or granting practice evidence', async (t) => {
  const f = await fixture(t);
  await f.view.review(FLIGHT_DEMONSTRATIONS[0]);
  f.tick(5);
  const shell = f.doc.querySelector('[data-mode-play-shell]');
  f.$('academy-flight-menu').click();
  const paused = f.renders.at(-1);
  assert.ok(paused.ticks > 0);
  assert.equal(shell.dataset.phase, 'paused');
  assert.equal(f.$('academy-shell-action-primary').textContent, 'Continue');
  f.tick(4);
  assert.deepEqual(f.renders.at(-1), paused);

  f.$('academy-shell-action-primary').click();
  assert.equal(f.$('academy-shell-home-dialog').open, false);
  assert.equal(f.$('academy-shell-briefing-dialog').open, false);
  assert.equal(shell.dataset.phase, 'playing');
  f.tick(4);
  assert.ok(f.renders.at(-1).ticks > paused.ticks, 'Continue advances the retained playback');

  f.$('academy-flight-menu').click();
  const pausedAgain = f.renders.at(-1);
  f.$('academy-shell-pause-dialog').emit('cancel');
  assert.equal(f.$('academy-shell-pause-dialog').open, false);
  f.tick(4);
  assert.deepEqual(f.renders.at(-1), pausedAgain, 'Back never resumes the recording');
  assert.equal(f.$('academy-shell-action-pause').textContent, 'Resume');
  f.$('academy-shell-action-pause').click();
  f.tick(4);
  assert.ok(f.renders.at(-1).ticks > pausedAgain.ticks);
  assert.equal(f.deliveries.length, 0);
  assert.equal(f.view.exportAttempt().frames.length, 0);
});

test('Academy exhausted unfinished playback offers Results instead of a nonfunctional Continue', async (t) => {
  const f = await fixture(t),
    proof = {
      ...structuredClone(FLIGHT_DEMONSTRATIONS[0]),
      session: 'replay',
      frames: Array.from({ length: 4 }, () => [0, 0, 0, 0]),
    },
    original = structuredClone(proof);
  const checked = await f.view.review(proof);
  assert.equal(checked.state.status, 'active', 'The recording has not completed its objective.');
  f.tick(12);
  const ended = f.renders.at(-1),
    shell = f.doc.querySelector('[data-mode-play-shell]');
  assert.equal(ended.ticks, proof.frames.length);
  assert.equal(ended.status, 'active', 'UI completion must not fabricate a simulation outcome.');
  assert.equal(shell.dataset.phase, 'results');
  assert.equal(f.$('academy-shell-action-pause').disabled, true);
  assert.equal(f.$('arm').disabled, true);
  assert.equal(f.$('academy-flight-resume').disabled, true);
  assert.equal(f.view.arm(), false, 'Exhausted commands cannot be resumed.');
  f.$('academy-shell-action-menu').click();
  assert.equal(f.$('academy-shell-action-primary').textContent, 'Retry');
  assert.equal(f.$('academy-shell-action-home-results').hidden, false);
  f.$('academy-shell-action-home-results').click();
  assert.equal(f.$('academy-shell-home-dialog').open, false);
  assert.equal(f.$('academy-shell-results-dialog').open, false);
  assert.equal(f.doc.activeElement, f.$('status'));
  f.tick(8);
  assert.deepEqual(f.renders.at(-1), ended);
  assert.deepEqual(proof, original);
  assert.equal(f.deliveries.length, 0);
  assert.equal(f.view.exportAttempt().frames.length, 0);
  f.$('academy-shell-action-menu').click();
  f.$('academy-shell-home-dialog').emit('cancel');
  assert.equal(shell.dataset.phase, 'results');
  assert.equal(f.$('academy-shell-home-dialog').open, false);
  f.$('academy-shell-action-menu').click();
  f.$('academy-shell-action-primary').click();
  assert.equal(f.$('academy-shell-briefing-dialog').open, false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal(f.view.snapshot().ticks, 0);
});

test('touch release holds throttle, centers yaw, and cancellation clears all input and listener ownership', () => {
  const doc = new Document(),
    win = new Events(),
    reasons = [],
    node = doc.createElement('div');
  doc.body.append(node);
  node._rect = { x: 0, y: 0, width: 100, height: 100 };
  const input = createFlightInput({
    document: doc,
    window: win,
    onPause: (reason) => reasons.push(reason),
  });
  input.bindStick(node, 'left');
  input.select('touch');
  input.enable(true);
  input.touchResponse('direct');
  node.emit('pointerdown', { pointerId: 1, clientX: 50, clientY: 75 });
  assert.deepEqual(input.sample(0.02), { yaw: 0, throttle: 0, pitch: 0, roll: 0 });
  node.emit('pointermove', { pointerId: 1, clientX: 67, clientY: 24 });
  assert.deepEqual(input.sample(0.02), { yaw: 0.5, throttle: 0.75, pitch: 0, roll: 0 });
  node.emit('pointerup', { pointerId: 1 });
  assert.equal(input.sample(0.02).throttle, 0.75);
  assert.equal(input.sample(0.02).yaw, 0);
  node.emit('pointerdown', { pointerId: 2, clientX: 50, clientY: 20 });
  node.emit('pointercancel', { pointerId: 2 });
  assert.deepEqual(input.sample(0.02), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.deepEqual(reasons, ['input-lost']);
  input.dispose();
  assert(
    [...win.listeners.values(), ...doc.listeners.values(), ...node.listeners.values()].every(
      (set) => set.size === 0,
    ),
  );
});

test('input diagnostics retain raw touch and controller values separately from shaping and never invent hardware cadence', () => {
  const doc = new Document(),
    win = new Events(),
    node = doc.createElement('div');
  doc.body.append(node);
  node._rect = { x: 0, y: 0, width: 100, height: 100 };
  const input = createFlightInput({ document: doc, window: win });
  input.bindStick(node, 'right');
  input.select('touch');
  input.enable(true);
  node.emit('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
  node.emit('pointermove', { pointerId: 1, clientX: 67, clientY: 50 });
  const command = input.sample(0.02);
  assert.equal(input.diagnostics().raw.roll, 0.5);
  assert.ok(command.roll < 0.3, 'the legacy touch shaping is visible separately');
  assert.equal(input.diagnostics().calibrated.roll, command.roll);
  assert.equal(input.diagnostics().sampleAgeMs, null);
  assert.equal(input.diagnostics().cadenceHz, null);
  input.dispose();

  const gamepad = createFlightGamepad({ document: doc, window: win });
  const pad = {
    id: 'diagnostic pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
    timestamp: 100,
  };
  gamepad.poll({ gamepads: [pad], now: 105, scope: 'flight' });
  pad.axes[2] = 0.56;
  pad.timestamp = 110;
  gamepad.poll({ gamepads: [pad], now: 115, scope: 'flight' });
  assert.ok(Math.abs(gamepad.sample(0.02).roll - 0.5) < 1e-12);
  assert.equal(gamepad.diagnostics().raw.axes[2], 0.56);
  assert.equal(gamepad.diagnostics().sampleAgeMs, 5);
  assert.equal(gamepad.diagnostics().cadenceHz, 100);
  pad.timestamp = 0;
  gamepad.poll({ gamepads: [pad], now: 125, scope: 'flight' });
  assert.equal(gamepad.diagnostics().sampleAgeMs, null);
  assert.equal(gamepad.diagnostics().cadenceHz, null);
  gamepad.dispose();
});

test('committed diagnostics separate input owners, new attempts and a live radio preview from achieved flight response', () => {
  let now = 100;
  const diagnostics = createFlightInputDiagnostics({ now: () => now });
  const flight = {},
    controls = { roll: 0.5, pitch: 0, yaw: 0, throttle: 0.4 };
  diagnostics.record(
    flight,
    'controller',
    controls,
    { raw: { axes: [0, 0, 0.56, 0] }, sampleAgeMs: 10, sampledAtMs: 90, cadenceHz: 100 },
    { ticks: 3, angular: { roll: 12300, pitch: 0, yaw: 0 } },
  );
  now = 150;
  const captured = diagnostics.read(flight, 'controller');
  assert.equal(captured.sampleAgeMs, 70);
  assert.equal(captured.achieved.roll, 123);
  assert.deepEqual(captured.calibrated, controls);
  assert.equal(captured.context, 'last-flight-sample');
  assert.equal(diagnostics.read(flight, 'keyboard').calibrated, null);
  assert.equal(diagnostics.read({}, 'controller').achieved, null);
  const preview = diagnostics.read(flight, 'radio', {
    raw: { roll: -1 },
    calibrated: { ...controls, roll: -1 },
    sampleAgeMs: 5,
    cadenceHz: null,
  });
  assert.equal(preview.context, 'live-preview');
  assert.equal(preview.calibrated.roll, -1);
  assert.equal(preview.achieved, null, 'a different input owner cannot borrow achieved rotation');
});

test('full-length replay admission yields through the shared verifier and cannot earn a practice receipt', async (t) => {
  let yields = 0;
  const f = await fixture(t, {
      reviewYieldControl: async () => {
        yields++;
      },
    }),
    proof = {
      ...structuredClone(FLIGHT_DEMONSTRATIONS[0]),
      session: 'replay',
      frames: Array.from({ length: 36000 }, () => [0, 0, 0, 0]),
    };
  const pending = f.view.review(proof);
  assert.equal(f.view.arm(), false, 'checking cannot be interrupted by arming the old run');
  const checked = await pending;
  assert.equal(yields, 180);
  assert.equal(checked.state.ticks, 36000);
  assert.notEqual(checked.state.status, 'complete');
  assert.equal(f.$('try').hidden, false);
  assert.equal(f.view.exportAttempt().frames.length, 0);
  assert.equal(f.deliveries.length, 0);
});

test('pending review aborts on reset, input change, dialog close and disposal without late playback', async (t) => {
  for (const action of ['reset', 'source', 'close', 'dispose']) {
    let release,
      yields = 0;
    const f = await fixture(t, {
      reviewYieldControl: () => {
        yields++;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    f.$('help').click();
    f.$('import-attempt').files = [
      { size: 1000, text: async () => JSON.stringify(FLIGHT_DEMONSTRATIONS[0]) },
    ];
    f.$('import-attempt').emit('change');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(yields, 1, 'actual verifier yields before advancing the transcript');
    if (action === 'reset') f.$('reset').click();
    if (action === 'source') {
      f.$('input-source').value = 'touch';
      f.$('input-source').emit('change');
    }
    if (action === 'close') f.doc.querySelector('[data-close="help-dialog"]').click();
    if (action === 'dispose') f.view.dispose();
    release();
    await f.view.settled();
    assert.equal(yields, 1);
    assert.equal(f.view.snapshot().ticks, 0);
    assert.equal(f.$('try').hidden, true, 'no verified-playback surface was created');
    assert.equal(
      f.$('transfer-status').textContent,
      '',
      'cancellation is not reported as verified',
    );
    assert.equal(f.deliveries.length, 0);
  }
});

test('closing a replay import during file reading prevents verification and late playback', async (t) => {
  let release,
    yields = 0;
  const f = await fixture(t, {
    reviewYieldControl: async () => {
      yields++;
    },
  });
  f.$('help').click();
  f.$('import-attempt').files = [
    {
      size: 1000,
      text: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  ];
  f.$('import-attempt').emit('change');
  f.doc.querySelector('[data-close="help-dialog"]').click();
  release(JSON.stringify(FLIGHT_DEMONSTRATIONS[0]));
  await f.view.settled();
  assert.equal(yields, 0);
  assert.equal(f.$('try').hidden, true);
  assert.equal(f.view.snapshot().ticks, 0);
  assert.equal(f.deliveries.length, 0);
});

test('actual renderer detects unavailable WebGL without allocating a running fallback simulation', async (t) => {
  t.mock.method(console, 'error', () => {});
  const document = new Document(),
    canvas = document.createElement('canvas');
  canvas.getContext = () => null;
  const result = createFlightRenderer({ canvas, window: { devicePixelRatio: 1 } });
  assert.equal(result.available, false);
  result.dispose();
});

test('disposing releases generated course callbacks; retained old buttons are inert and unrelated host content remains', async (t) => {
  const f = await fixture(t),
    old = (() => {
      f.$('academy-shell-action-missions').click();
      return f.doc.querySelectorAll('.journey-card')[1];
    })();
  let hostClicks = 0;
  const host = f.doc.createElement('button');
  host.onclick = () => hostClicks++;
  f.$('course-list').append(host);
  const before = f.view.exportAttempt();
  f.view.dispose();
  assert.equal(old.isConnected, false);
  old.click();
  assert.deepEqual(f.view.exportAttempt(), before);
  assert.equal(f.$('course-list').children.length, 1);
  assert.equal(f.$('course-list').children[0], host);
  host.click();
  assert.equal(hostClicks, 1);
});

test('stale queued animation timestamps cannot advance after a long execution gap; explicit resume keeps input ownership', async (t) => {
  for (const mode of ['self-level', 'acro'])
    for (const owner of ['keyboard', 'radio']) {
      const f = await fixture(t),
        pad = {
          id: 'Stall fixture USB',
          index: 0,
          connected: true,
          mapping: '',
          axes: [0, 0, 0, -1],
          buttons: [],
        };
      let clock = 0;
      f.win.performance = { now: () => clock };
      // This lifecycle fixture exercises the original KeyE yaw mapping.
      f.$('keyboard-preset').value = 'classic';
      f.$('keyboard-preset').emit('change');
      f.$('mode').value = mode;
      f.$('mode').emit('change');
      f.$('input-source').value = owner;
      f.$('input-source').emit('change');
      await f.view.settled();
      if (owner === 'radio') {
        f.setPads([pad]);
        f.view.radio.select(0);
        f.view.radio.setProfile(radioProfile(pad));
        f.view.radio.verify();
      }
      assert.equal(f.view.arm(), true);
      if (owner === 'radio') pad.axes[2] = 0.5;
      else f.key('KeyE');
      f.tick();
      clock = 20;
      f.tick();
      assert.equal(f.view.snapshot().lastInput.yaw, 500);
      const before = f.view.snapshot().ticks,
        frames = f.view.exportAttempt().frames.length;
      // The rAF timestamp moves only 20 ms, while callback execution was delayed 300 ms.
      clock = 320;
      f.tick();
      assert.equal(f.view.snapshot().status, 'paused', `${mode}/${owner}`);
      assert.equal(f.view.snapshot().ticks, before);
      assert.equal(f.view.exportAttempt().frames.length, frames);
      clock = 340;
      f.tick(4);
      assert.equal(f.view.snapshot().ticks, before, 'no queued catch-up');
      if (owner === 'radio') {
        pad.axes[2] = 0;
        assert.equal(f.view.arm(), false, 'radio still requires matching pickup');
        pad.axes[2] = 0.5;
      } else f.key('KeyE', 'keyup');
      assert.equal(f.view.arm(), true);
      clock = 2000;
      f.tick();
      clock = 2020;
      f.tick();
      assert.equal(f.view.snapshot().status, 'active');
      assert(f.view.snapshot().ticks > before);
      assert.equal(f.view.snapshot().lastInput.yaw, owner === 'radio' ? 500 : 0);
      assert.equal(f.deliveries.length, 0);
    }
});

test('cached Back restore preserves paused flight and requires explicit resume without duplicate frames', async (t) => {
  const f = await fixture(t, { notebookFactory: null, studioFactory: null });
  f.$('arm').click();
  f.key('KeyE');
  f.tick(5);
  assert(f.view.snapshot().ticks > 0);
  const proof = f.view.exportAttempt(),
    queuedFrame = f.frames.values().next().value;
  f.win.emit('pagehide', { persisted: true });
  const paused = f.view.snapshot();
  assert.equal(paused.status, 'paused');
  assert.equal(f.rendererDisposed(), false, 'cached page must retain its renderer');
  assert.equal(f.frames.size, 0, 'cached page has no scheduled frame');
  assert.equal(f.view.arm(), false, 'suspended page cannot rearm');
  queuedFrame(10000);
  assert.equal(f.frames.size, 0, 'late frame cannot revive a suspended page');
  assert.deepEqual(f.view.snapshot(), paused);
  f.win.emit('pageshow', { persisted: true });
  f.win.emit('pageshow', { persisted: true });
  assert.equal(f.frames.size, 1, 'restore schedules exactly one frame');
  assert.deepEqual(f.view.snapshot(), paused);
  assert.deepEqual(f.view.exportAttempt(), proof, 'original attempt retained');
  f.tick(5);
  assert.deepEqual(f.view.snapshot(), paused, 'restore never resumes physics automatically');
  f.$('arm').click();
  f.tick(3);
  assert(f.view.snapshot().ticks > paused.ticks, 'explicit resume remains functional');
  assert.equal(f.view.snapshot().lastInput.yaw, 0, 'held keyboard input was cleared');
  assert.equal(f.deliveries.length, 0);
});

test('cached radio restore requires a fresh arm edge and matching control pickup', async (t) => {
  const f = await fixture(t, { notebookFactory: null, studioFactory: null }),
    pad = {
      id: 'Cached radio fixture',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [{ value: 0 }],
    },
    profile = radioProfile(pad);
  profile.switches.arm = { button: 0, threshold: 0.5, invert: false };
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.view.radio.select(0);
  f.view.radio.setProfile(profile);
  f.view.radio.verify();
  f.tick();
  pad.buttons[0].value = 1;
  f.tick(3);
  pad.axes[3] = 0.2;
  f.tick(5);
  assert.equal(f.view.snapshot().status, 'active');
  const proof = f.view.exportAttempt();
  f.win.emit('pagehide', { persisted: true });
  const paused = f.view.snapshot();
  f.win.emit('pageshow', { persisted: true });
  assert.equal(f.frames.size, 1, 'radio controls resume polling after cached restore');
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), paused, 'held arm switch cannot resume');
  assert.deepEqual(f.view.exportAttempt(), proof);
  assert.equal(f.view.radio.status().reason, 'arm-off-first');
  pad.axes[3] = -1;
  pad.buttons[0].value = 0;
  f.tick();
  pad.buttons[0].value = 1;
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), paused, 'lowered throttle cannot resume airborne flight');
  assert.equal(f.view.radio.status().reason, 'pickup-controls');
  pad.axes[3] = 0.2;
  pad.buttons[0].value = 0;
  f.tick();
  pad.buttons[0].value = 1;
  f.tick(3);
  assert.equal(f.view.snapshot().status, 'active');
  assert(f.view.snapshot().ticks > paused.ticks);
  assert.equal(f.view.snapshot().lastInput.throttle, 600);
});

test('game return keeps scoped offline controls available and serializes preparation/removal', async (t) => {
  const base = 'https://example.test/optional-practice/civilian-fpv/',
    registrations = [],
    removed = [];
  let complete,
    installed = false,
    unregisters = 0;
  const registration = {
    scope: base,
    active: {
      state: 'activated',
      scriptURL: base + 'worker.js',
      addEventListener() {},
      removeEventListener() {},
      postMessage(data, ports) {
        if (data.type === 'practice-status')
          ports[0].postMessage({ type: 'practice-status', ready: true, scope: base });
      },
    },
    unregister: async () => {
      unregisters++;
    },
  };
  const f = await fixture(t, {
    url: base + 'index.html?lang=en&game-return=%2Fgame%2Findex.html',
    notebookFactory: null,
    studioFactory: null,
    serviceWorker: {
      register: (url, options) => {
        registrations.push({ url: String(url), scope: options.scope });
        return new Promise(
          (resolve) =>
            (complete = () => {
              installed = true;
              resolve(registration);
            }),
        );
      },
      getRegistration: async () => (installed ? registration : null),
    },
  });
  const ownedCache = 'revealline.optional.package.v1:/optional-practice/civilian-fpv/:exact';
  f.win.caches = {
    keys: async () => [ownedCache, 'main-game', 'another-installation'],
    delete: async (key) => removed.push(key),
  };
  assert.equal(f.$('game-return').hidden, false);
  assert.equal(f.$('install-offline').hidden, false);
  assert.equal(f.$('install-offline').disabled, false);
  f.$('arm').click();
  f.$('help-dialog').showModal();
  f.$('install-offline').click();
  assert.equal(f.view.snapshot().status, 'paused');
  assert.equal(f.$('install-offline').disabled, true);
  assert.equal(f.$('remove-offline').disabled, true);
  f.$('install-offline').click();
  f.$('remove-offline').click();
  await waitFor(() => registrations.length === 1);
  assert(
    f.$('help-dialog').querySelector('[data-optional-offline-progress]'),
    'The actual host passes its owning modal rather than attaching Cancel to the inert body',
  );
  assert.deepEqual(registrations, [{ url: base + 'worker.js', scope: new URL(base).pathname }]);
  assert.equal(unregisters, 0);
  assert.deepEqual(removed, []);
  complete();
  await waitFor(() => !f.$('install-offline').disabled);
  assert.equal(f.$('transfer-status').textContent, 'This exact optional package is ready offline.');
  assert.equal(f.$('install-offline').disabled, false);
  assert.equal(f.view.snapshot().status, 'paused');
  f.$('remove-offline').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(unregisters, 1);
  assert.deepEqual(removed, [ownedCache]);
  assert.equal(f.$('remove-offline').disabled, false);
});

test('disposing Academy cancels an owned offline verification and releases its progress panel', async (t) => {
  const base = 'https://example.test/optional-practice/civilian-fpv/',
    ports = [],
    messages = [];
  const f = await fixture(t, {
    url: base + 'index.html?lang=en',
    notebookFactory: null,
    studioFactory: null,
    serviceWorker: {
      getRegistration: async () => ({
        scope: base,
        active: {
          scriptURL: base + 'worker.js',
          postMessage(data, transferred) {
            messages.push(data.type);
            if (data.type === 'practice-status') ports.push(transferred[0]);
          },
        },
      }),
    },
  });
  f.$('help-dialog').showModal();
  f.$('install-offline').click();
  await waitFor(() => ports.length === 1);
  assert(f.doc.querySelector('[data-optional-offline-progress]'));
  f.view.dispose();
  await waitFor(() => !f.doc.querySelector('[data-optional-offline-progress]'));
  ports[0].postMessage({ type: 'practice-status', ready: true, scope: base });
  assert(!messages.includes('practice-cancel'), 'Disposal cancels inspection, not active play');
});

test('unavailable offline capability stays explanatory and a failed prepare never reports ready', async (t) => {
  for (const options of [
    {},
    { url: 'file:///optional-practice/civilian-fpv/index.html', serviceWorker: {} },
  ]) {
    const f = await fixture(t, { notebookFactory: null, studioFactory: null, ...options });
    assert.equal(f.$('install-offline').disabled, true);
    assert.equal(f.$('remove-offline').disabled, true);
    assert.equal(f.$('offline-unavailable').hidden, false);
  }
  const f = await fixture(t, {
    notebookFactory: null,
    studioFactory: null,
    serviceWorker: {
      register: async () => {
        throw new Error('Offline package unavailable');
      },
    },
  });
  f.$('install-offline').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('transfer-status').textContent, 'Offline package unavailable');
  assert.equal(f.$('install-offline').disabled, false);
  assert.equal(f.$('remove-offline').disabled, false);
});

test('ordinary unload disposes permanently and a late pageshow cannot revive it', async (t) => {
  const f = await fixture(t, { notebookFactory: null, studioFactory: null });
  f.$('arm').click();
  f.tick(2);
  f.win.emit('pagehide', { persisted: false });
  assert.equal(f.rendererDisposed(), true);
  assert.equal(f.frames.size, 0);
  const stopped = f.view.snapshot();
  f.win.emit('pageshow', { persisted: true });
  f.$('arm').click();
  assert.equal(f.frames.size, 0);
  assert.equal(f.view.arm(), false);
  assert.deepEqual(f.view.snapshot(), stopped);
});

test('selecting USB radio restores saved axis arm and button reset after reload', async (t) => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const pad = {
    index: 0,
    id: 'TX15 test',
    mapping: '',
    connected: true,
    axes: [0, 0, 0, -1, -1],
    buttons: [{ value: 0, pressed: false }],
  };
  const profile = radioProfile(pad);
  profile.format = 'RadioProfile.v2';
  profile.switches.arm = { axis: 4, off: -1, on: 1 };
  profile.switches.reset = { button: 0, threshold: 0.5, invert: false };
  const store = createFlightProfileStore({ storage });
  store.save({ ...store.snapshot(), radio: profile });
  const f = await fixture(t, { storage });
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.tick();
  assert.equal(f.view.radio.status().verified, true);
  pad.axes[4] = 1;
  f.tick();
  assert.equal(f.view.snapshot().status, 'active');
  pad.axes[3] = 0;
  f.tick(5);
  pad.buttons[0].value = 1;
  f.tick();
  assert.equal(f.view.snapshot().status, 'disarmed');
  assert.equal(f.view.snapshot().ticks, 0);
});

test('tested TX15 default loads without saved calibration and does not auto-arm', async (t) => {
  const storage = { getItem: () => null, setItem() {} };
  const profile = defaultRadioProfile();
  const pad = {
    index: 0,
    id: profile.device.id,
    mapping: '',
    connected: true,
    axes: [0.004, 0.004, -1, 0.004, -1, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ value: 0, pressed: false })),
  };
  const f = await fixture(t, { storage });
  f.setPads([pad]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.tick();
  assert.equal(f.view.radio.status().verified, true);
  assert.equal(f.view.snapshot().status, 'disarmed');
  pad.axes[4] = 1;
  f.tick();
  assert.equal(f.view.snapshot().status, 'active');
});

test('TX15 default does not match an unrelated joystick', async (t) => {
  const f = await fixture(t, { storage: { getItem: () => null, setItem() {} } });
  f.setPads([
    {
      index: 0,
      id: 'Different radio',
      mapping: '',
      connected: true,
      axes: Array(8).fill(0),
      buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
    },
  ]);
  f.$('input-source').value = 'radio';
  f.$('input-source').emit('change');
  await f.view.settled();
  f.tick();
  assert.equal(f.view.radio.status().profile, null);
  assert.equal(f.view.snapshot().status, 'disarmed');
});

test('camera focus preserves global pause for keyboard, touch and radio owners without resuming held input', async (t) => {
  for (const owner of ['keyboard', 'touch', 'radio']) {
    for (const code of ['KeyP', 'Escape']) {
      const f = await fixture(t);
      f.$('input-source').value = owner;
      f.$('input-source').emit('change');
      await f.view.settled();
      if (owner === 'radio') {
        const pad = {
          id: 'Pause fixture USB',
          index: 0,
          connected: true,
          mapping: '',
          axes: [0, 0, 0, -1],
          buttons: [],
        };
        f.setPads([pad]);
        f.view.radio.select(0);
        f.view.radio.setProfile(radioProfile(pad));
        f.view.radio.verify();
      }
      assert.equal(f.view.arm(), true);
      f.tick(3);
      f.$('camera').focus();
      const event = f.win.emit('keydown', { code, target: f.doc.activeElement });
      assert.equal(event.defaultPrevented, true, `${owner}: ${code}`);
      assert.equal(f.view.snapshot().status, 'paused');
      const paused = f.view.snapshot();
      f.tick(4);
      assert.deepEqual(f.view.snapshot(), paused);
      f.key('KeyW');
      assert.deepEqual(f.view.snapshot(), paused, 'movement cannot unpause');
    }
  }
});

test('pause shortcuts release local controls but preserve text, dialogs and modified browser keys', () => {
  const doc = new Document(),
    win = new Events(),
    reasons = [];
  const input = createFlightInput({
    window: win,
    document: doc,
    onPause: (reason) => reasons.push(reason),
  });
  try {
    for (const tag of ['button', 'a', 'select', 'input']) {
      const target = doc.createElement(tag);
      if (tag === 'input') target.type = 'range';
      doc.body.append(target);
      input.select('keyboard');
      input.enable(true);
      win.emit('keydown', { code: 'KeyW', target: doc.body });
      win.emit('keydown', { code: 'ArrowUp', target: doc.body });
      assert(input.sample(0.05).throttle > 0);
      assert.equal(win.emit('keydown', { code: 'KeyP', target }).defaultPrevented, true);
      assert.deepEqual(input.sample(0.05), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
      input.enable(true);
      assert.deepEqual(input.sample(0.05), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    }
    assert.equal(reasons.length, 4);
    const text = doc.createElement('input'),
      textarea = doc.createElement('textarea'),
      rich = doc.createElement('div');
    text.type = 'text';
    rich.isContentEditable = true;
    for (const target of [text, textarea, rich])
      for (const code of ['KeyP', 'Escape'])
        assert.equal(win.emit('keydown', { code, target }).defaultPrevented, false);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'repeat', 'isComposing'])
      assert.equal(
        win.emit('keydown', { code: 'KeyP', target: doc.body, [modifier]: true }).defaultPrevented,
        false,
      );
    const dialog = doc.createElement('dialog'),
      close = doc.createElement('button');
    dialog.append(close);
    doc.body.append(dialog);
    dialog.showModal();
    assert.equal(win.emit('keydown', { code: 'Escape', target: close }).defaultPrevented, false);
    assert.equal(reasons.length, 4, 'native dismissal and text input must not invoke pause');
  } finally {
    input.dispose();
  }
});

test('Academy title focus loss before flight initialization keeps the menu usable and disarmed', async (t) => {
  const f = await fixture(t, { home: true, blurOnTitleMount: true });
  assert.equal(f.$('academy-shell-home-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'disarmed');
  assert.equal(f.view.snapshot().ticks, 0);
  f.tick(3);
  assert.equal(f.view.snapshot().ticks, 0);
  f.win.emit('focus');
  f.$('academy-shell-action-settings').click();
  assert.equal(f.$('academy-shell-settings-dialog').open, true);
  assert.equal(f.view.arm(), false);
  f.$('academy-shell-action-settings-back').click();
  f.$('academy-shell-action-primary').click();
  f.$('academy-shell-action-start').click();
  assert.equal(f.view.snapshot().status, 'active');
});

test('Academy shell keeps menu input out of native flight and requires explicit Start', async (t) => {
  const f = await fixture(t, { home: true });
  assert.equal(f.$('academy-shell-home-dialog').open, true);
  assert.equal(f.$('academy-shell-action-pause').dataset.menuIcon, 'pause');
  assert.equal(f.$('academy-shell-action-settings').dataset.menuIcon, 'settings');
  assert.equal(f.view.snapshot().status, 'disarmed');
  f.$('academy-shell-action-settings').click();
  assert.equal(f.$('academy-shell-settings-dialog').open, true);
  assert.equal(f.view.arm(), false);
  f.tick(4);
  assert.equal(f.view.snapshot().ticks, 0);
  f.$('academy-shell-action-settings-back').click();
  f.$('academy-shell-action-primary').click();
  assert.equal(f.$('academy-shell-briefing-dialog').open, false);
  assert.equal(f.view.snapshot().status, 'active');
  f.$('academy-flight-menu').click();
  assert.equal(f.$('academy-shell-pause-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'paused');
  const paused = f.view.snapshot();
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused);
  const hint = f.$('academy-shell-pause-dialog').querySelector('.sim-menu-hint');
  const instructions = hint.textContent;
  assert.ok(instructions.length > 0);
  f.win.emit('blur');
  assert.equal(hint.textContent, instructions, 'blur must not move the shared menu controls');
  assert.equal(hint.hidden, false);
  f.win.emit('focus');
  f.tick(2);
  assert.equal(hint.textContent, instructions);
});

test('Academy native tool dialogs retain instructions across blur and focus', async (t) => {
  for (const [button, dialog, category] of [
    ['help', 'help-dialog', 'extras'],
    ['notebook-button', 'notebook-dialog', 'data'],
  ]) {
    await t.test(dialog, async (t) => {
      const f = await fixture(t, { home: true });
      f.$('academy-shell-action-settings').click();
      f.$(`academy-settings-tab-${category}`).click();
      f.$(button).click();
      f.tick(2);
      assert.equal(f.$(dialog).open, true);
      const hint = f.$(dialog).querySelector('.sim-menu-hint');
      assert.ok(hint, 'the current dialog owns its navigation instructions');
      const instructions = hint.textContent;
      assert.ok(instructions.length > 0);
      f.doc.focused = false;
      f.win.emit('blur');
      f.tick(2);
      assert.equal(hint.textContent, instructions, 'blur must not resize a native tool dialog');
      assert.equal(hint.hidden, false);
      f.doc.focused = true;
      f.win.emit('focus');
      f.tick(2);
      assert.equal(hint.textContent, instructions, 'refocus must not reflow the clicked control');
      assert.equal(f.view.snapshot().status, 'disarmed');
    });
  }
});

test('Academy existing HUD guidance controls are reachable in Accessibility in EN and UK', async (t) => {
  for (const locale of ['en', 'uk']) {
    const f = await fixture(t, {
      home: true,
      url: `https://example.test/optional-practice/civilian-fpv/?lang=${locale}`,
    });
    f.$('academy-shell-action-settings').click();
    f.$('academy-settings-tab-accessibility').click();
    const section = f.doc.querySelector('[data-sim-hud-preferences]');
    assert.ok(section);
    assert.equal(section.parentNode, f.$('academy-settings-panel-accessibility'));
    assert.equal(section.closest('[hidden],[inert]'), null);
    assert.equal(f.doc.querySelectorAll('[data-sim-hud-preferences]').length, 1);
    const controls = [...section.querySelectorAll('select')];
    assert.equal(controls.length, 3);
    const mode = section.querySelector('[data-hud-preference="mode"]');
    mode.value = 'detailed';
    mode.emit('change');
    assert.equal(f.doc.querySelector('[data-sim-hud="flight"]').dataset.hudMode, 'detailed');
    assert.equal(
      f.view.snapshot().status,
      'disarmed',
      'Changing guidance must not start a flight.',
    );
    assert.equal(
      f.$('academy-settings-tab-accessibility').textContent,
      locale === 'uk' ? 'Доступність' : 'Accessibility',
    );
  }
});

test('Academy categories retain every authored preference control and restore nested dialog focus', async (t) => {
  const f = await fixture(t, { home: true });
  f.doc.defaultView.innerWidth = 390;
  f.$('academy-shell-action-settings').click();
  for (const original of f.originalSettingsControls) {
    const control = original.id === 'academy-sound' ? f.$('academy-global-masterMuted') : original;
    const panel = control.closest('[role="tabpanel"]');
    assert.ok(panel, `${control.id} belongs to a settings category`);
    assert.equal(panel.closest('dialog'), f.$('academy-shell-settings-dialog'));
    f.$(panel.getAttribute('aria-labelledby')).click();
    assert.equal(control.closest('[hidden],[inert]'), null, `${control.id} is reachable`);
  }
  const controls = f.$('academy-settings-tab-extras');
  controls.click();
  f.$('help').focus();
  f.$('help').click();
  assert.equal(f.$('help-dialog').open, true);
  f.$('help-dialog').querySelector('[data-close="help-dialog"]').click();
  assert.equal(f.doc.activeElement, f.$('help'));
  assert.equal(f.$('academy-shell-settings-dialog').dataset.settingsView, 'panel');
  f.$('academy-shell-action-settings-back').click();
  assert.equal(f.$('academy-shell-settings-dialog').open, true);
  assert.equal(f.$('academy-shell-settings-dialog').dataset.settingsView, 'categories');
  f.$('academy-shell-action-settings-back').click();
  assert.equal(f.$('academy-shell-settings-dialog').open, false);
});

test('Academy global settings bind canonical records without startup writes or duplicate fields', async (t) => {
  const records = new Map(),
    writes = [];
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      records.set(key, value);
    },
  };
  const f = await fixture(t, { home: true, storage });
  const canonicalKeys = [
    'revealline.display.v1',
    'revealline.appearance.v2',
    'revealline.audio-master.v1',
  ];
  assert.equal(writes.filter((key) => canonicalKeys.includes(key)).length, 0);
  const root = f.$('academy-shell-settings-dialog');
  for (const key of [
    'language',
    'appearance',
    'textFace',
    'textSize',
    'reducedEffects',
    'menuAnimation',
    'masterMuted',
    'masterVolume',
  ])
    assert.equal(root.querySelectorAll(`[data-global-setting="${key}"]`).length, 1, key);
  f.$('academy-global-textFace').value = 'plain';
  f.$('academy-global-textFace').emit('change');
  f.$('academy-global-textSize').value = 'large';
  f.$('academy-global-textSize').emit('change');
  f.$('academy-global-reducedEffects').checked = true;
  f.$('academy-global-reducedEffects').emit('change');
  assert.deepEqual(JSON.parse(records.get('revealline.display.v1')), {
    textFace: 'plain',
    textSize: 'large',
    reducedEffects: true,
  });
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.equal(f.doc.body.dataset.effects, 'reduced');
  f.$('academy-global-masterVolume').value = '0.25';
  f.$('academy-global-masterVolume').emit('change');
  assert.equal(JSON.parse(records.get('revealline.audio-master.v1')).volume, 0.25);
  root.querySelector('[data-theme-preview="industrial-workshop"]').click();
  assert.equal(JSON.parse(records.get('revealline.appearance.v2')).familyId, 'industrial-workshop');
  assert.equal(f.$('sim-appearance-interface').value, 'follow-game');
  assert.equal(f.$('sim-appearance-world').value, 'follow-game');
  f.view.dispose();
  const count = writes.length;
  const next = await fixture(t, { home: true, storage });
  assert.equal(next.$('academy-global-textFace').value, 'plain');
  assert.equal(next.$('academy-global-textSize').value, 'large');
  assert.equal(next.$('academy-global-masterVolume').value, '0.25');
  assert.equal(writes.slice(count).filter((key) => canonicalKeys.includes(key)).length, 0);
});

test('Academy shared tool iframe retains D-pad focus and controller Back restores paused Settings', async (t) => {
  const h = await fixture(t, { home: true, globalToolsFactory: sourceSimGlobalTools });
  h.$('academy-shell-action-primary').click();
  h.$('academy-shell-action-start').click();
  h.tick(3);
  h.$('academy-flight-menu').click();
  const paused = h.view.snapshot();
  h.$('academy-shell-action-settings').click();
  h.$('academy-settings-tab-controls').click();
  await waitFor(() => h.$('sim-global-tools-controllerTools'));
  const opener = h.$('sim-global-tools-controllerTools');
  opener.focus();
  opener.click();
  const dialog = h.$('sim-global-tools-tool-dialog'),
    frame = dialog.querySelector('iframe');
  assert.equal(dialog.open, true);
  frame.focus();
  const pad = menuPad();
  h.setPads([pad]);
  h.tick(2);
  pad.buttons[13] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[13] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(h.doc.activeElement, frame);
  assert.deepEqual(h.view.snapshot(), paused);
  pad.buttons[1] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[1] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(dialog.open, false);
  assert.equal(h.$('academy-shell-settings-dialog').open, true);
  assert.equal(h.doc.activeElement, opener);
  assert.deepEqual(h.view.snapshot(), paused);
  opener.click();
  assert.equal(dialog.open, true);
  frame.focus();
  h.tick(2);
  pad.buttons[9] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[9] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(dialog.open, false, 'Start also exits the focused tool frame.');
  assert.equal(h.$('academy-shell-settings-dialog').open, true);
  assert.equal(h.doc.activeElement, opener);
  assert.deepEqual(h.view.snapshot(), paused);
});

test('fresh Ukrainian Academy launch localizes shared Appearance and cue controls before any language change', async (t) => {
  const prior = getLocale();
  t.after(() => setLocale(prior, { persist: false }));
  setLocale('en', { persist: false });
  const h = await fixture(t, {
    home: true,
    url: 'https://example.test/optional-practice/civilian-fpv/?lang=uk',
  });
  assert.equal(h.doc.querySelector('.theme-family-controls h3').textContent, 'Вигляд');
  assert.equal(h.$('sim-global-menu-audio-enabled').closest('label').textContent, 'Звуки меню');
});

test('Academy flight feedback and shared menu sound retain separate sliders and preference records', async (t) => {
  const records = new Map([
    [
      'revealline.fpv.audio-mix.v1',
      JSON.stringify({ format: 'SimAudioMix.v1', interface: 0.62, motor: 0.7, ambience: 0.8 }),
    ],
    ['revealline.menu-audio.v1', JSON.stringify({ enabled: true, volume: 0.35 })],
  ]);
  const h = await fixture(t, {
    home: true,
    storage: {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => records.set(key, value),
    },
  });
  const feedback = h.$('academy-audio-mix-interface'),
    menu = h.$('sim-global-menu-audio-volume');
  assert.equal(feedback.value, '62');
  assert.equal(menu.value, '35');
  const originalMenu = records.get('revealline.menu-audio.v1');
  feedback.value = '21';
  feedback.emit('input');
  assert.equal(menu.value, '35');
  assert.equal(records.get('revealline.menu-audio.v1'), originalMenu);
  assert.deepEqual(JSON.parse(records.get('revealline.fpv.audio-mix.v1')), {
    format: 'SimAudioMix.v1',
    interface: 0.21,
    motor: 0.7,
    ambience: 0.8,
  });
  const savedMix = records.get('revealline.fpv.audio-mix.v1');
  menu.value = '76';
  menu.emit('input');
  assert.equal(feedback.value, '21');
  assert.equal(records.get('revealline.fpv.audio-mix.v1'), savedMix);
  assert.deepEqual(JSON.parse(records.get('revealline.menu-audio.v1')), {
    enabled: true,
    volume: 0.76,
  });
});

test('Academy result shortcuts choose once and launch a random prepared lesson directly', async (t) => {
  const f = await fixture(t);
  f.$('academy-result-missions').click();
  assert.equal(f.$('journey-chooser').open, true);
  assert.equal(f.view.snapshot().status, 'disarmed');
  f.$('academy-result-home').click();
  assert.equal(f.$('academy-shell-home-dialog').open, true);
  f.$('academy-result-random').click();
  await f.view.settled();
  assert.equal(f.$('academy-shell-home-dialog').open, false);
  assert.equal(f.$('academy-shell-briefing-dialog').open, false);
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal(f.view.snapshot().ticks, 0);
});

for (const clock of ['animation timestamp', 'callback execution']) {
  test(`Academy cancels an imminent auto-next before a stalled ${clock}`, async (t) => {
    const course = structuredClone(FLIGHT_COURSES[0]);
    const landing = { ...course.steps['self-level'].at(-1), ticks: 1 };
    course.steps = { 'self-level': [landing], acro: [landing] };
    const f = await fixture(t, { courses: [course, FLIGHT_COURSES[1]], demonstrations: [] });
    let executionTime = 0;
    f.win.performance = { now: () => executionTime };
    assert.equal(f.view.arm(), true);
    f.tick(3);
    assert.equal(f.view.snapshot().status, 'complete');
    const flow = f.doc.querySelector('[data-continuous-play]');
    for (let i = 0; i < 550 && !flow.textContent.includes('Next level in 1s'); i++) f.tick();
    assert.match(flow.textContent, /Next level in 1s/);
    f.tick(39);
    const completed = f.view.snapshot(),
      proof = f.view.exportAttempt();
    if (clock === 'animation timestamp') f.jump(1200);
    else executionTime = 1200;
    f.tick(4);
    assert.deepEqual(
      f.view.snapshot(),
      completed,
      'A stalled frame must not load the next lesson.',
    );
    assert.deepEqual(f.view.exportAttempt(), proof);
    assert.equal(flow.style.visibility, 'hidden', 'The cancelled timer cannot silently rearm.');
    assert.equal(flow.inert, true, 'Cancelled controls cannot retain input ownership.');
  });
}

test('Academy shared library shows every course, previews the selected flight mode, and launches once', async (t) => {
  const h = await fixture(t);
  h.$('mode').value = 'acro';
  h.$('mode').emit('change');
  await h.view.settled();
  h.$('academy-shell-action-missions').click();
  const cards = h.doc.querySelectorAll('.journey-card');
  assert.equal(cards.length, FLIGHT_COURSES.length);
  assert.equal(h.$('course-list').children.length, 0);
  assert.equal(h.doc.querySelector('[data-flight-mode]').getAttribute('data-flight-mode'), 'acro');
  assert.equal(cards.at(-1).querySelectorAll('button').length, 0);
  cards.at(-1).click();
  await h.view.settled();
  assert.equal(h.view.exportAttempt().course, FLIGHT_COURSES.at(-1).id);
  assert.equal(h.view.exportAttempt().mode, 'acro');
  assert.equal(h.view.snapshot().status, 'active');
  assert.equal(h.$('journey-chooser').open, false);
  assert.equal(h.$('academy-shell-briefing-dialog').open, false);
});

test('Academy mission library owns controller navigation and isolated pinned goals', async (t) => {
  const records = new Map();
  const h = await fixture(t, {
    home: true,
    storage: {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => records.set(key, value),
    },
  });
  h.win.getComputedStyle = h.doc.defaultView.getComputedStyle;
  h.$('academy-shell-action-missions').click();
  const chooser = h.$('journey-chooser');
  const pad = menuPad();
  h.setPads([pad]);
  h.tick(2);
  pad.buttons[0] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[0] = { pressed: false, value: 0 };
  h.tick();
  pad.buttons[13] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[13] = { pressed: false, value: 0 };
  h.tick();
  assert.ok(chooser.contains(h.doc.activeElement));
  h.doc.querySelector('.journey-card').focus();
  h.$('journey-goal-pin').click();
  assert.ok(records.has('revealline.mission-goal.v1.sim-academy.solo'));
  assert.equal(records.has('revealline.mission-goal.v1.default.solo'), false);
  pad.buttons[1] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[1] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(chooser.open, false);
  assert.equal(h.$('academy-shell-home-dialog').open, true);
  assert.equal(h.view.snapshot().status, 'disarmed');
});

async function academyTuningClick(h, label) {
  const root = h.doc.querySelector('.fpv-tuning');
  const button = root.querySelectorAll('button').find((node) => node.textContent === label);
  assert.ok(button, `Missing tuning action: ${label}`);
  button.click();
  await new Promise((resolve) => setImmediate(resolve));
}
function academyTuningControl(h, label, tag = 'input', scope = h.doc.querySelector('.fpv-tuning')) {
  const control = scope
    .querySelectorAll('label')
    .find((node) => node._text === label)
    ?.querySelectorAll(tag)
    .find((node) => tag !== 'input' || node.type !== 'range');
  assert.ok(control, `Missing tuning control: ${label}`);
  return control;
}
async function openAcademyTuning(h) {
  const button = h.doc
    .querySelectorAll('button')
    .find((node) => Object.hasOwn(node.dataset, 'fpvTuning'));
  assert.ok(button);
  button.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.doc.querySelector('.fpv-tuning').open, true);
}

test('Academy mode, reset and input changes preserve the tested draft until a normal course launch', async (t) => {
  const [tuning, workers] = await Promise.all([
    import('../../optional-practice/civilian-fpv/tuning-library.mjs'),
    import('../../optional-practice/civilian-fpv/advanced-worker.mjs'),
  ]);
  const data = new Map(),
    storage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    };
  const store = tuning.createTuningLibraryStore({ storage });
  await store.createPresetSetup({
    presetId: 'helion-pro-o4',
    setupId: 'saved-helion',
    profileId: 'saved-rates',
    rates: 'defaults',
  });
  const saved = store.export(),
    instances = [];
  const comfortKey = 'revealline.fpv.flight-comfort.v1.academy.camera',
    savedComfort = JSON.stringify({ fov: 99, tilt: 17 });
  data.set(comfortKey, savedComfort);
  class Worker extends Events {
    constructor() {
      super();
      this.closed = false;
      this.messages = [];
      instances.push(this);
      this.handler = workers.createAdvancedWorkerHandler((data) => {
        if (!this.closed) this.emit('message', { data });
      });
    }
    postMessage(value) {
      this.messages.push(structuredClone(value));
      void this.handler.receive(value).finally(() => {
        if (this.closed) this.handler.dispose();
      });
    }
    terminate() {
      this.closed = true;
      this.handler.dispose();
    }
  }
  const h = await fixture(t, { storage, windowOptions: { Worker, setTimeout, clearTimeout } });
  await openAcademyTuning(h);
  const aircraft = academyTuningControl(h, 'Aircraft preset', 'select');
  aircraft.value = 'meteor75-analog-2022';
  aircraft.emit('change');
  await academyTuningClick(h, 'Use in draft');
  const fov = academyTuningControl(h, 'Vertical FOV (degrees)');
  fov.value = '103';
  fov.emit('input');
  await academyTuningClick(h, 'Test draft · unscored');
  await h.view.settled();
  const init = () => instances.at(-1).messages.find((message) => message.type === 'init').options;
  const draft = init();
  assert.equal(draft.aircraft.id, 'meteor75-analog-2022');
  h.$('camera-fov').value = '106';
  h.$('camera-fov').emit('input');
  h.$('camera-fov').emit('change');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    data.get('revealline.fpv.tuning.v1'),
    saved,
    'Trial camera must not edit saved Helion',
  );
  assert.equal(data.get(comfortKey), savedComfort);
  for (const action of ['mode', 'reset', 'input', 'retry', 'keyboard-reset']) {
    if (action === 'mode') {
      h.$('mode').value = 'acro';
      h.$('mode').emit('change');
    } else if (action === 'input') {
      h.$('input-source').value = 'touch';
      h.$('input-source').emit('change');
    } else if (action === 'keyboard-reset') {
      h.$('viewport').focus();
      h.key('KeyR');
    } else h.$(action).click();
    await h.view.settled();
    assert.deepEqual(init().aircraft, draft.aircraft, `${action} must retain the tested aircraft`);
    assert.deepEqual(init().controller, draft.controller);
    assert.deepEqual(init().response, draft.response);
    assert.equal(init().assist.mode, 'acro');
    assert.equal(h.$('camera-fov').value, '103');
    assert.equal(h.doc.querySelector('.tuning-return').hidden, false);
    assert.equal(data.get('revealline.fpv.tuning.v1'), saved);
    h.view.pause();
  }
  h.$('next').click();
  await h.view.settled();
  assert.equal(init().aircraft.id, 'helion-pro-o4');
  assert.equal(h.doc.querySelector('.tuning-return').hidden, true);
  h.$('camera-fov').value = '109';
  h.$('camera-fov').emit('input');
  h.$('camera-fov').emit('change');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.parse(data.get(comfortKey)).fov, 109);
  assert.equal(
    JSON.parse(data.get('revealline.fpv.tuning.v1')).setups.find(
      (setup) => setup.id === 'saved-helion',
    ).camera.verticalFov,
    109,
  );
});

for (const source of ['keyboard', 'touch', 'controller', 'radio'])
  test(`Academy tuning diagnostics follow ${source} ownership with a different calibrated radio connected`, async (t) => {
    const h = await fixture(t);
    const radioPad = {
      id: 'Diagnostic USB radio',
      index: 1,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [],
    };
    const controllerPad = {
      id: 'Diagnostic controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
    };
    h.setPads([controllerPad, radioPad]);
    h.view.radio.select(1);
    h.view.radio.setProfile(radioProfile(radioPad));
    h.view.radio.verify();
    h.$('input-source').value = source;
    h.$('input-source').emit('change');
    await h.view.settled();
    assert.equal(h.view.arm(), true);
    h.tick(2);
    if (source === 'keyboard') h.key('ArrowRight');
    else if (source === 'touch') {
      h.$('touch-throttle').value = '60';
      h.$('touch-throttle').emit('input');
    } else if (source === 'controller') controllerPad.axes[2] = 0.56;
    else radioPad.axes[0] = 0.4;
    h.tick(4);
    const committed = h.view.snapshot();
    assert.ok(committed.ticks > 0);
    radioPad.axes[0] = -0.9;
    await openAcademyTuning(h);
    if (source === 'controller') controllerPad.axes[2] = 0.78;
    h.tick(40);
    const text = h.doc.querySelector('[aria-label="Input diagnostics"]').textContent;
    assert.match(
      text,
      new RegExp(
        `Input source: ${{ keyboard: 'Keyboard', touch: 'Touch', controller: 'Game controller', radio: 'Calibrated radio' }[source]}`,
      ),
    );
    assert.match(
      text,
      source === 'radio' || source === 'controller'
        ? /Live input preview; flight is paused/
        : /Last committed flight input; flight is paused/,
    );
    assert.match(text, new RegExp(`Flight tick: ${committed.ticks}`));
    assert.match(text, /Achieved rotation \(last committed flight °\/s\): \{/);
    if (source === 'keyboard') assert.match(text, /Raw input: \{"keys":\["ArrowRight"\]\}/);
    if (source === 'touch')
      assert.match(text, /Calibrated: \{"roll":0,"pitch":0,"yaw":0,"throttle":0.6\}/);
    if (source === 'controller') {
      assert.match(text, /Raw input: \{"axes":\[0,0,0.78,0\]/);
      assert.match(text, /Mapping: standard-mode-2/);
      assert.match(text, /flight throttle unavailable/);
      assert.match(text, /"throttle":null/);
      assert.equal(
        h.view.snapshot().ticks,
        committed.ticks,
        'Preview must not advance the paused flight',
      );
    }
    if (source !== 'radio') assert.doesNotMatch(text, /"roll":-0.9/);
    else assert.match(text, /"roll":-0.9/);
    assert.match(text, /Browser sample age \(ms\): unavailable/);
    assert.match(text, /cadence \(Hz\): unavailable/);
  });

test('Academy tuning saves new rates for reset while the active recording retains its frozen legacy configuration', async (t) => {
  const data = new Map();
  const h = await fixture(t, {
    storage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
  });
  assert.equal(h.view.arm(), true);
  h.tick(4);
  h.view.pause();
  const original = h.view.exportAttempt();
  await openAcademyTuning(h);
  const algorithm = academyTuningControl(h, 'Rate algorithm', 'select');
  algorithm.value = 'actual';
  algorithm.emit('change');
  const roll = h.doc
    .querySelector('.fpv-tuning')
    .querySelectorAll('fieldset')
    .find((node) => node.querySelector('legend')?.textContent === 'Roll');
  const rate = academyTuningControl(h, 'Maximum rate (°/s)', 'input', roll);
  rate.value = '950';
  rate.emit('input');
  await academyTuningClick(h, 'Save for next flight');
  assert.deepEqual(h.view.exportAttempt(), original);
  assert.equal(h.view.snapshot().status, 'paused');
  await academyTuningClick(h, 'Close');
  h.view.reset();
  await h.view.settled();
  const next = h.view.exportAttempt();
  assert.equal(next.response.format, 'FlightResponseProfile.v2');
  assert.equal(next.response.rates.axes.roll.rate, 95);
  assert.equal(next.frames.length, 0);
  assert.equal(original.response.format, 'FlightResponseProfile.v1');
});

test('Academy draft flight is unscored, cannot export a recording, and returns to its unchanged editor draft', async (t) => {
  const data = new Map();
  const h = await fixture(t, {
    storage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
  });
  let downloads = 0;
  h.win.URL.createObjectURL = () => {
    downloads++;
    return 'blob:unexpected-recording';
  };
  await openAcademyTuning(h);
  const algorithm = academyTuningControl(h, 'Rate algorithm', 'select');
  algorithm.value = 'actual';
  algorithm.emit('change');
  const camera = academyTuningControl(h, 'Vertical FOV (degrees)');
  camera.value = '108';
  camera.emit('input');
  await academyTuningClick(h, 'Test draft · unscored');
  await h.view.settled();
  assert.equal(h.doc.querySelector('.fpv-tuning').open, false);
  assert.equal(h.doc.querySelector('.tuning-return').hidden, false);
  assert.equal(h.view.arm(), true);
  h.tick(6);
  h.view.pause();
  h.$('export-attempt').click();
  assert.equal(downloads, 0);
  assert.equal(h.deliveries.length, 0);
  assert.equal(data.has('revealline.fpv.tuning.v1'), false);
  h.doc.querySelector('.tuning-return').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.doc.querySelector('.fpv-tuning').open, true);
  assert.equal(academyTuningControl(h, 'Rate algorithm', 'select').value, 'actual');
  assert.equal(academyTuningControl(h, 'Vertical FOV (degrees)').value, '108');
  await academyTuningClick(h, 'Revert draft');
  assert.equal(academyTuningControl(h, 'Rate algorithm', 'select').value, 'legacy');
});

test('Academy tuning owns menu navigation and Back closes it before the underlying settings', async (t) => {
  const h = await fixture(t, { home: true });
  h.win.getComputedStyle = h.doc.defaultView.getComputedStyle;
  h.$('academy-shell-action-settings').click();
  const settings = h.$('academy-shell-settings-dialog');
  assert.equal(settings.open, true);
  await openAcademyTuning(h);
  const tuning = h.doc.querySelector('.fpv-tuning');
  h.doc.emit('keydown', { key: 'Escape', code: 'Escape', target: tuning.querySelector('h2') });
  h.doc.emit('keyup', { key: 'Escape', code: 'Escape', target: h.doc.activeElement });
  assert.equal(tuning.open, false);
  assert.equal(settings.open, true);
  await openAcademyTuning(h);
  const pad = menuPad();
  h.setPads([pad]);
  h.tick(4);
  pad.buttons[0] = { pressed: true, value: 1 };
  h.tick(4);
  pad.buttons[0] = { pressed: false, value: 0 };
  h.tick(4);
  assert.equal(tuning.contains(h.doc.activeElement), true);
  h.tick(4); // The joined device establishes its neutral baseline before Back.
  pad.buttons[1] = { pressed: true, value: 1 };
  h.tick(4);
  pad.buttons[1] = { pressed: false, value: 0 };
  h.tick(4);
  assert.equal(tuning.open, false);
  assert.equal(settings.open, true);
});

test('Academy tuning keeps its hint through pointer blur and releases it after closing', async (t) => {
  const data = new Map();
  const h = await fixture(t, {
    home: true,
    storage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
  });
  h.$('academy-shell-action-settings').click();
  await openAcademyTuning(h);
  const tuning = h.doc.querySelector('.fpv-tuning');
  const name = academyTuningControl(h, 'Profile name');
  name.value = 'Pointer saved profile';
  name.focus();
  h.doc.emit('keydown', { key: 'Shift', code: 'ShiftLeft', target: name });
  const hint = tuning.querySelector('.sim-menu-hint');
  const instructions = hint.textContent;
  assert.ok(instructions.length > 0);
  const save = tuning
    .querySelectorAll('button')
    .find((node) => node.textContent === 'Save for next flight');
  save.emit('pointerdown');
  // Native focus changes can reach the window's blur listener during a pointer gesture.
  h.win.emit('blur', { target: name, bubbles: false });
  assert.equal(hint.textContent, instructions, 'pointer blur must not shrink the tuning dialog');
  assert.equal(hint.hidden, false);
  assert.equal(hint.parentElement, tuning);
  save.emit('pointerup');
  await academyTuningClick(h, 'Save for next flight');
  assert.ok(
    JSON.parse(data.get('revealline.fpv.tuning.v1')).profiles.some(
      (profile) => profile.name === 'Pointer saved profile',
    ),
  );
  h.win.emit('focus');
  await academyTuningClick(h, 'Close');
  h.doc.emit('keydown', { key: 'Shift', code: 'ShiftLeft', target: h.doc.activeElement });
  assert.equal(tuning.open, false);
  assert.equal(
    tuning.contains(hint),
    false,
    'the closed tuning dialog does not retain hint ownership',
  );
  assert.equal(h.$('academy-shell-settings-dialog').contains(hint), true);
});

for (const kind of ['legacy camera', 'saved drone camera', 'unreadable camera', 'missing camera']) {
  test(`Academy captures ${kind} before its first tuning configuration`, async (t) => {
    const { initialTuningLibrary } = await import(
      '../../optional-practice/civilian-fpv/tuning-library.mjs'
    );
    const response = {
      format: 'FlightResponseProfile.v1',
      id: 'historical',
      name: 'Historical',
      maxRate: 480,
      maxTilt: 42,
      expo: 45,
      responseTicks: 11,
    };
    const cameraKey = 'revealline.fpv.flight-comfort.v1.academy.camera';
    const data = new Map([
      [
        'revealline.flight-profiles.v1',
        JSON.stringify({ format: 'FlightProfiles.v1', radio: null, response }),
      ],
      [cameraKey, JSON.stringify({ fov: 108, tilt: 27 })],
    ]);
    if (kind === 'missing camera') data.delete(cameraKey);
    if (kind === 'saved drone camera')
      data.set(
        'revealline.fpv.tuning.v1',
        JSON.stringify(initialTuningLibrary({ response, camera: { tilt: 49, verticalFov: 121 } })),
      );
    const saved = data.get('revealline.fpv.tuning.v1');
    const h = await fixture(t, {
      storage: {
        getItem(key) {
          if (kind === 'unreadable camera' && key === cameraKey)
            throw new Error('Camera storage unavailable');
          return data.get(key) ?? null;
        },
        setItem: (key, value) => data.set(key, value),
      },
    });
    const expected =
      kind === 'saved drone camera'
        ? { tilt: 49, fov: 121 }
        : kind === 'legacy camera'
          ? { tilt: 27, fov: 108 }
          : { tilt: 10, fov: 82 };
    assert.equal(Number(h.$('camera-tilt').value), expected.tilt);
    assert.equal(Number(h.$('camera-fov').value), expected.fov);
    assert.deepEqual(h.view.exportAttempt().response, response);
    await openAcademyTuning(h);
    assert.equal(academyTuningControl(h, 'Camera tilt (degrees)').value, String(expected.tilt));
    assert.equal(academyTuningControl(h, 'Vertical FOV (degrees)').value, String(expected.fov));
    assert.equal(
      data.get('revealline.fpv.tuning.v1'),
      saved,
      'Opening must not persist or replace a library',
    );
    assert.deepEqual(JSON.parse(data.get('revealline.flight-profiles.v1')).response, response);
  });
}

const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };

test('explicit keyboard resume restores only the accepted throttle for the same flight', () => {
  const document = new Document(),
    window = new Events(),
    session = {};
  const input = createFlightInput({ window, document });
  try {
    input.enable(true);
    input.seedThrottle(0.53);
    window.emit('keydown', { code: 'KeyW', target: document.body });
    window.emit('keydown', { code: 'ArrowRight', target: document.body });
    assert.ok(
      input.sample(0.02).throttle > 0.53,
      'a proposal can be newer than the accepted input',
    );
    input.pause({ session, retainKeyboardThrottle: true });
    assert.deepEqual(input.sample(0.02), neutral, 'paused input remains neutral');
    input.pause({ session }); // Nested menu opening must not discard eligibility.
    input.resume(session, 0.53);
    window.emit('keydown', { code: 'KeyW', target: document.body, repeat: true });
    assert.deepEqual(input.sample(0.02), { ...neutral, throttle: 0.53 });
    assert.deepEqual(
      input.sample(0.02),
      { ...neutral, throttle: 0.53 },
      'released keys cannot ramp',
    );
  } finally {
    input.dispose();
  }
});

test('keyboard pause shortcut can retain explicit host eligibility after releasing its keys', () => {
  const document = new Document(),
    window = new Events(),
    session = {};
  let reason,
    active = true;
  const input = createFlightInput({
    window,
    document,
    onPause(value) {
      reason = value;
      input.pause({ session, retainKeyboardThrottle: active && value === 'paused' });
      active = false;
    },
  });
  try {
    input.enable(true);
    input.seedThrottle(0.53);
    window.emit('keydown', { code: 'KeyP', target: document.body });
    assert.equal(reason, 'paused');
    assert.deepEqual(input.sample(0.02), neutral);
    window.emit('keydown', { code: 'KeyP', target: document.body });
    assert.deepEqual(input.sample(0.02), neutral);
    input.resume(session, 0.53);
    assert.equal(input.sample(0.02).throttle, 0.53);
  } finally {
    input.dispose();
  }
});

test('lost ownership, reset and a different flight invalidate keyboard resume eligibility', () => {
  for (const invalidate of [
    ({ window }) => window.emit('blur'),
    ({ document }) => {
      document.hidden = true;
      document.emit('visibilitychange');
    },
    ({ input }) => {
      input.select('touch');
      input.select('keyboard');
    },
    ({ input }) => input.clear(),
    ({ input }) => input.enable(false),
    ({ input }) => input.ratesApplied(true),
    ({ input }) => input.keyboardPreset('classic'),
  ]) {
    const document = new Document(),
      window = new Events(),
      session = {};
    const input = createFlightInput({ window, document });
    try {
      input.enable(true);
      input.pause({ session, retainKeyboardThrottle: true });
      invalidate({ input, document, window });
      input.pause({ session }); // Opening another menu cannot recreate eligibility.
      input.resume(session, 0.53);
      assert.deepEqual(input.sample(0.02), neutral);
      input.pause({ session, retainKeyboardThrottle: true });
      input.resume({}, 0.53);
      assert.deepEqual(input.sample(0.02), neutral);
    } finally {
      input.dispose();
    }
  }
});

test('keyboard resume never grants another input owner throttle or changes checkpoint seeding', () => {
  for (const owner of ['touch', 'radio', 'controller']) {
    const document = new Document(),
      window = new Events(),
      session = {};
    const input = createFlightInput({ window, document });
    try {
      input.select(owner);
      input.enable(true);
      input.pause({ session, retainKeyboardThrottle: true });
      input.resume(session, 0.53);
      assert.deepEqual(input.sample(0.02), neutral);
      if (owner === 'touch') {
        input.seedThrottle(0.4);
        assert.equal(input.sample(0.02).throttle, 0.4, 'explicit checkpoint seeding is unchanged');
      }
    } finally {
      input.dispose();
    }
  }
});
