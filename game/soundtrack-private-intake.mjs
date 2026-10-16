import { prepareMP3Import, throwIfSoundtrackAborted } from './mp3.mjs';
import { SOUNDTRACK_GENRES, SOUNDTRACK_LIMITS, resolveSoundtrackLibrary } from './soundtrack.mjs';

const copy = (value) => structuredClone(value);

/**
 * Builds one private collection as an unsaved library draft. The caller owns
 * persistence and playback so a cancelled or rejected batch cannot partially
 * change IndexedDB or the active transport.
 */
export async function preparePrivateSoundtrackCollection(
  library,
  assets,
  files,
  {
    title,
    genre = '',
    signal,
    probeMedia,
    catalogue,
    makeId = (kind) => `${kind}.${globalThis.crypto.randomUUID()}`,
    credit = 'Personal local upload',
    onProgress = () => {},
  } = {},
) {
  const source = [...(files ?? [])];
  if (!source.length) throw new Error('Choose one or more MP3 files or a folder first.');
  if (typeof title !== 'string' || !title.trim())
    throw new Error('Enter a collection name before reviewing these files.');
  if (genre && !SOUNDTRACK_GENRES.includes(genre))
    throw new Error('Choose a supported music style.');

  const current = resolveSoundtrackLibrary(library);
  if (current.tracks.length + source.length > SOUNDTRACK_LIMITS.customTracks)
    throw new Error('This collection would exceed the custom-track limit.');
  if (current.playlists.length >= SOUNDTRACK_LIMITS.customPlaylists)
    throw new Error('This collection would exceed the custom-playlist limit.');

  const next = copy(current);
  const originals = new Map((assets ?? []).map((asset) => [asset.sha256, asset.blob]));
  const trackIds = [];
  for (let index = 0; index < source.length; index += 1) {
    const file = source[index];
    onProgress({ file, completed: index, total: source.length });
    const imported = await prepareMP3Import(
      file,
      {
        id: makeId('track'),
        ...(next.format === 'revealline-soundtrack.v3' ? { fileName: file.name } : {}),
        title: (file.name || 'Imported MP3').replace(/\.mp3$/i, '').slice(0, 120),
        artist: '',
        rights: {
          kind: 'personal',
          credit,
          license: '',
          source: (file.name || '').slice(0, 1024),
        },
      },
      { signal, probeMedia, catalogue },
    );
    next.tracks.push(imported.track);
    trackIds.push(imported.track.id);
    originals.set(imported.track.asset.sha256, imported.blob);
    if (next.tags && genre)
      next.tags[imported.track.id] = {
        genres: [genre],
        role: 'any',
        energy: 3,
        themes: [],
      };
    if (
      [...originals.values()].reduce((total, blob) => total + blob.size, 0) >
      SOUNDTRACK_LIMITS.managedBytes
    )
      throw new Error('This collection exceeds the managed audio budget.');
    throwIfSoundtrackAborted(signal);
  }

  const playlistId = makeId('playlist');
  next.playlists.push({
    id: playlistId,
    title: title.trim().slice(0, 120),
    trackIds,
    order: 'shuffle',
    repeat: 'all',
  });
  next.selection.playlistId = playlistId;
  const prepared = resolveSoundtrackLibrary(next);
  throwIfSoundtrackAborted(signal);
  return {
    library: prepared,
    assets: [...originals].map(([sha256, blob]) => ({ sha256, blob })),
    playlistId,
    trackIds,
    uniqueRecordings: new Set(
      prepared.tracks
        .filter((track) => trackIds.includes(track.id))
        .map((track) => track.asset.sha256),
    ).size,
  };
}
