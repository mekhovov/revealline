#!/usr/bin/env node
// Produces only the new private teaching oracle. Never rewrites existing route files.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FIRST_FLIGHT_LESSONS } from '../game/first-flight.mjs';
import {
  ordinarySegments,
  recoverySegments,
  alternateSegments,
  lossSegments,
  proveRoute,
} from '../game/test/first-flight-helpers.mjs';
const destination = new URL('../game/test/fixtures/first-flight-routes.json', import.meta.url);
const flags = process.argv.slice(2);
if (flags.length !== 1 || !['--write-new', '--verify'].includes(flags[0]))
  throw new Error('Use --write-new (requires absent fixture) or --verify.');
const routes = [];
for (const turnPolicy of ['immediate', 'grid-center']) {
  for (const { id: lessonId } of FIRST_FLIGHT_LESSONS)
    routes.push({
      id: `${lessonId}-${turnPolicy}`,
      lessonId,
      turnPolicy,
      segments: ordinarySegments(lessonId),
    });
  routes.push(
    {
      id: `empty-side-recovery-${turnPolicy}`,
      lessonId: 'empty-side',
      turnPolicy,
      segments: recoverySegments(),
    },
    {
      id: `empty-side-alternate-${turnPolicy}`,
      lessonId: 'empty-side',
      turnPolicy,
      segments: alternateSegments(),
    },
    {
      id: `empty-side-outside-band-${turnPolicy}`,
      lessonId: 'empty-side',
      turnPolicy,
      segments: ordinarySegments('empty-side', 25),
    },
    {
      id: `empty-side-loss-${turnPolicy}`,
      lessonId: 'empty-side',
      turnPolicy,
      segments: lossSegments(),
    },
  );
}
for (const route of routes) route.expected = proveRoute(route);
const proof = {
  format: 'first-flight-proofs.v1',
  source:
    'Finite private lessons; only createRun/stepRun/recordInput/exportReplay/verifyReplay. No course state enters the replay.',
  routes,
};
const text = `${JSON.stringify(proof, null, 2)}\n`;
if (flags[0] === '--write-new') await writeFile(destination, text, { flag: 'wx' });
else {
  const existing = JSON.parse(await readFile(destination, 'utf8'));
  if (JSON.stringify(existing) !== JSON.stringify(proof))
    throw new Error('First Flight proof differs; investigate without overwriting the oracle.');
}
console.log(
  JSON.stringify({
    valid: true,
    routes: routes.length,
    normalWins: 6,
    policies: 2,
    fixture: fileURLToPath(destination),
    mode: flags[0],
  }),
);
