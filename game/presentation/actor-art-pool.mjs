/** Page-owned decoded RGBA accounting. Reservations include in-flight decodes;
 * duplicate boards share originals, and abandoned decodes cannot escape the cap. */
export const ACTOR_DECODED_BYTES = 64 * 1024 * 1024;
export const COMPACT_ACTOR_DECODED_BYTES = 32 * 1024 * 1024;
const pages = new WeakMap();
const fallbackPage = {};

// An uninterruptible browser codec still owns its reservation after its last
// caller leaves. A replacement waits for that generation instead of allocating
// the same pixels twice or inheriting the old caller's cancellation.
function waitForRetirement(entry, signal) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new DOMException('Artwork load cancelled.', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    entry.promise.then(
      () => finish(),
      () => finish(),
    );
    if (signal?.aborted) abort();
  });
}

export function createActorArtPool({ limit = ACTOR_DECODED_BYTES } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 4 || limit > ACTOR_DECODED_BYTES)
    throw new TypeError('Invalid actor artwork budget.');
  const entries = new Map();
  let reserved = 0;
  function discard(entry) {
    if (entry.refs || !entry.settled || entries.get(entry.key) !== entry) return;
    entries.delete(entry.key);
    reserved -= entry.bytes;
    entry.image?.close?.();
    entry.image = null;
  }
  function release(entry) {
    entry.refs--;
    if (!entry.refs && !entry.settled) entry.controller.abort();
    discard(entry);
  }
  return Object.freeze({
    stats: () =>
      Object.freeze({
        limit,
        reservedBytes: reserved,
        decodedBytes: [...entries.values()].reduce((sum, e) => sum + (e.image ? e.bytes : 0), 0),
        entries: entries.size,
        leases: [...entries.values()].reduce((sum, e) => sum + e.refs, 0),
      }),
    async acquire({ key, width, height, load, signal }) {
      if (
        typeof key !== 'string' ||
        key.length > 256 ||
        !key ||
        !Number.isSafeInteger(width) ||
        !Number.isSafeInteger(height) ||
        width < 1 ||
        height < 1 ||
        width * height * 4 > limit ||
        typeof load !== 'function'
      )
        throw new TypeError('Invalid decoded actor resource.');
      if (signal?.aborted) throw new DOMException('Artwork load cancelled.', 'AbortError');
      let entry = entries.get(key);
      if (entry && (entry.width !== width || entry.height !== height))
        throw new TypeError('Actor resource identity has conflicting dimensions.');
      while (entry?.controller.signal.aborted) {
        await waitForRetirement(entry, signal);
        if (signal?.aborted) throw new DOMException('Artwork load cancelled.', 'AbortError');
        entry = entries.get(key);
        if (entry && (entry.width !== width || entry.height !== height))
          throw new TypeError('Actor resource identity has conflicting dimensions.');
      }
      if (!entry) {
        const bytes = width * height * 4;
        if (reserved + bytes > limit)
          throw new RangeError('Page actor artwork exceeds its decoded byte budget.');
        entry = {
          key,
          width,
          height,
          bytes,
          refs: 0,
          settled: false,
          image: null,
          controller: new AbortController(),
        };
        reserved += bytes;
        entries.set(key, entry);
        entry.promise = Promise.resolve()
          .then(() => load(entry.controller.signal))
          .then((image) => {
            if (
              (image?.naturalWidth ?? image?.width) !== width ||
              (image?.naturalHeight ?? image?.height) !== height
            ) {
              image?.close?.();
              throw new TypeError('Decoded actor dimensions disagree.');
            }
            entry.image = image;
            return image;
          })
          .finally(() => {
            entry.settled = true;
            discard(entry);
          });
      }
      entry.refs++;
      let active = true;
      const relinquish = () => {
        if (!active) return;
        active = false;
        signal?.removeEventListener('abort', relinquish);
        release(entry);
      };
      signal?.addEventListener('abort', relinquish, { once: true });
      try {
        const image = await entry.promise;
        if (!active) throw new DOMException('Artwork load cancelled.', 'AbortError');
        return Object.freeze({
          image,
          release: relinquish,
          retain() {
            if (!active) throw new TypeError('Actor lease was released.');
            entry.refs++;
            let held = true;
            return () => {
              if (held) {
                held = false;
                release(entry);
              }
            };
          },
        });
      } catch (error) {
        relinquish();
        throw error;
      }
    },
  });
}

export function pageActorArtPool(document = globalThis.document) {
  const owner = document && typeof document === 'object' ? document : fallbackPage;
  if (!pages.has(owner)) {
    const win = document?.defaultView;
    const memory = win?.navigator?.deviceMemory;
    const compact =
      !win ||
      (Number.isFinite(memory) && memory <= 4) ||
      win.matchMedia?.('(pointer: coarse)')?.matches === true;
    pages.set(
      owner,
      createActorArtPool({ limit: compact ? COMPACT_ACTOR_DECODED_BYTES : ACTOR_DECODED_BYTES }),
    );
  }
  return pages.get(owner);
}
