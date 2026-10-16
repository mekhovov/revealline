/** Run from any cwd. Records failures; never retries or rewrites failed results. */
import { qualifyOverflightHunt } from '../../../../scripts/qualify-overflight-raid.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const sources = {};
for (const path of [
  'game/overflight/raid-project.mjs',
  'game/overflight/raid-core.mjs',
  'game/overflight/raid-review-pilot.mjs',
  'scripts/qualify-overflight-raid.mjs',
])
  sources[path] = createHash('sha256')
    .update(readFileSync(new URL('../../../../' + path, import.meta.url)))
    .digest('hex');
const results = [];
for (const seed of [17031991, 42, 101])
  for (const difficulty of ['standard', 'veteran'])
    for (const encounterSet of ['patrol', 'crossing', 'mixed'])
      for (const route of ['objectives', 'packs'])
        for (const build of ['baseline', 'sweeper', 'pursuer', 'breaker'])
          results.push(
            qualifyOverflightHunt({
              seed,
              difficulty,
              encounterSet,
              route,
              build: build === 'baseline' ? 'pursuer' : build,
              baseline: build === 'baseline',
            }),
          );
writeFileSync(
  new URL('./after.json.gz', import.meta.url),
  gzipSync(
    JSON.stringify({
      kind: 'Scripted reachability, not human enjoyment or difficulty',
      sources,
      results,
    }),
  ),
);
console.log(
  JSON.stringify({
    total: results.length,
    won: results.filter((r) => r.summary.phase === 'won').length,
    failures: results
      .filter((r) => r.summary.phase !== 'won')
      .map((r) => ({
        seed: r.seed,
        difficulty: r.difficulty,
        encounterSet: r.encounterSet,
        route: r.route,
        build: r.baseline ? 'baseline' : r.build,
        phase: r.summary.phase,
        time: r.summary.time,
      })),
  }),
);
