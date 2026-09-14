import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from './data-json.mjs';
import { freezeSoundtrack, resolveSoundtrackLibrary, SOUNDTRACK_LIMITS } from './soundtrack.mjs';
import { isPreparedSoundtrackLibrary, ownSoundtrackAssets } from './soundtrack-bundle.mjs';

export const SOUNDTRACK_ALBUM_CATALOG_FORMAT = 'revealline-soundtrack-albums.v1';
export const SOUNDTRACK_ALBUM_CATALOG_BYTES = 64 * 1024;
const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;
const sourceURL = (value) => {
  if (!text(value, 1024)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};
const copy = (value) =>
  boundedJSON(value, {
    maxBytes: SOUNDTRACK_ALBUM_CATALOG_BYTES,
    maxNodes: 10000,
    maxDepth: 12,
    maxArray: 128,
    maxString: 1024,
  });

/** Finite data only. Each album carries the exact complete library its body must contain. */
export function resolveSoundtrackAlbum(value) {
  const album = copy(value);
  exactKeys(
    album,
    [
      'id',
      'title',
      'genre',
      'description',
      'credit',
      'source',
      'path',
      'bytes',
      'sha256',
      'library',
    ],
    'soundtrack album',
  );
  required(stableId(album.id) && !album.id.startsWith('builtin.'), 'Invalid soundtrack album ID.');
  required(
    text(album.title, 120) &&
      text(album.genre, 80) &&
      text(album.description, 280) &&
      text(album.credit, 280) &&
      sourceURL(album.source),
    'Invalid soundtrack album description or source.',
  );
  required(
    album.path === `optional/soundtracks/${album.id}.rlsound`,
    'Invalid soundtrack album path.',
  );
  required(
    Number.isSafeInteger(album.bytes) &&
      album.bytes >= 12 &&
      album.bytes <= SOUNDTRACK_LIMITS.optionalBundleTargetBytes &&
      /^[0-9a-f]{64}$/.test(album.sha256),
    'Invalid soundtrack album byte or hash declaration.',
  );
  album.library = resolveSoundtrackLibrary(album.library);
  const { tracks, playlists, assignments, selection } = album.library;
  required(
    tracks.length > 0 &&
      tracks.length <= 24 &&
      assignments.length === 0 &&
      playlists.length === 1 &&
      playlists[0].id === album.id &&
      [null, album.id].includes(selection.playlistId),
    'Album must contain one playlist and no automatic assignments.',
  );
  required(
    canonicalJSON(playlists[0].trackIds) === canonicalJSON(tracks.map((track) => track.id)),
    'Album playlist must list each declared track exactly once in order.',
  );
  required(
    tracks.every((track) => track.rights.kind === 'licensed' && sourceURL(track.rights.source)),
    'Album tracks require licensed source records.',
  );
  const assets = new Map(tracks.map((track) => [track.asset.sha256, track.asset.bytes]));
  required(
    [...assets.values()].reduce((sum, bytes) => sum + bytes, 12) < album.bytes,
    'Album body is smaller than its declared originals and manifest.',
  );
  return freezeSoundtrack(album);
}

export function resolveSoundtrackAlbumCatalog(value) {
  const catalog = copy(value);
  exactKeys(catalog, ['format', 'albums'], 'soundtrack album catalog');
  required(
    catalog.format === SOUNDTRACK_ALBUM_CATALOG_FORMAT &&
      Array.isArray(catalog.albums) &&
      catalog.albums.length > 0 &&
      catalog.albums.length <= 4,
    'Unsupported soundtrack album catalog.',
  );
  catalog.albums = catalog.albums.map(resolveSoundtrackAlbum);
  required(
    new Set(catalog.albums.map((album) => album.id)).size === catalog.albums.length,
    'Duplicate soundtrack album ID.',
  );
  return freezeSoundtrack(catalog);
}

/** Add to an owned draft, never to storage. Existing selection/assignments survive intact.
 * The caller prepares this complete result before publication and uses the normal CAS Save. */
export function mergeSoundtrackAlbum(value, sourceAssets, prepared, declaration) {
  const current = resolveSoundtrackLibrary(value),
    currentAssets = ownSoundtrackAssets(sourceAssets),
    album = resolveSoundtrackAlbum(declaration);
  required(
    isPreparedSoundtrackLibrary(prepared),
    'Album addition requires an actual verified import.',
  );
  required(
    canonicalJSON(prepared.library) === canonicalJSON(album.library),
    'Imported soundtrack differs from the selected album.',
  );
  const append = (old, incoming, label) => {
    const found = new Map(old.map((item) => [item.id, item])),
      result = [...old];
    for (const item of incoming) {
      const prior = found.get(item.id);
      required(
        !prior || canonicalJSON(prior) === canonicalJSON(item),
        `Conflicting ${label} ID: ${item.id}`,
      );
      if (!prior) {
        result.push(item);
        found.set(item.id, item);
      }
    }
    return result;
  };
  const library = resolveSoundtrackLibrary({
    ...current,
    tracks: append(current.tracks, prepared.library.tracks, 'track'),
    playlists: append(current.playlists, prepared.library.playlists, 'playlist'),
  });
  const wanted = new Map(library.tracks.map((track) => [track.asset.sha256, track.asset.bytes])),
    collected = new Map(currentAssets.map((asset) => [asset.sha256, asset]));
  // A verified incoming copy can repair an existing missing/corrupt copy with the same identity.
  for (const asset of prepared.assets) collected.set(asset.sha256, asset);
  required(
    collected.size === wanted.size &&
      [...collected].every(([hash, asset]) => wanted.get(hash) === asset.blob.size),
    'Album addition needs every draft original and no extra assets.',
  );
  const assets = ownSoundtrackAssets([...collected.values()]);
  required(
    assets.reduce((sum, asset) => sum + asset.blob.size, 0) <= SOUNDTRACK_LIMITS.managedBytes,
    'Combined soundtrack exceeds the managed byte limit.',
  );
  return Object.freeze({
    library,
    assets,
    addedTracks: library.tracks.length - current.tracks.length,
    addedPlaylists: library.playlists.length - current.playlists.length,
  });
}
