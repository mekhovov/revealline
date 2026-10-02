#!/usr/bin/env node
// Offline course authoring only: normalized commands drive the unchanged runtime.
// This is replayable functional qualification, not a player autopilot or unit suite.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataIdentity } from '../game/data-json.mjs';
import {
  BEGINNER_LESSONS,
  BEGINNER_CATALOGUE,
  PRO_LESSON_ORDER,
  MASTER_LESSON_ORDER,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
  validateWorldCourse,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  DEFAULT_RESPONSE,
  responseCurve,
} from '../optional-practice/civilian-fpv/radio-profile.mjs';
import { Q, rotate } from '../optional-practice/civilian-fpv/math.mjs';

const SKILL_SCHOOL_IDS = [...PRO_LESSON_ORDER, ...MASTER_LESSON_ORDER];
const digest = (value) => createHash('sha256').update(value).digest('hex');

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const difference = (a, b) => ((a - b + 54000) % 36000) - 18000;
// Invert the existing Gentle response curve; the runtime still quantizes inputs.
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
const neutral = (throttle = 0.5) => ({ roll: 0, pitch: 0, yaw: 0, throttle, actions: 0 });
function heightThrottle(state, y) {
  const up = state.attitude.up.y / 1e6;
  if (up < 0.2) return 0;
  return clamp(
    (9810 + clamp((y - state.position.y) * 1.7 - state.velocity.y * 2.7, -4500, 4500)) /
      (19620 * Math.max(0.3, up)),
    0,
    1,
  );
}
function positionPilot(state, position, heading = 0) {
  const yaw = (state.attitude.yaw * Math.PI) / 18000,
    ax = clamp((position.x - state.position.x) * 0.8 - state.velocity.x * 1.9, -3000, 3000),
    az = clamp((position.z - state.position.z) * 0.8 - state.velocity.z * 1.9, -3000, 3000);
  const roll = (Math.atan2(ax * Math.cos(yaw) + az * Math.sin(yaw), 9810) * 18000) / Math.PI,
    pitch = (Math.atan2(ax * Math.sin(yaw) - az * Math.cos(yaw), 9810) * 18000) / Math.PI;
  return {
    roll: rateInput((roll - state.attitude.roll) * 4.2 - state.angular.roll * 0.8),
    pitch: rateInput((pitch - state.attitude.pitch) * 4.2 - state.angular.pitch * 0.8),
    yaw: rateInput(difference(heading, state.attitude.yaw) * 2.8 - state.angular.yaw * 0.65),
    throttle: heightThrottle(state, position.y),
    actions: 0,
  };
}
function positionAndRotationPilot(state, course, memory) {
  const target = state.target;
  if (!target) return neutral(0);
  if (memory.step !== state.step) {
    memory.step = state.step;
    memory.height = state.position.y;
    memory.gateApproach = false;
  }
  if (target.type === 'rotation-v1') {
    const angle = state.skill?.index === state.step ? (state.skill.rotation?.angle ?? 0) : 0;
    const input = neutral(heightThrottle(state, memory.height));
    if (state.skill?.index === state.step && state.skill.status === 'active')
      input[target.axis] = rateInput(
        ((target.angle - angle) * 4.5 - state.angular[target.axis] * target.direction * 0.65) *
          target.direction,
      );
    return input;
  }
  if (target.type === 'attitude-v1')
    return neutral(target.up === 'inverted' ? 0 : heightThrottle(state, memory.height));
  let position;
  if (target.type === 'gate') {
    const side = (target.minSide + target.maxSide) / 2,
      axis = target.axis,
      lateral = axis === 'x' ? 'z' : 'x';
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
  } else
    position = Object.fromEntries(
      ['x', 'y', 'z'].map((k) => [k, (target.min[k] + target.max[k]) / 2]),
    );
  if (target.type === 'land') {
    const surfaceY =
      target.surface === '$floor'
        ? 0
        : course.obstacles.find((obstacle) => obstacle.id === target.surface)?.max?.y;
    if (!Number.isFinite(surfaceY))
      throw new Error(`Missing named landing surface: ${target.surface}`);
    position.y = surfaceY - 100;
  }
  const heading =
    target.heading ??
    (target.type === 'gate'
      ? target.axis === 'x'
        ? target.direction * 9000
        : target.direction < 0
          ? 0
          : 18000
      : 0);
  const input = positionPilot(state, position, heading);
  if (target.type === 'land' && state.grounded) input.throttle = 0;
  return input;
}

// Spatial paths use a moving position/velocity goal. Gravity shapes speed around
// vertical loops so the requested thrust remains within the existing drone model.
function pathPilot(state, course, memory) {
  const target = state.target;
  if (target?.type !== 'path-v1') return positionAndRotationPilot(state, course, memory);
  if (memory.step !== state.step) {
    memory.step = state.step;
    memory.phase = Math.atan2(
      state.position[target.plane[1]] - target.center[target.plane[1]],
      state.position[target.plane[0]] - target.center[target.plane[0]],
    );
    memory.origin = memory.phase;
    memory.height = state.position.y;
    memory.previousPhi = null;
    memory.axisSign =
      target.plane === 'yz'
        ? Math.sign(rotate(state.orientation, { x: Q, y: 0, z: 0 }).x) || 1
        : Math.sign(-rotate(state.orientation, { x: 0, y: 0, z: -Q }).z) || 1;
  }
  const radius = (target.radiusMin + target.radiusMax) / 2;
  if (target.plane === 'xz') {
    memory.phase += target.direction * 0.01;
    const progress = Math.abs(memory.phase - memory.origin) / ((target.sweep * Math.PI) / 18000),
      rise = ((target.axialMin + target.axialMax) / 2) * Math.min(1, progress);
    const goal = {
      x: target.center.x + Math.cos(memory.phase) * radius,
      y: memory.height + rise,
      z: target.center.z + Math.sin(memory.phase) * radius,
    };
    const heading = target.noseToward
      ? (Math.atan2(target.center.x - state.position.x, state.position.z - target.center.z) *
          18000) /
        Math.PI
      : 0;
    return positionPilot(state, goal, heading);
  }
  const R = target.radiusMin === 5000 && target.radiusMax === 11000 ? 8000 : 16000; // ordinary authoring-controller tuning, not serialized criterion.
  const gravity = 9810,
    a =
      gravity *
      (1 + 0.3 * (target.plane === 'yz' ? Math.cos(memory.phase) : Math.sin(memory.phase))),
    omega = Math.sqrt(a / R);
  memory.phase += (target.direction * omega) / 50;
  const halfDone =
    target.sweep === 18000 && Math.abs(memory.phase - memory.origin) > Math.PI + 0.12;
  if (halfDone) memory.phase = memory.origin + target.direction * (Math.PI + 0.12);
  const co = Math.cos(memory.phase),
    si = Math.sin(memory.phase),
    velocity = Math.sqrt(a * R),
    tangent = 0.15 * gravity * (target.plane === 'yz' ? -si : co);
  const goalA = target.center[target.plane[0]] + R * co,
    goalB = target.center[target.plane[1]] + R * si;
  const velA = halfDone ? 0 : -si * velocity * target.direction,
    velB = halfDone ? 0 : co * velocity * target.direction;
  let accA = halfDone ? 0 : -co * a - si * tangent,
    accB = halfDone ? 0 : -si * a + co * tangent;
  accA +=
    (goalA - state.position[target.plane[0]]) * 0.8 +
    (velA - state.velocity[target.plane[0]]) * 1.6;
  accB +=
    (goalB - state.position[target.plane[1]]) * 0.8 +
    (velB - state.velocity[target.plane[1]]) * 1.6;
  const ay = (target.plane === 'yz' ? accA : accB) + gravity,
    ax = target.plane === 'xy' ? accA : 0,
    az = target.plane === 'yz' ? accB : 0;
  const axis = target.plane === 'yz' ? 'pitch' : 'roll';
  const phi = (Math.atan2(axis === 'pitch' ? -az : ax, ay) * 18000) / Math.PI;
  const current =
    (Math.atan2(
      axis === 'pitch' ? -state.attitude.up.z : state.attitude.up.x,
      state.attitude.up.y,
    ) *
      18000) /
    Math.PI;
  const ff = memory.previousPhi === null ? 0 : difference(phi, memory.previousPhi) * 50;
  memory.previousPhi = phi;
  const input = {
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: clamp(Math.sqrt(ax * ax + ay * ay + az * az) / 19620, 0, 1),
    actions: 0,
  };
  input[axis] = rateInput((difference(phi, current) * 5 + ff) * memory.axisSign);
  return input;
}

// These three authored entry lanes prepare the momentum required by the school
// routes. They are authoring-controller choices, never runtime objective overrides.
export function skillSchoolAuthoringPilot(state, course, memory) {
  const target = state.target;
  if (target?.type === 'crossing-v1')
    return { roll: 0, pitch: 0, yaw: 0, throttle: target.direction > 0 ? 1 : 0, actions: 0 };
  if (
    target?.type === 'gate' &&
    target.at === 0 &&
    target.axis === 'z' &&
    target.direction === -1 &&
    target.minY === 15000 &&
    target.maxY === 75000
  ) {
    const az = clamp((-23000 - state.velocity.z) * 1.4, -5000, 5000),
      ay = clamp((18000 - state.velocity.y) * 1.4, -4500, 4500),
      pitch = (Math.atan2(-az, 9810 + ay) * 18000) / Math.PI;
    return {
      roll: rateInput(-state.attitude.roll * 4.2 - state.angular.roll * 0.8),
      pitch: rateInput((pitch - state.attitude.pitch) * 4.2 - state.angular.pitch * 0.8),
      yaw: rateInput(-state.attitude.yaw * 2.8 - state.angular.yaw * 0.65),
      throttle: clamp(Math.hypot(9810 + ay, az) / 19620, 0, 1),
      actions: 0,
    };
  }
  if (
    target?.type === 'gate' &&
    target.at === 0 &&
    target.axis === 'z' &&
    target.direction === -1 &&
    target.minY === 18000 &&
    target.maxY === 22000
  ) {
    const wanted = -Math.sqrt(9810 * 0.7 * 16000),
      accZ = clamp((wanted - state.velocity.z) * 1.4, -5000, 5000),
      pitch = (Math.atan2(-accZ, 9810) * 18000) / Math.PI;
    return {
      roll: rateInput(-state.attitude.roll * 4.2 - state.angular.roll * 0.8),
      pitch: rateInput((pitch - state.attitude.pitch) * 4.2 - state.angular.pitch * 0.8),
      yaw: rateInput(-state.attitude.yaw * 2.8 - state.angular.yaw * 0.65),
      throttle: heightThrottle(state, 20000),
      actions: 0,
    };
  }
  if (
    target?.type === 'gate' &&
    target.at === 0 &&
    target.axis === 'x' &&
    target.direction === 1 &&
    target.minY === 18000 &&
    target.maxY === 22000
  ) {
    const ax = clamp((10500 - state.velocity.x) * 1.4, -5000, 5000),
      az = clamp((-4000 - state.velocity.z) * 1.4, -5000, 5000),
      roll = (Math.atan2(ax, 9810) * 18000) / Math.PI,
      pitch = (Math.atan2(-az, 9810) * 18000) / Math.PI;
    return {
      roll: rateInput((roll - state.attitude.roll) * 4.2 - state.angular.roll * 0.8),
      pitch: rateInput((pitch - state.attitude.pitch) * 4.2 - state.angular.pitch * 0.8),
      yaw: rateInput(-state.attitude.yaw * 2.8 - state.angular.yaw * 0.65),
      throttle: heightThrottle(state, 20000),
      actions: 0,
    };
  }
  return pathPilot(state, course, memory);
}

/** Generate fresh recordings; never installs or edits existing demonstrations. */
export async function qualifySkillSchool({
  output,
  ids = SKILL_SCHOOL_IDS,
  diagnostic = false,
  log = console.log,
} = {}) {
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !SKILL_SCHOOL_IDS.includes(id))
  )
    throw new Error('Select distinct Pro or Master school lesson IDs.');
  await initWorldRuntime();
  const results = [],
    demonstrations = [];
  for (const id of ids) {
    const lesson = BEGINNER_LESSONS.find((value) => value.id === id);
    const entry = BEGINNER_CATALOGUE.find((value) => value.id === id);
    const sourceIdentity = dataIdentity(validateWorldCourse(lesson.course));
    const flight = createWorldFlight({
      course: lesson.course,
      mode: 'acro',
      response: DEFAULT_RESPONSE,
    });
    try {
      const recorder = createWorldRecorder(flight, { session: 'demonstration' });
      const memory = {};
      flight.arm();
      let state = flight.snapshot(),
        previousStep = -1;
      while (state.status === 'active' && state.ticks < 10000) {
        if (diagnostic && state.step !== previousStep) {
          console.error(
            JSON.stringify({
              id,
              step: state.step,
              ticks: state.ticks,
              position: state.position,
              skill: state.skill,
            }),
          );
          previousStep = state.step;
        }
        state = flight.step(skillSchoolAuthoringPilot(state, lesson.course, memory));
        recorder.record();
      }
      if (state.status !== 'complete' || state.contacts !== 0 || state.health !== state.maxHealth)
        throw new Error(
          `${id} qualification failed: ${JSON.stringify({ status: state.status, step: state.step, ticks: state.ticks, contacts: state.contacts, health: state.health, position: state.position, skill: state.skill })}`,
        );
      const proof = recorder.export();
      const replay = await replayWorldFlight(lesson.course, proof, {
        yieldControl: async () => {},
      });
      if (
        replay.state.status !== 'complete' ||
        replay.state.contacts !== 0 ||
        worldStateIdentity(replay.state) !== proof.finalStateIdentity
      )
        throw new Error(`${id} independent replay did not complete identically.`);
      // A changed pilot must not silently replace the installed demonstration
      // for the exact same course and response. New course identities can emit
      // candidates for separate review, while earlier recordings stay untouched.
      const installed = WORLD_DEMONSTRATIONS.find(
        (row) =>
          row.sourceIdentity === sourceIdentity &&
          row.proof.course === id &&
          row.proof.mode === 'acro' &&
          row.proof.responseIdentity === proof.responseIdentity,
      );
      const matchesInstalledRecording = installed
        ? JSON.stringify(installed.proof.frames) === JSON.stringify(proof.frames) &&
          installed.proof.finalStateIdentity === proof.finalStateIdentity
        : null;
      if (matchesInstalledRecording === false)
        throw new Error(
          `${id} regenerated recording differs from the installed exact-content demonstration.`,
        );
      const result = {
        id,
        status: state.status,
        ticks: state.ticks,
        contacts: state.contacts,
        independentlyReplayed: true,
        matchesInstalledRecording,
        sourceIdentity,
        finalStateIdentity: proof.finalStateIdentity,
        proofSha256: digest(JSON.stringify(proof)),
      };
      results.push(result);
      demonstrations.push({ id, packIdentity: entry.packIdentity, sourceIdentity, proof });
      log(`${id}: complete, ${state.ticks} ticks, 0 contacts, replay matched`);
    } finally {
      flight.dispose();
    }
  }
  const sources = {};
  for (const [name, path] of Object.entries({
    catalogue: '../optional-practice/civilian-fpv/world-catalogue.mjs',
    runtime: '../optional-practice/civilian-fpv/world-model.mjs',
    pilot: './qualify-fpv-skill-school.mjs',
  }))
    sources[name] = {
      path: new URL(path, import.meta.url).pathname
        .split('/')
        .slice(name === 'pilot' ? -2 : -3)
        .join('/'),
      sha256: digest(await readFile(new URL(path, import.meta.url))),
    };
  const receipt = {
    format: 'FPVSkillSchoolAuthoringEvidence.v1',
    sources,
    response: DEFAULT_RESPONSE,
    method:
      'Ordinary normalized inputs drive the unchanged fixed-step physics. Every complete recording independently replays against the exact course and response; no state or objective advancement is injected.',
    summary: {
      lessons: results.length,
      completed: results.length,
      independentlyReplayed: results.length,
      frames: results.reduce((n, value) => n + value.ticks, 0),
      matchedInstalledRecordings: results.filter((value) => value.matchesInstalledRecording).length,
    },
    limitations: [
      'Controlled-input qualification does not establish human usability, physical-controller acceptance, browser performance or public availability.',
      'New unit-test coverage remains deferred.',
    ],
    results,
  };
  if (output) {
    await mkdir(output, { recursive: true });
    // Exclusive output files preserve earlier qualification receipts/recordings.
    // Use a fresh output directory for each candidate; no install option exists.
    await writeFile(
      resolve(output, 'fpv-skill-school-demonstrations.json'),
      `${JSON.stringify({ format: 'FPVAcroDemonstrations.v1', demonstrations })}\n`,
      { flag: 'wx' },
    );
    await writeFile(
      resolve(output, 'fpv-skill-school-physics.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { flag: 'wx' },
    );
  }
  return { receipt, demonstrations };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const args = process.argv.slice(2);
  let output,
    ids,
    diagnostic = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help') {
      console.log(
        'Usage: node scripts/qualify-fpv-skill-school.mjs [--lesson beginner-43] [--out NEW_DIRECTORY] [--diagnostic]\nDefault: qualify all 16 Pro/Master lessons without writing files. Output never replaces recordings or installs runtime content.',
      );
      process.exit(0);
    } else if (arg === '--diagnostic') diagnostic = true;
    else if (arg === '--out' || arg === '--lesson') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      if (arg === '--out') output = resolve(value);
      else ids = [value];
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  const { receipt } = await qualifySkillSchool({ output, ids, diagnostic });
  console.log(JSON.stringify(receipt.summary));
}
