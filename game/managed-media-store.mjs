import { boundedJSON, canonicalJSON, exactKeys, required } from './data-json.mjs';
import {
  SOUNDTRACK_LIMITS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
} from './soundtrack.mjs';
import { isPreparedSoundtrackLibrary, ownSoundtrackAssets } from './soundtrack-bundle.mjs';
import { inspectMP3, throwIfSoundtrackAborted } from './mp3.mjs';
import {
  emptyGenericMediaLibrary,
  validateGenericMediaLibrary,
  isStoredStillMedia,
  validateStoredStillMedia,
  storedStillHashes,
  assertStoredStillTransition,
  isPreparedStoredStillMedia,
} from './media-storage-record.mjs';

// Load the optional domain only after an explicit v4 request. Existing v2/v3
// entry graphs do not fetch story code or require a publication change.
let storyRecords;
async function loadStoryRecords() {
  storyRecords ??= await import('./story-storage-record.mjs');
}

export const MANAGED_MEDIA_DATABASE = 'revealline-soundtrack-v1';
export const MANAGED_MEDIA_VERSION = 2;
export const RICH_STILL_MEDIA_VERSION = 3;
export const STORY_MEDIA_VERSION = 4;
export const MANAGED_MEDIA_LIMITS = Object.freeze({
  bytes: 256 * 1024 * 1024,
  sourceBytes: 64 * 1024 * 1024,
  metadataBytes: 2 * 1024 * 1024,
  assets: 512,
  reservations: 4,
  leaseMs: 15 * 60 * 1000,
});
const STORES = ['metadata', 'audio', 'mediaRecords', 'mediaBlobs', 'managedState', 'reservations'];
const OVERHEAD = 4096,
  RESERVATION_OVERHEAD = 512;
const preparedMedia = new WeakSet();
const nativeSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
const size = (blob) => nativeSize.call(blob);
const encoded = (value) => new TextEncoder().encode(canonicalJSON(value)).byteLength;
const integer = (n) => Number.isSafeInteger(n) && n >= 0 && n < Number.MAX_SAFE_INTEGER;
const hashValid = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const abort = throwIfSoundtrackAborted;
const recordStore = (domain) =>
  ({ audio: 'metadata', media: 'mediaRecords', story: 'storyRecords' })[domain];
const emptyMedia = emptyGenericMediaLibrary;
const mediaLibrary = validateGenericMediaLibrary;
function row(value, domain, richStillMedia, still) {
  if (value === undefined)
    return {
      generation: 0,
      library:
        domain === 'audio'
          ? emptySoundtrackLibrary()
          : domain === 'story'
            ? storyRecords.emptyStoredStories()
            : emptyMedia(),
    };
  const copy = boundedJSON(value, {
    maxBytes:
      (domain === 'audio' ? SOUNDTRACK_LIMITS.metadataBytes : MANAGED_MEDIA_LIMITS.metadataBytes) +
      1024,
    maxNodes: (domain === 'media' && richStillMedia) || domain === 'story' ? 100000 : 32000,
    maxDepth: domain === 'media' && richStillMedia ? 26 : domain === 'story' ? 18 : 10,
    maxArray: domain === 'media' && richStillMedia ? 4096 : 512,
    maxString: domain === 'media' && richStillMedia ? 65536 : domain === 'story' ? 2048 : 1024,
  });
  exactKeys(copy, ['generation', 'library'], 'managed domain');
  required(integer(copy.generation), 'Invalid managed domain generation.');
  return {
    generation: copy.generation,
    library:
      domain === 'audio'
        ? resolveSoundtrackLibrary(copy.library)
        : domain === 'story'
          ? storyRecords.validateStoredStories(copy.library, still)
          : richStillMedia && isStoredStillMedia(copy.library)
            ? validateStoredStillMedia(copy.library)
            : mediaLibrary(copy.library),
  };
}
function ownMediaAssets(value) {
  required(
    Array.isArray(value) &&
      Object.getPrototypeOf(value) === Array.prototype &&
      value.length <= MANAGED_MEDIA_LIMITS.assets,
    'Invalid managed asset table.',
  );
  const descriptors = Object.getOwnPropertyDescriptors(value),
    seen = new Set(),
    result = [];
  required(
    Reflect.ownKeys(descriptors).length === value.length + 1,
    'Sparse or decorated managed asset table.',
  );
  for (let i = 0; i < value.length; i++) {
    const d = descriptors[i];
    required(
      d?.enumerable &&
        Object.hasOwn(d, 'value') &&
        d.value &&
        Object.getPrototypeOf(d.value) === Object.prototype,
      'Invalid managed asset entry.',
    );
    const fields = Object.getOwnPropertyDescriptors(d.value);
    required(
      Reflect.ownKeys(fields).length === 2 &&
        ['sha256', 'blob'].every((k) => fields[k]?.enumerable && Object.hasOwn(fields[k], 'value')),
      'Managed asset requires owned hash and Blob.',
    );
    const hash = fields.sha256.value,
      blob = fields.blob.value,
      bytes = size(blob);
    required(
      hashValid(hash) &&
        !seen.has(hash) &&
        integer(bytes) &&
        bytes > 0 &&
        bytes <= MANAGED_MEDIA_LIMITS.sourceBytes,
      'Invalid managed asset hash or byte budget.',
    );
    seen.add(hash);
    result.push(Object.freeze({ sha256: hash, blob: Blob.prototype.slice.call(blob, 0, bytes) }));
  }
  return Object.freeze(result);
}
async function digest(blob, signal) {
  abort(signal);
  const bytes = await blob.arrayBuffer();
  abort(signal);
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  abort(signal);
  return [...new Uint8Array(result)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** Internal byte-storage boundary only. This does not certify an image/video or make it playable. */
export async function prepareManagedMediaBytes(library, assets, { signal } = {}) {
  const safe = mediaLibrary(library),
    owned = ownMediaAssets(assets),
    wanted = new Set(safe.items.map((i) => i.sha256));
  required(
    wanted.size === owned.length && owned.every((a) => wanted.has(a.sha256)),
    'Managed byte transfer requires every referenced asset and no extras.',
  );
  required(
    owned.reduce((n, a) => n + size(a.blob), 0) <= MANAGED_MEDIA_LIMITS.bytes,
    'Managed assets exceed the byte budget.',
  );
  for (const asset of owned)
    required(
      (await digest(asset.blob, signal)) === asset.sha256,
      'Managed asset hash differs from original bytes.',
    );
  const prepared = Object.freeze({ library: safe, assets: owned });
  preparedMedia.add(prepared);
  return prepared;
}
function hashes(domain, library) {
  if (domain === 'story') return storyRecords.storedStoryHashes(library);
  if (domain === 'media' && isStoredStillMedia(library)) return storedStillHashes(library);
  return new Set(
    domain === 'audio'
      ? library.tracks.map((t) => t.asset.sha256)
      : library.items.map((i) => i.sha256),
  );
}
function changed(domain) {
  return `${domain === 'audio' ? 'Soundtrack' : 'Media library'} changed in another operation. Reload it before saving.`;
}

/** One database/ledger serialize every domain. Rich still storage opts into v3;
 * ordinary soundtrack callers retain their explicit v1/v2 behavior.
 */
export function createManagedMediaStore({
  indexedDB = globalThis.indexedDB,
  estimate = () => globalThis.navigator?.storage?.estimate?.(),
  now = Date.now,
  richStillMedia = false,
  storyMedia = false,
} = {}) {
  required(
    typeof richStillMedia === 'boolean' && typeof storyMedia === 'boolean',
    'Invalid managed media opt-in.',
  );
  richStillMedia ||= storyMedia;
  const domains = storyMedia ? ['audio', 'media', 'story'] : ['audio', 'media'];
  const storesInUse = storyMedia ? [...STORES, 'storyRecords'] : STORES;
  const domainValid = (d) => required(domains.includes(d), 'Unknown managed media domain.');
  const metadataBytes = (state, except) =>
    domains.filter((d) => d !== except).reduce((n, d) => n + encoded(state[`${d}Row`]), 0);
  function validateStoryState(media, story) {
    if (!storyMedia) return;
    storyRecords.validateStoredStories(story, media);
    required(
      encoded(media) + storyRecords.storedStoryMetadataBytes(story) <=
        MANAGED_MEDIA_LIMITS.metadataBytes,
      'Still and story metadata exceed the shared 2 MiB budget.',
    );
  }
  let opening = null,
    closed = false;
  const handles = new WeakMap();
  function clock() {
    const t = now();
    required(integer(t) && integer(t + MANAGED_MEDIA_LIMITS.leaseMs), 'Invalid media lease clock.');
    return t;
  }
  function open(signal) {
    abort(signal);
    if (storyMedia && !storyRecords) return loadStoryRecords().then(() => open(signal));
    if (closed) return Promise.reject(new Error('Managed media store is closed.'));
    if (!indexedDB)
      return Promise.reject(new Error('This browser does not provide soundtrack storage.'));
    if (opening) return opening.promise;
    const attempt = {};
    opening = attempt;
    attempt.promise = new Promise((resolve, reject) => {
      let failed = false,
        settled = false;
      const request = indexedDB.open(
        MANAGED_MEDIA_DATABASE,
        storyMedia
          ? STORY_MEDIA_VERSION
          : richStillMedia
            ? RICH_STILL_MEDIA_VERSION
            : MANAGED_MEDIA_VERSION,
      );
      const rejectOpen = (error) => {
        failed = true;
        signal?.removeEventListener('abort', cancel);
        if (opening === attempt) opening = null;
        if (!settled) {
          settled = true;
          reject(error);
        }
      };
      const cancel = () => {
        if (settled) return;
        try {
          request.transaction?.abort();
        } catch {}
        rejectOpen(
          closed
            ? new Error('Managed media store is closed.')
            : new DOMException('Media storage opening cancelled.', 'AbortError'),
        );
      };
      attempt.cancel = cancel;
      signal?.addEventListener('abort', cancel, { once: true });
      request.onupgradeneeded = () => {
        // A blocked open request cannot be cancelled directly. If it becomes
        // unblocked after failure/close, abort before committing any schema change.
        if (failed || closed || signal?.aborted) {
          request.transaction.abort();
          rejectOpen(
            signal?.aborted
              ? new DOMException('Media storage opening cancelled.', 'AbortError')
              : new Error('Managed media store is closed.'),
          );
          return;
        }
        try {
          for (const name of storesInUse)
            if (!request.result.objectStoreNames.contains(name))
              request.result.createObjectStore(name);
        } catch (e) {
          request.transaction?.abort();
          rejectOpen(e);
        }
      };
      request.onerror = () => {
        const error = request.error || new Error('Media storage could not open.');
        if (error.name === 'VersionError') {
          const incompatible = new Error(
            'This media library uses a newer storage version. Open the newer game and export it for recovery; do not delete or downgrade the database.',
          );
          incompatible.name = 'VersionError';
          rejectOpen(incompatible);
        } else rejectOpen(error);
      };
      request.onblocked = () => {
        rejectOpen(new Error('Close older game tabs to upgrade media storage.'));
      };
      request.onsuccess = () => {
        const db = request.result;
        signal?.removeEventListener('abort', cancel);
        if (failed || closed || signal?.aborted) {
          db.close();
          rejectOpen(
            signal?.aborted
              ? new DOMException('Media storage opening cancelled.', 'AbortError')
              : new Error('Managed media store is closed.'),
          );
          return;
        }
        db.onversionchange = () => {
          db.close();
          if (opening === attempt) opening = null;
        };
        settled = true;
        resolve(db);
      };
      if (signal?.aborted) cancel();
    }).catch((error) => {
      if (opening === attempt) opening = null;
      throw error;
    });
    return attempt.promise;
  }
  async function transact(mode, body, signal) {
    abort(signal);
    const db = await open(signal);
    abort(signal);
    required(!closed, 'Managed media store is closed.');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storesInUse, mode),
        stores = Object.fromEntries(storesInUse.map((name) => [name, tx.objectStore(name)]));
      let result,
        failure = null,
        settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', cancel);
        if (error) reject(error);
        else resolve(result);
      };
      const fail = (error) => {
        failure = error;
        try {
          tx.abort();
        } catch {
          finish(error);
        }
      };
      const cancel = () => {
        const previous = failure;
        failure = new DOMException('Media operation cancelled.', 'AbortError');
        try {
          tx.abort();
        } catch (e) {
          if (e?.name === 'InvalidStateError') failure = previous;
          else finish(e);
        }
      };
      tx.oncomplete = () => finish(failure);
      tx.onerror = () => {
        failure ??= tx.error;
      };
      tx.onabort = () => finish(failure || tx.error || new Error('Media transaction failed.'));
      signal?.addEventListener('abort', cancel, { once: true });
      const values = {};
      let left = storyMedia ? 9 : 8;
      function read(key, request) {
        request.onsuccess = () => {
          values[key] = request.result;
          if (--left) return;
          try {
            abort(signal);
            const audioRow = row(values.audioRow, 'audio', richStillMedia),
              mediaRow = row(values.mediaRow, 'media', richStillMedia),
              storyRow = storyMedia
                ? row(values.storyRow, 'story', true, mediaRow.library)
                : undefined,
              blobs = new Map();
            let blobBytes = 0;
            for (const [kind, keys, files] of [
              ['audio', values.audioKeys, values.audioBlobs],
              ['mediaBlobs', values.mediaKeys, values.mediaBlobs],
            ]) {
              required(
                keys.length <= MANAGED_MEDIA_LIMITS.assets && keys.length === files.length,
                'Stored media inventory exceeds its budget; recovery required.',
              );
              keys.forEach((key, i) => {
                required(hashValid(key), 'Invalid stored media hash; recovery required.');
                const bytes = size(files[i]);
                required(integer(bytes), 'Invalid stored media bytes; recovery required.');
                blobBytes += bytes;
                const entry = {
                  store: kind,
                  sha256: key,
                  blob: Blob.prototype.slice.call(files[i], 0, bytes),
                  bytes,
                };
                required(!blobs.has(key), 'Duplicate physical media hash; recovery required.');
                blobs.set(key, entry);
              });
            }
            required(
              Array.isArray(values.reservations) &&
                values.reservations.length <= MANAGED_MEDIA_LIMITS.reservations,
              'Invalid stored media reservations.',
            );
            const reservations = values.reservations.map((r) => {
              exactKeys(
                r,
                ['id', 'domain', 'generation', 'maxNewBytes', 'maxMetadataBytes', 'expiresAt'],
                'reservation',
              );
              domainValid(r.domain);
              required(
                typeof r.id === 'string' &&
                  r.id.length <= 128 &&
                  [r.generation, r.maxNewBytes, r.maxMetadataBytes, r.expiresAt].every(integer),
                'Invalid stored reservation.',
              );
              return r;
            });
            validateStoryState(mediaRow.library, storyRow?.library);
            const usedBytes =
              blobBytes +
              encoded(audioRow) +
              encoded(mediaRow) +
              (storyMedia ? encoded(storyRow) : 0) +
              OVERHEAD;
            const state = {
              audioRow,
              mediaRow,
              ...(storyMedia ? { storyRow } : {}),
              blobs,
              blobBytes,
              usedBytes,
              reservations,
              revision: values.state?.revision ?? 0,
            };
            required(integer(state.revision), 'Invalid managed storage revision.');
            result = body(state, stores);
          } catch (e) {
            fail(e);
          }
        };
      }
      try {
        read('audioRow', stores.metadata.get('library'));
        read('mediaRow', stores.mediaRecords.get('library'));
        if (storyMedia) read('storyRow', stores.storyRecords.get('library'));
        read('audioKeys', stores.audio.getAllKeys());
        read('audioBlobs', stores.audio.getAll());
        read('mediaKeys', stores.mediaBlobs.getAllKeys());
        read('mediaBlobs', stores.mediaBlobs.getAll());
        read('reservations', stores.reservations.getAll());
        read('state', stores.managedState.get('ledger'));
        if (signal?.aborted) cancel();
      } catch (e) {
        fail(e);
      }
    });
  }
  const active = (state, t) => state.reservations.filter((r) => r.expiresAt > t);
  const reservationBytes = (rs) =>
    rs.reduce((n, r) => n + r.maxNewBytes + r.maxMetadataBytes + RESERVATION_OVERHEAD, 0);
  function expire(state, stores, t) {
    for (const r of state.reservations) if (r.expiresAt <= t) stores.reservations.delete(r.id);
  }
  function ledger(state, stores, bytes = state.usedBytes) {
    required(
      integer(state.revision + 1),
      'Managed storage revision exhausted; export for recovery.',
    );
    stores.managedState.put(
      { format: 'revealline-managed-state.v1', revision: state.revision + 1, usedBytes: bytes },
      'ledger',
    );
  }
  function snapshot(state, domain) {
    const current = state[`${domain}Row`],
      wanted = hashes(domain, current.library);
    const assets = [...state.blobs.values()]
      .filter((a) => wanted.has(a.sha256))
      .sort((a, b) => a.sha256.localeCompare(b.sha256))
      .map(({ sha256, blob }) => Object.freeze({ sha256, blob }));
    return Object.freeze({ ...current, assets: Object.freeze(assets) });
  }
  async function readDomain(domain, { signal } = {}) {
    domainValid(domain);
    return transact('readonly', (state) => snapshot(state, domain), signal);
  }
  // Runtime reads deliberately avoid the full inventory/ledger path. Writes
  // and admin recovery still use transact() and its complete consistency check.
  async function readSelected(requests, project, signal) {
    abort(signal);
    const db = await open(signal);
    abort(signal);
    required(!closed, 'Managed media store is closed.');
    return new Promise((resolve, reject) => {
      const tx = db.transaction([...new Set(requests.map(([name]) => name))], 'readonly');
      let result,
        failure = null,
        remaining = requests.length;
      const values = [];
      const cancel = () => {
        failure = new DOMException('Media read cancelled.', 'AbortError');
        try {
          tx.abort();
        } catch {}
      };
      const finish = (error) => {
        signal?.removeEventListener('abort', cancel);
        if (error) reject(error);
        else resolve(result);
      };
      tx.oncomplete = () => finish(failure);
      tx.onerror = () => {
        failure ??= tx.error;
      };
      tx.onabort = () => finish(failure || tx.error || new Error('Media read failed.'));
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        requests.forEach(([name, key], index) => {
          const request = tx.objectStore(name).get(key);
          request.onsuccess = () => {
            values[index] = request.result;
            if (--remaining) return;
            try {
              abort(signal);
              required(!closed, 'Managed media store is closed.');
              result = project(values);
            } catch (error) {
              failure = error;
              tx.abort();
            }
          };
        });
        if (signal?.aborted) cancel();
      } catch (error) {
        failure ??= error;
        try {
          tx.abort();
        } catch {
          finish(failure);
        }
      }
    });
  }
  async function readDomainMetadata(domain, { signal } = {}) {
    domainValid(domain);
    return readSelected(
      domain === 'story'
        ? [
            ['storyRecords', 'library'],
            ['mediaRecords', 'library'],
          ]
        : [[recordStore(domain), 'library']],
      ([value, still]) => {
        const media = domain === 'story' ? row(still, 'media', true).library : undefined,
          current = row(value, domain, richStillMedia, media);
        if (domain === 'story') validateStoryState(media, current.library);
        return Object.freeze(current);
      },
      signal,
    );
  }

  /** One readonly transaction fixes poster assignments and movie bindings at the
   * same instant. Selected original bytes are still acquired separately. */
  async function readPresentationMetadata({ signal } = {}) {
    domainValid('story');
    return readSelected(
      [
        ['mediaRecords', 'library'],
        ['storyRecords', 'library'],
      ],
      ([mediaValue, storyValue]) => {
        const media = row(mediaValue, 'media', true),
          story = row(storyValue, 'story', true, media.library);
        validateStoryState(media.library, story.library);
        return Object.freeze({ media: Object.freeze(media), story: Object.freeze(story) });
      },
      signal,
    );
  }

  async function readSelectedBlob(
    hash,
    { signal, maxBytes = MANAGED_MEDIA_LIMITS.sourceBytes } = {},
  ) {
    required(hashValid(hash), 'Invalid media hash.');
    required(
      integer(maxBytes) && maxBytes > 0 && maxBytes <= MANAGED_MEDIA_LIMITS.sourceBytes,
      'Invalid selected media byte budget.',
    );
    return readSelected(
      [
        ['audio', hash],
        ['mediaBlobs', hash],
      ],
      ([audio, media]) => {
        required(
          audio === undefined || media === undefined,
          'Duplicate physical media hash; recovery required.',
        );
        const blob = audio !== undefined ? audio : media;
        if (blob === undefined) return null;
        const bytes = size(blob);
        required(
          integer(bytes) && bytes > 0 && bytes <= maxBytes,
          'Selected media exceeds its byte budget; recovery required.',
        );
        return Blob.prototype.slice.call(blob, 0, bytes);
      },
      signal,
    );
  }
  async function usage({ signal } = {}) {
    return transact(
      'readonly',
      (state) =>
        Object.freeze({
          usedBytes: state.usedBytes,
          reservedBytes: reservationBytes(active(state, clock())),
          limitBytes: MANAGED_MEDIA_LIMITS.bytes,
          generations: Object.freeze({
            audio: state.audioRow.generation,
            media: state.mediaRow.generation,
            ...(storyMedia ? { story: state.storyRow.generation } : {}),
          }),
          reservations: active(state, clock()).length,
        }),
      signal,
    );
  }
  async function reserve({
    domain,
    expectedGeneration,
    maxNewBytes,
    maxMetadataBytes = 0,
    signal,
  } = {}) {
    domainValid(domain);
    required(
      [expectedGeneration, maxNewBytes, maxMetadataBytes].every(integer) &&
        maxNewBytes <= MANAGED_MEDIA_LIMITS.bytes &&
        maxMetadataBytes <= MANAGED_MEDIA_LIMITS.metadataBytes + 1024,
      'Invalid media reservation allowance.',
    );
    const id = globalThis.crypto.randomUUID();
    const result = await transact(
      'readwrite',
      (state, stores) => {
        const t = clock(),
          rs = active(state, t);
        required(state[`${domain}Row`].generation === expectedGeneration, changed(domain));
        required(
          rs.length < MANAGED_MEDIA_LIMITS.reservations,
          'Too many media imports; finish or cancel another operation.',
        );
        required(
          state.usedBytes +
            reservationBytes(rs) +
            maxNewBytes +
            maxMetadataBytes +
            RESERVATION_OVERHEAD <=
            MANAGED_MEDIA_LIMITS.bytes,
          'Committed media plus staging exceeds the 256 MiB managed budget.',
        );
        const record = {
          id,
          domain,
          generation: expectedGeneration,
          maxNewBytes,
          maxMetadataBytes,
          expiresAt: t + MANAGED_MEDIA_LIMITS.leaseMs,
        };
        expire(state, stores, t);
        stores.reservations.put(record, id);
        ledger(state, stores);
        return record;
      },
      signal,
    );
    const handle = Object.freeze({ id: result.id });
    handles.set(handle, result);
    return handle;
  }
  function token(handle) {
    const known = handles.get(handle);
    required(known, 'Unknown media reservation capability.');
    return known;
  }
  async function renew(handle, { signal } = {}) {
    const known = token(handle);
    return transact(
      'readwrite',
      (state, stores) => {
        const t = clock(),
          saved = state.reservations.find((r) => r.id === known.id);
        required(saved && saved.expiresAt > t, 'Media reservation expired; prepare again.');
        required(
          state[`${saved.domain}Row`].generation === saved.generation,
          changed(saved.domain),
        );
        stores.reservations.put(
          { ...saved, expiresAt: t + MANAGED_MEDIA_LIMITS.leaseMs },
          saved.id,
        );
        ledger(state, stores);
        return true;
      },
      signal,
    );
  }
  async function release(handle, { signal } = {}) {
    const known = token(handle);
    return transact(
      'readwrite',
      (state, stores) => {
        stores.reservations.delete(known.id);
        ledger(state, stores);
        return true;
      },
      signal,
    );
  }
  async function commitPreparedDomain(
    domain,
    prepared,
    { expectedGeneration, reservation, signal, otherManagedBytes = 0 } = {},
  ) {
    domainValid(domain);
    if (storyMedia) {
      await loadStoryRecords();
      abort(signal);
    }
    required(
      domain === 'audio'
        ? isPreparedSoundtrackLibrary(prepared)
        : domain === 'story'
          ? storyRecords.isPreparedStoredStories(prepared)
          : preparedMedia.has(prepared) || (richStillMedia && isPreparedStoredStillMedia(prepared)),
      'Commit requires a verified soundtrack import or prepared managed bytes.',
    );
    required(
      integer(expectedGeneration) &&
        integer(expectedGeneration + 1) &&
        integer(otherManagedBytes) &&
        otherManagedBytes <= MANAGED_MEDIA_LIMITS.bytes,
      'Invalid soundtrack generation or managed usage.',
    );
    const assets =
        domain === 'audio' ? ownSoundtrackAssets(prepared.assets) : ownMediaAssets(prepared.assets),
      nextRow = { generation: expectedGeneration + 1, library: prepared.library };
    const before = await transact(
      'readonly',
      (state) => ({ state, current: snapshot(state, domain) }),
      signal,
    );
    required(before.current.generation === expectedGeneration, changed(domain));
    if (domain === 'media') {
      required(
        !isStoredStillMedia(before.current.library) || isStoredStillMedia(prepared.library),
        'Rich still history cannot be downgraded to generic byte storage.',
      );
      if (isStoredStillMedia(prepared.library))
        assertStoredStillTransition(before.current.library, prepared.library);
    }
    if (domain === 'story')
      storyRecords.assertStoredStoryTransition(
        before.current.library,
        prepared.library,
        before.state.mediaRow.library,
      );
    validateStoryState(
      domain === 'media' ? prepared.library : before.state.mediaRow.library,
      domain === 'story' ? prepared.library : before.state.storyRow?.library,
    );
    const reusable = new Set();
    for (const asset of assets) {
      const old = before.state.blobs.get(asset.sha256);
      if (!old || old.bytes !== size(asset.blob)) continue;
      try {
        if (
          (domain === 'audio'
            ? (await inspectMP3(old.blob, { signal })).sha256
            : await digest(old.blob, signal)) === asset.sha256 &&
          old.bytes === size(asset.blob)
        )
          reusable.add(asset.sha256);
      } catch {
        abort(signal);
      }
    }
    const newAssets = assets.filter((a) => !reusable.has(a.sha256)),
      newBytes = newAssets.reduce((n, a) => n + size(a.blob), 0),
      nextMetadataBytes = encoded(nextRow);
    let quota = null;
    try {
      const q = await estimate();
      if (Number.isFinite(q?.quota) && Number.isFinite(q?.usage) && q.quota >= 0 && q.usage >= 0)
        quota = Math.max(0, q.quota - q.usage);
    } catch {}
    abort(signal);
    required(
      quota === null || newBytes + nextMetadataBytes <= quota,
      'There is not enough reported storage space to stage this soundtrack.',
    );
    // Deprecated caller headroom can only refuse; it never replaces the shared inventory.
    required(
      otherManagedBytes +
        before.current.assets.reduce((n, a) => n + size(a.blob), 0) +
        newBytes +
        nextMetadataBytes +
        encoded({ generation: before.current.generation, library: before.current.library }) <=
        MANAGED_MEDIA_LIMITS.bytes,
      'Committed media plus staging exceeds the 256 MiB managed budget.',
    );
    const handle =
        reservation ??
        (await reserve({
          domain,
          expectedGeneration,
          maxNewBytes: newBytes,
          maxMetadataBytes: nextMetadataBytes,
          signal,
        })),
      known = token(handle);
    try {
      return await transact(
        'readwrite',
        (state, stores) => {
          const t = clock(),
            saved = state.reservations.find((r) => r.id === known.id),
            current = state[`${domain}Row`];
          required(saved && saved.expiresAt > t, 'Media reservation expired; prepare again.');
          required(
            saved.domain === domain &&
              saved.generation === expectedGeneration &&
              current.generation === expectedGeneration,
            changed(domain),
          );
          if (domain === 'media') {
            required(
              !isStoredStillMedia(current.library) || isStoredStillMedia(prepared.library),
              'Rich still history cannot be downgraded to generic byte storage.',
            );
            if (isStoredStillMedia(prepared.library))
              assertStoredStillTransition(current.library, prepared.library);
          }
          if (domain === 'story')
            storyRecords.assertStoredStoryTransition(
              current.library,
              prepared.library,
              state.mediaRow.library,
            );
          validateStoryState(
            domain === 'media' ? prepared.library : state.mediaRow.library,
            domain === 'story' ? prepared.library : state.storyRow?.library,
          );
          required(
            newBytes <= saved.maxNewBytes && nextMetadataBytes <= saved.maxMetadataBytes,
            'Prepared media exceeds its reservation.',
          );
          for (const hash of reusable) {
            const old = state.blobs.get(hash),
              prior = before.state.blobs.get(hash);
            required(
              old && old.bytes === prior.bytes && old.store === prior.store,
              'Media assets changed during staging.',
            );
          }
          required(
            state.usedBytes +
              reservationBytes(active(state, t).filter((r) => r.id !== saved.id)) +
              newBytes +
              nextMetadataBytes +
              RESERVATION_OVERHEAD <=
              MANAGED_MEDIA_LIMITS.bytes,
            'Committed media plus staging exceeds the 256 MiB managed budget.',
          );
          const target = domain === 'audio' ? 'audio' : 'mediaBlobs';
          const formerlyOwned = hashes(domain, current.library),
            retained = new Set([
              ...hashes(domain, prepared.library),
              ...domains
                .filter((d) => d !== domain)
                .flatMap((d) => [...hashes(d, state[`${d}Row`].library)]),
            ]);
          // Reads bound each physical store, including unexplained originals.
          // Check the post-commit inventory before writing; reference-table
          // limits alone do not include retained orphans or cross-domain reuse.
          const physical = { audio: 0, mediaBlobs: 0 };
          for (const [hash, old] of state.blobs)
            if (!formerlyOwned.has(hash) || retained.has(hash)) physical[old.store]++;
          for (const asset of newAssets) if (!state.blobs.has(asset.sha256)) physical[target]++;
          required(
            Object.values(physical).every((count) => count <= MANAGED_MEDIA_LIMITS.assets),
            'Managed physical inventory exceeds its budget; retained originals are preserved.',
          );
          for (const { sha256, blob } of newAssets)
            stores[state.blobs.get(sha256)?.store ?? target].put(blob, sha256);
          let finalBlobBytes = state.blobBytes;
          for (const asset of newAssets) {
            const old = state.blobs.get(asset.sha256);
            finalBlobBytes += size(asset.blob) - (old?.bytes ?? 0);
          }
          for (const [hash, old] of state.blobs)
            if (formerlyOwned.has(hash) && !retained.has(hash)) {
              // Remove only records this edit relinquished. Unexplained legacy
              // originals stay counted and available for explicit recovery.
              stores[old.store].delete(hash);
              finalBlobBytes -= old.bytes;
            }
          stores[recordStore(domain)].put(nextRow, 'library');
          stores.reservations.delete(saved.id);
          expire(state, stores, t);
          ledger(
            state,
            stores,
            finalBlobBytes + nextMetadataBytes + metadataBytes(state, domain) + OVERHEAD,
          );
          return Object.freeze(nextRow);
        },
        signal,
      );
    } catch (error) {
      if (reservation === undefined)
        try {
          await release(handle);
        } catch {
          /* The bounded lease still expires. */
        }
      throw error;
    }
  }
  async function commitDomain(domain, prepared, options = {}) {
    const { reservation } = options;
    if (reservation !== undefined) token(reservation);
    try {
      return await commitPreparedDomain(domain, prepared, options);
    } catch (error) {
      // Explicit leases cover preparation as well as the final transaction.
      // A stale generation, aborted verification or quota refusal must release
      // this operation even when it fails before entering the final write.
      if (reservation !== undefined)
        try {
          await release(reservation);
        } catch {
          /* A closed or unavailable store still has a bounded lease. */
        }
      throw error;
    }
  }
  async function removeStoryOriginal(hash, { expectedGeneration, signal } = {}) {
    domainValid('story');
    required(hashValid(hash) && integer(expectedGeneration), 'Invalid story removal.');
    return transact(
      'readwrite',
      (state, stores) => {
        const current = state.storyRow;
        required(current.generation === expectedGeneration, changed('story'));
        required(current.library.originals.includes(hash), 'Story original is already detached.');
        const library = storyRecords.validateStoredStories(
            { ...current.library, originals: current.library.originals.filter((h) => h !== hash) },
            state.mediaRow.library,
          ),
          next = { generation: expectedGeneration + 1, library };
        required(integer(next.generation), 'Story generation exhausted.');
        storyRecords.assertStoredStoryTransition(current.library, library, state.mediaRow.library);
        const retained = new Set([
            ...hashes('audio', state.audioRow.library),
            ...hashes('media', state.mediaRow.library),
          ]),
          old = state.blobs.get(hash);
        if (old && !retained.has(hash)) stores[old.store].delete(hash);
        stores.storyRecords.put(next, 'library');
        ledger(
          state,
          stores,
          state.usedBytes -
            encoded(current) +
            encoded(next) -
            (old && !retained.has(hash) ? old.bytes : 0),
        );
        return Object.freeze(next);
      },
      signal,
    );
  }
  async function readBlob(hash, { signal } = {}) {
    required(hashValid(hash), 'Invalid media hash.');
    return transact('readonly', (state) => state.blobs.get(hash)?.blob ?? null, signal);
  }
  function close() {
    closed = true;
    opening?.cancel?.();
    opening?.promise?.then(
      (db) => db.close(),
      () => {},
    );
  }
  return Object.freeze({
    richStillMedia,
    storyMedia,
    readDomain,
    readDomainMetadata,
    readPresentationMetadata,
    readSelectedBlob,
    usage,
    reserve,
    renew,
    release,
    commitDomain,
    readBlob,
    ...(storyMedia ? { removeStoryOriginal } : {}),
    close,
  });
}
