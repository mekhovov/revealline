import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { AIRCRAFT_FREQUENCY } from '../optional-practice/civilian-fpv/advanced-aircraft-runtime.mjs';
import { runSustainedQualification } from '../game/test/helpers/fpv-aircraft-sustained-qualification.mjs';

const args = process.argv.slice(2);
if (args.some((value) => value !== '--smoke'))
  throw new Error('Usage: node scripts/qualify-fpv-aircraft-sustained.mjs [--smoke]');
const smoke = args.includes('--smoke');
const root = new URL('../', import.meta.url);
const paths = [
  'game/test/helpers/fpv-aircraft-sustained-qualification.mjs',
  'game/test/helpers/fpv-regional-real-geometry.mjs',
  'scripts/qualify-fpv-aircraft-sustained.mjs',
  'optional-practice/civilian-fpv/advanced-simulation.mjs',
  'optional-practice/civilian-fpv/advanced-aircraft-runtime.mjs',
  'optional-practice/civilian-fpv/advanced-regional.mjs',
  'optional-practice/civilian-fpv/aircraft-course-session.mjs',
  'optional-practice/civilian-fpv/aircraft-physics.mjs',
  'optional-practice/civilian-fpv/aircraft-presets.mjs',
  'optional-practice/civilian-fpv/aircraft-recording.mjs',
  'optional-practice/civilian-fpv/aircraft-response.mjs',
  'optional-practice/civilian-fpv/rates.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
  'optional-practice/civilian-fpv/model.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
];
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(new URL(path, root)))
          .digest('hex'),
      ]),
    ),
  );
const sources = await sourceHashes();
const started = performance.now();
const qualification = await runSustainedQualification({
  smoke,
  onResult(row) {
    console.log(
      `${row.passed ? 'PASS' : 'FAIL'} ${row.aircraft} ${row.mode} ${row.host}: ${row.passed ? `${row.airborneSeconds} s airborne; recovery exact` : row.error}`,
    );
  },
});
const sourcesAfter = await sourceHashes();
const sourcesStable = JSON.stringify(sources) === JSON.stringify(sourcesAfter);
const receipt = {
  format: 'FpvSustainedFlightQualification.v1',
  measuredAt: new Date().toISOString(),
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  sourceBinding:
    'sourceRevision is the base checkout commit; sources are named working-tree file hashes sampled before/after execution and may include candidate edits. This is not a complete transitive import-tree fingerprint.',
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    processor: cpus()[0]?.model,
  },
  sources,
  missionHz: 50,
  physicsHz: AIRCRAFT_FREQUENCY,
  input:
    'Synthetic position/altitude feedback through ordinary roll/pitch/throttle sticks at the authored spawn, yaw pulses, controlled descent until support, and second takeoff; no body-state injection.',
  pilotVersion: 'bounded-position-feedback.v2',
  ...qualification,
  sourcesStable,
  ...(!sourcesStable ? { sourcesAfter } : {}),
  passed: qualification.passed && sourcesStable,
  harnessDevelopment: [
    {
      pilot: 'altitude-only.v1',
      status: 'diagnostic attempt stopped; not qualification',
      observations: [
        'Meteor75 hard throttle cut from1.4m caused an impact tumble; replaced by controlled descent.',
        '24 of26 course cases passed; SMART35 Acro reached upright0.9533 and X650 Acro reached upright-0.0095 after contact without any roll/pitch correction.',
        'SMART35 and X650 Acro passed unchanged physics with ordinary-stick position/attitude feedback in v2; minimum upright0.9983 and0.9998 respectively in targeted rechecks.',
        'Regional v1 incorrectly assumed a ground start and used an airborne landing height; Meteor75 Acro drifted into terrain admission pause and self-level never reached support during the intended landing phase.',
      ],
      correction:
        'Handle authored air starts, descend to observed support, and actively correct attitude/position through pilot inputs. No runtime constants, body state or configured assists changed.',
    },
  ],
  elapsedSeconds: (performance.now() - started) / 1000,
  limitations: [
    'In-process production mission/physics/terrain code; excludes browser rendering, worker transport, physical input devices and IndexedDB.',
    'Bounded spawn-area maneuvers do not establish complete authored route completion or full-region streaming.',
    'Course host is rotated across catalog aircraft; this is not a full aircraft by host matrix.',
    'Estimated aircraft coefficients remain unchanged; numerical controllability is not measured real-aircraft fidelity.',
    'Single-machine observations do not qualify other devices or architectures.',
    'Only retained segment count is asserted bounded; retained bytes are reported, and total process-memory bounds are not measured.',
    'Elapsed time includes checkpoint validation and replay; accepted-step performance is not isolated and no realtime-capacity gate is claimed.',
  ],
};
if (!smoke)
  await writeFile(
    new URL('../docs/fpv-sustained-flight-qualification.json', import.meta.url),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
console.log(
  JSON.stringify({
    passed: receipt.passed,
    runs: receipt.results.length,
    elapsedSeconds: receipt.elapsedSeconds,
  }),
);
if (!receipt.passed) process.exitCode = 1;
