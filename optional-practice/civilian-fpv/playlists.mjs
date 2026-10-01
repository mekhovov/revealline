import {
  boundedJSON,
  canonicalJSON,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';

export const PLAYLIST_FORMAT = 'FPVPlaylist.v1';
export const PLAYLIST_LIMIT = 128;
const STORAGE_KEY = 'revealline.fpv.playlists.v1';
const STORE_LIMITS = { maxBytes: 1024 * 1024, maxNodes: 50000, maxArray: 256, maxDepth: 10 };
export function validatePlaylist(input) {
  const value = boundedJSON(input, {
    maxBytes: 65536,
    maxNodes: 2000,
    maxArray: PLAYLIST_LIMIT,
    maxDepth: 6,
  });
  exactKeys(value, ['format', 'id', 'revision', 'title', 'entries'], 'playlist');
  required(
    value.format === PLAYLIST_FORMAT && stableId(value.id) && stableId(value.revision),
    'Unsupported playlist',
  );
  exactKeys(value.title, ['en', 'uk'], 'playlist title');
  required(
    ['en', 'uk'].every(
      (lang) =>
        typeof value.title[lang] === 'string' &&
        value.title[lang].trim().length > 0 &&
        value.title[lang].length <= 120,
    ),
    'A playlist needs English and Ukrainian titles',
  );
  required(
    Array.isArray(value.entries) &&
      value.entries.length > 0 &&
      value.entries.length <= PLAYLIST_LIMIT,
    'A playlist needs 1–128 challenges',
  );
  for (const entry of value.entries) {
    exactKeys(entry, ['packIdentity', 'levelId'], 'playlist entry');
    required(
      typeof entry.packIdentity === 'string' &&
        /^[a-zA-Z0-9._:-]{1,160}$/.test(entry.packIdentity) &&
        stableId(entry.levelId),
      'Invalid pinned challenge reference',
    );
  }
  return value;
}
export const exportPlaylist = (input) => canonicalJSON(validatePlaylist(input));
export function resolvePlaylist(input, catalogue) {
  const playlist = validatePlaylist(input);
  return playlist.entries.map((entry, index) => ({
    ...entry,
    index,
    course:
      catalogue.find(
        (course) => course.id === entry.levelId && course.packIdentity === entry.packIdentity,
      ) ?? null,
  }));
}
export function createPlaylistStore(storage = globalThis.localStorage) {
  const validateState = (input) => {
    const state = boundedJSON(input, STORE_LIMITS);
    exactKeys(state, ['playlists', 'bookmark'], 'playlist store');
    required(
      Array.isArray(state.playlists) && state.playlists.length <= 64,
      'Invalid playlist store',
    );
    state.playlists = state.playlists.map(validatePlaylist);
    required(
      new Set(state.playlists.map((p) => `${p.id}/${p.revision}`)).size === state.playlists.length,
      'Duplicate playlist revision',
    );
    if (state.bookmark !== null && state.bookmark !== undefined) {
      const bookmark = state.bookmark;
      exactKeys(bookmark, ['id', 'revision', 'nextIndex'], 'playlist bookmark');
      required(
        stableId(bookmark.id) &&
          stableId(bookmark.revision) &&
          Number.isSafeInteger(bookmark.nextIndex) &&
          bookmark.nextIndex >= 0 &&
          bookmark.nextIndex <= PLAYLIST_LIMIT,
        'Invalid playlist bookmark',
      );
      const owned = state.playlists.find(
        (p) => p.id === bookmark.id && p.revision === bookmark.revision,
      );
      required(
        !owned || bookmark.nextIndex <= owned.entries.length,
        'Bookmark exceeds playlist length',
      );
    } else state.bookmark = null;
    return state;
  };
  const read = () => {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { playlists: [], bookmark: null };
    return validateState(raw);
  };
  const write = (value) => {
    const clean = validateState(value);
    required(typeof storage?.setItem === 'function', 'Playlist storage is unavailable');
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return structuredClone(clean);
  };
  return {
    snapshot: () => structuredClone(read()),
    save(input) {
      const playlist = validatePlaylist(input),
        state = read();
      const index = state.playlists.findIndex(
        (item) => item.id === playlist.id && item.revision === playlist.revision,
      );
      if (index >= 0)
        required(
          exportPlaylist(state.playlists[index]) === exportPlaylist(playlist),
          'A changed playlist needs a new revision',
        );
      else {
        required(
          state.playlists.length < 64,
          'Export or remove an older playlist before adding another',
        );
        state.playlists.push(playlist);
      }
      return write(state);
    },
    remove(id, revision) {
      const state = read();
      state.playlists = state.playlists.filter(
        (item) => item.id !== id || item.revision !== revision,
      );
      if (state.bookmark?.id === id && state.bookmark?.revision === revision) state.bookmark = null;
      return write(state);
    },
    bookmark(id, revision, nextIndex) {
      required(
        stableId(id) &&
          stableId(revision) &&
          Number.isSafeInteger(nextIndex) &&
          nextIndex >= 0 &&
          nextIndex <= PLAYLIST_LIMIT,
        'Invalid playlist bookmark',
      );
      const state = read();
      state.bookmark = { id, revision, nextIndex };
      return write(state);
    },
  };
}
