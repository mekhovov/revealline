import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRCRAFT_ARCHIVE_PACKAGE_FORMAT,
  AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
  AIRCRAFT_ARCHIVE_PAYLOAD_BYTES,
  AIRCRAFT_ARCHIVE_OVERHEAD_BYTES,
  AIRCRAFT_ARCHIVE_MAX_SESSIONS,
  AIRCRAFT_ARCHIVE_MAX_SEGMENTS,
  createAircraftArchiveStore,
  validateAircraftArchiveManifest,
  validateAircraftArchivePackage,
  aircraftArchiveSegmentDigest,
} from '../../optional-practice/civilian-fpv/aircraft-archive.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const identity = '0123456789abcdef';
const config = { backend: 'civilian-quad-aircraft.v1', frequency: 500 };
const spec = (id = 'flight-1', overrides = {}) => ({
  id,
  host: 'academy',
  identity,
  config,
  origin: { kind: 'fresh', startTick: 0 },
  name: 'Meteor75 practice',
  createdAt: 1234,
  ...overrides,
});
const hash = (tick) => tick.toString(16).padStart(8, '0');
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function segment(
  index,
  previous = null,
  { startTick = index * 50, endTick = startTick + 50 } = {},
) {
  return {
    format: 'AdvancedAircraftSegment.v1',
    index,
    previous: previous ? aircraftArchiveSegmentDigest(previous) : null,
    startTick,
    endTick,
    checkpoint: { identity, state: { missionTick: startTick } },
    initialHash: hash(startTick),
    events: [],
    hashes: Array.from(
      { length: Math.floor(endTick / 50) - Math.floor(startTick / 50) },
      (_, i) => [
        (Math.floor(startTick / 50) + i + 1) * 50,
        hash((Math.floor(startTick / 50) + i + 1) * 50),
      ],
    ),
    finalHash: hash(endTick),
  };
}
function fixture(t) {
  const memory = managedIndexedDB(),
    store = createAircraftArchiveStore({ indexedDB: memory.indexedDB });
  t.after(() => store.close());
  return { memory, store };
}
async function populate(store, id = 'flight-1', count = 2) {
  let manifest = await store.begin(spec(id)),
    previous = null;
  for (let i = 0; i < count; i++) {
    previous = segment(i, previous);
    manifest = await store.append(id, previous, { expectedRevision: manifest.revision });
  }
  return manifest;
}

test('archive persists immutable segments and an exact durable manifest; exports preserve existing identities', async (t) => {
  const { memory, store } = fixture(t);
  let manifest = await populate(store);
  const before = await store.load(manifest.id);
  assert.equal(manifest.segmentCount, 2);
  assert.equal(manifest.endTick, 100);
  assert.equal(
    manifest.payloadBytes,
    bytes(config) + before.segments.reduce((sum, row) => sum + bytes(row), 0),
  );
  assert.equal(manifest.scored, false);
  manifest = await store.finish(
    manifest.id,
    { reason: 'ended', endTick: 100, finalHash: hash(100) },
    { expectedRevision: manifest.revision },
  );
  const packet = await store.exportPackage(manifest.id);
  assert.equal(packet.format, AIRCRAFT_ARCHIVE_PACKAGE_FORMAT);
  assert.equal(packet.manifest.state, 'ended');
  assert.deepEqual(packet.segments, before.segments);
  assert.deepEqual(validateAircraftArchivePackage(JSON.stringify(packet)), packet);
  const imported = await store.importPackage(packet, {
    id: '7fbf852f-75b9-4ca2-887e-dea225dc4182',
  });
  assert.equal(imported.revision, 0);
  assert.equal(imported.identity, identity);
  assert.deepEqual((await store.load(imported.id)).segments, before.segments);
  assert.equal((await store.list()).length, 2);
  const budget = memory.contents().get('budget').get('local');
  assert.equal(budget.bytes, 2 * (manifest.payloadBytes + AIRCRAFT_ARCHIVE_OVERHEAD_BYTES));
  assert.equal(budget.archives, 2);
});

test('partial writes and cancellation never advance a manifest or leak a segment/quota allocation', async (t) => {
  const { memory, store } = fixture(t);
  const manifest = await populate(store, 'flight-1', 1);
  const first = (await store.load(manifest.id)).segments[0],
    next = segment(1, first);
  for (const write of [1, 2, 3]) {
    const before = memory.contents();
    memory.failAnyPutAt = write;
    await assert.rejects(
      store.append(manifest.id, next, { expectedRevision: manifest.revision }),
      /storage write failure/,
    );
    memory.failAnyPutAt = null;
    assert.deepEqual(memory.contents(), before);
  }
  const controller = new AbortController(),
    before = memory.contents();
  memory.onAnyPut = ({ name }) => {
    if (name === 'archives') controller.abort();
  };
  await assert.rejects(
    store.append(manifest.id, next, {
      expectedRevision: manifest.revision,
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  memory.onAnyPut = null;
  assert.deepEqual(memory.contents(), before);
  const appended = await store.append(manifest.id, next, { expectedRevision: manifest.revision });
  assert.equal(appended.endTick, 100);
});

test('concurrent tabs reject stale edits while exact append and finish retries remain idempotent', async (t) => {
  const { memory, store } = fixture(t),
    other = createAircraftArchiveStore({ indexedDB: memory.indexedDB });
  t.after(() => other.close());
  const manifest = await store.begin(spec()),
    first = segment(0);
  const results = await Promise.allSettled([
    store.append(manifest.id, first, { expectedRevision: 0 }),
    other.append(manifest.id, first, { expectedRevision: 0 }),
  ]);
  assert.ok(results.every((row) => row.status === 'fulfilled'));
  assert.deepEqual(results[0].value, results[1].value);
  const updated = results[0].value;
  await assert.rejects(
    other.append(manifest.id, segment(1, first), { expectedRevision: 0 }),
    /changed in another tab/,
  );
  await assert.rejects(
    other.delete(manifest.id, { expectedRevision: 0 }),
    /changed in another tab/,
  );
  const ending = { reason: 'ended', endTick: updated.endTick, finalHash: updated.finalHash };
  const finished = await store.finish(manifest.id, ending, { expectedRevision: updated.revision });
  assert.deepEqual(
    await other.finish(manifest.id, ending, { expectedRevision: updated.revision }),
    finished,
  );
  await assert.rejects(
    store.append(manifest.id, segment(1, first), { expectedRevision: finished.revision }),
    /already closed/,
  );
  assert.equal(memory.contents().get('segments').size, 1);
});

test('missing, reordered, modified, wrong-aircraft and fabricated durable ranges fail atomically', async (t) => {
  const { store } = fixture(t),
    manifest = await populate(store);
  const original = await store.exportPackage(manifest.id);
  for (const mutate of [
    (packet) => packet.segments.splice(0, 1),
    (packet) => packet.segments.reverse(),
    (packet) => {
      packet.segments[1].previous = '0000000000000000';
    },
    (packet) => {
      packet.segments[1].initialHash = '00000000';
    },
    (packet) => {
      packet.segments[0].checkpoint.identity = 'fedcba9876543210';
    },
    (packet) => {
      packet.manifest.endTick++;
    },
    (packet) => {
      packet.manifest.payloadBytes++;
    },
    (packet) => {
      packet.manifest.scored = true;
    },
    (packet) => {
      packet.manifest.verified = true;
    },
  ]) {
    const damaged = structuredClone(original);
    mutate(damaged);
    assert.throws(() => validateAircraftArchivePackage(damaged));
    await assert.rejects(store.importPackage(damaged, { id: 'invalid-import' }));
    assert.equal((await store.list()).length, 1);
  }
  const final = original.segments.at(-1);
  await assert.rejects(
    store.append(manifest.id, segment(3, final), { expectedRevision: manifest.revision }),
    /Missing, reordered/,
  );
  await assert.rejects(
    store.append(
      manifest.id,
      { ...final, events: [['changed']] },
      { expectedRevision: manifest.revision },
    ),
    /different data/,
  );
  await assert.rejects(
    store.finish(
      manifest.id,
      { reason: 'ended', endTick: 999, finalHash: final.finalHash },
      { expectedRevision: manifest.revision },
    ),
    /last durable/,
  );
  assert.deepEqual(await store.exportPackage(manifest.id), original);
});

test('checkpoint-origin archives retain source indices and never imply a takeoff origin or verified score', async (t) => {
  const { store } = fixture(t);
  let manifest = await store.begin(
    spec('recovered', { origin: { kind: 'checkpoint', startTick: 500 } }),
  );
  const part = segment(10, null, { startTick: 500, endTick: 550 });
  part.previous = 'abcdef0123456789';
  manifest = await store.append(manifest.id, part, { expectedRevision: manifest.revision });
  manifest = await store.finish(
    manifest.id,
    { reason: 'ended', endTick: 550, finalHash: hash(550) },
    { expectedRevision: manifest.revision },
  );
  const packet = await store.exportPackage(manifest.id);
  assert.deepEqual(packet.manifest.origin, { kind: 'checkpoint', startTick: 500 });
  assert.equal(packet.manifest.firstIndex, 10);
  assert.equal(packet.manifest.scored, false);
  assert.equal(Object.hasOwn(packet.manifest, 'verified'), false);
  await assert.rejects(
    store.begin(spec('bad-origin', { origin: { kind: 'fresh', startTick: 500 } })),
    /origin/,
  );
});

test('archive count limit requires explicit deletion, frees all records atomically, and preserves recent recovery stores', async (t) => {
  const { memory, store } = fixture(t);
  const first = await populate(store);
  for (let i = 1; i < AIRCRAFT_ARCHIVE_MAX_SESSIONS; i++)
    await store.begin(spec(`flight-${i + 1}`));
  await assert.rejects(store.begin(spec('one-too-many')), /storage is full/);
  assert.equal((await store.list()).length, AIRCRAFT_ARCHIVE_MAX_SESSIONS);
  const before = memory.contents();
  memory.failAnyPutAt = 1;
  await assert.rejects(
    store.delete(first.id, { expectedRevision: first.revision }),
    /storage write failure/,
  );
  memory.failAnyPutAt = null;
  assert.deepEqual(memory.contents(), before);
  assert.deepEqual(await store.delete(first.id, { expectedRevision: first.revision }), {
    deleted: true,
    id: first.id,
  });
  assert.equal(memory.contents().get('segments').size, 0);
  await store.begin(spec('replacement'));
  assert.equal((await store.list()).length, AIRCRAFT_ARCHIVE_MAX_SESSIONS);
  assert.ok(memory.allPuts.every(([name]) => ['archives', 'segments', 'budget'].includes(name)));
});

test('per-session segment count is bounded without accepting a growing manifest', async (t) => {
  const { store } = fixture(t);
  const manifest = await populate(store, 'many', AIRCRAFT_ARCHIVE_MAX_SEGMENTS);
  const saved = await store.load('many');
  const next = segment(AIRCRAFT_ARCHIVE_MAX_SEGMENTS, saved.segments.at(-1));
  await assert.rejects(
    store.append('many', next, { expectedRevision: manifest.revision }),
    /capacity reached/,
  );
  assert.equal((await store.load('many')).manifest.segmentCount, AIRCRAFT_ARCHIVE_MAX_SEGMENTS);
});

test('byte budgets reject oversized packages and manifests before opening storage', async (t) => {
  const { memory, store } = fixture(t);
  await assert.rejects(
    store.importPackage(' '.repeat(AIRCRAFT_ARCHIVE_PACKAGE_BYTES + 1), { id: 'too-large' }),
  );
  assert.equal(memory.openCount, 0);
  const manifest = await store.begin(spec());
  assert.throws(() =>
    validateAircraftArchiveManifest({
      ...manifest,
      payloadBytes: AIRCRAFT_ARCHIVE_PAYLOAD_BYTES + 1,
    }),
  );
  await assert.rejects(
    store.begin(spec('oversized-config', { config: { source: 'x'.repeat(513 * 1024) } })),
  );
  assert.equal((await store.list()).length, 1);
});

test('actual encoded payload bytes enforce both archive and shared device quotas without deleting saved flights', async (t) => {
  const { store, memory } = fixture(t);
  const initial = await store.begin(spec('large-0'));
  const first = segment(0);
  // Structural import data is deliberately not a verified physics claim. Large
  // inert strings exercise the same byte counter as recorded terrain payloads.
  first.events = [['padding', 'x'.repeat(10 * 1024 * 1024), 'y'.repeat(10 * 1024 * 1024)]];
  const manifest = await store.append(initial.id, first, { expectedRevision: 0 });
  const second = segment(1, first);
  second.events = first.events;
  await assert.rejects(
    store.append(initial.id, second, { expectedRevision: manifest.revision }),
    /capacity reached/,
  );
  const packet = await store.exportPackage(initial.id);
  for (let index = 1; index < 6; index++)
    await store.importPackage(packet, { id: `large-${index}` });
  const before = memory.contents().get('budget').get('local');
  await assert.rejects(store.importPackage(packet, { id: 'over-local-quota' }), /storage is full/);
  assert.equal((await store.list()).length, 6);
  assert.deepEqual(memory.contents().get('budget').get('local'), before);
  assert.equal(memory.contents().get('segments').size, 6);
});

test('open imports become interrupted, failed multi-segment import rolls back, and empty sessions cannot claim completion', async (t) => {
  const { memory, store } = fixture(t);
  const empty = await store.begin(spec('empty'));
  await assert.rejects(
    store.finish(
      empty.id,
      { reason: 'ended', endTick: 0, finalHash: null },
      { expectedRevision: 0 },
    ),
    /empty aircraft archive/,
  );
  await assert.rejects(store.exportPackage(empty.id), /empty or missing/);
  await store.finish(
    empty.id,
    { reason: 'interrupted', endTick: 0, finalHash: null },
    { expectedRevision: 0 },
  );
  await populate(store, 'source', 3);
  const packet = await store.exportPackage('source');
  const before = memory.contents();
  memory.failAnyPutAt = 4;
  await assert.rejects(
    store.importPackage(packet, { id: 'failed-import' }),
    /storage write failure/,
  );
  memory.failAnyPutAt = null;
  assert.deepEqual(memory.contents(), before);
  const imported = await store.importPackage(packet, { id: 'saved-import' });
  assert.equal(imported.state, 'interrupted');
  assert.deepEqual(imported.origin, packet.manifest.origin);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(store.list({ signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(store.load(imported.id, { signal: controller.signal }), {
    name: 'AbortError',
  });
  await assert.rejects(store.begin(spec('cancelled'), { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('unavailable, blocked and closed storage do not report a false archive commit', async () => {
  const missing = createAircraftArchiveStore({ indexedDB: null });
  await assert.rejects(missing.begin(spec()), /unavailable/);
  let closed = 0,
    request;
  const blocked = createAircraftArchiveStore({
    indexedDB: {
      open() {
        request = {};
        queueMicrotask(() => request.onblocked());
        return request;
      },
    },
  });
  await assert.rejects(blocked.list(), /blocked/);
  request.result = { close: () => closed++ };
  request.onsuccess();
  assert.equal(closed, 1);
  blocked.close();
  await assert.rejects(blocked.list(), { name: 'AbortError' });
  missing.close();
});

function closingFixture(t) {
  const memory = managedIndexedDB(),
    connections = [],
    store = createAircraftArchiveStore({
      indexedDB: {
        open(...args) {
          const request = memory.indexedDB.open(...args);
          return new Proxy(request, {
            set(target, name, value) {
              target[name] =
                name === 'onsuccess'
                  ? (...event) => {
                      connections.push(target.result);
                      value(...event);
                    }
                  : value;
              return true;
            },
          });
        },
      },
    });
  t.after(() => store.close());
  return {
    memory,
    connections,
    store,
    forceClose() {
      const connection = connections.at(-1);
      connection.close();
      // A browser-forced close emits this event; ordinary explicit close does not.
      connection.onclose?.({ target: connection });
      return connection;
    },
  };
}

test('unexpected archive database close permits a later operation to reopen without replaying writes', async (t) => {
  const { memory, connections, store, forceClose } = closingFixture(t);
  const manifest = await store.begin(spec()),
    committedWrites = memory.allPuts.length,
    oldConnection = forceClose();
  assert.deepEqual(await store.list(), [manifest]);
  assert.equal(memory.openCount, 2);
  assert.equal(memory.allPuts.length, committedWrites);
  const appended = await store.append(manifest.id, segment(0), { expectedRevision: 0 });
  assert.equal(appended.segmentCount, 1);
  oldConnection.onclose?.({ target: oldConnection });
  assert.equal((await store.load(manifest.id)).manifest.segmentCount, 1);
  assert.equal(
    memory.openCount,
    2,
    'a late old-connection event cannot invalidate its replacement',
  );
  store.close();
  connections.at(-1).onclose?.({ target: connections.at(-1) });
  await assert.rejects(store.list(), { name: 'AbortError' });
  assert.equal(memory.openCount, 2, 'explicit disposal remains permanently closed');
});

test('unexpected archive close during a failed write preserves its durable prefix and requires an explicit retry', async (t) => {
  const { memory, store, forceClose } = closingFixture(t);
  const manifest = await populate(store, 'flight-1', 1),
    before = memory.contents(),
    first = (await store.load(manifest.id)).segments[0],
    next = segment(1, first);
  memory.onAnyPut = ({ name, tx }) => {
    if (name !== 'segments') return;
    forceClose();
    tx.abort();
  };
  await assert.rejects(
    store.append(manifest.id, next, { expectedRevision: manifest.revision }),
    /transaction failed/,
  );
  memory.onAnyPut = null;
  assert.equal(memory.openCount, 1, 'the failed write does not reopen or retry itself');
  assert.deepEqual(memory.contents(), before);
  assert.equal((await store.load(manifest.id)).manifest.revision, manifest.revision);
  assert.equal(memory.openCount, 2);
  const appended = await store.append(manifest.id, next, {
    expectedRevision: manifest.revision,
  });
  assert.equal(appended.segmentCount, 2);
});
