import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import {
  compileOverflightProject,
  validateOverflightProject,
  OVERFLIGHT_PROJECT_MAX_BYTES,
} from './project.mjs';

export const OVERFLIGHT_PACKAGE_FORMAT = 'revealline-overflight-package.v1';
const LIBRARY_FORMAT = 'revealline-overflight-library.v1';
export function createOverflightPackage(project) {
  const accepted = validateOverflightProject(project);
  return {
    format: OVERFLIGHT_PACKAGE_FORMAT,
    project: accepted,
    dependencies: structuredClone(accepted.resources),
  };
}
export function validateOverflightPackage(source) {
  const pack = boundedJSON(source, {
    maxBytes: OVERFLIGHT_PROJECT_MAX_BYTES + 8192,
    maxNodes: 15000,
    maxArray: 128,
    maxDepth: 12,
  });
  exactKeys(pack, ['format', 'project', 'dependencies'], 'Overflight package');
  required(pack.format === OVERFLIGHT_PACKAGE_FORMAT, 'Unsupported Overflight package version.');
  pack.project = validateOverflightProject(pack.project);
  required(
    canonicalJSON(pack.dependencies) === canonicalJSON(pack.project.resources),
    'Incomplete or unsupported Overflight dependency closure.',
  );
  compileOverflightProject(pack.project);
  return pack;
}
export function overflightPackageIdentity(source) {
  return dataIdentity(validateOverflightPackage(source));
}
export function exportOverflightPackage(source) {
  return new Blob([canonicalJSON(validateOverflightPackage(source))], { type: 'application/json' });
}
export async function importOverflightPackage(file) {
  required(
    file &&
      Number.isSafeInteger(file.size) &&
      file.size > 0 &&
      file.size <= OVERFLIGHT_PROJECT_MAX_BYTES + 8192 &&
      typeof file.text === 'function',
    'Choose a bounded Overflight package.',
  );
  return validateOverflightPackage(await file.text());
}
const identityCheck = (identity) =>
  required(
    typeof identity === 'string' && /^[a-f0-9]{16}$/.test(identity),
    'Invalid Overflight package identity.',
  );
const editionCheck = (identity) =>
  required(
    typeof identity === 'string' && /^[a-f0-9]{64}$/.test(identity),
    'Invalid Overflight edition identity.',
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
    'Overflight library generation is exhausted.',
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
    maxString: OVERFLIGHT_PROJECT_MAX_BYTES + 8192,
  });
  exactKeys(
    value,
    ['format', 'packages', 'localOwners', 'editions', 'generation'],
    'Overflight library',
  );
  required(value.format === LIBRARY_FORMAT, 'Invalid Overflight library.');
  exactKeys(value.packages, Object.keys(value.packages ?? {}), 'Overflight packages');
  required(Object.keys(value.packages).length <= 16, 'The Overflight library is full.');
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
  exactKeys(value.localOwners, Object.keys(value.localOwners ?? {}), 'Overflight local owners');
  exactKeys(value.editions, Object.keys(value.editions ?? {}), 'Overflight editions');
  required(
    Number.isSafeInteger(value.generation) && value.generation >= 0,
    'Invalid Overflight library generation.',
  );
  for (const [identity, pack] of Object.entries(value.packages)) {
    identityCheck(identity);
    value.packages[identity] = validateOverflightPackage(pack);
    required(
      identity === dataIdentity(value.packages[identity]),
      'Installed Overflight content changed.',
    );
  }
  for (const [identity, owned] of Object.entries(value.localOwners)) {
    identityCheck(identity);
    required(
      owned === true && Object.hasOwn(value.packages, identity),
      'Invalid Overflight local owner.',
    );
  }
  required(Object.keys(value.editions).length <= 128, 'Too many Overflight edition receipts.');
  let active = 0;
  for (const [id, edition] of Object.entries(value.editions)) {
    editionCheck(id);
    exactKeys(edition, ['runtimeIdentity', 'text'], 'Overflight edition');
    identityCheck(edition.runtimeIdentity);
    required(
      edition.text === null || typeof edition.text === 'string',
      'Invalid Overflight recovery bytes.',
    );
    if (edition.text !== null) {
      active++;
      required(
        Object.hasOwn(value.packages, edition.runtimeIdentity),
        'Overflight edition has no installed project.',
      );
      required(
        canonicalJSON(validateOverflightPackage(edition.text)) ===
          canonicalJSON(value.packages[edition.runtimeIdentity]),
        'Overflight recovery bytes differ from the installed project.',
      );
    }
  }
  required(
    active <= 32,
    'Too many installed Overflight editions. Offload an older Community edition first.',
  );
  for (const identity of Object.keys(value.packages))
    required(
      value.localOwners[identity] || communityOwned(value, identity),
      'Overflight package has no owner.',
    );
  return value;
}
function putPackage(state, pack, identity) {
  required(
    Object.hasOwn(state.packages, identity) || Object.keys(state.packages).length < 16,
    'The Overflight library is full. Export or remove an older package.',
  );
  required(
    !Object.hasOwn(state.packages, identity) ||
      canonicalJSON(state.packages[identity]) === canonicalJSON(pack),
    'Overflight package identity collision.',
  );
  state.packages[identity] = pack;
}
export function createOverflightLibrary({ backend, ...options } = {}) {
  const store =
    backend ??
    createProfileRecordBackend({
      key: LIBRARY_FORMAT,
      empty: () => ({
        format: LIBRARY_FORMAT,
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
    required(edition?.text != null, 'This exact Overflight edition is not installed.');
    const blob = new Blob([edition.text], { type: 'application/json' });
    required(
      (await creatorSHA256(await blob.arrayBuffer())) === id,
      'Overflight edition differs from its immutable portable bytes.',
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
        'This Overflight package is not installed in this profile.',
      );
      return state.packages[identity];
    },
    async install(source) {
      const pack = validateOverflightPackage(source),
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
      required(inspected?.family === 'overflight', 'Choose an Overflight edition.');
      const { editionId, runtimeIdentity, text } = inspected;
      editionCheck(editionId);
      identityCheck(runtimeIdentity);
      required(typeof text === 'string', 'Overflight recovery bytes are required.');
      const pack = validateOverflightPackage(text);
      required(
        dataIdentity(pack) === runtimeIdentity &&
          canonicalJSON(pack) === canonicalJSON(validateOverflightPackage(inspected.pack)),
        'Overflight inspected content changed.',
      );
      required(
        (await creatorSHA256(new TextEncoder().encode(text))) === editionId,
        'Overflight edition bytes changed.',
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
        'The Overflight edition changed. Review it again.',
      );
      return {
        family: 'overflight',
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
          review.family === 'overflight' &&
            review.generation === state.generation &&
            edition?.text != null &&
            edition.runtimeIdentity === review.runtimeIdentity,
          'The Overflight library changed. Review the removal again.',
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
