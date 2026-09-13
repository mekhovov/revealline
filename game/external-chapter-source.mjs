import { validateExternalChapter, prepareExternalChapter } from './external-chapter.mjs';

// Code-owned exact descriptors; installation and build publication remain explicit.
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
      bytes: 8405,
      sha256: '911ac4781505be1b405c33994a749990aa175a457ae020cbe0d1bcadda87abc0',
    },
    media: {
      bytes: 8825887,
      sha256: '39702f79ae56b12430d6f44ac201704ada77d4ae1b3db4f0235d46ed822ed0e0',
    },
    campaignKey: 'route-worlds-ukraine/1/6fc246baf830fe27',
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
      bytes: 8307,
      sha256: 'ef63420ef94edeecf56cd13f1a77c75afef9a5be6ec4c0d5d5814d002f7962b4',
    },
    media: {
      bytes: 7589633,
      sha256: 'e47adb1f39845cfab801ed70ebb7127815b80667c6b33bfe763cbd4c1e10fd34',
    },
    campaignKey: 'route-worlds-retro/1/31673372d46ee993',
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
      bytes: 8317,
      sha256: '96d6c0e6612197a542ec28d31132a20e0e945c1e12407109ddedad04ac0b0813',
    },
    media: {
      bytes: 8280993,
      sha256: 'f26c91482325aaa0ea7d7484d9aa2de5f2209b1a8fcfc2ba518eb145f8ddd77f',
    },
    campaignKey: 'route-worlds-coupa/1/708c553521008c7d',
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
const sentinelDescriptor = validateExternalChapter({
  format: 'revealline-external-chapter.v1',
  id: 'sentinel-circuit-fpv',
  revision: 1,
  source: {
    id: 'sentinel-circuit',
    bytes: 8943,
    sha256: 'cf6009eeadef504d033de0dd27f33aa3d6405caf1954a6417cbdfc09bc566b40',
  },
  pack: {
    bytes: 9238,
    sha256: 'ae2c1489c27afd2f492472d00605a57a65fd1d2c154e63b1b2c17b48bca323cb',
  },
  media: {
    bytes: 8596058,
    sha256: 'ca68ec6d1c7b1ade630227f810416136bd862f956b9e26dc0a0233e7d28c2e3c',
  },
  campaignKey: 'sentinel-circuit-fpv/1/398c82081d2d49df',
  themeId: 'fpv',
  originals: [
    {
      assetId: 'sentinel-circuit-fpv-poster-1',
      presentationId: 'sentinel-circuit-fpv-poster-1-presentation',
      levelId: 'sentinel-circuit-fpv-listening-court',
      levelRevision: '1',
      sha256: '1fc560183995092042e7ddbdfe7020412498f177f1f57cbae2e987c78fdb70e1',
      bytes: 2948372,
      mime: 'image/png',
      width: 1774,
      height: 887,
    },
    {
      assetId: 'sentinel-circuit-fpv-poster-2',
      presentationId: 'sentinel-circuit-fpv-poster-2-presentation',
      levelId: 'sentinel-circuit-fpv-switchyard-gates',
      levelRevision: '1',
      sha256: 'd6160676bdd2bb8b1e0f79bcc39736321881a9320f1482a8c844ab4c673cc6b3',
      bytes: 2933729,
      mime: 'image/png',
      width: 1774,
      height: 887,
    },
    {
      assetId: 'sentinel-circuit-fpv-poster-3',
      presentationId: 'sentinel-circuit-fpv-poster-3-presentation',
      levelId: 'sentinel-circuit-fpv-open-circuit',
      levelRevision: '1',
      sha256: '102d6083b7dcc21a6a310e80e6e19ee1357fa7f117e3de895db8848829426fe3',
      bytes: 2701967,
      mime: 'image/png',
      width: 1774,
      height: 887,
    },
  ],
});
const sentinelThemeDescriptors = [
  {
    format: 'revealline-external-chapter.v1',
    id: 'sentinel-circuit-ukraine',
    revision: 1,
    source: {
      id: 'sentinel-circuit',
      bytes: 8943,
      sha256: 'cf6009eeadef504d033de0dd27f33aa3d6405caf1954a6417cbdfc09bc566b40',
    },
    pack: {
      bytes: 9440,
      sha256: 'b567d8901dcec9b4964ce5ada8f64276f7754f8dc537c9002703d746fcbcdd85',
    },
    media: {
      bytes: 8175624,
      sha256: 'dc95ace9a12923999c2a740cccfffaa073542344e190c49b5d3b2310ea459afd',
    },
    campaignKey: 'sentinel-circuit-ukraine/1/2c5a77757c64c4d1',
    themeId: 'ukraine',
    originals: [
      {
        assetId: 'sentinel-circuit-ukraine-poster-1',
        presentationId: 'sentinel-circuit-ukraine-poster-1-presentation',
        levelId: 'sentinel-circuit-ukraine-listening-court',
        levelRevision: '1',
        sha256: 'f67723506534671cf8a1979d45f07f2fb442ba08485009924f211540a54bdb91',
        bytes: 3018491,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
      {
        assetId: 'sentinel-circuit-ukraine-poster-2',
        presentationId: 'sentinel-circuit-ukraine-poster-2-presentation',
        levelId: 'sentinel-circuit-ukraine-switchyard-gates',
        levelRevision: '1',
        sha256: '2d8864ab2d18b130d80f0f8b3738689f00cf65e68093286753e5485db1c3d0a3',
        bytes: 2682645,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
      {
        assetId: 'sentinel-circuit-ukraine-poster-3',
        presentationId: 'sentinel-circuit-ukraine-poster-3-presentation',
        levelId: 'sentinel-circuit-ukraine-open-circuit',
        levelRevision: '1',
        sha256: '47fde83552f6fc155f4efc41ca834c8a672b116fb392c5bdd893d6f8e6565ebb',
        bytes: 2462247,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
    ],
  },
  {
    format: 'revealline-external-chapter.v1',
    id: 'sentinel-circuit-retro',
    revision: 1,
    source: {
      id: 'sentinel-circuit',
      bytes: 8943,
      sha256: 'cf6009eeadef504d033de0dd27f33aa3d6405caf1954a6417cbdfc09bc566b40',
    },
    pack: {
      bytes: 9404,
      sha256: 'eab41d563f717170dc0c0077aa18b1656d2845e102b76e719a9daca6e5886545',
    },
    media: {
      bytes: 7553086,
      sha256: 'e8e9c90ba2c154d0a7c23fddddb4592025b8133956d70ee6bd35443540090b2e',
    },
    campaignKey: 'sentinel-circuit-retro/1/e8edd91a796a9b65',
    themeId: 'retro',
    originals: [
      {
        assetId: 'sentinel-circuit-retro-poster-1',
        presentationId: 'sentinel-circuit-retro-poster-1-presentation',
        levelId: 'sentinel-circuit-retro-listening-court',
        levelRevision: '1',
        sha256: '93c98fc631c7148040d42d8818153e55c32a562096dfc39c66af7d008df9e6cf',
        bytes: 2455383,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
      {
        assetId: 'sentinel-circuit-retro-poster-2',
        presentationId: 'sentinel-circuit-retro-poster-2-presentation',
        levelId: 'sentinel-circuit-retro-switchyard-gates',
        levelRevision: '1',
        sha256: '0acd0b721c9d066e890970a1e6d429f4d2ccb8d94b31893e2fdae34f37a75239',
        bytes: 2662328,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
      {
        assetId: 'sentinel-circuit-retro-poster-3',
        presentationId: 'sentinel-circuit-retro-poster-3-presentation',
        levelId: 'sentinel-circuit-retro-open-circuit',
        levelRevision: '1',
        sha256: '03a1ee0b83a70df661885d0c9da0c2830a2349b583556be1012ee07264405eee',
        bytes: 2423183,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
    ],
  },
  {
    format: 'revealline-external-chapter.v1',
    id: 'sentinel-circuit-coupa',
    revision: 1,
    source: {
      id: 'sentinel-circuit',
      bytes: 8943,
      sha256: 'cf6009eeadef504d033de0dd27f33aa3d6405caf1954a6417cbdfc09bc566b40',
    },
    pack: {
      bytes: 9427,
      sha256: '0fc200adfd509d7a993f24c73432195e314b4450b2ef45fd601b523f62464c6c',
    },
    media: {
      bytes: 7416321,
      sha256: '185e104975706717deb11ad6e4dc91b1cedc6680755fa9174583ceec0660da16',
    },
    campaignKey: 'sentinel-circuit-coupa/1/8459eb3ba67608e6',
    themeId: 'coupa',
    originals: [
      {
        assetId: 'sentinel-circuit-coupa-poster-1',
        presentationId: 'sentinel-circuit-coupa-poster-1-presentation',
        levelId: 'sentinel-circuit-coupa-listening-court',
        levelRevision: '1',
        sha256: '8aab2381420f0b127eb98b402de8c7b2af2fc24d471a61ce6180b0f17910959d',
        bytes: 2767187,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
      {
        assetId: 'sentinel-circuit-coupa-poster-2',
        presentationId: 'sentinel-circuit-coupa-poster-2-presentation',
        levelId: 'sentinel-circuit-coupa-switchyard-gates',
        levelRevision: '1',
        sha256: '1395c68c2742d979eeb811be85dbf1352dfb78f114c1352112fac9937ec5e96a',
        bytes: 2187660,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
      {
        assetId: 'sentinel-circuit-coupa-poster-3',
        presentationId: 'sentinel-circuit-coupa-poster-3-presentation',
        levelId: 'sentinel-circuit-coupa-open-circuit',
        levelRevision: '1',
        sha256: 'c3251eca67f94f7e27c75e0c4ac8d1ade6a81b009ee3c154ec276578eb2a8793',
        bytes: 2449288,
        mime: 'image/png',
        width: 1774,
        height: 887,
      },
    ],
  },
].map((descriptor) => validateExternalChapter(descriptor));
export const SOURCE_EXTERNAL_CHAPTERS = Object.freeze([
  SOURCE_EXTERNAL_CHAPTER,
  ...routeDescriptors,
  sentinelDescriptor,
  ...sentinelThemeDescriptors,
]);
const names = [
  'FPV Front · Pressure Pictures',
  'Ukraine Atlas · Route Choices',
  '1994 Forever · Route Choices',
  'Spend Network · Route Choices',
  'FPV Front · Sentinel Circuit',
  'Ukraine Atlas · Sentinel Circuit',
  '1994 Forever · Sentinel Circuit',
  'Spend Network · Sentinel Circuit',
];
export const SOURCE_EXTERNAL_EDITIONS = Object.freeze(
  SOURCE_EXTERNAL_CHAPTERS.map((descriptor, index) =>
    Object.freeze({
      descriptor,
      name: names[index],
      mode: descriptor.id === SOURCE_EXTERNAL_CHAPTER.id ? 'Arcade' : 'Tactical',
      levels: descriptor.originals.length,
      description:
        descriptor.id === SOURCE_EXTERNAL_CHAPTER.id
          ? 'Steer through three Pressure Pictures maps. Reconnect each cut to stop safely and reveal the scene.'
          : descriptor.id === sentinelDescriptor.id
            ? 'Read the courtyard routes, control a crossing, then expose the signal sentinel. Three Tactical missions with original reward panoramas.'
            : sentinelThemeDescriptors.includes(descriptor)
              ? 'Read the courtyard routes, control a crossing, then time a two-stage encounter. Three Tactical missions with original reward panoramas.'
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
