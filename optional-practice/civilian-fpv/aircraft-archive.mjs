import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import { AIRCRAFT_RECORDING_FORMAT, validateAircraftRecording } from './aircraft-recording.mjs';

export const AIRCRAFT_ARCHIVE_FORMAT = 'AircraftSessionArchive.v1';
export const AIRCRAFT_ARCHIVE_PACKAGE_FORMAT = 'AircraftArchivePackage.v1';
export const AIRCRAFT_ARCHIVE_PACKAGE_BYTES = 32 * 1024 * 1024;
export const AIRCRAFT_ARCHIVE_OVERHEAD_BYTES = 64 * 1024;
export const AIRCRAFT_ARCHIVE_PAYLOAD_BYTES =
  AIRCRAFT_ARCHIVE_PACKAGE_BYTES - AIRCRAFT_ARCHIVE_OVERHEAD_BYTES;
export const AIRCRAFT_ARCHIVE_TOTAL_BYTES = 128 * 1024 * 1024;
export const AIRCRAFT_ARCHIVE_MAX_SESSIONS = 16;
export const AIRCRAFT_ARCHIVE_MAX_SEGMENTS = 256;
const DATABASE = 'revealline.fpv.aircraft-archives.v1';
const STORES = ['archives', 'segments', 'budget'];
const BUDGET_KEY = 'local';
const CONFIG_BYTES = 512 * 1024;
const bounds = {
  maxBytes: AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
  maxNodes: 3000000,
  maxArray: 500000,
  maxString: 12 * 1024 * 1024,
  maxDepth: 40,
};
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const copy = (value) => structuredClone(value);
const integer = (n, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= minimum && n <= maximum;
const states = ['open', 'ended', 'interrupted', 'capacity', 'gap'];
const hosts = ['academy', 'world', 'regional', 'arena'];
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{8}$/.test(value);
const identity = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
const abortError = () => new DOMException('Aircraft archive operation cancelled', 'AbortError');
const key = (id, index) => `${id}:${index}`;
function fields(value, names, label) {
  exactKeys(value, names, label);
  required(
    names.every((name) => Object.hasOwn(value, name)),
    `Incomplete ${label}`,
  );
}

function validateOrigin(origin) {
  fields(origin, ['kind', 'startTick'], 'aircraft archive origin');
  required(
    ['fresh', 'checkpoint'].includes(origin.kind) &&
      integer(origin.startTick) &&
      (origin.kind !== 'fresh' || origin.startTick === 0),
    'Invalid aircraft archive origin',
  );
}

export function validateAircraftArchiveManifest(source) {
  const value = boundedJSON(source, { ...bounds, maxBytes: CONFIG_BYTES + 16384 });
  fields(
    value,
    [
      'format',
      'id',
      'host',
      'name',
      'createdAt',
      'revision',
      'identity',
      'config',
      'origin',
      'state',
      'firstIndex',
      'lastIndex',
      'startTick',
      'endTick',
      'segmentCount',
      'payloadBytes',
      'finalHash',
      'scored',
    ],
    'aircraft archive manifest',
  );
  validateOrigin(value.origin);
  required(
    value.format === AIRCRAFT_ARCHIVE_FORMAT &&
      stableId(value.id) &&
      hosts.includes(value.host) &&
      typeof value.name === 'string' &&
      value.name.trim().length > 0 &&
      value.name.length <= 120 &&
      integer(value.createdAt) &&
      integer(value.revision) &&
      identity(value.identity) &&
      value.config &&
      typeof value.config === 'object' &&
      !Array.isArray(value.config) &&
      bytes(value.config) <= CONFIG_BYTES &&
      states.includes(value.state) &&
      value.scored === false &&
      value.startTick === value.origin.startTick &&
      integer(value.endTick, value.startTick) &&
      integer(value.segmentCount, 0, AIRCRAFT_ARCHIVE_MAX_SEGMENTS) &&
      integer(value.payloadBytes, bytes(value.config), AIRCRAFT_ARCHIVE_PAYLOAD_BYTES),
    'Invalid aircraft archive manifest',
  );
  required(
    value.segmentCount === 0
      ? value.firstIndex === null &&
          value.lastIndex === null &&
          value.finalHash === null &&
          value.endTick === value.startTick &&
          value.payloadBytes === bytes(value.config)
      : integer(value.firstIndex) &&
          integer(value.lastIndex, value.firstIndex) &&
          value.lastIndex - value.firstIndex + 1 === value.segmentCount &&
          hash(value.finalHash) &&
          value.endTick > value.startTick &&
          (value.origin.kind !== 'fresh' || value.firstIndex === 0),
    'Aircraft archive range does not match its manifest',
  );
  return value;
}

/** Keep the recorder's existing segment identity; archive names and IDs never
 * affect simulation or comparison identities. This checksum is not a proof. */
export const aircraftArchiveSegmentDigest = (segment) => dataIdentity(segment);

function validateSegment(source, manifest) {
  const checked = validateAircraftRecording({
    format: AIRCRAFT_RECORDING_FORMAT,
    identity: manifest.identity,
    config: manifest.config,
    scored: false,
    origin: 'checkpoint',
    startMissionTick: source?.startTick,
    missionTicks: source?.endTick,
    segments: [source],
    finalHash: source?.finalHash,
  }).segments[0];
  required(
    checked.endTick > checked.startTick && checked.checkpoint?.identity === manifest.identity,
    'Aircraft archive segment has no flight or belongs to another configuration',
  );
  return checked;
}

function extend(manifest, segment, previous) {
  required(manifest.state === 'open', 'Aircraft archive is already closed');
  if (previous) {
    required(
      segment.index === previous.index + 1 &&
        segment.startTick === previous.endTick &&
        segment.initialHash === previous.finalHash &&
        segment.previous === aircraftArchiveSegmentDigest(previous),
      'Missing, reordered or changed aircraft archive segment',
    );
  } else {
    required(
      segment.startTick === manifest.startTick &&
        (manifest.origin.kind !== 'fresh' || (segment.index === 0 && segment.previous === null)),
      'Aircraft archive beginning does not match its origin',
    );
  }
  const next = {
    ...manifest,
    revision: manifest.revision + 1,
    firstIndex: manifest.firstIndex ?? segment.index,
    lastIndex: segment.index,
    endTick: segment.endTick,
    segmentCount: manifest.segmentCount + 1,
    payloadBytes: manifest.payloadBytes + bytes(segment),
    finalHash: segment.finalHash,
  };
  required(
    next.segmentCount <= AIRCRAFT_ARCHIVE_MAX_SEGMENTS &&
      next.payloadBytes <= AIRCRAFT_ARCHIVE_PAYLOAD_BYTES,
    'Aircraft archive capacity reached; flying and recent clips can continue',
  );
  return validateAircraftArchiveManifest(next);
}

/** Structural/import validation only. A fresh-origin claim and hash chain must
 * still be independently replayed before showing a verification result. */
export function validateAircraftArchivePackage(source) {
  const value = boundedJSON(source, bounds);
  fields(value, ['format', 'manifest', 'segments'], 'aircraft archive package');
  required(
    value.format === AIRCRAFT_ARCHIVE_PACKAGE_FORMAT,
    'Unsupported aircraft archive package',
  );
  const manifest = validateAircraftArchiveManifest(value.manifest);
  required(
    Array.isArray(value.segments) &&
      value.segments.length > 0 &&
      value.segments.length === manifest.segmentCount,
    'Aircraft archive package is empty or missing segments',
  );
  let reconstructed = {
    ...manifest,
    state: 'open',
    revision: 0,
    firstIndex: null,
    lastIndex: null,
    segmentCount: 0,
    endTick: manifest.startTick,
    payloadBytes: bytes(manifest.config),
    finalHash: null,
  };
  let previous = null;
  for (const item of value.segments) {
    const segment = validateSegment(item, manifest);
    reconstructed = extend(reconstructed, segment, previous);
    previous = segment;
  }
  for (const field of [
    'firstIndex',
    'lastIndex',
    'endTick',
    'segmentCount',
    'payloadBytes',
    'finalHash',
  ])
    required(
      reconstructed[field] === manifest[field],
      'Aircraft archive manifest differs from its segments',
    );
  return { format: AIRCRAFT_ARCHIVE_PACKAGE_FORMAT, manifest, segments: value.segments };
}

function emptyManifest(source) {
  const spec = boundedJSON(source, { ...bounds, maxBytes: CONFIG_BYTES + 16384 });
  exactKeys(
    spec,
    ['id', 'host', 'identity', 'config', 'origin', 'name', 'createdAt'],
    'new aircraft archive',
  );
  return validateAircraftArchiveManifest({
    format: AIRCRAFT_ARCHIVE_FORMAT,
    id: spec.id,
    host: spec.host,
    name: spec.name ?? 'Aircraft practice',
    createdAt: spec.createdAt ?? Date.now(),
    revision: 0,
    identity: spec.identity,
    config: spec.config,
    origin: spec.origin,
    state: 'open',
    firstIndex: null,
    lastIndex: null,
    startTick: spec.origin?.startTick,
    endTick: spec.origin?.startTick,
    segmentCount: 0,
    payloadBytes: bytes(spec.config),
    finalHash: null,
    scored: false,
  });
}

const storageBytes = (manifest) => manifest.payloadBytes + AIRCRAFT_ARCHIVE_OVERHEAD_BYTES;
const emptyBudget = () => ({ format: 'AircraftArchiveBudget.v1', archives: 0, bytes: 0 });
function validateBudget(source) {
  const value = source ?? emptyBudget();
  fields(value, ['format', 'archives', 'bytes'], 'archive storage budget');
  required(
    value.format === 'AircraftArchiveBudget.v1' &&
      integer(value.archives, 0, AIRCRAFT_ARCHIVE_MAX_SESSIONS) &&
      integer(value.bytes, 0, AIRCRAFT_ARCHIVE_TOTAL_BYTES),
    'Invalid aircraft archive storage accounting',
  );
  return value;
}
function adjustBudget(source, count, growth) {
  const current = validateBudget(source);
  const value = { ...current, archives: current.archives + count, bytes: current.bytes + growth };
  required(
    integer(value.archives, 0, AIRCRAFT_ARCHIVE_MAX_SESSIONS) &&
      integer(value.bytes, 0, AIRCRAFT_ARCHIVE_TOTAL_BYTES),
    'Aircraft archive storage is full; delete an archive to make space',
  );
  return value;
}

/** One transaction owns the segment, manifest and global budget. No successful
 * write is acknowledged before commit; quota/cancellation preserve the prior
 * durable prefix. Recovery slots and the bounded recent recorder are separate. */
export function createAircraftArchiveStore({ indexedDB = globalThis.indexedDB } = {}) {
  let opening = null,
    database = null,
    closed = false;
  const active = new Set();
  function open() {
    if (closed) return Promise.reject(abortError());
    if (!indexedDB) return Promise.reject(new Error('Aircraft archive storage is unavailable'));
    if (database) return Promise.resolve(database);
    if (!opening)
      opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        let rejected = false;
        request.onupgradeneeded = () => {
          for (const name of STORES)
            if (!request.result.objectStoreNames.contains(name))
              request.result.createObjectStore(name);
        };
        request.onblocked = () => {
          rejected = true;
          reject(new Error('Aircraft archive storage is blocked by another tab'));
        };
        request.onerror = () => {
          rejected = true;
          reject(request.error ?? new Error('Aircraft archive storage failed to open'));
        };
        request.onsuccess = () => {
          if (closed || rejected) {
            request.result.close();
            reject(abortError());
            return;
          }
          database = request.result;
          database.onversionchange = () => {
            database?.close();
            database = null;
            opening = null;
          };
          resolve(database);
        };
      }).catch((error) => {
        opening = null;
        throw error;
      });
    return opening;
  }
  async function transaction(mode, signal, operation) {
    signal?.throwIfAborted();
    const db = await open();
    signal?.throwIfAborted();
    if (closed) throw abortError();
    return new Promise((resolve, reject) => {
      let tx,
        value,
        failure = null,
        completed = false;
      const finish = (error) => {
        if (completed) return;
        completed = true;
        active.delete(cancel);
        signal?.removeEventListener('abort', cancel);
        if (error) reject(error);
        else resolve(value);
      };
      const fail = (error) => {
        failure ??= error;
        try {
          tx?.abort();
        } catch {}
        finish(failure);
      };
      const cancel = () => fail(abortError());
      try {
        tx = db.transaction(STORES, mode);
        active.add(cancel);
        signal?.addEventListener('abort', cancel, { once: true });
        tx.oncomplete = () => finish(failure);
        tx.onabort = tx.onerror = () =>
          finish(failure ?? tx.error ?? new Error('Aircraft archive transaction failed'));
        const request = (store, method, args, callback = () => {}) => {
          const pending = tx.objectStore(store)[method](...args);
          pending.onsuccess = () => {
            if (completed) return;
            try {
              callback(pending.result);
            } catch (error) {
              fail(error);
            }
          };
          return pending;
        };
        operation(request, (result) => {
          value = result;
        });
      } catch (error) {
        fail(error);
      }
    });
  }
  const checkId = (id) => required(stableId(id), 'Invalid aircraft archive ID');
  const expect = (manifest, revision) =>
    required(
      integer(revision) && revision === manifest.revision,
      'Aircraft archive changed in another tab; refresh before saving',
    );
  function readManifest(request, id, callback) {
    request('archives', 'get', [id], (source) => {
      required(source !== undefined, 'Aircraft archive was not found');
      const manifest = validateAircraftArchiveManifest(source);
      required(manifest.id === id, 'Aircraft archive storage key changed');
      callback(manifest);
    });
  }
  function insert(manifest, segments, signal) {
    return transaction('readwrite', signal, (request, done) => {
      request('archives', 'get', [manifest.id], (existing) => {
        required(existing === undefined, 'An aircraft archive with this ID already exists');
        request('budget', 'get', [BUDGET_KEY], (budget) => {
          const next = adjustBudget(budget, 1, storageBytes(manifest));
          for (const segment of segments)
            request('segments', 'put', [segment, key(manifest.id, segment.index)]);
          request('archives', 'put', [manifest, manifest.id]);
          request('budget', 'put', [next, BUDGET_KEY]);
          done(copy(manifest));
        });
      });
    });
  }
  const api = {
    async begin(source, { signal } = {}) {
      signal?.throwIfAborted();
      return insert(emptyManifest(source), [], signal);
    },
    async append(id, source, { expectedRevision, signal } = {}) {
      checkId(id);
      signal?.throwIfAborted();
      const captured = boundedJSON(source, bounds);
      return transaction('readwrite', signal, (request, done) => {
        readManifest(request, id, (manifest) => {
          const segment = validateSegment(captured, manifest);
          request('segments', 'get', [key(id, segment.index)], (existing) => {
            if (existing !== undefined) {
              required(
                canonicalJSON(existing) === canonicalJSON(segment),
                'Aircraft archive segment was already saved with different data',
              );
              done(manifest);
              return;
            }
            expect(manifest, expectedRevision);
            const apply = (previous) => {
              const next = extend(manifest, segment, previous);
              request('budget', 'get', [BUDGET_KEY], (budget) => {
                const totals = adjustBudget(budget, 0, next.payloadBytes - manifest.payloadBytes);
                request('segments', 'put', [segment, key(id, segment.index)]);
                request('archives', 'put', [next, id]);
                request('budget', 'put', [totals, BUDGET_KEY]);
                done(next);
              });
            };
            if (manifest.lastIndex === null) apply(null);
            else
              request('segments', 'get', [key(id, manifest.lastIndex)], (previous) => {
                required(previous !== undefined, 'Aircraft archive is missing its durable tail');
                required(
                  previous.index === manifest.lastIndex &&
                    previous.endTick === manifest.endTick &&
                    previous.finalHash === manifest.finalHash,
                  'Aircraft archive durable tail differs from its manifest',
                );
                apply(validateSegment(previous, manifest));
              });
          });
        });
      });
    },
    async finish(id, source, { expectedRevision, signal } = {}) {
      checkId(id);
      const ending = boundedJSON(source, { maxBytes: 1024 });
      fields(ending, ['reason', 'endTick', 'finalHash'], 'aircraft archive ending');
      required(
        states.includes(ending.reason) && ending.reason !== 'open',
        'Invalid archive ending',
      );
      return transaction('readwrite', signal, (request, done) => {
        readManifest(request, id, (manifest) => {
          required(
            ending.endTick === manifest.endTick && ending.finalHash === manifest.finalHash,
            'Archive ending differs from its last durable segment',
          );
          required(
            ending.reason !== 'ended' || manifest.segmentCount > 0,
            'Cannot finish an empty aircraft archive',
          );
          if (manifest.state === ending.reason) {
            done(manifest);
            return;
          }
          expect(manifest, expectedRevision);
          required(manifest.state === 'open', 'Aircraft archive is already closed');
          const next = validateAircraftArchiveManifest({
            ...manifest,
            state: ending.reason,
            revision: manifest.revision + 1,
          });
          request('archives', 'put', [next, id]);
          done(next);
        });
      });
    },
    async list({ signal } = {}) {
      return transaction('readonly', signal, (request, done) => {
        request('archives', 'getAll', [undefined, AIRCRAFT_ARCHIVE_MAX_SESSIONS + 1], (rows) => {
          required(
            rows.length <= AIRCRAFT_ARCHIVE_MAX_SESSIONS,
            'Too many stored aircraft archives',
          );
          done(
            rows
              .map(validateAircraftArchiveManifest)
              .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
          );
        });
      });
    },
    async load(id, { signal } = {}) {
      checkId(id);
      return transaction('readonly', signal, (request, done) => {
        readManifest(request, id, (manifest) => {
          const segments = [];
          const read = (index) => {
            if (segments.length === manifest.segmentCount) {
              if (segments.length)
                validateAircraftArchivePackage({
                  format: AIRCRAFT_ARCHIVE_PACKAGE_FORMAT,
                  manifest,
                  segments,
                });
              done({ manifest, segments });
              return;
            }
            request('segments', 'get', [key(id, index)], (segment) => {
              required(segment !== undefined, 'Aircraft archive is missing a saved segment');
              segments.push(segment);
              read(index + 1);
            });
          };
          read(manifest.firstIndex);
        });
      });
    },
    async exportPackage(id, { signal } = {}) {
      const data = await api.load(id, { signal });
      signal?.throwIfAborted();
      return validateAircraftArchivePackage({ format: AIRCRAFT_ARCHIVE_PACKAGE_FORMAT, ...data });
    },
    async importPackage(source, { id, signal } = {}) {
      checkId(id);
      signal?.throwIfAborted();
      const packet = validateAircraftArchivePackage(source);
      const manifest = validateAircraftArchiveManifest({
        ...packet.manifest,
        id,
        revision: 0,
        state: packet.manifest.state === 'open' ? 'interrupted' : packet.manifest.state,
      });
      return insert(manifest, packet.segments, signal);
    },
    async delete(id, { expectedRevision, signal } = {}) {
      checkId(id);
      return transaction('readwrite', signal, (request, done) => {
        readManifest(request, id, (manifest) => {
          expect(manifest, expectedRevision);
          request('budget', 'get', [BUDGET_KEY], (budget) => {
            const next = adjustBudget(budget, -1, -storageBytes(manifest));
            for (let offset = 0; offset < manifest.segmentCount; offset++)
              request('segments', 'delete', [key(id, manifest.firstIndex + offset)]);
            request('archives', 'delete', [id]);
            request('budget', 'put', [next, BUDGET_KEY]);
            done({ deleted: true, id });
          });
        });
      });
    },
    close() {
      if (closed) return;
      closed = true;
      for (const cancel of active) cancel();
      database?.close();
      database = null;
    },
  };
  return Object.freeze(api);
}
