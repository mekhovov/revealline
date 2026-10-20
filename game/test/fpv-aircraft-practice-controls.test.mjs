import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAircraftRecoveryStore,
  aircraftRecoveryTick,
  mountAircraftPracticeControls,
  AIRCRAFT_RECOVERY_BYTES,
} from '../../optional-practice/civilian-fpv/aircraft-practice-controls.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const checkpoint = (tick, identity = 'flight-a') => ({
  format: 'AircraftCourseRecovery.v1',
  identity,
  physical: { checkpoint: { state: { missionTick: tick } } },
  mission: { state: { ticks: tick } },
});

test('challenge recovery storage keeps the paired accepted clock without changing older envelopes', async () => {
  const memory = managedIndexedDB(),
    store = createAircraftRecoveryStore({ indexedDB: memory.indexedDB });
  const source = {
    format: 'AircraftChallengeRecovery.v1',
    progress: { missionTick: 250 },
    session: checkpoint(250),
  };
  try {
    await store.save(source);
    assert.deepEqual((await store.load()).data, source);
    const mismatch = structuredClone(source);
    mismatch.progress.missionTick = 249;
    await assert.rejects(store.save(mismatch), /clocks do not match/);
    await assert.rejects(store.save({ ...source, session: source }), /Nested challenge/);
    assert.deepEqual((await store.load()).data, source);
    assert.equal(aircraftRecoveryTick(checkpoint(10)), 10);
  } finally {
    store.close();
  }
});

test('recovery storage commits one bounded slot per host and interrupted replacement preserves the last durable checkpoint', async () => {
  const memory = managedIndexedDB(),
    academy = createAircraftRecoveryStore({ indexedDB: memory.indexedDB, key: 'academy' }),
    world = createAircraftRecoveryStore({ indexedDB: memory.indexedDB, key: 'world' });
  try {
    assert.equal(await academy.load(), null);
    await academy.save(checkpoint(250));
    await world.save(checkpoint(500, 'world'));
    assert.equal((await academy.load()).missionTick, 250);
    assert.equal((await world.load()).missionTick, 500);
    memory.failAnyPutAt = 1;
    await assert.rejects(academy.save(checkpoint(750)), /storage write failure/);
    assert.equal((await academy.load()).missionTick, 250);
    memory.failAnyPutAt = null;
    memory.onAnyPut = ({ tx }) => tx.abort();
    await assert.rejects(academy.save(checkpoint(1000)), /transaction failed/);
    memory.onAnyPut = null;
    assert.equal((await academy.load()).missionTick, 250);
    await academy.save(checkpoint(1250));
    assert.equal((await academy.load()).missionTick, 1250);
    assert.ok(
      memory.allPuts.every(
        ([store, key]) => store === 'recovery' && ['academy', 'world'].includes(key),
      ),
    );
  } finally {
    academy.close();
    world.close();
  }
});

test('recovery validates captured mission/physics agreement before opening storage and closes cancelled transactions', async () => {
  const memory = managedIndexedDB(),
    store = createAircraftRecoveryStore({ indexedDB: memory.indexedDB });
  const invalid = checkpoint(250);
  invalid.mission.state.ticks = 249;
  await assert.rejects(store.save(invalid), /do not match/);
  assert.equal(memory.openCount, 0);
  const input = checkpoint(250),
    controller = new AbortController();
  await store.save(input);
  input.physical.checkpoint.state.missionTick = 999;
  assert.equal((await store.load()).missionTick, 250);
  memory.onAnyPut = () => controller.abort();
  await assert.rejects(store.save(checkpoint(500), { signal: controller.signal }), {
    name: 'AbortError',
  });
  memory.onAnyPut = null;
  assert.equal((await store.load()).missionTick, 250);
  store.close();
  await assert.rejects(store.load(), { name: 'AbortError' });
  assert.equal(
    aircraftRecoveryTick({ simulation: { checkpoint: { state: { missionTick: 42 } } } }),
    42,
  );
});

test('unavailable and blocked IndexedDB reject without losing or creating a false saved point', async () => {
  const missing = createAircraftRecoveryStore({ indexedDB: null });
  await assert.rejects(missing.save(checkpoint(250)), /unavailable/);
  let closed = 0,
    request;
  const blocked = createAircraftRecoveryStore({
    indexedDB: {
      open: () => {
        request = {};
        queueMicrotask(() => request.onblocked());
        return request;
      },
    },
  });
  await assert.rejects(blocked.load(), /blocked/);
  request.result = { close: () => closed++ };
  request.onsuccess();
  assert.equal(closed, 1);
  blocked.close();
  missing.close();
});

function fixture(t, { store, exportFile } = {}) {
  const document = new Document(),
    window = new Events();
  let currentLocale = 'en',
    pauses = 0,
    active,
    current = {
      ticks: 0,
      aircraftRadiusMm: 50,
      recordingStatus: {
        retainedFromSeconds: 0,
        retainedThroughSeconds: 0,
        lastRecoverableSeconds: null,
      },
    };
  const reports = [],
    restores = [],
    exports = [],
    writes = [];
  const memoryStore = store ?? {
    save: async (data) => {
      writes.push(data);
      return { missionTick: aircraftRecoveryTick(data) };
    },
    load: async () => ({ data: checkpoint(250), missionTick: 250 }),
    close() {},
  };
  active = {
    aircraft: () => ({}),
    exportRecovery: async () => checkpoint(current.ticks),
    recording: async () => ({ missionTicks: current.ticks, startMissionTick: 0 }),
    reportPersistence: async (update) => {
      reports.push(update);
    },
    restoreRecovery: async (data, { signal }) => {
      signal.throwIfAborted();
      assert.ok(pauses > 0);
      const packet = data.format === 'AircraftChallengeRecovery.v1' ? data.session : data;
      if (packet.identity !== 'flight-a' && packet.identity?.course !== 'flight-a')
        throw new Error('Recovery belongs to another flight');
      restores.push(data);
      current = { ...current, ticks: aircraftRecoveryTick(data) };
    },
    snapshot: () => current,
  };
  const ui = mountAircraftPracticeControls({
    parent: document.body,
    window,
    store: memoryStore,
    locale: () => currentLocale,
    getSession: () => active,
    onPause: () => {
      pauses++;
    },
    exportFile:
      exportFile ??
      (async (data, name) => {
        exports.push({ data, name });
        return { status: 'requested' };
      }),
  });
  t.after(() => ui.dispose());
  const update = (tick, extra = {}) => {
    current = { ...current, ticks: tick, ...extra };
    ui.update(current);
  };
  const click = async (name) => {
    const button = ui.root.querySelectorAll('button').find((b) => b.textContent === name);
    assert.ok(button, name);
    button.emit('click');
    await settle();
  };
  const file = ui.root.querySelector('input');
  update(0);
  return {
    ui,
    update,
    click,
    file,
    reports,
    restores,
    exports,
    writes,
    get active() {
      return active;
    },
    set active(value) {
      active = value;
    },
    get pauses() {
      return pauses;
    },
    locale(value) {
      currentLocale = value;
      ui.update(current);
    },
  };
}

test('live autosave keeps one pending write, records the captured tick, and never pauses flight', async (t) => {
  let resolveSave;
  const writes = [],
    f = fixture(t, {
      store: {
        save: (data) => {
          writes.push(data);
          return new Promise((resolve) => {
            resolveSave = resolve;
          });
        },
        close() {},
      },
    });
  f.active.exportRecovery = async () => checkpoint(253);
  f.update(249);
  await settle();
  assert.equal(writes.length, 0);
  f.update(250);
  await settle();
  f.update(500);
  f.update(750);
  assert.equal(writes.length, 1);
  assert.equal(f.pauses, 0);
  resolveSave({ missionTick: 253 });
  await settle();
  assert.deepEqual(f.reports[0], { savedThroughMission: 253 });
  assert.match(f.ui.root.textContent, /0:05\.06/);
  assert.equal(f.pauses, 0);
});

test('quota failure retains the last durable time and exact recent-clip range without pausing', async (t) => {
  let failed = false;
  const f = fixture(t, {
    store: {
      save: async (data) => {
        if (failed) throw new Error('quota');
        return { missionTick: aircraftRecoveryTick(data) };
      },
      close() {},
    },
  });
  f.update(250);
  await settle();
  failed = true;
  f.update(6000, { recordingStatus: { retainedFromSeconds: 60, retainedThroughSeconds: 120 } });
  await settle();
  assert.match(f.ui.root.textContent, /1:00\.00–2:00\.00/);
  assert.match(f.ui.root.textContent, /Last durable checkpoint: 0:05\.00/);
  assert.match(f.ui.root.textContent, /Storage unavailable; flying continues/);
  assert.deepEqual(f.reports.at(-1), { error: 'quota' });
  assert.equal(f.pauses, 0);
});

test('changing sessions aborts the old capture before it can overwrite a checkpoint', async (t) => {
  const f = fixture(t);
  let resolveCapture;
  f.active.exportRecovery = () =>
    new Promise((resolve) => {
      resolveCapture = resolve;
    });
  f.update(250);
  f.active = { ...f.active, exportRecovery: async () => checkpoint(0, 'flight-b') };
  f.update(0);
  resolveCapture(checkpoint(250));
  await settle();
  assert.equal(f.writes.length, 0);
  assert.equal(f.reports.length, 0);
});

test('export actions preserve live flight and restoring the saved point pauses before application', async (t) => {
  const f = fixture(t);
  await f.click('Export recent clip');
  await f.click('Export recovery checkpoint');
  assert.deepEqual(
    f.exports.map((r) => r.name),
    ['aircraft-practice-clip.json', 'aircraft-practice-recovery.json'],
  );
  assert.equal(f.pauses, 0);
  await f.click('Restore last saved checkpoint');
  assert.equal(f.pauses, 1);
  assert.equal(f.restores.length, 1);
  assert.match(f.ui.root.textContent, /flight remains paused/);
  assert.deepEqual(f.reports.at(-1), { savedThroughMission: 250 });
});

test('cancelled and oversized recovery imports never apply, and configuration mismatch stays rejected', async (t) => {
  const f = fixture(t);
  let resolveRead;
  f.file.files = [
    {
      size: 100,
      text: () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    },
  ];
  f.file.emit('change');
  await settle();
  await f.click('Cancel recovery');
  assert.equal(f.file.disabled, false);
  resolveRead(JSON.stringify(checkpoint(250)));
  await settle();
  assert.equal(f.restores.length, 0);
  assert.equal(f.pauses, 0);
  f.file.files = [
    {
      size: AIRCRAFT_RECOVERY_BYTES + 1,
      text: () => {
        throw new Error('must not read');
      },
    },
  ];
  f.file.emit('change');
  await settle();
  assert.match(f.ui.root.textContent, /44 MiB/);
  f.file.files = [
    { size: 200, text: async () => JSON.stringify(checkpoint(250, 'another-flight')) },
  ];
  f.file.emit('change');
  await settle();
  assert.equal(f.restores.length, 0);
  assert.match(f.ui.root.textContent, /belongs to another flight/);
});

test('controls remain hidden for legacy flights and translate status for Ukrainian practice', (t) => {
  const f = fixture(t);
  f.locale('uk');
  assert.match(f.ui.root.textContent, /Записи практики й відновлення/);
  assert.match(f.ui.root.textContent, /Остання надійно збережена точка/);
  f.active = {};
  f.update(1000, { aircraftRadiusMm: undefined });
  assert.equal(f.ui.root.hidden, true);
});

const actorCheckpoint = (tick, live = false) =>
  checkpoint(tick, {
    model: 'aircraft-course-practice.v2',
    course: 'flight-a',
    ...(live ? { actorRules: 'destructible-subjects.v1' } : {}),
  });

test('preserved Advanced originals survive autosaves and duplicate preservation without duplicate slots', async () => {
  const memory = managedIndexedDB(),
    store = createAircraftRecoveryStore({ indexedDB: memory.indexedDB, key: 'world' }),
    original = actorCheckpoint(250),
    next = actorCheckpoint(500, true);
  try {
    await store.save(original);
    await store.preserveOriginal(original);
    await store.save(next);
    await store.preserveOriginal(structuredClone(original));
    assert.deepEqual((await store.load()).data, next);
    assert.deepEqual((await store.load({ original: true })).data, original);
    const keys = new Set(
      memory.allPuts.map(([, key]) => key).filter((key) => key.startsWith('world:original:')),
    );
    assert.equal(keys.size, 1);
    original.mission.state.ticks = 999;
    assert.equal((await store.load({ original: true })).data.mission.state.ticks, 250);
  } finally {
    store.close();
  }
});

test('failed original pointer write keeps the earlier complete original and current recovery', async () => {
  const memory = managedIndexedDB(),
    store = createAircraftRecoveryStore({ indexedDB: memory.indexedDB }),
    original = actorCheckpoint(250),
    replacement = actorCheckpoint(750);
  try {
    await store.save(actorCheckpoint(500, true));
    await store.preserveOriginal(original);
    memory.failAnyPutAt = 2;
    await assert.rejects(() => store.preserveOriginal(replacement), /storage write failure/);
    memory.failAnyPutAt = null;
    assert.deepEqual((await store.load({ original: true })).data, original);
    assert.equal((await store.load()).missionTick, 500);
  } finally {
    store.close();
  }
});

test('restoring real native and Challenge envelope shapes preserves before migration and exports exact original', async (t) => {
  for (const wrapped of [false, true]) {
    const memory = managedIndexedDB(),
      store = createAircraftRecoveryStore({ indexedDB: memory.indexedDB }),
      base = actorCheckpoint(250),
      original = wrapped
        ? { format: 'AircraftChallengeRecovery.v1', progress: { missionTick: 250 }, session: base }
        : base;
    await store.save(original);
    const f = fixture(t, { store });
    let migrated = 0;
    f.active.migrateActorRules = async () => {
      assert.deepEqual((await store.load({ original: true })).data, original);
      migrated++;
    };
    await f.click('Restore last saved checkpoint');
    assert.equal(migrated, 1);
    assert.deepEqual(f.restores[0], original);
    f.active.exportRecovery = async () => actorCheckpoint(f.active.snapshot().ticks, true);
    f.update(500);
    await settle();
    await settle();
    assert.equal((await store.load()).missionTick, 500);
    assert.deepEqual((await store.load({ original: true })).data, original);
    await f.click('Export preserved original checkpoint');
    assert.deepEqual(f.exports.at(-1), {
      data: original,
      name: 'aircraft-original-checkpoint.json',
    });
  }
});

test('original storage failure prevents migration while leaving verified recovery paused', async (t) => {
  const original = actorCheckpoint(250),
    f = fixture(t, {
      store: {
        load: async () => ({ data: original, missionTick: 250 }),
        preserveOriginal: async () => {
          throw new Error('backup quota');
        },
        close() {},
      },
    });
  let migrated = 0;
  f.active.migrateActorRules = async () => {
    migrated++;
  };
  await f.click('Restore last saved checkpoint');
  assert.equal(f.restores.length, 1);
  assert.equal(f.pauses, 1);
  assert.equal(migrated, 0);
  assert.match(f.ui.root.textContent, /backup quota/);
});

test('cancel after original backup starts cannot migrate the restored flight', async (t) => {
  let finish;
  const original = actorCheckpoint(250),
    f = fixture(t, {
      store: {
        load: async () => ({ data: original, missionTick: 250 }),
        preserveOriginal: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        close() {},
      },
    });
  let migrated = 0;
  f.active.migrateActorRules = async () => {
    migrated++;
  };
  await f.click('Restore last saved checkpoint');
  await f.click('Cancel recovery');
  finish();
  await settle();
  assert.equal(migrated, 0);
  assert.match(f.ui.root.textContent, /cancelled/);
});

test('new actor-rule checkpoints do not replace preserved originals and unsupported legacy missions skip migration', async (t) => {
  const f = fixture(t, {
    store: {
      load: async () => ({ data: actorCheckpoint(250, true), missionTick: 250 }),
      preserveOriginal: async () => {
        throw new Error('must not rewrite original');
      },
      close() {},
    },
  });
  let migrated = 0;
  f.active.migrateActorRules = async () => {
    migrated++;
  };
  await f.click('Restore last saved checkpoint');
  assert.equal(migrated, 1);
  f.active.supportsLiveActorRules = () => false;
  await f.click('Restore last saved checkpoint');
  assert.equal(migrated, 1);
  assert.match(f.ui.root.textContent, /flight remains paused/);
});
