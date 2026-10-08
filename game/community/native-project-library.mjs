import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';

/** Native JSON project modes share atomic local/Community ownership and exact
 * edition recovery. Each mode still owns its validator and storage namespace. */
export function createNativeProjectLibrary(
  { family, label, libraryFormat, maxBytes, validatePackage },
  options = {},
) {
  const identityCheck = (identity) =>
    required(
      typeof identity === 'string' && /^[a-f0-9]{16}$/.test(identity),
      `Invalid ${label} package identity.`,
    );
  const editionCheck = (identity) =>
    required(
      typeof identity === 'string' && /^[a-f0-9]{64}$/.test(identity),
      `Invalid ${label} edition identity.`,
    );
  const communityOwned = (state, identity) =>
    Object.values(state.editions).some(
      (edition) => edition.runtimeIdentity === identity && edition.text !== null,
    );
  const collectUnowned = (state, identity) => {
    if (!state.localOwners[identity] && !communityOwned(state, identity))
      delete state.packages[identity];
  };
  const changed = (state) => {
    required(
      Number.isSafeInteger(state.generation + 1),
      `${label} library generation is exhausted.`,
    );
    state.generation++;
    return state;
  };
  function validateLibrary(source) {
    const value = boundedJSON(source, {
      maxBytes: 8 * 1024 * 1024,
      maxNodes: 240000,
      maxArray: 128,
      maxDepth: 14,
      maxString: maxBytes + 8192,
    });
    exactKeys(
      value,
      ['format', 'packages', 'localOwners', 'editions', 'generation'],
      `${label} library`,
    );
    required(value.format === libraryFormat, `Invalid ${label} library.`);
    exactKeys(value.packages, Object.keys(value.packages ?? {}), `${label} packages`);
    required(Object.keys(value.packages).length <= 16, `The ${label} library is full.`);
    // Legacy Studio installations are user-owned. Migration never drops a local copy.
    if (
      value.localOwners === undefined &&
      value.editions === undefined &&
      value.generation === undefined
    ) {
      value.localOwners = Object.fromEntries(Object.keys(value.packages).map((id) => [id, true]));
      value.editions = {};
      value.generation = 0;
    }
    exactKeys(value.localOwners, Object.keys(value.localOwners ?? {}), `${label} local owners`);
    exactKeys(value.editions, Object.keys(value.editions ?? {}), `${label} editions`);
    required(
      Number.isSafeInteger(value.generation) && value.generation >= 0,
      `Invalid ${label} library generation.`,
    );
    for (const [identity, pack] of Object.entries(value.packages)) {
      identityCheck(identity);
      value.packages[identity] = validatePackage(pack);
      required(
        identity === dataIdentity(value.packages[identity]),
        `Installed ${label} content changed.`,
      );
    }
    for (const [identity, owned] of Object.entries(value.localOwners)) {
      identityCheck(identity);
      required(
        owned === true && Object.hasOwn(value.packages, identity),
        `Invalid ${label} local owner.`,
      );
    }
    required(Object.keys(value.editions).length <= 128, `Too many ${label} edition receipts.`);
    let active = 0;
    for (const [id, edition] of Object.entries(value.editions)) {
      editionCheck(id);
      exactKeys(edition, ['runtimeIdentity', 'text'], `${label} edition`);
      identityCheck(edition.runtimeIdentity);
      required(
        edition.text === null || typeof edition.text === 'string',
        `Invalid ${label} recovery bytes.`,
      );
      if (edition.text !== null) {
        active++;
        required(
          Object.hasOwn(value.packages, edition.runtimeIdentity),
          `${label} edition has no installed project.`,
        );
        required(
          canonicalJSON(validatePackage(edition.text)) ===
            canonicalJSON(value.packages[edition.runtimeIdentity]),
          `${label} recovery bytes differ from the installed project.`,
        );
      }
    }
    required(
      active <= 32,
      `Too many installed ${label} editions. Offload an older Community edition first.`,
    );
    for (const identity of Object.keys(value.packages))
      required(
        value.localOwners[identity] || communityOwned(value, identity),
        `${label} package has no owner.`,
      );
    return value;
  }
  function putPackage(state, pack, identity) {
    required(
      Object.hasOwn(state.packages, identity) || Object.keys(state.packages).length < 16,
      `The ${label} library is full. Export or remove an older package.`,
    );
    required(
      !Object.hasOwn(state.packages, identity) ||
        canonicalJSON(state.packages[identity]) === canonicalJSON(pack),
      `${label} package identity collision.`,
    );
    state.packages[identity] = pack;
  }
  function createLibrary({ backend, ...options } = {}) {
    const store =
      backend ??
      createProfileRecordBackend({
        key: libraryFormat,
        empty: () => ({
          format: libraryFormat,
          packages: {},
          localOwners: {},
          editions: {},
          generation: 0,
        }),
        validate: validateLibrary,
        ...options,
      });
    const read = async () => validateLibrary(await store.read());
    const editionStorage = async (id) => {
      editionCheck(id);
      const state = await read(),
        edition = state.editions[id];
      return edition
        ? {
            installed: edition.text !== null,
            offloaded: edition.text === null,
            manifestRetained: true,
            localCopyRetained: !!state.localOwners[edition.runtimeIdentity],
          }
        : null;
    };
    const exportEdition = async (id) => {
      editionCheck(id);
      const edition = (await read()).editions[id];
      required(edition?.text != null, `This exact ${label} edition is not installed.`);
      const blob = new Blob([edition.text], { type: 'application/json' });
      required(
        (await creatorSHA256(await blob.arrayBuffer())) === id,
        `${label} edition differs from its immutable portable bytes.`,
      );
      return blob;
    };
    return {
      async list() {
        const state = await read();
        return Object.entries(state.packages).map(([identity, pack]) => ({
          identity,
          title: pack.project.title,
          project: pack.project,
          localOwned: !!state.localOwners[identity],
          communityOwned: communityOwned(state, identity),
        }));
      },
      async load(identity) {
        identityCheck(identity);
        const state = await read();
        required(
          Object.hasOwn(state.packages, identity),
          `This ${label} package is not installed in this profile.`,
        );
        return state.packages[identity];
      },
      async install(source) {
        const pack = validatePackage(source),
          identity = dataIdentity(pack);
        await store.update((state) => {
          state = validateLibrary(state);
          putPackage(state, pack, identity);
          state.localOwners[identity] = true;
          return changed(state);
        });
        return identity;
      },
      async remove(identity) {
        identityCheck(identity);
        await store.update((state) => {
          state = validateLibrary(state);
          delete state.localOwners[identity];
          collectUnowned(state, identity);
          return changed(state);
        });
      },
      async installEdition(inspected) {
        required(inspected?.family === family, `Choose an ${label} edition.`);
        const { editionId, runtimeIdentity, text } = inspected;
        editionCheck(editionId);
        identityCheck(runtimeIdentity);
        required(typeof text === 'string', `${label} recovery bytes are required.`);
        const pack = validatePackage(text);
        required(
          dataIdentity(pack) === runtimeIdentity &&
            canonicalJSON(pack) === canonicalJSON(validatePackage(inspected.pack)),
          `${label} inspected content changed.`,
        );
        required(
          (await creatorSHA256(new TextEncoder().encode(text))) === editionId,
          `${label} edition bytes changed.`,
        );
        await store.update((state) => {
          state = validateLibrary(state);
          putPackage(state, pack, runtimeIdentity);
          state.editions[editionId] = { runtimeIdentity, text };
          return validateLibrary(changed(state));
        });
        return { editionId, runtimeIdentity };
      },
      editionStorage,
      exportEdition,
      async editions() {
        return Object.entries((await read()).editions)
          .filter(([, value]) => value.text !== null)
          .map(([id]) => id);
      },
      async reviewEditionOffload(id) {
        const blob = await exportEdition(id),
          state = await read(),
          edition = state.editions[id];
        required(
          edition?.text != null && new Blob([edition.text]).size === blob.size,
          `The ${label} edition changed. Review it again.`,
        );
        return {
          family,
          editionId: id,
          runtimeIdentity: edition.runtimeIdentity,
          generation: state.generation,
          detachableBytes: blob.size,
          detachedAssets: 0,
          localCopyRetained: !!state.localOwners[edition.runtimeIdentity],
        };
      },
      async offloadEdition(review) {
        editionCheck(review.editionId);
        await store.update((state) => {
          state = validateLibrary(state);
          const edition = state.editions[review.editionId];
          required(
            review.family === family &&
              review.generation === state.generation &&
              edition?.text != null &&
              edition.runtimeIdentity === review.runtimeIdentity,
            `The ${label} library changed. Review the removal again.`,
          );
          edition.text = null;
          collectUnowned(state, edition.runtimeIdentity);
          return changed(state);
        });
      },
      dispose() {
        store.close();
      },
    };
  }

  return createLibrary(options);
}
