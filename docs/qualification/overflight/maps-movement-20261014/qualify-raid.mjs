/** Ordinary-input, deterministic simulation qualification; not browser or player evidence. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { OVERFLIGHT_BATTLEFIELDS } from '../../../../game/overflight/battlefields.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../../../../game/overflight/raid-mode.mjs';
import { createOverflightHuntReviewPilot } from '../../../../game/overflight/raid-review-pilot.mjs';
import { createOverflightRaidVariant } from '../../../../game/overflight/raid-variants.mjs';

const root = new URL('../../../../', import.meta.url);
const sources = [
  'game/overflight/battlefields.mjs',
  'game/overflight/terrain.mjs',
  'game/overflight/core.mjs',
  'game/overflight/project.mjs',
  'game/overflight/raid-project.mjs',
  'game/overflight/raid-core.mjs',
  'game/overflight/raid-review-pilot.mjs',
  'game/overflight/raid-variants.mjs',
  'game/overflight/raid-upgrades.mjs',
  'game/overflight/tactics.mjs',
  'game/overflight/grid.mjs',
  'game/overflight/flight-profile.mjs',
  'game/overflight/upgrades.mjs',
  'game/overflight/raid-mode.mjs',
  'game/overflight/motion.mjs',
  'game/overflight/coordinated-movement.mjs',
];
const hashes = () =>
  Object.fromEntries(
    sources.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(new URL(path, root)))
        .digest('hex'),
    ]),
  );
const before = hashes();
const rows = [];
const label = process.argv[2] ?? 'initial';
const selected = process.argv[3];
const layoutList = OVERFLIGHT_BATTLEFIELDS.filter((layout) => !selected || layout.id === selected);
const seed = 17031991;
function trial(layout, route, baseline, variant = null) {
  const mode = variant
    ? createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant })
    : OVERFLIGHT_HUNT_MODE;
  const compiled = mode.compileProject(
    mode.createProject({ rulesVersion: 4, layout: layout.id, seed, difficulty: 'standard' }),
  );
  const run = mode.createRun(compiled, { airframes: 3, slowResume: true });
  const contracts = [];
  for (let contract = 1; contract <= (variant === 'marathon' ? 5 : 1); contract++) {
    // Baseline capability audit only: withhold drafts, granting no additional power.
    if (baseline) run.progression.maxChoices = 0;
    const pilot = createOverflightHuntReviewPilot({ route, build: 'pursuer' });
    const samples = [];
    let nextSample = 0;
    mode.start(run);
    while (['playing', 'upgrade'].includes(run.phase) && run.time < 300) {
      if (run.phase === 'upgrade') {
        if (!mode.choose(run, pilot.choose(run)?.id)) throw Error('Illegal review draft.');
        continue;
      }
      mode.step(run, pilot.input(run));
      if (run.time >= nextSample) {
        samples.push({
          time: run.time,
          player: { x: run.player.x, y: run.player.y, hull: run.player.hull },
          airframes: run.airframesRemaining,
          kills: run.stats.kills,
          damage: run.stats.damageTaken,
          objectives: run.hunt.objectivesCompleted,
          targets: run.enemies
            .filter((e) => e.active && e.objectiveId)
            .map((e) => ({
              id: e.objectiveId,
              x: e.x,
              y: e.y,
              behavior: e.behavior,
              armor: e.armorSegments,
              phase: e.attackPhase,
            })),
        });
        nextSample += 10;
      }
    }
    contracts.push({
      contract,
      layout: run.compiled.battlefield.id,
      seed: run.seed,
      summary: mode.summary(run),
      samples,
    });
    if (variant !== 'marathon' || run.phase !== 'won' || !mode.continueContract(run)) break;
  }
  const row = {
    layout: layout.id,
    route,
    baseline,
    variant,
    seed,
    policy: baseline
      ? 'Technical baseline-kit audit: drafts disabled; ordinary movement, damage and objective rules.'
      : 'Existing review pilot; ordinary steering, boost and earned card selection only.',
    contracts,
    passed:
      contracts.length === (variant === 'marathon' ? 5 : 1) &&
      contracts.every((c) => c.summary.phase === 'won'),
  };
  rows.push(row);
  console.log(
    JSON.stringify({
      layout: row.layout,
      route,
      baseline,
      variant,
      passed: row.passed,
      contracts: contracts.map((c) => ({
        layout: c.layout,
        phase: c.summary.phase,
        seconds: c.summary.time,
        damage: c.summary.stats.damageTaken,
        objectives: c.summary.hunt.objectivesCompleted,
      })),
    }),
  );
}
for (const layout of layoutList) {
  trial(layout, 'objectives', true);
  trial(layout, 'objectives', false);
  trial(layout, 'packs', false);
}
for (const world of [...new Set(layoutList.map((layout) => layout.world))]) {
  const layout = layoutList.find((item) => item.world === world);
  trial(layout, 'objectives', false, 'time-attack');
  trial(layout, 'objectives', false, 'marathon');
}
const after = hashes();
const report = {
  kind: 'Native simulation public-input capability; no rendering, performance or enjoyment claim.',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  sourceBefore: before,
  sourceAfter: after,
  sourceStable: JSON.stringify(before) === JSON.stringify(after),
  settings: { rules: 4, seed, difficulty: 'standard', airframes: 3, limitSeconds: 300 },
  totals: { trials: rows.length, passed: rows.filter((row) => row.passed).length },
  failures: rows
    .filter((row) => !row.passed)
    .map(({ contracts, ...row }) => ({
      ...row,
      final: {
        phase: contracts.at(-1).summary.phase,
        time: contracts.at(-1).summary.time,
        objectives: contracts.at(-1).summary.hunt.objectivesCompleted,
        layout: contracts.at(-1).layout,
        contract: contracts.length,
      },
    })),
  rows,
};
writeFileSync(
  new URL(`./raid-${label}.json.gz`, import.meta.url),
  gzipSync(JSON.stringify(report)),
);
const { rows: omitted, ...brief } = report;
writeFileSync(
  new URL(`./raid-${label}-summary.json`, import.meta.url),
  JSON.stringify(brief, null, 2),
);
console.log(JSON.stringify({ sourceStable: report.sourceStable, ...report.totals }));
