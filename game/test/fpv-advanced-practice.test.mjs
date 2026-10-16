import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { mountAdvancedPractice } from '../../optional-practice/civilian-fpv/advanced-practice.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import { createAdvancedSimulation } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';

class LocalWorker extends Events {
  static instances = [];
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.messages = [];
    this.terminated = false;
    this.handler = createAdvancedWorkerHandler((data) => {
      if (!this.terminated) this.emit('message', { data });
    });
    LocalWorker.instances.push(this);
  }
  postMessage(message) {
    this.messages.push(structuredClone(message));
    void this.handler.receive(message).finally(() => {
      if (this.terminated) this.handler.dispose();
    });
  }
  terminate() {
    this.terminated = true;
    this.handler.dispose();
  }
}

async function fixture(t, { waitReady = true, ...options } = {}) {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    timers = new Map();
  let serial = 0,
    now = 0,
    rendererDisposed = false;
  Object.assign(win, {
    performance: { now: () => now },
    Worker: LocalWorker,
    requestAnimationFrame(fn) {
      frames.set(++serial, fn);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    setTimeout(fn) {
      timers.set(++serial, fn);
      return serial;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  const container = doc.createElement('section');
  doc.body.append(container);
  const session = mountAdvancedPractice({
    container,
    window: win,
    rendererFactory: () => ({
      setPixelRatio() {},
      setSize() {},
      render() {},
      dispose() {
        rendererDisposed = true;
      },
    }),
    ...options,
  });
  t.after(() => session.dispose());
  const button = (text) =>
    container.querySelectorAll('button').find((node) => node.textContent === text);
  if (waitReady)
    await waitFor(() => button('Start practice') && !button('Start practice').disabled, {
      timeout: 5000,
    });
  return {
    doc,
    win,
    container,
    session,
    button,
    frames,
    timers,
    advanceClock: (ms) => {
      now += ms;
    },
    rendererDisposed: () => rendererDisposed,
  };
}

test('graphics loss and pagehide pause Advanced, clear held touch axes, and require explicit resume', async (t) => {
  const f = await fixture(t),
    canvas = f.container.querySelector('canvas');
  const roll = f.container
    .querySelectorAll('input')
    .find((node) => node.getAttribute('aria-label') === 'Roll');
  roll.value = '0.4';
  roll.emit('input');
  f.button('Start practice').emit('click');
  await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
  assert.ok(f.session.getTelemetry().requestedRates.roll > 0);
  const event = canvas.emit('webglcontextlost');
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.button('Start practice').disabled, true);
  assert.equal(f.timers.size, 0);
  assert.equal(roll.value, '0');
  canvas.emit('webglcontextrestored');
  assert.equal(f.button('Start practice').disabled, false);
  assert.equal(f.session.getTelemetry().missionTick, 1);
  f.advanceClock(1000);
  f.button('Start practice').emit('click');
  await waitFor(() => f.session.getTelemetry()?.missionTick === 2);
  assert.equal(f.session.getTelemetry().requestedRates.roll, 0);
  f.win.emit('pagehide');
  assert.equal(f.button('Pause').disabled, true);
  assert.equal(f.timers.size, 0);
  f.session.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.rendererDisposed(), true);
  assert.equal(LocalWorker.instances.at(-1).terminated, true);
});

test('editing and saving an aircraft leave the active worker frozen until explicit restart', async (t) => {
  const saves = [];
  const f = await fixture(t, { onSaveConfiguration: (configuration) => saves.push(configuration) });
  const worker = LocalWorker.instances.at(-1);
  const mass = f.container
    .querySelectorAll('label')
    .find((node) => node.textContent.startsWith('Mass (kg)'))
    .querySelector('input');
  mass.value = '0.8';
  mass.emit('input');
  f.button('Save aircraft for next flight').emit('click');
  await waitFor(() => saves.length === 1);
  assert.equal(saves[0].aircraft.mass, 0.8);
  assert.equal(worker.messages[0].options.aircraft.mass, 0.65);
  assert.equal(worker.messages.filter((message) => message.type === 'init').length, 1);
  assert.equal(worker.terminated, false);
  f.button('Restart practice').emit('click');
  await waitFor(
    () => LocalWorker.instances.at(-1) !== worker && !f.button('Start practice').disabled,
  );
  assert.equal(worker.terminated, true);
  assert.equal(LocalWorker.instances.at(-1).messages[0].options.aircraft.mass, 0.8);
  mass.value = '-1';
  mass.emit('input');
  const current = LocalWorker.instances.at(-1);
  f.button('Restart practice').emit('click');
  assert.equal(current.terminated, false);
  assert.equal(LocalWorker.instances.at(-1), current);
  f.button('Save aircraft for next flight').emit('click');
  assert.equal(saves.length, 1);
});

test('a pending aircraft save keeps later edits unsaved, ignores duplicate clicks and updates the revert baseline', async (t) => {
  let finish;
  const saves = [];
  const f = await fixture(t, {
    onSaveConfiguration(configuration) {
      saves.push(configuration);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const worker = LocalWorker.instances.at(-1),
    mass = f.container
      .querySelectorAll('label')
      .find((node) => node.textContent.startsWith('Mass (kg)'))
      .querySelector('input'),
    save = f.button('Save aircraft for next flight');
  mass.value = '0.8';
  mass.emit('input');
  save.emit('click');
  assert.equal(save.disabled, true);
  mass.value = '0.9';
  mass.emit('input');
  save.emit('click');
  assert.equal(saves.length, 1);
  finish();
  await waitFor(() => !save.disabled);
  assert.equal(saves[0].aircraft.mass, 0.8);
  assert.equal(mass.value, '0.9');
  assert.match(f.container.textContent, /Draft changed\. Restart practice to test it/);
  assert.doesNotMatch(f.container.textContent, /Aircraft and controller saved for the next flight/);
  assert.equal(worker.messages[0].options.aircraft.mass, 0.65);
  assert.equal(worker.messages.filter((message) => message.type === 'init').length, 1);
  assert.equal(worker.terminated, false);
  f.button('Revert aircraft draft').emit('click');
  assert.equal(mass.value, '0.8');
});

test('completing an older aircraft save cannot replace a newly selected template', async (t) => {
  let finish;
  const f = await fixture(t, {
    onSaveConfiguration: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const aircraft = f.container
      .querySelectorAll('label')
      .find((node) => node.textContent.startsWith('Aircraft template'))
      .querySelector('select'),
    save = f.button('Save aircraft for next flight'),
    worker = LocalWorker.instances.at(-1);
  save.emit('click');
  aircraft.value = 'whoop';
  aircraft.emit('change');
  finish();
  await waitFor(() => !save.disabled);
  assert.equal(aircraft.value, 'whoop');
  assert.match(f.container.textContent, /Draft changed\. Restart practice to test it/);
  f.button('Restart practice').emit('click');
  await waitFor(
    () => LocalWorker.instances.at(-1) !== worker && !f.button('Start practice').disabled,
  );
  assert.equal(LocalWorker.instances.at(-1).messages[0].options.aircraft.id, 'whoop');
  f.button('Revert aircraft draft').emit('click');
  assert.equal(aircraft.value, 'freestyle');
});

test('an incomplete aircraft edit survives a pending save and can revert to the saved values', async (t) => {
  let finish;
  const f = await fixture(t, {
    onSaveConfiguration: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const mass = f.container
      .querySelectorAll('label')
      .find((node) => node.textContent.startsWith('Mass (kg)'))
      .querySelector('input'),
    save = f.button('Save aircraft for next flight');
  mass.value = '0.8';
  mass.emit('input');
  save.emit('click');
  mass.value = '';
  mass.emit('input');
  finish();
  await waitFor(() => !save.disabled);
  assert.equal(mass.value, '');
  assert.match(f.container.textContent, /Draft changed\. Restart practice to test it/);
  f.button('Revert aircraft draft').emit('click');
  assert.equal(mass.value, '0.8');
});

test('failed aircraft saves retain edits and the old baseline, then allow a successful retry', async (t) => {
  let rejectSave, finish;
  const saves = [];
  const f = await fixture(t, {
    onSaveConfiguration(configuration) {
      saves.push(configuration);
      return new Promise((resolve, reject) => {
        finish = resolve;
        rejectSave = reject;
      });
    },
  });
  const mass = f.container
      .querySelectorAll('label')
      .find((node) => node.textContent.startsWith('Mass (kg)'))
      .querySelector('input'),
    save = f.button('Save aircraft for next flight');
  mass.value = '0.8';
  mass.emit('input');
  save.emit('click');
  rejectSave(new Error('Storage is full'));
  await waitFor(() => !save.disabled);
  assert.equal(mass.value, '0.8');
  assert.match(f.container.textContent, /Storage is full/);
  f.button('Revert aircraft draft').emit('click');
  assert.equal(mass.value, '0.65');
  mass.value = '0.9';
  mass.emit('input');
  save.emit('click');
  mass.value = '1';
  mass.emit('input');
  mass.value = '0.9';
  mass.emit('input');
  finish();
  await waitFor(() => !save.disabled);
  assert.equal(saves.length, 2);
  assert.equal(saves[1].aircraft.mass, 0.9);
  assert.match(f.container.textContent, /Aircraft and controller saved for the next flight/);
  mass.value = '1';
  mass.emit('input');
  f.button('Revert aircraft draft').emit('click');
  assert.equal(mass.value, '0.9');
});

for (const outcome of ['success', 'failure'])
  test(`closing Advanced while an aircraft save waits ignores its late ${outcome}`, async (t) => {
    let finish, rejectSave;
    const f = await fixture(t, {
      onSaveConfiguration: () =>
        new Promise((resolve, reject) => {
          finish = resolve;
          rejectSave = reject;
        }),
    });
    const root = f.session.element,
      worker = LocalWorker.instances.at(-1),
      save = f.button('Save aircraft for next flight');
    save.emit('click');
    f.session.dispose();
    const text = root.textContent;
    if (outcome === 'success') finish();
    else rejectSave(new Error('Storage is full'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(root.textContent, text);
    assert.equal(f.container.contains(root), false);
    assert.equal(save.disabled, true);
    assert.equal(worker.terminated, true);
  });

test('native inactivity pauses and releases the bridge; cancelled/failed shares keep a usable session', async (t) => {
  let inactive,
    removed = 0;
  const exports = [];
  const f = await fixture(t, {
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/optional-practice/civilian-fpv/' },
      loadBridge: async () => ({
        onInactive(callback) {
          inactive = callback;
          return () => {
            removed++;
          };
        },
        exportJSON(value) {
          exports.push(value);
          if (exports.length === 2) throw new Error('Share unavailable');
          return { status: 'cancelled' };
        },
      }),
    },
  });
  f.button('Start practice').emit('click');
  await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
  inactive();
  assert.equal(f.timers.size, 0);
  assert.equal(f.button('Start practice').disabled, false);
  f.button('Export practice recording').emit('click');
  await waitFor(() => exports.length === 1 && !f.button('Export practice recording').disabled);
  assert.equal(exports[0].name, 'advanced-practice.json');
  assert.match(f.container.textContent, /Sharing cancelled/);
  f.button('Export aircraft and controller').emit('click');
  await waitFor(() => exports.length === 2 && !f.button('Export aircraft and controller').disabled);
  assert.equal(JSON.parse(exports[1].text).format, 'AdvancedDroneConfiguration.v1');
  assert.match(f.container.textContent, /Could not export: Share unavailable/);
  f.button('Start practice').emit('click');
  await waitFor(() => f.session.getTelemetry()?.missionTick === 2);
  f.session.dispose();
  assert.equal(removed, 1);
});

test('native lifecycle setup fails closed and a late subscription cleans up after disposal', async (t) => {
  const failed = await fixture(t, {
    waitReady: false,
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/' },
      loadBridge: async () => {
        throw new Error('Native bridge missing');
      },
    },
  });
  await waitFor(() => failed.container.textContent.includes('Native bridge missing'));
  assert.equal(failed.button('Start practice').disabled, true);
  assert.equal(failed.session.getTelemetry(), null);
  let attach,
    removed = 0;
  const late = await fixture(t, {
    waitReady: false,
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/' },
      loadBridge: async () => ({
        onInactive: () =>
          new Promise((resolve) => {
            attach = resolve;
          }),
      }),
    },
  });
  await waitFor(() => typeof attach === 'function');
  late.session.dispose();
  attach(() => {
    removed++;
  });
  await waitFor(() => removed === 1);
  assert.equal(late.session.getTelemetry(), null);
});

test('configuration export cannot steal initialization while native lifecycle setup is pending', async (t) => {
  let attach,
    finishShare,
    exports = 0;
  const f = await fixture(t, {
    waitReady: false,
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/' },
      loadBridge: async () => ({
        onInactive: () =>
          new Promise((resolve) => {
            attach = resolve;
          }),
        exportJSON: () => {
          exports++;
          return new Promise((resolve) => {
            finishShare = resolve;
          });
        },
      }),
    },
  });
  await waitFor(() => typeof attach === 'function');
  assert.equal(f.button('Export aircraft and controller').disabled, true);
  f.button('Export aircraft and controller').emit('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(exports, 0);
  attach(() => {});
  await waitFor(() => !f.button('Start practice').disabled && f.session.getTelemetry());
  assert.equal(f.button('Export aircraft and controller').disabled, false);
  f.button('Export aircraft and controller').emit('click');
  await waitFor(() => exports === 1);
  finishShare({ status: 'cancelled' });
  await waitFor(() => !f.button('Export aircraft and controller').disabled);
  assert.equal(f.button('Restart practice').disabled, false);
  assert.ok(f.session.getTelemetry());
});

test('unsupported worker and graphics platforms keep flight disabled and return safely to tuning', async (t) => {
  for (const options of [
    { Worker: null, failure: 'requires Web Workers' },
    {
      Worker: class {
        constructor() {
          throw new Error('Worker blocked by Content Security Policy');
        }
      },
      failure: 'Worker blocked by Content Security Policy',
    },
    {
      rendererFactory() {
        throw new Error('WebGL is unavailable');
      },
      failure: 'WebGL is unavailable',
    },
  ]) {
    let returned = 0;
    const priorWorkers = LocalWorker.instances.length;
    const { failure, ...platform } = options;
    const f = await fixture(t, {
      ...platform,
      waitReady: false,
      onClose: () => returned++,
    });
    await waitFor(() => f.container.textContent.includes(failure));
    for (const label of [
      'Start practice',
      'Pause',
      'Restart practice',
      'Export practice recording',
    ])
      assert.equal(f.button(label).disabled, true, `${failure}: ${label}`);
    assert.equal(f.session.getTelemetry(), null);
    assert.equal(LocalWorker.instances.length, priorWorkers);
    f.button('Return to tuning').emit('click');
    assert.equal(returned, 1);
    assert.equal(f.container.children.length, 0);
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
  }
});

test('worker initialization failure remains explicit and closes its worker on return', async (t) => {
  let terminated = false;
  class UnavailableRuntimeWorker extends Events {
    postMessage(message) {
      queueMicrotask(() =>
        this.emit('message', {
          data: {
            id: message.id,
            session: message.session,
            error: 'WebAssembly compilation is unavailable',
          },
        }),
      );
    }
    terminate() {
      terminated = true;
    }
  }
  const f = await fixture(t, { waitReady: false, Worker: UnavailableRuntimeWorker });
  await waitFor(() => f.container.textContent.includes('WebAssembly compilation is unavailable'));
  assert.equal(f.button('Start practice').disabled, true);
  assert.equal(f.button('Export practice recording').disabled, true);
  assert.equal(f.session.getTelemetry(), null);
  f.button('Start practice').emit('click');
  assert.equal(f.session.getTelemetry(), null);
  f.button('Return to tuning').emit('click');
  assert.equal(terminated, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
});

test('practice retains its host-scoped module worker entry through restart', async (t) => {
  const workerURL = new URL(
    'https://example.test/revealline/optional-practice/fpv-worlds/advanced-worker.mjs',
  );
  const f = await fixture(t, { workerURL });
  const first = LocalWorker.instances.at(-1);
  assert.equal(first.url.href, workerURL.href);
  assert.equal(first.options.type, 'module');
  f.button('Start practice').click();
  await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
  f.button('Restart practice').click();
  await waitFor(
    () => LocalWorker.instances.at(-1) !== first && !f.button('Start practice').disabled,
  );
  const restarted = LocalWorker.instances.at(-1);
  assert.equal(first.terminated, true);
  assert.equal(restarted.url.href, workerURL.href);
  assert.equal(restarted.options.type, 'module');
  assert.equal(f.session.getTelemetry().missionTick, 0);
});

function comparisonRecording(options) {
  const simulation = createAdvancedSimulation(options),
    path = [simulation.telemetry()];
  try {
    for (let tick = 0; tick < 4; tick++) {
      simulation.enqueueInput({
        sequence: tick,
        timestampUs: tick * 20000,
        controls: { roll: 0.5, pitch: 0, yaw: 0, throttle: 0.1 },
      });
      path.push(simulation.stepMission().telemetry);
    }
    return { recording: simulation.recording(), path };
  } finally {
    simulation.dispose();
  }
}
function importComparison(f, source, fileOptions = {}) {
  const text = typeof source === 'string' ? source : JSON.stringify(source);
  const input = f.container.querySelector('input[type="file"]');
  input.files = [
    { size: new TextEncoder().encode(text).byteLength, text: async () => text, ...fileOptions },
  ];
  input.emit('change');
}
function renderComparison(f) {
  const [id, callback] = f.frames.entries().next().value;
  f.frames.delete(id);
  callback(1000);
}

test('arena imports a different-rate verified ghost, renders its own timeline and hides incompatible restarted setups', async (t) => {
  const workerURL = new URL(
    'https://example.test/revealline/optional-practice/fpv-worlds/advanced-worker.mjs',
  );
  const f = await fixture(t, { workerURL });
  const flightWorker = LocalWorker.instances.at(-1);
  const { recording, path } = comparisonRecording({
    ...flightWorker.messages[0].options,
    rateProfile: createRateProfile({ axes: { roll: { rate: 80 } } }),
  });
  importComparison(f, recording);
  await waitFor(() => f.session.getComparison()?.verified);
  const verifier = LocalWorker.instances.at(-1);
  assert.notEqual(verifier, flightWorker);
  assert.equal(verifier.url.href, workerURL.href);
  await waitFor(() => verifier.terminated);
  assert.equal(flightWorker.terminated, false);
  assert.equal(f.session.getTelemetry().missionTick, 0);
  assert.equal(f.session.getComparison().scored, false);
  assert.equal(f.session.getComparison().samples, 5);
  assert.equal(f.session.getComparison().visible, true);
  f.button('Start practice').click();
  await waitFor(() => f.session.getTelemetry().missionTick === 1);
  f.button('Pause').click();
  renderComparison(f);
  assert.deepEqual(f.session.getComparison().position, path[1].position);
  const checkbox = f.container.querySelector('input[type="checkbox"]');
  checkbox.checked = false;
  checkbox.emit('change');
  assert.equal(f.session.getComparison().visible, false);
  checkbox.checked = true;
  const mass = f.container
    .querySelectorAll('label')
    .find((node) => node.textContent.startsWith('Mass (kg)'))
    .querySelector('input');
  mass.value = '0.8';
  mass.emit('input');
  f.button('Restart practice').click();
  await waitFor(() => !f.button('Start practice').disabled);
  assert.equal(f.session.getComparison().visible, false);
  assert.match(f.container.textContent, /different comparison class/);
  f.button('Revert aircraft draft').click();
  assert.equal(mass.value, '0.65');
  f.button('Restart practice').click();
  await waitFor(() => !f.button('Start practice').disabled);
  assert.equal(f.session.getComparison().visible, true);
});

test('comparison import is bounded and atomic; failed or cancelled files preserve the previous reference', async (t) => {
  const f = await fixture(t);
  const { recording } = comparisonRecording(LocalWorker.instances.at(-1).messages[0].options);
  importComparison(f, recording);
  await waitFor(() => f.session.getComparison()?.verified);
  const reference = f.session.getComparison();
  let reads = 0;
  importComparison(f, recording, {
    size: 8 * 1024 * 1024 + 1,
    text: async () => {
      reads++;
      return '';
    },
  });
  await waitFor(() => f.container.textContent.includes('8 MiB import limit'));
  assert.equal(reads, 0);
  importComparison(f, { ...recording, finalHash: '00000000' });
  await waitFor(() => f.container.textContent.includes('final replay verification failed'));
  assert.deepEqual(f.session.getComparison(), reference);
  let release;
  importComparison(f, recording, {
    text: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  f.button('Cancel verification').click();
  release(JSON.stringify(recording));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.session.getComparison(), reference);
  assert.equal(f.button('Start practice').disabled, false);
  assert.match(f.container.textContent, /Verification cancelled/);
});

test('cancelling or closing comparison verification terminates its dedicated worker without stopping the flight worker', async (t) => {
  class PendingVerificationWorker extends LocalWorker {
    postMessage(message) {
      if (message.type === 'verify-recording') {
        this.messages.push(message);
        return;
      }
      super.postMessage(message);
    }
  }
  for (const close of [false, true]) {
    const f = await fixture(t, { Worker: PendingVerificationWorker });
    const flightWorker = LocalWorker.instances.at(-1);
    const { recording } = comparisonRecording(flightWorker.messages[0].options);
    importComparison(f, recording);
    await waitFor(() =>
      LocalWorker.instances.at(-1).messages.some((message) => message.type === 'verify-recording'),
    );
    const verifier = LocalWorker.instances.at(-1);
    if (close) f.session.dispose();
    else f.button('Cancel verification').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(verifier.terminated, true);
    assert.equal(flightWorker.terminated, close);
    assert.equal(f.session.getComparison(), null);
  }
});

test('repeatable maneuver cues use simulation time and a kept reference survives restart without saving a draft', async (t) => {
  const f = await fixture(t);
  const maneuver = f.container
    .querySelectorAll('label')
    .find((node) => node.textContent.startsWith('Repeatable practice'))
    .querySelector('select');
  maneuver.value = 'hover';
  maneuver.emit('change');
  assert.match(f.container.textContent, /Raise throttle gently/);
  f.advanceClock(30000);
  renderComparison(f);
  assert.match(f.container.textContent, /0.0 s · Raise throttle/);
  f.button('Start practice').click();
  await waitFor(() => f.session.getTelemetry().missionTick === 1);
  f.button('Keep this practice as reference').click();
  await waitFor(() => f.session.getComparison()?.verified);
  assert.equal(f.session.getComparison().missionTicks, 1);
  assert.equal(f.timers.size, 0);
  f.button('Restart practice').click();
  await waitFor(() => !f.button('Start practice').disabled);
  assert.equal(f.session.getTelemetry().missionTick, 0);
  assert.equal(f.session.getComparison().visible, true);
  assert.match(f.container.textContent, /0.0 s · Raise throttle/);
});
