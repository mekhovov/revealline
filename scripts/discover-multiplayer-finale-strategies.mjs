import { readFile, writeFile } from 'node:fs/promises';
import {
  finaleCases,
  playFinale,
  routeDifference,
} from '../game/test/helpers/multiplayer-finale-qualification.mjs';

// Explicit offline discovery only. It perturbs legal held-direction spans and
// replays from tick zero, retaining unsuccessful probes rather than generating
// new expected answers during tests. Existing proof fixtures are never edited.
const [mode = 'team', output = `.cache/${mode}-finale-strategies.json`, filter = 'all'] =
  process.argv.slice(2);
if (!['team', 'versus'].includes(mode)) throw new TypeError('Expected team or versus.');
const receipt = {
  kind: 'finale-alternative-discovery-not-human-review',
  mode,
  rows: [],
  probes: [],
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
};
try {
  Object.assign(receipt, JSON.parse(await readFile(output)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (receipt.mode !== mode) throw new TypeError('An existing receipt belongs to another mode.');
const selected = (await finaleCases(mode)).filter(
  (row) => filter === 'all' || filter.split(',').includes(row.missionId),
);
if (!selected.length) throw new TypeError('No matching chapter finale.');
for (const row of selected) {
  const primary = playFinale(row, row.primary);
  if (!primary.won) throw new Error(`Existing route no longer wins: ${row.missionId}`);
  const retained = receipt.rows.find((r) => r.missionId === row.missionId);
  if (retained) {
    if (
      retained.authoredIdentity !== row.authoredIdentity ||
      retained.tunedIdentity !== row.tunedIdentity
    )
      throw new Error(
        `Stale source identity; preserve this receipt and choose a new output: ${row.missionId}`,
      );
    const replay = playFinale(row, retained.alternative);
    const difference = routeDifference(primary, replay);
    if (!replay.won || difference.maxChangedCells < 24 || difference.maxChangedTrailCells < 2)
      throw new Error(`Retained alternative fails qualification: ${row.missionId}`);
    continue;
  }
  let found;
  const probes = [];
  // Substantial span changes first; an accepted route must change >=24 actual
  // claimed cells in a capture, not merely its time or the command spelling.
  for (const delta of [-120, 120, -60, 60, -240, 240, -30, 30, -360, 360]) {
    for (let index = 0; index < row.primary.length; index++) {
      const segment = row.primary[index];
      if (segment.ticks < 30 || segment.ticks + delta < 1) continue;
      const segments = structuredClone(row.primary);
      segments[index].ticks += delta;
      const candidate = playFinale(row, segments);
      const difference = routeDifference(primary, candidate);
      probes.push({
        index,
        delta,
        status: candidate.run.status,
        tick: candidate.run.tick,
        closed: candidate.closed,
        ...difference,
      });
      if (
        candidate.won &&
        difference.maxChangedCells >= 24 &&
        difference.maxChangedTrailCells >= 2 &&
        !candidate.hazards.some((e) => e.type === 'player.downed')
      ) {
        found = {
          mode,
          chapter: row.chapter,
          missionId: row.missionId,
          difficulty: 'standard',
          authoredIdentity: row.authoredIdentity,
          tunedIdentity: row.tunedIdentity,
          options: row.options,
          primary: primary.segments,
          alternative: candidate.segments,
          change: { index, delta },
          observations: {
            primaryTicks: primary.run.tick,
            alternativeTicks: candidate.run.tick,
            primaryClosures: primary.closed,
            alternativeClosures: candidate.closed,
            ...difference,
          },
        };
        break;
      }
    }
    if (found) break;
  }
  if (!found)
    for (const difficulty of ['gentle', 'expert']) {
      const source = JSON.parse(
        await readFile(
          new URL(
            `../game/test/fixtures/multiplayer-expansion/${mode === 'team' ? difficulty : `duel-${difficulty}-immediate`}.json`,
            import.meta.url,
          ),
        ),
      );
      const segments = source.rows.find((r) => r.missionId === row.missionId).segments;
      const candidate = playFinale(row, segments);
      const difference = routeDifference(primary, candidate);
      probes.push({
        source: difficulty,
        status: candidate.run.status,
        tick: candidate.run.tick,
        closed: candidate.closed,
        ...difference,
      });
      if (
        candidate.won &&
        difference.maxChangedCells >= 24 &&
        difference.maxChangedTrailCells >= 2 &&
        !candidate.hazards.some((e) => e.type === 'player.downed')
      ) {
        found = {
          mode,
          chapter: row.chapter,
          missionId: row.missionId,
          difficulty: 'standard',
          authoredIdentity: row.authoredIdentity,
          tunedIdentity: row.tunedIdentity,
          options: row.options,
          primary: primary.segments,
          alternative: candidate.segments,
          change: { source: difficulty, replayedDifficulty: 'standard' },
          observations: {
            primaryTicks: primary.run.tick,
            alternativeTicks: candidate.run.tick,
            primaryClosures: primary.closed,
            alternativeClosures: candidate.closed,
            ...difference,
          },
        };
        break;
      }
    }
  receipt.probes.push({ missionId: row.missionId, attempts: probes });
  if (found) receipt.rows.push(found);
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
  console.log(
    `${row.missionId}: ${found ? 'qualified alternative' : 'NO ALTERNATIVE'} after ${probes.length} probes${found ? `; ${found.observations.maxChangedCells} changed cells` : ''}`,
  );
}
if (selected.some((row) => !receipt.rows.some((r) => r.missionId === row.missionId)))
  process.exitCode = 1;
