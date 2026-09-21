import { createBorderCandidates } from './border-candidates.mjs';
import { editTimedBonus } from './timed-bonuses.mjs';
import { dataIdentity } from '../data-json.mjs';

/** Explicit timing study on existing Border layouts and pictures. This does not
 * replace historical Border, count as newly authored maps or enroll a release. */
export function createTimedBorderCandidates({ artwork = false } = {}) {
  let source = createBorderCandidates({ artwork });
  const recipes = [
    [
      'behind-the-patrol',
      'enemy-slow',
      [
        [11.5, 10.5],
        [27.5, 13.5],
        [33.5, 26.5],
      ],
    ],
    [
      'second-landing',
      'extra-life',
      [
        [40.5, 8.5],
        [43.5, 21.5],
        [58.5, 18.5],
      ],
    ],
    [
      'long-rail',
      'enemy-freeze',
      [
        [27.5, 8.5],
        [44.5, 15.5],
        [52.5, 26.5],
      ],
    ],
  ];
  for (const [id, kind, anchors] of recipes) {
    const schedule = {
      id: `${id}-window`,
      kind,
      anchors: anchors.map(([x, y]) => ({ x, y })),
      initialDelayTicks: 600,
      announcementTicks: 120,
      availableTicks: 1200,
      cooldownTicks: 1440,
      maxAppearances: 3,
      maxCollections: 1,
    };
    source = editTimedBonus(source, id, { action: 'add', id: schedule.id, schedule });
  }
  source.id = 'journey-border-timed-review';
  source.name = 'Border Bloom · unvalidated timed bonus study';
  source.revision = `timed-bonus-${dataIdentity(source)}`;
  for (const campaign of source.campaigns)
    if (campaign.missionIds.some((id) => recipes.some(([missionId]) => id === missionId)))
      campaign.revision = `timed-bonus-${dataIdentity(campaign)}`;
  for (const pack of source.packs)
    if (
      pack.campaignIds.some((id) =>
        source.campaigns.find((c) => c.id === id)?.revision.startsWith('timed-bonus-'),
      )
    )
      pack.revision = `timed-bonus-${dataIdentity(pack)}`;
  return source;
}
