import { prepareOptionalOffline, removeOptionalOffline } from '../install-context.mjs';
export const PRACTICE_CACHE_PREFIX = 'revealline.optional.civilian-flight.v1:';
export const practiceCachePrefix = (location) =>
  `${PRACTICE_CACHE_PREFIX}${new URL('./', location.href).pathname}:`;
export function preparePracticeOffline(options = {}) {
  return prepareOptionalOffline({ packageId: 'civilian-flight', ...options });
}
export function removePracticeOffline(options = {}) {
  return removeOptionalOffline({ ...options, packageId: 'civilian-flight' });
}
