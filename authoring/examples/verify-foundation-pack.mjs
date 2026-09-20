import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preparePack, scenarioFromPack } from '../../game/packs.mjs';
import { createRun, stepRun, FIXED_DT, getSummary } from '../../game/core/index.mjs';

if (process.argv.length !== 3) {
  throw new Error('Usage: node authoring/examples/verify-foundation-pack.mjs PACK.json');
}
const { pack } = await preparePack(await readFile(resolve(process.argv[2]), 'utf8'));
if (pack.id !== 'workshop-foundation-example' || pack.campaigns.length !== 1) {
  throw new Error('This route verifies only the foundation teaching example.');
}
const results = [];
for (const turnPolicy of ['immediate', 'grid-center']) {
  const scenario = scenarioFromPack(pack, pack.campaigns[0].id, 'workshop-first-bridge', {
    turnPolicy,
    seed: 1,
  });
  const run = createRun(scenario.level, {
    ...scenario.settings,
    classRecipes: scenario.classRecipes,
  });
  const segments = [];
  const route = [
    ['left', () => run.player.x <= 0.500001],
    ['right', () => run.player.x >= 32.499999],
    ['down', () => run.status !== 'running'],
  ];
  for (const [direction, reached] of route) {
    const start = run.tick;
    while (run.status === 'running' && !reached() && run.tick - start < 5000) {
      stepRun(run, { direction }, FIXED_DT);
    }
    if (!reached()) throw new Error(`${turnPolicy}: ${direction} waypoint not reached.`);
    segments.push({ direction, ticks: run.tick - start });
  }
  const summary = getSummary(run);
  if (summary.status !== 'won' || summary.lives !== 3) {
    throw new Error(`${turnPolicy}: expected a legal win without losing a life.`);
  }
  results.push({ turnPolicy, segments, summary });
}
console.log(
  JSON.stringify(
    { scope: 'Legal-input reachability, not difficulty or device certification.', results },
    null,
    2,
  ),
);
