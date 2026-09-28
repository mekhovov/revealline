import { canonicalJSON, required } from './data-json.mjs';
import { resolveSoundtrackCatalogue, SOUNDTRACK_LIMITS } from './soundtrack.mjs';
import { inspectMP3, throwIfSoundtrackAborted } from './mp3.mjs';
import {
  soundtrackDownloadURL,
  readSoundtrackDownload,
  soundtrackDownloadOperation,
} from './soundtrack-album-download.mjs';

const rootURL = new URL('../', import.meta.url).href;

/** Only the shipped, version-local catalogue grants network authority. Imported pins never do. */
export function createSoundtrackSource({
  catalogue,
  readLocal = () => null,
  installedOnly = () => false,
  fetch: request = globalThis.fetch,
  baseURL = rootURL,
} = {}) {
  const trusted = resolveSoundtrackCatalogue(catalogue);
  const byHash = new Map(trusted.tracks.map((track) => [track.asset.sha256, track]));
  return Object.freeze({
    catalogue: trusted,
    async readAsset(hash, { signal, download = false } = {}) {
      throwIfSoundtrackAborted(signal);
      const local = await readLocal(hash, { signal });
      throwIfSoundtrackAborted(signal);
      if (local) return local;
      const track = byHash.get(hash);
      required(track, 'This recording is missing locally. Restore its complete soundtrack backup.');
      required(
        download || !installedOnly(),
        'Installed only is on. Download this album before listening offline.',
      );
      const url = soundtrackDownloadURL(track.path, baseURL);
      return soundtrackDownloadOperation(
        async (current, cleanupTimeoutMs) => {
          const blob = await readSoundtrackDownload(url, {
            fetch: request,
            signal: current,
            limit: SOUNDTRACK_LIMITS.trackBytes,
            exactBytes: track.asset.bytes,
            cleanupTimeoutMs,
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
