import { initWorldRuntime } from '../../optional-practice/civilian-fpv/world-model.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  createEncounterDefinition,
  createNativeEncounterGeometry,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import {
  createEncounterSession,
  createEncounterArchive,
  createEncounterArchiveStore,
  inspectEncounterArchive,
  createEncounterPlayback,
  replayEncounterSession,
} from '../../optional-practice/civilian-fpv/encounter-session.mjs';
await initWorldRuntime();
async function factory({ definition, runId } = {}) {
  const course = FLIGHT_COURSES[0];
  if (!definition) {
    const geometry = createNativeEncounterGeometry(course);
    definition = createEncounterDefinition({
      course,
      version: 2,
      activity: 'continuous',
      population: 6,
      playerDamage: 'invulnerable',
      admitActor: geometry.admitActor,
      admitServicePad: geometry.admitServicePad,
    });
    geometry.dispose();
    definition.actors = definition.actors
      .slice(0, 1)
      .map((a) => ({ ...a, path: [], speed: 0, fireEveryTicks: 0 }));
  }
  let state = {
    position: structuredClone(course.spawn),
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'paused',
  };
  return createEncounterSession(
    {
      identity: { id: 'archive-physical' },
      snapshot: () => structuredClone(state),
      configureEncounterActors() {},
      stageEncounterActors() {},
      arm() {
        state.status = 'active';
      },
      pause() {
        state.status = 'paused';
      },
      step() {
        state.ticks++;
      },
      encounterCheckpoint: () => structuredClone(state),
      restoreEncounterCheckpoint(value) {
        state = structuredClone(value);
      },
      dispose() {},
    },
    { definition, runId, geometry: { visible: () => false, sweepStatic: () => null } },
  );
}
function advance(session, ticks) {
  session.arm();
  for (let i = 0; i < ticks; i++) session.step({ actions: 0 });
}
test('combat archive export remains live, finishes atomically and replays the accepted command chain', async () => {
  const memory = managedIndexedDB(),
    store = createEncounterArchiveStore({ indexedDB: memory.indexedDB }),
    session = await factory();
  const archive = createEncounterArchive({
    session,
    store,
    id: 'combat-live',
    launch: () => ({ format: 'FPVCombatLaunch.v1', configuration: { camera: {} }, mode: 'acro' }),
  });
  try {
    advance(session, 3007);
    await archive.capture();
    const first = await archive.export();
    assert.equal(archive.snapshot().state, 'recording');
    assert.equal(inspectEncounterArchive(first).summary.to, 3007);
    assert.equal(inspectEncounterArchive(first).recovery.launch.mode, 'acro');
    advance(session, 3000);
    await archive.capture();
    const final = await archive.finish();
    assert.equal(archive.snapshot().state, 'ended');
    assert.equal(inspectEncounterArchive(final).summary.to, 6007);
    assert.equal(
      inspectEncounterArchive(await store.exportPackage('combat-live')).summary.to,
      6007,
    );
    assert.equal(
      inspectEncounterArchive(first).summary.to,
      3007,
      'old export retains its original final boundary',
    );
    const proof = await replayEncounterSession(final, {
      createSession: factory,
      yieldControl: () => {},
    });
    assert.equal(proof.verified, true);
    assert.equal(proof.sessionTicks, 6007);
    assert.equal(proof.practiceOnly, true);
    const imported = createEncounterArchiveStore({ indexedDB: managedIndexedDB().indexedDB });
    await imported.importPackage(final, { id: 'combat-import' });
    assert.equal(
      inspectEncounterArchive(await imported.exportPackage('combat-import')).summary.to,
      6007,
    );
    imported.close();
  } finally {
    await archive.dispose();
    await session.dispose();
    store.close();
  }
});
test('combat archives preserve complete playback after the bounded live recording has rolled', async () => {
  const session = await factory(),
    memory = managedIndexedDB(),
    archive = createEncounterArchive({ session, indexedDB: memory.indexedDB, id: 'combat-long' });
  try {
    for (let minute = 0; minute < 13; minute++) {
      advance(session, 3000);
      await archive.capture();
    }
    advance(session, 17);
    const packet = await archive.export(),
      inspected = inspectEncounterArchive(packet);
    assert.equal(inspected.recovery.gameplay.recording.retainedFrom, 3000);
    assert.equal(inspected.recovery.gameplay.recording.segments.length, 12);
    assert.equal(packet.segments.length, 14);
    await assert.rejects(
      createEncounterPlayback(inspected.recovery, { createSession: factory }),
      /beginning/,
    );
    const proof = await replayEncounterSession(packet, {
      createSession: factory,
      yieldControl: () => {},
    });
    assert.equal(proof.sessionTicks, 39017);
    assert.equal(proof.verified, true);
    const resumed = await factory({
      definition: inspected.definition,
      runId: inspected.recovery.gameplay.encounter.state.runId,
    });
    let continued;
    try {
      assert.throws(
        () =>
          createEncounterArchive({
            session: resumed,
            indexedDB: managedIndexedDB().indexedDB,
            resumeFrom: packet,
          }),
        /restored boundary/,
      );
      await resumed.restoreCombatRecovery(inspected.recovery);
      const originalPacket = JSON.stringify(packet);
      continued = createEncounterArchive({
        session: resumed,
        indexedDB: managedIndexedDB().indexedDB,
        id: 'combat-continued',
        resumeFrom: packet,
      });
      await continued.capture();
      assert.equal(continued.snapshot().state, 'recording');
      assert.equal(continued.snapshot().durableTo, 39000);
      advance(resumed, 3000);
      await continued.capture();
      const expanded = await continued.finish();
      assert.equal(inspectEncounterArchive(expanded).summary.to, 42017);
      assert.equal(expanded.segments.filter((row) => row.record.kind === 'final').length, 1);
      assert.equal(JSON.stringify(packet), originalPacket);
      const resumedProof = await replayEncounterSession(expanded, {
        createSession: factory,
        yieldControl: () => {},
      });
      assert.equal(resumedProof.verified, true);
      assert.equal(resumedProof.sessionTicks, 42017);
    } finally {
      await continued?.dispose();
      await resumed.dispose();
    }
    const forged = structuredClone(packet);
    forged.segments[0].record.segment.frames[1][0] = 999;
    assert.throws(() => inspectEncounterArchive(forged), /segment/);
    const missing = structuredClone(packet);
    missing.segments.splice(3, 1);
    assert.throws(() => inspectEncounterArchive(missing), /count/);
  } finally {
    await archive.dispose();
    await session.dispose();
  }
});
test('combat archive stops with an explicit gap after restore and never claims the replacement chain', async () => {
  const session = await factory(),
    archive = createEncounterArchive({
      session,
      indexedDB: managedIndexedDB().indexedDB,
      id: 'combat-gap',
    });
  try {
    advance(session, 3001);
    await archive.capture();
    const saved = await session.exportCombatRecovery();
    await session.restoreCombatRecovery(saved);
    await archive.capture();
    assert.equal(archive.snapshot().state, 'gap');
    assert.equal(archive.snapshot().durableTo, 3000);
    await assert.rejects(archive.export(), /unavailable/);
    session.arm();
    session.step({ actions: 0 });
    assert.equal(session.snapshot().ticks, 3002);
  } finally {
    await archive.dispose();
    await session.dispose();
  }
});
test('combat archive quota failure preserves the durable prefix and leaves flight available', async () => {
  const session = await factory(),
    real = createEncounterArchiveStore({ indexedDB: managedIndexedDB().indexedDB });
  const store = {
    ...real,
    append: async () => {
      throw new DOMException('Archive quota reached', 'QuotaExceededError');
    },
  };
  const archive = createEncounterArchive({ session, store, id: 'combat-quota' });
  try {
    advance(session, 3000);
    await archive.capture();
    assert.equal(archive.snapshot().state, 'capacity');
    assert.equal(archive.snapshot().durableTo, 0);
    assert.match(archive.snapshot().error, /quota/);
    await assert.rejects(archive.export(), /unavailable/);
    assert.equal(archive.snapshot().state, 'capacity');
    assert.match(archive.snapshot().error, /quota/);
    advance(session, 1);
    assert.equal(session.snapshot().ticks, 3001);
    const rows = await real.list();
    assert.equal(rows[0].state, 'capacity');
    assert.equal(rows[0].segmentCount, 0);
  } finally {
    await archive.dispose();
    await session.dispose();
    real.close();
  }
});
test('combat archive command tampering is rejected even with recomputed transport checksums', async () => {
  const session = await factory(),
    archive = createEncounterArchive({
      session,
      indexedDB: managedIndexedDB().indexedDB,
      id: 'combat-command',
    });
  try {
    advance(session, 1);
    session.queueCombatCommand({ switchWeapon: 1 });
    advance(session, 3000);
    const packet = await archive.export(),
      forged = structuredClone(packet);
    const first = forged.segments[0];
    first.record.segment.frames[1][4] = 0;
    first.record.segment.frames[1][5] = 0;
    const { hash, ...body } = first.record.segment;
    first.record.segment.hash = dataIdentity(body);
    const { finalHash, ...wrapper } = first;
    first.finalHash = dataIdentity(wrapper);
    assert.throws(() => inspectEncounterArchive(forged), /segment|chain|differs/);
  } finally {
    await archive.dispose();
    await session.dispose();
  }
});

test('archive finish and disposal wait for an in-flight export and persist only one final boundary', async () => {
  const session = await factory(),
    memory = managedIndexedDB();
  advance(session, 3);
  let release,
    calls = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const source = {
    ...session,
    async exportCombatRecovery() {
      if (++calls === 1) await gate;
      return session.exportCombatRecovery();
    },
  };
  const archive = createEncounterArchive({
    session: source,
    indexedDB: memory.indexedDB,
    id: 'combat-race',
  });
  const exported = archive.export(),
    finished = archive.finish();
  assert.equal(archive.finish(), finished, 'concurrent finish callers share one bounded operation');
  const disposed = archive.dispose();
  release();
  const [first, last] = await Promise.all([exported, finished]);
  await disposed;
  assert.equal(inspectEncounterArchive(first).summary.to, 3);
  assert.equal(inspectEncounterArchive(last).summary.to, 3);
  assert.equal(archive.snapshot().state, 'ended');
  const store = createEncounterArchiveStore({ indexedDB: memory.indexedDB });
  const stored = await store.exportPackage('combat-race');
  assert.equal(stored.segments.filter((item) => item.record.kind === 'final').length, 1);
  await assert.rejects(archive.export(), /unavailable/);
  store.close();
  await session.dispose();
});
