#!/usr/bin/env node
// Read-only comparison of exact historic legal routes with a pressure candidate.
// Failure does NOT prove unsolvability; success does NOT prove enjoyable balance.
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../game/content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { withPressureDifficulty } from '../game/content-design/pressure-candidates.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { authoritativeCheckpoint } from '../game/replay.mjs';

const fixtures = [
  'horizon-greybox',
  'border-clear',
  'signal-clear',
  'neon-clear',
  'rover-clear',
  'fracture-clear',
  'phase-clear',
  'livewire-clear',
  'relay-clear',
  'crosswind-clear',
  'sentinel-clear',
  'apex-clear',
];
const source = createWholeJourneyCandidates();
const old = compileContentProject(source);
const next = compileContentProject(withPressureDifficulty(source));
const rows = [];
for (const name of fixtures) {
  const fixture = JSON.parse(
    await readFile(new URL(`../game/test/fixtures/${name}-routes.json`, import.meta.url)),
  );
  const routes =
    fixture.rows ??
    fixture.sets.find(
      (set) =>
        set.difficulty === 'standard' && set.turnPolicy === 'immediate' && set.bonuses !== false,
    ).rows;
  for (const [id, identity, checkpoint, segments] of routes) {
    const results = [old, next].map((project) => {
      const manifest = resolveMission(project, id);
      const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
      for (const [direction, ticks] of segments)
        for (let i = 0; i < ticks; i++) stepRun(run, { direction }, FIXED_DT);
      return {
        identity: manifest.simulationIdentity,
        checkpoint: authoritativeCheckpoint(run).hash,
        status: run.status,
        losses: run.classic.livesLost,
        seconds: run.time,
        coverage: run.coverage,
      };
    });
    if (results[0].identity !== identity || results[0].checkpoint !== checkpoint)
      throw new Error(`Historical fixture mismatch: ${id}. Do not use this probe as evidence.`);
    rows.push({ missionId: id, chapter: name, old: results[0], pressure: results[1] });
  }
}
const clear = (r) => r.status === 'won' && r.losses === 0;
process.stdout.write(
  JSON.stringify(
    {
      format: 'JourneyPressureRouteProbeV1',
      scope:
        'All83 historical Standard/immediate/seed1 routes, bonuses authored. Not replacement-route search or human balance evidence.',
      summary: {
        missions: rows.length,
        historicNoLossClears: rows.filter((r) => clear(r.old)).length,
        pressureNoLossClears: rows.filter((r) => clear(r.pressure)).length,
        pressureRouteNeedsReview: rows.filter((r) => !clear(r.pressure)).map((r) => r.missionId),
        pressureSub15SecondClears: rows
          .filter((r) => clear(r.pressure) && r.pressure.seconds < 15)
          .map((r) => ({ id: r.missionId, seconds: r.pressure.seconds })),
      },
      rows,
    },
    null,
    2,
  ) + '\n',
);
