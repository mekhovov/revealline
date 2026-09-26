import { COMPANY_CAMPAIGNS } from './catalog.mjs';

export const COMPANY_BRANDS = Object.freeze([
  {
    format: 'revealline-brand-pack.v1',
    id: 'coupa',
    revision: 1,
    name: 'Coupa',
    description: 'Make room for tomorrow. An illustrated world of connected work.',
    publication: 'public',
    themeId: 'coupa-village',
    actorSetId: 'coupa-flower',
    logoAssetId: 'coupa-flower',
    heroAssetId: 'coupa-home',
    iconAssetId: 'coupa-icon-512',
    fontAssetId: 'poppins-regular',
    assetIds: [
      'coupa-flower',
      'coupa-home',
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
];
export const COMPANY_EDITIONS = Object.freeze(
  choices.map(([id, brandId, name, audience, campaignIds]) => ({
    format: 'revealline-edition.v1',
    id,
    revision: campaignIds.some((campaignId) =>
      ['coupa-source-to-pay', 'coupa-product-operations', 'coupa-developer-integration'].includes(
        campaignId,
      ),
    )
      ? 2
      : 1,
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
            id: 'workshop-after-rain',
            name: 'Workshop After Rain',
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
              bodyMotion: { kind: 'rigid-spin', radiansPerSecond: 0.65, travelGain: 0.3 },
            }
          : {}),
      },
    },
    animationRecipes: { still: { label: 'Rigid body', components: [] } },
  };
}
