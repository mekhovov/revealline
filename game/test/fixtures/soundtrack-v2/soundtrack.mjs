// Frozen DB5/v2 reader and writer from source 52e5d545.
// Import paths alone are relocated; soundtrack-bundle uses the current verified-import brand.
// Retained to prove future-format rejection happens before any shared-store mutation.
import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../../../data-json.mjs';
import { DEFAULT_TRACKS, MUSIC_STYLES } from '../../../ui/music.mjs';

export const SOUNDTRACK_FORMAT = 'revealline-soundtrack.v1';
export const SOUNDTRACK_FORMAT_V2 = 'revealline-soundtrack.v2';
export const SOUNDTRACK_CATALOGUE_FORMAT = 'revealline-soundtrack-catalogue.v1';
export const SOUNDTRACK_GENRES = Object.freeze(['synth90s', 'metal', 'ukrainian']);
export const SOUNDTRACK_MODES = Object.freeze(['auto', ...SOUNDTRACK_GENRES, 'fusion', 'mix']);
export const AUDIO_TRACK_FORMAT = 'revealline-audio-track.v1';
export const SOUNDTRACK_LIMITS = Object.freeze({
  trackBytes: 32 * 1024 * 1024,
  durationSeconds: 720,
  tracks: 128,
  customTracks: 123,
  customPlaylists: 26,
  catalogueTracks: 128,
  assets: 256,
  playlists: 32,
  playlistEntries: 128,
  assignments: 256,
  metadataBytes: 512 * 1024,
  managedBytes: 256 * 1024 * 1024,
  bundleBytes: 256 * 1024 * 1024,
  optionalBundleTargetBytes: 64 * 1024 * 1024,
});
export function freezeSoundtrack(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeSoundtrack(child);
    Object.freeze(value);
  }
  return value;
}
export const BUILTIN_SOUNDTRACK_TRACKS = freezeSoundtrack(
  DEFAULT_TRACKS.map((recipe) => ({
    id: `builtin.${recipe.id}`,
    kind: 'synth',
    title: recipe.name,
    artist: 'RevealLine',
    recipe: { ...recipe },
  })),
);
export const BUILTIN_SOUNDTRACK_PLAYLISTS = freezeSoundtrack([
  {
    id: 'builtin.all',
    title: 'RevealLine synth collection',
    trackIds: BUILTIN_SOUNDTRACK_TRACKS.map((t) => t.id),
    order: 'ordered',
    repeat: 'all',
  },
  ...BUILTIN_SOUNDTRACK_TRACKS.map((track) => ({
    id: `builtin.genre.${track.recipe.genre}`,
    title: `${MUSIC_STYLES.find((style) => style.id === track.recipe.genre).label}: ${track.title}`,
    trackIds: [track.id],
    order: 'ordered',
    repeat: 'all',
  })),
]);
const text = (v, max, empty = false) =>
  typeof v === 'string' && v.length <= max && (empty || v.trim().length > 0);
const whole = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const ownKeys = (value, fields, label) => {
  exactKeys(value, fields, label);
  required(
    fields.every((k) => Object.hasOwn(value, k)),
    `${label} has missing fields.`,
  );
};
const customId = (id) => stableId(id) && !id.startsWith('builtin.');
const copy = (v) =>
  boundedJSON(v, {
    maxBytes: SOUNDTRACK_LIMITS.metadataBytes,
    maxNodes: 30000,
    maxArray: 256,
    maxDepth: 8,
    maxString: 1024,
  });
export function resolveAudioTrack(value) {
  const track = copy(value);
  ownKeys(track, ['format', 'id', 'kind', 'title', 'artist', 'asset', 'rights'], 'audio track');
  required(
    track.format === AUDIO_TRACK_FORMAT && track.kind === 'mp3' && customId(track.id),
    'Unsupported audio track identity/kind.',
  );
  required(text(track.title, 120) && text(track.artist, 160, true), 'Invalid audio title/artist.');
  const asset = track.asset;
  ownKeys(
    asset,
    [
      'sha256',
      'bytes',
      'mime',
      'durationSeconds',
      'sampleRate',
      'channels',
      'mpegVersion',
      'frames',
    ],
    'audio asset',
  );
  required(
    typeof asset.sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(asset.sha256) &&
      asset.mime === 'audio/mpeg',
    'Invalid audio asset hash/type.',
  );
  required(
    whole(asset.bytes, SOUNDTRACK_LIMITS.trackBytes) && asset.bytes >= 24,
    'MP3 exceeds its 32 MiB budget.',
  );
  required(
    Number.isFinite(asset.durationSeconds) &&
      asset.durationSeconds > 0 &&
      asset.durationSeconds <= 720,
    'MP3 duration must be at most 12 minutes.',
  );
  required(
    [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(asset.sampleRate) &&
      [1, 2].includes(asset.channels) &&
      ['1', '2', '2.5'].includes(asset.mpegVersion) &&
      whole(asset.frames, 60000) &&
      asset.frames >= 2,
    'Invalid MP3 frame metadata.',
  );
  const rates =
    asset.mpegVersion === '1'
      ? [32000, 44100, 48000]
      : asset.mpegVersion === '2'
        ? [16000, 22050, 24000]
        : [8000, 11025, 12000];
  required(
    rates.includes(asset.sampleRate) &&
      asset.durationSeconds ===
        (asset.frames * (asset.mpegVersion === '1' ? 1152 : 576)) / asset.sampleRate,
    'Inconsistent MP3 frame duration/rate.',
  );
  ownKeys(track.rights, ['kind', 'credit', 'license', 'source'], 'audio provenance');
  required(
    ['original', 'licensed', 'personal'].includes(track.rights.kind) &&
      text(track.rights.credit, 280) &&
      text(track.rights.license, 280, track.rights.kind !== 'licensed') &&
      text(track.rights.source, 1024, true),
    'Invalid audio provenance.',
  );
  return freezeSoundtrack(track);
}
export function emptySoundtrackLibrary({ catalogue = false } = {}) {
  return freezeSoundtrack({
    format: catalogue ? SOUNDTRACK_FORMAT_V2 : SOUNDTRACK_FORMAT,
    ...(catalogue
      ? {
          catalogTracks: [],
          installedTrackIds: [],
          tags: {},
          listening: { mode: 'auto', genres: [...SOUNDTRACK_GENRES], installedOnly: false },
        }
      : {}),
    tracks: [],
    playlists: [],
    assignments: [],
    selection: { playlistId: null },
  });
}
export function resolveSoundtrackLibrary(value) {
  const library = copy(value);
  const catalogue = library.format === SOUNDTRACK_FORMAT_V2;
  ownKeys(
    library,
    [
      'format',
      'tracks',
      'playlists',
      'assignments',
      'selection',
      ...(catalogue ? ['catalogTracks', 'installedTrackIds', 'tags', 'listening'] : []),
      ...(catalogue && Object.hasOwn(library, 'bonusAlbums') ? ['bonusAlbums'] : []),
    ],
    'soundtrack library',
  );
  required(
    catalogue || library.format === SOUNDTRACK_FORMAT,
    'Unsupported soundtrack library format.',
  );
  required(
    Array.isArray(library.tracks) && library.tracks.length <= SOUNDTRACK_LIMITS.customTracks,
    'Soundtrack track count exceeds 128.',
  );
  library.tracks = library.tracks.map(resolveAudioTrack);
  if (catalogue) {
    if (Object.hasOwn(library, 'bonusAlbums')) {
      required(
        Array.isArray(library.bonusAlbums) && library.bonusAlbums.length <= 32,
        'Invalid bonus album count.',
      );
      const albumIds = new Set();
      for (const album of library.bonusAlbums) {
        ownKeys(album, ['id', 'trackIds', 'downloaded'], 'bonus album ownership');
        required(
          customId(album.id) && !albumIds.has(album.id) && typeof album.downloaded === 'boolean',
          'Invalid bonus album ownership.',
        );
        albumIds.add(album.id);
        required(
          Array.isArray(album.trackIds) &&
            album.trackIds.length > 0 &&
            album.trackIds.length <= SOUNDTRACK_LIMITS.customTracks &&
            new Set(album.trackIds).size === album.trackIds.length &&
            album.trackIds.every((id) => library.tracks.some((track) => track.id === id)),
          'Bonus album references missing or duplicate tracks.',
        );
      }
    }
    required(
      Array.isArray(library.catalogTracks) &&
        library.catalogTracks.length <= SOUNDTRACK_LIMITS.catalogueTracks,
      'Catalogue track count exceeds 128.',
    );
    library.catalogTracks = library.catalogTracks.map(resolveCatalogueTrack);
    required(
      Array.isArray(library.installedTrackIds) &&
        library.installedTrackIds.length <= SOUNDTRACK_LIMITS.catalogueTracks &&
        new Set(library.installedTrackIds).size === library.installedTrackIds.length &&
        library.installedTrackIds.every((id) =>
          library.catalogTracks.some((track) => track.id === id),
        ),
      'Invalid installed catalogue tracks.',
    );
    required(
      library.tags && typeof library.tags === 'object' && !Array.isArray(library.tags),
      'Invalid uploaded track tags.',
    );
    for (const [id, tags] of Object.entries(library.tags)) {
      required(
        library.tracks.some((track) => track.id === id),
        'Tags reference a missing uploaded track.',
      );
      library.tags[id] = resolveSoundtrackTags(tags);
    }
    ownKeys(library.listening, ['mode', 'genres', 'installedOnly'], 'listening settings');
    required(
      SOUNDTRACK_MODES.includes(library.listening.mode) &&
        typeof library.listening.installedOnly === 'boolean',
      'Invalid listening settings.',
    );
    validGenres(library.listening.genres, false);
  }
  const trackIds = new Set(BUILTIN_SOUNDTRACK_TRACKS.map((t) => t.id)),
    assets = new Map();
  for (const track of [...library.tracks, ...(library.catalogTracks || [])]) {
    required(!trackIds.has(track.id), 'Duplicate soundtrack track ID.');
    trackIds.add(track.id);
    const prior = assets.get(track.asset.sha256);
    required(
      !prior || canonicalJSON(prior) === canonicalJSON(track.asset),
      'One audio hash has conflicting metadata.',
    );
    assets.set(track.asset.sha256, track.asset);
  }
  required(
    Array.isArray(library.playlists) &&
      library.playlists.length <= SOUNDTRACK_LIMITS.customPlaylists,
    'Playlist count exceeds 32.',
  );
  const playlistIds = new Set(
    [...BUILTIN_SOUNDTRACK_PLAYLISTS, ...cataloguePlaylists(library)].map((p) => p.id),
  );
  for (const playlist of library.playlists) {
    ownKeys(playlist, ['id', 'title', 'trackIds', 'order', 'repeat'], 'playlist');
    required(
      customId(playlist.id) && !playlistIds.has(playlist.id) && text(playlist.title, 120),
      'Invalid or duplicate playlist.',
    );
    playlistIds.add(playlist.id);
    required(
      Array.isArray(playlist.trackIds) &&
        playlist.trackIds.length > 0 &&
        playlist.trackIds.length <= 128 &&
        playlist.trackIds.every((id) => trackIds.has(id)),
      'Playlist has missing tracks or invalid entry count.',
    );
    required(
      ['ordered', 'shuffle'].includes(playlist.order) &&
        ['all', 'one', 'off'].includes(playlist.repeat),
      'Unsupported playlist order/repeat.',
    );
  }
  required(
    Array.isArray(library.assignments) && library.assignments.length <= 256,
    'Assignment count exceeds 256.',
  );
  const assignmentKeys = new Set();
  for (const assignment of library.assignments) {
    ownKeys(assignment, ['scope', 'key', 'playlistId'], 'soundtrack assignment');
    required(
      ['global', 'theme', 'campaign', 'map'].includes(assignment.scope) &&
        (assignment.scope === 'global' ? assignment.key === null : text(assignment.key, 512)) &&
        playlistIds.has(assignment.playlistId),
      'Invalid soundtrack assignment.',
    );
    const key = JSON.stringify([assignment.scope, assignment.key]);
    required(!assignmentKeys.has(key), 'Duplicate soundtrack assignment.');
    assignmentKeys.add(key);
  }
  ownKeys(library.selection, ['playlistId'], 'soundtrack selection');
  required(
    library.selection.playlistId === null || playlistIds.has(library.selection.playlistId),
    'Selected playlist is unavailable.',
  );
  return freezeSoundtrack(library);
}
export function resolveSoundtrackSelection(value, context = {}) {
  const library = resolveSoundtrackLibrary(value),
    scope = copy(context);
  exactKeys(
    scope,
    ['mapKey', 'campaignKey', 'themeId', 'scene', 'installedTrackIds'],
    'soundtrack context',
  );
  for (const key of ['mapKey', 'campaignKey', 'themeId'])
    if (Object.hasOwn(scope, key))
      required(scope[key] === null || text(scope[key], 512), 'Invalid soundtrack context key.');
  required(
    scope.scene === undefined || ['menu', 'gameplay'].includes(scope.scene),
    'Invalid soundtrack scene.',
  );
  required(
    scope.installedTrackIds === undefined ||
      (Array.isArray(scope.installedTrackIds) &&
        scope.installedTrackIds.length <= SOUNDTRACK_LIMITS.catalogueTracks &&
        scope.installedTrackIds.every(stableId)),
    'Invalid installed soundtrack context.',
  );
  const playlists = [
    ...BUILTIN_SOUNDTRACK_PLAYLISTS,
    ...cataloguePlaylists(library),
    ...library.playlists,
  ];
  let id = library.selection.playlistId,
    source = 'explicit';
  if (
    id === null &&
    (library.format !== SOUNDTRACK_FORMAT_V2 || library.listening.mode === 'auto')
  ) {
    for (const [kind, key] of [
      ['map', scope.mapKey],
      ['campaign', scope.campaignKey],
      ['theme', scope.themeId],
      ['global', null],
    ]) {
      if (key === undefined) continue;
      const entry = library.assignments.find((a) => a.scope === kind && a.key === key);
      if (entry) {
        id = entry.playlistId;
        source = kind;
        break;
      }
    }
  }
  if (id === null && library.format === SOUNDTRACK_FORMAT_V2)
    return automaticSelection(library, scope);
  if (id === null) {
    id = 'builtin.all';
    source = 'default';
  }
  const playlist = playlists.find((p) => p.id === id);
  if (library.format === SOUNDTRACK_FORMAT_V2) {
    const unavailable = new Set(soundtrackOffloadedBonusTrackIds(library));
    const candidates = playlist.trackIds.filter((trackId) => !unavailable.has(trackId));
    const ids = library.listening.installedOnly
      ? installedSelection(library, scope, candidates)
      : candidates;
    return freezeSoundtrack({
      playlist: { ...playlist, trackIds: ids },
      source,
      ...(candidates.length !== playlist.trackIds.length
        ? {
            notice:
              'Album recordings are not downloaded. Use Download again in Community soundtracks.',
          }
        : !ids.length
          ? { notice: 'No tracks in this playlist are installed. Download its recordings first.' }
          : {}),
    });
  }
  return freezeSoundtrack({ playlist, source });
}
/** Presentation randomness only. Duplicate authored entries remain intentional. */
export function soundtrackOrder(playlist, { random = Math.random, previousTrackId = null } = {}) {
  const item = copy(playlist);
  ownKeys(item, ['id', 'title', 'trackIds', 'order', 'repeat'], 'playlist');
  required(
    stableId(item.id) &&
      text(item.title, 120) &&
      Array.isArray(item.trackIds) &&
      item.trackIds.length <= SOUNDTRACK_LIMITS.assets &&
      item.trackIds.every(stableId) &&
      ['ordered', 'shuffle'].includes(item.order) &&
      ['all', 'one', 'off'].includes(item.repeat),
    'Invalid playlist.',
  );
  required(
    typeof random === 'function' && (previousTrackId === null || stableId(previousTrackId)),
    'Invalid playlist random/previous input.',
  );
  const result = [...item.trackIds];
  if (item.order === 'shuffle') {
    for (let i = result.length - 1; i > 0; i--) {
      const n = random();
      required(Number.isFinite(n) && n >= 0 && n < 1, 'Playlist randomness must be in [0,1).');
      const j = Math.floor(n * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    if (result[0] === previousTrackId) {
      const next = result.findIndex((id) => id !== previousTrackId);
      if (next > 0) [result[0], result[next]] = [result[next], result[0]];
    }
  }
  return Object.freeze(result);
}

function validGenres(genres, empty = true) {
  required(
    Array.isArray(genres) &&
      genres.length <= SOUNDTRACK_GENRES.length &&
      (empty || genres.length > 0) &&
      new Set(genres).size === genres.length &&
      genres.every((genre) => SOUNDTRACK_GENRES.includes(genre)),
    'Invalid soundtrack genres.',
  );
}
export function resolveSoundtrackTags(value) {
  const tags = copy(value);
  ownKeys(tags, ['genres', 'role', 'energy', 'themes'], 'soundtrack tags');
  validGenres(tags.genres);
  required(
    ['any', 'menu', 'gameplay', 'intense'].includes(tags.role) &&
      Number.isInteger(tags.energy) &&
      tags.energy >= 1 &&
      tags.energy <= 5,
    'Invalid soundtrack role or energy.',
  );
  required(
    Array.isArray(tags.themes) &&
      tags.themes.length <= 32 &&
      new Set(tags.themes).size === tags.themes.length &&
      tags.themes.every(stableId),
    'Invalid soundtrack themes.',
  );
  return freezeSoundtrack(tags);
}
export function resolveCatalogueTrack(value) {
  const entry = copy(value);
  ownKeys(
    entry,
    ['format', 'id', 'kind', 'title', 'artist', 'asset', 'rights', 'edition', 'path', 'tags'],
    'catalogue track',
  );
  required(
    stableId(entry.id) && entry.id.startsWith('builtin.catalog.'),
    'Invalid catalogue track identity.',
  );
  required(stableId(entry.edition), 'Invalid catalogue edition.');
  required(
    text(entry.path, 512) &&
      /^[a-zA-Z0-9_./-]+\.mp3$/.test(entry.path) &&
      entry.path.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Invalid catalogue audio path.',
  );
  const { edition, path, tags, ...record } = entry;
  const track = resolveAudioTrack({ ...record, id: 'catalogue.validation' });
  const resolvedTags = resolveSoundtrackTags(tags);
  required(resolvedTags.genres.length > 0, 'Catalogue track requires a genre.');
  required(
    ['original', 'licensed'].includes(track.rights.kind),
    'Catalogue track needs distributable provenance.',
  );
  return freezeSoundtrack({ ...track, id: entry.id, edition, path, tags: resolvedTags });
}
export function resolveSoundtrackCatalogue(value) {
  const catalogue = copy(value);
  ownKeys(catalogue, ['format', 'edition', 'tracks'], 'soundtrack catalogue');
  required(
    catalogue.format === SOUNDTRACK_CATALOGUE_FORMAT &&
      stableId(catalogue.edition) &&
      Array.isArray(catalogue.tracks) &&
      catalogue.tracks.length <= SOUNDTRACK_LIMITS.catalogueTracks,
    'Invalid soundtrack catalogue.',
  );
  catalogue.tracks = catalogue.tracks.map(resolveCatalogueTrack);
  required(
    catalogue.tracks.every((track) => track.edition === catalogue.edition) &&
      new Set(catalogue.tracks.map((track) => track.id)).size === catalogue.tracks.length,
    'Catalogue identity or edition differs.',
  );
  const hashes = new Map();
  for (const track of catalogue.tracks) {
    const prior = hashes.get(track.asset.sha256);
    required(
      !prior || canonicalJSON(prior) === canonicalJSON(track.asset),
      'Catalogue audio hash has conflicting metadata.',
    );
    hashes.set(track.asset.sha256, track.asset);
  }
  return freezeSoundtrack(catalogue);
}
export function upgradeSoundtrackLibrary(value) {
  const library = resolveSoundtrackLibrary(value);
  if (library.format === SOUNDTRACK_FORMAT_V2) return library;
  return resolveSoundtrackLibrary({
    ...emptySoundtrackLibrary({ catalogue: true }),
    ...library,
    format: SOUNDTRACK_FORMAT_V2,
  });
}
/** Adopt pinned, reviewed catalogue metadata. Existing identities can never be silently replaced. */
export function setCatalogueTracks(value, source) {
  const library = upgradeSoundtrackLibrary(value);
  required(Array.isArray(source), 'Catalogue tracks must be an array.');
  const tracks = new Map(library.catalogTracks.map((track) => [track.id, track]));
  for (const entry of source) {
    const track = resolveCatalogueTrack(entry),
      prior = tracks.get(track.id);
    required(
      !prior || canonicalJSON(prior) === canonicalJSON(track),
      'Catalogue track identity conflicts with its saved pin.',
    );
    tracks.set(track.id, track);
  }
  return resolveSoundtrackLibrary({ ...library, catalogTracks: [...tracks.values()] });
}
/** Metadata references are separate from offline ownership. Upload originals are always owned. */
export function soundtrackReferencedTracks(value) {
  const library = resolveSoundtrackLibrary(value);
  return Object.freeze([...library.tracks, ...(library.catalogTracks || [])]);
}
export function soundtrackStoredTracks(value) {
  const library = resolveSoundtrackLibrary(value);
  const owned = new Set((library.bonusAlbums ?? []).flatMap((album) => album.trackIds));
  const downloaded = new Set(
    (library.bonusAlbums ?? [])
      .filter((album) => album.downloaded)
      .flatMap((album) => album.trackIds),
  );
  return Object.freeze([
    ...library.tracks.filter((track) => !owned.has(track.id) || downloaded.has(track.id)),
    ...(library.catalogTracks || []).filter((track) =>
      library.installedTrackIds.includes(track.id),
    ),
  ]);
}
/** Offloaded bonus pins never authorize a network request; only retained local ownership plays. */
export function soundtrackOffloadedBonusTrackIds(value) {
  const library = resolveSoundtrackLibrary(value);
  const owned = new Set((library.bonusAlbums ?? []).flatMap((album) => album.trackIds));
  const requiredHashes = new Set(
    soundtrackStoredTracks(library).map((track) => track.asset.sha256),
  );
  return Object.freeze(
    library.tracks
      .filter((track) => owned.has(track.id) && !requiredHashes.has(track.asset.sha256))
      .map((track) => track.id),
  );
}
export function soundtrackTracks(value) {
  return Object.freeze([...BUILTIN_SOUNDTRACK_TRACKS, ...soundtrackReferencedTracks(value)]);
}
const genreLabels = {
  synth90s: '90s synth',
  metal: 'Metal',
  ukrainian: 'Ukrainian',
  fusion: 'Fusion',
  mix: 'Mix all styles',
  auto: 'Automatic',
};
function trackTags(library, track) {
  if (track.tags) return track.tags;
  if (library.tags?.[track.id]) return library.tags[track.id];
  if (track.kind === 'synth')
    return {
      genres: [
        track.recipe.genre === 'metal' || track.recipe.genre === 'rock' ? 'metal' : 'synth90s',
      ],
      role: track.recipe.genre === 'ambient' ? 'menu' : 'any',
      energy: 3,
      themes: [],
    };
  return { genres: [], role: 'any', energy: 3, themes: [] };
}
function matchesMode(tags, mode, genres) {
  if (mode === 'fusion') return tags.genres.length > 1;
  if (SOUNDTRACK_GENRES.includes(mode)) return tags.genres.includes(mode);
  return tags.genres.length === 0 || tags.genres.some((genre) => genres.includes(genre));
}
function cataloguePlaylists(library) {
  if (library.format !== SOUNDTRACK_FORMAT_V2) return [];
  const tracks = [...BUILTIN_SOUNDTRACK_TRACKS, ...library.catalogTracks, ...library.tracks];
  return ['synth90s', 'metal', 'ukrainian', 'fusion', 'mix'].map((mode) => ({
    id: `builtin.playlist.${mode}`,
    title: genreLabels[mode],
    trackIds: tracks
      .filter((track) => matchesMode(trackTags(library, track), mode, SOUNDTRACK_GENRES))
      .map((track) => track.id),
    order: 'shuffle',
    repeat: 'all',
  }));
}
export function soundtrackPlaylists(value) {
  const library = resolveSoundtrackLibrary(value);
  return freezeSoundtrack([
    ...BUILTIN_SOUNDTRACK_PLAYLISTS,
    ...cataloguePlaylists(library),
    ...library.playlists,
  ]);
}
function installedSelection(library, context, ids) {
  const catalogue = new Set(library.catalogTracks.map((track) => track.id));
  const present = new Set(context.installedTrackIds ?? library.installedTrackIds);
  return ids.filter((id) => !catalogue.has(id) || present.has(id));
}
export function soundtrackFallbackSelection(mode, genres = SOUNDTRACK_GENRES) {
  required(SOUNDTRACK_MODES.includes(mode), 'Invalid soundtrack fallback mode.');
  validGenres(genres, false);
  const trackIds = BUILTIN_SOUNDTRACK_TRACKS.filter((track) =>
    matchesMode(trackTags({}, track), mode, genres),
  ).map((track) => track.id);
  return freezeSoundtrack({
    playlist: {
      id: `builtin.listening.${mode}.fallback`,
      title: genreLabels[mode],
      trackIds,
      order: 'shuffle',
      repeat: 'all',
    },
    source: trackIds.length ? 'catalogue-fallback' : 'unavailable',
    ...(trackIds.length
      ? {}
      : {
          notice: `No ${genreLabels[mode].toLowerCase()} tracks are available. Add matching music in the library.`,
        }),
  });
}
function automaticSelection(library, context) {
  // The host supplies scene/theme identity, not a validated level mood or energy target.
  // Track energy is retained for production curation; selection must not invent thresholds.
  const { mode, genres, installedOnly } = library.listening;
  let tracks = [...library.catalogTracks, ...library.tracks];
  tracks = tracks.filter((track) => matchesMode(trackTags(library, track), mode, genres));
  const unavailable = new Set(soundtrackOffloadedBonusTrackIds(library));
  const hasOffloaded = tracks.some((track) => unavailable.has(track.id));
  tracks = tracks.filter((track) => !unavailable.has(track.id));
  if (installedOnly) {
    const present = new Set(
      installedSelection(
        library,
        context,
        tracks.map((track) => track.id),
      ),
    );
    tracks = tracks.filter((track) => present.has(track.id));
  }
  const scene = context.scene ?? 'gameplay';
  const eligible = tracks.filter((track) => {
    const role = trackTags(library, track).role;
    return (
      role === 'any' ||
      (scene === 'menu' ? role === 'menu' : role === 'gameplay' || role === 'intense')
    );
  });
  tracks = eligible;
  if (mode === 'auto' && context.themeId) {
    const themed = tracks.filter((track) =>
      trackTags(library, track).themes.includes(context.themeId),
    );
    if (themed.length) tracks = themed;
  }
  if (!tracks.length) {
    const fallback = soundtrackFallbackSelection(mode, genres);
    return hasOffloaded
      ? freezeSoundtrack({
          ...fallback,
          notice:
            'Album recordings are not downloaded. Use Download again in Community soundtracks.',
        })
      : fallback;
  }
  return freezeSoundtrack({
    playlist: {
      id: `builtin.listening.${mode}.${scene}`,
      title: `${genreLabels[mode]} · ${scene === 'menu' ? 'Menu' : 'Play'}`,
      trackIds: tracks.map((track) => track.id),
      order: 'shuffle',
      repeat: 'all',
    },
    source: 'catalogue',
  });
}
