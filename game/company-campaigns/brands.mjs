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
    revision: 2,
    name: 'DroneAid Netherlands',
    description:
      'Build FPV drones together. Fictional workshop and donation adventures inspired by DroneAid Netherlands and its support for Ukraine.',
    publication: 'public',
    themeId: 'droneaid-nl-community',
    themeIds: [
      'droneaid-nl-community',
      ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => `${c.id}-theme`),
    ],
    actorSetId: 'droneaid-nl-propeller',
    logoAssetId: 'droneaid-nl-logo',
    heroAssetId: 'droneaid-nl-workshop-lights-01-reveal-v2',
    iconAssetId: 'droneaid-nl-icon-512',
    fontAssetId: null,
    assetIds: [
      'droneaid-nl-logo',
      'droneaid-nl-propeller',
      'droneaid-nl-icon-512',
      'droneaid-nl-workshop-lights-01-reveal-v2',
    ],
    sources: [
      {
        title: 'DroneAid Netherlands — official identity and workshop activities',
        url: 'https://drone-aid.nl/en',
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
// Exact pre-art snapshots; their bytes must never be reformatted or overwritten.
const retainedPresentations = Object.freeze({'droneaid-nl-community': [
    {
      id: '13bf4f80b1b055d9fb5abdc137dfc93b94fe4ba55072104e697fb29615374679',
      path: 'game/editions/retained/droneaid-nl-community-fb207466c.json',
      sha256: 'b68b453158c820a542051999f242643250439a55e532653555940ffa31bbd055',
      bytes: 118479,
    },
    {
      id: '3445135910a80ceb5b5fdb862c431ead7db00a09631ede2ec28426119d907f67',
      path: 'game/editions/retained/droneaid-nl-community-475bccde4.json',
      sha256: '27669f1fa5d8692e6314bfd5d600c5554dee6679c364f7109a5663e8653856bc',
      bytes: 146882,
    },
  ],
'droneaid-nl-workshop-lights': [
    {
      id: '4e9e2e8ebc38f4bf6ae0b5a06144c103947cb90704b6646800bec534bcbf5c14',
      path: 'game/editions/retained/droneaid-nl-workshop-lights-fb207466c.json',
      sha256: 'ace1b2e55b06ba220e26d52dc2ca282b8100f1c5bddd40e1656363c20ba6ad45',
      bytes: 29573,
    },
    {
      id: '115d034320ff3efb161abd00b5886485bd92c7a161d405e5f8cb384263480b70',
      path: 'game/editions/retained/droneaid-nl-workshop-lights-475bccde4.json',
      sha256: '4099c606f57300678a6874695da6fc1c0af8b1ec2402e1cb1277cd339694f0ca',
      bytes: 33575,
    },
  ],
'droneaid-nl-parts-in-motion': [
    {
      id: '0b402f348a0d84f534c5db803d731394f7120160d7fd9c538887a4361a20ae40',
      path: 'game/editions/retained/droneaid-nl-parts-in-motion-fb207466c.json',
      sha256: 'a565f9a298e5adac88570474e4a484458e8c216fc34b9269274a55738d08a36c',
      bytes: 33974,
    },
    {
      id: 'e8c32e78d0ef5bf6f09a08cbe2ccaf244ec4917c877bce69c2fdf9cb3f38673b',
      path: 'game/editions/retained/droneaid-nl-parts-in-motion-475bccde4.json',
      sha256: '62aa48212ba19ede5bbc12064fc0fda026c2703ca8fef777d1d6657ba0d802e2',
      bytes: 38774,
    },
  ],
'droneaid-nl-makers-together': [
    {
      id: '609db6d6c7ea54120531b53b2b5c54b26d1484306195a426c39bd40d5236b478',
      path: 'game/editions/retained/droneaid-nl-makers-together-fb207466c.json',
      sha256: '21a7b3be9a7850d2f89b250903670b2fc6d98a7ffc32d8659ab1dd79d1e53937',
      bytes: 34640,
    },
    {
      id: '8c7d12be0f28ca874e88bbb453ab06fc947245681e8a4fc851b0c70a88314488',
      path: 'game/editions/retained/droneaid-nl-makers-together-475bccde4.json',
      sha256: '4bdd87457f48ef2123d7d4dfe608c9161d8ba493dd2f4039be45dcf81595b437',
      bytes: 39429,
    },
  ],
'droneaid-nl-careful-handoff': [
    {
      id: 'fb9dafae437c37905dcdd07cec0f67b53ead801a8894c2bf2070309dfd16a913',
      path: 'game/editions/retained/droneaid-nl-careful-handoff-fb207466c.json',
      sha256: '20f0a33e045c38ba73b19e5cfc7823378a23a1d81129677aea15474be1dd640a',
      bytes: 35799,
    },
    {
      id: '2cb54a68ee115af048b210d130af7418d44307adbeb69ab54dbc4fc0418cacd7',
      path: 'game/editions/retained/droneaid-nl-careful-handoff-475bccde4.json',
      sha256: '18d7a8f5324dc39a648eaeab9457e3d4c07814fd81f297e6c774bee6ae60e847',
      bytes: 40708,
    },
  ],
'droneaid-nl-signals-of-support': [
    {
      id: '013849c9507447451ca1f9a58d845da2d44436dbf776b231162ab8715cc61863',
      path: 'game/editions/retained/droneaid-nl-signals-of-support-fb207466c.json',
      sha256: '62e89a9c88e6812bc41bb36fab7c6af1ff7c818e8c91d7476ff488e891b20450',
      bytes: 37264,
    },
    {
      id: '048f59ae3ab8452c1e2f387a15dc10baad8d88c921663e2c576e7ad2fffa2b44',
      path: 'game/editions/retained/droneaid-nl-signals-of-support-475bccde4.json',
      sha256: 'afcd187771ec49ac54194b970930d1df0ee382da18368594dcadf14604f07bf7',
      bytes: 42294,
    },
  ],
'droneaid-nl-shared-horizon': [
    {
      id: '1c5fc1701fb224c9a548d1540b19e2f8c893b43c6bc81d2b91a0bb65d3bcf0a6',
      path: 'game/editions/retained/droneaid-nl-shared-horizon-fb207466c.json',
      sha256: '51eb77a2b7499f7af923189e620315c05dc142f2766e7b605fc13522dbdafa1b',
      bytes: 37998,
    },
    {
      id: 'fb225362d153cdd9af4d0421e7e7905521bb0d926cab7557985d40982924e429',
      path: 'game/editions/retained/droneaid-nl-shared-horizon-475bccde4.json',
      sha256: 'e1e31c174b40a97cfe0d43998bd91a4dd3eb314183f7bd5c29de618a51859977',
      bytes: 42871,
    },
  ]});

export const COMPANY_EDITIONS = Object.freeze(
  choices.map(([id, brandId, name, audience, campaignIds]) => ({
    format: 'revealline-edition.v1',
    id,
    revision: [].includes(
      id,
    )
      ? 6
      : brandId === 'droneaid-nl'
          ? 4
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
    actorRecipes:
      brandId === 'droneaid-nl'
        ? Object.fromEntries(
            [
              'bouncer',
              'border-patrol',
              'contour-patrol',
              'claimed-rover',
              'eroder',
              'lane-boss',
              'relay-sentinel',
            ].map((role) => [role, 'fpv-whoop']),
          )
        : {
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
      enemy: brandId === 'droneaid-nl' ? 'Practice quad' : 'Paper tangle',
      boss: brandId === 'droneaid-nl' ? 'Practice lead' : 'Backlog knot',
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
    'FPV Workshop',
    '#0D0B2E',
    '#4238EB',
    '#FFD62C',
    'fpv-whoop',
    'Practice quad',
    'chiptune',
    104,
    60,
  ],
'droneaid-nl-parts-in-motion': [
    'FPV Component Depot',
    '#111339',
    '#4D55DA',
    '#FFD62C',
    'fpv-open-x',
    'Sorting quad',
    'chiptune',
    112,
    62,
  ],
'droneaid-nl-makers-together': [
    'Drone Building Together',
    '#21163A',
    '#6550C9',
    '#F6D570',
    'fpv-stretched',
    'Relay quad',
    'ambient',
    88,
    65,
  ],
'droneaid-nl-careful-handoff': [
    'FPV Donation Depot',
    '#111A36',
    '#4552BC',
    '#FFD62C',
    'fpv-caged',
    'Guarded quad',
    'chiptune',
    98,
    60,
  ],
'droneaid-nl-signals-of-support': [
    'Workshop Open Day',
    '#20133C',
    '#6042CD',
    '#FFD62C',
    'fpv-antenna',
    'Signal quad',
    'chiptune',
    116,
    67,
  ],
'droneaid-nl-shared-horizon': [
    'Ukraine Support Horizon',
    '#10112F',
    '#4740AD',
    '#FFE18B',
    'fpv-survey',
    'Horizon quad',
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
          actorRecipes: {
            ...base.actorRecipes,
            ...Object.fromEntries(
              (brandId === 'droneaid-nl' ? Object.keys(base.actorRecipes) : ['bouncer']).map(
                (role) => [role, recipe],
              ),
            ),
          },
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
