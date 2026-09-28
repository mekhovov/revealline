import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { mountFlightApp } from '../../optional-practice/civilian-fpv/app.mjs';
import { createFlightInput } from '../../optional-practice/civilian-fpv/input.mjs';
import { createFlightRenderer } from '../../optional-practice/civilian-fpv/renderer.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { replayFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import { radioDeviceIdentity } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { mountFlightNotebook } from '../../optional-practice/civilian-fpv/notebook.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const html = parse(
  await readFile(
    new URL('../../optional-practice/civilian-fpv/index.html', import.meta.url),
    'utf8',
  ),
);
function fixture(t, { available = true, ...factories } = {}) {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    deliveries = [],
    renders = [];
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  function copy(source, parent) {
    if (!source.tagName) return;
    const element = doc.createElement(source.tagName);
    for (const attribute of source.attrs ?? []) {
      element.setAttribute(attribute.name, attribute.value);
      if (attribute.name === 'hidden') element.hidden = true;
      if (attribute.name === 'value') element.value = attribute.value;
    }
    parent.append(element);
    for (const child of source.childNodes ?? []) copy(child, element);
    if (source.tagName === 'select') element.value = element.children[0]?.value ?? '';
  }
  for (const child of body.childNodes) copy(child, doc.body);
  let id = 0,
    now = 0,
    lost,
    disposed = false,
    pads = [];
  Object.assign(win, {
    location: new URL('https://example.test/optional-practice/civilian-fpv/?lang=en'),
    navigator: { getGamepads: () => pads },
    requestAnimationFrame: (fn) => {
      frames.set(++id, fn);
      return id;
    },
    cancelAnimationFrame: (key) => frames.delete(key),
    matchMedia: () => ({ matches: false }),
    setTimeout: (fn) => fn(),
    URL: { createObjectURL: () => 'blob:flight-test', revokeObjectURL() {} },
  });
  Object.defineProperty(win, 'localStorage', {
    get() {
      throw new Error('No persistent test storage');
    },
  });
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
  return {
    doc,
    win,
    view,
    deliveries,
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

test('native optional shell lists twelve drills, uses exclusive keyboard input, and neutralizes blur/dialog/reset', (t) => {
  const f = fixture(t);
  assert.equal(f.$('course-list').children.length, 12);
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
  const f = fixture(t),
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
  assert.equal(f.deliveries.length, 1, f.$('status').textContent);
  assert.equal(f.deliveries[0].attempt.session, 'practice');
  assert.equal(f.deliveries[0].verification.proof.session, 'practice');
  assert.match(f.deliveries[0].verification.hash, /^[a-f0-9]{64}$/);
  assert.equal(replayFlight(FLIGHT_COURSES[0], f.deliveries[0].attempt).state.status, 'complete');
  assert.equal(f.$('complete').hidden, false);
  f.$('review').click();
  await f.view.settled();
  f.tick(example.frames.length + 4);
  assert.equal(f.deliveries.length, 1);
  f.$('try').click();
  assert.equal(f.view.snapshot().ticks, 0);
  assert.equal(f.view.snapshot().status, 'disarmed');
  f.$('watch').click();
  await f.view.settled();
  f.tick(example.frames.length + 4);
  assert.equal(f.deliveries.length, 1);
  assert.match(f.$('status').textContent, /Replay finished/);
  f.$('try').click();
  assert.equal(f.view.exportAttempt().frames.length, 0);
});

test('radio switch edges while blurred or hidden cannot rearm; return requires a fresh visible OFF then ON', (t) => {
  const f = fixture(t),
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
  const f = fixture(t, {
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
  assert.equal(f.view.snapshot().status, 'disarmed');
  assert.equal(f.view.exportAttempt().frames.length, 0);
});

test('Controls camera chooser and toolbar stay synchronized for the narrow layout', (t) => {
  const f = fixture(t);
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
    f = fixture(t, {
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
  f.view.radio.select(0);
  f.view.radio.setProfile(radioProfile(pad));
  f.view.radio.verify();
  f.$('help').click();
  f.$('studio-button').click();
  assert.equal(f.$('help-dialog').open, false);
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.revision = 'authoring-r2';
  preview(course);
  assert.equal(f.$('studio-dialog').open, false);
  assert.equal(f.view.exportAttempt().session, 'authoring');
  assert.equal(f.$('try').hidden, false);
  assert.equal(f.view.arm(), true);
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
  assert.equal(f.view.exportAttempt().session, 'practice');
  assert.equal(f.view.snapshot().status, 'disarmed');
});

test('radio loss pauses instead of borrowing keyboard and reset drops old throttle pickup', (t) => {
  const f = fixture(t),
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
  assert.equal(f.view.radio.status().pickup, null);
  assert.equal(f.view.arm(), false);
  assert.equal(f.view.radio.status().reason, 'throttle-high');
  pad.axes[3] = -1;
  assert.equal(f.view.arm(), true);
});

test('graphics failure leaves readable choices and never advances; context loss freezes an existing attempt', (t) => {
  const fallback = fixture(t, { available: false });
  assert.equal(fallback.$('fallback').hidden, false);
  assert.match(fallback.$('fallback').textContent, /WebGL/);
  fallback.$('arm').click();
  fallback.tick(5);
  assert.equal(fallback.view.snapshot().ticks, 0);
  assert.throws(() => fallback.view.review(FLIGHT_DEMONSTRATIONS[0]), /WebGL/);
  const live = fixture(t);
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
  const f = fixture(t),
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
  assert.equal(f.view.exportAttempt().session, 'practice');
  assert.equal(f.view.exportAttempt().frames.length, 0);
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
  node.emit('pointerdown', { pointerId: 1, clientX: 75, clientY: 25 });
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

test('full-length replay admission yields through the shared verifier and cannot earn a practice receipt', async (t) => {
  let yields = 0;
  const f = fixture(t, {
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
    const f = fixture(t, {
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
  const f = fixture(t, {
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

test('actual renderer detects unavailable WebGL without allocating a running fallback simulation', (t) => {
  t.mock.method(console, 'error', () => {});
  const document = new Document(),
    canvas = document.createElement('canvas');
  canvas.getContext = () => null;
  const result = createFlightRenderer({ canvas, window: { devicePixelRatio: 1 } });
  assert.equal(result.available, false);
  result.dispose();
});
