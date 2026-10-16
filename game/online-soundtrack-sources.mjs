import { boundedJSON, exactKeys, required } from './data-json.mjs';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  normalizeOnlineSoundtrackSourceURL,
  createOnlineSoundtrackSourceAuthority,
  revokeOnlineSoundtrackSource,
  fetchOnlineSoundtrackCatalogue,
  isResolvedOnlineSoundtrackTrack,
  mergeOnlineSoundtrackTracks,
} from './online-soundtrack-catalogue.mjs';
import {
  PUBLIC_SOUNDTRACK_STYLE_IDS,
  publicSoundtrackStyles,
} from './soundtrack-style-taxonomy.mjs';

export { normalizeOnlineSoundtrackSourceURL };
export const DEFAULT_ONLINE_SOUNDTRACK_SOURCES = Object.freeze([
  Object.freeze({ url: ONLINE_SOUNDTRACK_CATALOGUE_URL, enabled: true }),
]);
export const ONLINE_SOUNDTRACK_SOURCE_SETTINGS_KEY = 'online-sources.v1';
export const ONLINE_SOUNDTRACK_SOURCE_SETTINGS_FORMAT = 'revealline-online-soundtrack-sources.v1';

export function resolveOnlineSoundtrackSources(source) {
  const values = boundedJSON(source, {
    maxBytes: 8192,
    maxNodes: 32,
    maxDepth: 3,
    maxArray: 4,
    maxString: 1024,
  });
  required(
    Array.isArray(values) && values.length > 0 && values.length <= 4,
    'Choose between one and four soundtrack sources.',
  );
  const seen = new Set();
  const sources = values.map((value) => {
    exactKeys(value, ['url', 'enabled'], 'Soundtrack source');
    const url = normalizeOnlineSoundtrackSourceURL(value.url);
    required(
      typeof value.enabled === 'boolean' && !seen.has(url),
      'Invalid or duplicate soundtrack source.',
    );
    seen.add(url);
    return Object.freeze({ url, enabled: value.enabled });
  });
  required(
    seen.has(ONLINE_SOUNDTRACK_CATALOGUE_URL),
    'Keep the main soundtrack source; it may be disabled.',
  );
  return Object.freeze(sources);
}

export function validateOnlineSoundtrackSourceSettings(source) {
  if (source === undefined)
    return Object.freeze({
      format: ONLINE_SOUNDTRACK_SOURCE_SETTINGS_FORMAT,
      generation: 0,
      sources: DEFAULT_ONLINE_SOUNDTRACK_SOURCES,
    });
  const value = boundedJSON(source, {
    maxBytes: 8192,
    maxNodes: 40,
    maxDepth: 4,
    maxArray: 4,
    maxString: 1024,
  });
  exactKeys(value, ['format', 'generation', 'sources'], 'Soundtrack source settings');
  required(
    value.format === ONLINE_SOUNDTRACK_SOURCE_SETTINGS_FORMAT &&
      Number.isSafeInteger(value.generation) &&
      value.generation >= 0 &&
      value.generation < Number.MAX_SAFE_INTEGER,
    'Invalid soundtrack source settings generation.',
  );
  return Object.freeze({ ...value, sources: resolveOnlineSoundtrackSources(value.sources) });
}

/** Fetches only explicitly enabled descriptors. A removed authority is never reused. */
export function createOnlineSoundtrackSourceManager({
  sources = DEFAULT_ONLINE_SOUNDTRACK_SOURCES,
  fetch = globalThis.fetch,
} = {}) {
  let entries = new Map(),
    generation = 0,
    disposed = false;
  const listeners = new Set();
  const authority = (url) =>
    createOnlineSoundtrackSourceAuthority(url, {
      allowUnknown: url !== ONLINE_SOUNDTRACK_CATALOGUE_URL,
    });
  function snapshot() {
    const grouped = new Map();
    for (const entry of entries.values()) {
      if (!entry.enabled) continue;
      for (const track of entry.tracks.filter(isResolvedOnlineSoundtrackTrack)) {
        if (!grouped.has(track.sha256)) grouped.set(track.sha256, []);
        grouped.get(track.sha256).push(track);
      }
    }
    const tracks = [];
    let conflicts = 0;
    for (const values of grouped.values()) {
      if (values.some((track) => track.bytes !== values[0].bytes)) {
        conflicts++;
        continue;
      }
      tracks.push(mergeOnlineSoundtrackTracks(values));
    }
    const bounded = Object.freeze(tracks.slice(0, 512));
    const styles = new Set(bounded.flatMap((track) => publicSoundtrackStyles(track.tags)));
    return Object.freeze({
      sources: Object.freeze(
        [...entries.values()].map((entry) =>
          Object.freeze({
            url: entry.url,
            enabled: entry.enabled,
            isMain: entry.url === ONLINE_SOUNDTRACK_CATALOGUE_URL,
            status: entry.status,
            error: entry.error,
            trackCount: entry.enabled
              ? entry.tracks.filter(isResolvedOnlineSoundtrackTrack).length
              : 0,
          }),
        ),
      ),
      tracks: bounded,
      styles: Object.freeze(PUBLIC_SOUNDTRACK_STYLE_IDS.filter((style) => styles.has(style))),
      loading: [...entries.values()].some((entry) => entry.status === 'loading'),
      generation,
      conflicts,
      limited: tracks.length > 512,
    });
  }
  function emit() {
    generation++;
    const value = snapshot();
    for (const listener of listeners) {
      try {
        listener(value);
      } catch {
        /* A view cannot undo source revocation. */
      }
    }
    return value;
  }
  function revoke(entry) {
    entry.controller?.abort();
    entry.controller = null;
    if (entry.authority) revokeOnlineSoundtrackSource(entry.authority);
    entry.authority = null;
    entry.tracks = [];
    entry.status = 'idle';
    entry.error = null;
  }
  function setSources(next) {
    required(!disposed, 'Soundtrack sources are closed.');
    const resolved = resolveOnlineSoundtrackSources(next),
      retained = new Map();
    for (const source of resolved) {
      let entry = entries.get(source.url);
      if (!entry)
        entry = {
          ...source,
          authority: null,
          controller: null,
          tracks: [],
          status: 'idle',
          error: null,
        };
      if (!source.enabled) revoke(entry);
      entry.enabled = source.enabled;
      if (entry.enabled && !entry.authority) entry.authority = authority(entry.url);
      retained.set(source.url, entry);
    }
    for (const [url, entry] of entries) if (!retained.has(url)) revoke(entry);
    entries = retained;
    return emit();
  }
  async function refresh({ signal } = {}) {
    required(!disposed, 'Soundtrack sources are closed.');
    if (signal?.aborted) return snapshot();
    await Promise.all(
      [...entries.values()]
        .filter((entry) => entry.enabled)
        .map(async (entry) => {
          entry.controller?.abort();
          const controller = new AbortController(),
            cancel = () => controller.abort();
          entry.controller = controller;
          entry.authority ??= authority(entry.url);
          const token = entry.authority;
          signal?.addEventListener('abort', cancel, { once: true });
          entry.status = 'loading';
          entry.error = null;
          emit();
          try {
            const catalogue = await fetchOnlineSoundtrackCatalogue({
              fetch,
              signal: controller.signal,
              sourceAuthority: token,
            });
            if (
              disposed ||
              controller.signal.aborted ||
              entry.controller !== controller ||
              entries.get(entry.url) !== entry ||
              !entry.enabled
            )
              return;
            entry.tracks = catalogue.tracks;
            entry.status = 'ready';
          } catch (error) {
            if (
              disposed ||
              entry.controller !== controller ||
              entries.get(entry.url) !== entry ||
              !entry.enabled
            )
              return;
            if (controller.signal.aborted) entry.status = entry.tracks.length ? 'ready' : 'idle';
            else {
              revokeOnlineSoundtrackSource(token);
              entry.authority = null;
              entry.tracks = [];
              entry.status = 'error';
              entry.error = String(error?.message ?? error).slice(0, 512);
            }
          } finally {
            signal?.removeEventListener('abort', cancel);
            if (
              !disposed &&
              entry.controller === controller &&
              entries.get(entry.url) === entry &&
              entry.enabled
            ) {
              entry.controller = null;
              emit();
            }
          }
        }),
    );
    return snapshot();
  }
  setSources(sources);
  return Object.freeze({
    snapshot,
    setSources,
    refresh,
    subscribe(listener) {
      required(typeof listener === 'function' && !disposed, 'Invalid soundtrack source listener.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) {
        revoke(entry);
        entry.enabled = false;
      }
      emit();
      listeners.clear();
    },
  });
}
