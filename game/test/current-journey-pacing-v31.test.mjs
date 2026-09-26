import test from 'node:test';
import assert from 'node:assert/strict';
import { createApexCulturalRoutesCandidates } from '../content-design/apex-cultural-routes-candidates.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { inspectJourneySpatialVariety } from '../content-design/spatial-variety.mjs';
import { WHOLE_JOURNEY_CORE_PACK_IDS } from '../content-design/whole-journey-order.mjs';

const source = createApexCulturalRoutesCandidates({ artwork: true });
const report = inspectJourneySpatialVariety(source, {
  packIds: WHOLE_JOURNEY_CORE_PACK_IDS,
  mode: 'solo',
  difficulty: 'standard',
});

test('current v25 route owns the exact 91-mission source and 71-mission core selection', () => {
  const route = createAuthoredJourneyRoute('whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, route.id);
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, route.id);
  assert.deepEqual(route.source, source);
  assert.equal(source.missions.length, 91);
  assert.equal(report.missionCount, 71);
  assert.equal(report.campaigns.length, 13);
  assert.equal(report.qualification, 'runtime-prepared-inventory-not-human-balance-evidence');
});

test('current core bands rise without a campaign reset and standard movement is consistent', () => {
  assert.deepEqual([...new Set(report.rows.map((row) => row.playerSpeed))], [8.84]);
  assert.equal(Math.min(...report.rows.map((row) => row.difficultyBand)), 1);
  assert.equal(Math.max(...report.rows.map((row) => row.difficultyBand)), 12);
  for (let index = 1; index < report.rows.length; index++) {
    const change = report.rows[index].difficultyBand - report.rows[index - 1].difficultyBand;
    assert(change >= 0, `${report.rows[index].missionId} resets its challenge band`);
    assert(change <= 1, `${report.rows[index].missionId} skips a challenge band`);
  }
  assert.equal(report.timedMissionOccurrences, 0);
  assert(report.timedFraction < 0.15);
});

test('post-opening missions retain authored pressure while open-plain repetition stays visible', () => {
  const afterOpening = report.rows.filter((row) => row.packId !== WHOLE_JOURNEY_CORE_PACK_IDS[0]);
  assert(afterOpening.every((row) => row.startingPressure.fieldEnemies >= 3));
  assert.deepEqual(
    afterOpening.filter((row) => row.openPlain).map((row) => row.missionId),
    [
      'behind-the-patrol',
      'second-landing',
      'long-rail',
      'new-frontier',
      'turn-the-corner',
      'return-pocket',
      'folded-corner',
      'inside-out',
      'four-quarters',
      'side-door-bays',
      'split-berths',
      'stepped-return',
      'bank-the-crossing',
      'five-anchors',
      'spiral-stores',
      'nested-relays',
      'watchpost-exchange',
      'survey-markers',
      'compass-array',
      'outer-loop',
      'final-broadcast',
    ],
  );
});

test('surface inventory uses terrain kind and does not mislabel hazards as absent', () => {
  const terrainRows = report.rows.filter((row) => row.surfaces.terrainRectangles > 0);
  assert.equal(terrainRows.length, 30);
  assert(terrainRows.some((row) => row.surfaces.slowRectangles > 0));
  assert(terrainRows.some((row) => row.surfaces.lethalRectangles > 0));
  for (const row of terrainRows)
    assert.equal(
      row.surfaces.terrainRectangles,
      row.surfaces.slowRectangles + row.surfaces.lethalRectangles,
      row.missionId,
    );
});
