import { canonicalJSON, required } from '../data-json.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { ownSoundtrackBlob, throwIfSoundtrackAborted } from '../mp3.mjs';
import {
  resolveSoundtrackLibrary,
  soundtrackStoredTracks,
  setCatalogueTracks,
  SOUNDTRACK_LIMITS,
} from '../soundtrack.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';

/** Shared audio-domain owner; no profile, gameplay or transport-intent writes.
 * Construct the player with readAsset: (hash) => owner.readAsset(hash), then
 * construct this owner before loading or requesting playback. Dispose the
 * player before closing the owner. A supplied catalogue-aware DB5 manager remains borrowed.
 */
export function createCouchMusicLibrary({
  player,
  managedStore,
  indexedDB = globalThis.indexedDB,
  estimate,
  catalogue,
} = {}) {
  required(typeof player?.setLibrary === 'function', 'Couch music requires a soundtrack player.');
  required(
    !managedStore || managedStore.soundtrackCatalogue === true,
    'Couch music requires the shared catalogue/DB5 media store.',
  );
  const ownsManager = !managedStore;
  const manager =
    managedStore ?? createManagedMediaStore({ indexedDB, estimate, soundtrackCatalogue: true });
  const store = createSoundtrackStore({ managedStore: manager });
  const operations = new Set();
  let accepted = null,
    assets = new Map(),
    status = 'idle',
    error = null;
  let closed = false,
    saving = false,
    request = 0;
  const check = () => required(!closed, 'Couch music library is closed.');
  const snapshot = () =>
    Object.freeze({
      status,
      error,
      generation: accepted?.generation ?? null,
      library: accepted?.library ?? null,
    });
  function operation(signal) {
    check();
    throwIfSoundtrackAborted(signal);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    operations.add(controller);
    return {
      signal: controller.signal,
      finish() {
        signal?.removeEventListener('abort', cancel);
        operations.delete(controller);
      },
    };
  }
  function adopt(value) {
    required(
      Number.isSafeInteger(value?.generation) &&
        value.generation >= 0 &&
        value.generation < Number.MAX_SAFE_INTEGER,
      'Invalid Couch music generation.',
    );
    if (accepted && value.generation < accepted.generation) return false;
    const library = resolveSoundtrackLibrary(value.library);
    if (accepted && value.generation === accepted.generation) {
      required(
        canonicalJSON(library) === canonicalJSON(accepted.library),
        'Couch music generation conflict; reload the saved library.',
      );
      // Do not reset an explicit session playlist on a same-generation refresh.
      return false;
    }
    const expected = new Map(
      soundtrackStoredTracks(library).map((track) => [track.asset.sha256, track.asset.bytes]),
    );
    required(
      Array.isArray(value.assets) && value.assets.length === expected.size,
      'Couch music originals are missing or duplicated. Restore the library.',
    );
    const next = new Map();
    let bytes = 0;
    for (const asset of value.assets) {
      required(
        expected.has(asset?.sha256) && !next.has(asset.sha256),
        'Unexpected or duplicate Couch music original.',
      );
      const blob = ownSoundtrackBlob(asset.blob);
      required(
        blob.size === expected.get(asset.sha256),
        'Couch music original has the wrong size. Restore the library.',
      );
      bytes += blob.size;
      required(
        bytes <= SOUNDTRACK_LIMITS.managedBytes,
        'Couch music originals exceed the shared media budget.',
      );
      next.set(asset.sha256, blob);
    }
    // Store reads/prepared commits are the validation boundary. The player also
    // verifies MP3 hash/frames before playback; adoption does not decode an album.
    const previous = assets;
    assets = next;
    try {
      player.setLibrary(catalogue ? setCatalogueTracks(library, catalogue.tracks) : library);
      if (closed)
        throw new DOMException('Couch music library closed during adoption.', 'AbortError');
    } catch (cause) {
      if (!closed) assets = previous;
      throw cause;
    }
    accepted = Object.freeze({ generation: value.generation, library });
    return true;
  }
  function result(adopted) {
    return Object.freeze({ adopted, saved: accepted });
  }
  async function load({ signal } = {}) {
    check();
    required(!saving, 'A music library save is in progress.');
    const op = operation(signal),
      ticket = ++request;
    status = 'loading';
    error = null;
    try {
      const value = await store.read({ signal: op.signal });
      throwIfSoundtrackAborted(op.signal);
      if (ticket !== request) return result(false);
      const adopted = adopt(value);
      status = 'ready';
      return result(adopted);
    } catch (cause) {
      if (!closed && ticket === request) {
        status = 'error';
        error = cause.message;
      }
      throw cause;
    } finally {
      op.finish();
    }
  }
  async function commit(
    prepared,
    { expectedGeneration = accepted?.generation, signal, ...options } = {},
  ) {
    check();
    required(!saving, 'A music library save is in progress.');
    required(
      accepted && expectedGeneration === accepted.generation,
      'The music library changed or has not loaded. Reload before saving.',
    );
    const op = operation(signal),
      ticket = ++request;
    saving = true;
    status = 'saving';
    error = null;
    try {
      const value = await store.commit(prepared, {
        ...options,
        expectedGeneration,
        signal: op.signal,
      });
      throwIfSoundtrackAborted(op.signal);
      const adopted = adopt({ ...value, assets: prepared.assets });
      status = 'ready';
      return result(adopted);
    } catch (cause) {
      if (!closed && ticket === request) {
        status = 'error';
        error = cause.message;
      }
      // A durable store commit cannot be rolled back if the host is then closed
      // or refuses adoption. Reload on recovery; never retry a write silently.
      throw cause;
    } finally {
      saving = false;
      op.finish();
    }
  }
  /** Only for a validated store read or completed prepared-library commit.
   * This synchronous boundary replaces panel metadata adoption, never import
   * validation. Reject older snapshots so the panel also retains its draft.
   */
  function adoptVerifiedSnapshot(value) {
    check();
    required(!saving, 'A music library save is in progress.');
    required(
      !accepted || value?.generation >= accepted.generation,
      'An older music library cannot replace the accepted selection. Reload latest saved.',
    );
    request++;
    try {
      const adopted = adopt(value);
      status = 'ready';
      error = null;
      return result(adopted);
    } catch (cause) {
      if (!closed) {
        status = 'error';
        error = cause.message;
      }
      throw cause;
    }
  }
  return Object.freeze({
    load,
    commit,
    adoptVerifiedSnapshot,
    snapshot,
    readAsset(hash, { allowMissing = false, signal } = {}) {
      check();
      throwIfSoundtrackAborted(signal);
      const blob = assets.get(hash);
      if (!blob && allowMissing) return null;
      required(blob, 'This music original is unavailable. Reload or restore the library.');
      return blob;
    },
    close() {
      if (closed) return;
      closed = true;
      request++;
      status = 'closed';
      error = null;
      for (const controller of operations) controller.abort();
      assets = new Map();
      accepted = null;
      store.close();
      if (ownsManager) manager.close();
    },
  });
}
