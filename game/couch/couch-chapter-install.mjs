import { required } from '../data-json.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { installPack } from '../packs.mjs';
import {
  OPTIONAL_CATALOG_FORMAT,
  prepareOptionalCatalog,
  prepareOptionalDownload,
  verifyOptionalInstalled,
} from '../optional-chapters.mjs';

const cancelled = () => new DOMException('Chapter installation cancelled.', 'AbortError');

/** Explicit embedded-chapter installation only. Browsing and racing retain their
 * separate read-only owner; this service never writes Solo progress or pictures.
 */
export function createCouchChapterInstaller({
  channel,
  registeredEntries,
  indexedDB = globalThis.indexedDB,
  storage = globalThis.localStorage,
  lockManager = globalThis.navigator?.locks,
  ImageClass = globalThis.Image,
  URLImpl = globalThis.URL,
  baseURL = new URL('../../', import.meta.url),
  fetch: request = globalThis.fetch,
} = {}) {
  required(
    typeof channel === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(channel),
    'Use the exact current Couch profile channel.',
  );
  required(Array.isArray(registeredEntries), 'Provide the registered authored entries.');
  const entries = structuredClone(registeredEntries),
    profileKey = `revealline.library.${channel}.v1`,
    packsKey = `revealline.packs.${channel}.v1`;
  let active = null,
    disposed = false,
    manager = null;

  function operation(work, { signal, onStatus = () => {} } = {}) {
    if (disposed || signal?.aborted) return Promise.reject(cancelled());
    if (active) return Promise.reject(new Error('Another chapter operation is still finishing.'));
    const controller = new AbortController(),
      item = { controller, hosts: new Set(), writer: null };
    active = item;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const check = () => {
      if (disposed || active !== item || controller.signal.aborted) throw cancelled();
    };
    const report = (message, stage = 'checking') => {
      if (disposed || active !== item || controller.signal.aborted) return;
      try {
        onStatus({ message, stage, progress: null });
      } catch {
        // An observer cannot change verification or durable installation.
      }
    };
    const release = (image) => {
      image?.removeAttribute?.('src');
      image?.close?.();
    };
    const decode = (source) => {
      check();
      required(typeof ImageClass === 'function', 'Browser picture decoding is unavailable.');
      return new Promise((resolve, reject) => {
        const image = new ImageClass();
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', stop);
          image.onload = image.onerror = null;
          if (error) {
            release(image);
            reject(error);
          } else resolve(image);
        };
        const stop = () => finish(cancelled()),
          timer = setTimeout(() => finish(new Error('Chapter picture decode timed out.')), 15000);
        controller.signal.addEventListener('abort', stop, { once: true });
        image.onerror = () => finish(new Error('The chapter picture could not decode.'));
        image.onload = async () => {
          try {
            required(
              typeof image.decode === 'function',
              'Complete picture decoding is unavailable.',
            );
            await image.decode();
            check();
            finish();
          } catch (error) {
            finish(error);
          }
        };
        if (controller.signal.aborted) return stop();
        try {
          image.src = source;
        } catch (error) {
          finish(error);
        }
      });
    };
    // preparePack passes role/scope, not AbortSignal. Always use this operation's
    // signal, including inspection's validation of previously installed images.
    const decodeImage = async (source) => {
      let image = null,
        url = null;
      try {
        check();
        report('Checking complete chapter pictures…', 'decoding');
        check();
        if (typeof source !== 'string') {
          url = URLImpl.createObjectURL(source);
          source = url;
        }
        image = await decode(source);
        check();
        return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
      } finally {
        release(image);
        if (url !== null) URLImpl.revokeObjectURL(url);
      }
    };
    const host = (writer) => {
      check();
      const owner = createExternalChapterHost({
        indexedDB,
        profileKey,
        packsKey,
        storage,
        lockManager,
        writer,
        registeredEntries: entries,
        knownDescriptors: SOURCE_EXTERNAL_CHAPTERS,
        getManagedStore: () => {
          check();
          return (manager ??= createManagedMediaStore({ indexedDB, storyMedia: true }));
        },
        decodeImage,
      });
      item.hosts.add(owner);
      return owner;
    };
    const inspect = async (owner) => {
      const snapshot = await owner.inspect({ signal: controller.signal });
      check();
      required(
        snapshot.status === 'checked',
        `Installed chapters need ${snapshot.reason || 'recovery'} before downloading. Existing data is kept.`,
      );
      return snapshot;
    };
    return Promise.resolve()
      .then(() => {
        check();
        return work({ item, signal: controller.signal, check, report, host, inspect, decodeImage });
      })
      .finally(() => {
        signal?.removeEventListener('abort', abort);
        // Keep the real writing lease until its native transaction has settled.
        // A committed install must not be described as rolled back by cancellation.
        for (const owner of item.hosts) owner.close();
        item.writer?.release();
        if (active === item) active = null;
        if (disposed) manager?.close();
      });
  }

  return Object.freeze({
    inspect(options) {
      return operation(async ({ host, inspect, report, check }) => {
        report('Checking installed chapters…', 'verifying');
        const snapshot = await inspect(host(Object.freeze({ writable: false })));
        check();
        return Object.freeze({ library: snapshot.packs, usage: snapshot.usage });
      }, options);
    },
    async install(summary, options) {
      // Capture exact metadata synchronously, before any caller can change it.
      const checked = prepareOptionalCatalog({ format: OPTIONAL_CATALOG_FORMAT, packs: [summary] })
        .packs[0];
      return operation(async ({ item, signal, report, check, host, inspect, decodeImage }) => {
        const reader = host(Object.freeze({ writable: false }));
        report('Checking the installed chapter…', 'verifying');
        const before = await inspect(reader);
        const reuse = async (snapshot) => {
          const pack = snapshot.packs.packs.find((value) => value.id === checked.id);
          if (!pack) return null;
          await verifyOptionalInstalled(pack, checked, { signal });
          check();
          return Object.freeze({
            pack,
            library: snapshot.packs,
            usage: snapshot.usage,
            committed: false,
            reused: true,
          });
        };
        const existing = await reuse(before);
        if (existing) return existing;
        report(`Downloading and verifying ${checked.name}…`, 'downloading');
        check();
        const pack = await prepareOptionalDownload(checked, {
          library: before.packs,
          decodeImage,
          baseURL,
          fetch: request,
          signal,
        });
        check();
        reader.close();
        report('Reserving safe chapter installation…', 'verifying');
        check();
        item.writer = await claimProfileWriter(lockManager, `${profileKey}.writer`);
        check();
        required(
          item.writer.writable,
          'Chapter installation cannot reserve this profile. Close the other saving tab or restore Web Locks, then retry. Your Couch match is kept.',
        );
        const writer = host(item.writer),
          fresh = await inspect(writer),
          installedMeanwhile = await reuse(fresh);
        if (installedMeanwhile) return installedMeanwhile;
        // installPack permits replacements. This path only adds an absent ID;
        // exact reuse and conflicting editions were handled above.
        const next = installPack(fresh.packs, pack),
          review = await writer.prepareMutation(fresh, next, { signal });
        check();
        report(`Saving ${checked.name}…`, 'saving');
        check();
        const result = await writer.commitMutation(review, { signal });
        // No post-commit abort check: launch cancellation does not undo storage.
        const accepted = result.packs.packs.find((value) => value.id === checked.id);
        report('Chapter installed.', 'ready');
        return Object.freeze({
          pack: accepted,
          library: result.packs,
          usage: Object.freeze({
            ...fresh.usage,
            packBytes: new TextEncoder().encode(result.packLibrary).length,
          }),
          committed: true,
          reused: false,
        });
      }, options);
    },
    cancel() {
      active?.controller.abort();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active?.controller.abort();
      if (!active) manager?.close();
    },
  });
}
