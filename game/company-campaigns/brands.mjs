import { COMPANY_CAMPAIGNS } from './catalog.mjs';

export const COMPANY_BRANDS = Object.freeze([{
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
  }]);

const choices = [['droneaid-community', 'droneaid', 'Community Relay', 'public', ['droneaid-community-relay']],
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
  ])];
export const COMPANY_EDITIONS = Object.freeze(
  choices.map(([id, brandId, name, audience, campaignIds]) => ({
    format: 'revealline-edition.v1',
    id,
    revision: brandId === 'droneaid-nl' ? 2 : 1,
    name,
    brandId,
    audience,
    campaignIds,
    entryCampaignId: campaignIds[0],
    modes: ['solo'],
    publication: 'public',
    boot: Object.fromEntries(
      ['campaign', 'themes', 'presets', 'classes', 'packs', 'archives'].map((key) => [
        key,
        `game/content/company-boot/${id}/${key}.json`,
      ]),
    ),
  })),
);

const palettes = {'droneaid-nl': {
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
  }};
export function createCompanyTheme(brandId) {
  const brand = COMPANY_BRANDS.find((item) => item.id === brandId);
  if (!brand) throw new TypeError('Choose a registered company.');
  const player = brand.actorSetId;
  return {
    id: brand.themeId,
    name: brand.name,
    subtitle:
      'Build together. Connect the community.',
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
      {
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
        label: 'Community courier',
        ...(brandId === 'droneaid-nl'
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
const campaignLooks = {'droneaid-nl-workshop-lights': [
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
  ]};
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
