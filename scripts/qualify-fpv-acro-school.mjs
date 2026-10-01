#!/usr/bin/env node
// Offline authoring pilot: only ordinary commands advance the unchanged runtime.
// This produces replayable evidence, not a player autopilot or a unit-test suite.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BEGINNER_LESSONS,
  BEGINNER_CATALOGUE,
  ACRO_LESSON_ORDER,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  DEFAULT_RESPONSE,
  responseCurve,
} from '../optional-practice/civilian-fpv/radio-profile.mjs';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const difference = (a, b) => ((a - b + 54000) % 36000) - 18000;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const centre = (target) =>
  Object.fromEntries(['x', 'y', 'z'].map((key) => [key, (target.min[key] + target.max[key]) / 2]));
function rateInput(rate) {
  const shaped = clamp(rate / (DEFAULT_RESPONSE.maxRate * 100), -1, 1) * 1000;
  let lo = -1000,
    hi = 1000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (responseCurve(mid, DEFAULT_RESPONSE.expo) < shaped) lo = mid + 1;
    else hi = mid;
  }
  return lo / 1000;
}
function pilot(state, course, memory) {
  const target = state.target;
  if (!target) return { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
  if (memory.step !== state.step) {
    memory.step = state.step;
    memory.start = state.ticks;
    memory.gateApproach = false;
  }
  let position;
  if (target.type === 'gate') {
    const side = (target.minSide + target.maxSide) / 2;
    const axis = target.axis;
    const lateral = axis === 'x' ? 'z' : 'x';
    if (
      Math.abs(state.position[lateral] - side) < 1800 &&
      Math.abs(state.position.y - (target.minY + target.maxY) / 2) < 1000
    )
      memory.gateApproach = true;
    position = {
      [axis]: target.at + (memory.gateApproach ? 3500 : -2500) * target.direction,
      [lateral]: side,
      y: (target.minY + target.maxY) / 2,
    };
  } else position = centre(target);
  if (target.type === 'land') position.y = -100;
  if (target.centred && target.max.y <= 800 && state.step === 0) position.y = 0;
  const yaw = (state.attitude.yaw * Math.PI) / 18000;
  const ax = clamp((position.x - state.position.x) * 0.8 - state.velocity.x * 1.9, -2600, 2600);
  const az = clamp((position.z - state.position.z) * 0.8 - state.velocity.z * 1.9, -2600, 2600);
  let roll = (Math.atan2(ax * Math.cos(yaw) + az * Math.sin(yaw), 9810) * 18000) / Math.PI;
  let pitch = (Math.atan2(ax * Math.sin(yaw) - az * Math.cos(yaw), 9810) * 18000) / Math.PI;
  // Deliberate short tilt phase followed by centred axes satisfies the same
  // rate/attitude objective a learner sees. No state or objective is patched.
  const tiltExercise = target.minTilt > 0;
  if (tiltExercise) {
    roll = course.id === 'beginner-25' ? (target.minTilt + target.maxTilt) / 2 : 0;
    pitch = course.id === 'beginner-25' ? 0 : (target.minTilt + target.maxTilt) / 2;
  }
  let heading = target.heading ?? memory.heading ?? 0;
  if (target.type === 'gate')
    heading = target.axis === 'x' ? target.direction * 9000 : target.direction < 0 ? 0 : 18000;
  memory.heading = heading;
  const angleRate = (key, wanted) =>
    (wanted - state.attitude[key]) * 4.2 - state.angular[key] * 0.8;
  const input = {
    roll: rateInput(angleRate('roll', roll)),
    pitch: rateInput(angleRate('pitch', pitch)),
    yaw: rateInput(difference(heading, state.attitude.yaw) * 2.8 - state.angular.yaw * 0.65),
    throttle: clamp(
      (9810 + clamp((position.y - state.position.y) * 1.7 - state.velocity.y * 2.7, -4500, 4500)) /
        (19620 * Math.max(0.3, state.attitude.up.y / 1000000)),
      0,
      0.9,
    ),
    actions: 0,
  };
  if (
    tiltExercise &&
    Math.max(Math.abs(state.attitude.roll), Math.abs(state.attitude.pitch)) >= target.minTilt + 100
  )
    input.roll = input.pitch = input.yaw = 0;
  if (
    (target.type === 'land' || (state.step === 0 && target.centred && target.max.y <= 800)) &&
    state.grounded
  )
    input.throttle = 0;
  return input;
}

export async function qualifyAcroSchool({
  output,
  ids = ACRO_LESSON_ORDER,
  diagnostic = false,
} = {}) {
  await initWorldRuntime();
  const results = [],
    demonstrations = [];
  for (const id of ids) {
    const lesson = BEGINNER_LESSONS.find((value) => value.id === id);
    if (!lesson) throw new Error(`Unknown lesson: ${id}`);
    const flight = createWorldFlight({
      course: lesson.course,
      mode: 'acro',
      response: DEFAULT_RESPONSE,
    });
    const recorder = createWorldRecorder(flight, { session: 'demonstration' });
    const memory = {};
    flight.arm();
    let state = flight.snapshot(),
      previousStep = -1;
    while (state.status === 'active' && state.ticks < 15000) {
      if (diagnostic && state.step !== previousStep) {
        console.error(
          JSON.stringify({
            id,
            step: state.step,
            tick: state.ticks,
            position: state.position,
            attitude: state.attitude,
          }),
        );
        previousStep = state.step;
      }
      const input = pilot(state, lesson.course, memory);
      state = flight.step(input);
      recorder.record();
    }
    if (state.status !== 'complete') {
      flight.dispose();
      throw new Error(
        `${id} failed: ${JSON.stringify({ status: state.status, step: state.step, position: state.position, velocity: state.velocity, attitude: state.attitude, target: state.target })}`,
      );
    }
    if (state.contacts !== 0 || state.health !== state.maxHealth) {
      flight.dispose();
      throw new Error(`${id} completed with contacts or lost health`);
    }
    const proof = recorder.export();
    const replay = await replayWorldFlight(lesson.course, proof, { yieldControl: async () => {} });
    if (
      replay.state.status !== 'complete' ||
      worldStateIdentity(replay.state) !== proof.finalStateIdentity
    )
      throw new Error(`${id} independent replay did not complete identically`);
    const entry = BEGINNER_CATALOGUE.find((value) => value.id === id);
    const result = {
      id,
      mode: 'acro',
      status: state.status,
      ticks: state.ticks,
      contacts: state.contacts,
      health: state.health,
      packIdentity: entry.packIdentity,
      finalStateIdentity: proof.finalStateIdentity,
      proofSha256: digest(JSON.stringify(proof)),
    };
    results.push(result);
    demonstrations.push({ id, packIdentity: entry.packIdentity, proof });
    console.log(JSON.stringify(result));
    flight.dispose();
  }
  const receipt = {
    format: 'FPVAcroSchoolPhysicsEvidence.v1',
    source: {
      path: 'optional-practice/civilian-fpv/world-catalogue.mjs',
      sha256: digest(
        await readFile(
          new URL('../optional-practice/civilian-fpv/world-catalogue.mjs', import.meta.url),
        ),
      ),
    },
    response: DEFAULT_RESPONSE,
    method:
      'Offline pilot supplies normalized commands to the unchanged 50 Hz runtime; each exported demonstration is independently replayed against exact course and response. No state or course advancement is injected.',
    summary: {
      lessons: results.length,
      completed: results.length,
      independentlyReplayed: results.length,
    },
    limitations: [
      'Controlled-input reachability is not novice usability or physical-radio acceptance.',
      'Unit coverage remains deferred. Public deployment and hardware performance are separate gates.',
    ],
    results,
  };
  if (output) {
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(output, 'fpv-acro-school-physics-20261001.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    await writeFile(
      resolve(output, 'fpv-acro-school-demonstrations-20261001.json'),
      `${JSON.stringify({ format: 'FPVAcroDemonstrations.v1', demonstrations })}\n`,
    );
  }
  return receipt;
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const args = process.argv.slice(2);
  const output = args.includes('--output')
    ? resolve(args[args.indexOf('--output') + 1])
    : undefined;
  const ids = args.includes('--lesson') ? [args[args.indexOf('--lesson') + 1]] : ACRO_LESSON_ORDER;
  await qualifyAcroSchool({ output, ids, diagnostic: args.includes('--diagnostic') });
}
