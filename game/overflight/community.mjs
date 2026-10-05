import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
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
function validateLibrary(source) {
  const value = boundedJSON(source, {
    maxBytes: 3 * 1024 * 1024,
    maxNodes: 200000,
    maxArray: 128,
    maxDepth: 14,
  });
  exactKeys(value, ['format', 'packages'], 'Overflight library');
  required(
    value.format === LIBRARY_FORMAT &&
      value.packages &&
      !Array.isArray(value.packages) &&
      typeof value.packages === 'object' &&
      Object.keys(value.packages).length <= 16,
    'Invalid or full Overflight library.',
  );
  for (const [identity, pack] of Object.entries(value.packages)) {
    value.packages[identity] = validateOverflightPackage(pack);
    required(identity === overflightPackageIdentity(pack), 'Installed Overflight content changed.');
  }
  return value;
}
const identityCheck = (identity) =>
  required(
    typeof identity === 'string' && /^[a-f0-9]{16}$/.test(identity),
    'Invalid Overflight package identity.',
  );
export function createOverflightLibrary({ backend, ...options } = {}) {
  const store =
    backend ??
    createProfileRecordBackend({
      key: LIBRARY_FORMAT,
      empty: () => ({ format: LIBRARY_FORMAT, packages: {} }),
      validate: validateLibrary,
      ...options,
    });
  return {
    async list() {
      const state = validateLibrary(await store.read());
      return Object.entries(state.packages).map(([identity, pack]) => ({
        identity,
        title: pack.project.title,
        project: pack.project,
      }));
    },
    async load(identity) {
      identityCheck(identity);
      const state = validateLibrary(await store.read());
      required(
        Object.hasOwn(state.packages, identity),
        'This Overflight package is not installed in this profile.',
      );
      return state.packages[identity];
    },
    async install(source) {
      const pack = validateOverflightPackage(source),
        identity = overflightPackageIdentity(pack);
      await store.update((state) => {
        state = validateLibrary(state);
        required(
          Object.hasOwn(state.packages, identity) || Object.keys(state.packages).length < 16,
          'The Overflight library is full. Export or remove an older package.',
        );
        state.packages[identity] = pack;
        return state;
      });
      return identity;
    },
    async remove(identity) {
      identityCheck(identity);
      await store.update((state) => {
        state = validateLibrary(state);
        delete state.packages[identity];
        return state;
      });
    },
    dispose() {
      store.close();
    },
  };
}
