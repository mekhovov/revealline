import { required } from '../data-json.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { approveCreatorBundle, importCreatorBundle } from '../creator/bundle.mjs';
import {
  exportInstalledCreatorBundle,
  installedCreatorManifests,
  installPreparedCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import { validateCommunityEdition } from './client.mjs';

const compareVersion = (a, b) => {
  const parts = (value) => value.split(/[.-]/u).map((part) => (/^\d+$/u.test(part) ? +part : part));
  const left = parts(a),
    right = parts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const x = left[index] ?? 0,
      y = right[index] ?? 0;
    if (x === y) continue;
    if (typeof x === typeof y) return x < y ? -1 : 1;
    return typeof x === 'number' ? 1 : -1;
  }
  return 0;
};
const packageHash = async (blob) => creatorSHA256(await blob.arrayBuffer());
const association = (state, id) => state.editions.find((item) => item.editionId === id);

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
    return Object.freeze({
      editionId,
      installed,
      creatorEditionId: linked?.creatorEditionId ?? null,
      packageRetained: !!(await downloadStore.get(editionId)),
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
        ? { ...item, installation: 'installed', installedAt: new Date().toISOString() }
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
    async catalog({ query = '', installed = 'all' } = {}) {
      const page = await client.catalog();
      const state = stateStore.read();
      const local = await installedSet();
      const needle = query.trim().toLocaleLowerCase();
      const newest = new Map();
      for (const edition of page.editions) {
        const current = newest.get(edition.slug);
        if (!current || compareVersion(current.version, edition.version) < 0)
          newest.set(edition.slug, edition);
      }
      const rows = [];
      for (const edition of page.editions) {
        const linked = association(state, edition.editionId);
        const isInstalled = !!linked && local.has(linked.creatorEditionId);
        const latestEdition = newest.get(edition.slug);
        const latestLink = association(state, latestEdition.editionId);
        const latestInstalled = !!latestLink && local.has(latestLink.creatorEditionId);
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
            playHref: isInstalled
              ? `../creator/player.html?edition=${encodeURIComponent(linked.creatorEditionId)}`
              : null,
            updateAvailable:
              isInstalled && latestEdition.editionId !== edition.editionId && !latestInstalled,
            latest: latestEdition.editionId === edition.editionId,
            packageRetained: !!(await downloadStore.get(edition.editionId)),
          }),
        );
      }
      return Object.freeze({
        editions: Object.freeze(rows),
        nextCursor: page.nextCursor,
      });
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
    /** Removes only the separately retained recovery download. Installed bytes,
     * manifests, local attempts, progress and earned-picture receipts remain. */
    async removeDownload(editionId) {
      await downloadStore.remove(editionId);
      return status(editionId);
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
