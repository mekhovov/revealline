import { managedIndexedDB } from './managed-idb.mjs';
import { readFile } from 'node:fs/promises';
import { inspectMP3, prepareMP3Import } from '../../mp3.mjs';
import { emptySoundtrackLibrary } from '../../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../../soundtrack-bundle.mjs';

export const silenceBytes = await readFile(
  new URL('../fixtures/audio/silence-mpeg1-layer3.mp3', import.meta.url),
);
export const metadata = {
  id: 'qa.silence',
  title: 'Synthetic coded silence',
  artist: 'RevealLine tests',
  rights: { kind: 'original', credit: 'Synthetic MPEG frame fixture', license: '', source: '' },
};
// An explicit test seam; it does not certify browser decoding or audible playback.
export const structuralProbe = async (blob) => ({
  durationSeconds: (await inspectMP3(blob)).durationSeconds,
});
export async function fixture(tag = '') {
  const blob = tag
    ? new Blob([new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, tag.length]), tag, silenceBytes])
    : new Blob([silenceBytes]);
  const imported = await prepareMP3Import(blob, metadata, { probeMedia: structuralProbe });
  const library = {
    ...emptySoundtrackLibrary(),
    tracks: [imported.track],
    playlists: [
      {
        id: 'qa.mix',
        title: 'Mixed synth and imported audio',
        trackIds: ['builtin.fpv', imported.track.id],
        order: 'ordered',
        repeat: 'all',
      },
    ],
  };
  // Keep fixture coupled to the actual builtin ID rather than duplicating an invented name.
  const { BUILTIN_SOUNDTRACK_TRACKS } = await import('../../soundtrack.mjs');
  library.playlists[0].trackIds[0] = BUILTIN_SOUNDTRACK_TRACKS[0].id;
  const assets = [{ sha256: imported.track.asset.sha256, blob }];
  const prepared = await prepareSoundtrackLibrary(library, assets, { probeMedia: structuralProbe });
  return { blob, library, assets, prepared, track: imported.track };
}

/** Backward-compatible P3 instrumentation; allPuts exposes shared-manager writes too. */
export const memoryIndexedDB = managedIndexedDB;
