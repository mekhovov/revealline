import { CURRICULUM_CAMPAIGNS } from './curriculum.mjs';

export const curriculumCampaignIds = (brandId) =>
  CURRICULUM_CAMPAIGNS.filter((entry) => entry.brandId === brandId).map((entry) => entry.id);

/** Public educational editions. These original game identities do not assert
 * endorsement or substitute invented artwork for an organisation's real mark. */
export const CURRICULUM_IDENTITIES = Object.freeze([
  {
    id: 'social-drone-ua',
    name: 'Social Drone UA',
    description:
      'People, careful records and shared learning in a fictional community workshop. An independent educational tribute, not an official service.',
    source: 'https://www.socialdrone.com.ua/',
    palette: {
      ink: '#102A34',
      paper: '#FFF9EB',
      muted: '#B9CED4',
      accent: '#F4C66A',
      safe: '#99E5C9',
      danger: '#FFA78D',
      field: '#102A34',
      grid: '#284651',
      sky: '#D2EDEB',
      land: '#267B85',
    },
    recipe: 'fpv-whoop',
    enemy: 'Workshop distraction',
    genre: 'ambient',
    tempo: 84,
    root: 60,
  },
  {
    id: 'victory-drones',
    name: 'Victory Drones',
    description:
      'Sources, questions and shared understanding in an imagined learning observatory. Independent educational content; no endorsement implied.',
    source: 'https://victory-drones.com/',
    palette: {
      ink: '#242329',
      paper: '#FFFBEA',
      muted: '#D6CCB1',
      accent: '#F5CE61',
      safe: '#A9E6CA',
      danger: '#FFA994',
      field: '#242329',
      grid: '#444149',
      sky: '#F8EBC2',
      land: '#82713B',
    },
    recipe: 'stale-fragments',
    enemy: 'Unanswered fragment',
    genre: 'chiptune',
    tempo: 102,
    root: 62,
  },
  {
    id: 'ukraine-culture',
    name: 'Ukraine: Living Culture',
    description:
      'Explore individual objects, makers and living traditions through a fictional exhibition with source-linked discoveries.',
    source: 'https://honchar.org.ua/',
    palette: {
      ink: '#28212C',
      paper: '#FFF9ED',
      muted: '#D4C8BF',
      accent: '#F4CC83',
      safe: '#A1DFC8',
      danger: '#FFAA99',
      field: '#28212C',
      grid: '#4A3747',
      sky: '#F2E7D7',
      land: '#865D65',
    },
    recipe: 'missing-cloud',
    enemy: 'Missing context',
    genre: 'ambient',
    tempo: 76,
    root: 65,
  },
  {
    id: 'fpv-learning',
    name: 'FPV Learning',
    description:
      'Discover the roles of a civilian training aircraft’s components in a fictional science workshop. Arcade routes are not wiring diagrams.',
    source: 'https://www.nasa.gov/aeronautics/',
    palette: {
      ink: '#102635',
      paper: '#F4FCFF',
      muted: '#B8D2DD',
      accent: '#77DCEB',
      safe: '#A4E8B8',
      danger: '#FFAE8A',
      field: '#102635',
      grid: '#294854',
      sky: '#D2F2F6',
      land: '#2D7892',
    },
    recipe: 'fpv-caged',
    enemy: 'Practice quad',
    genre: 'chiptune',
    tempo: 110,
    root: 60,
  },
]);

export const CURRICULUM_BRANDS = Object.freeze(
  CURRICULUM_IDENTITIES.map((item) => ({
    format: 'revealline-brand-pack.v1',
    id: item.id,
    revision: 1,
    name: item.name,
    description: item.description,
    publication: 'public',
    themeId: `${item.id}-home`,
    themeIds: [`${item.id}-home`, ...curriculumCampaignIds(item.id).map((id) => `${id}-theme`)],
    actorSetId: `${item.id}-marker`,
    logoAssetId: null,
    heroAssetId: `${item.id}-home`,
    iconAssetId: null,
    fontAssetId: null,
    assetIds: [`${item.id}-home`],
    sources: [{ title: `${item.name} — contextual reference`, url: item.source, kind: 'official' }],
  })),
);
