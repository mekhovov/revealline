import { t } from '../../../game/i18n/index.mjs';

// Immutable source-only comparisons; no artwork adoption or package admission.
export const UKRAINE_WIDE_SOURCES = Object.freeze([
  Object.freeze({
    ...{
      id: 'guide',
      kind: 'text',
      path: 'authoring/library/ukraine-role-wide-variants/README.md',
      bytes: 4555,
      sha256: '40e30780e9106d5302f62c80b5969368aad9998fb0bb4fc61a25acbc62b7490d',
    },
    title: () => t('tools:ukraineRoleReview.lineageLimits'),
  }),
  Object.freeze({
    ...{
      id: 'records',
      kind: 'text',
      path: 'authoring/library/ukraine-role-wide-variants/variants.json',
      bytes: 3385,
      sha256: 'b8580d1333b5e10d13a4baa2189bb7c0d1dd24bd3c9d31ec7f5a4325855ff975',
    },
    title: () => t('tools:ukraineRoleReview.candidateRecords'),
  }),
]);
export const UKRAINE_WIDE_MANIFESTS = Object.freeze([
  UKRAINE_WIDE_SOURCES[1],
  Object.freeze({
    id: 'parent',
    kind: 'text',
    path: 'authoring/library/ukraine-role-presentations/presentations.json',
    bytes: 7605,
    sha256: '98bc5ebfd3fc20bfe9113c75c0da85692df61f2781d26d1cd75e848f4b69b4eb',
  }),
]);
export const UKRAINE_WIDE_IMAGES = Object.freeze(
  [
    {
      id: 'scout',
      version: 'v1',
      kind: 'image',
      width: 1254,
      height: 1254,
      path: 'authoring/library/ukraine-role-presentations/originals/scout.png',
      bytes: 534913,
      sha256: '2b0261e7eb78d3f5818b8e537fabc148111425c2d3bad2036d2034b4f4152bf2',
    },
    {
      id: 'interceptor',
      version: 'v1',
      kind: 'image',
      width: 1254,
      height: 1254,
      path: 'authoring/library/ukraine-role-presentations/originals/interceptor.png',
      bytes: 598045,
      sha256: 'bd426560dc79f5c9ada759a2a0752ca667b9c5456ee07aa3cbf6541429fb06ca',
    },
    {
      id: 'fiber',
      version: 'v1',
      kind: 'image',
      width: 1254,
      height: 1254,
      path: 'authoring/library/ukraine-role-presentations/originals/fiber.png',
      bytes: 541570,
      sha256: '564a3c32bf941aa5e3acfaddf34e52856489e84b9d47099ec8229a5ba5d35ca2',
    },
    {
      id: 'scout',
      version: 'v3',
      kind: 'image',
      width: 1254,
      height: 1254,
      path: 'authoring/library/ukraine-role-wide-variants/originals/scout-v3.png',
      bytes: 736862,
      sha256: '25f9a6034a5c20e5cbb9aaa1e225a8deccd56ddd2dbb3bebec15f712fe3fa012',
    },
    {
      id: 'interceptor',
      version: 'v3',
      kind: 'image',
      width: 1254,
      height: 1254,
      path: 'authoring/library/ukraine-role-wide-variants/originals/interceptor-v3.png',
      bytes: 695081,
      sha256: 'ffee4552c573b9fdc7e041ed94f5827183fc2622ed494a3a105eabbae08670a1',
    },
    {
      id: 'fiber',
      version: 'v3',
      kind: 'image',
      width: 1254,
      height: 1254,
      path: 'authoring/library/ukraine-role-wide-variants/originals/fiber-v3.png',
      bytes: 887360,
      sha256: '50bbcd47f7c4ac2140c54a4c8aebc50a1de7fdf24fe7fb5caccbeb4fbcd2e2ea',
    },
  ].map(Object.freeze),
);
