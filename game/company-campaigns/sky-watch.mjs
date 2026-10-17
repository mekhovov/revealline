import { createStarterProject } from '../content-design/starter.mjs';
import {
  TRAIL_IMPACT_JOURNEY_POLICY,
  CURRENT_PRESSURE_ACTOR_CATALOG,
  PRESSURE_DIFFICULTY_CATALOG,
} from '../content-design/catalogs.mjs';
import { createCampaignLocalization } from '../editions/localization.mjs';

const id = 'social-drone-sky-watch';
const missionId = `${id}-01`;
export const SKY_WATCH_CAMPAIGN = Object.freeze({
  id,
  brandId: 'social-drone-ua',
  revision: '3',
  name: 'Sky Watch',
  publication: 'public',
  modes: ['solo'],
  missionIds: [missionId],
  sourcePath: `game/content/company-campaigns/${id}.json`,
  rewardAssetIds: [
    `${id}-poster-v1`,
    `${id}-video-v2`,
    `${id}-en-description-v1`,
    `${id}-uk-description-v1`,
    `${id}-en-captions-v1`,
    `${id}-uk-captions-v1`,
  ],
});
export function createSkyWatchProject({ assets }) {
  const project = createStarterProject(id);
  const picture = assets.find((asset) => asset.id === `${id}-poster-v1`);
  const mission = project.missions[0];
  Object.assign(project, {
    revision: '3',
    name: 'Sky Watch',
    policyId: TRAIL_IMPACT_JOURNEY_POLICY.id,
    actorCatalogId: CURRENT_PRESSURE_ACTOR_CATALOG.id,
    difficultyCatalogId: PRESSURE_DIFFICULTY_CATALOG.id,
    assets: [
      {
        format: 'AssetRevisionV1',
        id: `${id}-picture`,
        revision: '1',
        kind: 'reveal-background',
        path: picture.path.replace(/^game\//, ''),
        sha256: picture.sha256,
        bytes: picture.bytes,
        width: 1280,
        height: 640,
        review: 'candidate',
        alt: 'A white fixed-wing drone above fields and a river, from the supplied aerial clip.',
      },
    ],
  });
  project.maps = [
    {
      format: 'MapDesignV1',
      id: `${missionId}-map`,
      revision: '3',
      name: 'Watch corridors',
      width: 72,
      height: 36,
      walls: [
        { x: 5, y: 10, w: 12, h: 2 },
        { x: 27, y: 12, w: 18, h: 2 },
        { x: 55, y: 23, w: 12, h: 2 },
        { x: 20, y: 20, w: 2, h: 10 },
        { x: 49, y: 5, w: 2, h: 10 },
        { x: 5, y: 26, w: 12, h: 1 },
        { x: 5, y: 34, w: 12, h: 1 },
        { x: 5, y: 27, w: 1, h: 7 },
        { x: 16, y: 27, w: 1, h: 7 },
        { x: 56, y: 15, w: 10, h: 1 },
        { x: 56, y: 22, w: 10, h: 1 },
        { x: 56, y: 16, w: 1, h: 6 },
        { x: 65, y: 16, w: 1, h: 6 },
      ],
      foundations: [
        { x: 10, y: 20, w: 10, h: 5 },
        { x: 31, y: 21, w: 10, h: 5 },
        { x: 52, y: 8, w: 10, h: 5 },
      ],
      terrain: [],
      spawns: [{ id: 'home', x: 36.5, y: 0.5 }],
    },
  ];
  Object.assign(mission, {
    id: missionId,
    name: 'Sky Watch',
    revision: '3',
    map: { id: `${missionId}-map`, revision: '3' },
    modes: ['solo'],
    coverage: 0.64,
    actors: [
      {
        id: 'west-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 10.5,
        y: 30.5,
        heading: [0, 1],
      },
      {
        id: 'east-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 60.5,
        y: 18.5,
        heading: [0, -1],
      },
      {
        id: 'outer-watch',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 1.5,
        y: 35.5,
        clockwise: true,
      },
      {
        id: 'north-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 37.5,
        y: 7.5,
        heading: [1, 0],
      },
      {
        id: 'central-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 36.5,
        y: 29.5,
        heading: [-1, 0],
      },
    ],
    presentation: {
      themeId: 'social-drone-people-workshop-theme',
      backgroundAssetId: `${id}-picture`,
    },
    design: {
      ...mission.design,
      lesson:
        'Read the overlapping patrols, use the refuges, and make several deliberate captures to complete the picture.',
      routeDecision:
        'Choose a side corridor to avoid a keeper, then use the central refuge to reset before the final capture.',
      counterplay:
        'Watch four keepers and the perimeter patrol before leaving safety; walls and the central refuge create narrow, useful pauses.',
      captureConsequence:
        'The watch needs several safe closures. Use the side corridors and the central refuge instead of one long, exposed cut.',
      memorableMoment:
        'The final corridor closes, the completed picture settles, and the aerial clip begins.',
      mastery: 'Complete three captures through different corridors without losing a life.',
      introduces: ['perimeter-patrol'],
      practices: ['closure', 'enemy-seeded-closure', 'foundations'],
      combines: ['field-keeper', 'perimeter-patrol', 'foundations'],
      durationSeconds: [55, 130],
      difficulty: {
        band: 3,
        planning: 5,
        execution: 5,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
      pacingBeat: 'discover',
      rewardRef: { id: `${missionId}-discovery`, revision: '3' },
    },
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id,
      revision: '3',
      name: 'Sky Watch',
      band: 3,
      missionIds: [missionId],
      discovery: { exhibitLayout: 'gallery' },
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: `${id}-pack`,
      revision: '3',
      name: 'Sky Watch',
      campaignIds: [id],
    },
  ];
  return project;
}
export function createSkyWatchRewards({ assets, missionBindings }) {
  const ref = (role) => {
    const asset = assets.find((a) => a.id === `${id}-${role}-${role === 'video' ? 'v2' : 'v1'}`);
    return { assetId: asset.id, sha256: asset.sha256 };
  };
  const locales = {
    en: { title: 'Sky Watch', teaser: 'Reveal the picture to unlock the original aerial clip.' },
    uk: {
      title: 'Небесна варта',
      teaser: 'Відкрийте зображення, щоб переглянути оригінальне відео з повітря.',
    },
  };
  return [
    {
      format: 'revealline-completion-reward.v1',
      id: `${missionId}-discovery`,
      revision: '3',
      brandId: 'social-drone-ua',
      campaignId: id,
      scope: { kind: 'mission', id: missionId },
      locales,
      requirements: {
        missions: [
          {
            missionId,
            bindings: structuredClone(
              missionBindings.find((b) => b.levelId === missionId).bindings,
            ),
          },
        ],
        learning: [],
        mastery: [],
      },
      payloads: [
        {
          id: `${id}-image`,
          type: 'image',
          asset: ref('poster'),
          locales: {
            en: { title: 'Sky Watch', alt: 'A white fixed-wing drone above fields and a river.' },
            uk: {
              title: 'Небесна варта',
              alt: 'Білий безпілотник із нерухомим крилом над полями й річкою.',
            },
          },
        },
        {
          id: `${id}-clip`,
          type: 'video',
          asset: ref('video'),
          poster: ref('poster'),
          captions: { en: ref('en-captions'), uk: ref('uk-captions') },
          transcript: { en: ref('en-description'), uk: ref('uk-description') },
          locales: {
            en: { title: 'Sky Watch · original clip' },
            uk: { title: 'Небесна варта · оригінальне відео' },
          },
        },
      ],
    },
  ];
}
export function createSkyWatchLocalization({ source }) {
  return createCampaignLocalization({
    source,
    campaignId: id,
    campaignLocales: { uk: { name: 'Небесна варта' } },
    missionLocales: {
      [missionId]: {
        uk: {
          name: 'Небесна варта',
          brief: 'Відкрийте зображення з повітря, а потім перегляньте оригінальне відео.',
          routeDecision:
            'Скористайтеся центральним укриттям для коротшого другого проходу або обійдіть бічним коридором подалі від вартових.',
        },
      },
    },
  });
}
