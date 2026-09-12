import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import {
  DEFAULT_PREFERENCES,
  LIBRARY_STORAGE_VERSION,
  emptyLibrary,
  importLibrary,
  exportLibrary,
  validateLibrary,
  updatePreferences,
  mergeLibraries,
  loadLibrary,
  saveLibrary,
  recordLibraryCompletion,
  campaignKey,
} from '../library.mjs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup } from '../backup.mjs';
import { discoverProfileTransfers, prepareProfileTransfer } from '../profile-transfer.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'controller-preference-campaign',
  revision: '1',
  title: 'Controller preference migration',
  classRecipes: structuredClone(CLASSES),
  levels: [
    {
      version: 'xonix-level.v1',
      id: 'controller-preference-flight',
      revision: '1',
      name: 'Portable flight',
      width: 48,
      height: 36,
      spawn: { x: 24.5, y: 0.5 },
      walls: [],
      enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
      objectives: [],
      supplies: [],
      goal: { coverage: 0.3 },
    },
  ],
};
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const backupOptions = { campaigns: [campaign], decodeImage };
function customBindings() {
  const config = resolveControllerBindings();
  config.glyphFamily = 'playstation';
  config.flight.buttons.ability = 4;
  config.menu.buttons.confirm = 2;
  config.flight.stick.xAxis = 2;
  config.flight.stick.yAxis = 3;
  config.flight.stick.invertY = true;
  config.deadZone = { press: 0.45, release: 0.2 };
  return config;
}
function storage(raw, key = 'profile') {
  const map = new Map([[key, raw]]);
  const writes = [];
  return {
    map,
    writes,
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      writes.push([name, value]);
      map.set(name, value);
    },
    removeItem: (name) => {
      writes.push([name, null]);
      map.delete(name);
    },
  };
}
function wonLibrary() {
  const run = createRun(campaign.levels[0]);
  for (let tick = 0; tick < 5000 && run.status === 'running'; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  return recordLibraryCompletion(emptyLibrary(), {
    campaign,
    result: getSummary(run),
    runId: 'controller-preference-clear',
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: '2026-09-12T11:00:00.000Z',
  });
}
function sourceBackup() {
  const options = {
    classId: 'scout',
    classRecipes: campaign.classRecipes,
    turnPolicy: 'grid-center',
  };
  const run = createRun(campaign.levels[0], options);
  const recorder = createRecorder(campaign.levels[0], options, 'controller-preference-test');
  for (let tick = 0; tick < 100; tick++) {
    stepRun(run, { direction: 'down' }, FIXED_DT);
    recordInput(recorder, { direction: 'down' });
  }
  const session = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'controller-preference-flight',
    savedAt: '2026-09-12T12:00:00.000Z',
  });
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  pack.visualOverrides.background = { dataUrl: png, name: 'original.png' };
  return {
    run,
    backup: {
      format: BACKUP_FORMAT,
      library: wonLibrary(),
      packs: { format: 'xonix-pack-library.v1', packs: [pack] },
      session,
    },
  };
}
function assertAwards(actual, expected) {
  for (const key of ['campaigns', 'gallery', 'scores'])
    assert.deepEqual(actual[key], expected[key]);
}

test('only omitted controller preferences migrate to null without changing source bytes or awards', () => {
  const old = wonLibrary();
  delete old.preferences.controllerBindings;
  const bytes = JSON.stringify(old);
  const loaded = importLibrary(old, { campaigns: [campaign] });
  assert.equal(DEFAULT_PREFERENCES.controllerBindings, null);
  assert.equal(emptyLibrary().preferences.controllerBindings, null);
  assert.equal(loaded.preferences.controllerBindings, null);
  assertAwards(loaded, old);
  assert.equal(JSON.stringify(old), bytes);

  for (const raw of [
    bytes,
    JSON.stringify({
      format: LIBRARY_STORAGE_VERSION,
      generation: 'generation-before',
      library: old,
    }),
  ]) {
    const local = storage(raw);
    const result = loadLibrary(local, 'profile');
    assert.equal(result.warning, '');
    assert.equal(result.library.preferences.controllerBindings, null);
    assertAwards(result.library, old);
    assert.deepEqual(local.writes, []);
    assert.equal(local.getItem('profile'), raw);
  }
});

test('explicit remaps and null resets survive owned preference, export and storage roundtrips', () => {
  const original = wonLibrary();
  const bindings = customBindings();
  const expected = structuredClone(bindings);
  const next = updatePreferences(original, { controllerBindings: bindings });
  bindings.flight.stick.invertY = false;
  bindings.menu.buttons.confirm = 4;
  assert.deepEqual(next.preferences.controllerBindings, expected);
  assert.equal(original.preferences.controllerBindings, null);
  assertAwards(next, original);
  const imported = importLibrary(exportLibrary(next));
  assert.deepEqual(imported.preferences.controllerBindings, expected);
  imported.preferences.controllerBindings.deadZone.press = 0.5;
  assert.deepEqual(next.preferences.controllerBindings, expected);

  const local = storage(exportLibrary(original));
  assert.equal(saveLibrary(local, 'profile', next, null, { mode: 'replace' }).ok, true);
  assert.deepEqual(loadLibrary(local, 'profile').library.preferences.controllerBindings, expected);
  const reset = updatePreferences(next, { controllerBindings: null });
  assert.equal(saveLibrary(local, 'profile', reset, null, { mode: 'replace' }).ok, true);
  assert.equal(loadLibrary(local, 'profile').library.preferences.controllerBindings, null);
  assertAwards(loadLibrary(local, 'profile').library, original);
});

test('malformed or unknown controller configurations reject before any profile or recovery writes', () => {
  const baseline = wonLibrary();
  const bytes = exportLibrary(baseline);
  const local = storage(bytes);
  const invalid = [false, 'default', [], {}, undefined];
  for (const change of [
    (config) => (config.version = 'xonix-controllerbindings.v999'),
    (config) => (config.mapping = 'raw'),
    (config) => (config.glyphFamily = 'automatic'),
    (config) => delete config.flight.buttons.pause,
    (config) => (config.flight.buttons.ability = config.flight.buttons.pause),
    (config) => (config.menu.buttons.confirm = 16),
    (config) => (config.menu.stick.xAxis = config.menu.stick.yAxis),
    (config) => (config.flight.stick.enabled = 'true'),
    (config) => (config.deadZone = { press: 0.2, release: 0.4 }),
    (config) => (config.deadZone.press = Infinity),
    (config) => (config.script = 'run()'),
    (config) => (config.flight.buttons.extra = 6),
  ]) {
    const config = customBindings();
    change(config);
    invalid.push(config);
  }
  invalid.push(JSON.parse('{"__proto__":{"polluted":true}}'));
  for (const controllerBindings of invalid) {
    const candidate = { ...baseline, preferences: { ...baseline.preferences, controllerBindings } };
    assert.throws(() => updatePreferences(baseline, { controllerBindings }));
    assert.equal(validateLibrary(candidate).valid, false);
    assert.throws(() => importLibrary(candidate));
    assert.equal(
      saveLibrary(local, 'profile', candidate, 'corrupt-previous', { mode: 'replace' }).ok,
      false,
    );
    assert.equal(local.getItem('profile'), bytes);
    assert.deepEqual(local.writes, []);
    assert.equal(exportLibrary(baseline), bytes);
  }
});

test('controller preference accessors are rejected without invocation or writes', () => {
  let calls = 0;
  const getter = {
    enumerable: true,
    get() {
      calls++;
      return customBindings();
    },
  };
  const baseline = emptyLibrary();
  const local = storage(exportLibrary(baseline));
  const top = { ...baseline, preferences: { ...baseline.preferences } };
  Object.defineProperty(top.preferences, 'controllerBindings', getter);
  const nested = updatePreferences(baseline, { controllerBindings: customBindings() });
  Object.defineProperty(nested.preferences.controllerBindings.flight.buttons, 'ability', getter);
  for (const candidate of [top, nested]) {
    assert.equal(validateLibrary(candidate).valid, false);
    assert.throws(() => importLibrary(candidate));
    assert.equal(saveLibrary(local, 'profile', candidate).ok, false);
  }
  assert.equal(calls, 0);
  assert.deepEqual(local.writes, []);
});

test('canonical equality preserves remote remaps and applies deliberate config changes as one preference', () => {
  const baseline = updatePreferences(wonLibrary(), { controllerBindings: customBindings() });
  const remoteConfig = customBindings();
  remoteConfig.glyphFamily = 'xbox';
  remoteConfig.menu.buttons.confirm = 3;
  const remote = updatePreferences(baseline, { controllerBindings: remoteConfig });
  const reordered = Object.fromEntries(Object.entries(customBindings()).reverse());
  reordered.flight.buttons = Object.fromEntries(Object.entries(reordered.flight.buttons).reverse());
  const local = updatePreferences(baseline, { controllerBindings: reordered, musicGenre: 'rock' });
  assert.notEqual(local.preferences.controllerBindings, baseline.preferences.controllerBindings);
  const merged = mergeLibraries(local, remote, { baseline });
  assert.deepEqual(merged.preferences.controllerBindings, remoteConfig);
  assert.equal(merged.preferences.musicGenre, 'rock');
  assertAwards(merged, baseline);

  const changedConfig = customBindings();
  changedConfig.deadZone = { press: 0.5, release: 0.3 };
  const changed = updatePreferences(local, { controllerBindings: changedConfig });
  assert.deepEqual(
    mergeLibraries(changed, remote, { baseline }).preferences.controllerBindings,
    changedConfig,
  );
  const reset = updatePreferences(remote, { controllerBindings: null });
  assert.equal(
    mergeLibraries(reset, remote, { baseline: remote }).preferences.controllerBindings,
    null,
  );
  const oldBaseline = structuredClone(baseline);
  delete oldBaseline.preferences.controllerBindings;
  assert.deepEqual(
    mergeLibraries(importLibrary(oldBaseline), remote, { baseline: oldBaseline }).preferences
      .controllerBindings,
    remoteConfig,
  );
});

test('storage merge preserves another writer’s complete remap during an unrelated stale preference edit', () => {
  const old = wonLibrary();
  delete old.preferences.controllerBindings;
  const local = storage(JSON.stringify(old));
  const baseline = loadLibrary(local, 'profile');
  const remapped = updatePreferences(baseline.library, { controllerBindings: customBindings() });
  const savedRemap = saveLibrary(local, 'profile', remapped, null, {
    baseline: baseline.library,
    generation: baseline.generation,
  });
  assert.equal(savedRemap.ok, true);
  const stale = updatePreferences(baseline.library, { musicGenre: 'metal' });
  const savedStale = saveLibrary(local, 'profile', stale, null, {
    baseline: baseline.library,
    generation: baseline.generation,
  });
  assert.equal(savedStale.ok, true);
  assert.deepEqual(savedStale.library.preferences.controllerBindings, customBindings());
  assert.equal(savedStale.library.preferences.musicGenre, 'metal');
  assertAwards(savedStale.library, old);
  assert.deepEqual(loadLibrary(local, 'profile').library, savedStale.library);
});

for (const legacy of [true, false]) {
  test(`complete backup ${legacy ? 'migrates omitted' : 'preserves configured'} controller preferences without changing content or suspended flight`, async () => {
    const { backup, run } = sourceBackup();
    if (legacy) delete backup.library.preferences.controllerBindings;
    else
      backup.library = updatePreferences(backup.library, { controllerBindings: customBindings() });
    const original = JSON.stringify(backup);
    const ready = await prepareBackup(backup, backupOptions);
    assert.deepEqual(
      ready.library.preferences.controllerBindings,
      legacy ? null : customBindings(),
    );
    assertAwards(ready.library, backup.library);
    assert.equal(ready.packs.packs[0].visualOverrides.background.dataUrl, png);
    assert.deepEqual(ready.session, backup.session);
    assert.equal(JSON.stringify(backup), original);
    const imported = await prepareBackup(await exportBackup(ready, backupOptions), backupOptions);
    assert.deepEqual(imported, ready);
    const restored = await restoreSession(imported.session, {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  });
}

test('invalid backup preferences reject before content decode or caller adoption', async () => {
  const { backup } = sourceBackup();
  backup.library.preferences.controllerBindings = customBindings();
  backup.library.preferences.controllerBindings.flight.buttons.ability = 16;
  const original = JSON.stringify(backup);
  let decodes = 0;
  await assert.rejects(
    prepareBackup(backup, {
      ...backupOptions,
      decodeImage: async () => {
        decodes++;
        return decodeImage();
      },
    }),
    /controller/i,
  );
  assert.equal(decodes, 0);
  assert.equal(JSON.stringify(backup), original);
});

class Locks {
  held = new Set();
  async request(key, options, callback) {
    assert.equal(options.ifAvailable, true);
    assert.equal(options.mode, 'exclusive');
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key, mode: 'exclusive' });
    } finally {
      this.held.delete(key);
    }
  }
}
for (const legacy of [true, false]) {
  test(`previous-release copy ${legacy ? 'migrates omitted' : 'validates explicit'} controller settings while leaving source profile, assets and session untouched`, async () => {
    const { backup } = sourceBackup();
    if (legacy) delete backup.library.preferences.controllerBindings;
    else
      backup.library = updatePreferences(backup.library, { controllerBindings: customBindings() });
    const channel = 'release-v0.5.0';
    const raw = JSON.stringify({
      format: LIBRARY_STORAGE_VERSION,
      generation: 'generation-old',
      library: backup.library,
    });
    const sourceStorage = storage(raw, `revealline.library.${channel}.v1`);
    sourceStorage.map.set(`revealline.suspended.${channel}.v1`, JSON.stringify(backup.session));
    const assets = new Map([[`revealline.packs.${channel}.v1`, JSON.stringify(backup.packs)]]);
    const initialStorage = new Map(sourceStorage.map),
      initialAssets = new Map(assets);
    const lockManager = new Locks();
    const options = {
      ...backupOptions,
      currentVersion: 'v0.6.0',
      storage: sourceStorage,
      readAsset: async (key) => assets.get(key) ?? null,
      lockManager,
    };
    const source = discoverProfileTransfers(options)[0];
    assert.ok(source);
    const result = await prepareProfileTransfer(source.id, options);
    assert.deepEqual(
      result.prepared.library.preferences.controllerBindings,
      legacy ? null : customBindings(),
    );
    assertAwards(result.prepared.library, backup.library);
    assert.deepEqual(result.prepared.session, backup.session);
    assert.equal(result.prepared.packs.packs[0].visualOverrides.background.dataUrl, png);
    assert.equal(result.preview.pictures, 1);
    assert.equal(result.preview.hasSession, true);
    assert.equal(lockManager.held.size, 0);
    assert.deepEqual(sourceStorage.map, initialStorage);
    assert.deepEqual(assets, initialAssets);
    assert.deepEqual(sourceStorage.writes, []);

    const invalid = JSON.parse(raw);
    invalid.library.preferences.controllerBindings = { version: 'future' };
    const badRaw = JSON.stringify(invalid);
    sourceStorage.map.set(source.profileKey, badRaw);
    await assert.rejects(prepareProfileTransfer(source.id, options), /controller/i);
    assert.equal(sourceStorage.getItem(source.profileKey), badRaw);
    assert.equal(lockManager.held.size, 0);
    assert.deepEqual(sourceStorage.writes, []);
    assert.deepEqual(assets, initialAssets);
  });
}
