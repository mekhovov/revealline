import { t } from '../../../game/i18n/index.mjs';

// Immutable historical sources; this is not runtime adoption or package admission.
export const UKRAINE_ROLE_SOURCES = Object.freeze([
  Object.freeze({
    ...{
      id: 'guide',
      kind: 'text',
      path: 'authoring/library/ukraine-role-presentations/README.md',
      bytes: 7872,
      sha256: 'dc0d270e899578017324844b894af9bf328c31ad9a73a3b2c9dfd74282083325',
    },
    title: () => t('tools:ukraineRoleReview.replacementGuide'),
  }),
  Object.freeze({
    ...{
      id: 'records',
      kind: 'text',
      path: 'authoring/library/ukraine-role-presentations/presentations.json',
      bytes: 7605,
      sha256: '98bc5ebfd3fc20bfe9113c75c0da85692df61f2781d26d1cd75e848f4b69b4eb',
    },
    title: () => t('tools:ukraineRoleReview.candidateRecords'),
  }),
  Object.freeze({
    ...{
      id: 'prompts',
      kind: 'text',
      path: 'authoring/library/ukraine-role-presentations/PROMPTS.md',
      bytes: 19176,
      sha256: '20280c517eea9323c1d1082b9b6996c453837f3974912959eada6c2f74ad5deb',
    },
    title: () => t('tools:ukraineRoleReview.promptRigContract'),
  }),
]);
export const UKRAINE_ROLE_MANIFEST = UKRAINE_ROLE_SOURCES.find(({ id }) => id === 'records');
export const UKRAINE_ROLE_IMAGES = Object.freeze(
  [
    {
      id: 'scout',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/scout.png',
      bytes: 534913,
      sha256: '2b0261e7eb78d3f5818b8e537fabc148111425c2d3bad2036d2034b4f4152bf2',
      width: 1254,
      height: 1254,
    },
    {
      id: 'bomber',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/bomber.png',
      bytes: 871364,
      sha256: 'b6bde2c3e46a26f941e4abf61e03105d3b51c58633eaad979574ec1fbc70f698',
      width: 1254,
      height: 1254,
    },
    {
      id: 'carrier',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/carrier.png',
      bytes: 843442,
      sha256: 'e6b7e8f95aecd9adcadb3c550510d47368797d80b25dbeee78fae787c1461298',
      width: 1254,
      height: 1254,
    },
    {
      id: 'interceptor',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/interceptor.png',
      bytes: 598045,
      sha256: 'bd426560dc79f5c9ada759a2a0752ca667b9c5456ee07aa3cbf6541429fb06ca',
      width: 1254,
      height: 1254,
    },
    {
      id: 'fiber',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/fiber.png',
      bytes: 541570,
      sha256: '564a3c32bf941aa5e3acfaddf34e52856489e84b9d47099ec8229a5ba5d35ca2',
      width: 1254,
      height: 1254,
    },
    {
      id: 'impact',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/impact.png',
      bytes: 776281,
      sha256: 'f95bfe4337782a1ed459effa90c6785ae642e57e6525796b7e3fb8be3f3b284f',
      width: 1254,
      height: 1254,
    },
    {
      id: 'trapper',
      kind: 'image',
      path: 'authoring/library/ukraine-role-presentations/originals/trapper.png',
      bytes: 1062942,
      sha256: 'b1b233045b71f277a0afea06650c173e358c3b0a05921ea2cc24fd3bab4e5b25',
      width: 1254,
      height: 1254,
    },
  ].map(Object.freeze),
);
