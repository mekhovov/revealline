import { freezeDesign } from '../content-design/catalogs.mjs';
import { required } from '../data-json.mjs';

// Exact pre-update presentations are retained before advancing this ledger.
// These reading/art revisions never change gameplay or promised requirements.
export const CURRICULUM_PRESENTATION_REVISIONS = freezeDesign({
  'social-drone-people-workshop': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'social-drone-people-workshop-01': '3',
      'social-drone-people-workshop-02': '3',
      'social-drone-people-workshop-03': '3',
      'social-drone-people-workshop-04': '3',
      'social-drone-people-workshop-05': '3',
      'social-drone-people-workshop-06': '3',
    },
  },
  'victory-drones-knowledge-connects': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'victory-drones-knowledge-connects-01': '4',
      'victory-drones-knowledge-connects-02': '4',
      'victory-drones-knowledge-connects-03': '4',
      'victory-drones-knowledge-connects-04': '4',
      'victory-drones-knowledge-connects-05': '4',
      'victory-drones-knowledge-connects-06': '4',
    },
  },
  'ukraine-threads': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'ukraine-threads-01': '3',
      'ukraine-threads-02': '3',
      'ukraine-threads-03': '3',
      'ukraine-threads-04': '3',
      'ukraine-threads-05': '3',
      'ukraine-threads-06': '3',
    },
  },
  'fpv-meet-aircraft': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'fpv-meet-aircraft-01': '3',
      'fpv-meet-aircraft-02': '4',
      'fpv-meet-aircraft-03': '4',
      'fpv-meet-aircraft-04': '4',
      'fpv-meet-aircraft-05': '4',
      'fpv-meet-aircraft-06': '4',
    },
  },
  'social-drone-community-connections': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'social-drone-community-connections-01': '3',
      'social-drone-community-connections-02': '3',
      'social-drone-community-connections-03': '3',
      'social-drone-community-connections-04': '3',
      'social-drone-community-connections-05': '4',
      'social-drone-community-connections-06': '4',
    },
  },
  'victory-drones-ideas-understanding': {
    pack: '4',
    finale: '4',
    missionRewards: {
      'victory-drones-ideas-understanding-01': '4',
      'victory-drones-ideas-understanding-02': '4',
      'victory-drones-ideas-understanding-03': '4',
      'victory-drones-ideas-understanding-04': '4',
      'victory-drones-ideas-understanding-05': '4',
      'victory-drones-ideas-understanding-06': '4',
    },
  },
  'ukraine-colour-clay-spring': {
    pack: '2',
    finale: '2',
    missionRewards: {
      'ukraine-colour-clay-spring-01': '2',
      'ukraine-colour-clay-spring-02': '2',
      'ukraine-colour-clay-spring-03': '2',
      'ukraine-colour-clay-spring-04': '2',
      'ukraine-colour-clay-spring-05': '2',
      'ukraine-colour-clay-spring-06': '2',
    },
  },
  'ukraine-crimea-ornek': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'ukraine-crimea-ornek-01': '2',
      'ukraine-crimea-ornek-02': '3',
      'ukraine-crimea-ornek-03': '3',
      'ukraine-crimea-ornek-04': '3',
      'ukraine-crimea-ornek-05': '3',
      'ukraine-crimea-ornek-06': '3',
    },
  },
  'ukraine-voices-travel': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'ukraine-voices-travel-01': '3',
      'ukraine-voices-travel-02': '3',
      'ukraine-voices-travel-03': '3',
      'ukraine-voices-travel-04': '3',
      'ukraine-voices-travel-05': '3',
      'ukraine-voices-travel-06': '3',
    },
  },
  'ukraine-cities-symbols-time': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'ukraine-cities-symbols-time-01': '3',
      'ukraine-cities-symbols-time-02': '3',
      'ukraine-cities-symbols-time-03': '3',
      'ukraine-cities-symbols-time-04': '3',
      'ukraine-cities-symbols-time-05': '3',
      'ukraine-cities-symbols-time-06': '3',
    },
  },
  'ukraine-everyday-culture': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'ukraine-everyday-culture-01': '3',
      'ukraine-everyday-culture-02': '3',
      'ukraine-everyday-culture-03': '3',
      'ukraine-everyday-culture-04': '3',
      'ukraine-everyday-culture-05': '3',
      'ukraine-everyday-culture-06': '3',
    },
  },
  'fpv-parts-bench': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-parts-bench-01': '3',
      'fpv-parts-bench-02': '3',
      'fpv-parts-bench-03': '3',
      'fpv-parts-bench-04': '3',
      'fpv-parts-bench-05': '3',
      'fpv-parts-bench-06': '3',
    },
  },
  'fpv-soldering-workshop': {
    pack: '2',
    finale: '2',
    missionRewards: {
      'fpv-soldering-workshop-01': '2',
      'fpv-soldering-workshop-02': '2',
      'fpv-soldering-workshop-03': '2',
      'fpv-soldering-workshop-04': '2',
      'fpv-soldering-workshop-05': '2',
      'fpv-soldering-workshop-06': '2',
    },
  },
  'fpv-four-controls': {
    pack: '2',
    finale: '2',
    missionRewards: {
      'fpv-four-controls-01': '2',
      'fpv-four-controls-02': '2',
      'fpv-four-controls-03': '2',
      'fpv-four-controls-04': '2',
      'fpv-four-controls-05': '2',
      'fpv-four-controls-06': '2',
    },
  },
  'fpv-first-flight': {
    pack: '2',
    finale: '2',
    missionRewards: {
      'fpv-first-flight-01': '2',
      'fpv-first-flight-02': '2',
      'fpv-first-flight-03': '2',
      'fpv-first-flight-04': '2',
      'fpv-first-flight-05': '2',
      'fpv-first-flight-06': '2',
    },
  },
  'fpv-drone-families': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-drone-families-01': '3',
      'fpv-drone-families-02': '3',
      'fpv-drone-families-03': '3',
      'fpv-drone-families-04': '3',
      'fpv-drone-families-05': '3',
      'fpv-drone-families-06': '3',
    },
  },
  'fpv-drones-ukraine': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-drones-ukraine-01': '3',
      'fpv-drones-ukraine-02': '3',
      'fpv-drones-ukraine-03': '3',
      'fpv-drones-ukraine-04': '3',
      'fpv-drones-ukraine-05': '3',
      'fpv-drones-ukraine-06': '3',
    },
  },
  'fpv-care-repair': {
    pack: '3',
    finale: '3',
    missionRewards: {
      'fpv-care-repair-01': '3',
      'fpv-care-repair-02': '3',
      'fpv-care-repair-03': '3',
      'fpv-care-repair-04': '3',
      'fpv-care-repair-05': '3',
      'fpv-care-repair-06': '3',
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
