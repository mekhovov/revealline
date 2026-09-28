import { freezeDesign } from '../content-design/catalogs.mjs';
import { required } from '../data-json.mjs';

// Capture the selected edition presentation before changing these entries.
// Presentation updates advance the authoring pack and affected reward promises;
// they must not advance campaign, mission or map gameplay revisions.
const firstDiscoveryCampaigns = [
  'social-drone-people-workshop',
  'social-drone-community-connections',
  'victory-drones-knowledge-connects',
  'victory-drones-ideas-understanding',
  'ukraine-threads',
  'fpv-meet-aircraft',
];
export const CURRICULUM_PRESENTATION_REVISIONS = freezeDesign(
  Object.fromEntries(
    firstDiscoveryCampaigns.map((id) => [
      id,
      {
        pack: '2',
        finale: '2',
        missionRewards: Object.fromEntries(
          Array.from({ length: 6 }, (_, index) => [
            `${id}-${String(index + 1).padStart(2, '0')}`,
            '2',
          ]),
        ),
      },
    ]),
  ),
);

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
