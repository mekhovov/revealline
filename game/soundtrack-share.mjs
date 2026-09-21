import { canonicalJSON, required } from './data-json.mjs';
import {
  resolveSoundtrackLibrary,
  upgradeSoundtrackLibrary,
  soundtrackTracks,
  soundtrackStoredTracks,
  soundtrackRecoveryPlan,
  SOUNDTRACK_FORMAT,
  SOUNDTRACK_GENRES,
} from './soundtrack.mjs';
import { isPreparedSoundtrackLibrary, ownSoundtrackAssets } from './soundtrack-bundle.mjs';

/** Add a creator album without changing the listener's choice, assignments, or existing draft. */
export function mergeSoundtrackShare(current, currentAssets, incoming) {
  required(
    isPreparedSoundtrackLibrary(incoming),
    'Shared albums must pass complete import validation first.',
  );
  const left = resolveSoundtrackLibrary(current),
    right = resolveSoundtrackLibrary(incoming.library);
  required(
    (right.bonusAlbums ?? []).every((album) => album.downloaded) &&
      (right.catalogTracks ?? []).every(
        (track) =>
          right.installedTrackIds.includes(track.id) ||
          (right.referenceOnlyTrackIds ?? []).includes(track.id),
      ),
    'Shared albums must include every downloaded original.',
  );
  const previouslyStored = new Set(soundtrackStoredTracks(left).map((track) => track.id));
  const modern = left.format !== SOUNDTRACK_FORMAT || right.format !== SOUNDTRACK_FORMAT;
  const library = structuredClone(modern ? upgradeSoundtrackLibrary(left) : left);
  const source = modern ? upgradeSoundtrackLibrary(right) : right;
  for (const field of ['tracks', 'playlists', ...(modern ? ['catalogTracks'] : [])]) {
    const known = new Map(library[field].map((item) => [item.id, item]));
    for (const item of source[field]) {
      const prior = known.get(item.id);
      required(
        !prior || canonicalJSON(prior) === canonicalJSON(item),
        'This album conflicts with an existing music identity.',
      );
      if (!prior) {
        library[field].push(item);
        known.set(item.id, item);
      }
    }
  }
  if (modern) {
    const restored = new Set(soundtrackStoredTracks(source).map((track) => track.id));
    library.referenceOnlyTrackIds = [
      ...new Set([
        ...library.referenceOnlyTrackIds.filter((id) => !restored.has(id)),
        ...source.referenceOnlyTrackIds.filter((id) => !previouslyStored.has(id)),
      ]),
    ];
    library.tags = { ...source.tags, ...library.tags };
    library.installedTrackIds = [
      ...new Set([...library.installedTrackIds, ...source.installedTrackIds]),
    ];
    // A complete imported album carries bytes, but its pins grant no network authority.
    // Keep installed ownership per track without marking absent siblings downloaded.
    const incomingIds = new Set(source.tracks.map((track) => track.id));
    const pins = (library.bonusAlbums ?? [])
      .map((album) => ({
        ...album,
        trackIds: album.downloaded
          ? album.trackIds
          : album.trackIds.filter((id) => !incomingIds.has(id)),
      }))
      .filter((album) => album.trackIds.length);
    for (const incoming of source.bonusAlbums ?? []) {
      const prior = pins.find((album) => album.id === incoming.id);
      if (!prior) pins.push(incoming);
      else if (prior.downloaded === incoming.downloaded)
        prior.trackIds = [...new Set([...prior.trackIds, ...incoming.trackIds])];
      // If an existing offloaded group has other siblings, incoming IDs remain required
      // ordinary tracks until an explicit trusted album operation adopts the whole group.
    }
    if (library.bonusAlbums || source.bonusAlbums) library.bonusAlbums = pins;
  }
  const assets = new Map(ownSoundtrackAssets(currentAssets).map((asset) => [asset.sha256, asset]));
  for (const asset of ownSoundtrackAssets(incoming.assets)) assets.set(asset.sha256, asset);
  return { library: resolveSoundtrackLibrary(library), assets: [...assets.values()] };
}

/** A share is exactly one playlist and its referenced recordings, not a replacement library. */
export function soundtrackPlaylistShare(value, playlist, { catalogue } = {}) {
  const library = structuredClone(upgradeSoundtrackLibrary(value));
  required(
    playlist && !playlist.id.startsWith('builtin.'),
    'Choose a custom playlist to share. Clone a built-in playlist first.',
  );
  const ids = new Set(playlist.trackIds);
  const references = soundtrackRecoveryPlan(library, { catalogue }).referenceOnlyTrackIds;
  for (const track of soundtrackTracks(library).filter((item) => ids.has(item.id)))
    required(
      track.kind === 'synth' || track.rights.kind !== 'personal',
      'Declare permission for every personal upload before sharing this album.',
    );
  library.tracks = library.tracks.filter((track) => ids.has(track.id));
  library.catalogTracks = library.catalogTracks.filter((track) => ids.has(track.id));
  library.referenceOnlyTrackIds = references.filter((id) => ids.has(id));
  library.installedTrackIds = library.catalogTracks
    .filter((track) => !library.referenceOnlyTrackIds.includes(track.id))
    .map((track) => track.id);
  library.tags = Object.fromEntries(Object.entries(library.tags).filter(([id]) => ids.has(id)));
  if (library.bonusAlbums)
    library.bonusAlbums = library.bonusAlbums
      .map((album) => ({
        ...album,
        trackIds: album.trackIds.filter((id) => ids.has(id)),
      }))
      .filter((album) => album.trackIds.length);
  library.playlists = [playlist];
  library.assignments = [];
  library.selection = { playlistId: null };
  library.listening = {
    mode: 'auto',
    genres: [...SOUNDTRACK_GENRES],
    installedOnly: false,
    recordingMode: false,
  };
  return resolveSoundtrackLibrary(library);
}
