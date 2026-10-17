import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUNING_LIBRARY_KEY,
  TUNING_LIBRARY_BYTES,
  initialTuningLibrary,
  validateTuningLibrary,
  createTuningLibraryStore,
  resolveFlightConfiguration,
  profileUsers,
} from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { DEFAULT_RESPONSE } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { createTunedResponse } from '../../optional-practice/civilian-fpv/flight-response.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import {
  applyAircraftComponents,
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

function memory(seed) {
  const data = new Map(seed ?? []),
    writes = [];
  return {
    data,
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      data.set(key, value);
    },
  };
}
const setup = (id, profileId = null, camera = { tilt: 20, verticalFov: 95 }) => ({
  id,
  name: id,
  profileId,
  camera,
});

test('built-in aircraft selection atomically copies independent rates and physical configuration without changing player defaults', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  const before = store.snapshot();
  const catalogBefore = listAircraftPresets().map((preset) => preset.id);
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  assert.equal(storage.writes.length, 1);
  const value = store.snapshot(),
    effective = store.effective(),
    preset = createPresetConfiguration('meteor75-analog-2022');
  assert.equal(value.defaultProfileId, before.defaultProfileId);
  assert.deepEqual(value.profiles[0], before.profiles[0]);
  assert.deepEqual(value.setups[0], before.setups[0]);
  assert.equal(value.selectedSetupId, 'meteor');
  assert.deepEqual(effective.response, preset.response);
  assert.deepEqual(effective.advanced, {
    aircraft: preset.aircraft,
    controller: preset.controller,
  });
  assert.equal(effective.advanced.aircraft.battery.depletion, false);
  assert.deepEqual(value.setups[1].preset, { id: 'meteor75-analog-2022', revision: 1 });
  assert.equal(value.setups.length, 2, 'Built-ins do not occupy saved setup slots until selected');
  assert.deepEqual(
    listAircraftPresets().map((preset) => preset.id),
    catalogBefore,
  );
  const restored = createTuningLibraryStore({ storage: memory() });
  await restored.restore(store.export());
  assert.deepEqual(restored.effective(), effective);
});

test('battery and physical-camera saves preserve rates/controller, freeze attempts, survive backups and reject failures atomically', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  const initial = store.effective();
  const before = store.snapshot();
  const request = {
    setupId: 'meteor',
    battery: { massGrams: 16, capacityMah: 600 },
    cameraPayload: { massGrams: 4 },
  };
  const writes = storage.writes.length;
  await store.saveAircraftComponents(request);
  assert.equal(storage.writes.length, writes + 1);
  const edited = store.effective();
  assert.ok(
    Math.abs(edited.advanced.aircraft.mass - (initial.advanced.aircraft.mass + 0.0073)) < 1e-15,
  );
  assert.equal(initial.advanced.aircraft.mass, 0.03768);
  assert.deepEqual(edited.response, initial.response);
  assert.deepEqual(edited.advanced.controller, initial.advanced.controller);
  assert.deepEqual(store.snapshot().profiles, before.profiles);
  assert.notEqual(edited.simulationIdentity, initial.simulationIdentity);
  const restored = createTuningLibraryStore({ storage: memory() });
  await restored.restore(store.export());
  assert.deepEqual(restored.snapshot().setups, store.snapshot().setups);
  const stable = store.export();
  await assert.rejects(
    store.saveAircraftComponents({ ...request, battery: { ...request.battery, massGrams: 999 } }),
    /half to twice/,
  );
  assert.equal(store.export(), stable);
  await assert.rejects(store.saveAircraftComponents(request, before.revision), /Settings changed/);
  assert.equal(store.export(), stable);
  storage.setItem = () => {
    throw new Error('quota full');
  };
  await assert.rejects(
    store.saveAircraftComponents({ ...request, cameraPayload: { massGrams: 5 } }),
    /quota full/,
  );
  assert.equal(store.export(), stable);
});

test('older saved preset setups acquire component metadata without resetting explicit physical overrides', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  const setup = store.snapshot().setups.find((row) => row.id === 'meteor');
  delete setup.components;
  setup.advanced.aircraft.mass += 0.002;
  setup.advanced.aircraft.motorTimeConstant = 0.025;
  await store.saveSetup(setup);
  await store.saveAircraftComponents({
    setupId: 'meteor',
    battery: { massGrams: 12.7, capacityMah: 450 },
    cameraPayload: { massGrams: 2 },
  });
  assert.ok(Math.abs(store.effective().advanced.aircraft.mass - 0.04168) < 1e-15);
  assert.equal(store.effective().advanced.aircraft.motorTimeConstant, 0.025);
  assert.equal(
    store.snapshot().setups.find((row) => row.id === 'meteor').components.cameraPayload.massGrams,
    2,
  );
});

test('optional depletion is a frozen per-flight preference and survives component edits and backups', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  const initialFlight = store.effective(),
    profile = store.snapshot().profiles.find((item) => item.id === 'meteor-rates');
  const setup = store.snapshot().setups.find((item) => item.id === 'meteor');
  setup.advanced.aircraft.battery.depletion = true;
  await store.saveSetup(setup);
  const enduranceFlight = store.effective();
  assert.equal(initialFlight.advanced.aircraft.battery.depletion, false);
  assert.equal(enduranceFlight.advanced.aircraft.battery.depletion, true);
  assert.notEqual(enduranceFlight.simulationIdentity, initialFlight.simulationIdentity);
  assert.deepEqual(
    store.snapshot().profiles.find((item) => item.id === 'meteor-rates'),
    profile,
  );
  await store.saveAircraftComponents({
    setupId: 'meteor',
    battery: { massGrams: 16, capacityMah: 600 },
    cameraPayload: { massGrams: 4 },
  });
  assert.equal(store.effective().advanced.aircraft.battery.depletion, true);
  assert.equal(enduranceFlight.advanced.aircraft.mass, 0.03768);
  const reopened = createTuningLibraryStore({ storage });
  assert.equal(reopened.effective().advanced.aircraft.battery.depletion, true);
  const restored = createTuningLibraryStore({ storage: memory() });
  await restored.restore(store.export());
  assert.deepEqual(restored.effective(), store.effective());
});

test('explicit same-preset selection resets installed component metadata while ordinary Advanced edits retain it', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  await store.saveAircraftComponents({
    setupId: 'meteor',
    battery: { massGrams: 16, capacityMah: 600 },
    cameraPayload: { massGrams: 5 },
  });
  const before = store.snapshot().setups.find((item) => item.id === 'meteor');
  const custom = structuredClone(before.advanced);
  custom.aircraft.motorTimeConstant = 0.024;
  await store.saveAircraftConfiguration({ setupId: 'meteor', advanced: custom });
  assert.deepEqual(
    store.snapshot().setups.find((item) => item.id === 'meteor').components,
    before.components,
  );
  const preset = createPresetConfiguration('meteor75-analog-2022');
  await store.saveAircraftConfiguration({
    setupId: 'meteor',
    advanced: { aircraft: preset.aircraft, controller: preset.controller },
    preset: preset.preset,
  });
  const restored = store.snapshot().setups.find((item) => item.id === 'meteor');
  assert.deepEqual(restored.components, preset.components);
  assert.deepEqual(restored.advanced.aircraft, preset.aircraft);
  assert.equal(restored.components.cameraPayload.massGrams, 0);
  assert.equal(store.snapshot().profiles.length, 2);
});

test('Advanced saves carry draft component inventory atomically and later edits retain explicit mass and inertia overrides', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  const initial = store.snapshot().setups.find((item) => item.id === 'meteor');
  const selected = {
    battery: initial.components.battery,
    cameraPayload: { massGrams: 4 },
  };
  const draft = applyAircraftComponents(initial.advanced.aircraft, initial.components, selected);
  draft.aircraft.mass += 0.002;
  for (const axis of ['x', 'y', 'z']) draft.aircraft.inertia[axis] *= 1.1;
  const advanced = { ...initial.advanced, aircraft: draft.aircraft };
  const request = { setupId: 'meteor', advanced, components: draft.components };
  await store.saveAircraftConfiguration(request);
  assert.equal(
    store.snapshot().setups.find((item) => item.id === 'meteor').components.cameraPayload.massGrams,
    4,
  );
  const stable = store.export();
  await assert.rejects(
    store.saveAircraftConfiguration({
      ...request,
      components: createPresetConfiguration('air65-ii-racing-2026').components,
    }),
    /Component inventory must describe/,
  );
  assert.equal(store.export(), stable);
  await store.saveAircraftComponents({
    setupId: 'meteor',
    ...selected,
    cameraPayload: { massGrams: 5 },
  });
  assert.ok(
    Math.abs(store.effective().advanced.aircraft.mass - advanced.aircraft.mass - 0.001) < 1e-15,
  );
  await store.saveAircraftComponents({ setupId: 'meteor', ...selected });
  assert.ok(Math.abs(store.effective().advanced.aircraft.mass - advanced.aircraft.mass) < 1e-15);
  for (const axis of ['x', 'y', 'z'])
    assert.ok(
      Math.abs(
        store.effective().advanced.aircraft.inertia[axis] - advanced.aircraft.inertia[axis],
      ) < 1e-15,
    );
});

test('Advanced aircraft saves reuse unchanged response profiles and atomically clone changed rates without altering shared users', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  await store.saveSetup(setup('shared', 'meteor-rates'));
  const initial = store.effective(),
    aircraft = structuredClone(initial.advanced);
  aircraft.aircraft.mass = 0.04;
  const writes = storage.writes.length;
  await store.saveAircraftConfiguration({
    setupId: 'meteor',
    newProfileId: 'unused',
    advanced: aircraft,
    response: initial.response,
    camera: { tilt: 33, verticalFov: 90 },
  });
  assert.equal(storage.writes.length, writes + 1);
  assert.equal(store.snapshot().profiles.length, 2);
  assert.equal(store.effective().profileId, 'meteor-rates');
  assert.equal(store.effective().camera.tilt, 33);
  assert.equal(store.effective().advanced.aircraft.mass, 0.04);
  const before = structuredClone(initial.response),
    changed = structuredClone(initial.response);
  changed.rates.axes.yaw.rate = 100;
  await store.saveAircraftConfiguration({
    setupId: 'meteor',
    newProfileId: 'independent',
    advanced: aircraft,
    response: changed,
    camera: { tilt: 34, verticalFov: 91 },
  });
  assert.equal(store.snapshot().profiles.length, 3);
  assert.equal(store.effective().profileId, 'independent');
  assert.equal(store.effective().response.rates.axes.yaw.rate, 100);
  assert.deepEqual(resolveFlightConfiguration(store.snapshot(), 'shared').response, before);
  assert.equal(store.snapshot().defaultProfileId, 'legacy-feel');
  assert.deepEqual(initial.response, before);
  assert.deepEqual(store.snapshot().setups.find((s) => s.id === 'meteor').preset, {
    id: 'meteor75-analog-2022',
    revision: 1,
  });
});

test('Advanced saves move preset provenance with selected aircraft and preserve all fields on invalid, stale or capacity-limited saves', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  const pavo = createPresetConfiguration('pavo20-pro-ii-o4-4s');
  await store.saveAircraftConfiguration({
    setupId: 'my-drone',
    newProfileId: 'pavo-rates',
    advanced: { aircraft: pavo.aircraft, controller: pavo.controller },
    response: pavo.response,
    camera: pavo.camera,
    preset: pavo.preset,
  });
  assert.deepEqual(store.snapshot().setups[0].preset, pavo.preset);
  let before = store.export();
  await assert.rejects(
    store.saveAircraftConfiguration({
      setupId: 'my-drone',
      newProfileId: 'bad',
      advanced: store.effective().advanced,
      camera: { tilt: 100, verticalFov: 82 },
    }),
    /Camera tilt/,
  );
  assert.equal(store.export(), before);
  await assert.rejects(
    store.saveAircraftConfiguration(
      { setupId: 'my-drone', advanced: store.effective().advanced },
      0,
    ),
    /Settings changed/,
  );
  assert.equal(store.export(), before);
  for (let n = 0; n < 30; n++) await store.createProfile({ id: `extra-${n}`, name: `Extra ${n}` });
  assert.equal(store.snapshot().profiles.length, 32);
  await store.saveAircraftConfiguration({
    setupId: 'my-drone',
    advanced: store.effective().advanced,
    response: pavo.response,
    camera: { tilt: 25, verticalFov: 90 },
  });
  before = store.export();
  const changed = structuredClone(pavo.response);
  changed.rates.axes.roll.expo = 30;
  await assert.rejects(
    store.saveAircraftConfiguration({
      setupId: 'my-drone',
      newProfileId: 'over-limit',
      advanced: store.effective().advanced,
      response: changed,
      camera: { tilt: 26, verticalFov: 91 },
    }),
    /32 rate profiles/,
  );
  assert.equal(store.export(), before);
  const custom = structuredClone(store.effective().advanced);
  custom.aircraft.id = 'my-custom-build';
  await store.saveAircraftConfiguration({ setupId: 'my-drone', advanced: custom });
  assert.equal(Object.hasOwn(store.snapshot().setups[0], 'preset'), false);
});

test('keep-current aircraft selection copies complete Legacy and portable response settings without reinterpreting rates', async () => {
  const store = createTuningLibraryStore({
    storage: memory(),
    response: { ...DEFAULT_RESPONSE, maxRate: 480, expo: 42 },
  });
  const old = store.effective();
  await store.createPresetSetup({
    presetId: 'holybro-x650-v2',
    setupId: 'large',
    profileId: 'large-rates',
    rates: 'keep',
  });
  assert.deepEqual(store.effective().response, old.response);
  assert.equal(store.effective().advanced.aircraft.mass, 3.2);
  const response = createTunedResponse(
    createRateProfile({
      algorithm: 'quick',
      axes: { yaw: { rcRate: 123, rate: 180, expo: 31 } },
      throttle: { mid: 42, expo: 17, limitType: 'scale', limitPercent: 70 },
    }),
    { maxTilt: 45, responseTicks: 12 },
  );
  await store.createPresetSetup({
    presetId: 'air65-ii-racing-2026',
    setupId: 'tiny',
    profileId: 'tiny-rates',
    rates: 'keep',
    response,
  });
  assert.deepEqual(store.effective().response, response);
  response.rates.axes.yaw.rate = 1;
  assert.equal(store.effective().response.rates.axes.yaw.rate, 180);
  assert.deepEqual(resolveFlightConfiguration(store.snapshot(), 'large').response, old.response);
});

test('reset restores only the chosen preset setup and leaves its old rates, other drones and in-progress configuration intact', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createPresetSetup({
    presetId: 'pavo20-pro-ii-o4-4s',
    setupId: 'cine',
    profileId: 'cine-rates',
    rates: 'defaults',
  });
  const setup = store.snapshot().setups[1];
  setup.advanced.aircraft.mass = 0.2;
  setup.camera.tilt = 42;
  setup.name = 'My edited Pavo';
  await store.saveSetup(setup);
  await store.saveProfile('cine-rates', {
    response: createTunedResponse(createRateProfile({ axes: { yaw: { rate: 110 } } })),
  });
  const flight = store.effective(),
    frozen = structuredClone(flight);
  await store.createPresetSetup({
    presetId: 'pavo20-pro-ii-o4-4s',
    setupId: 'cine',
    profileId: 'reset-rates',
    rates: 'defaults',
    replace: true,
  });
  assert.deepEqual(flight, frozen);
  assert.equal(store.snapshot().setups.length, 2);
  assert.equal(store.snapshot().setups[1].name, 'My edited Pavo');
  assert.equal(store.effective().advanced.aircraft.mass, 0.1712);
  assert.equal(store.effective().response.rates.axes.yaw.rate, 50);
  assert.equal(
    store.snapshot().profiles.find((p) => p.id === 'cine-rates').response.rates.axes.yaw.rate,
    110,
  );
  const before = store.export();
  await assert.rejects(
    store.createPresetSetup({
      presetId: 'air65-ii-racing-2026',
      setupId: 'cine',
      profileId: 'bad',
      rates: 'defaults',
      replace: true,
    }),
    /own preset/,
  );
  assert.equal(store.export(), before);
});

test('preset creation rejects failed storage, stale tabs, invalid identities and capacity without partial profiles or selection', async () => {
  const storage = memory(),
    first = createTuningLibraryStore({ storage }),
    stale = createTuningLibraryStore({ storage });
  const request = {
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  };
  await first.createPresetSetup(request);
  const staleBefore = stale.snapshot();
  await assert.rejects(stale.createPresetSetup(request), /Another tab/);
  assert.deepEqual(stale.snapshot(), staleBefore);
  const before = first.export();
  await assert.rejects(first.createPresetSetup({ ...request, profileId: 'other' }), /new setup ID/);
  assert.equal(first.export(), before);
  storage.setItem = () => {
    throw new Error('quota full');
  };
  await assert.rejects(
    first.createPresetSetup({ ...request, setupId: 'second', profileId: 'second-rates' }),
    /quota full/,
  );
  assert.equal(first.export(), before);
  const full = createTuningLibraryStore({ storage: memory() });
  for (let n = 0; n < 31; n++) await full.saveSetup(setup(`saved-${n}`));
  const fullBefore = full.export();
  await assert.rejects(full.createPresetSetup(request), /32 drone setups/);
  assert.equal(full.export(), fullBefore);
});

test('migration preserves the existing response and camera without writing or replacing legacy storage', () => {
  const response = { ...DEFAULT_RESPONSE, maxRate: 480, expo: 42 },
    camera = { tilt: 27, verticalFov: 108 };
  const storage = memory([['revealline.flight-profiles.v1', 'existing legacy bytes']]);
  const store = createTuningLibraryStore({ storage, response, camera });
  assert.deepEqual(store.effective().response, response);
  assert.deepEqual(store.effective().camera, camera);
  assert.equal(store.snapshot().defaultProfileId, 'legacy-feel');
  assert.equal(store.status().saved, false);
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.getItem('revealline.flight-profiles.v1'), 'existing legacy bytes');
  response.expo = 0;
  camera.tilt = 0;
  assert.equal(store.effective().response.expo, 42);
  assert.equal(store.effective().camera.tilt, 27);
});

test('new Actual profiles, player default and complete per-drone overrides resolve independently', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createProfile({ id: 'pilot', name: 'Pilot rates' });
  await store.createProfile({
    id: 'cinema',
    name: 'Cinema',
    response: createTunedResponse(createRateProfile({ axes: { yaw: { rate: 30 } } })),
  });
  await store.setDefault('pilot');
  await store.saveSetup(setup('racer'));
  await store.saveSetup(setup('cinewhoop', 'cinema'));
  const library = store.snapshot();
  assert.equal(resolveFlightConfiguration(library, 'racer').response.rates.algorithm, 'actual');
  assert.equal(resolveFlightConfiguration(library, 'racer').response.rates.axes.yaw.rate, 67);
  assert.equal(resolveFlightConfiguration(library, 'cinewhoop').response.rates.axes.yaw.rate, 30);
  assert.deepEqual(
    profileUsers(library, 'pilot').map((item) => item.id),
    ['my-drone', 'racer'],
  );
  await store.setDefault('legacy-feel');
  assert.equal(
    resolveFlightConfiguration(store.snapshot(), 'racer').response.format,
    DEFAULT_RESPONSE.format,
  );
  assert.equal(resolveFlightConfiguration(store.snapshot(), 'cinewhoop').profileId, 'cinema');
});

test('shared edits update future resolutions, while a captured flight configuration remains immutable', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createProfile({ id: 'pilot', name: 'Pilot' });
  await store.setDefault('pilot');
  await store.saveSetup(setup('second', 'pilot'));
  const active = store.effective(),
    original = structuredClone(active);
  const response = createTunedResponse(createRateProfile({ axes: { roll: { rate: 91 } } }));
  await store.saveProfile('pilot', { response });
  response.rates.axes.roll.rate = 3;
  assert.deepEqual(active, original);
  assert.equal(store.effective().response.rates.axes.roll.rate, 91);
  assert.equal(
    resolveFlightConfiguration(store.snapshot(), 'second').response.rates.axes.roll.rate,
    91,
  );
  assert.notEqual(store.effective().simulationIdentity, active.simulationIdentity);
  const snapshot = store.snapshot();
  snapshot.profiles[1].response.rates.axes.roll.rate = 12;
  assert.equal(store.effective().response.rates.axes.roll.rate, 91);
});

test('names, duplicate IDs and camera do not change simulation identity; bounded revision history can revert', async () => {
  const store = createTuningLibraryStore({ storage: memory() });
  await store.createProfile({ id: 'pilot', name: 'Pilot' });
  await store.setDefault('pilot');
  const identity = store.effective().simulationIdentity;
  await store.saveProfile('pilot', { name: 'Renamed' });
  assert.equal(store.effective().simulationIdentity, identity);
  await store.duplicateProfile('pilot', 'copy', 'Duplicate');
  await store.setDefault('copy');
  assert.equal(store.effective().simulationIdentity, identity);
  await store.saveSetup(setup('my-drone', null, { tilt: 43, verticalFov: 112 }));
  assert.equal(store.effective().simulationIdentity, identity);
  await store.revertProfile('pilot', 0);
  assert.equal(store.snapshot().profiles.find((item) => item.id === 'pilot').name, 'Pilot');
  for (let n = 0; n < 26; n++) await store.saveProfile('pilot', { name: `Pilot ${n}` });
  const saved = store.snapshot().profiles.find((item) => item.id === 'pilot');
  assert.equal(saved.history.length, 24);
  assert.ok(
    saved.history.every(
      (item, index) => index === 0 || item.revision > saved.history[index - 1].revision,
    ),
  );
  await assert.rejects(store.revertProfile('pilot', 0), /no longer/);
});

test('deletion reassigns explicit users and the default atomically; a valid default always survives', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createProfile({ id: 'pilot', name: 'Pilot' });
  await store.setDefault('pilot');
  await store.saveSetup(setup('bound', 'pilot'));
  const before = store.export(),
    writes = storage.writes.length;
  await assert.rejects(store.removeProfile('pilot', 'missing'), /Unknown rate profile/);
  await assert.rejects(store.removeProfile('pilot', 'pilot'), /different replacement/);
  assert.equal(store.export(), before);
  assert.equal(storage.writes.length, writes);
  await store.removeProfile('pilot', 'legacy-feel');
  assert.equal(store.snapshot().defaultProfileId, 'legacy-feel');
  assert.equal(
    store.snapshot().setups.find((item) => item.id === 'bound').profileId,
    'legacy-feel',
  );
  await assert.rejects(store.removeProfile('legacy-feel', 'legacy-feel'));
});

test('a single atomic edit saves rates, profile name, drone assignment and camera together', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  const before = store.export();
  await assert.rejects(
    store.saveEditing(
      'legacy-feel',
      { name: 'Bad camera' },
      setup('my-drone', null, { tilt: 61, verticalFov: 82 }),
    ),
    /Camera tilt/,
  );
  assert.equal(store.export(), before);
  assert.equal(storage.writes.length, 0);
  await store.saveEditing(
    'legacy-feel',
    { name: 'Saved', response: createTunedResponse() },
    setup('my-drone', null, { tilt: 15, verticalFov: 100 }),
  );
  assert.equal(storage.writes.length, 1);
  assert.equal(store.snapshot().profiles[0].name, 'Saved');
  assert.equal(store.effective().camera.verticalFov, 100);
});

test('drone creation and selection commit together and invalid submissions cannot replace an existing setup', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  const original = store.snapshot().setups[0];
  await store.createAndSelectSetup(setup('copy', 'legacy-feel', { tilt: 31, verticalFov: 103 }));
  assert.equal(storage.writes.length, 1);
  assert.equal(store.snapshot().revision, 1);
  assert.equal(store.snapshot().selectedSetupId, 'copy');
  assert.deepEqual(store.snapshot().setups[0], original);
  assert.equal(store.effective().camera.tilt, 31);
  const before = store.export();
  await assert.rejects(store.createAndSelectSetup(setup('copy')), /duplicate drone setup/);
  await assert.rejects(
    store.createAndSelectSetup(setup('bad-camera', null, { tilt: 61, verticalFov: 95 })),
    /Camera tilt/,
  );
  assert.equal(store.export(), before);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), before);
  assert.equal(storage.writes.length, 1);
});

test('failed or stale drone creation preserves both saved setups and their selected identity', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.saveSetup(setup('my-drone'));
  const write = storage.setItem,
    before = store.export();
  storage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  await assert.rejects(store.createAndSelectSetup(setup('copy')), /Quota exceeded/);
  assert.equal(store.export(), before);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), before);
  storage.setItem = write;
  const other = createTuningLibraryStore({ storage });
  await other.saveProfile('legacy-feel', { name: 'Saved elsewhere' });
  const newer = storage.getItem(TUNING_LIBRARY_KEY);
  await assert.rejects(store.createAndSelectSetup(setup('copy')), /Another tab/);
  assert.equal(store.export(), before);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), newer);
});

test('stale tabs cannot overwrite saved changes and refresh does not resurrect removed entries', async () => {
  const storage = memory(),
    first = createTuningLibraryStore({ storage }),
    second = createTuningLibraryStore({ storage });
  await first.createProfile({ id: 'pilot', name: 'Pilot' }, 0);
  await assert.rejects(second.createProfile({ id: 'stale', name: 'Stale' }, 0), /Another tab/);
  assert.equal(second.snapshot().profiles.length, 1);
  second.refresh();
  await second.saveProfile('pilot', { name: 'From second tab' });
  await assert.rejects(first.setDefault('pilot'), /Another tab/);
  first.refresh();
  await first.removeProfile('pilot', 'legacy-feel');
  second.refresh();
  assert.equal(second.snapshot().profiles.length, 1);
  await assert.rejects(second.setDefault('legacy-feel', 0), /Settings changed/);
});

test('Web Locks serialize competing tabs while still rejecting a stale draft', async () => {
  const storage = memory(),
    requests = [];
  let tail = Promise.resolve();
  const locks = {
    request(key, fn) {
      requests.push(key);
      const work = tail.then(fn);
      tail = work.catch(() => {});
      return work;
    },
  };
  const first = createTuningLibraryStore({ storage, locks }),
    second = createTuningLibraryStore({ storage, locks });
  const results = await Promise.allSettled([
    first.createProfile({ id: 'first', name: 'First' }),
    second.createProfile({ id: 'second', name: 'Second' }),
  ]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['fulfilled', 'rejected'],
  );
  assert.deepEqual(requests, [TUNING_LIBRARY_KEY, TUNING_LIBRARY_KEY]);
  assert.equal(first.status().concurrency, 'web-lock');
  assert.equal(JSON.parse(storage.getItem(TUNING_LIBRARY_KEY)).profiles.length, 2);
});

test('storage read/write failures preserve the previous state and visibly report the failure', async () => {
  const unreadable = createTuningLibraryStore({
    storage: {
      getItem() {
        throw new Error('read denied');
      },
    },
  });
  assert.equal(unreadable.status().blocked, true);
  assert.equal(unreadable.status().error, 'read denied');
  await assert.rejects(unreadable.createProfile({ id: 'x', name: 'X' }), /read denied/);
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createProfile({ id: 'pilot', name: 'Pilot' });
  const before = store.export(),
    disk = storage.getItem(TUNING_LIBRARY_KEY);
  storage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  await assert.rejects(store.saveProfile('pilot', { name: 'Cannot persist' }), /Quota exceeded/);
  assert.equal(store.export(), before);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), disk);
  assert.equal(store.status().error, 'Quota exceeded');
  await assert.rejects(
    createTuningLibraryStore().createProfile({ id: 'x', name: 'X' }),
    /Storage is unavailable/,
  );
});

test('backup restore is validated, atomic, detached and uses a fresh local revision', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createProfile({ id: 'pilot', name: 'Pilot' });
  const backup = store.export();
  await store.saveProfile('pilot', { name: 'Temporary' });
  const previousRevision = store.snapshot().revision;
  await store.restore(backup);
  assert.equal(store.snapshot().revision, previousRevision + 1);
  assert.equal(store.snapshot().profiles[1].name, 'Pilot');
  const restored = createTuningLibraryStore({ storage });
  assert.deepEqual(restored.snapshot(), store.snapshot());
  const before = store.export(),
    writes = storage.writes.length;
  const corrupt = JSON.parse(backup);
  corrupt.defaultProfileId = 'missing';
  assert.throws(() => store.restore(corrupt), /default/);
  assert.throws(() => store.restore('not JSON'));
  assert.throws(() => store.restore(' '.repeat(TUNING_LIBRARY_BYTES) + backup));
  assert.equal(store.export(), before);
  assert.equal(storage.writes.length, writes);
});

test('corrupt saved bytes are retained until an explicit valid backup restore', async () => {
  const storage = memory([[TUNING_LIBRARY_KEY, '{broken backup']]),
    store = createTuningLibraryStore({ storage });
  assert.equal(store.status().blocked, true);
  assert.equal(storage.writes.length, 0);
  await assert.rejects(store.saveProfile('legacy-feel', { name: 'Overwrite' }));
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), '{broken backup');
  await store.restore(initialTuningLibrary());
  assert.equal(store.status().blocked, false);
  assert.deepEqual(validateTuningLibrary(storage.getItem(TUNING_LIBRARY_KEY)), store.snapshot());
});

test('recovery still rejects stale corrupt bytes and preserves data if replacement storage fails', async () => {
  const storage = memory([[TUNING_LIBRARY_KEY, '{broken']]);
  const first = createTuningLibraryStore({ storage }),
    second = createTuningLibraryStore({ storage });
  await first.restore(initialTuningLibrary());
  const good = storage.getItem(TUNING_LIBRARY_KEY);
  await assert.rejects(second.restore(initialTuningLibrary()), /Another tab/);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), good);
  storage.data.set(TUNING_LIBRARY_KEY, '{damaged again');
  first.refresh();
  storage.setItem = () => {
    throw new Error('No quota');
  };
  await assert.rejects(first.restore(initialTuningLibrary()), /No quota/);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), '{damaged again');
  assert.equal(first.status().blocked, true);
});

test('profile/setup limits and referenced identities are validated before any write', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  for (let n = 1; n < 32; n++)
    await store.createProfile({ id: `profile-${n}`, name: `Profile ${n}` });
  const before = store.export(),
    writes = storage.writes.length;
  await assert.rejects(
    store.createProfile({ id: 'overflow', name: 'Overflow' }),
    /32 rate profiles/,
  );
  await assert.rejects(store.saveSetup(setup('bad-reference', 'missing')), /profile is missing/);
  await assert.rejects(store.selectSetup('missing'), /Selected drone/);
  assert.equal(store.export(), before);
  assert.equal(storage.writes.length, writes);
  const library = initialTuningLibrary();
  library.profiles.push(structuredClone(library.profiles[0]));
  assert.throws(() => validateTuningLibrary(library), /duplicate/);
});

test('saved Advanced aircraft/controller remain detached across rate and camera edits and full backup restore', async () => {
  const { validateAdvancedAircraft, createAdvancedAircraftTune } = await import(
    '../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const store = createTuningLibraryStore({ storage: memory() });
  const advanced = {
    aircraft: validateAdvancedAircraft('racing'),
    controller: createAdvancedAircraftTune('racing'),
  };
  await store.saveSetup({ ...store.snapshot().setups[0], advanced });
  const initial = store.effective();
  advanced.aircraft.mass = 5;
  assert.notEqual(store.effective().advanced.aircraft.mass, 5);
  await store.saveProfile('legacy-feel', { response: createTunedResponse() });
  const drone = store.snapshot().setups[0];
  drone.camera.verticalFov = 118;
  await store.saveEditing('legacy-feel', { name: 'Rates and camera only' }, drone);
  assert.deepEqual(store.effective().advanced, initial.advanced);
  assert.equal(store.effective().camera.verticalFov, 118);
  assert.deepEqual(initial.response, DEFAULT_RESPONSE);
  const restored = createTuningLibraryStore({ storage: memory() });
  await restored.restore(store.export());
  assert.deepEqual(restored.effective().advanced, initial.advanced);
});

test('invalid or incomplete Advanced backup setup rejects atomically without changing existing rates or camera', async () => {
  const { validateAdvancedAircraft, createAdvancedAircraftTune } = await import(
    '../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.saveSetup({
    ...store.snapshot().setups[0],
    advanced: {
      aircraft: validateAdvancedAircraft('freestyle'),
      controller: createAdvancedAircraftTune('freestyle'),
    },
  });
  const before = store.export(),
    writes = storage.writes.length;
  for (const mutate of [
    (backup) => {
      backup.setups[0].advanced = {};
    },
    (backup) => {
      delete backup.setups[0].advanced.controller;
    },
    (backup) => {
      backup.setups[0].advanced.aircraft.mass = -1;
    },
    (backup) => {
      backup.setups[0].advanced.controller.gains.roll.p = -1;
    },
    (backup) => {
      backup.setups[0].advanced.controller.betaflightPid = 42;
    },
  ]) {
    const backup = JSON.parse(before);
    mutate(backup);
    assert.throws(() => store.restore(backup));
    assert.equal(store.export(), before);
    assert.equal(storage.writes.length, writes);
  }
});

function deferredLibraryLock() {
  const pending = [];
  return {
    pending,
    request(key, run) {
      return new Promise((resolve, reject) => pending.push({ key, run, resolve, reject }));
    },
    release() {
      const item = pending.shift();
      assert.ok(item, 'A save must be waiting for its lock');
      try {
        item.resolve(item.run());
      } catch (failure) {
        item.reject(failure);
      }
    },
  };
}

test('queued profile creation and updates snapshot caller-owned response objects before waiting for a Web Lock', async () => {
  const locks = deferredLibraryLock(),
    store = createTuningLibraryStore({ storage: memory(), locks });
  const response = createTunedResponse(createRateProfile({ axes: { roll: { rate: 91 } } }));
  const creation = { id: 'queued', name: 'Submitted name', response };
  const creating = store.createProfile(creation);
  creation.id = 'mutated-id';
  creation.name = 'Changed later';
  response.rates.axes.roll.rate = 30;
  assert.equal(store.snapshot().profiles.length, 1);
  locks.release();
  await creating;
  const created = store.snapshot().profiles.find((profile) => profile.id === 'queued');
  assert.equal(created.name, 'Submitted name');
  assert.equal(created.response.rates.axes.roll.rate, 91);
  const patch = {
    name: 'Submitted update',
    response: createTunedResponse(createRateProfile({ axes: { yaw: { expo: 24 } } })),
  };
  const saving = store.saveProfile('queued', patch);
  patch.name = 'Changed while waiting';
  patch.response.rates.axes.yaw.expo = 83;
  locks.release();
  await saving;
  const saved = store.snapshot().profiles.find((profile) => profile.id === 'queued');
  assert.equal(saved.name, 'Submitted update');
  assert.equal(saved.response.rates.axes.yaw.expo, 24);
});

test('queued drone creation selects the submitted snapshot and rejects a later competing write', async () => {
  const locks = deferredLibraryLock(),
    storage = memory(),
    store = createTuningLibraryStore({ storage, locks });
  const submitted = setup('submitted', 'legacy-feel', { tilt: 31, verticalFov: 103 });
  const creating = store.createAndSelectSetup(submitted);
  submitted.id = 'changed-after-click';
  submitted.camera.tilt = 55;
  locks.release();
  await creating;
  assert.equal(store.snapshot().selectedSetupId, 'submitted');
  assert.equal(store.effective().camera.tilt, 31);
  assert.equal(storage.writes.length, 1);
  const queued = store.createAndSelectSetup(setup('competing-copy'));
  const other = createTuningLibraryStore({ storage });
  await other.saveProfile('legacy-feel', { name: 'Other tab' });
  const before = storage.getItem(TUNING_LIBRARY_KEY);
  locks.release();
  await assert.rejects(queued, /Another tab/);
  assert.equal(storage.getItem(TUNING_LIBRARY_KEY), before);
  assert.equal(store.snapshot().selectedSetupId, 'submitted');
  assert.equal(store.snapshot().setups.length, 2);
});

test('queued setup and combined editing saves retain submitted IDs, camera, assignment and Advanced values', async () => {
  const { validateAdvancedAircraft, createAdvancedAircraftTune } = await import(
    '../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const locks = deferredLibraryLock(),
    store = createTuningLibraryStore({ storage: memory(), locks });
  const advanced = {
    aircraft: validateAdvancedAircraft('racing'),
    controller: createAdvancedAircraftTune('racing'),
  };
  const drone = { ...setup('new-drone', 'legacy-feel', { tilt: 21, verticalFov: 99 }), advanced };
  const savingDrone = store.saveSetup(drone);
  drone.id = 'later-id';
  drone.camera.tilt = 50;
  drone.profileId = 'missing';
  advanced.aircraft.mass = 8;
  locks.release();
  await savingDrone;
  const saved = store.snapshot().setups.find((item) => item.id === 'new-drone');
  assert.equal(saved.camera.tilt, 21);
  assert.equal(saved.profileId, 'legacy-feel');
  assert.equal(saved.advanced.aircraft.mass, 0.45);
  const edits = {
    name: 'Combined save',
    response: createTunedResponse(createRateProfile({ axes: { roll: { rate: 80 } } })),
  };
  const combined = { ...structuredClone(saved), camera: { tilt: 29, verticalFov: 110 } };
  const savingBoth = store.saveEditing('legacy-feel', edits, combined);
  edits.name = 'Not submitted';
  edits.response.rates.axes.roll.rate = 20;
  combined.id = 'does-not-exist';
  combined.camera.verticalFov = 42;
  combined.advanced.controller.gains.roll.p = 1;
  locks.release();
  await savingBoth;
  assert.equal(store.snapshot().profiles[0].name, 'Combined save');
  assert.equal(store.snapshot().profiles[0].response.rates.axes.roll.rate, 80);
  const resolved = resolveFlightConfiguration(store.snapshot(), 'new-drone');
  assert.equal(resolved.camera.verticalFov, 110);
  assert.equal(resolved.advanced.controller.gains.roll.p, saved.advanced.controller.gains.roll.p);
});

test('queued restore already owns a validated snapshot and a competing revision still rejects', async () => {
  const locks = deferredLibraryLock(),
    storage = memory(),
    store = createTuningLibraryStore({ storage, locks });
  const backup = initialTuningLibrary();
  backup.profiles[0].name = 'Submitted backup';
  const restoring = store.restore(backup);
  backup.profiles[0].name = 'Changed during lock wait';
  backup.setups[0].camera.tilt = 60;
  locks.release();
  await restoring;
  assert.equal(store.snapshot().profiles[0].name, 'Submitted backup');
  assert.equal(store.effective().camera.tilt, 10);
  const saving = store.saveProfile('legacy-feel', { name: 'Stale queued name' });
  const other = createTuningLibraryStore({ storage });
  await other.saveProfile('legacy-feel', { name: 'Other tab saved first' });
  locks.release();
  await assert.rejects(saving, /Another tab/);
  assert.equal(
    JSON.parse(storage.getItem(TUNING_LIBRARY_KEY)).profiles[0].name,
    'Other tab saved first',
  );
});

test('queued public APIs reject accessor-bearing payloads without running caller code or requesting a lock', async () => {
  const locks = deferredLibraryLock(),
    store = createTuningLibraryStore({ storage: memory(), locks });
  let evaluated = false;
  const injected = {
    get response() {
      evaluated = true;
      return createTunedResponse();
    },
  };
  await assert.rejects(store.saveProfile('legacy-feel', injected), /ordinary|fields/i);
  const creation = { id: 'injected', name: 'Injected' };
  Object.defineProperty(
    creation,
    'response',
    Object.getOwnPropertyDescriptor(injected, 'response'),
  );
  await assert.rejects(store.createProfile(creation), /ordinary|fields/i);
  const drone = setup('my-drone');
  Object.defineProperty(drone.camera, 'tilt', {
    enumerable: true,
    get() {
      evaluated = true;
      return 20;
    },
  });
  await assert.rejects(store.saveSetup(drone), /ordinary|fields/i);
  assert.equal(evaluated, false);
  assert.equal(locks.pending.length, 0);
});

test('resetting externally removed storage reuses the original detached migration settings', async () => {
  const response = { ...DEFAULT_RESPONSE, maxRate: 420 },
    camera = { tilt: 23, verticalFov: 91 };
  const storage = memory(),
    store = createTuningLibraryStore({ storage, response, camera });
  await store.createProfile({ id: 'saved', name: 'Saved' });
  response.maxRate = 100;
  camera.tilt = 60;
  storage.data.delete(TUNING_LIBRARY_KEY);
  store.refresh();
  assert.equal(store.effective().response.maxRate, 420);
  assert.equal(store.effective().camera.tilt, 23);
  assert.equal(store.snapshot().revision, 0);
});

test('effective configuration fingerprints include Advanced physical tuning and exclude labels and camera', async () => {
  const { validateAdvancedAircraft, createAdvancedAircraftTune } = await import(
    '../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const library = initialTuningLibrary(),
    beforeAdvanced = resolveFlightConfiguration(library).simulationIdentity;
  library.setups[0].advanced = {
    aircraft: validateAdvancedAircraft('racing'),
    controller: createAdvancedAircraftTune('racing'),
  };
  const original = resolveFlightConfiguration(library);
  assert.notEqual(original.simulationIdentity, beforeAdvanced);
  for (const mutate of [
    (copy) => {
      copy.setups[0].advanced.aircraft.mass += 0.01;
    },
    (copy) => {
      copy.setups[0].advanced.controller.gains.roll.p += 0.001;
    },
    (copy) => {
      copy.setups[0].advanced.aircraft.battery.resistance += 0.01;
    },
  ]) {
    const changed = structuredClone(library);
    mutate(changed);
    assert.notEqual(
      resolveFlightConfiguration(changed).simulationIdentity,
      original.simulationIdentity,
    );
  }
  library.profiles[0].id = library.defaultProfileId = 'renamed-profile';
  library.profiles[0].name = 'Different display name';
  library.setups[0].id = library.selectedSetupId = 'renamed-drone';
  library.setups[0].name = 'Different drone name';
  library.setups[0].camera = { tilt: 42, verticalFov: 120 };
  library.setups[0].advanced.aircraft.id = 'custom-label';
  const cosmetic = resolveFlightConfiguration(library);
  assert.equal(cosmetic.simulationIdentity, original.simulationIdentity);
  assert.equal(cosmetic.advanced.aircraft.id, 'custom-label');
  assert.equal(original.advanced.aircraft.id, 'racing');
});

test('import receipts survive rename, duplication, revision restore and backup without changing flight identity', async () => {
  const { previewBetaflightImport } = await import(
    '../../optional-practice/civilian-fpv/betaflight-import.mjs'
  );
  const { profile, provenance } = await previewBetaflightImport(
    'set yaw_srate = 82\nset p_roll = 80',
    { kind: 'diff', sourceVersion: '2026.6.2' },
  );
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  const response = createTunedResponse(profile);
  await store.createProfile({ id: 'imported', name: 'Imported', response, provenance });
  await store.createProfile({ id: 'plain', name: 'Same rates', response });
  await store.setDefault('imported');
  const frozen = store.effective();
  await store.setDefault('plain');
  assert.equal(store.effective().simulationIdentity, frozen.simulationIdentity);
  assert.equal(Object.hasOwn(frozen, 'provenance'), false);
  await store.saveProfile('imported', { name: 'Renamed' });
  await store.duplicateProfile('imported', 'copy', 'Copy');
  assert.deepEqual(store.snapshot().profiles.find((p) => p.id === 'copy').provenance, provenance);
  const changed = createTunedResponse(createRateProfile({ axes: { yaw: { rate: 90 } } }));
  await store.saveProfile('imported', { response: changed });
  let saved = store.snapshot().profiles.find((p) => p.id === 'imported');
  assert.equal(saved.provenance, undefined);
  assert.deepEqual(saved.history[1].provenance, provenance);
  await store.revertProfile('imported', 1);
  saved = store.snapshot().profiles.find((p) => p.id === 'imported');
  assert.deepEqual(saved.provenance, provenance);
  const backup = store.export();
  const restored = createTuningLibraryStore({ storage: memory() });
  await restored.restore(backup);
  assert.deepEqual(restored.snapshot().profiles, store.snapshot().profiles);
  assert.deepEqual(createTuningLibraryStore({ storage }).snapshot(), store.snapshot());
});

test('mismatched or future import receipts fail atomically and never enable ignored controller settings', async () => {
  const { previewBetaflightImport } = await import(
    '../../optional-practice/civilian-fpv/betaflight-import.mjs'
  );
  const { profile, provenance } = await previewBetaflightImport(
    'set yaw_srate = 82\nset p_roll = 80',
    { kind: 'diff', sourceVersion: '2026.6.2' },
  );
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  await store.createProfile({
    id: 'imported',
    name: 'Imported',
    response: createTunedResponse(profile),
    provenance,
  });
  const before = store.export(),
    writes = storage.writes.length;
  await assert.rejects(
    store.createProfile({
      id: 'mismatch',
      name: 'Mismatch',
      response: createTunedResponse(),
      provenance,
    }),
    /does not describe/,
  );
  const corrupt = JSON.parse(before);
  corrupt.profiles[1].provenance.activePid = { p_roll: 80 };
  assert.throws(() => store.restore(corrupt), /not supported/);
  assert.equal(store.export(), before);
  assert.equal(storage.writes.length, writes);
  assert.equal(store.effective().advanced, undefined);
});

test('queued provenance creation owns its receipt before waiting for a lock', async () => {
  const { previewNativeRateImport, exportNativeRateProfile } = await import(
    '../../optional-practice/civilian-fpv/betaflight-import.mjs'
  );
  const result = await previewNativeRateImport(exportNativeRateProfile(createRateProfile()));
  let release;
  const store = createTuningLibraryStore({
    storage: memory(),
    locks: {
      request: (_key, fn) =>
        new Promise((resolve) => {
          release = () => resolve(fn());
        }),
    },
  });
  const expected = structuredClone(result.provenance);
  const pending = store.createProfile({
    id: 'imported',
    name: 'Imported',
    response: createTunedResponse(result.profile),
    provenance: result.provenance,
  });
  result.provenance.source.sha256 = 'a'.repeat(64);
  release();
  await pending;
  assert.deepEqual(store.snapshot().profiles[1].provenance, expected);
});
