#!/usr/bin/env node
// Full preset/steering historical-route retiming; never changes authored content.
// Prints JSONL evidence only. No publication, file writes or human balance claim.
import { readFile } from 'node:fs/promises';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CHAPTERS,
} from '../game/content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { withPressureDifficulty } from '../game/content-design/pressure-candidates.mjs';
import { assessPressureRoute } from './lib/pressure-route-assessment.mjs';

const chapter = process.argv[2] ?? 'all';
if (chapter !== 'all' && !WHOLE_JOURNEY_CHAPTERS.some((c) => c.id === chapter))
  throw new Error('Unknown Journey chapter');
const old = compileContentProject(createWholeJourneyCandidates());
const next = compileContentProject(withPressureDifficulty(old.source));
const delays = [0, 60, 120, 180, 240, 360, 480, 600, 900, 1200];
const read = async (name) =>
  JSON.parse(await readFile(new URL(`../game/test/fixtures/${name}-routes.json`, import.meta.url)));
for (const entry of WHOLE_JOURNEY_CHAPTERS.filter((c) => chapter === 'all' || c.id === chapter)) {
  const fixture = await read(entry.id === 'horizon' ? 'horizon-greybox' : `${entry.id}-clear`);
  const sets =
    entry.id === 'horizon'
      ? [
          { difficulty: 'standard', turnPolicy: 'immediate', rows: fixture.rows },
          ...(await read('horizon-preset')).sets,
        ]
      : fixture.sets.filter((s) => s.bonuses !== false);
  for (const { difficulty, turnPolicy, rows } of sets)
    for (const [missionId, identity, checkpoint, segments] of rows) {
      const previous = resolveMission(old, missionId, { difficulty });
      const original = assessPressureRoute(previous.level, { segments, turnPolicy });
      if (
        previous.simulationIdentity !== identity ||
        original.checkpoint !== checkpoint ||
        original.status !== 'no-loss-clear'
      )
        throw new Error(`Historical evidence mismatch: ${missionId}/${difficulty}/${turnPolicy}`);
      const manifest = resolveMission(next, missionId, { difficulty }),
        attempts = [];
      let chosen = null;
      const routes = [
        { difficulty, segments },
        ...sets
          .filter((s) => s.turnPolicy === turnPolicy && s.difficulty !== difficulty)
          .map((s) => ({
            difficulty: s.difficulty,
            segments: s.rows.find((row) => row[0] === missionId)[3],
          })),
      ];
      let lastFailure = null;
      search: for (const route of routes)
        for (const initialDelayTicks of delays) {
          const result = assessPressureRoute(manifest.level, {
            segments: route.segments,
            turnPolicy,
            initialDelayTicks,
          });
          const { segments: played, ...metrics } = result;
          attempts.push([
            route.difficulty,
            initialDelayTicks,
            result.status,
            result.ticks,
            result.coverage,
          ]);
          if (!played) lastFailure = metrics;
          if (result.status === 'no-loss-clear') {
            const checked = assessPressureRoute(manifest.level, {
              segments: played,
              turnPolicy,
              replay: true,
            });
            if (checked.checkpoint !== result.checkpoint)
              throw new Error('Retiming prefix does not reproduce');
            chosen = { routeSourceDifficulty: route.difficulty, initialDelayTicks, ...checked };
            break search;
          }
        }
      console.log(
        JSON.stringify({
          chapter: entry.id,
          missionId,
          difficulty,
          turnPolicy,
          seed: 1,
          simulationIdentity: manifest.simulationIdentity,
          oldIdentity: identity,
          oldCheckpoint: checkpoint,
          attempts,
          chosen,
          ...(!chosen ? { lastFailure } : {}),
          qualification: chosen
            ? 'legal-route-and-replay-only'
            : 'needs-new-route-not-proven-impossible',
        }),
      );
    }
}
