#!/usr/bin/env node
/** Offline Garage authoring: actual normalized controls, unchanged courses/rules,
 * recorder commands consumed from the real runtime, then independent exact replay.
 * Run from the repository root; all generated files go to an explicit fresh directory.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2),
  options = {
    root: process.cwd(),
    out: null,
  };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' && args[i + 1]) options.root = resolve(args[++i]);
  else if (args[i] === '--out' && args[i + 1]) options.out = resolve(args[++i]);
  else if (args[i] === '--ids' && args[i + 1]) options.ids = args[++i].split(',');
  else
    throw new Error(
      'Usage: node generate-garage.mjs [--root REPOSITORY] --out NEW_DIRECTORY [--ids garage-01,...]',
    );
}
if (!options.out)
  throw new Error(
    'An explicit --out NEW_DIRECTORY is required; existing outputs are never overwritten.',
  );
const moduleAt = (file) => import(pathToFileURL(resolve(options.root, file)));
const digest = (data) => createHash('sha256').update(data).digest('hex');
const inputFiles = [
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-collision.mjs',
  'optional-practice/civilian-fpv/model.mjs',
  'optional-practice/civilian-fpv/math.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
  'optional-practice/civilian-fpv/flight-sectors.mjs',
  'optional-practice/civilian-fpv/world-themes.mjs',
  'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
  'scripts/qualify-fpv-adventures.mjs',
  'game/data-json.mjs',
];
const sources = Object.fromEntries(
  await Promise.all(
    inputFiles.map(async (file) => [file, digest(await readFile(resolve(options.root, file)))]),
  ),
);
const [
  { WORLD_COURSES, WORLD_CATALOGUE },
  model,
  { adventureAuthoringPilot },
  { DEFAULT_RESPONSE },
  { dataIdentity },
] = await Promise.all([
  moduleAt(inputFiles[0]),
  moduleAt(inputFiles[1]),
  moduleAt('scripts/qualify-fpv-adventures.mjs'),
  moduleAt('optional-practice/civilian-fpv/radio-profile.mjs'),
  moduleAt('game/data-json.mjs'),
]);
const {
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  validateWorldCourse,
  replayWorldFlight,
  worldStateIdentity,
} = model;
const expected = {
  'garage-01': '4ffd496ad72c79b0',
  'garage-02': '747536f144c43fbc',
  'garage-03': 'da0ccb9ce6929f92',
  'garage-04': '5d2255a5c90168e1',
  'garage-05': '40b43e3a1e06d341',
  'garage-06': '5c04355c6c1364ca',
  'garage-07': 'eab2870679a1696c',
  'garage-08': '3bd218162e169abe',
};
const ids = options.ids ?? Object.keys(expected);
if (
  !ids.length ||
  ids.length > 8 ||
  new Set(ids).size !== ids.length ||
  ids.some((id) => !expected[id])
)
  throw new Error('Expected unique authored garage-01 through garage-08');
try {
  await mkdir(options.out);
} catch (error) {
  if (error.code === 'EEXIST')
    throw new Error(
      'Output directory already exists; choose a new directory so prior work is never overwritten.',
    );
  throw error;
}
await initWorldRuntime();
const report = {
  format: 'FPVGarageRegeneration.v1',
  startedAt: new Date().toISOString(),
  sources,
  generatorSha256: digest(await readFile(new URL(import.meta.url))),
  response: DEFAULT_RESPONSE,
  method:
    'Ordinary pilot commands in the actual 50Hz runtime; unchanged normalized course identities, collision, actors, health and physics. Every proof independently replays to the exact final state. This is offline authoring evidence, not a player autopilot or unit suite.',
  limitations: [
    'No physical-device, human-playability, final visual-acceptance or public-release claim.',
    'A source change during the run invalidates this qualification receipt.',
  ],
  results: [],
};
for (const id of ids)
  for (const mode of ['self-level', 'acro']) {
    const original = WORLD_COURSES.find((c) => c.id === id),
      course = validateWorldCourse(original);
    if (dataIdentity(course) !== expected[id]) throw new Error('Authored course changed: ' + id);
    const result = {
      id,
      mode,
      sourceIdentity: expected[id],
      packIdentity: WORLD_CATALOGUE.find((e) => e.id === id).packIdentity,
      completed: false,
      replayed: false,
      milestones: [],
      contacts: [],
    };
    const flight = createWorldFlight({
        course,
        mode,
        response: DEFAULT_RESPONSE,
      }),
      recorder = createWorldRecorder(flight, { session: 'demonstration' }),
      memory = {};
    let state = flight.snapshot(),
      lastStep = -1;
    try {
      flight.arm();
      state = flight.snapshot();
      while (state.status === 'active' && state.ticks < 15000) {
        if (state.step !== lastStep) {
          lastStep = state.step;
          result.milestones.push({
            tick: state.ticks,
            step: state.step,
            position: state.position,
          });
        }
        // Face the intended noncombat leg instead of showing an unexplained long
        // sideways/backwards approach. This changes only ordinary yaw commands.
        if (['hold', 'land'].includes(state.target?.type)) {
          const x = (state.target.min.x + state.target.max.x) / 2 - state.position.x;
          const z = (state.target.min.z + state.target.max.z) / 2 - state.position.z;
          if (Math.hypot(x, z) > 1200) memory.heading = (Math.atan2(x, -z) * 18000) / Math.PI;
        }
        const previousContacts = state.contacts;
        state = flight.step(adventureAuthoringPilot(state, course, memory, mode));
        recorder.record();
        if (state.contacts > previousContacts && result.contacts.length < 64)
          result.contacts.push({
            tick: state.ticks,
            step: state.step,
            position: state.position,
            events: state.events,
          });
      }
      Object.assign(result, {
        status: state.status,
        ticks: state.ticks,
        step: state.step,
        total: state.total,
        contactCount: state.contacts,
        health: state.health,
        shots: state.shots,
        hits: state.hits,
        landingSpeed: state.landingSpeed,
        landingTilt: state.landingTilt,
      });
      if (state.status !== 'complete' || state.contacts !== 0 || state.health <= 0)
        throw new Error('Needs complete, contact-free flight with positive health');
      const proof = recorder.export();
      result.completed = true;
      const replay = await replayWorldFlight(course, proof, {
        yieldControl: async () => {},
      });
      if (
        replay.state.status !== 'complete' ||
        worldStateIdentity(replay.state) !== proof.finalStateIdentity
      )
        throw new Error('Independent replay final state differs');
      result.replayed = true;
      result.finalStateIdentity = proof.finalStateIdentity;
      result.proofSha256 = digest(JSON.stringify(proof));
      const artifact = JSON.stringify({ course: original, proof }) + '\n';
      result.file = id + '-' + mode + '.json';
      result.artifactSha256 = digest(artifact);
      result.artifactBytes = Buffer.byteLength(artifact);
      await writeFile(resolve(options.out, result.file), artifact, {
        flag: 'wx',
      });
    } catch (error) {
      result.failure = error.message;
      const s = flight.snapshot();
      Object.assign(result, {
        ticks: s.ticks,
        step: s.step,
        status: s.status,
        contactCount: s.contacts,
        health: s.health,
        final: {
          position: s.position,
          velocity: s.velocity,
          attitude: s.attitude,
          target: s.target,
          actors: s.actors,
        },
      });
    } finally {
      flight.dispose();
    }
    report.results.push(result);
    console.log(
      JSON.stringify({
        id,
        mode,
        completed: result.completed,
        replayed: result.replayed,
        ticks: result.ticks,
        contacts: result.contactCount,
        health: result.health,
        failure: result.failure,
      }),
    );
    await writeFile(resolve(options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
report.changedSources = [];
for (const [file, sha] of Object.entries(sources))
  if (digest(await readFile(resolve(options.root, file))) !== sha) report.changedSources.push(file);
report.summary = {
  recordings: report.results.length,
  completed: report.results.filter((r) => r.completed).length,
  replayed: report.results.filter((r) => r.replayed).length,
  failed: report.results.filter((r) => r.failure).length,
  totalTicks: report.results.reduce((n, r) => n + r.ticks, 0),
};
report.passed = report.summary.replayed === ids.length * 2 && report.changedSources.length === 0;
report.finishedAt = new Date().toISOString();
await writeFile(resolve(options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    passed: report.passed,
    ...report.summary,
    changedSources: report.changedSources,
  }),
);
if (!report.passed) process.exitCode = 1;
