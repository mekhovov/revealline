import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROLLER_TUNE_FORMAT,
  CONTROLLER_TUNE_LIBRARY_KEY,
  CONTROLLER_TUNE_LIBRARY_BYTES,
  createControllerTuneLibraryStore,
  initialControllerTuneLibrary,
  validateControllerTune,
  validateControllerTuneLibrary,
  controllerTuneContext,
  controllerTuneCompatibility,
} from '../../optional-practice/civilian-fpv/controller-tune-library.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { ADVANCED_AIRCRAFT_TEMPLATES } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { DEFAULT_ADVANCED_TUNE } from '../../optional-practice/civilian-fpv/advanced-controller.mjs';
import { TUNING_LIBRARY_KEY } from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { createControllerTunePanel } from '../../optional-practice/civilian-fpv/controller-tune-panel.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

function memory(seed = []) {
  const data = new Map(seed),
    writes = [];
  return {
    data,
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      data.set(key, value);
      writes.push([key, value]);
    },
  };
}
function deferredLocks() {
  const pending = [];
  return {
    pending,
    request(key, callback) {
      return new Promise((resolve, reject) => pending.push({ key, callback, resolve, reject }));
    },
    release() {
      const item = pending.shift();
      try {
        item.resolve(item.callback());
      } catch (failure) {
        item.reject(failure);
      }
    },
  };
}
function aircraft(id = 'meteor75-analog-2022') {
  const config = createPresetConfiguration(id);
  return { aircraft: config.aircraft, controller: config.controller };
}
function tune(id = 'precise', advanced = aircraft()) {
  const context = controllerTuneContext(advanced);
  return {
    id,
    name: 'Precise response',
    family: context.family,
    controller: structuredClone(advanced.controller),
    sourceAircraft: context.sourceAircraft,
  };
}

test('controller tunes use a separate entry and never write on startup or mutate applied setups', async () => {
  const storage = memory([[TUNING_LIBRARY_KEY, 'existing setup bytes']]);
  const store = createControllerTuneLibraryStore({ storage });
  assert.deepEqual(store.snapshot(), initialControllerTuneLibrary());
  assert.equal(storage.writes.length, 0);
  const setup = aircraft();
  const saved = tune('precise', setup);
  await store.saveTune(saved);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0][0], CONTROLLER_TUNE_LIBRARY_KEY);
  assert.equal(storage.data.get(TUNING_LIBRARY_KEY), 'existing setup bytes');
  saved.controller.gains.roll.p *= 2;
  const loaded = store.loadTune('precise', controllerTuneContext(setup));
  assert.equal(loaded.compatibility.responseUntested, false);
  loaded.controller.gains.roll.p *= 3;
  assert.deepEqual(
    store.loadTune('precise', controllerTuneContext(setup)).controller,
    setup.controller,
  );
  const applied = structuredClone(loaded.controller);
  await store.renameTune('precise', 'Renamed');
  await store.removeTune('precise');
  assert.deepEqual(loaded.controller, applied);
  assert.deepEqual(store.snapshot().tunes, []);
});

test('compatibility matches exact family/format and reports changed aircraft without rescaling gains', async () => {
  const source = aircraft();
  const other = structuredClone(source);
  other.aircraft.mass *= 1.1;
  const same = structuredClone(source);
  same.aircraft.id = 'renamed-aircraft';
  const portable = { format: CONTROLLER_TUNE_FORMAT, ...tune() };
  delete portable.id;
  assert.equal(
    controllerTuneCompatibility(portable, controllerTuneContext(same)).responseUntested,
    false,
  );
  assert.equal(
    controllerTuneCompatibility(portable, controllerTuneContext(other)).responseUntested,
    true,
  );
  assert.equal(controllerTuneCompatibility(portable, null).compatible, false);
  const independent = {
    aircraft: ADVANCED_AIRCRAFT_TEMPLATES.freestyle,
    controller: DEFAULT_ADVANCED_TUNE,
  };
  assert.equal(
    controllerTuneCompatibility(portable, controllerTuneContext(independent)).compatible,
    false,
  );
  const store = createControllerTuneLibraryStore({ storage: memory() });
  await store.saveTune(tune());
  assert.deepEqual(
    store.loadTune('precise', controllerTuneContext(other)).controller,
    source.controller,
  );
  assert.throws(
    () => store.loadTune('precise', controllerTuneContext(independent)),
    /incompatible/,
  );
  await store.saveTune(tune('independent', independent));
  assert.equal(store.snapshot().tunes[1].controller.format, 'AdvancedControllerTune.v2');
  const mismatch = tune();
  mismatch.family = 'sim-independent-pid.v2';
  await assert.rejects(store.saveTune(mismatch), /family and tune format/);
  const old = tune('old', independent);
  old.controller.format = 'AdvancedControllerTune.v1';
  delete old.controller.feedforwardFilterHz;
  await assert.rejects(store.saveTune(old), /family and tune format/);
});

test('same saves are no-ops; update history is bounded and reverting creates an independent current revision', async () => {
  const storage = memory(),
    store = createControllerTuneLibraryStore({ storage });
  const original = tune();
  await store.saveTune(original);
  const first = store.export();
  await store.saveTune(original);
  await store.renameTune('precise', original.name);
  assert.equal(store.export(), first);
  assert.equal(storage.writes.length, 1);
  for (let index = 1; index <= 30; index++) await store.renameTune('precise', `Response ${index}`);
  const saved = store.snapshot().tunes[0];
  assert.equal(saved.history.length, 24);
  assert.equal(saved.history[0].revision, 6);
  assert.equal(saved.revision, 30);
  await store.revertTune('precise', 10);
  assert.equal(store.snapshot().tunes[0].name, 'Response 10');
  assert.equal(store.snapshot().tunes[0].revision, 31);
  await assert.rejects(store.revertTune('precise', 0), /no longer available/);
});

test('duplicate tune and portable import have new identities and independent revision histories', async () => {
  const store = createControllerTuneLibraryStore({ storage: memory() });
  await store.saveTune(tune());
  await store.duplicateTune('precise', 'copy', 'Response copy');
  const exported = store.exportTune('precise');
  assert.equal(JSON.parse(exported).id, undefined);
  await store.importTune(exported, { id: 'imported', name: 'Imported response' });
  assert.equal(store.snapshot().tunes.length, 3);
  const copy = store.snapshot().tunes[1];
  copy.controller.gains.roll.p *= 2;
  const { revision, history, ...edit } = copy;
  await store.saveTune(edit);
  assert.equal(store.snapshot().tunes[0].revision, 0);
  assert.equal(store.snapshot().tunes[2].revision, 0);
  await assert.rejects(store.importTune(exported, { id: 'copy' }), /already exists/);
  const before = store.export();
  await assert.rejects(store.duplicateTune('precise', 'copy', 'Duplicate'), /already exists/);
  assert.equal(store.export(), before);
});

test('library backups restore atomically and cannot accidentally restore the setup library', async () => {
  const source = createControllerTuneLibraryStore({ storage: memory() });
  await source.saveTune(tune());
  await source.renameTune('precise', 'Renamed');
  const storage = memory([[TUNING_LIBRARY_KEY, 'do not change']]);
  const target = createControllerTuneLibraryStore({ storage });
  await target.restore(source.export());
  assert.deepEqual(target.snapshot().tunes, source.snapshot().tunes);
  assert.equal(target.snapshot().revision, 1);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.data.get(TUNING_LIBRARY_KEY), 'do not change');
  assert.throws(
    () => target.restore({ format: 'FpvTuningLibrary.v1' }),
    /not supported|Unsupported/,
  );
  assert.equal(storage.writes.length, 1);
});

test('storage errors preserve both persisted and in-memory tunes and remain recoverable', async () => {
  const storage = memory(),
    store = createControllerTuneLibraryStore({ storage });
  await store.saveTune(tune());
  const before = store.export(),
    bytes = storage.getItem(CONTROLLER_TUNE_LIBRARY_KEY);
  const save = storage.setItem;
  storage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  await assert.rejects(store.renameTune('precise', 'Cannot save'), /Quota exceeded/);
  assert.equal(store.export(), before);
  assert.equal(storage.getItem(CONTROLLER_TUNE_LIBRARY_KEY), bytes);
  assert.equal(store.status().error, 'Quota exceeded');
  storage.setItem = save;
  await store.renameTune('precise', 'Recovered');
  assert.equal(store.status().error, null);
  const unavailable = createControllerTuneLibraryStore();
  await assert.rejects(unavailable.saveTune(tune()), /Storage is unavailable/);
  assert.deepEqual(unavailable.snapshot(), initialControllerTuneLibrary());
});

test('stale tabs and stale expected revisions cannot overwrite newer tune libraries', async () => {
  const storage = memory(),
    a = createControllerTuneLibraryStore({ storage }),
    b = createControllerTuneLibraryStore({ storage });
  await a.saveTune(tune());
  await assert.rejects(b.saveTune(tune('other')), /Another tab/);
  b.refresh();
  await b.renameTune('precise', 'Other tab');
  await assert.rejects(a.renameTune('precise', 'Old edit'), /Another tab/);
  a.refresh();
  await assert.rejects(a.renameTune('precise', 'Old revision', 1), /tunes changed/);
  assert.equal(a.snapshot().tunes[0].name, 'Other tab');
  storage.data.set(CONTROLLER_TUNE_LIBRARY_KEY, `${storage.getItem(CONTROLLER_TUNE_LIBRARY_KEY)} `);
  await assert.rejects(a.renameTune('precise', 'Same revision, different bytes'), /Another tab/);
});

test('queued saves and restores own their submission before the Web Lock is granted', async () => {
  const locks = deferredLocks(),
    storage = memory(),
    store = createControllerTuneLibraryStore({ storage, locks });
  const requested = tune(),
    expected = structuredClone(requested.controller);
  const saving = store.saveTune(requested);
  requested.controller.gains.roll.p *= 10;
  assert.equal(locks.pending[0].key, CONTROLLER_TUNE_LIBRARY_KEY);
  locks.release();
  await saving;
  assert.deepEqual(store.snapshot().tunes[0].controller, expected);
  const backup = store.snapshot();
  backup.tunes[0].name = 'Restore submission';
  const restoring = store.restore(backup);
  backup.tunes[0].name = 'Later mutation';
  locks.release();
  await restoring;
  assert.equal(store.snapshot().tunes[0].name, 'Restore submission');
  assert.equal(store.status().concurrency, 'web-lock');
});

test('queued competing mutations validate revision after the lock is acquired', async () => {
  const locks = deferredLocks(),
    store = createControllerTuneLibraryStore({ storage: memory(), locks });
  const first = store.saveTune(tune('one'));
  const second = store.saveTune(tune('two'));
  const rejected = assert.rejects(second, /tunes changed/);
  locks.release();
  await first;
  locks.release();
  await rejected;
  assert.deepEqual(
    store.snapshot().tunes.map((item) => item.id),
    ['one'],
  );
});

test('corrupt data is not rewritten on startup; explicit restore can recover observed corrupt bytes', async () => {
  const storage = memory([[CONTROLLER_TUNE_LIBRARY_KEY, '{broken']]);
  const store = createControllerTuneLibraryStore({ storage });
  assert.equal(store.status().blocked, true);
  assert.equal(store.exportOriginal(), '{broken');
  assert.equal(storage.writes.length, 0);
  await assert.rejects(store.saveTune(tune()));
  await store.restore(initialControllerTuneLibrary());
  assert.equal(store.status().blocked, false);
  assert.equal(store.snapshot().revision, 1);
  assert.equal(storage.writes.length, 1);
  storage.data.set(CONTROLLER_TUNE_LIBRARY_KEY, 'corrupt again');
  store.refresh();
  storage.data.set(CONTROLLER_TUNE_LIBRARY_KEY, 'different corrupt bytes');
  await assert.rejects(store.restore(initialControllerTuneLibrary()), /Another tab/);
});

test('32 tune cap, unique IDs and total encoded byte budget reject before storage changes', async () => {
  const storage = memory(),
    store = createControllerTuneLibraryStore({ storage });
  for (let index = 0; index < 32; index++) await store.saveTune(tune(`tune-${index}`));
  const before = store.export(),
    count = storage.writes.length;
  await assert.rejects(store.saveTune(tune('overflow')), /at most 32/);
  assert.equal(store.export(), before);
  assert.equal(storage.writes.length, count);
  const duplicate = store.snapshot();
  duplicate.tunes[1].id = duplicate.tunes[0].id;
  assert.throws(() => validateControllerTuneLibrary(duplicate), /duplicate/);
  const huge = store.snapshot();
  for (const item of huge.tunes) {
    item.name = '🛩'.repeat(60);
    item.revision = 24;
    const { id, history, revision, ...entry } = item;
    item.history = Array.from({ length: 24 }, (_, index) => ({
      ...structuredClone(entry),
      revision: index,
    }));
  }
  assert.ok(new TextEncoder().encode(JSON.stringify(huge)).length > CONTROLLER_TUNE_LIBRARY_BYTES);
  assert.throws(() => store.restore(huge), /budget/);
  assert.equal(store.export(), before);
});

test('malformed or sparse controller inputs cannot import active gains', async () => {
  const store = createControllerTuneLibraryStore({ storage: memory() });
  for (const change of [
    (value) => {
      delete value.controller.gains.roll.p;
    },
    (value) => {
      value.controller.gains.roll.p = NaN;
    },
    (value) => {
      value.controller.gains.roll.p = -1;
    },
    (value) => {
      value.controller.betaflightPid = 50;
    },
    (value) => {
      value.family = 'betaflight';
    },
    (value) => {
      value.sourceAircraft.identity = 'unverified';
    },
    (value) => {
      value.unexpected = true;
    },
  ]) {
    const value = tune();
    change(value);
    await assert.rejects(store.saveTune(value));
  }
  assert.deepEqual(store.snapshot(), initialControllerTuneLibrary());
  assert.throws(() => validateControllerTune({ format: 'AdvancedControllerTune.v3' }));
});

test('untrusted input never executes getters, including compatibility checks', async () => {
  let calls = 0;
  const value = tune();
  Object.defineProperty(value, 'name', {
    enumerable: true,
    get() {
      calls++;
      return 'getter';
    },
  });
  const locks = deferredLocks(),
    store = createControllerTuneLibraryStore({ storage: memory(), locks });
  await assert.rejects(store.saveTune(value), /ordinary|data|accessors/);
  assert.throws(() => controllerTuneCompatibility(value, null), /ordinary|data|accessors/);
  assert.equal(calls, 0);
  assert.equal(locks.pending.length, 0);
});

function panelFixture(t) {
  const document = new Document(),
    window = new Events(),
    storage = memory();
  window.localStorage = storage;
  const store = createControllerTuneLibraryStore({ storage });
  let draft = aircraft(),
    locale = 'en';
  const used = [],
    failures = [];
  const panel = createControllerTunePanel({
    document,
    window,
    store,
    locale: () => locale,
    getConfiguration: () => ({ advanced: draft }),
    onUse: (controller, metadata) => used.push({ controller, metadata }),
    report: (failure) => failures.push(failure),
  });
  document.body.append(panel.root);
  t.after(() => panel.dispose());
  const find = (name, tag = 'input') => {
    const node = panel.root
      .querySelectorAll(tag)
      .find((item) => item.getAttribute('aria-label') === name);
    assert.ok(node, `Missing ${name}`);
    return node;
  };
  const action = (name) => {
    const node = panel.root.querySelectorAll('button').find((item) => item.textContent === name);
    assert.ok(node, `Missing ${name}`);
    return node;
  };
  const click = async (name) => {
    action(name).emit('click');
    await new Promise((resolve) => setImmediate(resolve));
  };
  return {
    panel,
    store,
    storage,
    document,
    window,
    used,
    failures,
    find,
    action,
    click,
    setDraft(value) {
      draft = value;
      panel.refresh();
    },
    setLocale(value) {
      locale = value;
      panel.refresh();
    },
  };
}

test('controller panel browsing only previews, explicit use copies, and rename/delete leave applied values independent', async (t) => {
  const f = panelFixture(t);
  await f.store.saveTune(tune());
  f.panel.refresh();
  assert.equal(f.used.length, 0);
  assert.match(f.panel.root.textContent, /same aircraft configuration/);
  await f.click('Use in draft');
  assert.equal(f.used.length, 1);
  assert.deepEqual(f.used[0].controller, aircraft().controller);
  f.find('Rename selected controller tune').value = 'Precise copy';
  await f.click('Rename controller tune');
  assert.equal(f.store.snapshot().tunes[0].name, 'Precise copy');
  await f.click('Delete controller tune');
  assert.equal(f.store.snapshot().tunes.length, 1);
  assert.equal(f.action('Confirm tune deletion').hidden, false);
  await f.click('Keep controller tune');
  assert.equal(f.store.snapshot().tunes.length, 1);
  await f.click('Delete controller tune');
  await f.click('Confirm tune deletion');
  assert.equal(f.store.snapshot().tunes.length, 0);
  assert.deepEqual(f.used[0].controller, aircraft().controller);
  assert.equal(f.failures.length, 0);
});

test('controller panel saves a snapshot separately and disables incompatible families', async (t) => {
  const f = panelFixture(t);
  f.find('New controller tune name').value = 'My response';
  await f.click('Save draft as controller tune');
  assert.equal(f.store.snapshot().tunes[0].name, 'My response');
  assert.equal(f.used.length, 0);
  assert.deepEqual([...f.storage.data.keys()], [CONTROLLER_TUNE_LIBRARY_KEY]);
  const changed = aircraft();
  changed.aircraft.mass *= 1.1;
  f.setDraft(changed);
  assert.match(f.panel.root.textContent, /Response untested on this aircraft/);
  assert.equal(f.action('Use in draft').disabled, false);
  f.setDraft({
    aircraft: ADVANCED_AIRCRAFT_TEMPLATES.freestyle,
    controller: DEFAULT_ADVANCED_TUNE,
  });
  assert.equal(f.action('Use in draft').disabled, true);
  await f.click('Use in draft');
  assert.equal(f.used.length, 0);
});

test('controller import requires a fresh review and an explicit save and retains incompatible tunes as inactive', async (t) => {
  const f = panelFixture(t);
  const portable = {
    format: CONTROLLER_TUNE_FORMAT,
    ...tune('foreign', {
      aircraft: ADVANCED_AIRCRAFT_TEMPLATES.freestyle,
      controller: DEFAULT_ADVANCED_TUNE,
    }),
  };
  delete portable.id;
  const text = f.find('Controller tune JSON', 'textarea');
  text.value = JSON.stringify(portable);
  text.emit('input');
  await f.click('Save reviewed controller import');
  assert.equal(f.store.snapshot().tunes.length, 0);
  await f.click('Review controller import');
  assert.match(f.panel.root.textContent, /incompatible with this setup/);
  assert.equal(f.store.snapshot().tunes.length, 0);
  text.value += ' ';
  text.emit('input');
  assert.equal(f.action('Save reviewed controller import').disabled, true);
  await f.click('Review controller import');
  await f.click('Save reviewed controller import');
  assert.equal(f.store.snapshot().tunes.length, 1);
  assert.equal(f.used.length, 0);
  assert.equal(f.action('Use in draft').disabled, true);
  await f.click('Export selected controller tune');
  assert.equal(JSON.parse(text.value).format, CONTROLLER_TUNE_FORMAT);
  assert.equal(
    f.action('Review controller import').disabled,
    false,
    'Export must not leave actions disabled after invalidating import review',
  );
});

test('tune backup replacement uses its own review flow and keeps setup bytes unchanged', async (t) => {
  const f = panelFixture(t);
  f.storage.data.set(TUNING_LIBRARY_KEY, 'saved setups');
  await f.store.saveTune(tune());
  f.panel.refresh();
  await f.click('Export reusable tune backup');
  assert.equal(f.find('Controller import format', 'select').value, 'backup');
  const text = f.find('Controller tune JSON', 'textarea');
  text.value = JSON.stringify(initialControllerTuneLibrary());
  text.emit('input');
  await f.click('Review controller import');
  assert.match(f.panel.root.textContent, /Replace the reusable tune library with 0 tunes/);
  assert.equal(f.store.snapshot().tunes.length, 1);
  await f.click('Save reviewed controller import');
  assert.equal(f.store.snapshot().tunes.length, 0);
  assert.equal(f.storage.data.get(TUNING_LIBRARY_KEY), 'saved setups');
});

test('external library changes require reload without dropping draft name or pasted text', async (t) => {
  const f = panelFixture(t);
  f.find('New controller tune name').value = 'Unfinished name';
  const text = f.find('Controller tune JSON', 'textarea');
  text.value = 'Unfinished import';
  const other = createControllerTuneLibraryStore({ storage: f.storage });
  await other.saveTune(tune());
  f.window.emit('storage', { key: CONTROLLER_TUNE_LIBRARY_KEY });
  assert.equal(f.action('Save draft as controller tune').disabled, true);
  assert.match(f.panel.root.textContent, /Another tab changed/);
  await f.click('Reload controller tune library');
  assert.equal(f.store.snapshot().tunes.length, 1);
  assert.equal(f.find('New controller tune name').value, 'Unfinished name');
  assert.equal(text.value, 'Unfinished import');
  assert.equal(f.action('Save draft as controller tune').disabled, false);
});

test('late file reads cannot overwrite newer pasted input and disposed panels ignore results', async (t) => {
  const f = panelFixture(t);
  const file = f.find('Controller tune file'),
    text = f.find('Controller tune JSON', 'textarea');
  let finish;
  file.files = [
    {
      size: 10,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  file.emit('change');
  text.value = 'New pasted text';
  text.emit('input');
  finish('Old file');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(text.value, 'New pasted text');
  file.emit('change');
  f.panel.dispose();
  finish('After disposal');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(text.value, 'New pasted text');
  assert.equal(f.failures.length, 0);
});

test('controller library refresh switches language without resetting user text', async (t) => {
  const f = panelFixture(t);
  await f.store.saveTune(tune());
  f.panel.refresh();
  f.find('New controller tune name').value = 'Мій стиль';
  f.setLocale('uk');
  assert.equal(f.find('Назва нового налаштування контролера').value, 'Мій стиль');
  assert.ok(f.action('Використати в чернетці'));
  assert.match(f.panel.root.textContent, /Коефіцієнти контролера в одиницях SIM/);
});
