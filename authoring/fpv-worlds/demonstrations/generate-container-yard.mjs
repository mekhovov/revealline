/**
 * Original offline command recorder for the eight authored container-yard challenges.
 * Flies the actual fixed-tick runtime and independently replays every saved proof.
 * Aim, lead, salvo timing and evasive routes are command-only piloting choices.
 * The actual collision queries, fire cooldowns, damage and objectives decide success.
 * This authoring controller is never shipped in the player application.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { rotate, Q } from '../../../optional-practice/civilian-fpv/math.mjs';
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
// Authored piloting choices only; exact courses and collision geometry are unchanged.
// Crossing crane returns above its hazard lanes before descending over the pad.
const routeStrategy = {
  'container-yard-03': { returnCruiseY: 6200 },
  'container-yard-04': { combatAnchors: { 'target-1': { x: 0, z: -3000 } } },
  'container-yard-05': {
    combatAnchors: { 'target-1': { x: -3000, z: -1000 }, 'target-2': { x: 5000, z: -9000 } },
  },
  'container-yard-06': {
    combatAnchors: { 'target-1': { x: -3000, z: -6000 }, 'target-2': { x: 3000, z: -16000 } },
  },
  'container-yard-07': {
    combatAnchors: { 'target-1': { x: 0, z: -9000 }, 'target-2': { x: 6000, z: -2000 } },
  },
  'container-yard-08': {
    beforeStep: { 3: [{ x: -14000, y: 6000, z: -6000 }] },
    combatAnchors: {
      'extraction-patrol': { x: 0, z: -4000 },
      'extraction-drone': { x: 5000, z: -16000 },
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
    ctx.combatAnchor = { ...c.spawn };
    ctx.combatReady = false;
    ctx.turnClearance = s.position.y + 1800;
  }
  const target = c.steps[mode][s.step];
  let destination,
    landing = false,
    surface = c.bounds.min.y;
  let aim = null,
    enemy = null;
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
  } else if (target.type === 'eliminate') {
    enemy = target.targets
      .map((id) => s.actors.find((a) => a.id === id))
      .find((a) => a.status === 'active');
    if (!enemy) throw new Error('No active target while elimination remains pending');
    if (ctx.enemy !== enemy.id) {
      ctx.enemy = enemy.id;
      ctx.combatReady = false;
      ctx.combatAnchor = routeStrategy[c.id]?.combatAnchors?.[enemy.id] ?? { ...c.spawn };
    }
    const centreY =
      enemy.position.y +
      (['patrol', 'sentry'].includes(enemy.type) ? enemy.height / 2 : enemy.radius);
    const distance = Math.hypot(
      enemy.position.x - s.position.x,
      centreY - s.position.y,
      enemy.position.z - s.position.z,
    );
    // Lead from observed actor motion; turns or occlusion still require actual hits.
    const previous = ctx.actorPositions?.[enemy.id] ?? enemy.position;
    const travelSeconds = distance / 20000;
    if (
      Math.hypot(s.position.x - ctx.combatAnchor.x, s.position.z - ctx.combatAnchor.z) < 450 &&
      Math.hypot(s.velocity.x, s.velocity.z) < 800
    )
      ctx.combatReady = true;
    if (ctx.combatReady) {
      aim = Object.fromEntries(
        ['x', 'y', 'z'].map((k) => [
          k,
          enemy.position[k] + (enemy.position[k] - previous[k]) * 50 * travelSeconds,
        ]),
      );
      aim.y += centreY - enemy.position.y;
      destination = { ...ctx.combatAnchor, y: Math.max(350, centreY - 220) };
    } else destination = { ...ctx.combatAnchor, y: Math.max(2200, centreY - 220) };
  } else throw new Error('Container Yard recorder does not steer ' + target.type);
  ctx.actorPositions = Object.fromEntries(s.actors.map((a) => [a.id, { ...a.position }]));
  const waypoints = routeStrategy[c.id]?.beforeStep?.[s.step] ?? [];
  if (ctx.waypoint < waypoints.length) {
    const waypoint = waypoints[ctx.waypoint];
    if (
      Math.hypot(...['x', 'y', 'z'].map((k) => waypoint[k] - s.position[k])) < 450 &&
      Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z) < 800
    )
      ctx.waypoint++;
    if (ctx.waypoint < waypoints.length) destination = waypoints[ctx.waypoint];
  }
  const dx = destination.x - s.position.x,
    dz = destination.z - s.position.z;
  if (ctx.heading === undefined) ctx.heading = s.attitude.yaw / 100;
  if (Math.hypot(dx, dz) > 1200) ctx.heading = Math.atan2(dx, -dz) * radToDeg;
  if (aim) ctx.heading = Math.atan2(aim.x - s.position.x, -(aim.z - s.position.z)) * radToDeg;
  const headingError = ((ctx.heading - s.attitude.yaw / 100 + 540) % 360) - 180;
  // Keep moving vertically through exposed capstone turns, then descend into the marker.
  if (c.id === 'container-yard-08' && target.type === 'hold' && Math.abs(headingError) > 30)
    destination.y = Math.max(destination.y, ctx.turnClearance);
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
  let actions = 0;
  if (aim) {
    const forward = rotate(s.orientation, { x: 0, y: 0, z: -Q });
    const delta = {
      x: aim.x - s.position.x,
      y: aim.y - s.position.y - 220,
      z: aim.z - s.position.z,
    };
    const distance = Math.hypot(delta.x, delta.y, delta.z);
    const cosine =
      (forward.x * delta.x + forward.y * delta.y + forward.z * delta.z) / (Q * distance);
    const miss = distance * Math.sqrt(Math.max(0, 1 - cosine * cosine));
    // Limit each salvo to currently needed damage while prior pulses travel.
    ctx.pendingShots = (ctx.pendingShots ?? []).filter(
      (shot) =>
        shot.expires > s.ticks && s.actors.find((a) => a.id === shot.target)?.status === 'active',
    );
    const pending = ctx.pendingShots.filter((shot) => shot.target === enemy.id).length;
    if (
      cosine > 0.99 &&
      miss < Math.min(enemy.radius * 0.65, 250) &&
      pending < Math.ceil(enemy.health / 25) &&
      s.cooldown <= 1
    ) {
      actions = 1;
      ctx.pendingShots.push({
        target: enemy.id,
        expires: s.ticks + Math.ceil((distance / 20000) * 50) + 8,
      });
    }
  }
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
    yaw: clamp(headingError * (aim ? 4 : 2), -60, 60) / response.maxRate,
    throttle,
    actions,
  };
}
await initWorldRuntime();
const ids =
  process.argv[2]?.split(',') ??
  Array.from({ length: 8 }, (_, i) => `container-yard-${String(i + 1).padStart(2, '0')}`);
const output = path.resolve(process.argv[3] ?? 'fpv-container-yard-demonstrations');
await mkdir(output, { recursive: true });
for (const id of ids)
  for (const mode of ['self-level', 'acro']) {
    const course = WORLD_COURSES.find((c) => c.id === id);
    if (!course || !/^container-yard-0[1-8]$/.test(id))
      throw new Error('Expected an authored container-yard course: ' + id);
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
          milestones.push({
            tick: before.ticks,
            step: before.step,
            position: before.position,
          });
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
        shots: state.shots,
        hits: state.hits,
        actors: state.actors,
        milestones,
      };
      if (state.status !== 'complete' || state.contacts !== 0 || state.health <= 0)
        throw new Error('Demonstration needs completion, positive health and no contacts');
      if (state.status === 'complete') {
        const proof = recorder.export();
        const replay = await replayWorldFlight(course, proof, {
          sampleEvery: 50,
        });
        if (
          replay.state.status !== 'complete' ||
          replay.state.health <= 0 ||
          replay.state.contacts !== 0
        )
          throw new Error('Independent replay did not preserve completion and contact-free flight');
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
      console.log(
        JSON.stringify({
          course: id,
          mode,
          error: e.message,
          state: f.snapshot(),
        }),
      );
    } finally {
      f.dispose();
    }
  }
