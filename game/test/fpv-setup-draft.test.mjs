import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSetupDraft,
  setupDraftChanges,
} from '../../optional-practice/civilian-fpv/setup-draft.mjs';
import {
  createTuningLibraryStore,
  initialTuningLibrary,
  profileUsers,
  resolveFlightConfiguration,
} from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { createTunedResponse } from '../../optional-practice/civilian-fpv/flight-response.mjs';

function memory() {
  const data = new Map(),
    writes = [];
  return {
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      writes.push(value);
      data.set(key, value);
    },
  };
}
async function physicalStore(storage = memory(), locks) {
  const store = createTuningLibraryStore({ storage, locks });
  await store.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'meteor',
    profileId: 'meteor-rates',
    rates: 'defaults',
  });
  return store;
}

test('draft editing changes only detached state and reports all four setting groups', async () => {
  const store = await physicalStore(),
    before = store.export(),
    flight = store.effective();
  const draft = createSetupDraft({ library: store.snapshot() });
  draft.edit(({ setup, profile }) => {
    setup.advanced.aircraft.motorTimeConstant *= 1.1;
    setup.advanced.controller.gains.roll.p *= 1.1;
    setup.camera.tilt += 1;
    profile.response.rates.axes.roll.expo += 1;
  });
  assert.deepEqual(
    new Set(draft.changes().map((entry) => entry.group)),
    new Set(['aircraft', 'controller', 'camera', 'rates']),
  );
  assert.equal(store.export(), before);
  assert.deepEqual(store.effective(), flight);
  const detached = draft.snapshot();
  detached.setup.camera.tilt = 59;
  assert.notEqual(draft.snapshot().setup.camera.tilt, 59);
  assert.equal(draft.state().sourceRevision, store.snapshot().revision);
});

test('numeric text stays raw through invalid edits, model switches, undo and atomic submission', () => {
  const draft = createSetupDraft({
    library: initialTuningLibrary({ response: createTunedResponse() }),
  });
  const path = 'profile.response.rates.axes.roll.expo';
  draft.setNumeric(path, '-');
  assert.throws(() => draft.submission(), /complete number/);
  assert.equal(draft.snapshot().profile.response.rates.axes.roll.expo, 0);
  draft.switchRateModel('kiss');
  assert.equal(draft.state().numericText[path], undefined);
  draft.switchRateModel('actual');
  assert.equal(draft.state().numericText[path], '-');
  draft.setNumeric('setup.camera.verticalFov', '96');
  draft.switchRateModel('quick');
  assert.equal(draft.state().numericText['setup.camera.verticalFov'], '96');
  draft.switchRateModel('actual');
  draft.setNumeric(path, '');
  assert.throws(() => draft.commitNumeric(), /complete number/);
  assert.equal(draft.state().numericText[path], '');
  draft.undo();
  assert.equal(draft.state().numericText[path], '-');
  draft.setNumeric(path, '27');
  draft.setNumeric('setup.camera.tilt', '61');
  assert.throws(() => draft.commitNumeric(), /Camera tilt/);
  assert.equal(draft.snapshot().profile.response.rates.axes.roll.expo, 0);
  draft.setNumeric('setup.camera.tilt', '21');
  const request = draft.submission();
  assert.equal(request.profile.response.rates.axes.roll.expo, 27);
  assert.equal(request.setup.camera.tilt, 21);
  assert.equal(request.setup.camera.verticalFov, 96);
  assert.equal(draft.state().numericText[path], '27', 'submission does not consume raw text');
  draft.commitNumeric();
  assert.deepEqual(draft.state().numericText, {});
  assert.equal(draft.snapshot().profile.response.rates.axes.roll.expo, 27);
  assert.throws(() => draft.setNumeric('setup.__proto__.polluted', '1'), /Unknown numeric/);
});

test('Legacy and each native algorithm retain independent exact values', () => {
  const draft = createSetupDraft({ library: initialTuningLibrary() });
  draft.edit(({ profile }) => {
    profile.response.expo = 51;
    profile.response.maxRate = 680;
  });
  const legacy = draft.snapshot().profile.response;
  for (const [index, algorithm] of [
    'actual',
    'betaflight',
    'quick',
    'kiss',
    'raceflight',
  ].entries()) {
    draft.switchRateModel(algorithm);
    draft.edit(({ profile }) => {
      profile.response.rates.axes.yaw.expo = 10 + index;
    });
  }
  for (const [index, algorithm] of [
    'actual',
    'betaflight',
    'quick',
    'kiss',
    'raceflight',
  ].entries()) {
    draft.switchRateModel(algorithm);
    assert.equal(draft.snapshot().profile.response.rates.axes.yaw.expo, 10 + index);
  }
  draft.switchRateModel('legacy');
  assert.deepEqual(draft.snapshot().profile.response, legacy);
});

test('aircraft use is explicit, draft-only, reversible and can keep Legacy rates', () => {
  const library = initialTuningLibrary(),
    draft = createSetupDraft({ library });
  const original = draft.snapshot();
  draft.useAircraft('meteor75-analog-2022', { setupId: 'my-meteor', rates: 'keep' });
  assert.equal(draft.snapshot().setup.id, 'my-meteor');
  assert.deepEqual(draft.snapshot().profile.response, original.profile.response);
  assert.equal(library.setups.length, 1);
  draft.undo();
  assert.deepEqual(draft.snapshot(), original);
  draft.useAircraft('meteor75-analog-2022', { setupId: 'new-meteor' });
  assert.equal(draft.snapshot().profile.response.rates.algorithm, 'actual');
  draft.revert();
  assert.deepEqual(draft.snapshot(), original);
  assert.throws(
    () => draft.useAircraft('meteor75-analog-2022', { setupId: 'my-drone' }),
    /new setup ID/,
  );
});

test('complete save defaults to independent rate copy and freezes existing attempts', async () => {
  const storage = memory(),
    store = await physicalStore(storage);
  const originalSetup = store.snapshot().setups.find((setup) => setup.id === 'meteor');
  await store.saveSetup({ ...originalSetup, id: 'shared-drone', name: 'Shared drone' });
  const before = store.snapshot(),
    flight = store.effective(),
    writes = storage.writes.length;
  const draft = createSetupDraft({ library: before });
  draft.edit(({ setup, profile }) => {
    setup.camera.tilt = 24;
    setup.advanced.controller.gains.roll.p *= 1.1;
    profile.response.rates.axes.roll.expo = 39;
  });
  const saved = await store.saveSetupDraft(
    draft.submission({ newProfileId: 'private-rates', select: true }),
    draft.state().sourceRevision,
  );
  assert.equal(storage.writes.length, writes + 1);
  assert.equal(saved.setups.find((setup) => setup.id === 'meteor').profileId, 'private-rates');
  assert.deepEqual(
    saved.profiles.find((profile) => profile.id === 'meteor-rates'),
    before.profiles.find((profile) => profile.id === 'meteor-rates'),
  );
  assert.equal(
    resolveFlightConfiguration(saved, 'shared-drone').response.rates.axes.roll.expo,
    flight.response.rates.axes.roll.expo,
  );
  assert.equal(flight.camera.tilt, originalSetup.camera.tilt);
  draft.acceptSaved(saved);
  assert.equal(draft.state().dirty, false);
  assert.equal(draft.state().canUndo, false);
});

test('explicit shared update changes exactly its users with one profile revision', async () => {
  const store = await physicalStore();
  const shared = store.snapshot().setups.find((setup) => setup.id === 'meteor');
  await store.saveSetup({ ...shared, id: 'second', name: 'Second' });
  const draft = createSetupDraft({ library: store.snapshot() });
  assert.deepEqual(
    profileUsers(store.snapshot(), 'meteor-rates').map((setup) => setup.id),
    ['meteor', 'second'],
  );
  draft.edit(({ profile }) => {
    profile.response.rates.axes.pitch.expo = 45;
  });
  const saved = await store.saveSetupDraft(draft.submission({ rateAction: 'update' }));
  assert.equal(saved.profiles.length, 2);
  assert.equal(saved.profiles.find((profile) => profile.id === 'meteor-rates').history.length, 1);
  assert.equal(resolveFlightConfiguration(saved, 'second').response.rates.axes.pitch.expo, 45);
});

test('unchanged complete saves and camera-only changes do not create rates or history', async () => {
  const storage = memory(),
    store = await physicalStore(storage),
    before = store.snapshot(),
    writes = storage.writes.length;
  const draft = createSetupDraft({ library: before });
  await store.saveSetupDraft(draft.submission({ newProfileId: 'unused', select: true }));
  assert.deepEqual(store.snapshot(), before);
  assert.equal(storage.writes.length, writes);
  draft.edit(({ setup }) => {
    setup.camera.tilt++;
  });
  await store.saveSetupDraft(draft.submission());
  assert.deepEqual(store.snapshot().profiles, before.profiles);
  assert.equal(storage.writes.length, writes + 1);
  await store.saveProfile('meteor-rates', { name: before.profiles[1].name });
  assert.equal(storage.writes.length, writes + 1);
});

test('profile use explicitly assigns the intended rates without mutating previous assignment', async () => {
  const store = await physicalStore();
  const draft = createSetupDraft({ library: store.snapshot() });
  draft.useProfile('legacy-feel');
  const saved = await store.saveSetupDraft(draft.submission());
  assert.equal(saved.setups.find((setup) => setup.id === 'meteor').profileId, 'legacy-feel');
  assert.equal(saved.profiles.length, 2);
  assert.equal(store.effective().response.format, 'FlightResponseProfile.v1');
});

test('built-in draft creation saves physical configuration, copied rates and selection once', async () => {
  const storage = memory(),
    store = createTuningLibraryStore({ storage });
  const draft = createSetupDraft({ library: store.snapshot() });
  draft.useAircraft('meteor75-analog-2022', { setupId: 'my-meteor' });
  await store.saveSetupDraft(draft.submission({ newProfileId: 'my-meteor-rates', select: true }));
  assert.equal(storage.writes.length, 1);
  assert.equal(store.snapshot().selectedSetupId, 'my-meteor');
  assert.equal(store.effective().advanced.aircraft.id, 'meteor75-analog-2022');
  assert.equal(store.snapshot().profiles.length, 2);
});

test('invalid or quota-failed complete saves leave all persisted state unchanged', async () => {
  const storage = memory(),
    store = await physicalStore(storage),
    before = store.export();
  const draft = createSetupDraft({ library: store.snapshot() });
  draft.edit(({ profile }) => {
    profile.response.rates.axes.yaw.expo++;
  });
  const request = draft.submission({ newProfileId: 'copy' });
  request.setup.camera.tilt = 80;
  await assert.rejects(store.saveSetupDraft(request), /Camera tilt/);
  assert.equal(store.export(), before);
  storage.setItem = () => {
    throw new Error('quota full');
  };
  await assert.rejects(
    store.saveSetupDraft(draft.submission({ newProfileId: 'copy' })),
    /quota full/,
  );
  assert.equal(store.export(), before);
  assert.equal(draft.state().dirty, true);
});

test('stale tabs reject even no-op saves and retain pending draft state', async () => {
  const storage = memory(),
    first = await physicalStore(storage),
    second = createTuningLibraryStore({ storage });
  const draft = createSetupDraft({ library: second.snapshot() });
  const originalName = draft.snapshot().profile.name;
  await first.saveProfile('meteor-rates', { name: 'Changed elsewhere' });
  await assert.rejects(second.saveSetupDraft(draft.submission()), /Another tab/);
  assert.equal(draft.snapshot().profile.name, originalName);
});

test('queued save owns an immutable submission while operation generations reject late results', async () => {
  const storage = memory();
  let release;
  const store = createTuningLibraryStore({
    storage,
    locks: {
      request: (_key, run) =>
        new Promise((resolve) => {
          release = () => resolve(run());
        }),
    },
  });
  const draft = createSetupDraft({ library: store.snapshot() });
  draft.edit(({ setup }) => {
    setup.camera.tilt = 20;
  });
  const token = draft.operationToken(),
    request = draft.submission();
  const saving = store.saveSetupDraft(request);
  request.setup.camera.tilt = 59;
  draft.edit(({ setup }) => {
    setup.camera.tilt = 30;
  });
  assert.equal(draft.isCurrent(token), false);
  release();
  await saving;
  assert.equal(store.effective().camera.tilt, 20);
  assert.equal(draft.snapshot().setup.camera.tilt, 30);
  const closeToken = draft.operationToken();
  draft.invalidate();
  assert.equal(draft.isCurrent(closeToken), false);
});

test('saved setup selection resets its baseline and undo restores the previous draft', async () => {
  const store = await physicalStore();
  const draft = createSetupDraft({ library: store.snapshot() });
  draft.edit(({ setup }) => {
    setup.camera.tilt = 22;
  });
  const edited = draft.snapshot();
  draft.useSetup('my-drone');
  assert.equal(draft.state().dirty, false);
  assert.equal(draft.snapshot().setup.id, 'my-drone');
  draft.undo();
  assert.deepEqual(draft.snapshot(), edited);
  assert.deepEqual(setupDraftChanges(edited, edited), []);
});

test('one draft history captures invalid editor text atomically and bounds detached raw state', () => {
  const draft = createSetupDraft({ library: initialTuningLibrary() }),
    baseline = draft.snapshot();
  draft.capture(baseline, { camera: '10', rate: '240' });
  assert.equal(draft.state().canUndo, false);
  draft.capture(baseline, { camera: '', rate: '240' });
  assert.equal(draft.state().dirty, true);
  const raw = { camera: '', rate: '360' },
    invalid = structuredClone(baseline);
  invalid.setup.camera.tilt = null;
  invalid.profile.response.maxRate = 360;
  draft.capture(invalid, raw);
  raw.rate = '720';
  assert.equal(draft.state().editorState.rate, '360');
  assert.deepEqual(draft.snapshot(), baseline, 'raw text cannot become an executable config');
  draft.undo();
  assert.deepEqual(draft.state().editorState, { camera: '', rate: '240' });
  draft.undo();
  assert.equal(draft.state().dirty, false);
  assert.throws(() => draft.capture(baseline, { text: 'x'.repeat(70000) }), /budget/);
  assert.deepEqual(draft.state().editorState, { camera: '10', rate: '240' });
});
