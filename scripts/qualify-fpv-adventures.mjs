#!/usr/bin/env node
// Offline authoring pilot. Only ordinary controls advance the actual fixed-step runtime.
// This is functional recording/replay evidence, not a player autopilot or a unit suite.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as catalogue from '../optional-practice/civilian-fpv/world-catalogue.mjs';
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
import { dataIdentity } from '../game/data-json.mjs';
import { rotate, Q } from '../optional-practice/civilian-fpv/math.mjs';

const AXES = ['x', 'y', 'z'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const difference = (a, b) => ((a - b + 54000) % 36000) - 18000;
const length = (v) => Math.hypot(v.x, v.y, v.z);
const distance = (a, b) => Math.hypot(...AXES.map((k) => a[k] - b[k]));
const centre = (s) => Object.fromEntries(AXES.map((k) => [k, (s.min[k] + s.max[k]) / 2]));
const digest = (v) => createHash('sha256').update(v).digest('hex');
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
function rateInput(rate) {
  const shaped = clamp(rate / (DEFAULT_RESPONSE.maxRate * 100), -1, 1) * 1000;
  let lo = -1000,
    hi = 1000;
  while (lo < hi) {
    const middle = Math.floor((lo + hi) / 2);
    if (responseCurve(middle, DEFAULT_RESPONSE.expo) < shaped) lo = middle + 1;
    else hi = middle;
  }
  return lo / 1000;
}
function obstacleBounds(obstacle) {
  if (obstacle.type === 'trimesh')
    return {
      id: obstacle.id,
      ...Object.fromEntries(
        ['min', 'max'].map((which) => [
          which,
          Object.fromEntries(
            AXES.map((axis, i) => [
              axis,
              Math[which](...obstacle.vertices.filter((_, j) => j % 3 === i)),
            ]),
          ),
        ]),
      ),
    };
  if (!obstacle.rotation)
    return { id: obstacle.id, min: { ...obstacle.min }, max: { ...obstacle.max } };
  const midpoint = centre(obstacle),
    points = [];
  for (const x of [obstacle.min.x, obstacle.max.x])
    for (const y of [obstacle.min.y, obstacle.max.y])
      for (const z of [obstacle.min.z, obstacle.max.z]) {
        const v = rotate(
          obstacle.rotation.map((n) => Math.round(n * Q)),
          { x: x - midpoint.x, y: y - midpoint.y, z: z - midpoint.z },
        );
        points.push(Object.fromEntries(AXES.map((k) => [k, v[k] + midpoint[k]])));
      }
  return {
    id: obstacle.id,
    ...Object.fromEntries(
      ['min', 'max'].map((which) => [
        which,
        Object.fromEntries(AXES.map((k) => [k, Math[which](...points.map((p) => p[k]))])),
      ]),
    ),
  };
}
function segmentHits(a, b, box) {
  let low = 0,
    high = 1;
  for (const key of AXES) {
    const delta = b[key] - a[key];
    if (Math.abs(delta) < 0.0001) {
      if (a[key] <= box.min[key] || a[key] >= box.max[key]) return false;
      continue;
    }
    const ends = [(box.min[key] - a[key]) / delta, (box.max[key] - a[key]) / delta].sort(
      (x, y) => x - y,
    );
    low = Math.max(low, ends[0]);
    high = Math.min(high, ends[1]);
    if (low >= high) return false;
  }
  return high > 0.0001 && low < 0.9999;
}
function routeBetween(start, end, course, memory, ignored = null) {
  memory.boxes ??= [
    ...course.obstacles.map(obstacleBounds),
    ...course.actors
      .filter((a) => a.type === 'hazard')
      .map((a) => {
        const points = [a.position, ...a.path];
        return {
          id: a.id,
          min: Object.fromEntries(
            AXES.map((k) => [k, Math.min(...points.map((p) => p[k])) - (k === 'y' ? 0 : a.radius)]),
          ),
          max: Object.fromEntries(
            AXES.map((k) => [
              k,
              Math.max(...points.map((p) => p[k])) + (k === 'y' ? a.radius * 2 : a.radius),
            ]),
          ),
        };
      }),
  ];
  const radius = course.rules.droneRadius;
  const boxes = memory.boxes
    .filter((b) => b.id !== ignored && b.id !== memory.targetActor)
    .map((b) => ({
      id: b.id,
      min: {
        x: b.min.x - radius - 1200,
        y: b.min.y - radius * 2 - 300,
        z: b.min.z - radius - 1200,
      },
      max: { x: b.max.x + radius + 1200, y: b.max.y + 350, z: b.max.z + radius + 1200 },
    }));
  const clear = (a, b) => !boxes.some((box) => segmentHits(a, b, box));
  if (clear(start, end)) return [end];
  const nodes = [start, end];
  const useful = boxes
    .filter((b) => segmentHits(start, end, b) || distance(centre(b), start) < 50000)
    .slice(0, 40);
  for (const b of useful)
    for (const y of new Set([start.y, end.y, b.min.y - 700, b.max.y + 1200]))
      for (const x of [b.min.x - 500, b.max.x + 500])
        for (const z of [b.min.z - 500, b.max.z + 500]) {
          const p = { x, y, z };
          if (
            AXES.every(
              (k) => p[k] > course.bounds.min[k] + 500 && p[k] < course.bounds.max[k] - 500,
            ) &&
            !boxes.some((box) => AXES.every((k) => p[k] > box.min[k] && p[k] < box.max[k]))
          )
            nodes.push(p);
        }
  const costs = nodes.map(() => Infinity),
    from = nodes.map(() => -1),
    used = new Set();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let next = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!used.has(i) && (next < 0 || costs[i] < costs[next])) next = i;
    if (next < 0 || !Number.isFinite(costs[next])) break;
    if (next === 1) break;
    used.add(next);
    for (let i = 0; i < nodes.length; i++)
      if (
        !used.has(i) &&
        costs[next] + distance(nodes[next], nodes[i]) < costs[i] &&
        clear(nodes[next], nodes[i])
      ) {
        costs[i] = costs[next] + distance(nodes[next], nodes[i]);
        from[i] = next;
      }
  }
  if (!Number.isFinite(costs[1]))
    throw new Error('Pilot cannot find a clear route to ' + JSON.stringify(end));
  const route = [];
  let at = 1;
  while (at > 0) {
    route.unshift(nodes[at]);
    at = from[at];
  }
  return route;
}
function actorCentre(actor) {
  return {
    ...actor.position,
    y:
      actor.position.y +
      (['patrol', 'sentry'].includes(actor.type) ? actor.height / 2 : actor.radius),
  };
}
function actorMotion(state, memory) {
  const velocities = new Map();
  for (const actor of state.actors ?? []) {
    const previous = memory.actorPositions?.get(actor.id);
    velocities.set(
      actor.id,
      previous
        ? Object.fromEntries(AXES.map((k) => [k, (actor.position[k] - previous[k]) * 50]))
        : { x: 0, y: 0, z: 0 },
    );
  }
  memory.actorPositions = new Map((state.actors ?? []).map((a) => [a.id, { ...a.position }]));
  return velocities;
}
function destinationFor(state, course, memory) {
  const target = state.target;
  const velocities = actorMotion(state, memory);
  if (memory.step !== state.step) {
    memory.step = state.step;
    memory.started = state.ticks;
    memory.landing = false;
    memory.landingCruise = undefined;
    memory.departure =
      state.grounded && state.support?.id !== '$floor'
        ? { ...state.position, y: state.position.y + 2200 }
        : null;
    memory.route = null;
    memory.gateApproach = false;
    memory.offset = null;
    memory.targetActor = null;
    memory.rivalWait = null;
  }
  let destination,
    heading = target.heading ?? memory.heading ?? 0,
    feed = { x: 0, y: 0, z: 0 },
    aim = null,
    landing = false,
    ignored = null;
  if (target.type === 'gate') {
    const axis = target.axis,
      lateral = axis === 'x' ? 'z' : 'x',
      side = (target.minSide + target.maxSide) / 2,
      height = (target.minY + target.maxY) / 2;
    const signed = (state.position[axis] - target.at) * target.direction;
    if (
      !memory.gateApproach &&
      signed < -700 &&
      Math.abs(state.position[lateral] - side) <
        Math.min(1100, (target.maxSide - target.minSide) * 0.25) &&
      Math.abs(state.position.y - height) < Math.min(700, (target.maxY - target.minY) * 0.25)
    )
      memory.gateApproach = true;
    destination = {
      [axis]: target.at + (memory.gateApproach ? 3500 : -3000) * target.direction,
      [lateral]: side,
      y: height,
    };
    heading = axis === 'x' ? target.direction * 9000 : target.direction < 0 ? 0 : 18000;
  } else if (target.type === 'hold' || target.type === 'land') {
    destination = centre(target);
    if (target.type === 'land') {
      landing = true;
      ignored = target.surface && target.surface !== '$floor' ? target.surface : null;
      const support = ignored ? course.obstacles.find((o) => o.id === ignored) : null;
      if (ignored && (!support?.max || support.rotation?.slice(0, 3).some((n) => n !== 0)))
        throw new Error('Pilot needs axis-aligned named landing pad: ' + ignored);
      memory.surfaceY = support?.max.y ?? course.bounds.min.y;
      memory.landingCruise ??= Math.max(
        memory.surfaceY + 2200,
        state.position.y,
        memory.departure?.y ?? 0,
      );
      if (
        Math.hypot(state.position.x - destination.x, state.position.z - destination.z) < 350 &&
        Math.hypot(state.velocity.x, state.velocity.z) < 450
      )
        memory.landing = true;
      destination.y = memory.landing
        ? memory.surfaceY - 100
        : Math.max(memory.surfaceY + 2200, memory.landingCruise);
    }
  } else if (target.type === 'actor-track-v1' || target.type === 'eliminate') {
    const id =
      target.type === 'actor-track-v1'
        ? target.actorId
        : target.targets.find((id) => state.actors.find((a) => a.id === id)?.status === 'active');
    const actor = state.actors.find((a) => a.id === id);
    if (!actor) throw new Error('Missing active subject ' + id);
    const actorPoint = actorCentre(actor);
    feed = velocities.get(id);
    if (memory.targetActor !== id) {
      memory.targetActor = id;
      memory.offset = null;
      memory.route = null;
    }
    const spacing =
      target.type === 'actor-track-v1'
        ? (target.minDistance + target.maxDistance) / 2
        : Math.min(10000, course.actors.find((a) => a.id === id)?.range * 0.8 || 10000);
    if (!memory.offset) {
      const dx = state.position.x - actorPoint.x,
        dz = state.position.z - actorPoint.z,
        h = Math.hypot(dx, dz) || 1;
      memory.offset = { x: (dx / h) * spacing, z: (dz / h) * spacing };
      if (h < 500) memory.offset = { x: 0, z: spacing };
    }
    const observerY = Math.max(
      course.bounds.min.y + course.rules.droneRadius + 450,
      actorPoint.y + (target.type === 'eliminate' ? 0 : Math.min(450, spacing * 0.05)),
    );
    destination = {
      x: actorPoint.x + memory.offset.x,
      y: observerY - course.rules.droneRadius,
      z: actorPoint.z + memory.offset.z,
    };
    const leading =
      target.type === 'eliminate'
        ? distance(state.position, actorPoint) / course.rules.projectileSpeed
        : 0;
    aim = Object.fromEntries(AXES.map((k) => [k, actorPoint[k] + feed[k] * leading]));
    heading = (Math.atan2(aim.x - state.position.x, state.position.z - aim.z) * 18000) / Math.PI;
  } else if (target.type === 'survive')
    destination = {
      x: course.spawn.x,
      y: Math.min(course.bounds.max.y - 2000, course.spawn.y + 8000),
      z: course.spawn.z,
    };
  else throw new Error('Unsupported authoring objective ' + target.type);
  memory.heading = heading;
  if (memory.departure) {
    if (state.position.y < memory.departure.y - 250)
      return {
        destination: memory.departure,
        heading,
        feed: { x: 0, y: 0, z: 0 },
        aim: null,
        landing: false,
        target,
      };
    memory.departure = null;
  }
  if (!memory.landing) {
    if (
      !memory.route ||
      distance(memory.route.at(-1), destination) > 2000 ||
      state.ticks - (memory.routeTick ?? 0) > 100
    ) {
      memory.route = routeBetween(state.position, destination, course, memory, ignored);
      memory.routeTick = state.ticks;
    }
    while (
      memory.route.length > 1 &&
      distance(state.position, memory.route[0]) < 150 &&
      length(state.velocity) < 1000
    )
      memory.route.shift();
    if (memory.route.length > 1) {
      destination = memory.route[0];
      feed = { x: 0, y: 0, z: 0 };
      aim = null;
    }
  }
  // A rival is solid. Pause at a safe approach point until its ordinary
  // trajectory clears the projected crossing; the actor keeps moving normally.
  const from = memory.rivalWait ?? state.position;
  const desired = Object.fromEntries(AXES.map((k) => [k, destination[k] - from[k]]));
  const scale = 3200 / (length(desired) || 1);
  const blockedByRival = state.actors.some((actor) => {
    if (actor.role !== 'rival' || actor.id === memory.targetActor || actor.status !== 'active')
      return false;
    const point = actorCentre(actor),
      velocity = velocities.get(actor.id);
    const relative = Object.fromEntries(
      AXES.map((k) => [k, point[k] - from[k] - (k === 'y' ? course.rules.droneRadius : 0)]),
    );
    const change = Object.fromEntries(AXES.map((k) => [k, velocity[k] - desired[k] * scale]));
    const seconds = clamp(
      -AXES.reduce((sum, k) => sum + relative[k] * change[k], 0) / (length(change) ** 2 || 1),
      0,
      2.5,
    );
    const separation = Math.hypot(...AXES.map((k) => relative[k] + change[k] * seconds));
    return (
      separation < actor.radius + course.rules.droneRadius + 800 ||
      length(relative) < actor.radius + course.rules.droneRadius + 1600
    );
  });
  if (blockedByRival) {
    memory.rivalWait ??= { ...state.position };
    return {
      destination: memory.rivalWait,
      heading,
      feed: { x: 0, y: 0, z: 0 },
      aim: null,
      landing: false,
      target,
    };
  }
  memory.rivalWait = null;
  return { destination, heading, feed, aim, landing, target };
}
export function adventureAuthoringPilot(state, course, memory, mode = 'acro') {
  if (!state.target) return neutral();
  const { destination, heading, feed, aim, landing, target } = destinationFor(
    state,
    course,
    memory,
  );
  const yaw = (state.attitude.yaw * Math.PI) / 18000;
  const maxSpeed = target.type === 'actor-track-v1' ? Math.max(4000, length(feed) + 2500) : 3200;
  // Preserve the planned segment direction. Independently clipping X/Z would
  // turn a shallow clear line into a diagonal and cut through a gantry post.
  const desired = Object.fromEntries(
    AXES.map((k) => [k, (destination[k] - state.position[k]) * 0.8]),
  );
  const segmentScale = Math.min(1, maxSpeed / (length(desired) || 1));
  const ax = clamp(
    (desired.x * segmentScale + feed.x - state.velocity.x) * 2 + feed.x * 0.25,
    -4200,
    4200,
  );
  const az = clamp(
    (desired.z * segmentScale + feed.z - state.velocity.z) * 2 + feed.z * 0.25,
    -4200,
    4200,
  );
  let roll = (Math.atan2(ax * Math.cos(yaw) + az * Math.sin(yaw), 9810) * 18000) / Math.PI;
  let pitch = (Math.atan2(ax * Math.sin(yaw) - az * Math.cos(yaw), 9810) * 18000) / Math.PI;
  let actions = 0;
  if (
    aim &&
    target.type === 'eliminate' &&
    distance(state.position, destination) < 2000 &&
    Math.hypot(state.velocity.x - feed.x, state.velocity.z - feed.z) < 1600
  ) {
    const dx = aim.x - state.position.x,
      dz = aim.z - state.position.z,
      dy = aim.y - state.position.y - course.rules.droneRadius;
    pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 18000) / Math.PI;
    roll = 0;
    const forward = rotate(state.orientation, { x: 0, y: 0, z: -Q }),
      range = Math.hypot(dx, dy, dz);
    if ((forward.x * dx + forward.y * dy + forward.z * dz) / (Q * range) > 0.999) actions = 1;
  }
  const vertical = clamp(
    desired.y * segmentScale + feed.y,
    landing && memory.landing ? -450 : -1800,
    2500,
  );
  let throttle = clamp(
    (9810 + clamp((vertical - state.velocity.y) * 3 + feed.y * 0.25, -5500, 6500)) /
      (19620 * Math.max(0.3, state.attitude.up.y / Q)),
    0,
    0.95,
  );
  if (
    landing &&
    memory.landing &&
    state.position.y - memory.surfaceY < 65 &&
    Math.hypot(state.velocity.x, state.velocity.z) < 450
  )
    throttle = 0;
  const angleRate = (key, wanted) =>
    (wanted - state.attitude[key]) * 4.2 - state.angular[key] * 0.8;
  return {
    roll: rateInput(
      mode === 'self-level'
        ? (roll / DEFAULT_RESPONSE.maxTilt) * DEFAULT_RESPONSE.maxRate
        : angleRate('roll', roll),
    ),
    pitch: rateInput(
      mode === 'self-level'
        ? (pitch / DEFAULT_RESPONSE.maxTilt) * DEFAULT_RESPONSE.maxRate
        : angleRate('pitch', pitch),
    ),
    yaw: rateInput(difference(heading, state.attitude.yaw) * 2.8 - state.angular.yaw * 0.65),
    throttle,
    actions,
  };
}
export async function qualifyAdventures({
  output = '/tmp/fpv-adventures-proofs',
  ids = null,
  modes = ['self-level', 'acro'],
  maxTicks = 15000,
  diagnostic = false,
} = {}) {
  const courses = catalogue.ADVENTURE_COURSES;
  if (!Array.isArray(courses) || !courses.length)
    throw new Error('ADVENTURE_COURSES is not ready in the catalogue');
  const selected = ids
    ? ids.map((id) => {
        const c = courses.find((c) => c.id === id);
        if (!c) throw new Error('Unknown adventure ' + id);
        return c;
      })
    : courses;
  if (
    selected.length > 60 ||
    !modes.length ||
    modes.some((m) => !['self-level', 'acro'].includes(m)) ||
    !Number.isInteger(maxTicks) ||
    maxTicks < 1 ||
    maxTicks > 36000
  )
    throw new Error('Invalid bounded qualification selection');
  await initWorldRuntime();
  await mkdir(output, { recursive: true });
  const sources = {};
  for (const file of [
    'world-catalogue.mjs',
    'world-model.mjs',
    'world-collision.mjs',
    'model.mjs',
    'radio-profile.mjs',
    'math.mjs',
    'flight-sectors.mjs',
    'world-themes.mjs',
    'vendor/rapier/rapier.mjs',
  ])
    sources[file] = digest(
      await readFile(new URL('../optional-practice/civilian-fpv/' + file, import.meta.url)),
    );
  sources['qualify-fpv-adventures.mjs'] = digest(
    await readFile(new URL('./qualify-fpv-adventures.mjs', import.meta.url)),
  );
  const receipt = {
    format: 'FPVAdventuresPhysicsEvidence.v1',
    startedAt: new Date().toISOString(),
    sources,
    response: DEFAULT_RESPONSE,
    packIdentity: catalogue.ADVENTURE_IDENTITY,
    method:
      'Ordinary normalized pilot commands advance the actual 50Hz flight runtime. Recorder consumes only the exact applied command. Every completed proof is independently replayed; no state, objectives, actor positions or course rules are injected.',
    limitations: [
      'Offline reachability/replay evidence is not player usability, physical-controller acceptance or hardware qualification.',
      'Additional unit coverage is deferred; this is an offline authoring and functional qualification command.',
    ],
    results: [],
  };
  for (const original of selected)
    for (const mode of modes) {
      let flight;
      const result = { id: original.id, mode, completed: false, replayed: false, milestones: [] };
      try {
        const course = validateWorldCourse(original);
        flight = createWorldFlight({ course, mode, response: DEFAULT_RESPONSE });
        const recorder = createWorldRecorder(flight, { session: 'demonstration' }),
          memory = {};
        flight.arm();
        let state = flight.snapshot(),
          lastStep = -1,
          lastReason = null;
        while (
          state.status === 'active' &&
          state.ticks < Math.min(maxTicks, course.rules.maxTicks)
        ) {
          if (state.step !== lastStep) {
            lastStep = state.step;
            result.milestones.push({
              tick: state.ticks,
              step: state.step,
              position: state.position,
            });
            if (diagnostic)
              console.error(JSON.stringify({ id: course.id, mode, ...result.milestones.at(-1) }));
          }
          if (diagnostic && state.actorTrack?.reason !== lastReason) {
            lastReason = state.actorTrack?.reason;
            if (lastReason)
              console.error(
                JSON.stringify({
                  id: course.id,
                  mode,
                  tick: state.ticks,
                  tracking: lastReason,
                  hold: state.hold,
                }),
              );
          }
          const previousContacts = state.contacts;
          state = flight.step(adventureAuthoringPilot(state, course, memory, mode));
          recorder.record();
          if (
            state.events.some((event) => event.type === 'objective') &&
            state.actorTrack?.status === 'complete' &&
            state.actorTrack.index === lastStep
          ) {
            result.subjectCompletions ??= [];
            result.subjectCompletions.push({ tick: state.ticks, ...state.actorTrack });
          }
          if (state.contacts > previousContacts) {
            result.contactEvents ??= [];
            if (result.contactEvents.length < 64)
              result.contactEvents.push({
                tick: state.ticks,
                step: state.step,
                position: state.position,
                velocity: state.velocity,
              });
            if (diagnostic)
              console.error(
                JSON.stringify({
                  id: course.id,
                  mode,
                  contact: result.contactEvents.at(-1),
                  actors: state.actors.map((a) => ({ id: a.id, position: a.position })),
                }),
              );
          }
        }
        Object.assign(result, {
          status: state.status,
          ticks: state.ticks,
          step: state.step,
          total: state.total,
          contacts: state.contacts,
          health: state.health,
          maxHealth: state.maxHealth,
          shots: state.shots,
          hits: state.hits,
          sourceIdentity: dataIdentity(course),
        });
        if (state.status !== 'complete')
          Object.assign(result, {
            failure: 'Attempt did not complete',
            final: {
              position: state.position,
              velocity: state.velocity,
              attitude: state.attitude,
              target: state.target,
              actorTrack: state.actorTrack,
              actors: state.actors.map((a) => ({
                id: a.id,
                status: a.status,
                position: a.position,
                blocked: a.blocked,
                health: a.health,
              })),
            },
          });
        else {
          const proof = recorder.export();
          result.completed = true;
          const replay = await replayWorldFlight(course, proof, { yieldControl: async () => {} });
          if (
            replay.state.status !== 'complete' ||
            worldStateIdentity(replay.state) !== proof.finalStateIdentity
          )
            throw new Error('Independent replay final state differs');
          result.replayed = true;
          result.finalStateIdentity = proof.finalStateIdentity;
          result.proofSha256 = digest(JSON.stringify(proof));
          result.proofFile = `${course.id}-${mode}.json`;
          await writeFile(
            resolve(output, result.proofFile),
            JSON.stringify({
              id: course.id,
              mode,
              packIdentity: catalogue.ADVENTURE_IDENTITY,
              sourceIdentity: result.sourceIdentity,
              proof,
            }) + '\n',
          );
        }
      } catch (error) {
        result.failure = error.message;
        if (flight) {
          const s = flight.snapshot();
          Object.assign(result, {
            ticks: s.ticks,
            step: s.step,
            status: s.status,
            contacts: s.contacts,
            health: s.health,
            final: {
              position: s.position,
              velocity: s.velocity,
              target: s.target,
              actorTrack: s.actorTrack,
            },
          });
        }
      } finally {
        flight?.dispose();
      }
      receipt.results.push(result);
      console.log(
        JSON.stringify({
          id: result.id,
          mode,
          completed: result.completed,
          replayed: result.replayed,
          ticks: result.ticks,
          contacts: result.contacts,
          health: result.health,
          failure: result.failure,
        }),
      );
      receipt.summary = {
        courses: selected.length,
        modePairs: receipt.results.length,
        completed: receipt.results.filter((r) => r.completed).length,
        replayed: receipt.results.filter((r) => r.replayed).length,
        failed: receipt.results.filter((r) => r.failure).length,
        clean: receipt.results.filter(
          (r) => r.completed && r.contacts === 0 && r.health === r.maxHealth,
        ).length,
        totalTicks: receipt.results.reduce((sum, r) => sum + (r.ticks ?? 0), 0),
      };
      await writeFile(
        resolve(output, 'fpv-adventures-physics.json'),
        JSON.stringify(receipt, null, 2) + '\n',
      );
    }
  receipt.finishedAt = new Date().toISOString();
  receipt.changedSources = [];
  for (const [file, expected] of Object.entries(sources)) {
    const url =
      file === 'qualify-fpv-adventures.mjs'
        ? new URL('./' + file, import.meta.url)
        : new URL('../optional-practice/civilian-fpv/' + file, import.meta.url);
    if (digest(await readFile(url)) !== expected) receipt.changedSources.push(file);
  }
  receipt.passed =
    receipt.summary.replayed === selected.length * modes.length &&
    receipt.changedSources.length === 0;
  await writeFile(
    resolve(output, 'fpv-adventures-physics.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) options.output = resolve(args[++i]);
    else if (args[i] === '--ids' && args[i + 1]) options.ids = args[++i].split(',');
    else if (args[i] === '--modes' && args[i + 1]) options.modes = args[++i].split(',');
    else if (args[i] === '--max-ticks' && args[i + 1]) options.maxTicks = Number(args[++i]);
    else if (args[i] === '--diagnostic') options.diagnostic = true;
    else
      throw new Error(
        'Usage: node scripts/qualify-fpv-adventures.mjs [--out DIR] [--ids ID,ID] [--modes self-level,acro] [--max-ticks 15000] [--diagnostic]',
      );
  }
  qualifyAdventures(options)
    .then((receipt) => {
      console.log(JSON.stringify(receipt.summary));
      if (!receipt.passed) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
