import { overflightWorldDependencies } from './worlds.mjs';
import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createNativeProjectLibrary } from '../community/native-project-library.mjs';
import {
  compileOverflightRiyProject,
  validateOverflightRiyProject,
  OVERFLIGHT_RIY_MAX_BYTES,
} from './riy-project.mjs';

export const OVERFLIGHT_RIY_PACKAGE_FORMAT = 'revealline-overflight-riy-package.v1';
const LIBRARY_FORMAT = 'revealline-overflight-riy-library.v1';
export function createOverflightRiyPackage(project) {
  const accepted = validateOverflightRiyProject(project);
  return {
    format: OVERFLIGHT_RIY_PACKAGE_FORMAT,
    project: accepted,
    dependencies: overflightWorldDependencies(accepted),
  };
}
export function validateOverflightRiyPackage(source) {
  const pack = boundedJSON(source, {
    maxBytes: OVERFLIGHT_RIY_MAX_BYTES + 8192,
    maxNodes: 15000,
    maxArray: 128,
    maxDepth: 12,
  });
  exactKeys(pack, ['format', 'project', 'dependencies'], 'Overflight package');
  required(
    pack.format === OVERFLIGHT_RIY_PACKAGE_FORMAT,
    'Unsupported Overflight package version.',
  );
  pack.project = validateOverflightRiyProject(pack.project);
  required(
    canonicalJSON(pack.dependencies) === canonicalJSON(overflightWorldDependencies(pack.project)),
    'Incomplete or unsupported Overflight dependency closure.',
  );
  compileOverflightRiyProject(pack.project);
  return pack;
}
export function overflightRiyPackageIdentity(source) {
  return dataIdentity(validateOverflightRiyPackage(source));
}
export function exportOverflightRiyPackage(source) {
  return new Blob([canonicalJSON(validateOverflightRiyPackage(source))], {
    type: 'application/json',
  });
}
export async function importOverflightRiyPackage(file) {
  required(
    file &&
      Number.isSafeInteger(file.size) &&
      file.size > 0 &&
      file.size <= OVERFLIGHT_RIY_MAX_BYTES + 8192 &&
      typeof file.text === 'function',
    'Choose a bounded Overflight package.',
  );
  return validateOverflightRiyPackage(await file.text());
}
export function createOverflightRiyLibrary(options = {}) {
  return createNativeProjectLibrary(
    {
      family: 'overflight-riy',
      label: 'Riy',
      libraryFormat: LIBRARY_FORMAT,
      maxBytes: OVERFLIGHT_RIY_MAX_BYTES,
      validatePackage: validateOverflightRiyPackage,
    },
    options,
  );
}
