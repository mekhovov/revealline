import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createNativeProjectLibrary } from '../community/native-project-library.mjs';
import {
  compileOverflightHuntProject,
  validateOverflightHuntProject,
  OVERFLIGHT_HUNT_PROJECT_MAX_BYTES,
} from './raid-project.mjs';

export const OVERFLIGHT_HUNT_PACKAGE_FORMAT = 'revealline-overflight-hunt-package.v1';
const LIBRARY_FORMAT = 'revealline-overflight-hunt-library.v1';
export function createOverflightHuntPackage(project) {
  const accepted = validateOverflightHuntProject(project);
  return {
    format: OVERFLIGHT_HUNT_PACKAGE_FORMAT,
    project: accepted,
    dependencies: structuredClone(accepted.resources),
  };
}
export function validateOverflightHuntPackage(source) {
  const pack = boundedJSON(source, {
    maxBytes: OVERFLIGHT_HUNT_PROJECT_MAX_BYTES + 8192,
    maxNodes: 15000,
    maxArray: 128,
    maxDepth: 12,
  });
  exactKeys(pack, ['format', 'project', 'dependencies'], 'Raid package');
  required(pack.format === OVERFLIGHT_HUNT_PACKAGE_FORMAT, 'Unsupported Raid package version.');
  pack.project = validateOverflightHuntProject(pack.project);
  required(
    canonicalJSON(pack.dependencies) === canonicalJSON(pack.project.resources),
    'Incomplete or unsupported Raid dependency closure.',
  );
  compileOverflightHuntProject(pack.project);
  return pack;
}
export function overflightHuntPackageIdentity(source) {
  return dataIdentity(validateOverflightHuntPackage(source));
}
export function exportOverflightHuntPackage(source) {
  return new Blob([canonicalJSON(validateOverflightHuntPackage(source))], {
    type: 'application/json',
  });
}
export async function importOverflightHuntPackage(file) {
  required(
    file &&
      Number.isSafeInteger(file.size) &&
      file.size > 0 &&
      file.size <= OVERFLIGHT_HUNT_PROJECT_MAX_BYTES + 8192 &&
      typeof file.text === 'function',
    'Choose a bounded Raid package.',
  );
  return validateOverflightHuntPackage(await file.text());
}
export function createOverflightHuntLibrary(options = {}) {
  return createNativeProjectLibrary(
    {
      family: 'overflight-hunt',
      label: 'Raid',
      libraryFormat: LIBRARY_FORMAT,
      maxBytes: OVERFLIGHT_HUNT_PROJECT_MAX_BYTES,
      validatePackage: validateOverflightHuntPackage,
    },
    options,
  );
}
