import { SOUNDTRACK_COLLECTIONS } from './content/soundtrack-catalogue.mjs';
import { SOUNDTRACK_GENRE_LABELS, soundtrackRights } from './soundtrack.mjs';

/** One album/volume definition for Audio settings and the offline catalogue. */
export function soundtrackDownloadVolumes(catalogue, albums = SOUNDTRACK_COLLECTIONS) {
  if (!catalogue) return [];
  const byId = new Map(catalogue.tracks.map((track) => [track.id, track]));
  const included = albums.filter((album) => album.trackIds.every((id) => byId.has(id)));
  const used = new Set(included.flatMap((album) => album.trackIds));
  const collections = [
    ...Object.entries(SOUNDTRACK_GENRE_LABELS).map(([id, title]) => ({
      id,
      title,
      accepts: (track) =>
        track.tags.genres[0] === id && !track.id.startsWith('builtin.catalog.ua-fpv.'),
    })),
    {
      id: 'ua-fpv',
      title: 'UA-FPV',
      accepts: (track) => track.id.startsWith('builtin.catalog.ua-fpv.'),
    },
  ];
  return [
    ...included.map((album) => ({
      id: `album-${album.id.slice('builtin.album.'.length)}`,
      title: album.title,
      playlistId: album.id,
      tracks: album.trackIds.map((id) => byId.get(id)),
    })),
    ...collections.flatMap(({ id, title, accepts }) => {
      const tracks = catalogue.tracks.filter(
        (track) =>
          !used.has(track.id) &&
          accepts(track) &&
          soundtrackRights(track, { catalogue }).offlineCache === 'allowed',
      );
      return Array.from({ length: Math.ceil(tracks.length / 6) }, (_, index) => ({
        id: `${id}-${index + 1}`,
        title: `${title} · Volume ${index + 1}`,
        tracks: tracks.slice(index * 6, (index + 1) * 6),
      }));
    }),
  ];
}
