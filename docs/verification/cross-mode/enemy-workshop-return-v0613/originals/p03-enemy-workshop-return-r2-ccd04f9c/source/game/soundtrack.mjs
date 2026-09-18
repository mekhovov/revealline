import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from './data-json.mjs';
import { DEFAULT_TRACKS, MUSIC_STYLES } from './ui/music.mjs';

export const SOUNDTRACK_FORMAT = 'revealline-soundtrack.v1';
export const AUDIO_TRACK_FORMAT = 'revealline-audio-track.v1';
export const SOUNDTRACK_LIMITS = Object.freeze({
  trackBytes: 32 * 1024 * 1024,
  durationSeconds: 720,
  tracks: 128,
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
export function emptySoundtrackLibrary() {
  return freezeSoundtrack({
    format: SOUNDTRACK_FORMAT,
    tracks: [],
    playlists: [],
    assignments: [],
    selection: { playlistId: null },
  });
}
export function resolveSoundtrackLibrary(value) {
  const library = copy(value);
  ownKeys(
    library,
    ['format', 'tracks', 'playlists', 'assignments', 'selection'],
    'soundtrack library',
  );
  required(library.format === SOUNDTRACK_FORMAT, 'Unsupported soundtrack library format.');
  required(
    Array.isArray(library.tracks) &&
      library.tracks.length + BUILTIN_SOUNDTRACK_TRACKS.length <= SOUNDTRACK_LIMITS.tracks,
    'Soundtrack track count exceeds 128.',
  );
  library.tracks = library.tracks.map(resolveAudioTrack);
  const trackIds = new Set(BUILTIN_SOUNDTRACK_TRACKS.map((t) => t.id)),
    assets = new Map();
  for (const track of library.tracks) {
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
      library.playlists.length + BUILTIN_SOUNDTRACK_PLAYLISTS.length <= SOUNDTRACK_LIMITS.playlists,
    'Playlist count exceeds 32.',
  );
  const playlistIds = new Set(BUILTIN_SOUNDTRACK_PLAYLISTS.map((p) => p.id));
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
  exactKeys(scope, ['mapKey', 'campaignKey', 'themeId'], 'soundtrack context');
  for (const key of Object.keys(scope))
    required(scope[key] === null || text(scope[key], 512), 'Invalid soundtrack context key.');
  const playlists = [...BUILTIN_SOUNDTRACK_PLAYLISTS, ...library.playlists];
  let id = library.selection.playlistId,
    source = 'explicit';
  if (id === null) {
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
  if (id === null) {
    id = 'builtin.all';
    source = 'default';
  }
  return freezeSoundtrack({ playlist: playlists.find((p) => p.id === id), source });
}
/** Presentation randomness only. Duplicate authored entries remain intentional. */
export function soundtrackOrder(playlist, { random = Math.random, previousTrackId = null } = {}) {
  const item = copy(playlist);
  ownKeys(item, ['id', 'title', 'trackIds', 'order', 'repeat'], 'playlist');
  required(
    stableId(item.id) &&
      text(item.title, 120) &&
      Array.isArray(item.trackIds) &&
      item.trackIds.length > 0 &&
      item.trackIds.length <= 128 &&
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
