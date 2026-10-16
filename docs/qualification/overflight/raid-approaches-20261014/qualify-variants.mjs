import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { OVERFLIGHT_HUNT_MODE } from '../../../../game/overflight/raid-mode.mjs';
import { createOverflightHuntReviewPilot } from '../../../../game/overflight/raid-review-pilot.mjs';
import { createOverflightRaidVariant } from '../../../../game/overflight/raid-variants.mjs';
const sources = {};
for (const path of [
  'game/overflight/raid-core.mjs',
  'game/overflight/raid-project.mjs',
  'game/overflight/raid-variants.mjs',
  'game/overflight/raid-review-pilot.mjs',
])
  sources[path] = createHash('sha256')
    .update(readFileSync(new URL('../../../../' + path, import.meta.url)))
    .digest('hex');
const results = [];
for (const operation of ['time-attack', 'marathon'])
  for (const difficulty of ['standard', 'veteran'])
    for (const encounterSet of ['patrol', 'crossing', 'mixed'])
      for (const route of ['objectives', 'packs'])
        for (const build of ['sweeper', 'pursuer', 'breaker']) {
          const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: operation });
          const run = mode.createRun(
            mode.compileProject(mode.createProject({ seed: 42, difficulty, encounterSet })),
            { airframes: 3 },
          );
          const contracts = [];
          let exception = null;
          try {
            do {
              const pilot = createOverflightHuntReviewPilot({ route, build });
              mode.start(run);
              while (['playing', 'upgrade'].includes(run.phase) && run.time < 240) {
                if (run.phase === 'upgrade') {
                  const card = pilot.choose(run);
                  if (!card || !mode.choose(run, card.id)) throw Error('Illegal draft');
                } else mode.step(run, pilot.input(run));
              }
              contracts.push({ summary: mode.summary(run), hull: run.player.hull });
            } while (operation === 'marathon' && mode.continueContract(run));
          } catch (error) {
            exception = error.message;
            contracts.push({ summary: mode.summary(run), hull: run.player.hull });
          }
          results.push({
            operation,
            seed: 42,
            difficulty,
            encounterSet,
            route,
            build,
            contracts,
            outcome: exception ? 'exception' : run.phase,
            exception,
            variant: mode.summary(run).variant,
          });
        }
writeFileSync(
  new URL('./variants.json.gz', import.meta.url),
  gzipSync(
    JSON.stringify({
      scope: 'Ordinary-input deterministic pilot; no human pacing or hardware qualification',
      sources,
      results,
    }),
  ),
);
console.log(
  JSON.stringify({
    attempts: results.length,
    won: results.filter((r) => r.outcome === 'won').length,
    failures: results
      .filter((r) => r.outcome !== 'won')
      .map(({ contracts, ...r }) => ({ ...r, lastContract: contracts.at(-1).summary.time })),
  }),
);
