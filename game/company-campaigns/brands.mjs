import { COMPANY_CAMPAIGNS } from './catalog.mjs';

export const COMPANY_BRANDS = Object.freeze([
  {
    format: 'revealline-brand-pack.v1',
    id: 'coupa',
    revision: 2,
    name: 'Coupa',
    description: 'Make room for tomorrow. An illustrated world of connected work.',
    publication: 'public',
    themeId: 'coupa-village',
    themeIds: [
      'coupa-village',
      ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'coupa').map((c) => `${c.id}-theme`),
    ],
    actorSetId: 'coupa-flower',
    logoAssetId: 'coupa-flower',
    heroAssetId: 'coupa-wallpaper-network-2024',
    iconAssetId: 'coupa-icon-512',
    fontAssetId: 'poppins-regular',
    assetIds: [
      'coupa-flower',
      'coupa-wallpaper-network-2024',
      'coupa-wallpaper-center-2024',
      'poppins-regular',
      'poppins-license',
      'coupa-icon-512',
    ],
    sources: [
      {
        title: 'Coupa brand library — official flower identity',
        url: 'https://drive.google.com/drive/folders/1Bhq6KoBjES--iHt3gWZA2rhjo456Q9j6',
        kind: 'official',
      },
      {
        title: 'Life at Coupa — current company values',
        url: 'https://careers.coupa.com/en/life-at-coupa/',
        kind: 'official',
      },
      {
        title: 'Poppins — SIL Open Font License',
        url: 'https://github.com/google/fonts/tree/main/ofl/poppins',
        kind: 'license',
      },
    ],
  },
  {
    format: 'revealline-brand-pack.v1',
    id: 'droneaid',
    revision: 1,
    name: 'DroneAid',
    description: 'Small connections. Shared possibilities. A community workshop adventure.',
    publication: 'public',
    themeId: 'droneaid-community',
    actorSetId: 'community-marker',
    logoAssetId: 'droneaid-logo',
    heroAssetId: 'droneaid-home',
    iconAssetId: 'droneaid-icon-512',
    fontAssetId: 'poppins-regular',
    assetIds: [
      'droneaid-logo',
      'droneaid-home',
      'poppins-regular',
      'poppins-license',
      'droneaid-icon-512',
    ],
    sources: [
      {
        title: 'DroneAid Collective Portugal — regional identity',
        url: 'https://drone-aid.pt/en',
        kind: 'official',
      },
      {
        title: 'DroneAid Germany — community workshops',
        url: 'https://drone-aid.de/',
        kind: 'official',
      },
      {
        title: 'Poppins — SIL Open Font License',
        url: 'https://github.com/google/fonts/tree/main/ofl/poppins',
        kind: 'license',
      },
    ],
  },
  {
    format: 'revealline-brand-pack.v1',
    id: 'droneaid-nl',
    revision: 1,
    name: 'DroneAid Netherlands',
    description:
      'Build together. Share what is possible. Fictional workshop adventures inspired by DroneAid Netherlands.',
    publication: 'public',
    themeId: 'droneaid-nl-community',
    themeIds: [
      'droneaid-nl-community',
      ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => `${c.id}-theme`),
    ],
    actorSetId: 'droneaid-nl-propeller',
    logoAssetId: 'droneaid-nl-logo',
    heroAssetId: 'nl-workshop-v1',
    iconAssetId: 'droneaid-nl-icon-512',
    fontAssetId: null,
    assetIds: [
      'droneaid-nl-logo',
      'droneaid-nl-propeller',
      'droneaid-nl-icon-512',
      'nl-workshop-v1',
    ],
    sources: [
      {
        title: 'DroneAid Netherlands — official identity and workshop activities',
        url: 'https://drone-aid.nl/nl',
        kind: 'official',
      },
      {
        title: 'DroneAid Netherlands — public reporting',
        url: 'https://drone-aid.nl/en/reports',
        kind: 'official',
      },
    ],
  },
]);

const choices = [
  [
    'coupa-all',
    'coupa',
    'Coupa Village',
    'everyone',
    COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'coupa').map((c) => c.id),
  ],
  ['coupa-adventure', 'coupa', 'Spend in Motion', 'public', ['coupa-spend-in-motion']],
  ['coupa-culture', 'coupa', 'Inside the Village', 'culture', ['coupa-inside-village']],
  ['coupa-foundations', 'coupa', 'From Need to Value', 'learners', ['coupa-source-to-pay']],
  ['coupa-operations', 'coupa', 'A Day in Coupa', 'operators', ['coupa-product-operations']],
  [
    'coupa-developers',
    'coupa',
    'Connect the Network',
    'developers',
    ['coupa-developer-integration'],
  ],
  ['droneaid-community', 'droneaid', 'Community Relay', 'public', ['droneaid-community-relay']],
  [
    'droneaid-nl-community',
    'droneaid-nl',
    'DroneAid Netherlands',
    'public',
    COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => c.id),
  ],
  ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => [
    c.id,
    c.brandId,
    c.name,
    'public',
    [c.id],
  ]),
];
// Exact pre-art snapshots; their bytes must never be reformatted or overwritten.
const retainedPresentations = Object.freeze({
  'coupa-all': [
    {
      id: 'ecb87b6208f6f55322188ab34d8d9aa63b94064dd346f400bbe2bbbcc9d7870b',
      path: 'game/editions/retained/coupa-all.json',
      sha256: 'a48dc47e3e788046de0094c7d34bd74eda0c8776f271131254e26f5ec12e5706',
      bytes: 146284,
    },
    {
      id: 'd9deabcadfd9bdc7622da65ebbcc91bdd752db02234009edc3fe09f85812f842',
      path: 'game/editions/retained/coupa-all-fb207466c.json',
      sha256: '680c7f4fdb23619aed0627ea47444c7040a7f208104e4c2abc1a3d486adbe636',
      bytes: 148510,
    },
  ],
  'coupa-adventure': [
    {
      id: '82527f475e9cb0ddbc6bf9701e495e49e08dd635a0e89578c107268373426a05',
      path: 'game/editions/retained/coupa-adventure-fb207466c.json',
      sha256: 'ef9a0bf6562fa74ab643d9b214bf1deb1338a1694337cdd822d9cb3cd3c26937',
      bytes: 29600,
    },
  ],
  'coupa-culture': [
    {
      id: 'ed8d7747ad136a06243a2cf8c90dacdc5cf42dc71f5c6448174bde48ea241ae8',
      path: 'game/editions/retained/coupa-culture-fb207466c.json',
      sha256: '12dbf430730aff337133b19e1140efc2c107cc18351b07048eef59c19593bcba',
      bytes: 44733,
    },
  ],
  'coupa-foundations': [
    {
      id: '57dd4d5b7e0f8c27662349a8af870862657d700682ac758ad51721a61fdd59aa',
      path: 'game/editions/retained/coupa-foundations.json',
      sha256: '98d2a026fc89b48cbd76c2d2c2d74d491f666583ae819324f855ebd7f309dd90',
      bytes: 46542,
    },
    {
      id: '176ab6d261ed0e4366b570dd14df270d6b27a761404baf17921dc1f974898bd6',
      path: 'game/editions/retained/coupa-foundations-fb207466c.json',
      sha256: 'e6694057707e69a8a134836d91bc1879f3555b39f6fc58622a15073454bf7432',
      bytes: 47276,
    },
  ],
  'coupa-operations': [
    {
      id: '99254aaf116f5b68881ef51f36c7b5b9ebfbcf6cce371de90c8234c07862a43d',
      path: 'game/editions/retained/coupa-operations.json',
      sha256: '716bcbd296e6053ca6628b8b55dada9c0489a8893c1044cbc24854899caf6e20',
      bytes: 47693,
    },
    {
      id: '681f63d8afef4e5a89e3d62ac1a2ddaa775cf6d03ad2c3897c64bc2dfb84b922',
      path: 'game/editions/retained/coupa-operations-fb207466c.json',
      sha256: 'b00276030dd4642756c75e15120f2d415e07e85dc90b0eacf99cf0ee71574c3d',
      bytes: 48443,
    },
  ],
  'coupa-developers': [
    {
      id: '72ede618c25678c324d39389b9789130c66bb05f461e900d367e9c3f2a878224',
      path: 'game/editions/retained/coupa-developers.json',
      sha256: 'ee4d10212133066658ae5543883a5e1def3602a5bc840874223b90bdccac9c06',
      bytes: 50046,
    },
    {
      id: 'ab769c5bd0c8e9cfeb09c20c9363a6012d482b911aec1577c6665d264490127a',
      path: 'game/editions/retained/coupa-developers-fb207466c.json',
      sha256: 'd4bc46ff2c873a07325b9efec577e1df854b85479f3ba10a89ceb2a0db019d9a',
      bytes: 50786,
    },
  ],
  'droneaid-nl-community': [
    {
      id: '13bf4f80b1b055d9fb5abdc137dfc93b94fe4ba55072104e697fb29615374679',
      path: 'game/editions/retained/droneaid-nl-community-fb207466c.json',
      sha256: 'b68b453158c820a542051999f242643250439a55e532653555940ffa31bbd055',
      bytes: 118479,
    },
  ],
  'droneaid-nl-workshop-lights': [
    {
      id: '4e9e2e8ebc38f4bf6ae0b5a06144c103947cb90704b6646800bec534bcbf5c14',
      path: 'game/editions/retained/droneaid-nl-workshop-lights-fb207466c.json',
      sha256: 'ace1b2e55b06ba220e26d52dc2ca282b8100f1c5bddd40e1656363c20ba6ad45',
      bytes: 29573,
    },
  ],
  'droneaid-nl-parts-in-motion': [
    {
      id: '0b402f348a0d84f534c5db803d731394f7120160d7fd9c538887a4361a20ae40',
      path: 'game/editions/retained/droneaid-nl-parts-in-motion-fb207466c.json',
      sha256: 'a565f9a298e5adac88570474e4a484458e8c216fc34b9269274a55738d08a36c',
      bytes: 33974,
    },
  ],
  'droneaid-nl-makers-together': [
    {
      id: '609db6d6c7ea54120531b53b2b5c54b26d1484306195a426c39bd40d5236b478',
      path: 'game/editions/retained/droneaid-nl-makers-together-fb207466c.json',
      sha256: '21a7b3be9a7850d2f89b250903670b2fc6d98a7ffc32d8659ab1dd79d1e53937',
      bytes: 34640,
    },
  ],
  'droneaid-nl-careful-handoff': [
    {
      id: 'fb9dafae437c37905dcdd07cec0f67b53ead801a8894c2bf2070309dfd16a913',
      path: 'game/editions/retained/droneaid-nl-careful-handoff-fb207466c.json',
      sha256: '20f0a33e045c38ba73b19e5cfc7823378a23a1d81129677aea15474be1dd640a',
      bytes: 35799,
    },
  ],
  'droneaid-nl-signals-of-support': [
    {
      id: '013849c9507447451ca1f9a58d845da2d44436dbf776b231162ab8715cc61863',
      path: 'game/editions/retained/droneaid-nl-signals-of-support-fb207466c.json',
      sha256: '62e89a9c88e6812bc41bb36fab7c6af1ff7c818e8c91d7476ff488e891b20450',
      bytes: 37264,
    },
  ],
  'droneaid-nl-shared-horizon': [
    {
      id: '1c5fc1701fb224c9a548d1540b19e2f8c893b43c6bc81d2b91a0bb65d3bcf0a6',
      path: 'game/editions/retained/droneaid-nl-shared-horizon-fb207466c.json',
      sha256: '51eb77a2b7499f7af923189e620315c05dc142f2766e7b605fc13522dbdafa1b',
      bytes: 37998,
    },
  ],
});

export const COMPANY_EDITIONS = Object.freeze(
  choices.map(([id, brandId, name, audience, campaignIds]) => ({
    format: 'revealline-edition.v1',
    id,
    revision: ['coupa-all', 'coupa-foundations', 'coupa-operations', 'coupa-developers'].includes(
      id,
    )
      ? 6
      : brandId === 'coupa'
        ? 5
        : brandId === 'droneaid-nl'
          ? 3
          : 1,
    name,
    brandId,
    audience,
    campaignIds,
    entryCampaignId: campaignIds[0],
    modes: ['solo'],
    publication: 'public',
    ...(retainedPresentations[id] ? { presentationHistory: retainedPresentations[id] } : {}),
    boot: Object.fromEntries(
      ['campaign', 'themes', 'presets', 'classes', 'packs', 'archives'].map((key) => [
        key,
        `game/content/company-boot/${id}/${key}.json`,
      ]),
    ),
  })),
);

const palettes = {
  coupa: {
    ink: '#081D4D',
    paper: '#FFFFFF',
    muted: '#B8CAE5',
    accent: '#5FD6FF',
    safe: '#96EAAA',
    danger: '#FF9A88',
    field: '#081D4D',
    grid: '#193866',
    sky: '#D8F0FF',
    land: '#1565C0',
  },
  'droneaid-nl': {
    ink: '#0D0B2E',
    paper: '#FFFFFF',
    muted: '#BFCBF3',
    accent: '#FFD62C',
    safe: '#96EAAA',
    danger: '#FF9A88',
    field: '#0D0B2E',
    grid: '#2C286D',
    sky: '#DCEBFD',
    land: '#4238EB',
  },
  droneaid: {
    ink: '#12251C',
    paper: '#FAFBF7',
    muted: '#B8CEBA',
    accent: '#F2BD6E',
    safe: '#96D4AD',
    danger: '#FFA58F',
    field: '#10291D',
    grid: '#284638',
    sky: '#DDEDE0',
    land: '#14532D',
  },
};
export function createCompanyTheme(brandId) {
  const brand = COMPANY_BRANDS.find((item) => item.id === brandId);
  if (!brand) throw new TypeError('Choose a registered company.');
  const player = brand.actorSetId;
  return {
    id: brand.themeId,
    name: brand.name,
    subtitle:
      brandId === 'coupa'
        ? 'Connected work. Shared possibilities.'
        : 'Build together. Connect the community.',
    family: 'company',
    player,
    scene: 'network',
    enemyShape: 'cube',
    patrolShape: 'spark',
    bossShape: 'core',
    actorRecipes: {
      bouncer: 'paper-tangle',
      'border-patrol': 'stale-fragments',
      'contour-patrol': 'missing-cloud',
      'claimed-rover': 'missing-cloud',
      eroder: 'stale-fragments',
      'lane-boss': 'backlog-knot',
      'relay-sentinel': 'backlog-knot',
    },
    soundtrack:
      brandId === 'coupa'
        ? {
            id: 'village-connections',
            name: 'Village Connections',
            genre: 'chiptune',
            tempo: 108,
            root: 60,
            scale: 'major',
          }
        : {
            id: brandId === 'droneaid-nl' ? 'workshop-first-light' : 'workshop-after-rain',
            name: brandId === 'droneaid-nl' ? 'Workshop First Light' : 'Workshop After Rain',
            genre: 'ambient',
            tempo: 72,
            root: 57,
            scale: 'dorian',
          },
    classBodies: Object.fromEntries(
      ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'].map((id) => [
        id,
        player,
      ]),
    ),
    labels: {
      objective: 'Connection',
      supply: 'Support station',
      enemy: 'Paper tangle',
      boss: 'Backlog knot',
      currency: 'Connections',
      ability: 'Support',
    },
    palette: { ...palettes[brandId] },
    coverColor: palettes[brandId].field,
  };
}

export function createCompanyPresets(brandId) {
  const theme = createCompanyTheme(brandId);
  const neutral = {
    label: 'Community marker',
    src: null,
    sourceStatus: 'Original directional marker',
    widthCells: 1.5,
    heightCells: 1.5,
    headingOffsetDegrees: 0,
    sampling: 'linear',
    rotors: [],
    animationRecipe: 'still',
  };
  return {
    version: '1.0.0',
    characters: {
      'neutral-marker': { ...neutral },
      [theme.player]: {
        ...neutral,
        label: brandId === 'coupa' ? 'Coupa flower' : 'Community courier',
        ...(brandId === 'coupa'
          ? {
              src: '../../game/editions/assets/coupa/flower-blue.png',
              sourceStatus: 'Official Coupa flower; gameplay rotation chosen for this game',
              bodyMotion: { kind: 'rigid-spin', radiansPerSecond: Math.PI, travelGain: 0 },
              bodyBacking: { kind: 'opaque-interior', color: '#FFFFFF' },
            }
          : brandId === 'droneaid-nl'
            ? {
                label: 'DroneAid Netherlands propeller',
                src: '../../game/editions/assets/droneaid-nl/propeller.png',
                sourceStatus:
                  'Exact four propeller paths from the official Netherlands logo; gameplay rotation user-selected',
                widthCells: 2.3,
                heightCells: 2.3,
                bodyMotion: { kind: 'rigid-spin', radiansPerSecond: 4 * Math.PI, travelGain: 0 },
              }
            : {}),
      },
    },
    animationRecipes: { still: { label: 'Rigid body', components: [] } },
  };
}

// Campaign palettes, material metaphors and sound are presentation only. All
// physical actor cues and deterministic movement remain owned by the engine.
const campaignLooks = {
  'coupa-spend-in-motion': [
    'Connected City',
    '#081D4D',
    '#1565C0',
    '#5FD6FF',
    'paper-tangle',
    'Paper tangle',
    'chiptune',
    108,
    60,
  ],
  'coupa-inside-village': [
    'Community Mosaic',
    '#112A55',
    '#276EC8',
    '#EEC874',
    'missing-cloud',
    'Missed connection',
    'ambient',
    84,
    62,
  ],
  'coupa-source-to-pay': [
    'Supply District',
    '#102A50',
    '#2469B5',
    '#8CDFE8',
    'stale-fragments',
    'Loose fragments',
    'chiptune',
    102,
    60,
  ],
  'coupa-product-operations': [
    'Operations Studio',
    '#102446',
    '#2864A3',
    '#E8C378',
    'paper-tangle',
    'Paper tangle',
    'chiptune',
    96,
    65,
  ],
  'coupa-developer-integration': [
    'Resource Atlas',
    '#08182F',
    '#214A97',
    '#5FD6FF',
    'backlog-knot',
    'Unresolved knot',
    'ambient',
    90,
    57,
  ],
  'droneaid-nl-workshop-lights': [
    'Workshop Lights',
    '#0D0B2E',
    '#4238EB',
    '#FFD62C',
    'paper-tangle',
    'Loose labels',
    'chiptune',
    104,
    60,
  ],
  'droneaid-nl-parts-in-motion': [
    'Component Depot',
    '#111339',
    '#4D55DA',
    '#FFD62C',
    'stale-fragments',
    'Sorting fragments',
    'chiptune',
    112,
    62,
  ],
  'droneaid-nl-makers-together': [
    'Community Rooms',
    '#21163A',
    '#6550C9',
    '#F6D570',
    'missing-cloud',
    'Missed connection',
    'ambient',
    88,
    65,
  ],
  'droneaid-nl-careful-handoff': [
    'Canal-side Depot',
    '#111A36',
    '#4552BC',
    '#FFD62C',
    'paper-tangle',
    'Loose labels',
    'chiptune',
    98,
    60,
  ],
  'droneaid-nl-signals-of-support': [
    'Community Pavilion',
    '#20133C',
    '#6042CD',
    '#FFD62C',
    'stale-fragments',
    'Scattered notices',
    'chiptune',
    116,
    67,
  ],
  'droneaid-nl-shared-horizon': [
    'Shared Horizon',
    '#10112F',
    '#4740AD',
    '#FFE18B',
    'missing-cloud',
    'Passing cloud',
    'ambient',
    82,
    62,
  ],
};
export function createCompanyThemes(brandId) {
  const base = createCompanyTheme(brandId);
  return [
    base,
    ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === brandId && campaignLooks[c.id]).map(
      (campaign) => {
        const [name, field, land, accent, recipe, enemy, genre, tempo, root] =
          campaignLooks[campaign.id];
        return {
          ...structuredClone(base),
          id: `${campaign.id}-theme`,
          name: `${base.name} · ${name}`,
          subtitle: campaign.name,
          palette: { ...base.palette, field, land, accent },
          coverColor: field,
          actorRecipes: { ...base.actorRecipes, bouncer: recipe },
          labels: { ...base.labels, enemy },
          soundtrack: {
            id: `${campaign.id}-score`,
            name,
            genre,
            tempo,
            root,
            scale: genre === 'ambient' ? 'dorian' : 'major',
          },
        };
      },
    ),
  ];
}
