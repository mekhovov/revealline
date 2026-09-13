import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import {
  emptyPackLibrary,
  importPackLibrary,
  resolvePackCampaign,
  exportPackLibrary,
} from '../packs.mjs';
import { required } from '../data-json.mjs';

export function stillAuthoringKeys(channel = 'dev') {
  required(
    typeof channel === 'string' &&
      (channel === 'dev' ||
        /^release-v?(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.test(channel)),
    'Unsupported still workshop game channel.',
  );
  const profile = `revealline.library.${channel}.v1`;
  return Object.freeze({
    writer: `${profile}.writer`,
    lock: `${profile}.backup-lock`,
    journal: `${profile}.backup-journal`,
    packs: `revealline.packs.${channel}.v1`,
  });
}
export const STILL_AUTHORING_KEYS = stillAuthoringKeys();
const check = (signal) => {
  if (signal?.aborted) throw new DOMException('Catalog check cancelled.', 'AbortError');
};

/** Read only the explicit game channel (source dev by default). Hold its existing locks
 * through a media commit so a pack replacement cannot change its authority.
 */
export function createStillAuthoringCatalog({
  baseEntry,
  storage,
  readAsset,
  lockManager,
  decodeImage,
  channel = 'dev',
  getManagedStore,
  indexedDB = globalThis.indexedDB,
}) {
  const keys = stillAuthoringKeys(channel);
  const snapshots = new WeakSet();
  let generation = 0;
  async function locked(work, signal) {
    check(signal);
    if (!lockManager?.request)
      throw new Error(
        'Safe catalog access needs Web Locks. Use a supported browser on localhost or HTTPS.',
      );
    const lock = (name, next) =>
      lockManager.request(name, { ifAvailable: true }, async (held) => {
        check(signal);
        if (!held)
          throw new Error(
            'Close the source game and finish its pack or backup operation, then retry.',
          );
        return next();
      });
    return lock(keys.writer, async () => {
      if (getManagedStore) {
        const host = createExternalChapterHost({
          indexedDB,
          profileKey: keys.writer.slice(0, -'.writer'.length),
          packsKey: keys.packs,
          storage,
          lockManager,
          writer: { writable: true },
          getManagedStore,
          registeredEntries: [baseEntry],
          decodeImage,
          knownDescriptors: SOURCE_EXTERNAL_CHAPTERS,
        });
        try {
          const snapshot = await host.inspect({ signal });
          if (snapshot.status !== 'checked')
            throw new Error(
              `The game needs ${snapshot.reason}. Recover its exact files before editing media.`,
            );
          return await host.withCurrent(
            snapshot,
            () => work(exportPackLibrary(snapshot.packs), snapshot),
            { signal },
          );
        } finally {
          host.close();
        }
      }
      return lock(keys.lock, async () => {
        if (storage.getItem(keys.lock) !== null || (await readAsset(keys.journal)) !== null)
          throw new Error(
            'The source game has a pending backup recovery. Recover it before editing media.',
          );
        const profile = keys.writer.slice(0, -'.writer'.length);
        if (
          (await readAsset(`${profile}.external-chapter-index.v1`)) !== null ||
          (await readAsset(`${profile}.external-chapter-journal.v1`)) !== null
        )
          throw new Error(
            'External chapters need the compatible shared-media Workshop before editing.',
          );
        const raw = await readAsset(keys.packs);
        check(signal);
        if (raw !== null && typeof raw !== 'string')
          throw new Error(
            'The installed pack library is unreadable. No empty replacement was made.',
          );
        return work(raw);
      });
    });
  }
  return Object.freeze({
    channel,
    keys,
    async read({ signal } = {}) {
      return locked(async (raw, external) => {
        const packs =
          raw === null ? emptyPackLibrary() : await importPackLibrary(raw, { decodeImage });
        check(signal);
        const executionCatalog =
          external?.executionCatalog ??
          createExecutionCatalog([
            baseEntry,
            ...packs.packs.flatMap((pack) =>
              pack.campaigns.map((c) => resolvePackCampaign(pack, c.id)),
            ),
          ]);
        const snapshot = Object.freeze({
          generation: ++generation,
          executionCatalog,
          raw,
          external: external ? canonicalJSON(external.index) : null,
        });
        snapshots.add(snapshot);
        return snapshot;
      }, signal);
    },
    async withCurrent(snapshot, work, { signal } = {}) {
      if (!snapshots.has(snapshot)) throw new Error('Reload the installed catalog before saving.');
      return locked(async (raw, external) => {
        if (
          snapshot.raw !== raw ||
          snapshot.external !== (external ? canonicalJSON(external.index) : null)
        )
          throw new Error(
            'Installed packs changed. Reload the catalog and review the assignment before saving.',
          );
        check(signal);
        return work();
      }, signal);
    },
  });
}
