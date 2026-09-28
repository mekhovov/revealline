import { freezeDesign } from '../content-design/catalogs.mjs';
import { required } from '../data-json.mjs';

// Exact pre-update presentations are retained before advancing this ledger.
// These reading/art revisions never change gameplay or promised requirements.
export const CURRICULUM_PRESENTATION_REVISIONS = freezeDesign({
  'social-drone-people-workshop': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'social-drone-people-workshop-01': '4',
      'social-drone-people-workshop-02': '4',
      'social-drone-people-workshop-03': '4',
      'social-drone-people-workshop-04': '4',
      'social-drone-people-workshop-05': '4',
      'social-drone-people-workshop-06': '4',
    },
  },
  'victory-drones-knowledge-connects': {
    pack: '5',
    finale: '5',
    missionRewards: {
      'victory-drones-knowledge-connects-01': '5',
      'victory-drones-knowledge-connects-02': '5',
      'victory-drones-knowledge-connects-03': '5',
      'victory-drones-knowledge-connects-04': '5',
      'victory-drones-knowledge-connects-05': '5',
      'victory-drones-knowledge-connects-06': '5',
    },
  },
  'ukraine-threads': {
    pack: '5',
    finale: '4',
    missionRewards: {
      'ukraine-threads-01': '5',
      'ukraine-threads-02': '4',
      'ukraine-threads-03': '4',
      'ukraine-threads-04': '4',
      'ukraine-threads-05': '4',
      'ukraine-threads-06': '4',
    },
  },
  'fpv-meet-aircraft': {
    pack: '6',
    finale: '5',
    missionRewards: {
      'fpv-meet-aircraft-01': '5',
      'fpv-meet-aircraft-02': '5',
      'fpv-meet-aircraft-03': '5',
      'fpv-meet-aircraft-04': '5',
      'fpv-meet-aircraft-05': '5',
      'fpv-meet-aircraft-06': '5',
    },
  },
  'social-drone-community-connections': {
    pack: '5',
    finale: '5',
    missionRewards: {
      'social-drone-community-connections-01': '4',
      'social-drone-community-connections-02': '4',
      'social-drone-community-connections-03': '4',
      'social-drone-community-connections-04': '4',
      'social-drone-community-connections-05': '5',
      'social-drone-community-connections-06': '5',
    },
  },
  'victory-drones-ideas-understanding': {
    pack: '5',
    finale: '5',
    missionRewards: {
      'victory-drones-ideas-understanding-01': '5',
      'victory-drones-ideas-understanding-02': '5',
      'victory-drones-ideas-understanding-03': '5',
      'victory-drones-ideas-understanding-04': '5',
      'victory-drones-ideas-understanding-05': '5',
      'victory-drones-ideas-understanding-06': '5',
    },
  },
  'ukraine-colour-clay-spring': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'ukraine-colour-clay-spring-01': '3',
      'ukraine-colour-clay-spring-02': '3',
      'ukraine-colour-clay-spring-03': '3',
      'ukraine-colour-clay-spring-04': '3',
      'ukraine-colour-clay-spring-05': '3',
      'ukraine-colour-clay-spring-06': '3',
    },
  },
  'ukraine-crimea-ornek': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'ukraine-crimea-ornek-01': '3',
      'ukraine-crimea-ornek-02': '4',
      'ukraine-crimea-ornek-03': '4',
      'ukraine-crimea-ornek-04': '4',
      'ukraine-crimea-ornek-05': '4',
      'ukraine-crimea-ornek-06': '4',
    },
  },
  'ukraine-voices-travel': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'ukraine-voices-travel-01': '4',
      'ukraine-voices-travel-02': '4',
      'ukraine-voices-travel-03': '4',
      'ukraine-voices-travel-04': '4',
      'ukraine-voices-travel-05': '4',
      'ukraine-voices-travel-06': '4',
    },
  },
  'ukraine-cities-symbols-time': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'ukraine-cities-symbols-time-01': '4',
      'ukraine-cities-symbols-time-02': '4',
      'ukraine-cities-symbols-time-03': '4',
      'ukraine-cities-symbols-time-04': '4',
      'ukraine-cities-symbols-time-05': '4',
      'ukraine-cities-symbols-time-06': '4',
    },
  },
  'ukraine-everyday-culture': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'ukraine-everyday-culture-01': '4',
      'ukraine-everyday-culture-02': '4',
      'ukraine-everyday-culture-03': '4',
      'ukraine-everyday-culture-04': '4',
      'ukraine-everyday-culture-05': '4',
      'ukraine-everyday-culture-06': '4',
    },
  },
  'fpv-parts-bench': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'fpv-parts-bench-01': '4',
      'fpv-parts-bench-02': '4',
      'fpv-parts-bench-03': '4',
      'fpv-parts-bench-04': '4',
      'fpv-parts-bench-05': '4',
      'fpv-parts-bench-06': '4',
    },
  },
  'fpv-soldering-workshop': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-soldering-workshop-01': '3',
      'fpv-soldering-workshop-02': '3',
      'fpv-soldering-workshop-03': '3',
      'fpv-soldering-workshop-04': '3',
      'fpv-soldering-workshop-05': '3',
      'fpv-soldering-workshop-06': '3',
    },
  },
  'fpv-four-controls': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-four-controls-01': '3',
      'fpv-four-controls-02': '3',
      'fpv-four-controls-03': '3',
      'fpv-four-controls-04': '3',
      'fpv-four-controls-05': '3',
      'fpv-four-controls-06': '3',
    },
  },
  'fpv-first-flight': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-first-flight-01': '3',
      'fpv-first-flight-02': '3',
      'fpv-first-flight-03': '3',
      'fpv-first-flight-04': '3',
      'fpv-first-flight-05': '3',
      'fpv-first-flight-06': '3',
    },
  },
  'fpv-drone-families': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'fpv-drone-families-01': '4',
      'fpv-drone-families-02': '4',
      'fpv-drone-families-03': '4',
      'fpv-drone-families-04': '4',
      'fpv-drone-families-05': '4',
      'fpv-drone-families-06': '4',
    },
  },
  'fpv-drones-ukraine': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'fpv-drones-ukraine-01': '4',
      'fpv-drones-ukraine-02': '4',
      'fpv-drones-ukraine-03': '4',
      'fpv-drones-ukraine-04': '4',
      'fpv-drones-ukraine-05': '4',
      'fpv-drones-ukraine-06': '4',
    },
  },
  'fpv-care-repair': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'fpv-care-repair-01': '4',
      'fpv-care-repair-02': '4',
      'fpv-care-repair-03': '4',
      'fpv-care-repair-04': '4',
      'fpv-care-repair-05': '4',
      'fpv-care-repair-06': '4',
    },
  },
});
export function curriculumPresentationRevision(
  campaignId,
  ledger = CURRICULUM_PRESENTATION_REVISIONS,
) {
  const value = ledger[campaignId] ?? {};
  const revision = {
    pack: value.pack ?? '1',
    finale: value.finale ?? '1',
    missionRewards: value.missionRewards ?? {},
  };
  for (const item of [revision.pack, revision.finale, ...Object.values(revision.missionRewards)])
    required(
      typeof item === 'string' && /^[1-9][0-9]*$/.test(item),
      'Invalid curriculum presentation revision.',
    );
  for (const id of Object.keys(revision.missionRewards))
    required(id.startsWith(campaignId + '-'), 'Reward revision belongs to another campaign.');
  return freezeDesign(revision);
}
