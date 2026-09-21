import { readFile } from 'node:fs/promises';

export const VARIETY_ARCS = [
  ['cross-stitch-crossings', 'rushnyk-bands', 'pysanka-sections', 'dnipro-crossings'],
  ['four-motor-landings', 'circuit-lanes', 'twin-lens-chambers', 'toolbench-weave'],
];
const original = JSON.parse(
  await readFile(new URL('../fixtures/cultural-workshop-clear-routes.json', import.meta.url)),
);
const spatial = JSON.parse(
  await readFile(new URL('../fixtures/spatial-balance-clear-routes.json', import.meta.url)),
);
// Preserve the existing recordings and greybox goldens. Only the two explicitly
// revised maps use spatial-v2 inputs; motor-feint is a different, excluded study.
export const VARIETY_ROUTES = [
  ...original.sets.flatMap(({ difficulty, turnPolicy, rows }) =>
    rows
      .filter(([id]) => !['dnipro-crossings', 'four-motor-landings'].includes(id))
      .map(([id, identity, checkpoint, segments]) => ({
        id,
        difficulty,
        turnPolicy,
        seed: original.seed,
        identity,
        greyboxCheckpoint: checkpoint,
        segments,
      })),
  ),
  ...spatial.rows
    .filter((r) => ['dnipro-crossings', 'four-motor-landings'].includes(r.mission))
    .map((r) => ({
      id: r.mission,
      difficulty: r.difficulty,
      turnPolicy: r.turnPolicy,
      seed: r.seed,
      identity: r.simulationIdentity,
      greyboxCheckpoint: r.checkpoint,
      segments: r.segments,
    })),
];
