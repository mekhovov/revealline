import { canonicalJSON, required } from '../data-json.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { installPack, preparePack, PACK_LIMITS } from '../packs.mjs';
import { prepareMissionLibraryIndex } from '../mission-library/classic-source.mjs';
import { verifyIndexedInstalledPack } from '../mission-library/pack-identity.mjs';
import { externalChapterHash } from '../external-chapter.mjs';
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
  missionIndex,
} = {}) {
  required(
    typeof channel === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(channel),
    'Use the exact current Couch profile channel.',
  );
  required(Array.isArray(registeredEntries), 'Provide the registered authored entries.');
  const entries = structuredClone(registeredEntries),
    profileKey = `revealline.library.${channel}.v1`,
    packsKey = `revealline.packs.${channel}.v1`,
    distributionRoot = new URL(baseURL).href,
    indexedMissions = missionIndex === undefined ? null : prepareMissionLibraryIndex(missionIndex);
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
          return (manager ??= createManagedMediaStore({ indexedDB, soundtrackCatalogue: true }));
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

  // Both embedded installers share the same writer/current-snapshot transaction.
  // Only their independently authenticated metadata and transport paths differ.
  function installVerified({ id, name, verify, download }, options) {
    return operation(async ({ item, signal, report, check, host, inspect, decodeImage }) => {
      const reader = host(Object.freeze({ writable: false }));
      report('Checking the installed chapter…', 'verifying');
      const before = await inspect(reader);
      const reuse = async (snapshot) => {
        const pack = snapshot.packs.packs.find((value) => value.id === id);
        if (!pack) return null;
        await verify(pack, { signal });
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
      report(`Downloading and verifying ${name}…`, 'downloading');
      check();
      const pack = await download({ library: before.packs, decodeImage, signal, check });
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
      // installPack permits replacements. Only absent IDs reach this boundary;
      // exact reuse or conflicting editions were resolved against fresh storage.
      const next = installPack(fresh.packs, pack),
        review = await writer.prepareMutation(fresh, next, { signal });
      check();
      report(`Saving ${name}…`, 'saving');
      check();
      const result = await writer.commitMutation(review, { signal });
      // Cancellation after durable publication cannot truthfully undo storage.
      const accepted = result.packs.packs.find((value) => value.id === id);
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
  }

  async function indexedBytes(row, { signal, check }) {
    const base = new URL(distributionRoot),
      url = new URL(row.sourceFile.path, base);
    required(
      ['http:', 'https:'].includes(base.protocol) &&
        !base.username &&
        !base.password &&
        !base.search &&
        !base.hash &&
        base.pathname.endsWith('/') &&
        url.origin === base.origin &&
        url.href.startsWith(base.href),
      'Indexed downloads require this game’s same-origin HTTP release directory.',
    );
    const response = await request(url.href, {
      signal,
      redirect: 'error',
      credentials: 'same-origin',
    });
    check();
    required(
      response.ok,
      `Chapter download unavailable (HTTP ${response.status}). Retry when connected.`,
    );
    required(
      !response.redirected && (!response.url || response.url === url.href),
      'Indexed chapter download left its exact release URL.',
    );
    const maximum = row.sourceFile.bytes,
      length = response.headers.get('content-length');
    required(
      length === null || (/^\d+$/.test(length) && Number(length) <= maximum),
      'Chapter response exceeds its published byte budget.',
    );
    required(
      response.body?.getReader,
      'Bounded chapter downloads are unavailable in this browser.',
    );
    const reader = response.body.getReader(),
      parts = [];
    let total = 0,
      finished = false;
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      for (;;) {
        check();
        const result = await reader.read();
        check();
        if (result.done) {
          finished = true;
          break;
        }
        total += result.value.byteLength;
        required(total <= maximum, 'Chapter response exceeds its published byte budget.');
        parts.push(result.value);
      }
    } finally {
      signal.removeEventListener('abort', cancel);
      if (!finished) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    required(total === maximum, 'Chapter download is incomplete. Nothing was installed.');
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    required(
      (await externalChapterHash(bytes)) === row.sourceFile.sha256,
      'Chapter checksum differs. Nothing was installed; retry from the matching release.',
    );
    check();
    return bytes;
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
      return installVerified(
        {
          id: checked.id,
          name: checked.name,
          verify: (pack, context) => verifyOptionalInstalled(pack, checked, context),
          download: ({ library, decodeImage, signal }) =>
            prepareOptionalDownload(checked, {
              library,
              decodeImage,
              baseURL: distributionRoot,
              fetch: request,
              signal,
            }),
        },
        options,
      );
    },
    async installIndexed(row, options) {
      // An imported row cannot nominate another source or weaken published pins.
      // Capture and compare before any asynchronous boundary.
      const supplied = prepareMissionLibraryIndex({
        format: 'revealline-mission-library-index.v1',
        missions: [row],
      }).missions[0];
      const checked = indexedMissions?.missions.find((item) => item.id === supplied.id);
      required(
        checked && canonicalJSON(checked) === canonicalJSON(supplied),
        'Choose an exact mission from this release’s trusted index.',
      );
      required(
        ['bundled', 'archived'].includes(checked.source),
        'This indexed installer supports only bundled and archived chapters.',
      );
      required(
        /^[a-z0-9][a-z0-9-]{0,95}$/.test(checked.packId) &&
          checked.sourceFile.path === `game/content/packs/${checked.packId}.json` &&
          checked.sourceFile.bytes <= PACK_LIMITS.maxBytes &&
          checked.packIdentity.bytes <= PACK_LIMITS.maxBytes,
        'Indexed chapter must name its exact bounded distribution file.',
      );
      const peers = indexedMissions.missions.filter((item) => item.packId === checked.packId);
      required(
        peers.every(
          (item) =>
            item.source === checked.source &&
            canonicalJSON(item.sourceFile) === canonicalJSON(checked.sourceFile) &&
            canonicalJSON(item.packIdentity) === canonicalJSON(checked.packIdentity) &&
            item.packVersion === checked.packVersion,
        ),
        'The indexed chapter contains conflicting published identities.',
      );
      const verify = async (pack, { signal }) => {
        if (signal.aborted) throw cancelled();
        const exact = await Promise.all(
          peers.map((item) => verifyIndexedInstalledPack(pack, item)),
        );
        if (signal.aborted) throw cancelled();
        required(
          exact.every(Boolean) &&
            pack.campaigns.reduce((count, campaign) => count + campaign.levels.length, 0) ===
              peers.length &&
            new Set(peers.map((item) => JSON.stringify([item.campaignId, item.levelIndex])))
              .size === peers.length,
          'A different edition of this chapter is installed or downloaded. Existing content was not replaced.',
        );
        return pack;
      };
      return installVerified(
        {
          id: checked.packId,
          name: checked.campaignTitle,
          verify,
          download: async ({ library, decodeImage, signal, check }) => {
            const bytes = await indexedBytes(checked, { signal, check });
            const source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
            const prepared = await preparePack(source, { library, decodeImage });
            check();
            return verify(prepared.pack, { signal });
          },
        },
        options,
      );
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
