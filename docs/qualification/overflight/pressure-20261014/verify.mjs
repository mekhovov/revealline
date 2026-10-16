/** Ordinary-input route and passive-strategy evidence, not human or GPU qualification. */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { qualifyOverflight } from '../../../../scripts/qualify-overflight.mjs';
const root = new URL('../../../../', import.meta.url);
const paths = [
  'game/overflight/core.mjs',
  'game/overflight/project.mjs',
  'game/overflight/tactics.mjs',
  'game/overflight/combat-profile.mjs',
  'game/overflight/upgrades.mjs',
  'game/overflight/review-pilot.mjs',
  'scripts/qualify-overflight.mjs',
];
const bindings = () =>
  paths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(new URL(path, root)))
      .digest('hex'),
  }));
const evidence = {
  format: 'OverflightPressureReviewV1',
  capturedAt: new Date().toISOString(),
  source: bindings(),
  scope:
    'Headless deterministic ordinary inputs; earned upgrades; all failed attempts retained. Does not establish enjoyment or GPU performance.',
  results: [],
  passive: [],
};
function save() {
  writeFileSync(
    new URL('verification.json.gz', import.meta.url),
    gzipSync(JSON.stringify(evidence, null, 2)),
  );
}
for (const difficulty of ['standard', 'veteran'])
  for (const encounterSet of ['front', 'crossing', 'mixed'])
    for (const direction of ['fan-shield', 'echo-scanner', 'systems']) {
      for (const route of ['tight', 'orbit', 'figure-eight']) {
        const result = qualifyOverflight({
          seed: 42,
          difficulty,
          encounterSet,
          direction,
          route,
          airframes: 3,
        });
        evidence.results.push({ difficulty, ...result });
        save();
        console.log(
          JSON.stringify({
            difficulty,
            encounterSet,
            direction,
            route,
            outcome: result.outcome,
            time: result.simulatedSeconds,
            peak: result.peakVisible,
          }),
        );
        if (result.outcome === 'won') break;
      }
    }
for (const difficulty of ['standard', 'veteran'])
  for (const route of [
    'park-after-pulse2',
    'tiny-circle-after-pulse2',
    'wall-after-pulse2',
    'edge-loop-after-pulse2',
  ]) {
    const result = qualifyOverflight({
      seed: 17031991,
      difficulty,
      encounterSet: 'front',
      direction: 'systems',
      route,
      airframes: 3,
    });
    evidence.passive.push({ difficulty, ...result });
    save();
    console.log(
      JSON.stringify({
        difficulty,
        route,
        outcome: result.outcome,
        time: result.simulatedSeconds,
      }),
    );
  }
evidence.sourceAtFinish = bindings();
save();
