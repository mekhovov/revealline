import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import {
  createClassicSnakeCommunityLibrary,
  validateClassicSnakePackage,
  classicSnakePackageIdentity,
} from '../snake/classic-community.mjs';
const FORMAT = 'community-classic-installed.v1';
const empty = () => ({ format: FORMAT, editions: {} });
function validate(source) {
  const state = boundedJSON(source, {
    maxBytes: 26 * 1024 * 1024,
    maxNodes: 180000,
    maxDepth: 8,
    maxString: 1536 * 1024,
  });
  exactKeys(state, ['format', 'editions'], 'Classic installed receipts');
  required(
    state.format === FORMAT &&
      state.editions &&
      typeof state.editions === 'object' &&
      !Array.isArray(state.editions) &&
      Object.keys(state.editions).length <= 16,
    'Invalid Classic installed library.',
  );
  for (const [hash, receipt] of Object.entries(state.editions)) {
    exactKeys(receipt, ['runtimeIdentity', 'title', 'count', 'text'], 'Classic installed receipt');
    required(
      /^[a-f0-9]{64}$/.test(hash) &&
        /^[a-f0-9]{16}$/.test(receipt.runtimeIdentity) &&
        typeof receipt.title === 'string' &&
        receipt.title.length <= 120 &&
        Number.isInteger(receipt.count) &&
        receipt.count >= 1 &&
        receipt.count <= 12 &&
        (receipt.text === null || typeof receipt.text === 'string'),
      'Invalid Classic package receipt.',
    );
    if (receipt.text !== null)
      required(
        classicSnakePackageIdentity(validateClassicSnakePackage(receipt.text)) ===
          receipt.runtimeIdentity,
        'Classic installed recipe changed.',
      );
  }
  return state;
}
/** Exact portable bytes and native recipe ownership remain separate from player progress. */
export function createCommunityClassicInstalled({ indexedDB = globalThis.indexedDB } = {}) {
  const native = createClassicSnakeCommunityLibrary({ indexedDB }),
    backend = createProfileRecordBackend({
      key: FORMAT,
      empty,
      validate,
      indexedDB,
      operationTimeoutMs: 5000,
    });
  async function storage(hash) {
    const state = await backend.read(),
      receipt = state.editions[hash];
    if (!receipt) return null;
    let available = false;
    if (receipt.text !== null) {
      try {
        await native.load(receipt.runtimeIdentity);
        available = true;
      } catch {
        /* Interrupted native installation can be retried from retained bytes. */
      }
    }
    return {
      installed: available,
      offloaded: !available,
      manifestRetained: true,
      runtimeIdentity: receipt.runtimeIdentity,
      playHref: available
        ? `../snake/play.html?community=${receipt.runtimeIdentity}&mode=solo`
        : null,
    };
  }
  return Object.freeze({
    async install(inspected) {
      required(
        inspected.family === 'classic',
        'Classic installation needs its native package validator.',
      );
      const { editionId, runtimeIdentity, text, pack, title, missions } = inspected;
      required(
        (await creatorSHA256(new TextEncoder().encode(text))) === editionId,
        'Classic package bytes changed before installation.',
      );
      await native.install(pack);
      await backend.update((state) => {
        const old = state.editions[editionId];
        required(
          !old || old.runtimeIdentity === runtimeIdentity,
          'An installed edition cannot replace its accepted recipe.',
        );
        state.editions[editionId] = { runtimeIdentity, title, count: missions, text };
        return state;
      });
      return { missions, assets: 0, family: 'classic' };
    },
    storage,
    async list() {
      const state = await backend.read(),
        rows = [];
      for (const hash of Object.keys(state.editions))
        if ((await storage(hash))?.installed) rows.push(hash);
      return rows;
    },
    async export(hash) {
      const state = await backend.read(),
        receipt = state.editions[hash];
      required(
        receipt?.text !== null && typeof receipt?.text === 'string',
        'Classic exact installed bytes are unavailable. Keep the recovery download.',
      );
      const blob = new Blob([receipt.text], { type: 'application/json' });
      required(
        (await creatorSHA256(await blob.arrayBuffer())) === hash,
        'Classic installed bytes do not match their immutable package.',
      );
      await native.load(receipt.runtimeIdentity);
      return blob;
    },
    async reviewOffload(hash) {
      const state = await backend.read(),
        receipt = state.editions[hash];
      required(
        receipt?.text !== null && typeof receipt?.text === 'string',
        'Classic edition is not installed.',
      );
      return {
        generation: hash,
        detachableBytes: new TextEncoder().encode(receipt.text).length,
        detachedAssets: 0,
        family: 'classic',
        editionId: hash,
        runtimeIdentity: receipt.runtimeIdentity,
      };
    },
    async offload(review) {
      const state = await backend.read(),
        receipt = state.editions[review.editionId];
      required(
        receipt &&
          receipt.runtimeIdentity === review.runtimeIdentity &&
          review.generation === review.editionId,
        'Classic edition changed before offload.',
      );
      const retainedByAnother = Object.entries(state.editions).some(
        ([hash, other]) =>
          hash !== review.editionId &&
          other.text !== null &&
          other.runtimeIdentity === receipt.runtimeIdentity,
      );
      if (!retainedByAnother) await native.remove(receipt.runtimeIdentity);
      await backend.update((latest) => {
        const item = latest.editions[review.editionId];
        required(
          item?.runtimeIdentity === review.runtimeIdentity,
          'Classic edition changed during offload.',
        );
        item.text = null;
        return latest;
      });
    },
    close() {
      backend.close();
      native.close();
    },
  });
}
