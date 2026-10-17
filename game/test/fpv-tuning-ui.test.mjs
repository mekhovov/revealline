import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountFlightTuning } from '../../optional-practice/civilian-fpv/tuning-ui.mjs';
import {
  createTuningLibraryStore,
  TUNING_LIBRARY_KEY,
} from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import { exportNativeRateProfile } from '../../optional-practice/civilian-fpv/betaflight-import.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(
  t,
  { locale = 'en', getDiagnostics, locks, platformOptions, onAdvanced, camera } = {},
) {
  let currentLocale = locale;
  const document = new Document(),
    window = new Events(),
    data = new Map(),
    frames = new Map();
  document.createElementNS = (_namespace, tag) => document.createElement(tag);
  let nextFrame = 0;
  Object.assign(window, {
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const store = createTuningLibraryStore({ storage, locks, ...(camera ? { camera } : {}) }),
    applied = [],
    tested = [],
    saved = [],
    closed = [];
  const ui = mountFlightTuning({
    document,
    window,
    store,
    locale: () => currentLocale,
    getDiagnostics,
    platformOptions,
    onApply: (config) => applied.push(config),
    onTest: (config) => tested.push(config),
    onSaved: (config) => saved.push(config),
    onClose: (context) => closed.push(context),
    onAdvanced,
  });
  // The minimal DOM does not update a select when its first option's value is
  // assigned after insertion. Native HTML selects choose that first option.
  for (const select of ui.root.querySelectorAll('select'))
    if (select.selectedIndex < 0 && select.options.length) select.value = select.options[0].value;
  t.after(() => ui.dispose());
  ui.open();
  const find = (label, tag = 'input', scope = ui.root, type) => {
    const candidates = scope
      .querySelectorAll('label')
      .filter((node) => node._text === label)
      .flatMap((node) => node.querySelectorAll(tag))
      .filter((node) => !type || node.type === type);
    assert.ok(candidates[0], `Missing control: ${label} (${tag}/${type ?? ''})`);
    return candidates[0];
  };
  const click = async (label, scope = ui.root) => {
    const button = scope.querySelectorAll('button').find((node) => node.textContent === label);
    assert.ok(button, `Missing button: ${label}`);
    button.emit('click');
    await settle();
    if (label === 'Preview import') {
      for (
        let attempt = 0;
        attempt < 100 &&
        /Checking import source/.test(ui.root.querySelector('[role="status"]').textContent);
        attempt++
      )
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.doesNotMatch(
        ui.root.querySelector('[role="status"]').textContent,
        /Checking import source/,
        'Import hashing must finish before using the preview.',
      );
    }
  };
  const edit = (label, value, { tag = 'input', event = 'input', scope = ui.root, type } = {}) => {
    const node = find(label, tag, scope, type);
    node.value = String(value);
    node.emit(event);
    return node;
  };
  const axis = (name) =>
    ui.root
      .querySelectorAll('fieldset')
      .find((node) => node.querySelector('legend')?.textContent === name);
  const draft = async () => {
    await click('Export SIM rates');
    return JSON.parse(find('Paste CLI or a SIM rate profile', 'textarea').value).profile;
  };
  const frame = (time) => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(time);
  };
  return {
    document,
    window,
    storage,
    store,
    ui,
    applied,
    tested,
    saved,
    closed,
    find,
    click,
    edit,
    axis,
    draft,
    frame,
    frames,
    setLocale(value) {
      currentLocale = value;
      ui.refresh();
    },
  };
}

test('aircraft picker creates an independent editable setup with starter rates and applies it only on restart', async (t) => {
  const f = fixture(t);
  const original = f.store.snapshot();
  assert.equal(f.find('Aircraft preset', 'select').options.length, 12);
  assert.equal(f.find('Rates when selecting an aircraft', 'select').value, 'defaults');
  f.edit('Aircraft preset', 'meteor75-analog-2022', { tag: 'select', event: 'change' });
  assert.match(f.ui.root.textContent, /37.68/);
  assert.match(f.ui.root.textContent, /Specification-based estimate/);
  await f.click('Use this aircraft');
  assert.equal(f.store.snapshot().setups.length, 2);
  assert.equal(f.store.effective().advanced.aircraft.id, 'meteor75-analog-2022');
  assert.equal(f.store.effective().response.rates.axes.yaw.rate, 60);
  assert.deepEqual(f.store.snapshot().setups[0], original.setups[0]);
  assert.deepEqual(f.store.snapshot().profiles[0], original.profiles[0]);
  assert.equal(f.applied.length, 0);
  await f.click('Apply & restart');
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].advanced.aircraft.id, 'meteor75-analog-2022');
});

test('aircraft picker keeps complete current Legacy rates and restores saved custom aircraft after navigation', async (t) => {
  const f = fixture(t),
    legacy = f.store.effective().response;
  f.edit('Rates when selecting an aircraft', 'keep', { tag: 'select', event: 'change' });
  f.edit('Aircraft preset', 'holybro-x650-v2', { tag: 'select', event: 'change' });
  await f.click('Use this aircraft');
  const selected = f.store.snapshot().selectedSetupId;
  assert.deepEqual(f.store.effective().response, legacy);
  f.edit('Camera tilt (degrees)', '41', { event: 'change' });
  await f.click('Save drone assignment & camera');
  f.edit('Drone setup', 'my-drone', { tag: 'select', event: 'change' });
  await settle();
  f.edit('Drone setup', selected, { tag: 'select', event: 'change' });
  await settle();
  assert.equal(f.find('Camera tilt (degrees)').value, '41');
  assert.equal(f.store.effective().advanced.aircraft.mass, 3.2);
  f.edit('Rates when selecting an aircraft', 'defaults', { tag: 'select', event: 'change' });
  await f.click('Reset saved aircraft to its preset');
  assert.equal(f.find('Camera tilt (degrees)').value, '10');
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 30);
});

test('physical aircraft with retained Legacy feel can open Advanced without converting its response', async (t) => {
  const opened = [],
    f = fixture(t, { onAdvanced: (configuration) => opened.push(configuration) });
  const legacy = f.store.effective().response;
  f.edit('Rates when selecting an aircraft', 'keep', { tag: 'select', event: 'change' });
  f.edit('Aircraft preset', 'meteor75-analog-2022', { tag: 'select', event: 'change' });
  await f.click('Use this aircraft');
  f.edit('Physical camera payload', 'custom', { tag: 'select', event: 'change' });
  f.edit('Additional camera mass (g)', '4');
  await f.click('Advanced reference quad · experimental');
  assert.equal(opened.length, 1);
  assert.deepEqual(opened[0].response, legacy);
  assert.equal(opened[0].advanced.aircraft.format, 'AdvancedAircraft.v2');
  assert.ok(Math.abs(opened[0].advanced.aircraft.mass - 0.04168) < 1e-15);
  assert.deepEqual(f.store.effective().response, legacy);
  assert.equal(f.store.effective().advanced.aircraft.mass, 0.03768);
  assert.equal(opened[0].components.cameraPayload.massGrams, 4);
});

test('returning from an Advanced save reloads the saved component inventory without adding an unsaved payload twice', async (t) => {
  const opened = [],
    f = fixture(t, { onAdvanced: (configuration) => opened.push(configuration) });
  f.edit('Aircraft preset', 'meteor75-analog-2022', { tag: 'select', event: 'change' });
  await f.click('Use this aircraft');
  f.edit('Drone name', 'Pending custom name');
  f.edit('Physical camera payload', 'custom', { tag: 'select', event: 'change' });
  f.edit('Additional camera mass (g)', '4');
  await f.click('Advanced reference quad · experimental');
  const previous = f.store.snapshot();
  await f.store.saveAircraftConfiguration({
    setupId: previous.selectedSetupId,
    advanced: opened[0].advanced,
    response: opened[0].response,
    camera: opened[0].camera,
    components: opened[0].components,
  });
  f.ui.acceptOwnSave(previous.revision, { reloadAircraft: true });
  f.ui.open({ keepDraft: true });
  assert.equal(f.find('Drone name').value, 'Pending custom name');
  assert.equal(f.find('Additional camera mass (g)').value, '4');
  await f.click('Test draft · unscored');
  assert.ok(Math.abs(f.tested[0].advanced.aircraft.mass - 0.04168) < 1e-15);
  f.ui.open({ keepDraft: true });
  f.edit('Additional camera mass (g)', '5');
  await f.click('Save battery & physical camera');
  assert.ok(Math.abs(f.store.effective().advanced.aircraft.mass - 0.04268) < 1e-15);
  await f.click('Advanced reference quad · experimental');
  const preset = createPresetConfiguration('holybro-x650-v2'),
    beforeSelection = f.store.snapshot();
  await f.store.saveAircraftConfiguration({
    setupId: beforeSelection.selectedSetupId,
    newProfileId: 'x650-from-advanced',
    advanced: { aircraft: preset.aircraft, controller: preset.controller },
    response: preset.response,
    camera: preset.camera,
    preset: preset.preset,
    components: preset.components,
  });
  f.ui.acceptOwnSave(beforeSelection.revision, { reloadAircraft: true });
  f.ui.open({ keepDraft: true });
  assert.equal(f.find('Aircraft preset', 'select').value, 'holybro-x650-v2');
  assert.equal(f.find('Additional camera mass (g)').value, '0');
  await f.click('Test draft · unscored');
  assert.equal(f.tested[1].advanced.aircraft.mass, 3.2);
  assert.deepEqual(f.tested[1].response, preset.response);
  assert.deepEqual(f.tested[1].camera, preset.camera);
});

test('aircraft selection reports storage failure without changing the active setup or draft', async (t) => {
  const f = fixture(t),
    before = f.store.export();
  f.storage.setItem = () => {
    throw new Error('quota full');
  };
  await f.click('Use this aircraft');
  assert.equal(f.store.export(), before);
  assert.equal(f.applied.length, 0);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /quota full/);
});

test('aircraft controls and evidence refresh in Ukrainian without changing the selected preset', async (t) => {
  const f = fixture(t);
  f.edit('Aircraft preset', 'meteor75-pro-matrix', { tag: 'select', event: 'change' });
  f.setLocale('uk');
  assert.equal(f.find('Пресет дрона', 'select').value, 'meteor75-pro-matrix');
  assert.equal(f.find('Рейти під час вибору дрона', 'select').value, 'defaults');
  assert.match(f.ui.root.textContent, /Оцінка за характеристиками/);
  await f.click('Використати цей дрон');
  assert.equal(f.store.effective().advanced.aircraft.id, 'meteor75-pro-matrix');
});

test('battery and physical-camera drafts change the tested physics without changing a saved or current flight', async (t) => {
  const f = fixture(t);
  f.edit('Aircraft preset', 'meteor75-analog-2022', { tag: 'select', event: 'change' });
  await f.click('Use this aircraft');
  const original = f.store.effective();
  f.edit('Battery', 'custom', { tag: 'select', event: 'change' });
  f.edit('Battery capacity (mAh)', '600');
  f.edit('Battery mass (g)', '16');
  f.edit('Physical camera payload', 'custom', { tag: 'select', event: 'change' });
  f.edit('Additional camera mass (g)', '4');
  assert.match(f.ui.root.textContent, /44.98 g/);
  assert.equal(f.store.effective().advanced.aircraft.mass, original.advanced.aircraft.mass);
  await f.click('Test draft · unscored');
  assert.equal(f.tested.length, 1);
  assert.ok(Math.abs(f.tested[0].advanced.aircraft.mass - 0.04498) < 1e-15);
  assert.equal(f.tested[0].advanced.aircraft.battery.capacityAh, 0.6);
  assert.deepEqual(f.tested[0].advanced.controller, original.advanced.controller);
  assert.equal(f.store.effective().advanced.aircraft.mass, original.advanced.aircraft.mass);
  await f.click('Return to tuning', f.document.body);
  await f.click('Save battery & physical camera');
  const saved = f.store.effective();
  assert.ok(Math.abs(saved.advanced.aircraft.mass - 0.04498) < 1e-15);
  assert.equal(f.applied.length, 0);
  f.edit('Camera tilt (degrees)', '37');
  f.edit('Vertical FOV (degrees)', '110');
  await f.click('Save drone assignment & camera');
  assert.deepEqual(
    f.store.effective().advanced,
    saved.advanced,
    'View settings must not change physical payload',
  );
  f.edit('Battery', 'reference', { tag: 'select', event: 'change' });
  f.edit('Physical camera payload', 'none', { tag: 'select', event: 'change' });
  await f.click('Apply & restart');
  assert.equal(f.applied.length, 1);
  assert.deepEqual(f.applied[0].advanced, original.advanced);
});

test('incomplete component drafts survive navigation, reject saves and refresh their labels in Ukrainian', async (t) => {
  const f = fixture(t);
  await f.click('Use this aircraft');
  const selected = f.store.snapshot().selectedSetupId;
  f.edit('Battery', 'custom', { tag: 'select', event: 'change' });
  f.edit('Battery mass (g)', '');
  f.edit('Drone setup', 'my-drone', { tag: 'select', event: 'change' });
  await settle();
  f.edit('Drone setup', selected, { tag: 'select', event: 'change' });
  await settle();
  assert.equal(f.find('Battery mass (g)').value, '');
  const before = f.store.export();
  await f.click('Save battery & physical camera');
  assert.equal(f.store.export(), before);
  assert.equal(f.find('Battery mass (g)').getAttribute('aria-invalid'), 'true');
  f.setLocale('uk');
  assert.equal(f.find('Маса акумулятора (г)').value, '');
  assert.match(f.ui.root.textContent, /Оцінена|коректні значення/);
});

test('pointer opening restores focus to its trigger even when the browser did not focus it', async (t) => {
  const f = fixture(t);
  f.ui.close();
  const trigger = f.ui.button(f.document.body);
  f.document.body.focus();
  trigger.emit('click');
  await settle();
  assert.equal(f.ui.root.open, true);
  f.ui.close();
  assert.equal(f.document.activeElement, trigger);
});

test('native tuning downloads use JSON and inert CLI shares and retain text after cancellation', async (t) => {
  const exports = [];
  const f = fixture(t, {
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/optional-practice/civilian-fpv/' },
      loadBridge: async () => ({
        exportJSON(value) {
          exports.push(['json', value]);
          return { status: 'cancelled' };
        },
        exportText(value) {
          exports.push(['text', value]);
          return { status: 'shared' };
        },
      }),
    },
  });
  await f.click('New Actual profile');
  await f.click('Export SIM rates');
  const input = f.find('Paste CLI or a SIM rate profile', 'textarea');
  const original = input.value;
  await f.click('Download file');
  assert.equal(exports[0][0], 'json');
  assert.deepEqual(JSON.parse(exports[0][1].text), JSON.parse(original));
  assert.equal(input.value, original);
  assert.match(f.ui.root.textContent, /Sharing cancelled/);
  f.edit('Source / export firmware version', '2025.12.5', { tag: 'select', event: 'change' });
  await f.click('Export rate-only CLI');
  const cli = input.value;
  await f.click('Download file');
  assert.deepEqual(exports[1], ['text', { text: cli, name: 'fpv-tuning.txt' }]);
  assert.match(f.ui.root.textContent, /Shared with the selected app/);
});

test('a pending export cannot duplicate or report its late failure into a reopened editor', async (t) => {
  let failShare,
    exports = 0;
  const f = fixture(t, {
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/' },
      loadBridge: async () => ({
        exportJSON() {
          exports++;
          return new Promise((_resolve, reject) => {
            failShare = reject;
          });
        },
      }),
    },
  });
  await f.click('Backup complete library');
  await f.click('Download file');
  await f.click('Download file');
  assert.equal(exports, 1);
  await f.click('Close');
  f.ui.open();
  failShare(new Error('Old share failed'));
  await settle();
  assert.doesNotMatch(f.ui.root.textContent, /Old share failed/);
});

test('algorithm drafts retain native values and linked roll/pitch edits keep yaw independent', async (t) => {
  const f = fixture(t);
  assert.equal(f.find('Rate algorithm', 'select').value, 'legacy');
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Center sensitivity (°/s)', 180, { scope: f.axis('Roll'), type: 'number' });
  const link = f.find('Link roll and pitch edits');
  link.checked = true;
  link.emit('change');
  f.edit('Maximum rate (°/s)', 940, { scope: f.axis('Roll'), type: 'number' });
  assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Pitch'), 'number').value, '940');
  let profile = await f.draft();
  assert.equal(profile.axes.roll.rcRate, 18);
  assert.equal(profile.axes.roll.rate, 94);
  assert.equal(profile.axes.pitch.rate, 94);
  assert.equal(profile.axes.yaw.rate, 67);
  f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
  f.edit('RC rate', 1.25, { scope: f.axis('Roll'), type: 'number' });
  f.edit('Super rate', 0.73, { scope: f.axis('Roll'), type: 'number' });
  profile = await f.draft();
  assert.equal(profile.axes.roll.rcRate, 125);
  assert.equal(profile.axes.roll.rate, 73);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  profile = await f.draft();
  assert.equal(profile.axes.roll.rcRate, 18);
  assert.equal(profile.axes.roll.rate, 94);
  f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
  assert.equal((await f.draft()).axes.roll.rcRate, 125);
  assert.equal(f.store.snapshot().revision, 0, 'Draft editing must not save or apply settings.');
});

test('curve overlays, axis visibility and diagnostics show actual available measurements', async (t) => {
  const f = fixture(t, {
    getDiagnostics: () => ({
      raw: [0.2, -0.4],
      calibrated: { roll: 0.5, pitch: 0, yaw: -0.5 },
      achieved: { roll: 120, pitch: 0, yaw: -80 },
      sampleAgeMs: 12,
      cadenceHz: null,
    }),
  });
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  const svg = f.ui.root.querySelector('svg');
  assert.equal(svg.querySelectorAll('path').length, 6);
  assert.equal(
    svg.querySelectorAll('path').filter((path) => path.getAttribute('stroke-dasharray')).length,
    3,
  );
  const yaw = f.find('Yaw');
  yaw.checked = false;
  yaw.emit('change');
  assert.equal(svg.querySelectorAll('path').length, 4);
  f.frame(250);
  const diagnostics = f.ui.root.querySelector('[aria-label="Input diagnostics"]').textContent;
  assert.match(diagnostics, /"roll":185/);
  assert.match(diagnostics, /"roll":120/);
  assert.match(diagnostics, /Browser sample age \(ms\): 12/);
  assert.match(diagnostics, /cadence \(Hz\): unavailable/);
  const motion = f.find('Animate rotation preview');
  motion.checked = true;
  f.frame(500);
  f.frame(525);
  assert.notEqual(f.ui.root.querySelector('.tuning-quad').style.transform, 'rotateZ(0deg)');
});

test('save for next flight never invokes restart; apply and restart is a distinct explicit action', async (t) => {
  const f = fixture(t),
    active = f.store.effective();
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Save for next flight');
  assert.equal(f.applied.length, 0);
  assert.equal(f.saved.length, 1);
  assert.equal(f.ui.root.open, true);
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 91);
  assert.equal(active.response.format, 'FlightResponseProfile.v1');
  f.edit('Maximum rate (°/s)', 1020, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Apply & restart');
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].response.rates.axes.roll.rate, 102);
  assert.equal(f.ui.root.open, false);
});

test('unscored draft test returns to the same numeric and camera draft, then reverts without saving', async (t) => {
  const f = fixture(t),
    before = f.store.export();
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 850, { scope: f.axis('Yaw'), type: 'number' });
  f.edit('Camera tilt (degrees)', 32);
  f.edit('Vertical FOV (degrees)', 103);
  await f.click('Test draft · unscored');
  assert.equal(f.ui.root.open, false);
  assert.equal(f.ui.returnButton.hidden, false);
  assert.equal(f.tested.length, 1);
  assert.equal(f.tested[0].response.rates.axes.yaw.rate, 85);
  assert.deepEqual(f.tested[0].camera, { tilt: 32, verticalFov: 103 });
  assert.notEqual(
    f.tested[0].simulationIdentity,
    f.store.effective().simulationIdentity,
    'A draft must not carry the saved configuration identity.',
  );
  assert.deepEqual(f.closed.at(-1), { testing: true });
  assert.equal(f.store.export(), before);
  f.ui.returnButton.emit('click');
  await settle();
  assert.equal(f.ui.root.open, true);
  assert.equal(f.find('Camera tilt (degrees)').value, '32');
  assert.equal((await f.draft()).axes.yaw.rate, 85);
  await f.click('Revert draft');
  assert.equal(f.find('Rate algorithm', 'select').value, 'legacy');
  assert.equal(f.find('Camera tilt (degrees)').value, '10');
  assert.equal(f.store.export(), before);
});

test('drone drafts survive rate-profile changes, reopening and independent setup selection', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  const profileId = f.find('Rate profile', 'select').value;
  const original = f.store.snapshot().selectedSetupId;
  f.edit('Drone name', 'My pending drone');
  f.edit('Camera tilt (degrees)', 35);
  f.edit('Rates used by this drone', profileId, { tag: 'select', event: 'change' });
  f.edit('Rate profile', 'legacy-feel', { tag: 'select', event: 'change' });
  assert.equal(f.find('Drone name').value, 'My pending drone');
  assert.equal(f.find('Camera tilt (degrees)').value, '35');
  assert.equal(f.find('Rates used by this drone', 'select').value, profileId);
  await f.click('Close');
  f.ui.open();
  assert.equal(f.find('Camera tilt (degrees)').value, '35');
  f.edit('Rate profile', profileId, { tag: 'select', event: 'change' });
  await f.click('Save for next flight');
  assert.equal(f.store.effective().camera.tilt, 35);
  f.edit('Camera tilt (degrees)', 42);
  await f.click('Duplicate drone setup');
  const copy = f.store.snapshot().selectedSetupId;
  f.edit('Camera tilt (degrees)', 21);
  f.edit('Drone setup', original, { tag: 'select', event: 'change' });
  await settle();
  assert.equal(f.find('Camera tilt (degrees)').value, '42');
  await f.click('Revert draft');
  assert.equal(f.find('Camera tilt (degrees)').value, '35');
  f.edit('Drone setup', copy, { tag: 'select', event: 'change' });
  await settle();
  assert.equal(f.find('Camera tilt (degrees)').value, '21');
  await f.click('Save drone assignment & camera');
  assert.equal(f.store.effective().camera.tilt, 21);
  assert.equal(f.store.snapshot().setups.find((setup) => setup.id === original).camera.tilt, 35);
});

test('a retained drone draft cannot overwrite another tab and explicit refresh discards it', async (t) => {
  const f = fixture(t);
  f.edit('Camera tilt (degrees)', 35);
  await f.click('Close');
  const other = createTuningLibraryStore({ storage: f.storage });
  await other.saveSetup({ ...other.snapshot().setups[0], camera: { tilt: 45, verticalFov: 90 } });
  f.ui.open();
  assert.equal(f.find('Camera tilt (degrees)').value, '35');
  await f.click('Save drone assignment & camera');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /changed|predates/);
  assert.equal(other.effective().camera.tilt, 45);
  await f.click('Refresh library');
  assert.equal(f.find('Camera tilt (degrees)').value, '45');
});

for (const action of [
  'Save drone assignment & camera',
  'Save for next flight',
  'Apply & restart',
  'Duplicate drone setup',
  'Test draft · unscored',
  'Advanced reference quad · experimental',
])
  test(`${action} rejects incomplete or out-of-range camera values before changing a flight or library`, async (t) => {
    const advanced = [],
      f = fixture(t, { onAdvanced: (configuration) => advanced.push(configuration) });
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    const before = f.store.export();
    for (const [label, value, valid] of [
      ['Camera tilt (degrees)', '', '10'],
      ['Camera tilt (degrees)', '999', '10'],
      ['Camera tilt (degrees)', 'Infinity', '10'],
      ['Vertical FOV (degrees)', '', '82'],
      ['Vertical FOV (degrees)', '999', '82'],
    ]) {
      f.edit(label, value);
      await f.click(action);
      assert.equal(f.store.export(), before, `${label}=${value} must not change stored settings`);
      assert.equal(f.ui.root.open, true, 'The player can correct the value in the editor');
      assert.equal(f.find(label).value, value);
      assert.equal(f.find(label).getAttribute('aria-invalid'), 'true');
      assert.match(f.ui.root.querySelector('[role="status"]').textContent, /enter a value/);
      assert.equal(f.tested.length + f.applied.length + advanced.length, 0);
      assert.equal(f.closed.length, 0);
      f.edit(label, valid);
    }
  });

test('incomplete camera text survives independent draft navigation and leaves rate exports available', async (t) => {
  const f = fixture(t),
    original = f.store.snapshot().selectedSetupId;
  await f.click('Duplicate drone setup');
  const duplicate = f.store.snapshot().selectedSetupId;
  f.edit('Camera tilt (degrees)', '');
  f.edit('Vertical FOV (degrees)', '999');
  await f.click('New Actual profile');
  assert.equal(f.find('Camera tilt (degrees)').value, '');
  assert.equal(f.find('Vertical FOV (degrees)').value, '999');
  assert.equal((await f.draft()).algorithm, 'actual', 'Portable rates exclude camera settings');
  await f.click('Close');
  f.ui.open();
  assert.equal(f.find('Camera tilt (degrees)').value, '');
  assert.equal(f.find('Vertical FOV (degrees)').value, '999');
  f.edit('Drone setup', original, { tag: 'select', event: 'change' });
  await settle();
  assert.equal(f.find('Camera tilt (degrees)').value, '10');
  assert.equal(f.find('Vertical FOV (degrees)').value, '82');
  f.edit('Drone setup', duplicate, { tag: 'select', event: 'change' });
  await settle();
  assert.equal(f.find('Camera tilt (degrees)').value, '');
  assert.equal(f.find('Vertical FOV (degrees)').value, '999');
  await f.click('Revert draft');
  assert.equal(f.find('Camera tilt (degrees)').value, '10');
  assert.equal(f.find('Vertical FOV (degrees)').value, '82');
});

test('valid fractional camera migration, editing, testing and Advanced preview retain exact degrees', async (t) => {
  const advanced = [],
    camera = { tilt: 10.25, verticalFov: 82.5 },
    f = fixture(t, { camera, onAdvanced: (configuration) => advanced.push(configuration) });
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  assert.equal(f.find('Camera tilt (degrees)').step, 'any');
  assert.equal(f.find('Vertical FOV (degrees)').step, 'any');
  await f.click('Save drone assignment & camera');
  assert.deepEqual(f.store.effective().camera, camera);
  for (const value of ['', '32', '32.', '32.25']) {
    f.edit('Camera tilt (degrees)', value);
    assert.equal(f.find('Camera tilt (degrees)').value, value);
  }
  f.edit('Vertical FOV (degrees)', '103.75');
  await f.click('Test draft · unscored');
  assert.deepEqual(f.tested[0].camera, { tilt: 32.25, verticalFov: 103.75 });
  f.ui.open({ keepDraft: true });
  await f.click('Advanced reference quad · experimental');
  assert.deepEqual(advanced[0].camera, { tilt: 32.25, verticalFov: 103.75 });
  f.ui.open({ keepDraft: true });
  await f.click('Apply & restart');
  assert.deepEqual(f.applied[0].camera, { tilt: 32.25, verticalFov: 103.75 });
  assert.deepEqual(f.store.effective().camera, { tilt: 32.25, verticalFov: 103.75 });
});

for (const [algorithm, label, typed, normalized, field, stored] of [
  ['actual', 'Maximum rate (°/s)', '895', '900', 'rate', 90],
  ['quick', 'Maximum rate (°/s)', '895', '900', 'rate', 90],
  ['betaflight', 'RC rate', '1.235', '1.24', 'rcRate', 124],
])
  test(`${algorithm} numeric editing keeps partial text and commits representable units`, async (t) => {
    const f = fixture(t);
    f.edit('Rate algorithm', algorithm, { tag: 'select', event: 'change' });
    const scope = f.axis('Roll');
    const input = f.find(label, 'input', scope, 'number');
    for (const value of ['', typed.slice(0, 1), typed]) {
      input.value = value;
      input.emit('input');
      assert.equal(input.value, value, 'Typing is not rounded before committing the number');
    }
    input.emit('change');
    assert.equal(input.value, normalized);
    assert.equal(f.find(label, 'input', scope, 'range').value, normalized);
    assert.equal(input.getAttribute('aria-invalid'), null);
    await f.click('Save for next flight');
    assert.equal(f.store.effective().response.rates.axes.roll[field], stored);
  });

test('Save and Test commit pending numeric text, while blank values block stale-value saves', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', '895', { scope: f.axis('Roll'), type: 'number' });
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].response.rates.axes.roll.rate, 90);
  f.ui.open({ keepDraft: true });
  f.edit('Maximum rate (°/s)', '', { scope: f.axis('Roll'), type: 'number' });
  const revision = f.store.snapshot().revision;
  await f.click('Save for next flight');
  assert.equal(f.store.snapshot().revision, revision);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /enter a value/);
  f.edit('Maximum rate (°/s)', '920', { scope: f.axis('Roll'), type: 'number' });
  assert.equal(f.ui.root.querySelector('[role="status"]').textContent, '');
  await f.click('Save for next flight');
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 92);
});

for (const transition of ['algorithm', 'profile', 'close', 'locale', 'throttle version'])
  test(`unfinished rates survive ${transition} navigation and still block stale-value saves`, async (t) => {
    const f = fixture(t);
    await f.click('New Actual profile');
    const profileId = f.find('Rate profile', 'select').value;
    f.edit('Maximum rate (°/s)', '', { scope: f.axis('Roll'), type: 'number' });
    if (transition === 'algorithm') {
      f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
      f.edit('RC rate', 1.25, { scope: f.axis('Roll'), type: 'number' });
      assert.equal((await f.draft()).axes.roll.rcRate, 125);
      f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    } else if (transition === 'profile') {
      f.edit('Rate profile', 'legacy-feel', { tag: 'select', event: 'change' });
      f.edit('Rate profile', profileId, { tag: 'select', event: 'change' });
    } else if (transition === 'close') {
      f.ui.close();
      f.ui.open();
    } else if (transition === 'locale') {
      f.setLocale('uk');
      f.setLocale('en');
    } else {
      f.edit('Throttle curve version', 'betaflight-2025.12', { tag: 'select', event: 'change' });
    }
    const input = f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number');
    assert.equal(input.value, '');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Pitch'), 'number').value, '670');
    const before = f.store.export();
    for (const action of ['Save for next flight', 'Test draft · unscored']) {
      await f.click(action);
      assert.equal(f.store.export(), before);
      assert.equal(f.tested.length, 0);
      assert.match(f.ui.root.querySelector('[role="status"]').textContent, /enter a value/);
    }
    f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
    await f.click('Save for next flight');
    assert.equal(
      f.store.snapshot().profiles.find((p) => p.id === profileId).response.rates.axes.roll.rate,
      91,
    );
  });

test('algorithm drafts retain invalid ranges and fractional pending units without crossing algorithms', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', '3000', { scope: f.axis('Roll'), type: 'number' });
  f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
  f.edit('RC rate', '1.235', { scope: f.axis('Roll'), type: 'number' });
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').value, '3000');
  await f.click('Test draft · unscored');
  assert.equal(f.tested.length, 0);
  f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
  assert.equal(f.find('RC rate', 'input', f.axis('Roll'), 'number').value, '1.235');
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].response.rates.axes.roll.rcRate, 124);
  assert.equal(f.store.snapshot().revision, 0);
});

test('unfinished throttle and assistance fields survive repaint while linked edits replace their peer text', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Midpoint (%)', '', { type: 'number' });
  f.edit('Self-level maximum tilt (°)', '70', { type: 'number' });
  f.edit('Maximum rate (°/s)', '', { scope: f.axis('Pitch'), type: 'number' });
  f.setLocale('uk');
  f.setLocale('en');
  assert.equal(f.find('Midpoint (%)', 'input', f.ui.root, 'number').value, '');
  assert.equal(f.find('Self-level maximum tilt (°)', 'input', f.ui.root, 'number').value, '70');
  f.find('Link roll and pitch edits').checked = true;
  f.edit('Maximum rate (°/s)', 900, { scope: f.axis('Roll'), type: 'number' });
  f.edit('Midpoint (%)', 40, { type: 'number' });
  f.edit('Self-level maximum tilt (°)', 50, { type: 'number' });
  f.ui.close();
  f.ui.open();
  assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Pitch'), 'number').value, '900');
  await f.click('Save for next flight');
  assert.equal(f.store.effective().response.rates.axes.pitch.rate, 90);
  assert.equal(f.store.effective().response.rates.throttle.mid, 40);
  assert.equal(f.store.effective().response.maxTilt, 50);
});

for (const replacement of ['Revert draft', 'Restore revision to draft', 'Preview import'])
  test(`${replacement} explicitly replaces unfinished numeric drafts`, async (t) => {
    const f = fixture(t);
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    await f.click('Save for next flight');
    f.edit('Maximum rate (°/s)', 900, { scope: f.axis('Roll'), type: 'number' });
    await f.click('Save for next flight');
    f.edit('Maximum rate (°/s)', '', { scope: f.axis('Roll'), type: 'number' });
    if (replacement === 'Preview import') {
      const profile = createRateProfile();
      profile.axes.roll.rate = 88;
      f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(profile), {
        tag: 'textarea',
      });
    }
    await f.click(replacement);
    const expected =
      replacement === 'Revert draft' ? '900' : replacement === 'Preview import' ? '880' : '670';
    const input = f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number');
    assert.equal(input.value, expected);
    assert.equal(input.getAttribute('aria-invalid'), null);
    await f.click('Test draft · unscored');
    assert.equal(f.tested[0].response.rates.axes.roll.rate, Number(expected) / 10);
  });

test('committing untouched linked axes preserves unequal rates and a pending pitch edit wins', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 710, { scope: f.axis('Roll'), type: 'number' });
  f.edit('Maximum rate (°/s)', 830, { scope: f.axis('Pitch'), type: 'number' });
  f.find('Link roll and pitch edits').checked = true;
  const exported = await f.draft();
  assert.equal(exported.axes.roll.rate, 71);
  assert.equal(exported.axes.pitch.rate, 83);
  await f.click('Save for next flight');
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 71);
  assert.equal(f.store.effective().response.rates.axes.pitch.rate, 83);
  f.edit('Maximum rate (°/s)', '900', { scope: f.axis('Roll'), type: 'number' });
  f.edit('Maximum rate (°/s)', '830', { scope: f.axis('Pitch'), type: 'number' });
  const returned = await f.draft();
  assert.equal(
    returned.axes.roll.rate,
    83,
    'Returning the peer to its old value is a real linked edit',
  );
  assert.equal(returned.axes.pitch.rate, 83);
  f.edit('Maximum rate (°/s)', '895', { scope: f.axis('Pitch'), type: 'number' });
  await f.click('Test draft · unscored');
  assert.equal(f.tested[0].response.rates.axes.roll.rate, 90);
  assert.equal(f.tested[0].response.rates.axes.pitch.rate, 90);
});

test('import preview creates a new profile only on save and assignment remains explicit', async (t) => {
  const f = fixture(t),
    before = f.store.export();
  const source = exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 99 } } }));
  f.edit('Paste CLI or a SIM rate profile', source, { tag: 'textarea' });
  await f.click('Preview import');
  assert.equal(f.store.export(), before);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  f.edit('Profile name', 'Imported race rates');
  await f.click('Save import as new profile');
  const library = f.store.snapshot(),
    imported = library.profiles.find((item) => item.name === 'Imported race rates');
  assert.ok(imported);
  assert.equal(library.defaultProfileId, 'legacy-feel');
  assert.equal(library.setups[0].profileId, null);
  assert.equal(f.store.effective().profileId, 'legacy-feel');
  f.edit('Rates used by this drone', imported.id, { tag: 'select', event: 'change' });
  await f.click('Save drone assignment & camera');
  assert.equal(f.store.effective().profileId, imported.id);
});

test('malformed import or changed input invalidates an earlier preview and cannot create a profile', async (t) => {
  const f = fixture(t),
    initialCount = f.store.snapshot().profiles.length;
  f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
    tag: 'textarea',
  });
  await f.click('Preview import');
  f.edit('Paste CLI or a SIM rate profile', 'set roll_rc_rate = NaN', { tag: 'textarea' });
  await f.click('Preview import');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /must be an integer/);
  await f.click('Save import as new profile');
  assert.equal(f.store.snapshot().profiles.length, initialCount);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview the import first/);
});

test('headerless CLI version selection and firmware-default baseline support deliberate imports', async (t) => {
  const f = fixture(t);
  f.edit('Operation', 'diff', { tag: 'select', event: 'change' });
  f.edit('Paste CLI or a SIM rate profile', 'rateprofile 1\nset yaw_srate = 74', {
    tag: 'textarea',
  });
  await f.click('Preview import');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /source firmware version/);
  f.edit('Source / export firmware version', '4.5.2', { tag: 'select', event: 'change' });
  await f.click('Preview import');
  let profile = await f.draft();
  assert.equal(profile.axes.yaw.rate, 74);
  assert.equal(profile.throttle.model, 'betaflight-4.5');
  f.edit('Operation', 'patch', { tag: 'select', event: 'change' });
  f.edit('Patch baseline', 'defaults', { tag: 'select', event: 'change' });
  f.edit('Source / export firmware version', '2026.6.2', { tag: 'select', event: 'change' });
  f.edit('Paste CLI or a SIM rate profile', 'set thr_hover = 35\nset p_roll = 80', {
    tag: 'textarea',
  });
  await f.click('Preview import');
  profile = await f.draft();
  assert.equal(profile.throttle.hover, 35);
  assert.equal(profile.axes.yaw.rate, 67);
  assert.match(f.ui.root.textContent, /No verified SIM adapter/);
});

test('unsupported firmware headers invalidate a prior preview and cannot save against another version', async (t) => {
  const f = fixture(t),
    initial = f.store.export();
  f.edit('Operation', 'diff', { tag: 'select', event: 'change' });
  for (const version of ['3.5.7', '2026.6.2-dev', '2026.6.2+custom.1']) {
    f.edit('Source / export firmware version', '', { tag: 'select', event: 'change' });
    f.edit('Paste CLI or a SIM rate profile', '# Betaflight 2026.6.2\nset roll_srate = 83', {
      tag: 'textarea',
    });
    await f.click('Preview import');
    f.edit('Source / export firmware version', '2026.6.2', { tag: 'select', event: 'change' });
    f.edit('Paste CLI or a SIM rate profile', `# Betaflight ${version}\nset roll_srate = 90`, {
      tag: 'textarea',
    });
    await f.click('Preview import');
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /conflicts with the file header/,
    );
    await f.click('Save import as new profile');
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /Preview the import first/,
    );
    assert.equal(f.store.export(), initial);
  }
});

test('shared profile users, name history and per-drone vertical camera values remain visible', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  f.edit('Profile name', 'My Actual');
  await f.click('Save for next flight');
  await f.click('Make player default');
  assert.match(f.ui.root.textContent, /Shared by: My drone · player default/);
  f.edit('Camera tilt (degrees)', 29);
  f.edit('Vertical FOV (degrees)', 105);
  await f.click('Save drone assignment & camera');
  await f.click('Duplicate drone setup');
  assert.equal(f.store.snapshot().setups.length, 2);
  assert.equal(f.store.effective().camera.verticalFov, 105);
  const portable = await f.draft();
  assert.equal(Object.hasOwn(portable, 'camera'), false);
  assert.equal(f.find('Saved revisions', 'select').querySelectorAll('option').length, 1);
  await f.click('Restore revision to draft');
  assert.equal(f.find('Profile name').value, 'New profile');
  assert.equal(
    f.store.snapshot().profiles.find((item) => item.id === f.find('Rate profile', 'select').value)
      .name,
    'My Actual',
  );
});

test('stale tab notification preserves the draft and a save cannot overwrite newer stored settings', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
  const other = createTuningLibraryStore({ storage: f.storage });
  await other.createProfile({ id: 'other-tab', name: 'Other tab' });
  f.window.emit('storage', { key: TUNING_LIBRARY_KEY });
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Another tab/);
  await f.click('Save for next flight');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Another tab/);
  assert.equal((await f.draft()).axes.roll.rate, 91);
  assert.equal(
    JSON.parse(f.storage.getItem(TUNING_LIBRARY_KEY)).profiles[0].response.format,
    'FlightResponseProfile.v1',
  );
  await f.click('Refresh library');
  assert.equal(f.store.snapshot().profiles.length, 2);
});

test('Ukrainian controls retain accessible dialog labels and dispose removes listeners and animation', async (t) => {
  const f = fixture(t, { locale: 'uk' });
  assert.equal(f.ui.root.getAttribute('aria-label'), 'Дрон, рейти й газ');
  assert.ok(f.find('Вертикальне поле зору (градуси)'));
  assert.ok(f.ui.root.querySelector('[role="status"]'));
  assert.equal(f.frames.size, 1);
  const parent = f.document.createElement('div');
  f.document.body.append(parent);
  f.ui.button(parent);
  f.ui.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(parent.querySelectorAll('button').length, 0);
  assert.equal(f.window.listeners.get('storage').size, 0);
  assert.equal(f.ui.root.isConnected, false);
});

test('Apply and restart explicitly assigns an otherwise unassigned new profile to the current drone', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  const selected = f.find('Rate profile', 'select').value;
  assert.notEqual(selected, 'legacy-feel');
  assert.equal(f.store.effective().profileId, 'legacy-feel');
  await f.click('Apply & restart');
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].profileId, selected);
  assert.equal(f.store.snapshot().setups[0].profileId, selected);
  assert.equal(f.store.snapshot().defaultProfileId, 'legacy-feel');
});

for (const uploadedRoot of ['firmware-presets', 'presets'])
  test(`local preset folder upload resolves official paths from ${uploadedRoot} and refreshes selected options`, async (t) => {
    const f = fixture(t);
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    const sources = {
      'presets/test/main.txt':
        '#$ INCLUDE: presets/test/base.txt\n#$ OPTION BEGIN (CHECKED): Fast yaw\nset yaw_srate = 90\n#$ OPTION END',
      'presets/test/base.txt': 'set yaw_srate = 80',
    };
    const file = f.find('Local preset folder');
    file.files = Object.entries(sources).map(([path, source]) => ({
      name: path.split('/').at(-1),
      size: source.length,
      webkitRelativePath: uploadedRoot === 'presets' ? path : `${uploadedRoot}/${path}`,
      text: async () => source,
    }));
    file.emit('change');
    await settle();
    assert.equal(f.find('Preset entry path within folder').value, 'presets/test/main.txt');
    await f.click('Resolve preset and review options');
    const option = f.find('Fast yaw');
    assert.equal(option.checked, true);
    await f.click('Preview import');
    assert.equal((await f.draft()).axes.yaw.rate, 90);
    option.checked = false;
    option.emit('change');
    await f.click('Resolve preset and review options');
    await f.click('Preview import');
    assert.equal((await f.draft()).axes.yaw.rate, 80);
    assert.equal(f.store.snapshot().revision, 0);
  });

async function uploadPresetFiles(f, sources) {
  const file = f.find('Local preset folder');
  file.files = Object.entries(sources).map(([path, source]) => ({
    name: path.split('/').at(-1),
    size: source.length,
    webkitRelativePath: `bundle/${path}`,
    text: async () => source,
  }));
  file.emit('change');
  await settle();
}
const optionalYawPreset =
  'set yaw_srate = 80\n#$ OPTION BEGIN (CHECKED): Fast yaw\nset yaw_srate = 90\n#$ OPTION END';

for (const previewFirst of [false, true])
  test(`changed preset options require resolution before preview/save (${previewFirst ? 'existing preview' : 'resolved text'})`, async (t) => {
    const f = fixture(t);
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    await uploadPresetFiles(f, { 'main.txt': optionalYawPreset });
    await f.click('Resolve preset and review options');
    if (previewFirst) await f.click('Preview import');
    const option = f.find('Fast yaw');
    option.checked = false;
    option.emit('change');
    const before = f.store.export();
    await f.click('Preview import');
    assert.match(f.ui.root.textContent, /Resolve the preset again before previewing/);
    await f.click('Save import as new profile');
    assert.match(f.ui.root.textContent, /Preview the import first/);
    assert.equal(f.store.export(), before);
    await f.click('Resolve preset and review options');
    await f.click('Preview import');
    await f.click('Save import as new profile');
    const imported = f.store.snapshot().profiles.at(-1);
    assert.equal(imported.response.rates.axes.yaw.rate, 80);
    assert.equal(imported.provenance.source.kind, 'preset');
    assert.match(imported.provenance.preset.options.entries[0], /"checked":false/);
  });

test('choosing a different preset entry discards old option choices and controls', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  await uploadPresetFiles(f, {
    'main.txt': optionalYawPreset,
    'other.txt': 'set roll_srate = 72',
  });
  await f.click('Resolve preset and review options');
  const option = f.find('Fast yaw');
  option.checked = false;
  option.emit('change');
  f.edit('Preset entry path within folder', 'other.txt');
  assert.equal(f.ui.root.contains(option), false);
  await f.click('Preview import');
  assert.match(f.ui.root.textContent, /Resolve the preset again before previewing/);
  await f.click('Resolve preset and review options');
  assert.doesNotMatch(f.ui.root.textContent, /Unknown preset option/);
  await f.click('Preview import');
  await f.click('Save import as new profile');
  const imported = f.store.snapshot().profiles.at(-1);
  assert.equal(imported.response.rates.axes.roll.rate, 72);
  assert.equal(imported.provenance.preset.entry, 'other.txt');
  assert.equal(imported.provenance.preset.options.total, 0);
});

test('failed preset resolution cannot preview stale text, while deliberate pasted CLI replaces the preset', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  await uploadPresetFiles(f, { 'main.txt': optionalYawPreset });
  await f.click('Resolve preset and review options');
  f.edit('Preset entry path within folder', 'missing.txt');
  await f.click('Resolve preset and review options');
  assert.match(f.ui.root.textContent, /Missing preset file/);
  await f.click('Preview import');
  assert.match(f.ui.root.textContent, /Resolve the preset again before previewing/);
  assert.equal(f.store.snapshot().profiles.length, 1);
  f.edit('Paste CLI or a SIM rate profile', 'set yaw_srate = 61', { tag: 'textarea' });
  await f.click('Preview import');
  await f.click('Save import as new profile');
  const imported = f.store.snapshot().profiles.at(-1);
  assert.equal(imported.response.rates.axes.yaw.rate, 61);
  assert.equal(imported.provenance.source.kind, 'cli');
});

for (const failure of ['quota', 'stale tab'])
  test(`failed drone selection restores the visible selection and retains drafts (${failure})`, async (t) => {
    const f = fixture(t);
    await f.store.saveSetup({
      id: 'second-drone',
      name: 'Second drone',
      profileId: null,
      camera: { tilt: 25, verticalFov: 95 },
    });
    await f.click('Refresh library');
    f.edit('Drone name', 'Unsaved first drone');
    f.edit('Camera tilt (degrees)', 23);
    const write = f.storage.setItem;
    if (failure === 'quota')
      f.storage.setItem = () => {
        throw new Error('Quota exceeded');
      };
    else {
      const other = createTuningLibraryStore({ storage: f.storage });
      await other.saveProfile('legacy-feel', { name: 'Other tab saved' });
    }
    const stored = f.storage.getItem(TUNING_LIBRARY_KEY);
    f.edit('Drone setup', 'second-drone', { tag: 'select', event: 'change' });
    await settle();
    assert.match(f.ui.root.textContent, failure === 'quota' ? /Quota exceeded/ : /Another tab/);
    assert.equal(f.find('Drone setup', 'select').value, 'my-drone');
    assert.equal(f.store.snapshot().selectedSetupId, 'my-drone');
    assert.equal(f.find('Drone name').value, 'Unsaved first drone');
    assert.equal(f.find('Camera tilt (degrees)').value, '23');
    assert.equal(f.storage.getItem(TUNING_LIBRARY_KEY), stored);
    assert.equal(f.saved.length, 0);
    f.storage.setItem = write;
    if (failure === 'quota') {
      await f.click('Save drone assignment & camera');
      const setups = f.store.snapshot().setups;
      assert.equal(setups[0].name, 'Unsaved first drone');
      assert.equal(setups[0].camera.tilt, 23);
      assert.equal(setups[1].name, 'Second drone');
    } else {
      await f.click('Save drone assignment & camera');
      assert.match(f.ui.root.textContent, /Another tab/);
      assert.equal(f.storage.getItem(TUNING_LIBRARY_KEY), stored);
      await f.click('Refresh library');
    }
    f.edit('Drone setup', 'second-drone', { tag: 'select', event: 'change' });
    await settle();
    assert.equal(f.find('Drone setup', 'select').value, 'second-drone');
    assert.equal(f.find('Drone name').value, 'Second drone');
  });

test('duplicating a drone creates and selects its draft in one storage write', async (t) => {
  const f = fixture(t);
  await f.click('Save drone assignment & camera');
  const original = f.store.snapshot().setups[0];
  f.edit('Drone name', 'Draft drone');
  f.edit('Camera tilt (degrees)', 31);
  const write = f.storage.setItem;
  let writes = 0;
  f.storage.setItem = (key, value) => {
    if (++writes > 1) throw new Error('Unexpected second write');
    write(key, value);
  };
  await f.click('Duplicate drone setup');
  assert.equal(writes, 1);
  const library = f.store.snapshot();
  assert.equal(library.setups.length, 2);
  assert.deepEqual(library.setups[0], original);
  assert.equal(library.selectedSetupId, library.setups[1].id);
  assert.equal(f.find('Drone setup', 'select').value, library.setups[1].id);
  assert.equal(f.find('Drone setup', 'select').options.length, 2);
  assert.equal(library.setups[1].name, 'Draft drone copy');
  assert.equal(library.setups[1].camera.tilt, 31);
  assert.doesNotMatch(f.ui.root.querySelector('[role="status"]').textContent, /Could not apply/);
});

for (const failure of ['quota', 'stale tab', 'invalid camera'])
  test(`failed drone duplication preserves the library and editable draft (${failure})`, async (t) => {
    const f = fixture(t);
    await f.click('Save drone assignment & camera');
    f.edit('Drone name', 'Unsaved drone');
    f.edit('Camera tilt (degrees)', failure === 'invalid camera' ? '' : '31');
    const write = f.storage.setItem;
    if (failure === 'quota')
      f.storage.setItem = () => {
        throw new Error('Quota exceeded');
      };
    else if (failure === 'stale tab') {
      const other = createTuningLibraryStore({ storage: f.storage });
      await other.saveProfile('legacy-feel', { name: 'Other tab saved' });
    }
    const stored = f.storage.getItem(TUNING_LIBRARY_KEY),
      before = f.store.export();
    await f.click('Duplicate drone setup');
    assert.equal(f.store.export(), before);
    assert.equal(f.storage.getItem(TUNING_LIBRARY_KEY), stored);
    assert.equal(f.find('Drone setup', 'select').value, 'my-drone');
    assert.equal(f.find('Drone name').value, 'Unsaved drone');
    assert.equal(f.find('Camera tilt (degrees)').value, failure === 'invalid camera' ? '' : '31');
    assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Could not apply/);
    if (failure === 'quota') {
      f.storage.setItem = write;
      await f.click('Duplicate drone setup');
      assert.equal(f.store.snapshot().setups.length, 2);
      assert.notEqual(f.store.snapshot().selectedSetupId, 'my-drone');
      assert.equal(
        f.ui.root.querySelector('[role="status"]').textContent,
        'Drone setup duplicated and selected.',
      );
      f.setLocale('uk');
      assert.equal(
        f.ui.root.querySelector('[role="status"]').textContent,
        'Налаштування дрона продубльовано й вибрано.',
      );
    }
  });

test('ordinary tuning and camera saves preserve a drone’s existing Advanced aircraft and controller', async (t) => {
  const { validateAdvancedAircraft, createAdvancedAircraftTune } = await import(
    '../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const f = fixture(t);
  const advanced = {
    aircraft: validateAdvancedAircraft('whoop'),
    controller: createAdvancedAircraftTune('whoop'),
  };
  const previousRevision = f.store.snapshot().revision;
  await f.store.saveSetup({ ...f.store.snapshot().setups[0], advanced });
  f.ui.acceptOwnSave(previousRevision);
  f.ui.close();
  f.ui.open();
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Camera tilt (degrees)', 37);
  await f.click('Save for next flight');
  assert.deepEqual(f.store.effective().advanced, advanced);
  assert.equal(f.store.effective().camera.tilt, 37);
  assert.equal(f.store.effective().response.rates.algorithm, 'actual');
  f.edit('Vertical FOV (degrees)', 111);
  await f.click('Save drone assignment & camera');
  assert.deepEqual(f.store.effective().advanced, advanced);
  assert.equal(f.store.effective().camera.verticalFov, 111);
});

test('a retained draft reopened after another tab edits the same profile cannot overwrite the newer revision', async (t) => {
  const { createTunedResponse } = await import(
    '../../optional-practice/civilian-fpv/flight-response.mjs'
  );
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 990, { scope: f.axis('Roll'), type: 'number' });
  f.ui.close();
  const other = createTuningLibraryStore({ storage: f.storage });
  await other.saveProfile('legacy-feel', {
    name: 'Newer edit in another tab',
    response: createTunedResponse(createRateProfile({ axes: { roll: { rate: 51 } } })),
  });
  const newerSaved = f.storage.getItem(TUNING_LIBRARY_KEY);
  f.ui.open();
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /predates a library change/);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  await f.click('Save for next flight');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Settings changed/);
  assert.equal(f.storage.getItem(TUNING_LIBRARY_KEY), newerSaved);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  await f.click('Refresh library');
  assert.equal((await f.draft()).axes.roll.rate, 51);
  assert.equal(f.find('Profile name').value, 'Newer edit in another tab');
});

test('a save waiting for a browser lock keeps its click-time values and disables editing until completion', async (t) => {
  let release;
  const locks = {
    request(_key, work) {
      return new Promise((resolve) => {
        release = () => resolve(work());
      });
    },
  };
  const f = fixture(t, { locks });
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  const rate = f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Save for next flight');
  assert.equal(typeof release, 'function');
  assert.equal(f.store.snapshot().revision, 0);
  for (const selector of ['input', 'select', 'textarea', 'button'])
    for (const control of f.ui.root.querySelectorAll(selector))
      assert.equal(control.disabled, true, `${selector} must not change a pending save`);
  // A synthetic event may still be dispatched to a disabled DOM node. The
  // library must also retain the snapshot captured before waiting for its lock.
  rate.value = '1020';
  rate.emit('input');
  release();
  await settle();
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 91);
  assert.equal(f.saved.length, 1);
  assert.equal(f.find('Rate profile', 'select').disabled, false);
  assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').disabled, false);
});

for (const failure of ['oversized', 'unreadable'])
  test(`an ${failure} upload invalidates an earlier successful import preview`, async (t) => {
    const f = fixture(t);
    f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
      tag: 'textarea',
    });
    await f.click('Preview import');
    const file = f.find('Upload text / JSON');
    file.files = [
      {
        size: failure === 'oversized' ? 512 * 1024 + 1 : 100,
        text: async () => {
          throw new Error('File cannot be read');
        },
      },
    ];
    file.emit('change');
    await settle();
    await f.click('Save import as new profile');
    assert.equal(f.store.snapshot().profiles.length, 1);
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /Preview the import first/,
    );
  });

test('an earlier upload completing after a newer selection cannot replace its text', async (t) => {
  const f = fixture(t),
    file = f.find('Upload text / JSON');
  let finishFirst;
  file.files = [
    {
      size: 100,
      text: () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    },
  ];
  file.emit('change');
  const latest = exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 91 } } }));
  file.files = [{ size: latest.length, text: async () => latest }];
  file.emit('change');
  await settle();
  finishFirst(exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 51 } } })));
  await settle();
  assert.equal(f.find('Paste CLI or a SIM rate profile', 'textarea').value, latest);
  await f.click('Preview import');
  assert.equal((await f.draft()).axes.roll.rate, 91);
});

test('an invalid preset folder selection clears an existing import preview immediately', async (t) => {
  const f = fixture(t);
  f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
    tag: 'textarea',
  });
  await f.click('Preview import');
  const folder = f.find('Local preset folder');
  folder.files = [{ size: 512 * 1024 + 1, name: 'huge.txt', text: async () => '' }];
  folder.emit('change');
  await settle();
  await f.click('Save import as new profile');
  assert.equal(f.store.snapshot().profiles.length, 1);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview the import first/);
});

test('overlapping preset folder reads publish only the newest complete bundle', async (t) => {
  const f = fixture(t),
    folder = f.find('Local preset folder');
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  let finishFirst;
  folder.files = [
    {
      size: 100,
      name: 'old.txt',
      text: () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    },
  ];
  folder.emit('change');
  folder.files = [{ size: 100, name: 'new.txt', text: async () => 'set yaw_srate = 91' }];
  folder.emit('change');
  await settle();
  finishFirst('set yaw_srate = 51');
  await settle();
  assert.equal(f.find('Preset entry path within folder').value, 'new.txt');
  await f.click('Resolve preset and review options');
  await f.click('Preview import');
  assert.equal((await f.draft()).axes.yaw.rate, 91);
  f.edit('Preset entry path within folder', 'old.txt');
  await f.click('Resolve preset and review options');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /missing|not found/i);
});

test('switching locale updates accessible controls without changing numeric, name, camera or assignment drafts', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  const selected = f.find('Rate profile', 'select').value;
  f.edit('Maximum rate (°/s)', 990, { scope: f.axis('Roll'), type: 'number' });
  f.edit('Profile name', 'Мої рейти');
  f.edit('Drone name', 'Локальний дрон');
  f.edit('Camera tilt (degrees)', 60);
  f.edit('Vertical FOV (degrees)', 140);
  f.edit('Rates used by this drone', selected, { tag: 'select', event: 'change' });
  const saved = f.store.export();
  f.setLocale('uk');
  assert.equal(f.ui.root.getAttribute('aria-label'), 'Дрон, рейти й газ');
  assert.equal(f.ui.root.querySelector('h2').textContent, 'Дрон, рейти й газ');
  assert.equal(f.find('Назва профілю').value, 'Мої рейти');
  assert.equal(f.find('Назва дрона').value, 'Локальний дрон');
  assert.equal(f.find('Нахил камери (градуси)').value, '60');
  assert.equal(f.find('Вертикальне поле зору (градуси)').value, '140');
  assert.equal(f.find('Рейти для цього дрона', 'select').value, selected);
  assert.ok(
    f
      .axis('Крен')
      .querySelectorAll('input')
      .some((node) => node.type === 'number' && node.value === '990'),
  );
  assert.ok(
    f.ui.root
      .querySelectorAll('button')
      .some((node) => node.textContent === 'Зберегти для наступного польоту'),
  );
  assert.equal(f.store.export(), saved);
  f.setLocale('en');
  assert.equal(f.find('Profile name').value, 'Мої рейти');
  assert.equal(f.find('Drone name').value, 'Локальний дрон');
  assert.equal(f.find('Rates used by this drone', 'select').value, selected);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  assert.equal(f.store.export(), saved);
});

for (const exit of ['cancel', 'close', 'close-and-reopen'])
  test(`${exit} while Apply waits for a browser lock never restarts a flight afterward`, async (t) => {
    let release;
    const f = fixture(t, {
      locks: {
        request: (_key, work) =>
          new Promise((resolve) => {
            release = () => resolve(work());
          }),
      },
    });
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
    await f.click('Apply & restart');
    assert.equal(typeof release, 'function');
    if (exit === 'cancel') f.ui.root.emit('cancel');
    else f.ui.close();
    if (exit === 'close-and-reopen') f.ui.open({ keepDraft: true });
    release();
    await settle();
    assert.equal(f.store.effective().response.rates.axes.roll.rate, 91);
    assert.equal(f.applied.length, 0);
    assert.equal(f.ui.root.open, false);
    if (exit === 'close-and-reopen') {
      f.ui.open({ keepDraft: true });
      assert.equal(f.ui.root.open, true);
      assert.equal(f.applied.length, 0);
    }
  });

test('closing a draft comparison retains the unscored return affordance until a normal flight starts', async (t) => {
  const f = fixture(t);
  await f.click('Test draft · unscored');
  assert.equal(f.ui.returnButton.hidden, false);
  assert.equal(f.ui.returnButton.getAttribute('data-mode-label'), 'Unscored draft practice');
  f.ui.returnButton.emit('click');
  await settle();
  assert.equal(f.ui.returnButton.hidden, true);
  await f.click('Close');
  assert.equal(f.ui.returnButton.hidden, false);
  f.ui.endDraftTest();
  assert.equal(f.ui.returnButton.hidden, true);
});

test('import receipt stays visible through save, duplicate, manual edit and revision restoration', async (t) => {
  const f = fixture(t);
  f.edit(
    'Paste CLI or a SIM rate profile',
    exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 83 } } })),
    { tag: 'textarea' },
  );
  await f.click('Preview import');
  f.edit('Profile name', 'Receipt rates');
  await f.click('Save import as new profile');
  const original = f.store.snapshot().profiles.find((p) => p.name === 'Receipt rates');
  assert.ok(original.provenance);
  assert.match(f.ui.root.textContent, new RegExp(original.provenance.source.sha256));
  await f.click('Duplicate');
  const duplicate = f.store.snapshot().profiles.find((p) => p.name === 'Receipt rates copy');
  assert.deepEqual(duplicate.provenance, original.provenance);
  f.edit('Maximum rate (°/s)', 900, { scope: f.axis('Roll') });
  await f.click('Save for next flight');
  const edited = f.store.snapshot().profiles.find((p) => p.id === duplicate.id);
  assert.equal(edited.provenance, undefined);
  assert.deepEqual(edited.history[0].provenance, original.provenance);
  assert.match(f.ui.root.textContent, /No import receipt for these draft rates/);
  await f.click('Restore revision to draft');
  assert.match(f.ui.root.textContent, new RegExp(original.provenance.source.sha256));
  await f.click('Save for next flight');
  assert.deepEqual(
    f.store.snapshot().profiles.find((p) => p.id === duplicate.id).provenance,
    original.provenance,
  );
});

for (const source of ['native', 'CLI'])
  test(`restoring same-rate history cancels an earlier pending ${source} import`, async (t) => {
    const f = fixture(t);
    await f.click('New Actual profile');
    f.edit('Profile name', 'Renamed profile');
    await f.click('Save for next flight');
    const before = f.store.export(),
      realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let release,
      first = true;
    t.mock.method(globalThis.crypto.subtle, 'digest', (...args) => {
      if (!first) return realDigest(...args);
      first = false;
      return new Promise((resolve, reject) => {
        release = () => realDigest(...args).then(resolve, reject);
      });
    });
    f.edit(
      'Paste CLI or a SIM rate profile',
      source === 'native'
        ? exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 88 } } }))
        : 'set roll_srate = 88',
      { tag: 'textarea' },
    );
    f.ui.root
      .querySelectorAll('button')
      .find((node) => node.textContent === 'Preview import')
      .emit('click');
    await settle();
    assert.equal(typeof release, 'function');
    await f.click('Restore revision to draft');
    assert.equal(f.find('Profile name').value, 'New profile');
    await release();
    for (let turn = 0; turn < 8; turn++) await settle();
    assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').value, '670');
    await f.click('Save import as new profile');
    assert.equal(f.store.export(), before);
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /Preview the import first/,
    );
    await f.click('Preview import');
    assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').value, '880');
    await f.click('Save import as new profile');
    assert.equal(f.store.snapshot().profiles.at(-1).response.rates.axes.roll.rate, 88);
  });

test('restoring history invalidates a completed same-rate preview and retains the restored receipt', async (t) => {
  const f = fixture(t),
    source = exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 83 } } }));
  f.edit('Paste CLI or a SIM rate profile', source, { tag: 'textarea' });
  await f.click('Preview import');
  f.edit('Profile name', 'Original receipt');
  await f.click('Save import as new profile');
  const original = f.store.snapshot().profiles.at(-1);
  f.edit('Profile name', 'Renamed receipt');
  await f.click('Save for next flight');
  const before = f.store.export();
  f.edit('Paste CLI or a SIM rate profile', `${source}\n`, { tag: 'textarea' });
  await f.click('Preview import');
  assert.doesNotMatch(f.ui.root.textContent, new RegExp(original.provenance.source.sha256));
  await f.click('Restore revision to draft');
  assert.equal(f.find('Profile name').value, 'Original receipt');
  assert.match(f.ui.root.textContent, new RegExp(original.provenance.source.sha256));
  await f.click('Save import as new profile');
  assert.equal(f.store.export(), before);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview the import first/);
  await f.click('Save for next flight');
  const saved = f.store.snapshot().profiles.find((profile) => profile.id === original.id);
  assert.equal(saved.name, 'Original receipt');
  assert.deepEqual(saved.provenance, original.provenance);
});

test('uploaded CLI receipts hash original BOM and CRLF bytes before browser textarea normalization', async (t) => {
  const { createHash } = await import('node:crypto');
  const f = fixture(t),
    source = '\uFEFF# Betaflight 2026.6.2\r\nset yaw_srate = 92\r\n';
  const bytes = new TextEncoder().encode(source),
    upload = f.find('Upload text / JSON');
  upload.files = [
    {
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
      text: () => {
        throw new Error('Do not normalize source bytes');
      },
    },
  ];
  upload.emit('change');
  await settle();
  // HTML textarea.value normalizes line endings; uploaded source remains exact.
  f.find('Paste CLI or a SIM rate profile', 'textarea').value = source.replace(/\r/gu, '');
  f.edit('Operation', 'diff', { tag: 'select', event: 'change' });
  await f.click('Preview import');
  await f.click('Save import as new profile');
  const receipt = f.store.snapshot().profiles.at(-1).provenance;
  assert.equal(receipt.source.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(receipt.source.bytes, bytes.length);
  assert.equal(receipt.firmware.origin, 'header');
});

for (const interruption of ['edit', 'reopen'])
  test(`a delayed import source hash cannot publish after ${interruption}`, async (t) => {
    const f = fixture(t);
    const realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let release,
      first = true;
    t.mock.method(globalThis.crypto.subtle, 'digest', (...args) => {
      if (!first) return realDigest(...args);
      first = false;
      return new Promise((resolve, reject) => {
        release = () => realDigest(...args).then(resolve, reject);
      });
    });
    f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
      tag: 'textarea',
    });
    f.ui.root
      .querySelectorAll('button')
      .find((node) => node.textContent === 'Preview import')
      .emit('click');
    await settle();
    assert.equal(typeof release, 'function');
    if (interruption === 'edit')
      f.edit('Paste CLI or a SIM rate profile', 'changed while hashing', { tag: 'textarea' });
    else {
      f.ui.close();
      f.ui.open();
    }
    await release();
    for (let turn = 0; turn < 8; turn++) await settle();
    await f.click('Save import as new profile');
    assert.equal(f.store.snapshot().profiles.length, 1);
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /Preview the import first/,
    );
  });

for (const source of ['native', 'CLI'])
  for (const value of ['', '905', '920'])
    test(`a pending ${source} import cannot replace a newer numeric draft (${value || 'blank'})`, async (t) => {
      const f = fixture(t);
      await f.click('New Actual profile');
      const before = f.store.export(),
        realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      let release,
        first = true;
      t.mock.method(globalThis.crypto.subtle, 'digest', (...args) => {
        if (!first) return realDigest(...args);
        first = false;
        return new Promise((resolve, reject) => {
          release = () => realDigest(...args).then(resolve, reject);
        });
      });
      f.edit(
        'Paste CLI or a SIM rate profile',
        source === 'native'
          ? exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 88 } } }))
          : 'set roll_srate = 88',
        { tag: 'textarea' },
      );
      f.ui.root
        .querySelectorAll('button')
        .find((node) => node.textContent === 'Preview import')
        .emit('click');
      await settle();
      assert.equal(typeof release, 'function');
      f.edit('Maximum rate (°/s)', value, { scope: f.axis('Roll'), type: 'number' });
      await release();
      for (let turn = 0; turn < 8; turn++) await settle();
      const input = f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number');
      assert.equal(input.value, value);
      if (value !== '920') assert.equal(input.getAttribute('aria-invalid'), 'true');
      assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview again/);
      await f.click('Save import as new profile');
      assert.equal(f.store.export(), before);
      assert.match(
        f.ui.root.querySelector('[role="status"]').textContent,
        /Preview the import first/,
      );
      // A deliberate new preview still replaces the draft, even when the text
      // it replaces is incomplete or not yet a representable native rate.
      await f.click('Preview import');
      assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').value, '880');
      await f.click('Save import as new profile');
      assert.equal(f.store.snapshot().profiles.at(-1).response.rates.axes.roll.rate, 88);
    });

for (const transition of ['algorithm round trip', 'edit back to saved value', 'revert'])
  test(`a cancelled pending import stays cancelled after ${transition}`, async (t) => {
    const f = fixture(t);
    await f.click('New Actual profile');
    const realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let release,
      first = true;
    t.mock.method(globalThis.crypto.subtle, 'digest', (...args) => {
      if (!first) return realDigest(...args);
      first = false;
      return new Promise((resolve, reject) => {
        release = () => realDigest(...args).then(resolve, reject);
      });
    });
    f.edit(
      'Paste CLI or a SIM rate profile',
      exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 88 } } })),
      { tag: 'textarea' },
    );
    f.ui.root
      .querySelectorAll('button')
      .find((node) => node.textContent === 'Preview import')
      .emit('click');
    await settle();
    f.edit('Maximum rate (°/s)', '', { scope: f.axis('Roll'), type: 'number' });
    if (transition === 'algorithm round trip') {
      f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
      f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    } else if (transition === 'edit back to saved value')
      f.edit('Maximum rate (°/s)', '670', { scope: f.axis('Roll'), type: 'number' });
    else await f.click('Revert draft');
    await release();
    for (let turn = 0; turn < 8; turn++) await settle();
    assert.equal(
      f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').value,
      transition === 'algorithm round trip' ? '' : '670',
    );
    await f.click('Save import as new profile');
    assert.equal(f.store.snapshot().profiles.length, 2);
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /Preview the import first/,
    );
  });

test('saving an import rejects changed preview rates instead of replacing visible edits', async (t) => {
  const f = fixture(t),
    initialCount = f.store.snapshot().profiles.length;
  f.edit(
    'Paste CLI or a SIM rate profile',
    exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 80 } } })),
    { tag: 'textarea' },
  );
  await f.click('Preview import');
  f.edit('Maximum rate (°/s)', 990, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Save import as new profile');
  assert.equal(f.store.snapshot().profiles.length, initialCount);
  assert.match(
    f.ui.root.querySelector('[role="status"]').textContent,
    /Rates changed after the import preview/,
  );
  assert.equal((await f.draft()).axes.roll.rate, 99);
});

test('firmware-default patch preview accepts a verified file header without a manual version', async (t) => {
  const f = fixture(t);
  f.edit('Camera tilt (degrees)', 35);
  f.edit('Patch baseline', 'defaults', { tag: 'select', event: 'change' });
  f.edit('Paste CLI or a SIM rate profile', '# Betaflight 4.5.2\nset roll_srate = 81', {
    tag: 'textarea',
  });
  await f.click('Preview import');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview only/);
  await f.click('Save import as new profile');
  const imported = f.store.snapshot().profiles.at(-1);
  assert.equal(imported.response.rates.axes.roll.rate, 81);
  assert.equal(imported.response.rates.throttle.model, 'betaflight-4.5');
  assert.deepEqual(imported.provenance.firmware, { version: '4.5.2', origin: 'header' });
  assert.equal(imported.provenance.baseline.kind, 'firmware-defaults');
  assert.equal(
    f.find('Camera tilt (degrees)').value,
    '35',
    'Creating the imported profile retains the independent drone draft',
  );
});

test('rotation-only CLI export crosses throttle versions only after an explicit choice', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  const before = await f.draft();
  f.edit('Source / export firmware version', '4.5.2', { tag: 'select', event: 'change' });
  await f.click('Export rate-only CLI');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /different throttle curve/);
  const include = f.find('Include throttle settings in CLI export');
  assert.equal(include.checked, true);
  include.checked = false;
  include.emit('change');
  await f.click('Export rate-only CLI');
  const exported = f.find('Paste CLI or a SIM rate profile', 'textarea').value;
  assert.match(exported, /# Betaflight 4\.5\.2/);
  assert.match(exported, /set rates_type = ACTUAL/);
  assert.doesNotMatch(exported, /set (?:thr_|throttle_)/);
  assert.match(exported, /throttle settings are omitted/);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /rotation rates only/);
  assert.deepEqual(await f.draft(), before);
});
