import { createHash } from 'node:crypto';
import { fixture, structuralProbe } from './soundtrack-fixtures.mjs';
import { emptySoundtrackLibrary } from '../../soundtrack.mjs';
import { prepareSoundtrackLibrary, exportSoundtrackBundle } from '../../soundtrack-bundle.mjs';
import { SOUNDTRACK_ALBUM_CATALOG_FORMAT } from '../../soundtrack-albums.mjs';

export async function albumFixture(id = 'qa.album', tag = id) {
  const raw = await fixture(tag),
    track = {
      ...raw.track,
      id: `${id}.track`,
      title: `${id} track`,
      rights: {
        kind: 'licensed',
        credit: 'Synthetic fixture',
        license: 'Test permission',
        source: 'https://example.test/creator',
      },
    };
  const library = {
    ...emptySoundtrackLibrary(),
    tracks: [track],
    playlists: [{ id, title: id, trackIds: [track.id], order: 'ordered', repeat: 'all' }],
    selection: { playlistId: id },
  };
  const prepared = await prepareSoundtrackLibrary(library, raw.assets, {
    probeMedia: structuralProbe,
  });
  const blob = await exportSoundtrackBundle(library, raw.assets),
    bytes = Buffer.from(await blob.arrayBuffer());
  const album = {
    id,
    title: id,
    genre: 'Test',
    description: 'Finite audio fixture',
    credit: 'Fixture',
    source: 'https://example.test/creator',
    path: `optional/soundtracks/${id}.rlsound`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    library,
  };
  return { album, prepared, blob, bytes, track };
}
export function albumCatalog(...albums) {
  return { format: SOUNDTRACK_ALBUM_CATALOG_FORMAT, albums };
}
export function responseFor(body, url, options) {
  const response = new Response(body, options);
  Object.defineProperty(response, 'url', { value: url });
  return response;
}
