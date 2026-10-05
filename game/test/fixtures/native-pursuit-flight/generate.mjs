// Software route search only. Regression tests replay the fixed CSVs; they never
// run this adaptive controller or change actor/physics/objective state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { canonicalJSON, dataIdentity } from '../../../data-json.mjs';
import {
  NATIVE_PURSUIT_CATALOGUE,
  NATIVE_PURSUIT_V2_CATALOGUE,
  NATIVE_PURSUIT_PLAYLIST,
} from '../../../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../../../../optional-practice/civilian-fpv/world-model.mjs';
import { responseCurve } from '../../../../optional-practice/civilian-fpv/radio-profile.mjs';

const write = process.argv[2] === '--write';
assert.ok(write || process.argv[2] === '--check', 'Use --write or --check explicitly.');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const controls = ['roll', 'pitch', 'yaw', 'throttle', 'actions'];
function inverse(value) {
  let low = -1000,
    high = 1000;
  const target = clamp(Math.round(value * 1000), -1000, 1000);
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (responseCurve(mid, 30) < target) low = mid + 1;
    else high = mid;
  }
  return low / 1000;
}
function approach(state, target, mode, altitudeOverride) {
  const distance = Math.hypot(target.x - state.position.x, target.z - state.position.z);
  const altitude = altitudeOverride ?? (distance > 4000 ? 2800 : 900);
  const ax = clamp((target.x - state.position.x) * 0.65 - state.velocity.x * 1.4, -1800, 1800);
  const az = clamp((target.z - state.position.z) * 0.65 - state.velocity.z * 1.4, -1800, 1800);
  const ay = clamp((altitude - state.position.y) * 3 - state.velocity.y * 2, -4000, 4000);
  const roll = (Math.atan2(ax, 9810 + ay) * 18000) / Math.PI;
  const pitch = (-Math.atan2(az, 9810 + ay) * 18000) / Math.PI;
  return {
    roll: inverse(mode === 'acro' ? ((roll - state.attitude.roll) * 4) / 24000 : roll / 3000),
    pitch: inverse(mode === 'acro' ? ((pitch - state.attitude.pitch) * 4) / 24000 : pitch / 3000),
    yaw: inverse((-state.attitude.yaw * 4) / 24000),
    throttle: clamp((9810 + ay) / (19620 * Math.max(0.6, state.attitude.up.y / 1000000)), 0, 1),
    actions: 0,
  };
}
function csv(frames) {
  const rows = [];
  for (const command of frames) {
    const previous = rows.at(-1);
    if (previous && previous.slice(1).every((value, index) => value === command[index]))
      previous[0]++;
    else rows.push([1, ...command]);
  }
  return `${['repeat', ...controls].join(',')}\n${rows.map((row) => row.join(',')).join('\n')}\n`;
}
async function publish(name, value) {
  const location = new URL(name, import.meta.url);
  if (write) await writeFile(location, value);
  else {
    const current = await readFile(location, 'utf8');
    if (name.endsWith('.json')) assert.deepEqual(JSON.parse(current), JSON.parse(value));
    else assert.equal(current, value, `Route fixture changed: ${name}`);
  }
}

await initWorldRuntime();
const manifest = {
  format: 'generated-native-pursuit-flight-routes.v1',
  provenance:
    'Software-generated legal native controls. Exact completion existence only; human play, device accessibility, artwork approval and public release remain unqualified.',
  generatorSha256: sha256(await readFile(new URL('generate.mjs', import.meta.url))),
  playlist: structuredClone(NATIVE_PURSUIT_PLAYLIST),
  columns: ['repeat', ...controls],
  courses: [],
};
for (const selected of NATIVE_PURSUIT_PLAYLIST.entries) {
  const entry = [...NATIVE_PURSUIT_V2_CATALOGUE, ...NATIVE_PURSUIT_CATALOGUE].find(
    (row) => row.id === selected.levelId && row.packIdentity === selected.packIdentity,
  );
  const course = entry.course;
  const specimen = {
    id: course.id,
    revision: course.revision,
    seed: course.rules.seed,
    packIdentity: entry.packIdentity,
    recipeIdentity: dataIdentity(course),
    recipeSha256: sha256(canonicalJSON(course)),
    routes: [],
  };
  for (const mode of ['self-level', 'acro']) {
    const required = course.steps[mode][0].targets;
    const flight = createWorldFlight({ course, mode });
    const recorder = createWorldRecorder(flight);
    const positions = new Map();
    let targetId;
    flight.arm();
    try {
      for (let tick = 0; tick < 6000 && flight.snapshot().status === 'active'; tick++) {
        const state = flight.snapshot();
        let target = state.actors.find(
          (actor) => actor.id === targetId && actor.status === 'active',
        );
        if (!target) {
          target = state.actors
            .filter((actor) => actor.status === 'active' && required.includes(actor.id))
            .sort(
              (a, b) =>
                Math.hypot(a.position.x - state.position.x, a.position.z - state.position.z) -
                Math.hypot(b.position.x - state.position.x, b.position.z - state.position.z),
            )[0];
          assert.ok(target, 'An active objective must retain a required target.');
          targetId = target.id;
        }
        const prior = positions.get(target.id) ?? target.position;
        const aim = {
          x: target.position.x + (target.position.x - prior.x) * 100,
          z: target.position.z + (target.position.z - prior.z) * 100,
        };
        for (const actor of state.actors) positions.set(actor.id, { ...actor.position });
        let altitude = course.id.endsWith('runner-court') ? 900 : undefined;
        if (course.id.endsWith('armor-windows')) {
          const policy = target.pursuit;
          if (policy.family === 'brace-trooper' && ['warning', 'burst'].includes(policy.phase)) {
            aim.x = target.position.x + 1200;
            aim.z = target.position.z;
            altitude = 900;
          } else if (policy.family === 'shield-bearer') {
            const heading = policy.heading;
            const front =
              (state.position.x - target.position.x) * heading.x +
              (state.position.z - target.position.z) * heading.z;
            if (front > 0) {
              altitude = 2800;
              const side =
                (state.position.x - target.position.x) * heading.z -
                (state.position.z - target.position.z) * heading.x;
              const ahead =
                Math.abs(side) < 1200 * 1000000 ? Math.max(1600, front / 1000000) : -1600;
              aim.x =
                target.position.x + (heading.x / 1000000) * ahead + (heading.z / 1000000) * 2400;
              aim.z =
                target.position.z + (heading.z / 1000000) * ahead - (heading.x / 1000000) * 2400;
            }
          }
        }
        flight.step(approach(state, aim, mode, altitude));
        recorder.record();
      }
      const state = flight.snapshot();
      assert.equal(state.status, 'complete', `${course.id}/${mode} did not complete.`);
      assert.equal(state.health, 100);
      assert.equal(state.contacts, 0);
      assert.equal(state.shots, 0);
      const proof = recorder.export();
      const replay = await replayWorldFlight(course, proof);
      assert.equal(worldStateIdentity(replay.state), proof.finalStateIdentity);
      const { frames, ...metadata } = proof;
      const file = `${course.id}-${mode}.csv`;
      const bytes = csv(frames);
      await publish(file, bytes);
      specimen.routes.push({
        mode,
        file,
        bytes: Buffer.byteLength(bytes),
        sha256: sha256(bytes),
        inputIdentity: dataIdentity(frames),
        ticks: state.ticks,
        caught: state.hunt.caught,
        health: state.health,
        contacts: state.contacts,
        shots: state.shots,
        proof: metadata,
      });
    } finally {
      flight.dispose();
    }
  }
  manifest.courses.push(specimen);
}
await publish('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify({ courses: manifest.courses.length, routes: manifest.courses.length * 2, write }),
);
