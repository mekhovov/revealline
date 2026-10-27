#!/usr/bin/env node
/** Offline legal-input authoring for every installed Hunt/pursuit flight variant.
 * Uses the same feedback controller as the native pursuit qualification fixture.
 * Never changes aircraft state, actors, objectives, clocks, courses or physics. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { simDemoInventory } from '../optional-practice/civilian-fpv/demo-inventory.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import { responseCurve } from '../optional-practice/civilian-fpv/radio-profile.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
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
function approach(state, target, mode, altitude, acceleration = 1800) {
  const ax = clamp(
    (target.x - state.position.x) * 0.65 - state.velocity.x * 1.4,
    -acceleration,
    acceleration,
  );
  const az = clamp(
    (target.z - state.position.z) * 0.65 - state.velocity.z * 1.4,
    -acceleration,
    acceleration,
  );
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
function obstructingHeight(course, from, to) {
  let height = 0;
  for (const obstacle of course.obstacles) {
    // A conservative swept path corridor. Lift over authored scenery before
    // approaching the torso; never move the aircraft through a wall.
    for (let part = 1; part <= 20; part++) {
      const ratio = part / 20,
        x = from.x + (to.x - from.x) * ratio,
        z = from.z + (to.z - from.z) * ratio;
      if (
        x > obstacle.min.x - 600 &&
        x < obstacle.max.x + 600 &&
        z > obstacle.min.z - 600 &&
        z < obstacle.max.z + 600
      )
        height = Math.max(height, obstacle.max.y + 1000);
    }
  }
  return height;
}
async function record(required, strategy) {
  const course = required.entry.course,
    mode = required.variantId;
  const criterion = course.steps[mode].find((step) => step.type === 'hunt-contact-v1');
  const flight = createWorldFlight({ course, mode });
  const recorder = createWorldRecorder(flight, { session: 'demonstration' });
  const positions = new Map(),
    checkpoints = [];
  let targetId,
    lastProgress = 0,
    catches = 0;
  flight.arm();
  try {
    while (flight.snapshot().status === 'active') {
      const state = flight.snapshot();
      if (state.ticks - lastProgress > 4000)
        throw new Error(`Pilot stalled after ${catches} catches at tick ${state.ticks}`);
      const active = state.actors.filter(
        (actor) => actor.status === 'active' && criterion.targets.includes(actor.id),
      );
      let target = active.find((actor) => actor.id === targetId);
      if (!target) {
        target = criterion.ordered
          ? active.find((actor) => actor.id === criterion.targets[state.hunt.caught.length])
          : active.sort(
              (a, b) =>
                Math.hypot(a.position.x - state.position.x, a.position.z - state.position.z) -
                Math.hypot(b.position.x - state.position.x, b.position.z - state.position.z),
            )[0];
        if (!target) throw new Error('Active Hunt has no remaining target');
        targetId = target.id;
      }
      const prior = positions.get(target.id) ?? target.position;
      const lead = strategy === 'direct' ? 50 : 100;
      const aim = {
        x: target.position.x + (target.position.x - prior.x) * lead,
        z: target.position.z + (target.position.z - prior.z) * lead,
      };
      for (const actor of state.actors) positions.set(actor.id, { ...actor.position });
      const distance = Math.hypot(
        target.position.x - state.position.x,
        target.position.z - state.position.z,
      );
      let altitude = target.position.y + (distance > 4000 ? 2800 : 900);
      if (strategy === 'overhead' && distance > 2200)
        altitude = Math.max(altitude, obstructingHeight(course, state.position, aim));
      if (course.id.endsWith('runner-court')) altitude = 900;
      if (
        target.pursuit?.family === 'brace-trooper' &&
        ['warning', 'burst'].includes(target.pursuit.phase)
      ) {
        aim.x = target.position.x + 1200;
        aim.z = target.position.z;
        altitude = 900;
      } else if (target.pursuit?.family === 'shield-bearer') {
        const heading = target.pursuit.heading;
        const front =
          (state.position.x - target.position.x) * heading.x +
          (state.position.z - target.position.z) * heading.z;
        if (front > 0) {
          altitude = 2800;
          const side =
            (state.position.x - target.position.x) * heading.z -
            (state.position.z - target.position.z) * heading.x;
          const ahead = Math.abs(side) < 1200 * 1000000 ? Math.max(1600, front / 1000000) : -1600;
          aim.x = target.position.x + (heading.x / 1000000) * ahead + (heading.z / 1000000) * 2400;
          aim.z = target.position.z + (heading.z / 1000000) * ahead - (heading.x / 1000000) * 2400;
        }
      }
      const next = flight.step(
        approach(state, aim, mode, altitude, strategy === 'direct' ? 2600 : 1800),
      );
      recorder.record();
      if (next.hunt.caught.length > catches) {
        catches = next.hunt.caught.length;
        lastProgress = next.ticks;
      }
      if (next.ticks % 250 === 0)
        checkpoints.push({ tick: next.ticks, stateIdentity: worldStateIdentity(next) });
    }
    const state = flight.snapshot();
    if (!['complete', 'failed', 'expired'].includes(state.status) || !state.hunt.caught.length)
      throw new Error(
        `No meaningful terminal performance (${state.status}, ${state.hunt.caught.length} catches)`,
      );
    const proof = recorder.export();
    const replay = await replayWorldFlight(course, proof);
    if (worldStateIdentity(replay.state) !== proof.finalStateIdentity)
      throw new Error('Native proof verification diverged');
    return {
      course,
      sourceIdentity: required.sourceIdentity,
      proof,
      checkpoints,
      authoring: {
        strategy,
        outcome: state.status,
        caught: state.hunt.caught.length,
        totalTargets: criterion.targets.length,
        ticks: state.ticks,
        contacts: state.contacts,
        health: state.health,
      },
    };
  } finally {
    flight.dispose();
  }
}

const output = new URL(
  '../authoring/fpv-worlds/demonstrations/shared-demos-generated/',
  import.meta.url,
);
const filter = process.argv.find((arg) => arg.startsWith('--level='))?.slice(8);
const inventory = simDemoInventory().filter(
  (entry) =>
    entry.entry.course.steps[entry.variantId].some((step) => step.type === 'hunt-contact-v1') &&
    (!filter || entry.id.includes(filter)),
);
await mkdir(output, { recursive: true });
await initWorldRuntime();
const missing = [],
  verified = [];
for (const [index, required] of inventory.entries()) {
  const file = new URL(
    `${required.levelId}-${required.variantId}-${required.sourceIdentity}.json`,
    output,
  );
  let result;
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    const replay = await replayWorldFlight(required.entry.course, saved.proof);
    if (
      saved.sourceIdentity === required.sourceIdentity &&
      replay.state.hunt.caught.length &&
      ['complete', 'failed', 'expired'].includes(replay.state.status)
    )
      result = saved;
  } catch {
    /* Missing or changed courses need new ordinary input. */
  }
  const errors = [];
  for (const strategy of ['overhead', 'direct']) {
    if (result) break;
    try {
      result = await record(required, strategy);
      await writeFile(file, JSON.stringify(result) + '\n');
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (result) verified.push({ id: required.id, ...result.authoring });
  else missing.push({ id: required.id, errors });
  console.log(
    JSON.stringify({
      index: index + 1,
      required: inventory.length,
      id: required.id,
      ...(result?.authoring ?? { missing: true, errors }),
    }),
  );
}
await writeFile(
  new URL('coverage.json', output),
  JSON.stringify({ required: inventory.length, verified, missing }, null, 2) + '\n',
);
console.log(JSON.stringify({ required: inventory.length, verified: verified.length, missing }));
if (missing.length) process.exitCode = 1;
