import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import {
  DEFAULT_RESPONSE,
  FLIGHT_CONTROLS,
  responseCurve,
  responseIdentity,
  validateFlightResponse,
} from './radio-profile.mjs';
import {
  Q,
  attitude,
  atan2,
  clamp,
  cos,
  sin,
  multiplyQuaternion,
  integrateOrientation,
  isqrt,
  mul,
  rotate,
  roundDiv,
} from './math.mjs';
import { crossesGate, quantizeFlightInput } from './model.mjs';
import { createSectorTracker } from './flight-sectors.mjs';
import { validateThemeProfile } from './world-themes.mjs';
import {
  HUNT_CONTACT_CRITERION,
  HUNT_FLIGHT_MODEL,
  HUNT_MOMENTUM_MODEL,
  HUNT_MOMENTUM_CONTACT,
  HUNT_TAIL_LIMITS,
  validateHuntContact,
  huntContact,
  createContactHuntState,
  catchHuntTarget,
  updateHuntTail,
  huntTailId,
} from './snake-hunt.mjs';
import {
  createWorldCollision,
  initWorldRuntime,
  WORLD_COLLISION_BACKEND,
} from './world-collision.mjs';
import {
  PURSUIT_COURSE,
  WORLD_VEHICLE_MODELS,
  PURSUIT_MODEL,
  PURSUIT_MODEL_V2,
  pursuitModel,
  PURSUIT_RULES,
  validateFlightPursuit,
  admitFlightPursuit,
  createPursuitActorState,
  createPursuitController,
  pursuitContactProtected,
} from './world-pursuit.mjs';

export { initWorldRuntime };
export const WORLD_FLIGHT_MODEL = 'civilian-world-fixed.v2';
export const WORLD_FLIGHT_HZ = 50;
export const WORLD_ACTION_FIRE = 1;
export const WORLD_MAX_TICKS = 36000;
export const WORLD_ACTOR_TYPES = Object.freeze(['drone', 'patrol', 'sentry', 'vehicle', 'hazard']);
export const WORLD_RULES = Object.freeze({
  seed: 1,
  maxTicks: WORLD_MAX_TICKS,
  droneRadius: 220,
  playerHealth: 100,
  collisionDamage: 0,
  playerDamage: 25,
  fireCooldown: 8,
  projectileSpeed: 20000,
  projectileTicks: 150,
});
const AXES = ['x', 'y', 'z'];
const MODES = ['self-level', 'acro'];
const SESSION = ['practice', 'demonstration', 'authoring', 'replay'];
const COMMANDS = [...FLIGHT_CONTROLS, 'actions'];
const int = (n, a, b) => Number.isSafeInteger(n) && n >= a && n <= b;
const clone = (x) => structuredClone(x);
const sorted = (items) => [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const length = (v) => isqrt(AXES.reduce((n, k) => n + v[k] * v[k], 0));
const sub = (a, b) => Object.fromEntries(AXES.map((k) => [k, a[k] - b[k]]));
const vector = (v, label = 'position') => {
  exactKeys(v, AXES, label);
  required(
    AXES.every((k) => int(v[k], -100000, 100000)),
    `${label} must use integer millimetres within ±100 m`,
  );
};
const volume = (value) => {
  vector(value.min);
  vector(value.max);
  required(
    AXES.every((k) => value.min[k] < value.max[k]),
    'Empty volume',
  );
};
const within = (p, bounds) => AXES.every((k) => p[k] >= bounds.min[k] && p[k] <= bounds.max[k]);
const actorLift = (actor) =>
  ['patrol', 'sentry'].includes(actor.type) ? actor.height / 2 : actor.radius;
const actorCentre = (actor) => ({
  ...actor.position,
  y: actor.position.y + actorLift(actor),
});

// Versioned, data-only skill criteria. These helpers never change flight physics.
const SKILL_TYPES = new Set(['rotation-v1', 'attitude-v1', 'path-v1', 'crossing-v1']);
const SKILL_AXES = ['pitch', 'yaw', 'roll'];
export function worldCourseRequiresAcro(course) {
  return MODES.some((mode) => course.steps?.[mode]?.some((step) => SKILL_TYPES.has(step.type)));
}
const skillRotationKeys = ['axis', 'direction', 'angle', 'maxReverse', 'maxOther', 'tolerance'];
function validateSkillRotation(s) {
  required(
    SKILL_AXES.includes(s.axis) && [-1, 1].includes(s.direction),
    'Invalid skill rotation axis/direction',
  );
  required(
    int(s.angle, 9000, 72000) && s.angle % 9000 === 0,
    'Skill rotation needs quarter-turn increments',
  );
  required(
    int(s.maxReverse, 0, 9000) && int(s.maxOther, 0, 72000) && int(s.tolerance, 300, 3000),
    'Invalid skill rotation tolerances',
  );
}
function validateSkillTarget(s) {
  const common = ['type', 'min', 'max', 'maxTicks'];
  volume(s);
  required(
    s.min.y >= 500 && int(s.maxTicks, 1, 5000),
    'Skill needs airborne clearance and bounded duration',
  );
  if (s.type === 'rotation-v1') {
    exactKeys(
      s,
      [...common, ...skillRotationKeys, 'entryUp', 'settleTicks', 'maxAngular'],
      'rotation-v1',
    );
    validateSkillRotation(s);
    required(
      ['upright', 'inverted', 'any'].includes(s.entryUp) &&
        int(s.settleTicks, 1, 250) &&
        s.settleTicks <= s.maxTicks &&
        int(s.maxAngular, 100, 9000),
      'Invalid rotation entry/recovery',
    );
  } else if (s.type === 'attitude-v1') {
    exactKeys(s, [...common, 'up', 'tolerance', 'ticks', 'maxAngular', 'maxSpeed'], 'attitude-v1');
    required(
      ['upright', 'inverted'].includes(s.up) &&
        int(s.tolerance, 300, 4500) &&
        int(s.ticks, 1, 250) &&
        s.ticks <= s.maxTicks &&
        int(s.maxAngular, 0, 9000) &&
        int(s.maxSpeed, 0, 60000),
      'Invalid attitude dwell',
    );
  } else if (s.type === 'path-v1') {
    exactKeys(
      s,
      [
        ...common,
        'plane',
        'center',
        'entryUp',
        'entryBearing',
        'entryTolerance',
        'maxAngular',
        'radiusMin',
        'radiusMax',
        'direction',
        'sweep',
        'maxReverse',
        'noseToward',
        'headingTolerance',
        'axialMin',
        'axialMax',
        'axialTolerance',
        'coupled',
      ],
      'path-v1',
    );
    vector(s.center, 'path center');
    required(
      ['upright', 'inverted', 'any'].includes(s.entryUp) &&
        (s.entryBearing === null || int(s.entryBearing, -18000, 18000)) &&
        int(s.entryTolerance, 300, 3000) &&
        int(s.maxAngular, 100, 9000),
      'Invalid path entry pose/bearing',
    );
    required(
      ['xy', 'xz', 'yz'].includes(s.plane) &&
        int(s.radiusMin, 1000, 50000) &&
        int(s.radiusMax, s.radiusMin + 100, 100000),
      'Invalid path plane/radius',
    );
    required(
      [-1, 1].includes(s.direction) &&
        int(s.sweep, 18000, 72000) &&
        s.sweep % 9000 === 0 &&
        int(s.maxReverse, 0, 9000),
      'Invalid path winding',
    );
    required(
      typeof s.noseToward === 'boolean' &&
        (!s.noseToward || s.plane === 'xz') &&
        int(s.headingTolerance, 0, 9000),
      'Invalid landmark heading',
    );
    required(
      int(s.axialMin, -50000, 50000) &&
        int(s.axialMax, s.axialMin, 50000) &&
        int(s.axialTolerance, 0, 10000),
      'Invalid axial path progress',
    );
    if (s.coupled !== null) {
      exactKeys(s.coupled, [...skillRotationKeys, 'phaseTolerance'], 'coupled rotation');
      validateSkillRotation(s.coupled);
      required(int(s.coupled.phaseTolerance, 1000, 9000), 'Invalid coupling phase tolerance');
    }
  } else if (s.type === 'crossing-v1') {
    exactKeys(
      s,
      [
        ...common,
        'axis',
        'at',
        'direction',
        'minA',
        'maxA',
        'minB',
        'maxB',
        'minSpeed',
        'forwardTolerance',
      ],
      'crossing-v1',
    );
    required(
      AXES.includes(s.axis) &&
        [-1, 1].includes(s.direction) &&
        ['at', 'minA', 'maxA', 'minB', 'maxB'].every((k) => int(s[k], -100000, 100000)) &&
        s.minA < s.maxA &&
        s.minB < s.maxB &&
        int(s.minSpeed, 0, 30000) &&
        int(s.forwardTolerance, 0, 9000),
      'Invalid skill crossing',
    );
  }
}
const skillAngularLow = (s, max) => SKILL_AXES.every((k) => Math.abs(s.angular[k]) <= max);
const skillUp = (q, pose, tolerance) =>
  pose === 'any' ||
  rotate(q, { x: 0, y: Q, z: 0 }).y * (pose === 'upright' ? 1 : -1) >= cos(tolerance);
function skillPose(q, entry, axis, angle, tolerance) {
  const r = [0, 0, 0, cos(-roundDiv(angle, 2))];
  r[SKILL_AXES.indexOf(axis)] = sin(-roundDiv(angle, 2));
  const expected = multiplyQuaternion(entry, r);
  return Math.abs(q.reduce((n, v, i) => n + v * expected[i], 0)) >= cos(roundDiv(tolerance, 2)) * Q;
}
function skillRotationProgress(progress, spec, state, entry) {
  const increments = Object.fromEntries(
    SKILL_AXES.map((k) => [k, 2 * roundDiv(state.angular[k], WORLD_FLIGHT_HZ * 2)]),
  );
  const signed = increments[spec.axis] * spec.direction;
  progress.angle += signed;
  progress.reverse += Math.max(0, -signed);
  progress.other += SKILL_AXES.reduce(
    (n, k) => n + (k === spec.axis ? 0 : Math.abs(increments[k])),
    0,
  );
  if (progress.reverse > spec.maxReverse || progress.other > spec.maxOther)
    return 'rotation-purity';
  const next = Math.min(spec.angle, (progress.checkpoint + 1) * 9000);
  if (progress.angle > next + spec.tolerance && progress.checkpoint < spec.angle / 9000)
    return 'missed-attitude';
  if (
    progress.checkpoint < spec.angle / 9000 &&
    progress.angle >= next - spec.tolerance &&
    skillPose(state.orientation, entry, spec.axis, next * spec.direction, spec.tolerance)
  )
    progress.checkpoint++;
  return null;
}
function skillPathSample(spec, state) {
  const axes = [...spec.plane],
    a = state.position[axes[0]] - spec.center[axes[0]],
    b = state.position[axes[1]] - spec.center[axes[1]],
    radius = isqrt(a * a + b * b);
  if (radius < spec.radiusMin || radius > spec.radiusMax) return null;
  if (spec.noseToward) {
    const forward = rotate(state.orientation, { x: 0, y: 0, z: -Q }),
      horizontal = isqrt(forward.x * forward.x + forward.z * forward.z),
      dx = spec.center.x - state.position.x,
      dz = spec.center.z - state.position.z;
    if (
      horizontal < Q / 4 ||
      forward.x * dx + forward.z * dz < mul(horizontal, cos(spec.headingTolerance)) * radius
    )
      return null;
  }
  return { a, b, bearing: atan2(b, a) };
}
function skillSweptRadius(a, b, radius) {
  const dx = b.a - a.a,
    dy = b.b - a.b,
    distance = dx * dx + dy * dy;
  const amount = distance ? clamp(roundDiv(-(a.a * dx + a.b * dy) * Q, distance), 0, Q) : 0;
  const x = a.a + mul(dx, amount),
    y = a.b + mul(dy, amount);
  return x * x + y * y >= radius * radius;
}
function skillCrossed(a, b, target) {
  if (
    (a[target.axis] - target.at) * target.direction >= 0 ||
    (b[target.axis] - target.at) * target.direction < 0
  )
    return false;
  let den = b[target.axis] - a[target.axis],
    num = target.at - a[target.axis];
  if (den < 0) {
    den = -den;
    num = -num;
  }
  return AXES.filter((k) => k !== target.axis).every((k, i) => {
    const value = a[k] * den + (b[k] - a[k]) * num;
    return value >= target[i ? 'minB' : 'minA'] * den && value <= target[i ? 'maxB' : 'maxA'] * den;
  });
}
function evaluateSkillTarget(target, state, before) {
  const empty = (reason) => ({ index: state.step, status: 'entry', reason });
  if (!state.skill || state.skill.index !== state.step) state.skill = empty('enter-zone');
  const reset = (reason) => {
    state.skill = empty(reason);
    return false;
  };
  if (state.contacts !== before.contacts || state.grounded || before.grounded)
    return reset('airborne-clearance');
  if (!within(state.position, target) || !within(before.position, target))
    return reset('outside-zone');
  if (state.skill.status === 'entry') {
    if (
      target.type === 'rotation-v1' &&
      (!skillUp(before.orientation, target.entryUp, target.tolerance) ||
        !skillAngularLow(before, target.maxAngular))
    )
      return false;
    const sample = target.type === 'path-v1' ? skillPathSample(target, before) : null;
    if (target.type === 'path-v1') {
      if (
        !sample ||
        !skillUp(before.orientation, target.entryUp, target.entryTolerance) ||
        !skillAngularLow(before, target.maxAngular)
      ) {
        state.skill.reason = 'entry-attitude';
        return false;
      }
      if (
        target.entryBearing !== null &&
        Math.abs(((sample.bearing - target.entryBearing + 54000) % 36000) - 18000) >
          target.entryTolerance
      ) {
        state.skill.reason = 'entry-bearing';
        return false;
      }
    }
    state.skill = {
      index: state.step,
      status: 'active',
      reason: null,
      ticks: 0,
      dwell: 0,
      entry: [...before.orientation],
      startAxis:
        target.type === 'path-v1'
          ? before.position[AXES.find((axis) => !target.plane.includes(axis))]
          : before.position.y,
      rotation: { angle: 0, reverse: 0, other: 0, checkpoint: 0 },
      path: { winding: 0, reverse: 0, checkpoint: 0, sample },
    };
  }
  const progress = state.skill;
  if (++progress.ticks > target.maxTicks) return reset('time-window');
  let accepted = false;
  if (target.type === 'rotation-v1') {
    const failure = skillRotationProgress(progress.rotation, target, state, progress.entry);
    if (failure) return reset(failure);
    const recovered =
      progress.rotation.checkpoint === target.angle / 9000 &&
      Math.abs(progress.rotation.angle - target.angle) <= target.tolerance &&
      skillPose(
        state.orientation,
        progress.entry,
        target.axis,
        target.angle * target.direction,
        target.tolerance,
      ) &&
      skillAngularLow(state, target.maxAngular);
    progress.dwell = recovered ? progress.dwell + 1 : 0;
    accepted = progress.dwell >= target.settleTicks;
  } else if (target.type === 'attitude-v1') {
    const valid =
      skillUp(state.orientation, target.up, target.tolerance) &&
      skillAngularLow(state, target.maxAngular) &&
      length(state.velocity) <= target.maxSpeed;
    progress.dwell = valid ? progress.dwell + 1 : 0;
    accepted = progress.dwell >= target.ticks;
  } else if (target.type === 'path-v1') {
    // The fixed integrator advances at most about 1.04 m per tick. A larger
    // discontinuity must not become winding credit or overflow swept products.
    if (length(sub(state.position, before.position)) > 2000) return reset('ambiguous-path');
    const sample = skillPathSample(target, state),
      previous = progress.path.sample;
    if (!sample || !skillSweptRadius(previous, sample, target.radiusMin))
      return reset('path-envelope');
    const delta =
      (((sample.bearing - previous.bearing + 54000) % 36000) - 18000) * target.direction;
    if (Math.abs(delta) > 9000) return reset('ambiguous-path');
    progress.path.winding += delta;
    progress.path.reverse += Math.max(0, -delta);
    progress.path.sample = sample;
    if (progress.path.reverse > target.maxReverse) return reset('path-direction');
    if (progress.path.winding >= (progress.path.checkpoint + 1) * 9000) progress.path.checkpoint++;
    const winding = clamp(progress.path.winding, 0, target.sweep),
      axial =
        state.position[AXES.find((axis) => !target.plane.includes(axis))] - progress.startAxis;
    if (target.axialMin || target.axialMax) {
      const low = roundDiv(target.axialMin * winding, target.sweep) - target.axialTolerance,
        high = roundDiv(target.axialMax * winding, target.sweep) + target.axialTolerance;
      if (axial < low || axial > high) return reset('path-axial-progress');
    }
    if (target.coupled) {
      const failure = skillRotationProgress(
        progress.rotation,
        target.coupled,
        state,
        progress.entry,
      );
      if (failure) return reset(failure);
      if (
        Math.abs(
          progress.rotation.angle * target.sweep - progress.path.winding * target.coupled.angle,
        ) >
        target.coupled.phaseTolerance * target.sweep
      )
        return reset('rotation-path-phase');
    }
    accepted =
      progress.path.winding >= target.sweep &&
      progress.path.checkpoint >= target.sweep / 9000 &&
      (!(target.axialMin || target.axialMax) ||
        (axial >= target.axialMin && axial <= target.axialMax)) &&
      (!target.coupled ||
        (progress.rotation.checkpoint === target.coupled.angle / 9000 &&
          Math.abs(progress.rotation.angle - target.coupled.angle) <= target.coupled.tolerance &&
          skillPose(
            state.orientation,
            progress.entry,
            target.coupled.axis,
            target.coupled.angle * target.coupled.direction,
            target.coupled.tolerance,
          )));
  } else {
    const forward = rotate(state.orientation, { x: 0, y: 0, z: -Q });
    accepted =
      skillCrossed(before.position, state.position, target) &&
      state.velocity[target.axis] * target.direction >= target.minSpeed &&
      forward[target.axis] * target.direction >= cos(target.forwardTolerance);
  }
  if (accepted) progress.status = 'complete';
  return accepted;
}

/** Source data is bounded, plain, script-free and normalized before identity or
 * collision creation. Visual themes/localized text do not own gameplay rules. */
export function validateWorldCourse(input) {
  const c = boundedJSON(input, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 200000,
    maxArray: 60000,
    maxDepth: 12,
  });
  exactKeys(
    c,
    [
      'format',
      'id',
      'revision',
      'environment',
      'locales',
      'spawn',
      'bounds',
      'obstacles',
      'steps',
      'world',
      'actors',
      'rules',
      'conditions',
      ...(c.format === PURSUIT_COURSE ? ['pursuit'] : []),
    ],
    'world course',
  );
  required(
    ['FlightCourse.v2', PURSUIT_COURSE].includes(c.format) &&
      stableId(c.id) &&
      stableId(c.revision) &&
      stableId(c.environment),
    'Unsupported world course',
  );
  exactKeys(c.locales, ['en', 'uk'], 'course locales');
  for (const lang of ['en', 'uk']) {
    exactKeys(c.locales[lang], ['title', 'brief', 'lesson'], 'course text');
    required(
      ['title', 'brief', 'lesson'].every(
        (k) =>
          typeof c.locales[lang][k] === 'string' &&
          c.locales[lang][k].length > 0 &&
          c.locales[lang][k].length <= 2048,
      ),
      'Bilingual course text required',
    );
  }
  exactKeys(c.world, ['id', 'theme', 'style', 'themeProfile'], 'world presentation');
  required(
    ['id', 'theme', 'style'].every((k) => stableId(c.world[k])),
    'World, theme and style IDs required',
  );
  if (c.world.themeProfile !== undefined)
    c.world.themeProfile = validateThemeProfile(c.world.themeProfile);
  vector(c.spawn, 'spawn');
  exactKeys(c.bounds, ['min', 'max'], 'bounds');
  volume(c.bounds);
  required(
    AXES.every((k) => c.bounds.max[k] - c.bounds.min[k] >= 1000) && within(c.spawn, c.bounds),
    'Invalid world bounds or spawn',
  );
  c.rules ??= {};
  exactKeys(c.rules, Object.keys(WORLD_RULES), 'world rules');
  c.rules = { ...WORLD_RULES, ...c.rules };
  const ranges = {
    seed: [1, 4294967295],
    maxTicks: [1, WORLD_MAX_TICKS],
    droneRadius: [100, 500],
    playerHealth: [1, 1000],
    collisionDamage: [0, 1000],
    playerDamage: [1, 1000],
    fireCooldown: [2, 1000],
    projectileSpeed: [1000, 60000],
    projectileTicks: [1, 1000],
  };
  for (const [key, range] of Object.entries(ranges))
    required(int(c.rules[key], ...range), `Invalid rule ${key}`);
  c.conditions ??= { profile: 'clear', revision: 'r1' };
  exactKeys(c.conditions, ['profile', 'revision'], 'visibility conditions');
  required(
    stableId(c.conditions.profile) && stableId(c.conditions.revision),
    'Versioned visibility profile required',
  );
  required(Array.isArray(c.obstacles) && c.obstacles.length <= 256, 'At most 256 static obstacles');
  const ids = new Set();
  let triangles = 0;
  for (const o of c.obstacles) {
    required(stableId(o.id) && !ids.has(o.id), 'Unique obstacle IDs required');
    ids.add(o.id);
    if (o.type === 'trimesh') {
      exactKeys(o, ['id', 'type', 'vertices', 'indices'], 'static triangle mesh');
      required(
        Array.isArray(o.vertices) &&
          o.vertices.length >= 9 &&
          o.vertices.length <= 30000 &&
          o.vertices.length % 3 === 0 &&
          o.vertices.every((n) => int(n, -100000, 100000)),
        'Invalid triangle vertices',
      );
      required(
        Array.isArray(o.indices) &&
          o.indices.length >= 3 &&
          o.indices.length % 3 === 0 &&
          o.indices.every((n) => int(n, 0, o.vertices.length / 3 - 1)),
        'Invalid triangle indices',
      );
      triangles += o.indices.length / 3;
      for (let i = 0; i < o.indices.length; i += 3) {
        const p = o.indices
          .slice(i, i + 3)
          .map((index) => o.vertices.slice(index * 3, index * 3 + 3));
        const a = p[1].map((n, k) => n - p[0][k]);
        const b = p[2].map((n, k) => n - p[0][k]);
        required(
          a[1] * b[2] !== a[2] * b[1] || a[2] * b[0] !== a[0] * b[2] || a[0] * b[1] !== a[1] * b[0],
          'Degenerate collision triangle',
        );
      }
    } else {
      exactKeys(o, ['id', 'min', 'max', 'rotation'], 'rotated box');
      volume(o);
      if (o.rotation)
        required(
          Array.isArray(o.rotation) &&
            o.rotation.length === 4 &&
            o.rotation.every((n) => Number.isFinite(n) && Math.abs(n) <= 1) &&
            Math.abs(o.rotation.reduce((n, x) => n + x * x, 0) - 1) < 0.00001,
          'Rotation must be a normalized xyzw quaternion',
        );
    }
  }
  required(triangles <= 20000, 'Collision triangle budget exceeded');
  c.actors ??= [];
  required(Array.isArray(c.actors) && c.actors.length <= 20, 'Actor budget exceeded');
  const actorIds = new Set();
  let combat = 0;
  let hazards = 0;
  c.actors = c.actors.map((value) => {
    exactKeys(
      value,
      [
        'id',
        'type',
        'role',
        'position',
        'path',
        'speed',
        'radius',
        'height',
        'health',
        'fireEveryTicks',
        'damage',
        'projectileSpeed',
        'range',
        ...(c.format === PURSUIT_COURSE ? ['vehicleModel'] : []),
        'groundMotion',
      ],
      'actor',
    );
    required(
      stableId(value.id) &&
        !actorIds.has(value.id) &&
        !ids.has(value.id) &&
        WORLD_ACTOR_TYPES.includes(value.type),
      'Unique supported actor required',
    );
    required(
      value.type === 'hazard'
        ? value.role === undefined
        : ['hostile', 'rival', 'civilian'].includes(value.role ?? 'hostile'),
      'Actors need a supported role; hazards do not use combat roles',
    );
    required(
      value.vehicleModel === undefined ||
        (value.type === 'vehicle' && WORLD_VEHICLE_MODELS.includes(value.vehicleModel)),
      'Native vehicle appearance is unsupported',
    );
    actorIds.add(value.id);
    if (value.groundMotion !== undefined) {
      required(
        ['patrol', 'sentry', 'vehicle'].includes(value.type) && stableId(value.groundMotion),
        'Invalid actor ground motion',
      );
      if (value.groundMotion !== 'support-v1')
        throw Object.assign(
          new TypeError(`Unsupported actor ground motion: ${value.groundMotion}.`),
          {
            code: 'unsupported-ground-motion',
            groundMotion: value.groundMotion,
          },
        );
    }
    vector(value.position);
    required(within(value.position, c.bounds), 'Actor spawn outside bounds');
    const radius =
      value.radius ?? (value.type === 'vehicle' ? 900 : value.type === 'hazard' ? 500 : 300);
    const a = {
      ...value,
      ...(value.type === 'hazard' ? {} : { role: value.role ?? 'hostile' }),
      path: value.path ?? [],
      speed: value.speed ?? (value.path?.length ? 1500 : 0),
      radius,
      height: value.height ?? (['patrol', 'sentry'].includes(value.type) ? 1800 : radius * 2),
      health: value.health ?? 50,
      fireEveryTicks: value.fireEveryTicks ?? (value.type === 'hazard' ? 0 : 100),
      damage: value.damage ?? 10,
      projectileSpeed: value.projectileSpeed ?? 8000,
      range: value.range ?? 20000,
    };
    required(
      int(a.radius, 100, 2000) &&
        int(a.height, ['patrol', 'sentry'].includes(a.type) ? a.radius * 2 : 100, 5000) &&
        a.height % 2 === 0 &&
        int(a.health, 1, 1000) &&
        int(a.speed, 0, 15000) &&
        int(a.fireEveryTicks, 0, 5000) &&
        (a.fireEveryTicks === 0 || a.fireEveryTicks >= 10) &&
        int(a.damage, 0, 1000) &&
        int(a.projectileSpeed, 1000, 60000) &&
        int(a.range, 100, 100000),
      'Invalid actor settings',
    );
    required(Array.isArray(a.path) && a.path.length <= 64, 'Actor path budget exceeded');
    for (const p of a.path) {
      vector(p, 'waypoint');
      required(within(p, c.bounds), 'Waypoint outside bounds');
    }
    if (['patrol', 'sentry', 'vehicle'].includes(a.type)) {
      const route = [a.position, ...a.path, ...(a.path.length > 1 ? [a.path[0]] : [])];
      for (let i = 1; i < route.length; i++) {
        const d = sub(route[i], route[i - 1]);
        required(
          Math.abs(d.y) <= Math.floor(isqrt(d.x * d.x + d.z * d.z) * 0.57735) + 200,
          'Ground path exceeds 30-degree slope or 0.2 m step',
        );
      }
    }
    if (a.type === 'hazard') hazards++;
    else combat++;
    return a;
  });
  required(combat <= 12 && hazards <= 8, 'At most twelve combat actors and eight hazards');
  exactKeys(c.steps, MODES, 'mode criteria');
  for (const mode of MODES) {
    required(
      Array.isArray(c.steps[mode]) && c.steps[mode].length >= 1 && c.steps[mode].length <= 64,
      'Ordered mission criteria required',
    );
    required(
      c.steps[mode].filter((step) => step.type === HUNT_CONTACT_CRITERION).length <= 1,
      'At most one Contact Hunt criterion per mode',
    );
    const huntTargets = new Set(huntContact(c, mode)?.targets ?? []);
    required(
      c.steps[mode].every(
        (step) =>
          !(step.type === 'eliminate' && step.targets.some((id) => huntTargets.has(id))) &&
          !(step.type === 'actor-track-v1' && huntTargets.has(step.actorId)),
      ),
      'Caught humanoids cannot also be defeat or tracking objectives',
    );
    for (const step of c.steps[mode]) {
      if (step.type === HUNT_CONTACT_CRITERION) {
        validateHuntContact(step, c);
      } else if (SKILL_TYPES.has(step.type)) {
        validateSkillTarget(step);
      } else if (step.type === 'actor-track-v1') {
        exactKeys(
          step,
          [
            'type',
            'actorId',
            'minDistance',
            'maxDistance',
            'maxRelativeSpeed',
            'maxTilt',
            'ticks',
            'viewAngle',
            'minTargetTravel',
          ],
          'actor tracking objective',
        );
        const subject = c.actors.find((actor) => actor.id === step.actorId);
        required(subject && subject.type !== 'hazard', 'Tracking needs an existing subject');
        required(
          int(step.minDistance, 100, 100000) &&
            int(step.maxDistance, step.minDistance + 100, 100000) &&
            int(step.maxRelativeSpeed, 0, 60000) &&
            int(step.maxTilt, 0, 9000) &&
            int(step.ticks, 1, Math.min(5000, c.rules.maxTicks)) &&
            int(step.viewAngle, 100, 9000) &&
            int(step.minTargetTravel, 0, 1500000),
          'Invalid actor tracking limits',
        );
        required(
          step.minTargetTravel === 0 || (subject.speed > 0 && subject.path.length > 1),
          'Following needs a moving subject route',
        );
      } else if (step.type === 'gate') {
        exactKeys(
          step,
          ['type', 'axis', 'at', 'direction', 'minSide', 'maxSide', 'minY', 'maxY'],
          'gate',
        );
        required(
          ['x', 'z'].includes(step.axis) &&
            [-1, 1].includes(step.direction) &&
            ['at', 'minSide', 'maxSide', 'minY', 'maxY'].every((k) =>
              int(step[k], -100000, 100000),
            ) &&
            step.minSide < step.maxSide &&
            step.minY < step.maxY,
          'Invalid gate',
        );
      } else if (step.type === 'eliminate') {
        exactKeys(step, ['type', 'targets'], 'combat objective');
        required(
          Array.isArray(step.targets) &&
            step.targets.length > 0 &&
            step.targets.length <= 12 &&
            new Set(step.targets).size === step.targets.length &&
            step.targets.every((id) => c.actors.some((a) => a.id === id && a.role === 'hostile')),
          'Combat objective needs existing hostile targets',
        );
      } else if (step.type === 'survive') {
        exactKeys(step, ['type', 'ticks'], 'survival objective');
        required(int(step.ticks, 1, c.rules.maxTicks), 'Invalid survival duration');
      } else {
        exactKeys(
          step,
          [
            'type',
            'min',
            'max',
            'ticks',
            'maxSpeed',
            'maxTilt',
            'minTilt',
            'centred',
            'heading',
            'surface',
          ],
          'hold objective',
        );
        required(['hold', 'land'].includes(step.type), 'Unsupported objective');
        volume(step);
        required(
          int(step.ticks, 1, 5000) &&
            int(step.maxSpeed, 0, 60000) &&
            int(step.maxTilt, 0, 18000) &&
            int(step.minTilt, 0, step.maxTilt) &&
            typeof step.centred === 'boolean' &&
            (step.heading === null || int(step.heading, -18000, 18000)),
          'Invalid hold objective',
        );
        if (step.surface !== undefined)
          required(
            step.type === 'land' && (step.surface === '$floor' || ids.has(step.surface)),
            'Landing surface does not exist',
          );
      }
    }
  }
  if (c.format === PURSUIT_COURSE) validateFlightPursuit(c.pursuit, c);
  return c;
}

export function quantizeWorldInput(input) {
  exactKeys(input, COMMANDS, 'world controls');
  const controls = Object.fromEntries(FLIGHT_CONTROLS.map((k) => [k, input[k]]));
  required(int(input.actions ?? 0, 0, WORLD_ACTION_FIRE), 'Unsupported world action bits');
  return { ...quantizeFlightInput(controls), actions: input.actions ?? 0 };
}
function validateCommand(input) {
  exactKeys(input, COMMANDS, 'recorded world controls');
  required(
    FLIGHT_CONTROLS.every((k) => int(input[k], k === 'throttle' ? 0 : -1000, 1000)) &&
      int(input.actions ?? 0, 0, WORLD_ACTION_FIRE),
    'Invalid recorded world controls',
  );
  return { ...input, actions: input.actions ?? 0 };
}
function relativeTilt(orientation, surfaceNormal) {
  const up = attitude(orientation).up;
  const dot = clamp(
    roundDiv(
      AXES.reduce((n, k) => n + up[k] * surfaceNormal[k], 0),
      Q,
    ),
    -Q,
    Q,
  );
  return Math.abs(atan2(isqrt(Math.max(0, Q * Q - dot * dot)), dot));
}

function identityForWorldCourse(source, mode, rates) {
  const contactHunt = huntContact(source, mode);
  const gameplay = { ...source };
  delete gameplay.locales;
  delete gameplay.environment;
  delete gameplay.world;
  return Object.freeze({
    model:
      source.format === PURSUIT_COURSE
        ? pursuitModel(source.pursuit)
        : contactHunt
          ? contactHunt.contactPolicy === HUNT_MOMENTUM_CONTACT
            ? HUNT_MOMENTUM_MODEL
            : HUNT_FLIGHT_MODEL
          : WORLD_FLIGHT_MODEL,
    backend: WORLD_COLLISION_BACKEND,
    course: source.id,
    courseIdentity: dataIdentity(gameplay),
    worldIdentity: dataIdentity({
      id: source.world.id,
      bounds: source.bounds,
      obstacles: source.obstacles,
    }),
    mode,
    responseIdentity: responseIdentity(rates),
    rulesIdentity: dataIdentity(source.rules),
    conditionsIdentity: dataIdentity(source.conditions),
  });
}

/** Exact portable identity without initializing physics or creating a flight. */
export function worldFlightIdentity({ course, mode = 'self-level', response = DEFAULT_RESPONSE }) {
  const source = validateWorldCourse(course),
    rates = validateFlightResponse(response);
  required(MODES.includes(mode), 'Unsupported flight mode');
  return identityForWorldCourse(source, mode, rates);
}

/** v2 keeps v1's integer force/attitude integration, replacing only collision,
 * objectives and actor rules. Legacy model.mjs and its replay format are untouched. */
// Practice is an in-memory host policy, never part of a portable scored proof.
const unscoredWorldFlights = new WeakSet();
export function createWorldFlight({
  course,
  mode = 'self-level',
  response = DEFAULT_RESPONSE,
  unscoredPractice = false,
  practiceEndStep = null,
}) {
  required(typeof unscoredPractice === 'boolean', 'Invalid world practice policy');
  const source = validateWorldCourse(course);
  const rates = validateFlightResponse(response);
  required(MODES.includes(mode), 'Unsupported flight mode');
  required(
    practiceEndStep === null ||
      (unscoredPractice && int(practiceEndStep, 1, source.steps[mode].length)),
    'A practice endpoint requires an unscored flight and a valid objective',
  );
  const hasSkills = worldCourseRequiresAcro(source);
  const hasActorTracking = MODES.some((mode) =>
    source.steps[mode].some((step) => step.type === 'actor-track-v1'),
  );
  required(
    !hasSkills || mode === 'acro' || unscoredPractice,
    'Skill courses require Acro mode for scored flight',
  );
  const rules = source.rules;
  const contactHunt = huntContact(source, mode);
  const momentumCatch = contactHunt?.contactPolicy === HUNT_MOMENTUM_CONTACT;
  const contactTargets = new Set(contactHunt?.targets ?? []);
  const pursuit =
    source.format === PURSUIT_COURSE
      ? createPursuitController(source.pursuit, source.actors)
      : null;
  const pursuitPolicies = new Map((source.pursuit?.actors ?? []).map((p) => [p.id, p]));
  const couriers = new Set(
    (source.pursuit?.actors ?? []).filter((p) => p.family === 'courier').map((p) => p.id),
  );
  const identity = identityForWorldCourse(source, mode, rates);
  let collision;
  let state;
  let disposed = false;
  const descriptors = new Map(source.actors.map((a) => [a.id, a]));
  const assertLive = () => {
    if (disposed) throw new Error('World flight has been disposed');
  };
  const snapshot = () => {
    assertLive();
    return {
      ...clone(state),
      total: source.steps[mode].length,
      target: clone(source.steps[mode][state.step] ?? null),
      attitude: attitude(state.orientation),
      maxHealth: rules.playerHealth,
    };
  };
  function random() {
    let n = state.rng;
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    state.rng = n >>> 0;
    return state.rng;
  }
  function reset() {
    assertLive();
    collision?.dispose();
    collision = createWorldCollision(source);
    try {
      required(
        collision.clearSpawn(source.spawn, rules.droneRadius),
        'Drone spawn overlaps solid geometry',
      );
      state = {
        ticks: 0,
        status: 'disarmed',
        position: { ...source.spawn },
        velocity: { x: 0, y: 0, z: 0 },
        orientation: [0, 0, 0, Q],
        angular: { roll: 0, pitch: 0, yaw: 0 },
        step: 0,
        hold: 0,
        contacts: 0,
        landingSpeed: 0,
        landingTilt: 0,
        lastInput: { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 },
        heightRange: { min: source.spawn.y, max: source.spawn.y },
        health: rules.playerHealth,
        grounded: false,
        support: null,
        cooldown: 0,
        contactCooldown: 0,
        rng: rules.seed,
        nextProjectileId: 1,
        projectiles: [],
        actors: [],
        events: [],
        shots: 0,
        hits: 0,
        ...(contactHunt ? { hunt: createContactHuntState(source.spawn, rules.droneRadius) } : {}),
        ...(pursuit ? { pursuit: { bonusCaught: [] } } : {}),
        ...(hasSkills ? { skill: { index: 0, status: 'entry', reason: 'enter-zone' } } : {}),
        ...(hasActorTracking
          ? { actorTrack: { index: 0, status: 'acquire', reason: 'acquire-subject', travel: 0 } }
          : {}),
      };
      for (const a of sorted(source.actors)) {
        const actor = {
          id: a.id,
          type: a.type,
          ...(a.role ? { role: a.role } : {}),
          position: { ...a.position },
          radius: a.radius,
          height: a.height,
          health: a.health,
          maxHealth: a.health,
          status: 'active',
          pathIndex: 0,
          cooldown:
            a.role === 'hostile' && a.fireEveryTicks ? 1 + (random() % a.fireEveryTicks) : 0,
          blocked: false,
          ...(pursuitPolicies.has(a.id)
            ? { pursuit: createPursuitActorState(pursuitPolicies.get(a.id), source.pursuit) }
            : {}),
        };
        collision.addActor(actor, a.groundMotion);
        required(
          collision.clearActorSpawn(actor),
          `Actor ${actor.id} spawn overlaps solid geometry`,
        );
        state.actors.push(actor);
      }
      if (pursuit) admitFlightPursuit(source, collision);
      if (contactHunt)
        for (let index = 0; index < HUNT_TAIL_LIMITS.links; index++)
          collision.addActor({
            id: huntTailId(index),
            type: 'hazard',
            position: source.spawn,
            radius: contactHunt.tail.radius,
          });
      const ground = collision.support(state.position, rules.droneRadius, 5);
      state.grounded = !!ground && Math.abs(ground.y - state.position.y) <= 5;
      state.support = state.grounded ? ground : null;
    } catch (error) {
      collision.dispose();
      throw error;
    }
    return snapshot();
  }
  reset();
  function moveActors() {
    const motions = [];
    for (const actor of state.actors) {
      if (actor.status !== 'active') continue;
      const a = descriptors.get(actor.id);
      const from = { ...actor.position };
      actor.blocked = false;
      if (actor.pursuit) {
        pursuit.move(
          actor,
          { ...state, droneRadius: rules.droneRadius, tailRadius: contactHunt?.tail.radius ?? 0 },
          collision,
        );
      } else if (a.path.length && a.speed) {
        let target = a.path[actor.pathIndex];
        let difference = sub(target, actor.position);
        let distance = length(difference);
        if (distance <= 30) {
          actor.pathIndex = (actor.pathIndex + 1) % a.path.length;
          target = a.path[actor.pathIndex];
          difference = sub(target, actor.position);
          distance = length(difference);
        }
        if (distance > 30) {
          const travel = Math.min(distance, Math.max(1, roundDiv(a.speed, WORLD_FLIGHT_HZ)));
          const delta = Object.fromEntries(
            AXES.map((k) => [k, roundDiv(difference[k] * travel, distance)]),
          );
          const moved = ['patrol', 'sentry', 'vehicle'].includes(a.type)
            ? collision.moveGroundActor(actor, delta)
            : collision.moveSphere(actor.position, delta, actor.radius);
          actor.position = moved.position;
          const actual = sub(actor.position, from);
          const progress = AXES.reduce((n, k) => n + actual[k] * delta[k], 0);
          actor.blocked =
            !!moved.blocked || progress < Math.max(1, Math.floor((travel * travel) / 10));
        }
      }
      collision.placeActor(actor);
      motions.push({ id: actor.id, from, to: { ...actor.position } });
    }
    return motions;
  }
  function launch(owner, position, direction, speed, damage) {
    if (state.projectiles.length >= 64) return false;
    const distance = length(direction);
    if (!distance) return false;
    state.projectiles.push({
      id: state.nextProjectileId++,
      owner,
      position: { ...position },
      velocity: Object.fromEntries(AXES.map((k) => [k, roundDiv(direction[k] * speed, distance)])),
      damage,
      ttl: rules.projectileTicks,
    });
    state.events.push({ type: 'fire', actor: owner });
    return true;
  }
  function weapons(command, motions, before) {
    const playerCentre = {
      ...state.position,
      y: state.position.y + rules.droneRadius,
    };
    if (state.cooldown > 0) state.cooldown--;
    if (command.actions & WORLD_ACTION_FIRE && state.cooldown === 0) {
      const direction = rotate(state.orientation, { x: 0, y: 0, z: -Q });
      if (launch('player', playerCentre, direction, rules.projectileSpeed, rules.playerDamage))
        state.shots++;
      state.cooldown = rules.fireCooldown;
    }
    for (const actor of state.actors) {
      if (actor.status !== 'active' || actor.role !== 'hostile') continue;
      const a = descriptors.get(actor.id);
      if (!a.fireEveryTicks) continue;
      if (actor.cooldown > 0) actor.cooldown--;
      const origin = actorCentre(actor);
      const direction = sub(playerCentre, origin);
      if (
        actor.cooldown === 0 &&
        length(direction) <= a.range &&
        collision.visible(origin, playerCentre)
      ) {
        launch(actor.id, origin, direction, a.projectileSpeed, a.damage);
        actor.cooldown = a.fireEveryTicks;
      }
    }
    const live = [];
    for (const p of state.projectiles) {
      const next = Object.fromEntries(
        AXES.map((k) => [k, p.position[k] + roundDiv(p.velocity[k], WORLD_FLIGHT_HZ)]),
      );
      const candidates = motions.filter(
        (m) =>
          m.id !== p.owner &&
          state.actors.some(
            (a) =>
              a.id === m.id &&
              a.status === 'active' &&
              !contactTargets.has(a.id) &&
              !couriers.has(a.id) &&
              (a.role === 'hostile' || a.type === 'hazard'),
          ),
      );
      const hit = collision.castPulse(
        p.position,
        next,
        candidates,
        p.owner === 'player'
          ? null
          : { from: before, to: state.position, radius: rules.droneRadius },
      );
      if (hit) {
        if (hit.id === '$player') state.health = Math.max(0, state.health - p.damage);
        else {
          const actor = state.actors.find((a) => a.id === hit.id);
          if (actor?.role === 'hostile') {
            // Enemy pulses are blocked by allies, but cannot farm player objectives.
            if (p.owner === 'player') {
              actor.health = Math.max(0, actor.health - p.damage);
              state.hits++;
              if (!actor.health) {
                actor.status = 'defeated';
                state.events.push({ type: 'defeat', actor: actor.id });
              }
            }
          }
        }
        state.events.push({ type: 'impact', actor: hit.id });
      } else if (--p.ttl > 0 && within(next, source.bounds)) live.push({ ...p, position: next });
    }
    state.projectiles = live;
  }
  function evaluateActorTrack(target, motions) {
    const empty = (reason) => ({ index: state.step, status: 'acquire', reason, travel: 0 });
    if (state.actorTrack.index !== state.step) state.actorTrack = empty('acquire-subject');
    const reset = (reason) => {
      state.hold = 0;
      state.actorTrack = empty(reason);
      return false;
    };
    const actor = state.actors.find((value) => value.id === target.actorId);
    if (!actor || actor.status !== 'active') return reset('subject-unavailable');
    if (state.grounded) return reset('airborne-clearance');
    const from = { ...state.position, y: state.position.y + rules.droneRadius },
      to = actorCentre(actor),
      difference = sub(to, from),
      distance = length(difference);
    if (distance < target.minDistance || distance > target.maxDistance)
      return reset('subject-range');
    const motion = motions.find((value) => value.id === actor.id),
      movement = motion ? sub(motion.to, motion.from) : { x: 0, y: 0, z: 0 },
      relative = Object.fromEntries(
        AXES.map((axis) => [axis, state.velocity[axis] - movement[axis] * WORLD_FLIGHT_HZ]),
      ),
      relativeSpeed = length(relative);
    if (relativeSpeed > target.maxRelativeSpeed) return reset('relative-speed');
    if (relativeTilt(state.orientation, { x: 0, y: Q, z: 0 }) > target.maxTilt)
      return reset('airframe-tilt');
    const forward = rotate(state.orientation, { x: 0, y: 0, z: -Q });
    // A body-relative cone is independent of camera mode, camera tilt and graphics.
    // Dot products stay within safe integer range; no squared products are used.
    if (
      AXES.reduce((sum, axis) => sum + forward[axis] * difference[axis], 0) <
      distance * cos(target.viewAngle)
    )
      return reset('nose-alignment');
    if (!collision.visible(from, to)) return reset('subject-occluded');
    state.hold++;
    state.actorTrack.travel += length(movement);
    const accepted =
      state.hold >= target.ticks && state.actorTrack.travel >= target.minTargetTravel;
    Object.assign(state.actorTrack, {
      status: accepted ? 'complete' : 'tracking',
      reason: state.hold >= target.ticks && !accepted ? 'subject-travel' : null,
      distance,
      relativeSpeed,
    });
    return accepted;
  }
  function evaluate(before, command, skillBefore, motions) {
    const target = source.steps[mode][state.step];
    if (!target) return; // Completed lab routes remain available for free practice.
    let accepted = false;
    if (target.type === HUNT_CONTACT_CRITERION)
      accepted = target.targets.every((id) => state.hunt.caught.includes(id));
    else if (SKILL_TYPES.has(target.type))
      accepted = evaluateSkillTarget(target, state, skillBefore);
    else if (target.type === 'actor-track-v1') accepted = evaluateActorTrack(target, motions);
    else if (target.type === 'gate') accepted = crossesGate(before, state.position, target);
    else if (target.type === 'eliminate')
      accepted = target.targets.every(
        (id) => state.actors.find((a) => a.id === id).status === 'defeated',
      );
    else if (target.type === 'survive') accepted = ++state.hold >= target.ticks;
    else {
      const angles = attitude(state.orientation);
      const tilt =
        target.type === 'land' && state.support
          ? relativeTilt(state.orientation, state.support.normal)
          : Math.max(Math.abs(angles.roll), Math.abs(angles.pitch));
      const heading =
        target.heading === null
          ? 0
          : Math.abs(((angles.yaw - target.heading + 54000) % 36000) - 18000);
      const inside =
        within(state.position, target) &&
        length(state.velocity) <= target.maxSpeed &&
        tilt <= target.maxTilt &&
        tilt >= target.minTilt &&
        heading <= 1500 &&
        (!target.centred || ['pitch', 'roll', 'yaw'].every((k) => Math.abs(command[k]) <= 50)) &&
        (target.type !== 'land' ||
          (state.grounded &&
            command.throttle <= 100 &&
            state.landingSpeed <= target.maxSpeed &&
            state.landingTilt <= target.maxTilt &&
            (!target.surface || state.support?.id === target.surface)));
      state.hold = inside ? state.hold + 1 : 0;
      accepted = state.hold >= target.ticks;
    }
    if (accepted) {
      state.events.push({ type: 'objective', index: state.step });
      state.step++;
      state.hold = 0;
      if (
        (!unscoredPractice && state.step === source.steps[mode].length) ||
        (unscoredPractice && state.step === practiceEndStep)
      )
        state.status = 'complete';
    }
  }
  function step(input, { quantized = false } = {}) {
    assertLive();
    const command = quantized ? validateCommand(input) : quantizeWorldInput(input);
    if (state.status !== 'active') return snapshot();
    if (!unscoredPractice && state.ticks >= rules.maxTicks) {
      state.status = 'expired';
      return snapshot();
    }
    state.events = [];
    const before = { ...state.position };
    const skillBefore = hasSkills
      ? {
          position: before,
          orientation: [...state.orientation],
          angular: { ...state.angular },
          grounded: state.grounded,
          contacts: state.contacts,
        }
      : null;
    const wasGrounded = state.grounded;
    const contactPoses = pursuit
      ? new Map(state.actors.filter((a) => a.pursuit).map((a) => [a.id, clone(a)]))
      : null;
    const pendingCatches = [];
    const motions = moveActors();
    const angles = attitude(state.orientation);
    for (const key of ['roll', 'pitch', 'yaw']) {
      const shaped = responseCurve(command[key], rates.expo);
      const desired =
        mode === 'self-level' && key !== 'yaw'
          ? clamp(
              (roundDiv(shaped * rates.maxTilt * 100, 1000) - angles[key]) * 4,
              -rates.maxRate * 100,
              rates.maxRate * 100,
            )
          : roundDiv(shaped * rates.maxRate * 100, 1000);
      const difference = desired - state.angular[key];
      state.angular[key] += difference
        ? Math.sign(difference) * Math.max(1, Math.abs(roundDiv(difference, rates.responseTicks)))
        : 0;
    }
    state.orientation = integrateOrientation(state.orientation, state.angular, WORLD_FLIGHT_HZ);
    const nextAngles = attitude(state.orientation);
    const thrust = roundDiv(command.throttle * 19620, 1000);
    const delta = {};
    for (const k of AXES) {
      const acceleration = mul(nextAngles.up[k], thrust) - (k === 'y' ? 9810 : 0);
      state.velocity[k] = clamp(
        roundDiv(state.velocity[k] * 995, 1000) + roundDiv(acceleration, WORLD_FLIGHT_HZ),
        -30000,
        30000,
      );
      delta[k] = roundDiv(state.velocity[k], WORLD_FLIGHT_HZ);
    }
    const impactSpeed = length(state.velocity);
    const tailMotions = (state.hunt?.tail ?? []).map((point, index) => ({
      id: huntTailId(index),
      from: { ...point, y: point.y - contactHunt.tail.radius },
      to: { ...point, y: point.y - contactHunt.tail.radius },
    }));
    const moved = collision.moveSphere(before, delta, rules.droneRadius, [
      ...motions,
      ...tailMotions,
    ]);
    state.position = moved.position;
    if (state.contactCooldown > 0) state.contactCooldown--;
    for (const hit of moved.contacts) {
      if (contactHunt && hit.id.startsWith('$hunt-tail-')) {
        state.hunt.failure = 'echo-tail';
        state.health = 0;
        state.events.push({ type: 'hunt-tail', actor: hit.id });
      }
      const catchable = contactHunt && (contactTargets.has(hit.id) || couriers.has(hit.id));
      const protectedContact =
        pursuit &&
        catchable &&
        contactPoses.has(hit.id) &&
        pursuitContactProtected(contactPoses.get(hit.id), before);
      if (
        pursuit &&
        catchable &&
        !protectedContact &&
        source.steps[mode][state.step]?.type === HUNT_CONTACT_CRITERION
      )
        pendingCatches.push(hit.id);
      const caught =
        !pursuit &&
        catchable &&
        source.steps[mode][state.step]?.type === HUNT_CONTACT_CRITERION &&
        catchHuntTarget(
          state,
          contactHunt,
          state.actors.find((actor) => actor.id === hit.id),
        );
      const into = roundDiv(
        AXES.reduce((n, k) => n + state.velocity[k] * hit.normal[k], 0),
        Q,
      );
      // Only an accepted opt-in catch retains its incoming momentum. Keep the
      // swept contact position and all other hull/support responses unchanged.
      if (!momentumCatch || !caught) {
        if (hit.moving) state.velocity = { x: 0, y: 0, z: 0 };
        else if (into < 0)
          for (const k of AXES) state.velocity[k] -= roundDiv(hit.normal[k] * into, Q);
      }
      const hard = hit.moving || hit.normal.y < 866025 || impactSpeed > 1500;
      if (hard) {
        if (caught) continue;
        if (pursuit && catchable && !protectedContact) continue;
        state.contacts++;
        if (state.contactCooldown === 0) {
          const actor = descriptors.get(hit.id);
          const damage = protectedContact
            ? PURSUIT_RULES.protectedDamage
            : catchable
              ? 0
              : actor?.type === 'hazard'
                ? actor.damage
                : actor && actor.role !== 'hostile'
                  ? 0
                  : rules.collisionDamage;
          state.health = Math.max(0, state.health - damage);
          state.contactCooldown = 20;
          if (protectedContact)
            state.events.push({ type: 'protected-contact', actor: hit.id, damage });
        }
      }
    }
    for (const k of AXES) {
      const n = clamp(state.position[k], source.bounds.min[k], source.bounds.max[k]);
      if (n !== state.position[k]) {
        state.position[k] = n;
        state.velocity[k] = 0;
        state.contacts++;
      }
    }
    const ground = collision.support(state.position, rules.droneRadius, 60);
    state.grounded =
      !!ground &&
      state.velocity.y <= 0 &&
      state.position.y - ground.y <= 6 &&
      state.position.y >= ground.y - 6;
    state.support = state.grounded ? ground : null;
    if (state.grounded) {
      state.position.y = Math.max(state.position.y, ground.y);
      if (!wasGrounded) {
        state.landingSpeed = impactSpeed;
        state.landingTilt = relativeTilt(state.orientation, ground.normal);
      }
      state.velocity.y = 0;
      state.velocity.x = roundDiv(state.velocity.x * 700, 1000);
      state.velocity.z = roundDiv(state.velocity.z * 700, 1000);
    }
    weapons(command, motions, before);
    // Successor contacts are committed only after all native hull damage and
    // projectile impacts. A fatal transaction cannot also award a catch.
    if (pursuit && state.health > 0)
      for (const id of new Set(pendingCatches)) {
        const actor = state.actors.find((a) => a.id === id);
        if (couriers.has(id) && actor?.status === 'active') {
          actor.status = 'caught';
          state.pursuit.bonusCaught.push(id);
          state.hunt.catches.push({
            id: actor.id,
            family: actor.pursuit.family,
            optional: true,
            tick: state.ticks,
            position: { ...actor.position },
            velocity: { ...state.velocity },
          });
          state.events.push({ type: 'catch', actor: id, optional: true });
        } else catchHuntTarget(state, contactHunt, actor);
      }
    if (contactHunt) updateHuntTail(state.hunt, contactHunt, state.position, rules.droneRadius);
    state.ticks++;
    state.lastInput = { ...command };
    state.heightRange.min = Math.min(state.heightRange.min, state.position.y);
    state.heightRange.max = Math.max(state.heightRange.max, state.position.y);
    if (state.health === 0) state.status = 'failed';
    else evaluate(before, command, skillBefore, motions);
    if (!unscoredPractice && state.status === 'active' && state.ticks >= rules.maxTicks)
      state.status = 'expired';
    return snapshot();
  }
  const flight = {
    identity,
    course: () => clone(source),
    response: () => ({ ...rates }),
    snapshot,
    step,
    reset,
    arm() {
      assertLive();
      if (['disarmed', 'paused'].includes(state.status)) state.status = 'active';
    },
    pause() {
      assertLive();
      if (state.status === 'active') state.status = 'paused';
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        collision.dispose();
      }
    },
  };
  if (unscoredPractice) unscoredWorldFlights.add(flight);
  return flight;
}

export const exportWorldCourse = (course) => canonicalJSON(validateWorldCourse(course));
export function worldStateIdentity(snapshot) {
  const state = { ...snapshot };
  delete state.attitude;
  delete state.target;
  delete state.total;
  delete state.maxHealth;
  if (['disarmed', 'paused'].includes(state.status)) state.status = 'active';
  return dataIdentity(state);
}
export function createWorldRecorder(flight, { session = 'practice', prefix = [] } = {}) {
  required(!unscoredWorldFlights.has(flight), 'Unscored learning practice cannot create proofs');
  required(SESSION.includes(session), 'Invalid world session');
  const frames = prefix.map((f) => [...f]);
  required(
    frames.length === flight.snapshot().ticks,
    'Recorder must start at the current verified tick',
  );
  return {
    record(input, { quantized = false } = {}) {
      const state = flight.snapshot();
      required(
        frames.length < WORLD_MAX_TICKS && state.ticks === frames.length + 1,
        'Record exactly once after each consumed flight tick',
      );
      const command =
        input === undefined
          ? state.lastInput
          : quantized
            ? validateCommand(input)
            : quantizeWorldInput(input);
      required(
        COMMANDS.every((k) => command[k] === state.lastInput[k]),
        'Record the exact command consumed by the flight',
      );
      frames.push(COMMANDS.map((k) => state.lastInput[k]));
    },
    ticks: () => frames.length,
    export() {
      required(
        flight.snapshot().ticks === frames.length,
        'Unrecorded flight ticks cannot be exported',
      );
      return {
        format: [PURSUIT_MODEL, PURSUIT_MODEL_V2].includes(flight.identity.model)
          ? 'FlightAttempt.v3'
          : 'FlightAttempt.v2',
        session,
        ...flight.identity,
        response: flight.response(),
        frames: frames.map((f) => [...f]),
        finalStateIdentity: worldStateIdentity(flight.snapshot()),
      };
    },
  };
}
async function replayInternal(
  course,
  input,
  {
    sampleEvery = 0,
    includeSectors = false,
    signal,
    yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
    retain = false,
  } = {},
) {
  signal?.throwIfAborted();
  await initWorldRuntime();
  signal?.throwIfAborted();
  required(int(sampleEvery, 0, WORLD_MAX_TICKS), 'Invalid replay sample interval');
  required(typeof includeSectors === 'boolean', 'Invalid replay sector option');
  const proof = boundedJSON(input, {
    maxBytes: 2 * 1024 * 1024,
    maxNodes: WORLD_MAX_TICKS * 7 + 1000,
    maxArray: WORLD_MAX_TICKS,
    maxDepth: 10,
  });
  exactKeys(
    proof,
    [
      'format',
      'session',
      'model',
      'backend',
      'course',
      'courseIdentity',
      'worldIdentity',
      'mode',
      'responseIdentity',
      'rulesIdentity',
      'conditionsIdentity',
      'response',
      'frames',
      'finalStateIdentity',
    ],
    'world proof',
  );
  const acceptedCourse = validateWorldCourse(course);
  required(
    proof.format ===
      (acceptedCourse.format === PURSUIT_COURSE ? 'FlightAttempt.v3' : 'FlightAttempt.v2') &&
      SESSION.includes(proof.session) &&
      Array.isArray(proof.frames) &&
      proof.frames.length <= WORLD_MAX_TICKS &&
      typeof proof.finalStateIdentity === 'string',
    'Invalid world proof',
  );
  const flight = createWorldFlight({
    course: acceptedCourse,
    mode: proof.mode,
    response: proof.response,
  });
  let keep = false;
  try {
    required(
      Object.entries(flight.identity).every(([k, v]) => proof[k] === v),
      'Exact world, runtime, mode, response, rules and conditions required',
    );
    flight.arm();
    const path = [];
    const sectors = includeSectors ? createSectorTracker() : null;
    for (let i = 0; i < proof.frames.length; i++) {
      if (i % 200 === 0) {
        signal?.throwIfAborted();
        await yieldControl();
        signal?.throwIfAborted();
      }
      const frame = proof.frames[i];
      required(Array.isArray(frame) && frame.length === 5, 'Five recorded controls required');
      required(flight.snapshot().status === 'active', 'Proof continues after terminal state');
      const state = flight.step(Object.fromEntries(COMMANDS.map((k, j) => [k, frame[j]])), {
        quantized: true,
      });
      sectors?.consume(state);
      if (sampleEvery && (i % sampleEvery === 0 || state.status !== 'active'))
        path.push({
          tick: state.ticks,
          position: state.position,
          orientation: state.orientation,
          input: state.lastInput,
        });
    }
    signal?.throwIfAborted();
    required(
      worldStateIdentity(flight.snapshot()) === proof.finalStateIdentity,
      'World replay state does not match recorded evidence',
    );
    if (retain) {
      required(flight.snapshot().status === 'active', 'Only unfinished attempts can be recovered');
      flight.pause();
      const recorder = createWorldRecorder(flight, {
        session: proof.session,
        prefix: proof.frames,
      });
      keep = true;
      return {
        flight,
        recorder,
        state: flight.snapshot(),
        ...(sectors ? { sectors: sectors.snapshot() } : {}),
      };
    }
    return {
      identity: flight.identity,
      state: flight.snapshot(),
      path,
      ...(sectors ? { sectors: sectors.snapshot() } : {}),
    };
  } finally {
    if (!keep) flight.dispose();
  }
}
export const replayWorldFlight = (course, proof, options = {}) =>
  replayInternal(course, proof, options);
export const recoverWorldFlight = (course, proof, options = {}) =>
  replayInternal(course, proof, { ...options, retain: true });
