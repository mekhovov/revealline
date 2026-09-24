import { required } from '../data-json.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { approveCreatorBundle, importCreatorBundle } from '../creator/bundle.mjs';
import {
  exportInstalledCreatorBundle,
  installedCreatorManifests,
  installPreparedCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import { creatorAttemptKey, creatorProfileKey } from '../creator/runtime.mjs';
import { validateCommunityEdition } from './client.mjs';

const packageHash = async (blob) => creatorSHA256(await blob.arrayBuffer());
const association = (state, id) => state.editions.find((item) => item.editionId === id);
const removalReviews = new WeakMap();

/** Coordinates immutable catalog metadata with the existing exact creator
 * validator and atomic creator store. It never interprets server approval as
 * local proof that bytes are playable. */
export function createCommunityLibrary({
  client,
  creatorStore,
  stateStore,
  downloadStore,
  decodeImage,
}) {
  required(
    client && creatorStore && stateStore && downloadStore,
    'Community library adapters are required.',
  );
  const verifyPackage = async (edition, blob) => {
    const safe = validateCommunityEdition(edition);
    required(blob.size === safe.packageSize, 'Package size differs from its published edition.');
    required(
      (await packageHash(blob)) === safe.packageSha256,
      'Package hash differs from its published edition.',
    );
    return importCreatorBundle(blob, { decodeImage });
  };
  const installedSet = async () =>
    new Set((await installedCreatorManifests(creatorStore)).map((item) => item.editionId));
  async function status(editionId) {
    const state = stateStore.read();
    const linked = association(state, editionId);
    const installed = linked ? (await installedSet()).has(linked.creatorEditionId) : false;
    const packageRetained = !!(await downloadStore.get(editionId));
    return Object.freeze({
      editionId,
      installed,
      offlinePlayable: installed,
      creatorEditionId: linked?.creatorEditionId ?? null,
      attemptKey: linked ? creatorAttemptKey(linked.creatorEditionId) : null,
      profileKey: linked ? creatorProfileKey(linked.creatorEditionId) : null,
      packageRetained,
      exactRecoveryAvailable: packageRetained || installed,
      playHref: installed
        ? `../creator/player.html?edition=${encodeURIComponent(linked.creatorEditionId)}`
        : null,
    });
  }
  async function installBytes(edition, blob) {
    const safe = validateCommunityEdition(edition);
    const prepared = await verifyPackage(safe, blob);
    const approval = approveCreatorBundle(prepared);
    const review = await reviewCreatorInstallation(creatorStore, prepared, approval);
    // Cache and journal the exact association before the media commit. If the
    // final commit is interrupted, the catalog shows a retained package ready
    // to retry. If the last journal write fails, status still discovers the
    // committed manifest by its immutable creator edition identity.
    await downloadStore.put(safe.editionId, blob);
    const state = stateStore.read();
    const staged = {
      editionId: safe.editionId,
      creatorEditionId: prepared.editionId,
      collectionId: safe.collectionId,
      slug: safe.slug,
      version: safe.version,
      packageSha256: safe.packageSha256,
      installation: 'staged',
      installedAt: null,
    };
    state.editions = [
      ...state.editions.filter((item) => item.editionId !== safe.editionId),
      staged,
    ];
    stateStore.write(state);
    await installPreparedCreatorBundle(creatorStore, prepared, approval, review, { decodeImage });
    state.editions = state.editions.map((item) =>
      item.editionId === safe.editionId
        ? {
            ...item,
            installation: 'installed',
            installedAt: new Date().toISOString(),
          }
        : item,
    );
    let journalComplete = true;
    try {
      stateStore.write(state);
    } catch {
      journalComplete = false;
    }
    return Object.freeze({
      editionId: safe.editionId,
      creatorEditionId: prepared.editionId,
      review,
      journalComplete,
    });
  }
  return Object.freeze({
    async catalog({ query = '', installed = 'all', cursor = null, limit = 20 } = {}) {
      required(['all', 'installed', 'available'].includes(installed), 'Catalog filter is invalid.');
      const page = await client.catalog({ query, cursor, limit });
      const state = stateStore.read();
      const local = await installedSet();
      const needle = query.trim().toLocaleLowerCase();
      const rows = [];
      for (const edition of page.editions) {
        const linked = association(state, edition.editionId);
        const isInstalled = !!linked && local.has(linked.creatorEditionId);
        const installedCollection = edition.collectionId
          ? state.editions.filter(
              (item) =>
                item.collectionId === edition.collectionId && local.has(item.creatorEditionId),
            )
          : [];
        const latestLink = edition.latestEditionId
          ? association(state, edition.latestEditionId)
          : null;
        const latestInstalled = !!latestLink && local.has(latestLink.creatorEditionId);
        const updateTarget =
          !isInstalled &&
          edition.collectionId !== null &&
          edition.latestEditionId === edition.editionId &&
          installedCollection.length > 0 &&
          !latestInstalled;
        if (installed === 'installed' && !isInstalled) continue;
        if (installed === 'available' && isInstalled) continue;
        if (
          needle &&
          !`${edition.title}\n${edition.description}\n${edition.slug}`
            .toLocaleLowerCase()
            .includes(needle)
        )
          continue;
        rows.push(
          Object.freeze({
            ...edition,
            installed: isInstalled,
            creatorEditionId: linked?.creatorEditionId ?? null,
            attemptKey: linked ? creatorAttemptKey(linked.creatorEditionId) : null,
            profileKey: linked ? creatorProfileKey(linked.creatorEditionId) : null,
            playHref: isInstalled
              ? `../creator/player.html?edition=${encodeURIComponent(linked.creatorEditionId)}`
              : null,
            updateAvailable:
              (isInstalled &&
                !!edition.latestEditionId &&
                edition.latestEditionId !== edition.editionId &&
                !latestInstalled) ||
              updateTarget,
            latest:
              edition.latestEditionId === null || edition.latestEditionId === edition.editionId,
            offlinePlayable: isInstalled,
            packageRetained: !!(await downloadStore.get(edition.editionId)),
          }),
        );
      }
      return Object.freeze({
        editions: Object.freeze(rows),
        nextCursor: page.nextCursor,
      });
    },
    async preview(edition) {
      return client.preview(validateCommunityEdition(edition));
    },
    async report(editionId, report) {
      return client.reportEdition(editionId, report);
    },
    async install(edition, { offline = true } = {}) {
      const safe = validateCommunityEdition(edition);
      const retained = await downloadStore.get(safe.editionId);
      if (retained) return installBytes(safe, retained);
      required(
        !offline,
        'This package is not retained for offline installation. Connect and download it again.',
      );
      return installBytes(safe, await client.download(safe));
    },
    /** Proves that the installed runtime can reproduce the exact published
     * bytes before allowing its separate recovery download to be removed. */
    async reviewDownloadRemoval(edition) {
      const safe = validateCommunityEdition(edition);
      const retained = await downloadStore.get(safe.editionId);
      required(retained, 'This edition has no retained recovery download.');
      await verifyPackage(safe, retained);
      const current = await status(safe.editionId);
      required(
        current.installed && current.creatorEditionId,
        'Keep the exact recovery package until this edition is installed and verifies locally.',
      );
      const reconstructed = await exportInstalledCreatorBundle(
        creatorStore,
        current.creatorEditionId,
        { decodeImage },
      );
      await verifyPackage(safe, reconstructed);
      const review = Object.freeze({
        editionId: safe.editionId,
        creatorEditionId: current.creatorEditionId,
        packageSha256: safe.packageSha256,
        recoverySource: 'installed-runtime',
      });
      removalReviews.set(review, { retained, safe });
      return review;
    },
    /** Removes only the separately retained recovery package. The exact
     * installed manifest/media, saved attempts, progress and earned receipts
     * use separate authorities and remain untouched. */
    async removeDownload(edition, review) {
      const safe = validateCommunityEdition(edition);
      const approved = removalReviews.get(review);
      required(
        approved &&
          approved.safe.editionId === safe.editionId &&
          review.editionId === safe.editionId &&
          review.packageSha256 === safe.packageSha256,
        'Review exact recovery before removing this download.',
      );
      removalReviews.delete(review);
      const retained = await downloadStore.get(safe.editionId);
      required(
        retained && (await packageHash(retained)) === safe.packageSha256,
        'The retained package changed. Review removal again.',
      );
      const current = await status(safe.editionId);
      required(
        current.installed && current.creatorEditionId === review.creatorEditionId,
        'The installed edition changed. Review removal again.',
      );
      await downloadStore.remove(safe.editionId);
      return status(safe.editionId);
    },
    async retainFromInstalled(edition) {
      const safe = validateCommunityEdition(edition);
      const state = stateStore.read();
      const linked = association(state, safe.editionId);
      required(linked, 'This community edition has not been installed on this device.');
      const blob = await exportInstalledCreatorBundle(creatorStore, linked.creatorEditionId, {
        decodeImage,
      });
      await verifyPackage(safe, blob);
      await downloadStore.put(safe.editionId, blob);
      return status(safe.editionId);
    },
    status,
  });
}
