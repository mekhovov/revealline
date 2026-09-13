import { boundedJSON, canonicalJSON, required } from './data-json.mjs';
import { freezeMedia } from './media-library.mjs';
import { createManagedMediaStore } from './managed-media-store.mjs';
import { createStillMediaStore } from './media-store.mjs';
import { createStoredStillIdentityCatalog } from './media-storage-record.mjs';
import { validateVictoryStory, prepareVictoryStory } from './victory-story.mjs';
import {
  validateStoredStories,
  prepareStoredStories,
  assertStoredStoryTransition,
} from './story-storage-record.mjs';

export const STORY_INVENTORY_FORMAT = 'revealline-story-inventory.v1';
const nativeSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Story storage cancelled.', 'AbortError');
};
const encoded = (value) => new TextEncoder().encode(canonicalJSON(value)).length;
const ownDescriptor = (value) =>
  boundedJSON(value, { maxBytes: 8192, maxArray: 16, maxNodes: 256, maxString: 2048 });
function ownBlob(blob) {
  const bytes = nativeSize.call(blob);
  required(
    bytes > 0 && bytes <= 64 * 1024 * 1024,
    'Story original exceeds the 64 MiB source budget.',
  );
  return Blob.prototype.slice.call(blob, 0, bytes);
}
async function hash(blob, signal) {
  const bytes = await blob.arrayBuffer();
  abort(signal);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  abort(signal);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Explicit v4 capability only. No host chooses this adapter automatically. */
export function createStoryMediaStore({ managedStore, decodeImage, ...options } = {}) {
  const manager = managedStore ?? createManagedMediaStore({ ...options, storyMedia: true });
  required(
    manager.storyMedia === true && manager.richStillMedia === true,
    'Story storage needs the explicit shared v4 manager.',
  );
  const stillStore = createStillMediaStore({ managedStore: manager, decodeImage }),
    operations = new Set(),
    reviews = new WeakMap();
  let closed = false;
  function operation(signal) {
    required(!closed, 'Story store is closed.');
    abort(signal);
    const controller = new AbortController(),
      cancel = () => controller.abort(),
      op = { controller, reservation: null, releasing: null, done: false };
    signal?.addEventListener('abort', cancel, { once: true });
    op.cleanup = () => {
      signal?.removeEventListener('abort', cancel);
      operations.delete(op);
      op.done = true;
    };
    op.release = async () => {
      if (op.releasing) return op.releasing;
      op.releasing = (async () => {
        if (op.reservation)
          try {
            await manager.release(op.reservation);
          } catch {
            /* Bounded lease remains on unavailable storage. */
          }
        op.cleanup();
      })();
      return op.releasing;
    };
    controller.signal.addEventListener(
      'abort',
      () => {
        if (op.reservation) void op.release();
      },
      { once: true },
    );
    operations.add(op);
    if (signal?.aborted) cancel();
    return op;
  }
  async function readMetadata({ signal } = {}) {
    const op = operation(signal);
    try {
      const read = await manager.readDomainMetadata('story', { signal: op.controller.signal });
      return Object.freeze({ generation: read.generation, document: read.library });
    } finally {
      op.cleanup();
    }
  }
  async function stage({ descriptor, blob }, { signal, ...inspection } = {}) {
    // Own all mutable input before storage/decoder awaits.
    const raw = ownDescriptor(descriptor),
      original = ownBlob(blob),
      op = operation(signal),
      active = op.controller.signal;
    try {
      const [current, metadata] = await Promise.all([
        manager.readDomain('story', { signal: active }),
        stillStore.readMetadata({ signal: active }),
      ]);
      const selected = validateVictoryStory(raw, {
        library: metadata.document.library,
        identityCatalog: createStoredStillIdentityCatalog(metadata.document),
      });
      const stories = [...current.library.stories],
        prior = stories.find((s) => s.id === selected.id && s.revision === selected.revision);
      required(
        !prior || canonicalJSON(prior) === canonicalJSON(selected),
        'Immutable story revision conflicts with existing history.',
      );
      if (!prior) stories.push(selected);
      const document = validateStoredStories(
        {
          ...current.library,
          stories,
          originals: [...new Set([...current.library.originals, selected.source.sha256])],
        },
        metadata.document,
      );
      assertStoredStoryTransition(current.library, document, metadata.document);
      const reservation = await manager.reserve({
        domain: 'story',
        expectedGeneration: current.generation,
        maxNewBytes: original.size,
        maxMetadataBytes: encoded({ generation: current.generation + 1, library: document }),
        signal: active,
      });
      if (op.done || active.aborted) {
        try {
          await manager.release(reservation);
        } catch {
          /* Bounded lease on unavailable storage. */
        }
        abort(active);
        throw new Error('Story store is closed.');
      }
      op.reservation = reservation;
      abort(active);
      const assets = new Map(current.assets.map((a) => [a.sha256, a]));
      assets.set(selected.source.sha256, { sha256: selected.source.sha256, blob: original });
      // New binding requires the actual historical poster too; no newer assignment fallback.
      await stillStore.readAsset(metadata, selected.picturePin.assetId, { signal: active });
      const prepared = await prepareStoredStories(document, [...assets.values()], {
        still: metadata.document,
        ...inspection,
        signal: active,
      });
      abort(active);
      const review = freezeMedia({
        format: 'revealline-story-stage.v1',
        expectedGeneration: current.generation,
        document,
        reservedSourceBytes: original.size,
      });
      reviews.set(review, { op, prepared });
      return review;
    } catch (error) {
      await op.release();
      throw error;
    }
  }
  async function commit(review, { signal } = {}) {
    required(!closed, 'Story store is closed.');
    abort(signal);
    const owned = reviews.get(review);
    required(owned && !owned.op.done, 'Prepare this story in this store before committing.');
    reviews.delete(review);
    const { op, prepared } = owned,
      cancel = () => op.controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      abort(op.controller.signal);
      const result = await manager.commitDomain('story', prepared, {
        expectedGeneration: review.expectedGeneration,
        reservation: op.reservation,
        signal: op.controller.signal,
      });
      op.reservation = null;
      return Object.freeze({ generation: result.generation, document: result.library });
    } finally {
      signal?.removeEventListener('abort', cancel);
      await op.release();
    }
  }
  async function cancel(review) {
    const owned = reviews.get(review);
    if (!owned) return false;
    reviews.delete(review);
    owned.op.controller.abort();
    await owned.op.release();
    return true;
  }
  async function acquire({ id, revision, picturePin }, { signal, ...inspection } = {}) {
    const request = boundedJSON({ id, revision, picturePin }, { maxBytes: 8192 }),
      op = operation(signal),
      active = op.controller.signal;
    try {
      const [current, metadata] = await Promise.all([
        manager.readDomainMetadata('story', { signal: active }),
        stillStore.readMetadata({ signal: active }),
      ]);
      const descriptor = current.library.stories.find(
        (s) => s.id === request.id && s.revision === request.revision,
      );
      required(
        descriptor && canonicalJSON(descriptor.picturePin) === canonicalJSON(request.picturePin),
        'Restore the exact story revision and historical poster; current assignments cannot replace them.',
      );
      required(
        current.library.originals.includes(descriptor.source.sha256),
        'Story original was removed. Restore its exact video; the poster remains available.',
      );
      await stillStore.readAsset(metadata, descriptor.picturePin.assetId, { signal: active });
      const blob = await manager.readSelectedBlob(descriptor.source.sha256, {
        signal: active,
        maxBytes: descriptor.source.bytes,
      });
      required(blob, 'Story original is missing. Restore its exact video.');
      return await prepareVictoryStory(
        {
          descriptor,
          blob,
          library: metadata.document.library,
          identityCatalog: createStoredStillIdentityCatalog(metadata.document),
        },
        { ...inspection, signal: active },
      );
    } finally {
      op.cleanup();
    }
  }
  async function removeOriginal(sha256, { expectedGeneration, signal } = {}) {
    const op = operation(signal);
    try {
      return await manager.removeStoryOriginal(sha256, {
        expectedGeneration,
        signal: op.controller.signal,
      });
    } finally {
      op.cleanup();
    }
  }
  /** Verified byte inventory, not a new .rlmedia or complete game backup.
   * Does not require codec support for export/recovery; acquisition does.
   */
  async function exportInventory({ signal } = {}) {
    const op = operation(signal),
      active = op.controller.signal;
    try {
      const current = await manager.readDomain('story', { signal: active });
      required(
        current.assets.length === current.library.originals.length,
        'Restore missing story originals before exporting the complete available inventory.',
      );
      const assets = [];
      for (const item of current.assets) {
        const expected = current.library.stories.find(
          (s) => s.source.sha256 === item.sha256,
        ).source;
        required(
          nativeSize.call(item.blob) === expected.bytes &&
            (await hash(item.blob, active)) === item.sha256,
          'Story export original differs from its exact hash/length.',
        );
        assets.push(Object.freeze({ sha256: item.sha256, blob: ownBlob(item.blob) }));
      }
      abort(active);
      return Object.freeze({
        format: STORY_INVENTORY_FORMAT,
        generation: current.generation,
        document: current.library,
        assets: Object.freeze(assets),
      });
    } finally {
      op.cleanup();
    }
  }
  async function close() {
    closed = true;
    const pending = [...operations];
    pending.forEach((op) => op.controller.abort());
    await Promise.all(pending.map((op) => op.release()));
    stillStore.close();
    if (!managedStore) manager.close();
  }
  return Object.freeze({
    readMetadata,
    stage,
    commit,
    cancel,
    acquire,
    removeOriginal,
    exportInventory,
    close,
  });
}
