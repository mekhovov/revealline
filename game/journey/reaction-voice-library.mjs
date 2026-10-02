import { REACTION_VOICE_PILOT } from '../audio/reactions/pilot.mjs';
import { REACTION_LINES } from './reactions.mjs';

const DATABASE = 'revealline-reaction-voices-v1',
  STORE = 'lines';
const FORMAT = 'ReactionVoiceBundleV1',
  MAX_CLIP = 2 * 1024 * 1024,
  MAX_BUNDLE = 32 * 1024 * 1024;
const mimeTypes = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
]);
const lines = new Map(REACTION_LINES.map((entry) => [entry.id, entry]));
const keyFor = (lineId, locale) => `${lineId}|${locale}`;
const originals = new Map(
  REACTION_VOICE_PILOT.map((entry) => [keyFor(entry.lineId, entry.locale), entry]),
);
const clone = (value) => JSON.parse(JSON.stringify(value));
function bytesToBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384)
    text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
function base64ToBytes(value) {
  if (
    typeof value !== 'string' ||
    value.length > MAX_CLIP * 1.4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw new Error('Invalid recording bytes.');
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function digest(bytes) {
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
function lineFor(lineId, locale) {
  const line = lines.get(lineId);
  if (!line || !['en', 'uk'].includes(locale))
    throw new Error('Choose a registered line and language.');
  return line;
}
async function validateRecord(source) {
  if (!source || typeof source !== 'object') throw new Error('Invalid voice record.');
  const line = lineFor(source.lineId, source.locale);
  if (
    source.key !== keyFor(source.lineId, source.locale) ||
    !Array.isArray(source.revisions) ||
    source.revisions.length > 8
  )
    throw new Error('Invalid voice revisions.');
  const revisions = [];
  for (const revision of source.revisions) {
    if (
      !revision ||
      !mimeTypes.has(revision.mime) ||
      revision.transcript !== line.text[source.locale] ||
      !['human', 'generated'].includes(revision.kind) ||
      typeof revision.credit !== 'string' ||
      revision.credit.length > 240 ||
      typeof revision.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(revision.createdAt)) ||
      !Number.isFinite(revision.duration) ||
      revision.duration <= 0 ||
      revision.duration > 15
    )
      throw new Error('Invalid recording metadata.');
    const bytes = base64ToBytes(revision.base64);
    if (
      !bytes.length ||
      bytes.length > MAX_CLIP ||
      revision.bytes !== bytes.length ||
      (await digest(bytes)) !== revision.sha256
    )
      throw new Error('Recording integrity check failed.');
    if (revisions.some((entry) => entry.sha256 === revision.sha256))
      throw new Error('Duplicate voice revision.');
    revisions.push({
      sha256: revision.sha256,
      bytes: bytes.length,
      base64: revision.base64,
      mime: revision.mime,
      transcript: revision.transcript,
      kind: revision.kind,
      credit: revision.credit,
      duration: revision.duration,
      createdAt: revision.createdAt,
    });
  }
  if (source.active !== null && !revisions.some((entry) => entry.sha256 === source.active))
    throw new Error('Selected voice revision is missing.');
  let original = null;
  if (source.original) {
    const entry = source.original,
      bytes = base64ToBytes(entry.base64);
    if (
      !bytes.length ||
      bytes.length > MAX_CLIP ||
      entry.bytes !== bytes.length ||
      !mimeTypes.has(entry.mime) ||
      entry.transcript !== line.text[source.locale] ||
      typeof entry.provenance?.provider !== 'string' ||
      entry.provenance.provider.length > 120 ||
      typeof entry.provenance?.voice !== 'string' ||
      entry.provenance.voice.length > 120 ||
      (await digest(bytes)) !== entry.sha256
    )
      throw new Error('Original recording integrity check failed.');
    original = {
      sha256: entry.sha256,
      bytes: bytes.length,
      mime: entry.mime,
      transcript: entry.transcript,
      base64: entry.base64,
      provenance: {
        provider: entry.provenance.provider,
        voice: entry.provenance.voice,
        ...(Number.isFinite(entry.provenance.rate) &&
        entry.provenance.rate > 0 &&
        entry.provenance.rate <= 500
          ? { rate: entry.provenance.rate }
          : {}),
        ...Object.fromEntries(
          ['kind', 'releaseStatus', 'note'].flatMap((key) =>
            typeof entry.provenance[key] === 'string' && entry.provenance[key].length <= 1000
              ? [[key, entry.provenance[key]]]
              : [],
          ),
        ),
      },
    };
  }
  return {
    key: source.key,
    lineId: source.lineId,
    locale: source.locale,
    active: source.active,
    revisions,
    original,
  };
}

/** Local originals remain immutable. Replacements retain all eight admitted revisions. */
export function createReactionVoiceLibrary({
  indexedDB = globalThis.indexedDB,
  fetch: fetcher = globalThis.fetch,
} = {}) {
  let connection = null,
    closed = false;
  const listeners = new Set();
  let channel = null;
  try {
    channel = new globalThis.BroadcastChannel('revealline-reaction-voices');
  } catch {
    /* Optional cross-tab refresh. */
  }
  if (channel)
    channel.onmessage = () => {
      for (const fn of listeners) {
        try {
          fn();
        } catch {
          /* Other tabs cannot invalidate local presentation. */
        }
      }
    };
  const database = () =>
    (connection ??= new Promise((resolve, reject) => {
      if (!indexedDB) {
        reject(new Error('Local recording storage is unavailable.'));
        return;
      }
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
      request.onerror = () => reject(request.error ?? new Error('Recording storage failed.'));
      request.onblocked = () => reject(new Error('Close other recording editors and retry.'));
      request.onsuccess = () => {
        if (closed) {
          request.result.close();
          reject(new Error('Recording library closed.'));
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    }));
  async function transaction(mode, operation) {
    const db = await database();
    if (closed) throw new Error('Recording library closed.');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode),
        request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error ?? new Error('Recording could not be saved.'));
    });
  }
  const read = (lineId, locale) =>
    transaction('readonly', (store) => store.get(keyFor(lineId, locale)));
  async function writeChecked(changes) {
    const db = await database();
    if (closed) throw new Error('Recording library closed.');
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite'),
        store = tx.objectStore(STORE);
      let failure = null;
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () =>
        reject(failure ?? tx.error ?? new Error('Recording could not be saved.'));
      for (const { previous, next } of changes) {
        const request = store.get(next.key);
        request.onsuccess = () => {
          if (failure) return;
          if (JSON.stringify(request.result ?? null) !== JSON.stringify(previous ?? null)) {
            failure = new Error('This voice line changed in another editor. Refresh and retry.');
            tx.abort();
            return;
          }
          store.put(next);
        };
      }
    });
  }
  const notify = () => {
    for (const fn of listeners)
      try {
        fn();
      } catch {
        /* Presentation observers cannot invalidate a saved recording. */
      }
    channel?.postMessage('updated');
  };
  async function readOriginal(lineId, locale) {
    const original = originals.get(keyFor(lineId, locale));
    if (!original || typeof fetcher !== 'function') return null;
    const response = await fetcher(new URL(`../audio/reactions/${original.file}`, import.meta.url));
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== original.bytes || (await digest(bytes)) !== original.sha256)
      return null;
    return { metadata: original, bytes };
  }
  return Object.freeze({
    originals: REACTION_VOICE_PILOT,
    async available(locale) {
      if (!['en', 'uk'].includes(locale)) return [];
      const admitted = new Set(
        REACTION_VOICE_PILOT.filter((entry) => entry.locale === locale).map(
          (entry) => entry.lineId,
        ),
      );
      try {
        const keys = await transaction('readonly', (store) => store.getAllKeys());
        for (const key of keys) {
          const [lineId, language] = String(key).split('|');
          if (language === locale && lines.has(lineId)) admitted.add(lineId);
        }
      } catch {
        /* Bundled voices remain available without local recording storage. */
      }
      return [...admitted];
    },
    async describe(lineId, locale) {
      lineFor(lineId, locale);
      const record = await read(lineId, locale);
      return {
        ...(record ?? { lineId, locale, active: null, revisions: [] }),
        original: record?.original ?? originals.get(keyFor(lineId, locale)) ?? null,
      };
    },
    async resolve(lineId, locale) {
      lineFor(lineId, locale);
      let record;
      try {
        record = await read(lineId, locale);
      } catch {
        /* Bundled voices work without writable storage. */
      }
      const active = record?.revisions.find((entry) => entry.sha256 === record.active);
      if (active)
        return {
          bytes: base64ToBytes(active.base64).buffer,
          sha256: active.sha256,
          duration: active.duration,
        };
      if (record?.original)
        return {
          bytes: base64ToBytes(record.original.base64).buffer,
          sha256: record.original.sha256,
        };
      const original = await readOriginal(lineId, locale);
      return original ? { bytes: original.bytes, sha256: original.metadata.sha256 } : null;
    },
    async replace({ lineId, locale, blob, kind, credit = '', duration }) {
      const line = lineFor(lineId, locale);
      if (!blob || blob.size > MAX_CLIP) throw new Error('Choose an audio recording under 2 MiB.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const stored = await read(lineId, locale);
      const previous = stored ?? {
        key: keyFor(lineId, locale),
        lineId,
        locale,
        active: null,
        revisions: [],
      };
      let original = previous.original ?? null;
      if (!original && originals.has(keyFor(lineId, locale))) {
        const archived = await readOriginal(lineId, locale);
        if (!archived) throw new Error('Download the original recording before replacing it.');
        original = { ...archived.metadata, base64: bytesToBase64(new Uint8Array(archived.bytes)) };
      }
      const sha256 = await digest(bytes),
        revisions = previous.revisions.filter((entry) => entry.sha256 !== sha256);
      revisions.push(
        previous.revisions.find((entry) => entry.sha256 === sha256) ?? {
          sha256,
          bytes: bytes.length,
          base64: bytesToBase64(bytes),
          mime: blob.type,
          transcript: line.text[locale],
          kind,
          credit: credit.trim(),
          duration,
          createdAt: new Date().toISOString(),
        },
      );
      if (revisions.length > 8)
        throw new Error(
          'Eight revisions retained. Export this library before starting a new line edition.',
        );
      const record = await validateRecord({ ...previous, active: sha256, revisions, original });
      await writeChecked([{ previous: stored, next: record }]);
      notify();
      return record;
    },
    async select(lineId, locale, sha256 = null) {
      lineFor(lineId, locale);
      const record = await read(lineId, locale);
      if (!record) {
        if (sha256 !== null) throw new Error('Voice revision missing.');
        return;
      }
      const next = await validateRecord({ ...record, active: sha256 });
      await writeChecked([{ previous: record, next }]);
      notify();
    },
    async exportBundle() {
      const records = await transaction('readonly', (store) => store.getAll());
      const value = JSON.stringify({ format: FORMAT, records });
      if (value.length > MAX_BUNDLE)
        throw new Error('Voice library exceeds the portable bundle limit.');
      return value;
    },
    async importBundle(text) {
      if (typeof text !== 'string' || text.length > MAX_BUNDLE)
        throw new Error('Choose a voice bundle under 32 MiB.');
      const value = JSON.parse(text);
      if (
        value?.format !== FORMAT ||
        !Array.isArray(value.records) ||
        value.records.length > REACTION_LINES.length * 2
      )
        throw new Error('Unsupported voice bundle.');
      const incoming = await Promise.all(value.records.map(validateRecord));
      if (new Set(incoming.map((entry) => entry.key)).size !== incoming.length)
        throw new Error('Repeated line in voice bundle.');
      const existing = new Map(
        (await transaction('readonly', (store) => store.getAll())).map((entry) => [
          entry.key,
          entry,
        ]),
      );
      const merged = incoming.map((entry) => {
        const prior = existing.get(entry.key),
          revisions = new Map(
            (prior?.revisions ?? []).map((revision) => [revision.sha256, revision]),
          );
        if (prior?.original && entry.original && prior.original.sha256 !== entry.original.sha256)
          throw new Error(
            'This bundle has a different original recording edition; existing originals were retained.',
          );
        for (const revision of entry.revisions) {
          const retained = revisions.get(revision.sha256);
          if (retained && JSON.stringify(retained) !== JSON.stringify(revision))
            throw new Error(
              'This recording has different retained metadata; existing revisions were kept.',
            );
          revisions.set(revision.sha256, revision);
        }
        if (revisions.size > 8)
          throw new Error('Import would exceed eight retained revisions for a line.');
        return {
          ...entry,
          original: prior?.original ?? entry.original,
          revisions: [...revisions.values()],
        };
      });
      await writeChecked(
        merged.map((record) => ({ previous: existing.get(record.key), next: clone(record) })),
      );
      notify();
      return merged.length;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      closed = true;
      listeners.clear();
      channel?.close();
      connection?.then((db) => db.close()).catch(() => {});
    },
  });
}
