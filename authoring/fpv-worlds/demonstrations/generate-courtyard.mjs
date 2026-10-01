/**
 * Original offline command recorder for the eight authored courtyard hold/land routes.
 * Runs the actual fixed-tick runtime; commands and verified proofs are its only output.
 * This controller is never shipped in the game and does not modify courses or physics.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WORLD_COURSES } from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  initWorldRuntime,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
const response = {
  format: 'FlightResponseProfile.v1',
  id: 'demonstration-v2',
  name: 'Demonstration response',
  maxRate: 180,
  maxTilt: 30,
  expo: 0,
  responseTicks: 4,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const radToDeg = 180 / Math.PI;
// These are authored piloting choices, not course or physics changes.
const routeStrategy = {
  // Delivery crossing's last outbound leg and return cross the moving traffic lanes.
  // Climb in the clear, cross above them, then descend into the authored hold zone.
  'courtyard-06': {
    returnCruiseY: 6200,
    beforeStep: {
      2: [
        { x: 8000, y: 6200, z: -10000 },
        { x: -10000, y: 6200, z: -22000 },
      ],
    },
  },
};
const centre = (step) =>
  Object.fromEntries(['x', 'y', 'z'].map((k) => [k, (step.min[k] + step.max[k]) / 2]));
function pilot(s, c, mode, ctx) {
  if (s.step !== ctx.step) {
    ctx.step = s.step;
    ctx.land = false;
    ctx.waypoint = 0;
  }
  const target = c.steps[mode][s.step];
  let destination,
    landing = false,
    surface = c.bounds.min.y;
  if (target.type === 'hold') destination = centre(target);
  else if (target.type === 'land') {
    destination = centre(target);
    landing = true;
    if (target.surface && target.surface !== '$floor') {
      const obstacle = c.obstacles.find((o) => o.id === target.surface);
      surface = obstacle?.max?.y ?? (target.min.y + target.max.y) / 2;
    }
    const horizontal = Math.hypot(s.position.x - destination.x, s.position.z - destination.z);
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    if (horizontal < 300 && speed < 400) ctx.land = true;
    // Stay at the authored demonstration return height until over the landing pad.
    destination.y = ctx.land
      ? surface - 100
      : Math.max(surface + 2000, routeStrategy[c.id]?.returnCruiseY ?? s.position.y);
  } else throw new Error('Courtyard recorder does not steer ' + target.type);
  const waypoints = routeStrategy[c.id]?.beforeStep?.[s.step] ?? [];
  if (ctx.waypoint < waypoints.length) {
    const waypoint = waypoints[ctx.waypoint];
    const distance = Math.hypot(...['x', 'y', 'z'].map((k) => waypoint[k] - s.position[k]));
    const speed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
    if (distance < 450 && speed < 800) ctx.waypoint += 1;
    if (ctx.waypoint < waypoints.length) destination = waypoints[ctx.waypoint];
  }
  const dx = destination.x - s.position.x,
    dz = destination.z - s.position.z;
  if (ctx.heading === undefined) ctx.heading = s.attitude.yaw / 100;
  if (Math.hypot(dx, dz) > 1200) ctx.heading = Math.atan2(dx, -dz) * radToDeg;
  const headingError = ((ctx.heading - s.attitude.yaw / 100 + 540) % 360) - 180;
  const travelAlignment = clamp((Math.cos(headingError / radToDeg) - 0.35) / 0.65, 0, 1);
  const acceleration = {};
  for (const k of ['x', 'z']) {
    const wanted = clamp((destination[k] - s.position[k]) * 0.8, -3000, 3000) * travelAlignment;
    acceleration[k] = clamp((wanted - s.velocity[k]) * 2, -4000, 4000);
  }
  const yaw = s.attitude.yaw / 100 / radToDeg;
  const right = acceleration.x * Math.cos(yaw) + acceleration.z * Math.sin(yaw);
  const forward = acceleration.x * Math.sin(yaw) - acceleration.z * Math.cos(yaw);
  const desiredRoll = Math.atan2(right, 9810) * radToDeg;
  const desiredPitch = Math.atan2(forward, 9810) * radToDeg;
  const verticalSpeed = clamp(
    (destination.y - s.position.y) * 1.2,
    landing && ctx.land ? -450 : -1500,
    2200,
  );
  const ay = clamp((verticalSpeed - s.velocity.y) * 3, -5500, 6500);
  let throttle = clamp((9810 + ay) / (19620 * Math.max(0.45, s.attitude.up.y / 1000000)), 0, 1);
  if (
    landing &&
    ctx.land &&
    s.position.y - surface < 65 &&
    Math.hypot(s.velocity.x, s.velocity.z) < 450
  )
    throttle = 0;
  const angles = { roll: s.attitude.roll / 100, pitch: s.attitude.pitch / 100 };
  return {
    roll: clamp(
      mode === 'acro'
        ? ((desiredRoll - angles.roll) * 5) / response.maxRate
        : desiredRoll / response.maxTilt,
      -1,
      1,
    ),
    pitch: clamp(
      mode === 'acro'
        ? ((desiredPitch - angles.pitch) * 5) / response.maxRate
        : desiredPitch / response.maxTilt,
      -1,
      1,
    ),
    yaw: clamp(headingError * 2, -60, 60) / response.maxRate,
    throttle,
    actions: 0,
  };
}
await initWorldRuntime();
const ids =
  process.argv[2]?.split(',') ??
  Array.from({ length: 8 }, (_, i) => `courtyard-${String(i + 1).padStart(2, '0')}`);
const output = path.resolve(process.argv[3] ?? 'fpv-courtyard-demonstrations');
await mkdir(output, { recursive: true });
for (const id of ids)
  for (const mode of ['self-level', 'acro']) {
    const course = WORLD_COURSES.find((c) => c.id === id);
    if (!course || !/^courtyard-0[1-8]$/.test(id))
      throw new Error('Expected an authored courtyard course: ' + id);
    const f = createWorldFlight({ course, mode, response });
    const recorder = createWorldRecorder(f, { session: 'demonstration' });
    f.arm();
    const ctx = { step: -1 };
    let lastStep = -1;
    const milestones = [];
    try {
      for (let tick = 0; tick < 10000; tick++) {
        const before = f.snapshot();
        if (before.status !== 'active') break;
        if (before.step !== lastStep) {
          lastStep = before.step;
          milestones.push({ tick: before.ticks, step: before.step, position: before.position });
        }
        f.step(pilot(before, course, mode, ctx));
        recorder.record();
      }
      const state = f.snapshot();
      const result = {
        course: id,
        mode,
        status: state.status,
        ticks: state.ticks,
        step: state.step,
        total: state.total,
        position: state.position,
        velocity: state.velocity,
        landingSpeed: state.landingSpeed,
        contacts: state.contacts,
        health: state.health,
        milestones,
      };
      if (state.status !== 'complete' || state.contacts !== 0 || state.health !== 100)
        throw new Error('Demonstration needs completion, full health and no contacts');
      if (state.status === 'complete') {
        const proof = recorder.export();
        const replay = await replayWorldFlight(course, proof, { sampleEvery: 50 });
        if (replay.state.status !== 'complete' || replay.state.health !== 100 || replay.state.contacts !== 0)
          throw new Error('Independent replay did not preserve completion and clean flight');
        result.replayStatus = replay.state.status;
        result.finalStateIdentity = proof.finalStateIdentity;
        result.pathPoints = replay.path.length;
        const file = path.join(output, `${id}-${mode}.json`);
        await writeFile(file, JSON.stringify({ course, proof }));
        result.file = file;
      }
      console.log(JSON.stringify(result));
    } catch (e) {
      process.exitCode = 1;
      console.log(JSON.stringify({ course: id, mode, error: e.message, state: f.snapshot() }));
    } finally {
      f.dispose();
    }
  }
