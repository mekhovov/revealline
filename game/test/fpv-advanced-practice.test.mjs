import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { mountAdvancedPractice } from '../../optional-practice/civilian-fpv/advanced-practice.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';

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
