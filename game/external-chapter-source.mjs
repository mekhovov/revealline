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

// Reviewed candidates are literal source authority, never inferred from uploaded
// files, installed names or catalog ordering. Release publication is separate.
const routeDescriptors = [
  {
    format: 'revealline-external-chapter.v1',
    id: 'route-worlds-ukraine',
    revision: 1,
    source: {
      id: 'fpv-route-choices',
      bytes: 11949780,
      sha256: '589543f693e650355216aa702844a7726b7cd6e318900b8583702fd0650ae989',
    },
    pack: {
      bytes: 8614,
      sha256: '9f1c9fe462d7b962b6d47bdca0faf1f18cca1066abdbce13fb161caa124c13fb',
    },
    media: {
      bytes: 8825996,
      sha256: '41f346b01ab86bf0bbcc7205563666be9c369d07734eaddac56e16f72c5cef94',
    },
    campaignKey: 'route-worlds-ukraine/1/86e773bc0cd5d0da',
    themeId: 'ukraine',
    originals: [
      {
        assetId: 'route-worlds-ukraine-poster-1',
        presentationId: 'route-worlds-ukraine-poster-1-presentation',
        levelId: 'route-worlds-ukraine-foundry',
        levelRevision: '1',
        sha256: '571f01cc57ba79bfe07828b9e465f979b597edfe70764f88f454e781dd7b7719',
        bytes: 2780010,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
      {
        assetId: 'route-worlds-ukraine-poster-2',
        presentationId: 'route-worlds-ukraine-poster-2-presentation',
        levelId: 'route-worlds-ukraine-depot',
        levelRevision: '1',
        sha256: '18e32f319b61367907a70e22f58310d7206bf2c6aeb7c07e888f3baebe80e9f5',
        bytes: 3107900,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
      {
        assetId: 'route-worlds-ukraine-poster-3',
        presentationId: 'route-worlds-ukraine-poster-3-presentation',
        levelId: 'route-worlds-ukraine-switchback',
        levelRevision: '1',
        sha256: '6c07adf7345b9e4d7cf1a1426bbb3a2f3e39e57389e7367c0396f39f52458f8f',
        bytes: 2926966,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
    ],
  },
  {
    format: 'revealline-external-chapter.v1',
    id: 'route-worlds-retro',
    revision: 1,
    source: {
      id: 'fpv-route-choices',
      bytes: 11949780,
      sha256: '589543f693e650355216aa702844a7726b7cd6e318900b8583702fd0650ae989',
    },
    pack: {
      bytes: 8516,
      sha256: '4d765a182603ff8db78c0c4db446a9100146a4dabcbd0a4587a661ae506c5271',
    },
    media: {
      bytes: 7589742,
      sha256: 'f42fa22b651dd32f4627f2260625b64ca52bfb8c871341637705658b718eec5d',
    },
    campaignKey: 'route-worlds-retro/1/c2ebcf492cdb07a8',
    themeId: 'retro',
    originals: [
      {
        assetId: 'route-worlds-retro-poster-1',
        presentationId: 'route-worlds-retro-poster-1-presentation',
        levelId: 'route-worlds-retro-foundry',
        levelRevision: '1',
        sha256: '39e0cb08e60bcdfafa93a4e57be6a2fb6751c6d72659360e2aa84534a57568a7',
        bytes: 2378256,
        mime: 'image/png',
        width: 1672,
        height: 940,
      },
      {
        assetId: 'route-worlds-retro-poster-2',
        presentationId: 'route-worlds-retro-poster-2-presentation',
        levelId: 'route-worlds-retro-depot',
        levelRevision: '1',
        sha256: 'a18d10b88cbd52432436c473b45405950708df48ff115264ea47a56500cba80f',
        bytes: 2760396,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
      {
        assetId: 'route-worlds-retro-poster-3',
        presentationId: 'route-worlds-retro-poster-3-presentation',
        levelId: 'route-worlds-retro-switchback',
        levelRevision: '1',
        sha256: '9e21db2d3ce3b29eef175afb6244a0bf4a1a63f3009803619b681cbb4d67b6b4',
        bytes: 2440128,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
    ],
  },
  {
    format: 'revealline-external-chapter.v1',
    id: 'route-worlds-coupa',
    revision: 1,
    source: {
      id: 'fpv-route-choices',
      bytes: 11949780,
      sha256: '589543f693e650355216aa702844a7726b7cd6e318900b8583702fd0650ae989',
    },
    pack: {
      bytes: 8526,
      sha256: 'ab535097b32996805a9eb36df32f22647a6a3a3e8b0d10e9526667519afef49f',
    },
    media: {
      bytes: 8281102,
      sha256: '22a4201d6bff063e8c4704323e0605cc20626d949e8c265264d4f4c4f7d0bb03',
    },
    campaignKey: 'route-worlds-coupa/1/57042d08e1681c86',
    themeId: 'coupa',
    originals: [
      {
        assetId: 'route-worlds-coupa-poster-1',
        presentationId: 'route-worlds-coupa-poster-1-presentation',
        levelId: 'route-worlds-coupa-foundry',
        levelRevision: '1',
        sha256: '0f0c8022f3b80732c24131324ce3ecf404219f5de6546ead11ff825e3dbed518',
        bytes: 2725160,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
      {
        assetId: 'route-worlds-coupa-poster-2',
        presentationId: 'route-worlds-coupa-poster-2-presentation',
        levelId: 'route-worlds-coupa-depot',
        levelRevision: '1',
        sha256: '8abf21258aef8cee936909fe7d2d8c4eb86a9eb8aff61c6fae6e6f918f5a8e3d',
        bytes: 2686912,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
      {
        assetId: 'route-worlds-coupa-poster-3',
        presentationId: 'route-worlds-coupa-poster-3-presentation',
        levelId: 'route-worlds-coupa-switchback',
        levelRevision: '1',
        sha256: '65d18bb0e98d901b9ba4820e62724dfbe32da6cd31c5580fe03096eedbfd39f0',
        bytes: 2858095,
        mime: 'image/png',
        width: 1672,
        height: 941,
      },
    ],
  },
].map((descriptor) => validateExternalChapter(descriptor));
export const SOURCE_EXTERNAL_CHAPTERS = Object.freeze([
  SOURCE_EXTERNAL_CHAPTER,
  ...routeDescriptors,
]);
const names = [
  'FPV Front · Pressure Pictures',
  'Ukraine Atlas · Route Choices',
  '1994 Forever · Route Choices',
  'Spend Network · Route Choices',
];
export const SOURCE_EXTERNAL_EDITIONS = Object.freeze(
  SOURCE_EXTERNAL_CHAPTERS.map((descriptor, index) =>
    Object.freeze({
      descriptor,
      name: names[index],
      mode: index === 0 ? 'Arcade' : 'Tactical',
      levels: descriptor.originals.length,
      description:
        index === 0
          ? 'Steer through three Pressure Pictures maps. Reconnect each cut to stop safely and reveal the scene.'
          : 'Choose an exit, time a carrier field or take the equipment-free gate, then compare a signal-safe shortcut with the safe rim.',
    }),
  ),
);
export function sourceExternalChapter(id) {
  const descriptor = SOURCE_EXTERNAL_CHAPTERS.find((entry) => entry.id === id);
  if (!descriptor) throw new Error('Choose a registered external chapter.');
  return descriptor;
}
export function prepareSourceExternalChapter(
  { pack, media },
  { chapterId = SOURCE_EXTERNAL_CHAPTER.id, signal } = {},
) {
  return prepareExternalChapter(sourceExternalChapter(chapterId), { pack, media }, { signal });
}
