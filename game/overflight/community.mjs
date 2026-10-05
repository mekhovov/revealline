import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createNativeProjectLibrary } from '../community/native-project-library.mjs';
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
export function createOverflightLibrary(options = {}) {
  return createNativeProjectLibrary(
    {
      family: 'overflight',
      label: 'Overflight',
      libraryFormat: LIBRARY_FORMAT,
      maxBytes: OVERFLIGHT_PROJECT_MAX_BYTES,
      validatePackage: validateOverflightPackage,
    },
    options,
  );
}
