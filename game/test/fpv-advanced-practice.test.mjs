import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { mountAdvancedPractice } from '../../optional-practice/civilian-fpv/advanced-practice.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import {
  ADVANCED_MAX_SECONDS,
  ADVANCED_MISSION_HZ,
  ADVANCED_RECORDING_BYTES,
  createAdvancedSimulation,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import {
  createPresetConfiguration,
  applyAircraftComponents,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { DEFAULT_RESPONSE } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { createTuningLibraryStore } from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { createAircraftArchiveStore } from '../../optional-practice/civilian-fpv/aircraft-archive.mjs';
import { verifyAircraftArchive } from '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

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

test('aircraft arena keeps Legacy rates explicitly, applies preset starter rates by default, and saves a frozen draft', async (t) => {
  const preset = createPresetConfiguration('meteor75-analog-2022'),
    saves = [];
  const data = new Map();
  const store = createTuningLibraryStore({
    storage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
  });
  const f = await fixture(t, {
    configuration: preset,
    response: DEFAULT_RESPONSE,
    async onSaveConfiguration(value, metadata) {
      const current = store.snapshot();
      await store.saveAircraftConfiguration(
        {
          setupId: current.selectedSetupId,
          newProfileId: `aircraft-${saves.length}`,
          advanced: value,
          response: metadata.response,
          camera: { tilt: metadata.camera.tilt, verticalFov: metadata.camera.fov },
          preset: metadata.preset,
          components: metadata.components,
        },
        current.revision,
      );
      saves.push({ value, metadata });
    },
  });
  let worker = LocalWorker.instances.at(-1);
  assert.equal(worker.messages[0].options.aircraft.format, 'AdvancedAircraft.v2');
  assert.deepEqual(worker.messages[0].options.response.response, DEFAULT_RESPONSE);
  assert.equal(f.session.getTelemetry().frequency, 500);
  const chooseAircraft = f.container
    .querySelectorAll('select')
    .find((select) => select.children.some((option) => option.value === 'holybro-x650-v2'));
  const rates = f.container
    .querySelectorAll('select')
    .find((select) => select.children.some((option) => option.value === 'keep'));
  assert.equal(rates.value, 'defaults');
  rates.value = 'keep';
  chooseAircraft.value = 'holybro-x650-v2';
  chooseAircraft.emit('change');
  f.button('Restart practice').click();
  await waitFor(
    () => LocalWorker.instances.at(-1) !== worker && !f.button('Start practice').disabled,
  );
  worker = LocalWorker.instances.at(-1);
  assert.deepEqual(worker.messages[0].options.response.response, DEFAULT_RESPONSE);
  assert.equal(worker.messages[0].options.aircraft.id, 'holybro-x650-v2');
  rates.value = 'defaults';
  chooseAircraft.value = 'meteor75-analog-2022';
  chooseAircraft.emit('change');
  f.button('Save aircraft for next flight').click();
  await waitFor(() => saves.length === 1);
  assert.deepEqual(saves[0].metadata.response, preset.response);
  assert.equal(saves[0].value.aircraft.battery.depletion, false);
  assert.deepEqual(saves[0].metadata.camera, {
    tilt: preset.camera.tilt,
    fov: preset.camera.verticalFov,
  });
  assert.deepEqual(store.effective().camera, preset.camera);
  const savedSetup = store.snapshot().setups.find((setup) => setup.id === 'my-drone');
  assert.deepEqual(savedSetup.preset, preset.preset);
  assert.equal(savedSetup.components.presetId, preset.preset.id);
  assert.equal(savedSetup.components.cameraPayload.massGrams, 0);
  assert.equal(worker.messages[0].options.aircraft.id, 'holybro-x650-v2');
  f.button('Restart practice').click();
  await waitFor(
    () => LocalWorker.instances.at(-1) !== worker && !f.button('Start practice').disabled,
  );
  assert.deepEqual(
    LocalWorker.instances.at(-1).messages[0].options.response.response,
    preset.response,
  );
});

for (const rateModel of ['Actual', 'Legacy'])
  test(`Advanced preserves an unsaved component edit exactly once through save and revert with ${rateModel} rates`, async (t) => {
    const preset = createPresetConfiguration('meteor75-analog-2022');
    const draft = applyAircraftComponents(preset.aircraft, preset.components, {
      battery: preset.components.battery,
      cameraPayload: { massGrams: 4 },
    });
    const data = new Map();
    const store = createTuningLibraryStore({
      storage: {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
      },
    });
    await store.createPresetSetup({
      presetId: preset.preset.id,
      setupId: 'payload-whoop',
      profileId: 'payload-rates',
      rates: 'defaults',
    });
    let saved = false;
    const response = rateModel === 'Actual' ? preset.response : DEFAULT_RESPONSE;
    const f = await fixture(t, {
      configuration: { aircraft: draft.aircraft, controller: preset.controller },
      components: draft.components,
      response,
      camera: { tilt: preset.camera.tilt, fov: preset.camera.verticalFov },
      async onSaveConfiguration(advanced, metadata) {
        assert.equal(Object.hasOwn(metadata, 'preset'), false);
        const current = store.snapshot();
        await store.saveAircraftConfiguration(
          {
            setupId: current.selectedSetupId,
            newProfileId: 'saved-payload-rates',
            advanced,
            response: metadata.response,
            camera: { tilt: metadata.camera.tilt, verticalFov: metadata.camera.fov },
            components: metadata.components,
          },
          current.revision,
        );
        saved = true;
      },
    });
    const aircraft = f.container
      .querySelectorAll('select')
      .find((select) => select.children.some((option) => option.value === 'holybro-x650-v2'));
    aircraft.value = 'holybro-x650-v2';
    aircraft.emit('change');
    f.button('Revert aircraft draft').click();
    f.button('Save aircraft for next flight').click();
    await waitFor(() => saved);
    const setup = store.snapshot().setups.find((item) => item.id === 'payload-whoop');
    assert.equal(setup.components.cameraPayload.massGrams, 4);
    assert.equal(setup.advanced.aircraft.mass, preset.aircraft.mass + 0.004);
    assert.deepEqual(store.effective().response, response);
    const reopened = applyAircraftComponents(setup.advanced.aircraft, setup.components, {
      battery: setup.components.battery,
      cameraPayload: setup.components.cameraPayload,
    });
    assert.deepEqual(reopened.aircraft, draft.aircraft);
    assert.deepEqual(reopened.components, draft.components);
  });

test('aircraft preview reports insufficient thrust instead of a zero-percent hover point', async (t) => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  preset.aircraft.mass = 1;
  const f = await fixture(t, { configuration: preset, response: preset.response });
  assert.match(f.container.textContent, /Estimated hover throttle: Insufficient thrust for hover/);
});

test('aircraft arena archives its final tail, continues flying and retires its owner on restart', async (t) => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  const store = createAircraftArchiveStore({ indexedDB: managedIndexedDB().indexedDB });
  const workerURL = new URL(
    '../../optional-practice/fpv-worlds/advanced-worker.mjs',
    import.meta.url,
  );
  const f = await fixture(t, {
    configuration: preset,
    response: preset.response,
    archiveStore: store,
    workerURL,
  });
  f.win.Worker = LocalWorker;
  async function rowsWhen(predicate) {
    for (let i = 0; i < 500; i++) {
      const rows = await store.list();
      if (predicate(rows)) return rows;
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.fail('Arena archive did not settle');
  }
  assert.equal(f.container.querySelector('.aircraft-archive-controls').hidden, false);
  await rowsWhen((rows) => rows.length === 1);
  f.button('Start practice').click();
  await waitFor(() => f.session.getTelemetry().missionTick === 1);
  f.button('Finish current archive').click();
  const first = (await rowsWhen((rows) => rows[0].state === 'ended'))[0];
  assert.equal(first.endTick, 1);
  assert.equal(first.host, 'arena');
  assert.equal(
    (await verifyAircraftArchive(await store.exportPackage(first.id))).verificationScope,
    'complete-session',
  );
  await waitFor(() => !f.button('Start practice').disabled);
  f.button('Start practice').click();
  await waitFor(() => f.session.getTelemetry().missionTick === 2);
  f.button('Pause').click();
  f.button('Verify selected archive').click();
  await waitFor(() =>
    f.container.textContent.includes('Complete session physics verified from reset'),
  );
  assert.equal(LocalWorker.instances.at(-1).url, workerURL);
  assert.equal(LocalWorker.instances.at(-1).terminated, true);
  f.button('Restart practice').click();
  await rowsWhen((rows) => rows.length === 2);
  assert.equal(f.session.getTelemetry().missionTick, 0);
  const choose = f.container
    .querySelectorAll('select')
    .find((select) => select.children.some((option) => option.value === 'freestyle'));
  choose.value = 'freestyle';
  choose.emit('change');
  f.button('Restart practice').click();
  await waitFor(
    () =>
      !f.button('Start practice').disabled &&
      f.session.getTelemetry().backend === 'civilian-quad-advanced-experimental.v2',
  );
  assert.equal(f.container.querySelector('.aircraft-archive-controls').hidden, true);
  assert.equal((await store.list()).find((row) => row.id !== first.id).state, 'interrupted');
});

test('aircraft arena verifies checkpoint clips and retains usable practice controls', async (t) => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  const f = await fixture(t, { configuration: preset, response: preset.response });
  const options = LocalWorker.instances.at(-1).messages[0].options;
  f.button('Start practice').click();
  await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
  f.button('Pause').click();
  f.button('Keep this practice as reference').click();
  await waitFor(() => f.session.getComparison()?.verified);
  assert.equal(f.session.getComparison().samples, 2);
  assert.equal(f.session.getComparison().scored, false);
  assert.match(f.container.textContent, /starting checkpoint/);
  assert.equal(f.button('Start practice').disabled, false);
  const aircraft = f.container
    .querySelectorAll('select')
    .find((select) => select.children.some((option) => option.value === 'holybro-x650-v2'));
  aircraft.value = 'freestyle';
  aircraft.emit('change');
  let reads = 0;
  const { recording } = comparisonRecording(options);
  importComparison(f, recording, {
    size: 8 * 1024 * 1024 + 1,
    text: async () => {
      reads++;
      return JSON.stringify(recording);
    },
  });
  await waitFor(() => reads === 1 && !f.button('Start practice').disabled);
  assert.equal(f.session.getComparison().samples, 5);
});

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

test('uncoded and unknown worker failures do not reopen export or restart based on their text', async (t) => {
  for (const code of [undefined, 'UNRECOGNIZED_LIMIT']) {
    class FailedFlightWorker extends LocalWorker {
      postMessage(message) {
        if (message.type !== 'step') return super.postMessage(message);
        queueMicrotask(() =>
          this.emit('message', {
            data: {
              id: message.id,
              session: message.session,
              error: 'Advanced flight duration limit reached',
              code,
            },
          }),
        );
      }
    }
    const f = await fixture(t, { Worker: FailedFlightWorker });
    f.button('Start practice').emit('click');
    await waitFor(() => f.container.textContent.includes('Practice stopped:'));
    for (const label of ['Start practice', 'Restart practice', 'Export practice recording'])
      assert.equal(f.button(label).disabled, true);
    assert.equal(f.timers.size, 0);
    f.session.dispose();
  }
});

for (const [locale, labels] of [
  [
    'en',
    {
      start: 'Start practice',
      reset: 'Restart practice',
      record: 'Export practice recording',
      input: 'Input source',
      unavailable: 'Input unavailable. Practice is paused.',
    },
  ],
  [
    'uk',
    {
      start: 'Почати практику',
      reset: 'Почати заново',
      record: 'Експортувати запис практики',
      input: 'Джерело керування',
      unavailable: 'Керування недоступне. Практику призупинено.',
    },
  ],
])
  test(`an unavailable radio before start preserves the healthy session and keyboard restart (${locale})`, async (t) => {
    const f = await fixture(t, { locale, waitReady: false });
    await waitFor(() => !f.button(labels.start).disabled);
    const worker = LocalWorker.instances.at(-1);
    const input = f.container
      .querySelectorAll('select')
      .find((node) => node.parentNode.textContent.startsWith(labels.input));
    input.value = 'radio';
    input.emit('change');
    f.button(labels.start).click();
    assert.match(f.container.textContent, new RegExp(labels.unavailable));
    assert.equal(f.session.getTelemetry().missionTick, 0);
    assert.equal(
      worker.messages.some((message) => message.type === 'step'),
      false,
    );
    assert.equal(worker.terminated, false);
    for (const label of [labels.start, labels.reset, labels.record])
      assert.equal(f.button(label).disabled, false);
    input.value = 'keyboard';
    input.emit('change');
    f.button(labels.reset).click();
    await waitFor(() => !f.button(labels.start).disabled);
    assert.equal(worker.terminated, true);
    f.button(labels.start).click();
    await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
    assert.deepEqual(f.session.getTelemetry().calibratedInput, {
      roll: 0,
      pitch: 0,
      yaw: 0,
      throttle: 0,
    });
  });

for (const unavailable of ['missing', 'malformed', 'throws'])
  test(`radio input becoming ${unavailable} pauses before dispatch and preserves export and explicit resume`, async (t) => {
    let available = true;
    const exports = [];
    const f = await fixture(t, {
      getControls() {
        if (available) return { roll: 0.2, pitch: 0, yaw: 0, throttle: 0.05 };
        if (unavailable === 'throws') throw new Error('Input provider unavailable');
        return unavailable === 'missing'
          ? null
          : { roll: Number.NaN, pitch: 0, yaw: 0, throttle: 0 };
      },
      platformOptions: {
        locationRef: { href: 'capacitor://localhost/optional-practice/civilian-fpv/' },
        loadBridge: async () => ({
          onInactive: () => () => {},
          exportJSON(value) {
            exports.push(value);
            return { status: 'shared' };
          },
        }),
      },
    });
    const input = f.container
      .querySelectorAll('select')
      .find((node) => node.parentNode.textContent.startsWith('Input source'));
    input.value = 'radio';
    input.emit('change');
    f.button('Start practice').click();
    await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
    const worker = LocalWorker.instances.at(-1),
      before = f.session.getTelemetry();
    available = false;
    const [timer, callback] = f.timers.entries().next().value;
    f.timers.delete(timer);
    await callback();
    assert.match(f.container.textContent, /Input unavailable\. Practice is paused\./);
    assert.deepEqual(f.session.getTelemetry(), before);
    assert.equal(worker.messages.filter((message) => message.type === 'step').length, 1);
    assert.equal(worker.terminated, false);
    assert.equal(f.timers.size, 0);
    assert.equal(f.button('Pause').disabled, true);
    for (const label of [
      'Start practice',
      'Restart practice',
      'Export practice recording',
      'Keep this practice as reference',
    ])
      assert.equal(f.button(label).disabled, false);
    f.button('Export practice recording').click();
    await waitFor(() => exports.length === 1 && !f.button('Export practice recording').disabled);
    const record = JSON.parse(exports[0].text);
    assert.equal(record.missionTicks, 1);
    assert.equal((await replayAdvancedRecording(record)).verified, true);
    available = true;
    assert.equal(f.timers.size, 0);
    assert.deepEqual(f.session.getTelemetry(), before);
    f.button('Start practice').click();
    await waitFor(() => f.session.getTelemetry()?.missionTick === 2);
    assert.equal(LocalWorker.instances.at(-1), worker);
    assert.equal(
      worker.messages.filter((message) => message.type === 'step').at(-1).sample.sequence,
      1,
    );
  });

for (const limit of ['duration', 'recording'])
  test(
    `the real ${limit} limit preserves an exportable practice and requires explicit restart`,
    { timeout: 120000 },
    async (t) => {
      const exports = [];
      class PrimedWorker extends LocalWorker {
        postMessage(message) {
          // The rejected capacity mission retains its queued samples. Retry
          // that exact mission through the host, without replacing its last
          // high-cadence input with this fixture's neutral browser sample.
          if (message.type === 'step' && this.retryQueuedMission) {
            message = { ...message };
            delete message.sample;
          }
          super.postMessage(message);
        }
      }
      const f = await fixture(t, {
        Worker: PrimedWorker,
        platformOptions: {
          locationRef: { href: 'capacitor://localhost/optional-practice/civilian-fpv/' },
          loadBridge: async () => ({
            onInactive: () => () => {},
            exportJSON(value) {
              exports.push(value);
              return { status: 'shared' };
            },
          }),
        },
      });
      const worker = LocalWorker.instances.at(-1);
      f.button('Start practice').emit('click');
      await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
      f.session.pause();
      let id = 1000000;
      const request = async (type, fields = {}) => {
        const requestId = ++id;
        let response;
        const listener = ({ data }) => {
          if (data.id === requestId) response = data;
        };
        worker.addEventListener('message', listener);
        try {
          await worker.handler.receive({
            id: requestId,
            session: worker.messages[0].session,
            type,
            ...fields,
          });
          return response;
        } finally {
          worker.removeEventListener('message', listener);
        }
      };
      let stopped;
      if (limit === 'duration') {
        for (let tick = 1; tick < ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ - 1; tick++)
          assert.equal((await request('step')).error, undefined);
        f.button('Start practice').emit('click');
        await waitFor(
          () =>
            f.session.getTelemetry()?.missionTick === ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ,
        );
        const [timer, callback] = f.timers.entries().next().value;
        f.timers.delete(timer);
        callback();
      } else {
        let sequence = 0,
          timestampUs = 0,
          seed = 123;
        const random = () => {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          return (seed >>> 0) / 4294967296;
        };
        for (let tick = 1; tick < ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ; tick++) {
          for (let substep = 0; substep < 5; substep++) {
            timestampUs = (tick * 5 + substep) * 4000;
            assert.equal(
              (
                await request('input', {
                  sample: {
                    sequence: ++sequence,
                    timestampUs,
                    controls: {
                      roll: random() * 2 - 1,
                      pitch: random() * 2 - 1,
                      yaw: random() * 2 - 1,
                      throttle: random(),
                    },
                  },
                })
              ).error,
              undefined,
            );
          }
          stopped = await request('step');
          if (stopped.error) break;
        }
        assert.equal(stopped.code, 'ADVANCED_RECORDING_LIMIT');
        worker.retryQueuedMission = true;
        f.button('Start practice').emit('click');
      }
      await waitFor(() =>
        f.container.textContent.includes(
          limit === 'duration'
            ? 'flight reached its duration limit'
            : 'recording reached its capacity limit',
        ),
      );
      const before = f.session.getTelemetry();
      assert.equal(f.button('Start practice').disabled, true);
      assert.equal(f.button('Pause').disabled, true);
      assert.equal(f.button('Restart practice').disabled, false);
      assert.equal(f.button('Export practice recording').disabled, false);
      assert.equal(f.button('Keep this practice as reference').disabled, false);
      assert.equal(worker.terminated, false);
      assert.equal(f.timers.size, 0);
      f.win.emit('blur');
      f.container.querySelector('canvas').emit('webglcontextrestored');
      assert.equal(f.button('Start practice').disabled, true);
      const steps = worker.messages.filter((message) => message.type === 'step').length;
      f.button('Start practice').emit('click');
      assert.equal(worker.messages.filter((message) => message.type === 'step').length, steps);
      f.button('Export practice recording').emit('click');
      await waitFor(() => exports.length === 1 && !f.button('Export practice recording').disabled);
      const recording = JSON.parse(exports[0].text);
      assert.ok(recording.missionTicks > 0);
      assert.ok(new TextEncoder().encode(exports[0].text).byteLength < ADVANCED_RECORDING_BYTES);
      assert.equal((await replayAdvancedRecording(recording)).verified, true);
      assert.deepEqual(f.session.getTelemetry(), before);
      assert.equal(f.button('Start practice').disabled, true);
      if (limit === 'duration') {
        f.button('Keep this practice as reference').emit('click');
        await waitFor(() => f.session.getComparison()?.verified, { timeoutMs: 60000 });
        assert.equal(f.button('Start practice').disabled, true);
      }
      f.button('Restart practice').emit('click');
      await waitFor(() => !f.button('Start practice').disabled);
      assert.equal(worker.terminated, true);
      assert.equal(f.session.getTelemetry().missionTick, 0);
      f.button('Start practice').emit('click');
      await waitFor(() => f.session.getTelemetry()?.missionTick === 1);
    },
  );

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
