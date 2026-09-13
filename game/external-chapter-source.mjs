import { validateExternalChapter, prepareExternalChapter } from './external-chapter.mjs';

// Explicit source-only registry. No automatic install or public catalog entry.
export const SOURCE_EXTERNAL_CHAPTER = validateExternalChapter({
  format: 'revealline-external-chapter.v1',
  id: 'original-fpv-pressure-external',
  revision: 1,
  source: {
    id: 'original-fpv-pressure',
    bytes: 10719959,
    sha256: 'dc7b29694ec409c629e4006f11b96a2834937bf0f846e9dd9f29c5981aa5daa9',
  },
  pack: {
    bytes: 9398,
    sha256: '09fabce4207875dc73eefe49aaea8bc4aed491855e756b9dfda39cd4c35abe2c',
  },
  media: {
    bytes: 8037391,
    sha256: 'abaf15494ff0f3c5b3d70ffff7b41469346b8b322d1ffbe9cc8de930fbac780e',
  },
  campaignKey: 'original-fpv-pressure-lines-external/1/60d1f9c4f1304d7d',
  themeId: 'fpv',
  originals: [
    {
      assetId: 'external-fpv-poster-1',
      presentationId: 'external-fpv-poster-1-presentation',
      levelId: 'original-fpv-orchard-crossing-external',
      levelRevision: '1',
      sha256: '20f3a1c03a074d3aae981c989cb063a092d577cb0c0318ea4a1fd1df1d0653fc',
      bytes: 2999096,
      mime: 'image/png',
      width: 1774,
      height: 887,
    },
    {
      assetId: 'external-fpv-poster-2',
      presentationId: 'external-fpv-poster-2-presentation',
      levelId: 'original-fpv-courtyard-exits-external',
      levelRevision: '1',
      sha256: 'e87e23b60bb32a51d92aa535737420c87ae25d56520ba624eee39054ca2fce62',
      bytes: 2912184,
      mime: 'image/png',
      width: 1774,
      height: 887,
    },
    {
      assetId: 'external-fpv-poster-3',
      presentationId: 'external-fpv-poster-3-presentation',
      levelId: 'original-fpv-night-crossfire-external',
      levelRevision: '1',
      sha256: '139a1860eb42e8c315b4bcd997acb1d41fa315db29a1330ebba89b474d67b618',
      bytes: 2113587,
      mime: 'image/png',
      width: 1774,
      height: 887,
    },
  ],
});

// Later candidates must be explicitly reviewed and appended here; persisted files
// never self-register as trusted descriptors. The public catalog is separate.
export const SOURCE_EXTERNAL_CHAPTERS = Object.freeze([SOURCE_EXTERNAL_CHAPTER]);

export function prepareSourceExternalChapter({ pack, media }, { signal } = {}) {
  return prepareExternalChapter(SOURCE_EXTERNAL_CHAPTER, { pack, media }, { signal });
}
