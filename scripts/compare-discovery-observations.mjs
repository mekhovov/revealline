import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compareDiscoveryObservations } from '../docs/verification/discovery-comparison.mjs';

export async function compareObservationFiles(
  baselinePath,
  candidatePath,
  kind = 'baseline-current',
) {
  const results = await Promise.all(
    [baselinePath, candidatePath].map((path) => readFile(path, 'utf8')),
  );
  return compareDiscoveryObservations(...results, { kind });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [baseline, candidate, kind] = process.argv.slice(2);
  if (!baseline || !candidate)
    throw new Error(
      'Usage: node scripts/compare-discovery-observations.mjs baseline.json candidate.json [baseline-current|same-build-effects]',
    );
  const result = await compareObservationFiles(baseline, candidate, kind);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.comparable) process.exitCode = 2;
}
