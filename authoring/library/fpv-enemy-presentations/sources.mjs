import { t } from '../../../game/i18n/index.mjs';

export const FPV_ENEMY_ROLES = Object.freeze(
  [
    ['bouncer', 'trackedHunter'],
    ['border-patrol', 'borderQuad'],
    ['contour-patrol', 'frontierTwinRotor'],
    ['claimed-rover', 'sixWheelRover'],
    ['eroder', 'territoryDrill'],
    ['lane-boss', 'tripodLaneEmitter'],
    ['relay-sentinel', 'relaySentinel'],
  ].map(Object.freeze),
);

// Historical originals only; source inspection is not runtime adoption.
export const FPV_ENEMY_SOURCES = Object.freeze([
  Object.freeze({
    ...{
      id: 'bouncer',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/bouncer.png',
      bytes: 865212,
      sha256: '35bab23818b3ab80e79a76bc54e7a0b2402ecfdeb922a6d417963c824c6a2282',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.trackedHunter'),
  }),
  Object.freeze({
    ...{
      id: 'border-patrol',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/border-patrol.png',
      bytes: 1051393,
      sha256: '4da8036ae2e48aa53b80cb05c3ae9808d9dd762385cadc1c5a2148d9428058d9',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.borderQuad'),
  }),
  Object.freeze({
    ...{
      id: 'contour-patrol',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/contour-patrol.png',
      bytes: 769992,
      sha256: 'cf46a28c2573c9e486a17bb558dec51bb4e0882493360cf6a84bc3c452b404b8',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.frontierTwinRotor'),
  }),
  Object.freeze({
    ...{
      id: 'claimed-rover',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/claimed-rover.png',
      bytes: 1138185,
      sha256: '88253efdf09af23d5d562e240adc1f3f7ba1db45dbfd88c721f053105cb02593',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.sixWheelRover'),
  }),
  Object.freeze({
    ...{
      id: 'eroder',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/eroder.png',
      bytes: 644575,
      sha256: '94d40bc13f6ad8e62443c945e205903d6e75bc9f0f04d6fbc4ddcaf56b1f4d0b',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.territoryDrill'),
  }),
  Object.freeze({
    ...{
      id: 'lane-boss',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/lane-boss.png',
      bytes: 846564,
      sha256: '7b9e6a5a7cf112ca88c7a35a051b1efab2da8175d2038ee9bd619ac4e8dd7a33',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.tripodLaneEmitter'),
  }),
  Object.freeze({
    ...{
      id: 'relay-sentinel',
      kind: 'image',
      path: 'authoring/library/fpv-enemy-presentations/originals/relay-sentinel.png',
      bytes: 1206928,
      sha256: 'fac474fa78d26d143c249f22a623c0f01267a71e08911e282ebb47dea859e489',
      width: 1254,
      height: 1254,
    },
    title: () => t('tools:fpvEnemySourceReview.roles.relaySentinel'),
  }),
  Object.freeze({
    ...{
      id: 'guide',
      kind: 'text',
      path: 'authoring/library/fpv-enemy-presentations/README.md',
      bytes: 4170,
      sha256: '4c5defe333fd03ab0a1c33511f506985ba6d42383f3764ef5e383211d7a26626',
    },
    title: () => t('tools:fpvEnemySourceReview.sourceQualifications'),
  }),
  Object.freeze({
    ...{
      id: 'inspection',
      kind: 'text',
      path: 'authoring/library/fpv-enemy-presentations/inspection.json',
      bytes: 7818,
      sha256: 'b49a23d7dc16998f7c2331a255e315848afac5aa708f97572e95d416a1e03603',
    },
    title: () => t('tools:fpvEnemySourceReview.measurements'),
  }),
]);
