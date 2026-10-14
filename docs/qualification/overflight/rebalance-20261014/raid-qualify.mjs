/** Ordinary-input reachability and bounded rewards, not human medal calibration. */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../../../../game/overflight/raid-project.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../../../../game/overflight/raid-mode.mjs';
import { createOverflightRaidVariant } from '../../../../game/overflight/raid-variants.mjs';
import { createOverflightHuntReviewPilot } from '../../../../game/overflight/raid-review-pilot.mjs';
import { overflightHuntInvestedRanks } from '../../../../game/overflight/raid-upgrades.mjs';
const paths = [
  'game/overflight/raid-project.mjs',
  'game/overflight/raid-core.mjs',
  'game/overflight/raid-variants.mjs',
  'game/overflight/raid-upgrades.mjs',
  'game/overflight/raid-review-pilot.mjs',
  'game/overflight/combat-profile.mjs',
  'game/overflight/tactics.mjs',
];
const hashSources = () =>
  Object.fromEntries(
    paths.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(new URL('../../../../' + path, import.meta.url)))
        .digest('hex'),
    ]),
  );
const sources = hashSources();
function trial({
  seed,
  difficulty,
  encounterSet,
  route = 'objectives',
  build = 'baseline',
  variant = null,
}) {
  const mode = variant
    ? createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant })
    : OVERFLIGHT_HUNT_MODE;
  const compiled = compileOverflightHuntProject(
    createOverflightHuntProject({
      rulesVersion: 3,
      seed,
      difficulty,
      encounterSet,
    }),
  );
  const run = mode.createRun(compiled, { airframes: 3, slowResume: false });
  run.review = true;
  const pilot = createOverflightHuntReviewPilot({
    route,
    build: build === 'baseline' ? 'pursuer' : build,
  });
  const choices = [],
    contracts = [];
  let maxRanks = 0;
  if (build === 'baseline') run.progression.maxChoices = 0;
  mode.start(run);
  let exception;
  try {
    for (let ticks = 0; ticks < 60 * 600; ticks++) {
      if (run.phase === 'upgrade') {
        const card = pilot.choose(run);
        if (!card) throw Error('Missing legal offer');
        choices.push({
          contract: run.raidVariant?.contract ?? 1,
          time: run.time,
          id: card.id,
        });
        if (!mode.choose(run, card.id)) throw Error('Rejected offered card');
      } else if (run.phase === 'playing') mode.step(run, pilot.input(run));
      maxRanks = Math.max(maxRanks, overflightHuntInvestedRanks(run.build));
      if (run.phase === 'lost') break;
      if (run.phase === 'won') {
        contracts.push({
          contract: run.raidVariant?.contract ?? 1,
          time: run.time,
          hull: run.player.hull,
          airframes: run.airframesRemaining,
          damage: run.stats.damageTaken,
        });
        if (variant !== 'marathon' || !mode.continueContract(run)) break;
        if (build === 'baseline') run.progression.maxChoices = 0;
        mode.start(run);
      }
    }
  } catch (error) {
    exception = error.stack;
  }
  return {
    seed,
    difficulty,
    encounterSet,
    route,
    build,
    variant,
    outcome: exception ? 'exception' : run.phase,
    time: run.time,
    maxRanks,
    choices,
    contracts,
    exception,
    summary: mode.summary(run),
  };
}
const results = [];
for (const seed of [17031991, 42, 101])
  for (const difficulty of ['relaxed', 'standard', 'veteran'])
    for (const encounterSet of ['patrol', 'crossing', 'mixed'])
      for (const route of ['objectives', 'packs'])
        for (const build of ['baseline', 'sweeper', 'pursuer', 'breaker'])
          results.push(trial({ seed, difficulty, encounterSet, route, build }));
for (const difficulty of ['relaxed', 'standard', 'veteran'])
  for (const encounterSet of ['patrol', 'crossing', 'mixed'])
    for (const variant of ['time-attack', 'marathon'])
      results.push(
        trial({
          seed: 42,
          difficulty,
          encounterSet,
          variant,
          build: 'pursuer',
        }),
      );
writeFileSync(
  new URL('./raid-results.json.gz', import.meta.url),
  gzipSync(
    JSON.stringify(
      {
        kind: 'Scripted reachability; state-reading pilot, not human difficulty or medal calibration',
        sources,
        sourceAtFinish: hashSources(),
        results,
      },
      null,
      2,
    ) + '\n',
  ),
);
console.log(
  JSON.stringify({
    total: results.length,
    won: results.filter((r) => r.outcome === 'won').length,
    failures: results
      .filter((r) => r.outcome !== 'won')
      .map(
        ({ seed, difficulty, encounterSet, route, build, variant, outcome, time, exception }) => ({
          seed,
          difficulty,
          encounterSet,
          route,
          build,
          variant,
          outcome,
          time,
          exception,
        }),
      ),
  }),
);
