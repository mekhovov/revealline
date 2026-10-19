import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { libraryMissionId } from '../../mission-library/library.mjs';
import { journeyMissionId } from '../../journey/catalog.mjs';

// Independent source membership pins, never rendered cards or a second compiled
// project. The fixture records exact authored metadata inputs and their hashes.
const membership = JSON.parse(
  await readFile(new URL('../fixtures/duel-library-membership.json', import.meta.url)),
);
assert.equal(membership.format, 'duel-library-membership-fixture.v1');
const classicRows = membership.classic.flatMap(
  ({ owner, edition, campaign, modes, lifecycle, missions }) =>
    missions.map(([mission, revision]) => ({
      id: libraryMissionId({ owner, edition, campaign, mission, revision }),
      modes,
      lifecycle,
      collection: 'Classic',
    })),
);

function journeyRows(
  campaigns,
  edition,
  modes,
  { owner = `journey:${edition}`, lifecycle = 'current' } = {},
) {
  return campaigns.flatMap(({ packId, campaignId, missionIds }) =>
    missionIds.map((levelId) => ({
      id: libraryMissionId({
        owner,
        edition,
        campaign: JSON.stringify(['candidate', packId, campaignId]),
        mission: journeyMissionId({ source: 'candidate', packId, campaignId, levelId }),
      }),
      modes,
      lifecycle,
      collection: 'Journey',
    })),
  );
}
const teamRows = [
  ...journeyRows(membership.teamJourney, 'team-cultural-specialist-originals-2', ['team']),
  ...journeyRows(membership.expedition.team, 'team-expedition-v1', ['team']),
  ...journeyRows(membership.hunt.team, 'humanoid-hunt-v1', ['team'], {
    owner: 'team-journey:humanoid-hunt-v1',
  }),
  ...membership.teamClassic.flatMap(({ owner, edition, campaign, modes, lifecycle, missions }) =>
    missions.map(([mission, revision]) => ({
      id: libraryMissionId({ owner, edition, campaign, mission, revision }),
      modes,
      lifecycle,
      collection: 'Classic',
    })),
  ),
];
export function expectedDuelLibraryRows({
  route = 'whole-spatial-v25',
  mode = 'versus',
  lifecycle = '',
  collection = '',
} = {}) {
  assert.ok(['whole-spatial-v25', 'opening', 'legacy'].includes(route));
  const active = route === 'legacy' ? 'whole-spatial-v25' : route;
  const campaigns =
    active === 'opening'
      ? membership.journey.filter(({ packId }) =>
          ['journey-opening', 'opening-remixes'].includes(packId),
        )
      : membership.journey;
  const rows = [
    ...classicRows,
    ...journeyRows(campaigns, active, ['solo', 'versus'], {
      lifecycle: active === 'opening' ? 'archive' : 'current',
    }),
    ...membership.historical[active].flatMap(({ routeId, missionIds }) =>
      journeyRows(
        membership.journey.map((row) => ({
          ...row,
          missionIds: row.missionIds.filter((id) => missionIds.includes(id)),
        })),
        routeId,
        ['solo', 'versus'],
        { lifecycle: 'archive' },
      ),
    ),
    ...journeyRows(membership.expedition.versus, 'duel-expedition-v1', ['versus']),
    ...journeyRows(membership.hunt.versus, 'humanoid-hunt-v1', ['versus']),
    ...teamRows,
  ];
  assert.equal(
    new Set(rows.map(({ id }) => id)).size,
    rows.length,
    'Independent membership contains no duplicate opaque identities',
  );
  return rows.filter(
    (row) =>
      row.modes.includes(mode) &&
      (!lifecycle || row.lifecycle === lifecycle) &&
      (!collection || row.collection === collection),
  );
}
export function assertDuelLibraryInventory(page, options = {}) {
  const expected = new Set(expectedDuelLibraryRows(options).map(({ id }) => id));
  const actual = [...page.$('journey-cards').children].map((card) => card.dataset.missionId);
  assert.equal(
    new Set(actual).size,
    actual.length,
    'Every visible mission has a unique opaque identity',
  );
  assert.deepEqual(
    new Set(actual),
    expected,
    'Exactly the independently registered mission identities are visible',
  );
  return expected;
}
