import { freezeDesign } from '../content-design/catalogs.mjs';

const definitions = [[
    'droneaid-community-relay',
    'droneaid',
    'Community Relay',
    'Community support pilot',
    [
      [
        'Workshop Lights',
        'Connect the community workshop’s component stations.',
        'A warm workshop brings tools, frames and people into a shared project.',
        'Reach the centre bench or connect the smaller component tables first.',
      ],
      [
        'Community Relay',
        'Link the workshop, collection point and delivery hub.',
        'A friendly support route connects packing tables and community logistics.',
        'Use the collection dock as an intermediate return on the way to the far hub.',
      ],
      [
        'After the Storm',
        'Restore a fictional civilian support and communications route.',
        'Field notes and a recovering landscape celebrate emergency collaboration.',
        'Build a sheltered inner route before crossing the final exposed field.',
      ],
    ],
  ]];

export const COMPANY_CAMPAIGNS = freezeDesign(
  definitions.map(([id, brandId, name, audience, rows]) => ({
    id,
    revision: [].includes(id)
      ? '2'
      : '1',
    name,
    brandId,
    audience,
    publication: 'public',
    sourcePath: `game/content/company-campaigns/${id}.json`,
    assetIds: [],
    modes: ['solo'],
    missionIds: rows.map((_, index) => `${id}-${String(index + 1).padStart(2, '0')}`),
  })),
);
export const COMPANY_MISSIONS = freezeDesign(
  definitions.flatMap(([campaignId, brandId, , audience, rows]) =>
    rows.map(([name, brief, scene, routeDecision], index) => ({
      id: `${campaignId}-${String(index + 1).padStart(2, '0')}`,
      campaignId,
      brandId,
      audience,
      ordinal: index + 1,
      name,
      brief,
      scene,
      routeDecision,
      lessonId: [].includes(campaignId)
        ? `${campaignId}-${String(index + 1).padStart(2, '0')}-lesson`
        : null,
    })),
  ),
);
export function companyCampaign(id) {
  return COMPANY_CAMPAIGNS.find((entry) => entry.id === id) ?? null;
}
export function companyMission(id) {
  return COMPANY_MISSIONS.find((entry) => entry.id === id) ?? null;
}
