import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { emptyPackLibrary, importPackLibrary, resolvePackCampaign } from '../packs.mjs';

const profile = 'revealline.library.dev.v1';
export const STILL_AUTHORING_KEYS = Object.freeze({
  writer: `${profile}.writer`,
  lock: `${profile}.backup-lock`,
  journal: `${profile}.backup-journal`,
  packs: 'revealline.packs.dev.v1',
});
const check = (signal) => {
  if (signal?.aborted) throw new DOMException('Catalog check cancelled.', 'AbortError');
};

/** Read only the source game's installed dev channel. Hold its existing locks
 * through a media commit so a pack replacement cannot change its authority.
 */
export function createStillAuthoringCatalog({
  baseEntry,
  storage,
  readAsset,
  lockManager,
  decodeImage,
}) {
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
    return lock(STILL_AUTHORING_KEYS.writer, () =>
      lock(STILL_AUTHORING_KEYS.lock, async () => {
        if (
          storage.getItem(STILL_AUTHORING_KEYS.lock) !== null ||
          (await readAsset(STILL_AUTHORING_KEYS.journal)) !== null
        )
          throw new Error(
            'The source game has a pending backup recovery. Recover it before editing media.',
          );
        const raw = await readAsset(STILL_AUTHORING_KEYS.packs);
        check(signal);
        if (raw !== null && typeof raw !== 'string')
          throw new Error(
            'The installed pack library is unreadable. No empty replacement was made.',
          );
        return work(raw);
      }),
    );
  }
  return Object.freeze({
    async read({ signal } = {}) {
      return locked(async (raw) => {
        const packs =
          raw === null ? emptyPackLibrary() : await importPackLibrary(raw, { decodeImage });
        check(signal);
        const executionCatalog = createExecutionCatalog([
          baseEntry,
          ...packs.packs.flatMap((pack) =>
            pack.campaigns.map((c) => resolvePackCampaign(pack, c.id)),
          ),
        ]);
        const snapshot = Object.freeze({ generation: ++generation, executionCatalog, raw });
        snapshots.add(snapshot);
        return snapshot;
      }, signal);
    },
    async withCurrent(snapshot, work, { signal } = {}) {
      if (!snapshots.has(snapshot)) throw new Error('Reload the installed catalog before saving.');
      return locked(async (raw) => {
        if (snapshot.raw !== raw)
          throw new Error(
            'Installed packs changed. Reload the catalog and review the assignment before saving.',
          );
        check(signal);
        return work();
      }, signal);
    },
  });
}
