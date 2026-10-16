import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
} from '../../game/data-json.mjs';
import { validateSimAppearance } from './world-themes.mjs';

export function worldRecordIdentity({ course, proof, presentation }) {
  return dataIdentity({ course, proof, ...(presentation ? { presentation } : {}) });
}

export const WORLD_RECORD_LIMITS = Object.freeze({
  records: 512,
  bytes: 64 * 1024 * 1024,
  recordBytes: 8 * 1024 * 1024,
  archiveBytes: 32 * 1024 * 1024,
  archiveNodes: 2000000,
  archiveRecords: 1024,
});
const RECORD_SHAPE = {
  maxBytes: WORLD_RECORD_LIMITS.recordBytes,
  maxNodes: 600000,
  maxArray: 60000,
  maxDepth: 20,
};
const STATUSES = ['verified', 'missing-dependency', 'invalid'];
const utf8Size = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function archiveRecord(input) {
  const record = boundedJSON(input, RECORD_SHAPE);
  exactKeys(
    record,
    [
      'id',
      'course',
      'proof',
      'status',
      'diagnostic',
      'packIdentity',
      'savedAt',
      'byteLength',
      'pinned',
      'presentation',
    ],
    'flight record',
  );
  required(
    record.course &&
      record.proof &&
      typeof record.course === 'object' &&
      typeof record.proof === 'object' &&
      !Array.isArray(record.course) &&
      !Array.isArray(record.proof),
    'Recording needs course and proof data',
  );
  if (record.presentation !== undefined) {
    required(
      record.proof.format === 'FlightAttempt.v1',
      'World appearance belongs in its course snapshot',
    );
    record.presentation = validateSimAppearance(record.presentation);
  }
  required(record.id === worldRecordIdentity(record), 'Recording identity does not match its data');
  required(
    STATUSES.includes(record.status) &&
      typeof record.diagnostic === 'string' &&
      record.diagnostic.length <= 1000 &&
      typeof record.packIdentity === 'string' &&
      record.packIdentity.length <= 160 &&
      Number.isSafeInteger(record.savedAt) &&
      record.savedAt >= 0,
    'Invalid recording metadata',
  );
  required(record.pinned === undefined || typeof record.pinned === 'boolean', 'Invalid pin state');
  return record;
}
function nodeCount(root) {
  let count = 0;
  const pending = [root];
  while (pending.length) {
    const value = pending.pop();
    count++;
    if (value && typeof value === 'object')
      for (const child of Object.values(value)) pending.push(child);
  }
  return count;
}

export async function openWorldRecords(indexedDB = globalThis.indexedDB) {
  if (!indexedDB)
    throw new Error('Flight records require browser storage. Export recordings to keep them.');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('revealline.fpv.world-records.v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('records', { keyPath: 'id' });
      request.result.createObjectStore('session');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.onversionchange = () => db.close();
  function transaction(store, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      let value;
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Flight storage failed'));
      try {
        const request = action(tx.objectStore(store));
        if (request)
          request.onsuccess = () => {
            value = request.result;
          };
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }
  return {
    list: () => transaction('records', 'readonly', (store) => store.getAll()),
    async put({
      course,
      proof,
      status = 'missing-dependency',
      diagnostic = '',
      packIdentity = '',
      pinned,
      presentation,
    }) {
      required(STATUSES.includes(status), 'Unknown verification state');
      required(
        typeof packIdentity === 'string' && packIdentity.length <= 160,
        'Invalid recording pack identity',
      );
      if (presentation !== undefined) {
        required(
          proof.format === 'FlightAttempt.v1',
          'World appearance belongs in its course snapshot',
        );
        presentation = validateSimAppearance(presentation);
      }
      const clean = boundedJSON(
        { course, proof, ...(presentation ? { presentation } : {}) },
        RECORD_SHAPE,
      );
      const record = {
        id: dataIdentity(clean),
        ...clean,
        status,
        diagnostic: String(diagnostic).slice(0, 1000),
        packIdentity,
        savedAt: Date.now(),
        ...(pinned === undefined ? {} : { pinned: Boolean(pinned) }),
      };
      // Conservative serialized size includes room for this size field itself.
      record.byteLength = utf8Size(record) + 64;
      required(
        record.byteLength <= WORLD_RECORD_LIMITS.recordBytes,
        'Recording exceeds the storage budget',
      );
      await new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        let count = 0;
        let bytes = 0;
        let failure;
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(failure ?? tx.error ?? new Error('Flight storage failed'));
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            if (
              cursor.key === record.id &&
              pinned === undefined &&
              cursor.value.pinned !== undefined
            )
              record.pinned = cursor.value.pinned;
            if (cursor.key !== record.id) {
              count++;
              bytes += cursor.value.byteLength ?? utf8Size(cursor.value) + 64;
            }
            cursor.continue();
            return;
          }
          if (
            count + 1 > WORLD_RECORD_LIMITS.records ||
            bytes + record.byteLength > WORLD_RECORD_LIMITS.bytes
          ) {
            failure = new Error(
              'Flight record storage is full. Export and remove older recordings before saving another.',
            );
            tx.abort();
            return;
          }
          store.put(record);
        };
      });
      return record;
    },
    pin: (id, pinned) => {
      required(typeof pinned === 'boolean', 'Invalid pin state');
      return transaction('records', 'readwrite', (store) => {
        const read = store.get(id);
        read.onsuccess = () => {
          if (read.result) store.put({ ...read.result, pinned });
        };
      });
    },
    remove: (id) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite'),
          store = tx.objectStore('records');
        let error;
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(error ?? tx.error ?? new Error('Flight deletion failed'));
        const read = store.get(id);
        read.onsuccess = () => {
          if (read.result?.pinned) {
            error = new Error('Unpin this recording before removing it.');
            tx.abort();
          } else store.delete(id);
        };
      }),
    saveSession: (session) => {
      const clean = session ? boundedJSON(session, RECORD_SHAPE) : null;
      return transaction('session', 'readwrite', (store) =>
        clean ? store.put(clean, 'active') : store.delete('active'),
      );
    },
    session: () => transaction('session', 'readonly', (store) => store.get('active')),
    close: () => db.close(),
  };
}

/** Partition byte, structure and record-count budgets together. Raw unavailable
 * and invalid proofs remain in backups; no imported verified flag is trusted. */
export function partitionProofArchive(records) {
  required(
    Array.isArray(records) && records.length <= 4096,
    'Recording export selection is too large',
  );
  const groups = [];
  let group = [];
  let bytes = 512;
  let nodes = 32;
  for (const input of records) {
    const record = archiveRecord(input);
    const size = utf8Size(record) + 1;
    const count = nodeCount(record);
    if (
      bytes + size > WORLD_RECORD_LIMITS.archiveBytes ||
      nodes + count > WORLD_RECORD_LIMITS.archiveNodes ||
      group.length >= WORLD_RECORD_LIMITS.archiveRecords
    ) {
      groups.push(group);
      group = [];
      bytes = 512;
      nodes = 32;
    }
    group.push(record);
    bytes += size;
    nodes += count;
  }
  if (group.length || !groups.length) groups.push(group);
  return groups.map((entries, index) => ({
    format: 'FPVProofArchive.v1',
    part: index + 1,
    parts: groups.length,
    records: entries,
  }));
}
export function readProofArchive(text) {
  const value = boundedJSON(text, {
    maxBytes: WORLD_RECORD_LIMITS.archiveBytes,
    maxNodes: WORLD_RECORD_LIMITS.archiveNodes,
    maxArray: 60000,
    maxDepth: 24,
  });
  exactKeys(value, ['format', 'part', 'parts', 'records'], 'proof archive');
  required(
    value.format === 'FPVProofArchive.v1' &&
      Array.isArray(value.records) &&
      value.records.length <= WORLD_RECORD_LIMITS.archiveRecords &&
      Number.isSafeInteger(value.part) &&
      Number.isSafeInteger(value.parts) &&
      value.parts >= 1 &&
      value.parts <= 4096 &&
      value.part >= 1 &&
      value.part <= value.parts,
    'Unsupported flight-record archive',
  );
  return value.records.map((record) => ({
    ...archiveRecord(record),
    status: 'missing-dependency',
  }));
}

async function archiveHash(value) {
  const bytes = new TextEncoder().encode(canonicalJSON(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
/** SHA-256 detects transport changes. Record verification still requires replay. */
export async function exportProofParts(records) {
  const parts = partitionProofArchive(records);
  const archiveId = await archiveHash(await Promise.all(parts.map(archiveHash)));
  return Promise.all(
    parts.map(async (part) => {
      const payload = {
        ...part,
        format: records.some((record) => record.presentation)
          ? 'FPVProofArchive.v3'
          : 'FPVProofArchive.v2',
        archiveId,
      };
      return { ...payload, sha256: await archiveHash(payload) };
    }),
  );
}
export async function importProofPart(input) {
  const value = boundedJSON(input, {
    maxBytes: WORLD_RECORD_LIMITS.archiveBytes,
    maxNodes: WORLD_RECORD_LIMITS.archiveNodes,
    maxArray: 60000,
    maxDepth: 24,
  });
  if (value.format === 'FPVProofArchive.v1') return readProofArchive(value);
  exactKeys(
    value,
    ['format', 'archiveId', 'sha256', 'part', 'parts', 'records'],
    'proof archive part',
  );
  required(
    ['FPVProofArchive.v2', 'FPVProofArchive.v3'].includes(value.format) &&
      /^[a-f0-9]{64}$/.test(value.archiveId) &&
      /^[a-f0-9]{64}$/.test(value.sha256),
    'Invalid proof archive identity',
  );
  const { sha256, ...payload } = value;
  required((await archiveHash(payload)) === sha256, 'Proof archive checksum does not match');
  return readProofArchive({
    format: 'FPVProofArchive.v1',
    part: value.part,
    parts: value.parts,
    records: value.records,
  });
}
