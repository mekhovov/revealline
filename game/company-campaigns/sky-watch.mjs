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
  revision: '2',
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
    revision: '2',
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
      revision: '2',
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
    revision: '2',
    map: { id: `${missionId}-map`, revision: '2' },
    modes: ['solo'],
    coverage: 0.45,
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
    ],
    presentation: {
      themeId: 'social-drone-people-workshop-theme',
      backgroundAssetId: `${id}-picture`,
    },
    design: {
      ...mission.design,
      lesson:
        'Build two deliberate captures through the watch corridors, then enjoy the original video.',
      routeDecision:
        'Use the center refuge for a shorter second cut, or circle a side corridor away from the keepers.',
      counterplay:
        'Read both field keepers and the border patrol before leaving safety; the walls create protected pauses and narrow turns.',
      captureConsequence:
        'The first closure reveals most of the scene. A second safe return completes the picture and unlocks the video.',
      memorableMoment:
        'The final corridor closes, the completed picture settles, and the aerial clip begins.',
      mastery: 'Complete two captures through different corridors without losing a life.',
      introduces: ['perimeter-patrol'],
      practices: ['closure', 'enemy-seeded-closure', 'foundations'],
      combines: ['field-keeper', 'perimeter-patrol', 'foundations'],
      durationSeconds: [25, 75],
      difficulty: {
        band: 3,
        planning: 3,
        execution: 3,
        threatDensity: 3,
        timePressure: 0,
        mechanicLoad: 3,
        coordination: 0,
      },
      pacingBeat: 'discover',
      rewardRef: { id: `${missionId}-discovery`, revision: '2' },
    },
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id,
      revision: '2',
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
      revision: '2',
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
      revision: '2',
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
