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
  revision: '1',
  name: 'Sky Watch',
  publication: 'public',
  modes: ['solo'],
  missionIds: [missionId],
  sourcePath: `game/content/company-campaigns/${id}.json`,
  rewardAssetIds: [
    'poster',
    'video',
    'en-description',
    'uk-description',
    'en-captions',
    'uk-captions',
  ].map((role) => `${id}-${role}-v1`),
});
export function createSkyWatchProject({ assets }) {
  const project = createStarterProject(id);
  const picture = assets.find((asset) => asset.id === `${id}-poster-v1`);
  const mission = project.missions[0];
  Object.assign(project, {
    revision: '1',
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
      revision: '1',
      name: 'Island channel',
      width: 72,
      height: 36,
      walls: [
        { x: 4, y: 16, w: 10, h: 2 },
        { x: 58, y: 18, w: 10, h: 2 },
      ],
      foundations: [
        { x: 9, y: 8, w: 9, h: 5 },
        { x: 53, y: 23, w: 9, h: 5 },
      ],
      terrain: [],
      spawns: [{ id: 'home', x: 36.5, y: 0.5 }],
    },
  ];
  Object.assign(mission, {
    id: missionId,
    name: 'Sky Watch',
    map: { id: `${missionId}-map`, revision: '1' },
    modes: ['solo'],
    coverage: 0.5,
    actors: [
      {
        id: 'west-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 8.5,
        y: 28.5,
        heading: [0, 1],
      },
    ],
    presentation: {
      themeId: 'social-drone-people-workshop-theme',
      backgroundAssetId: `${id}-picture`,
    },
    design: {
      ...mission.design,
      lesson: 'Reveal the aerial picture, then enjoy the original video.',
      routeDecision: 'Take the open channel between the two safe islands.',
      counterplay: 'Watch the keeper before crossing the middle channel.',
      captureConsequence: 'Closing the crossing reveals the whole picture and unlocks the video.',
      memorableMoment: 'The completed picture settles before the aerial clip begins.',
      mastery: 'Complete the crossing without losing a life.',
      durationSeconds: [10, 45],
      pacingBeat: 'discover',
      rewardRef: { id: `${missionId}-discovery`, revision: '1' },
    },
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id,
      revision: '1',
      name: 'Sky Watch',
      band: 1,
      missionIds: [missionId],
      discovery: { exhibitLayout: 'gallery' },
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: `${id}-pack`,
      revision: '1',
      name: 'Sky Watch',
      campaignIds: [id],
    },
  ];
  return project;
}
export function createSkyWatchRewards({ assets, missionBindings }) {
  const ref = (role) => {
    const asset = assets.find((a) => a.id === `${id}-${role}-v1`);
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
      revision: '1',
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
          routeDecision: 'Пройдіть відкритим каналом між двома безпечними островами.',
        },
      },
    },
  });
}
