import { offlineAvailability } from './offline.mjs';
import { createOfficialDownloads } from './official-downloads.mjs';
import { downloadFiles } from './download-catalogue.mjs';
import { resolveJourneyRequest } from './content-design/default-entry.mjs';

/** Gameplay may consume local packages, but only the download UI may authorize
 * their transfer. Readiness is checked against actual files, never onLine or a
 * saved checkbox. The source checkout and immutable v1 editions keep their
 * existing loading contract. */
export function createOfflineDownloadAccess({
  availability = offlineAvailability(),
  fetch: request = globalThis.fetch,
  store,
  requestPackage,
  catalogueTimeout = 10000,
} = {}) {
  let catalogue;
  const getCatalogue = async (signal) => {
    signal?.throwIfAborted();
    if (catalogue) return catalogue;
    // Cache only a completed catalogue. A cancelled/stalled first request must
    // not hold later mission requests behind its unresolved promise.
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    let rejectAbort;
    const aborted = new Promise((_, reject) => {
      rejectAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    const timer = setTimeout(
      () =>
        controller.abort(new Error('The offline package catalogue timed out. Retry the request.')),
      catalogueTimeout,
    );
    try {
      const value = await Promise.race([
        (async () => {
          const url = new URL('offline-content.json', availability.scope);
          const response = await request(url, {
            redirect: 'error',
            credentials: 'same-origin',
            signal: controller.signal,
          });
          if (!response.ok || response.redirected)
            throw new Error('The offline package catalogue is unavailable.');
          const value = await response.json();
          controller.signal.throwIfAborted();
          if (
            value.format !== 'revealline-offline-content.v2' ||
            value.version !== availability.version
          )
            throw new Error('The offline package catalogue differs from this edition.');
          return value;
        })(),
        aborted,
      ]);
      controller.signal.throwIfAborted();
      catalogue = value;
      return value;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', rejectAbort);
    }
  };
  const check = (signal) => signal?.throwIfAborted();
  return Object.freeze({
    async ensure(groupId, { signal, prompt = true, retain = false } = {}) {
      check(signal);
      if (!availability.packageConsent || !availability.available || !groupId) return;
      const current = await getCatalogue(signal);
      check(signal);
      const files = downloadFiles(current, [groupId]);
      store ||= createOfficialDownloads();
      if (!(await store.inspect(files, { verify: true, signal })).ready) {
        check(signal);
        if (!prompt)
          throw new Error('Download this chapter in Install & offline play before playing it.');
        if (typeof requestPackage !== 'function')
          throw new Error('Open Install & offline play to download this chapter first.');
        await requestPackage({ groupId, signal });
        check(signal);
        if (!(await store.inspect(files, { verify: true, signal })).ready)
          throw new Error(
            'This chapter is not ready offline. Resume its download in Install & offline play.',
          );
      }
      check(signal);
      if (retain) {
        await store.pin({ edition: availability.scope, group: groupId, files, signal });
        check(signal);
      }
    },
    async ensureClassic(packId, options) {
      await this.ensure(packId ? `chapter:${packId}` : 'classic:base', options);
    },
    async ensureMission(
      { routeId, missionId, mode },
      { signal, prompt = true, retain = false } = {},
    ) {
      check(signal);
      if (!availability.packageConsent || !availability.available) return;
      const current = await getCatalogue(signal);
      const matches = current.missions.filter(
        (mission) =>
          mission.routeId === routeId &&
          mission.missionId === missionId &&
          mission.modes.includes(mode),
      );
      if (matches.length !== 1 || !matches[0].groups.length)
        throw new Error('This exact mission edition has no offline package.');
      for (const group of matches[0].groups) await this.ensure(group, { signal, prompt, retain });
    },
    async ensureURL(destination, options = {}) {
      check(options.signal);
      if (!availability.packageConsent || !availability.available) return;
      const url = new URL(destination, availability.scope),
        scope = new URL(availability.scope);
      if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
      const path = url.pathname.slice(scope.pathname.length).replace(/\/$/, '/index.html');
      const current = await getCatalogue(options.signal);
      const group = current.groups.find(
        (item) => item.category === 'tooling' && item.files.includes(path),
      );
      if (group) await this.ensure(group.id, options);
    },
    async ensureDestination(destination, { signal, prompt = true, runtimeOnly = false } = {}) {
      check(signal);
      if (!availability.packageConsent || !availability.available) return;
      const url = new URL(destination, availability.scope),
        scope = new URL(availability.scope);
      if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
      const path = url.pathname.slice(scope.pathname.length).replace(/index\.html$/, '');
      const mode = {
        'game/': 'solo',
        'game/couch/': 'versus',
        'game/couch/relay-rescue.html': 'team',
      }[path];
      if (!mode) return;
      const routeId = resolveJourneyRequest(url.searchParams, { mode }) || 'legacy';
      const libraryIds = url.searchParams.getAll('library-mission');
      if (libraryIds.length > 1 || (libraryIds.length && !libraryIds[0]))
        throw new Error('The destination mission request is invalid.');
      const current = await getCatalogue(signal);
      check(signal);
      // Destination rows are generated from exact published owner metadata. Never
      // decode an opaque library ID to guess a different chapter or edition.
      const candidates = (current.destinations || []).filter(
        (row) => row.path === path && row.mode === mode && row.routeId === routeId,
      );
      const matching = candidates.filter((row) =>
        runtimeOnly || !libraryIds.length
          ? row.libraryId === undefined
          : row.libraryId === libraryIds[0],
      );
      if (matching.length !== 1) throw new Error('This exact destination has no offline package.');
      // Imported packs, practice and authenticated return tokens carry their own
      // local content authority. Preparing a host must not replace those owners
      // with a similarly named official chapter.
      const carriesLocalContent =
        routeId === 'legacy' &&
        !libraryIds.length &&
        [
          'pack',
          'practice',
          'course',
          'lesson',
          'return-token',
          'return-token-v2',
          'mode-return',
          'mode-return-v2',
        ].some((key) => url.searchParams.has(key));
      const groups =
        runtimeOnly || carriesLocalContent ? matching[0].runtimeGroups : matching[0].groups;
      if (!Array.isArray(groups)) throw new Error('The destination package is incomplete.');
      for (const group of groups) await this.ensure(group, { signal, prompt });
    },
  });
}
