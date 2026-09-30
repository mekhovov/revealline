import { t } from '../../../game/i18n/index.mjs';

// Pinned historical source inspection, not runtime adoption or new package admission.
export const FPV_ROLE_SOURCES = Object.freeze([
  Object.freeze({
    ...{
      id: 'guide',
      kind: 'text',
      path: 'authoring/library/fpv-role-presentations/README.md',
      bytes: 10071,
      sha256: '65fcd29b30a97976531b856dff07450d92444152da89ca0f42f1df85350807f6',
    },
    title: () => t('tools:fpvRoleSourceReview.guide'),
  }),
  Object.freeze({
    ...{
      id: 'records',
      kind: 'text',
      path: 'authoring/library/fpv-role-presentations/presentations.json',
      bytes: 13016,
      sha256: '3b4385429206c52dab06472badb5f31adaab21db9b6815f13575d9fe94549ff2',
    },
    title: () => t('tools:fpvRoleSourceReview.records'),
  }),
  Object.freeze({
    ...{
      id: 'prompts',
      kind: 'text',
      path: 'authoring/library/fpv-role-presentations/PROMPTS.md',
      bytes: 3758,
      sha256: 'f2bb28c22b7ebb4767fc34347be7d3010664ab596ab7a66755976b3d08d9207e',
    },
    title: () => t('tools:fpvRoleSourceReview.prompts'),
  }),
]);
export const FPV_ROLE_IMAGES = Object.freeze(
  [
    {
      id: 'scout',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/scout.png',
      bytes: 753111,
      sha256: '5d0b29fc773e08e8fdbed1e6a03726c7a16e2c5c06e89e163ab211d032cac957',
      width: 1254,
      height: 1254,
    },
    {
      id: 'bomber',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/bomber.png',
      bytes: 905251,
      sha256: '88d9a0fac33a45e8cac2dd752df042735deebb21ff172ae0ecf86d81e47826ca',
      width: 1254,
      height: 1254,
    },
    {
      id: 'carrier',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/carrier.png',
      bytes: 808782,
      sha256: '01ed2610a94fa9675d26a618647b8128d3443e111c941199012c72510ad40ad7',
      width: 1254,
      height: 1254,
    },
    {
      id: 'interceptor',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/interceptor.png',
      bytes: 679275,
      sha256: '548431d87442a009fdc81b7561927eaaece164fbc2ade0c834ebd6d5f51f1a5b',
      width: 1254,
      height: 1254,
    },
    {
      id: 'fiber',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/fiber.png',
      bytes: 899233,
      sha256: '6dd3f61124d17a262ee3cef747ea250e6828d5b69a244a13883d575cc97ddce8',
      width: 1254,
      height: 1254,
    },
    {
      id: 'impact',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/impact.png',
      bytes: 674845,
      sha256: '0999ede773d3cc70176347f39a19a96f05fc0dd96ac12b7fbd0d51304636d7ed',
      width: 1254,
      height: 1254,
    },
    {
      id: 'trapper',
      kind: 'image',
      path: 'authoring/library/fpv-role-presentations/originals/trapper.png',
      bytes: 1052291,
      sha256: '13e4aec02c72bf2f4a7cd26eee43c0a5e963de6bee3af3dd62dd22498831c869',
      width: 1254,
      height: 1254,
    },
  ].map(Object.freeze),
);
