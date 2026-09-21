import { canonicalJSON, required } from './data-json.mjs';
import { resolveSoundtrackCatalogue, soundtrackRights, SOUNDTRACK_LIMITS } from './soundtrack.mjs';
import { createSoundtrackArchiveResolver } from './soundtrack-archive.mjs';
import { inspectMP3, throwIfSoundtrackAborted } from './mp3.mjs';
import {
  soundtrackDownloadURL,
  readSoundtrackDownload,
  soundtrackDownloadOperation,
} from './soundtrack-album-download.mjs';

const rootURL = new URL('../', import.meta.url).href;

/** Only the shipped catalogue and code-owned archive admission grant network authority. */
export function createSoundtrackSource({
  catalogue,
  readLocal = () => null,
  installedOnly = () => false,
  fetch: request = globalThis.fetch,
  baseURL = rootURL,
  archives = [],
  archive,
} = {}) {
  const trusted = resolveSoundtrackCatalogue(catalogue);
  const archiveSource = createSoundtrackArchiveResolver({
    archives: archive ? [...archives, archive] : archives,
    fetch: request,
  });
  const byHash = new Map(trusted.tracks.map((track) => [track.asset.sha256, track]));
  return Object.freeze({
    catalogue: trusted,
    async readAsset(
      hash,
      {
        signal,
        download = false,
        purpose = download ? 'offline' : 'playback',
        localOnly = false,
      } = {},
    ) {
      required(typeof localOnly === 'boolean', 'Invalid local soundtrack acquisition policy.');
      required(
        ['playback', 'offline', 'export'].includes(purpose),
        'Unknown soundtrack byte purpose.',
      );
      const track = byHash.get(hash);
      const permission = {
        playback: 'webPlayback',
        offline: 'offlineCache',
        export: 'redistribute',
      }[purpose];
      if (track)
        required(
          soundtrackRights(track, { catalogue: trusted })[permission] === 'allowed',
          `This recording is not approved for ${purpose}. Preserve its reference instead.`,
        );
      throwIfSoundtrackAborted(signal);
      const local = await readLocal(hash, { signal });
      throwIfSoundtrackAborted(signal);
      if (local) return local;
      // Silent preparation may verify an owned original, but never authorizes
      // an archive inventory or recording request merely by opening a page.
      if (localOnly) return null;
      required(track, 'This recording is missing locally. Restore its complete soundtrack backup.');
      required(
        purpose !== 'playback' || !installedOnly(),
        'Installed only is on. Download this album before listening offline.',
      );

      return soundtrackDownloadOperation(
        async (current, cleanupTimeoutMs) => {
          const url = track.archiveId
            ? await archiveSource.urlFor(track, { signal: current, cleanupTimeoutMs })
            : soundtrackDownloadURL(track.path, baseURL);
          const blob = await readSoundtrackDownload(url, {
            fetch: request,
            signal: current,
            limit: SOUNDTRACK_LIMITS.trackBytes,
            exactBytes: track.asset.bytes,
            cleanupTimeoutMs,
            ...(track.archiveId ? { credentials: 'omit', mode: 'cors' } : {}),
          });
          const actual = await inspectMP3(blob, { signal: current });
          required(
            canonicalJSON(actual) === canonicalJSON(track.asset),
            'Downloaded recording differs from its pinned catalogue original.',
          );
          return blob.slice(0, blob.size, 'audio/mpeg');
        },
        { signal, timeoutMs: 60000 },
      );
    },
  });
}

export function fetchSoundtrackCatalogue({
  fetch: request = globalThis.fetch,
  baseURL = rootURL,
  signal,
} = {}) {
  const url = soundtrackDownloadURL('game/content/soundtrack-catalogue.json', baseURL);
  return soundtrackDownloadOperation(
    async (current, cleanupTimeoutMs) => {
      const blob = await readSoundtrackDownload(url, {
        fetch: request,
        signal: current,
        limit: SOUNDTRACK_LIMITS.metadataBytes,
        cleanupTimeoutMs,
      });
      throwIfSoundtrackAborted(current);
      const raw = await blob.text();
      throwIfSoundtrackAborted(current);
      return resolveSoundtrackCatalogue(JSON.parse(raw));
    },
    { signal, timeoutMs: 15000 },
  );
}
