import { validateAircraftMissionCheckpoint } from './aircraft-mission-checkpoint.mjs';
import {
  applyFlightSupport,
  initializeFlightSupport,
  relativeFlightTilt as relativeTilt,
} from './flight-support.mjs';
import { projectContactVelocity } from './flight-contact.mjs';
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
  isqrt,
  mul,
  rotate,
  roundDiv,
} from './math.mjs';
import {
  advanceFlightAir,
  FLIGHT_HZ,
  crossesGate,
  quantizeFlightInput,
  flightComparisonIdentity,
} from './model.mjs';
import { TUNED_RESPONSE_FORMAT } from './flight-response.mjs';
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
export const LIVE_ACTOR_RULES = 'destructible-subjects.v1';
export const SUBJECT_REPLACEMENT_TICKS = 250;
export const WORLD_FLIGHT_HZ = FLIGHT_HZ;
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

function identityForWorldCourse(source, mode, rates, actorRules = null) {
  const contactHunt = huntContact(source, mode);
  const gameplay = { ...source };
  delete gameplay.locales;
  delete gameplay.environment;
  delete gameplay.world;
  const identity = {
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
    ...(actorRules ? { actorRules } : {}),
  };
  if (rates.format === TUNED_RESPONSE_FORMAT)
    identity.comparisonIdentity = flightComparisonIdentity(identity, rates);
  return Object.freeze(identity);
}

/** Exact portable identity without initializing physics or creating a flight. */
export function worldFlightIdentity({
  course,
  mode = 'self-level',
  response = DEFAULT_RESPONSE,
  actorRules = null,
}) {
  const source = validateWorldCourse(course),
    rates = validateFlightResponse(response);
  required(MODES.includes(mode), 'Unsupported flight mode');
  required(actorRules === null || actorRules === LIVE_ACTOR_RULES, 'Unsupported actor rules');
  return identityForWorldCourse(source, mode, rates, actorRules);
}

/** v2 keeps v1's integer force/attitude integration, replacing only collision,
 * objectives and actor rules. Legacy model.mjs and its replay format are untouched. */
// Practice is an in-memory host policy, never part of a portable scored proof.
const unscoredWorldFlights = new WeakSet();
const liveMigrationBoundaries = new WeakMap();
export function createWorldFlight({
  course,
  mode = 'self-level',
  response = DEFAULT_RESPONSE,
  unscoredPractice = false,
  practiceEndStep = null,
  physicalPractice = false,
  physicalRadius = null,
  encounterPhysicsOnly = false,
  actorRules = null,
}) {
  required(actorRules === null || actorRules === LIVE_ACTOR_RULES, 'Unsupported actor rules');
  required(!encounterPhysicsOnly || actorRules === null, 'Encounter owns its actor rules');
  const liveActors = actorRules === LIVE_ACTOR_RULES;
  required(typeof unscoredPractice === 'boolean', 'Invalid world practice policy');
  required(
    typeof encounterPhysicsOnly === 'boolean' && (!encounterPhysicsOnly || unscoredPractice),
    'Encounter physics requires unscored practice',
  );
  required(!physicalPractice || unscoredPractice, 'Physical mission hosting requires practice');
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
  required(!physicalPractice || int(physicalRadius, 10, 3000), 'Invalid physical aircraft radius');
  const rules = physicalPractice ? { ...source.rules, droneRadius: physicalRadius } : source.rules;
  const contactHunt = encounterPhysicsOnly ? null : huntContact(source, mode);
  const momentumCatch = contactHunt?.contactPolicy === HUNT_MOMENTUM_CONTACT;
  const contactTargets = new Set(contactHunt?.targets ?? []);
  const pursuit =
    !encounterPhysicsOnly && source.format === PURSUIT_COURSE
      ? createPursuitController(source.pursuit, source.actors)
      : null;
  const pursuitPolicies = new Map((source.pursuit?.actors ?? []).map((p) => [p.id, p]));
  const couriers = new Set(
    (source.pursuit?.actors ?? []).filter((p) => p.family === 'courier').map((p) => p.id),
  );
  const identity = identityForWorldCourse(source, mode, rates, actorRules);
  let collision;
  let state;
  let disposed = false;
  let physicalTransaction = null;
  let acceptedDefeats = [];
  let encounterPool = null,
    stagedEncounter = null,
    acceptedEncounterMotion = null;
  const encounterActor = (value) => {
    // Mission health is collision bookkeeping only; encounter authority owns
    // damage and may promote a reserved slot to an elite with higher health.
    // Keep the historical mission checkpoint schema bound to its admitted slot.
    const descriptor = encounterPool?.get(value.slotId ?? value.id);
    const maximum = descriptor?.health ?? value.maxHealth ?? value.health;
    const health =
      value.health <= 0 || ['waiting', 'inactive'].includes(value.status)
        ? 0
        : Math.max(
            1,
            Math.min(
              maximum,
              Math.round((value.health * maximum) / (value.maxHealth ?? value.health)),
            ),
          );
    return {
      id: value.slotId ?? value.id,
      type: value.type === 'prop' ? 'hazard' : value.type,
      ...(value.role ? { role: value.role } : {}),
      position: clone(value.position),
      radius: value.radius,
      height: value.height,
      health,
      maxHealth: maximum,
      status: health === 0 ? 'defeated' : (value.status ?? 'active'),
      pathIndex: 0,
      cooldown: 0,
      blocked: false,
    };
  };
  const encounterSource = () => ({
    ...source,
    actors: [...(encounterPool?.values() ?? [])],
    pursuit: undefined,
    steps: {
      'self-level': [{ type: 'survive', ticks: 36000 }],
      acro: [{ type: 'survive', ticks: 36000 }],
    },
  });
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
    acceptedDefeats = [];
    collision?.dispose();
    collision = createWorldCollision(source);
    try {
      required(
        physicalPractice || collision.clearSpawn(source.spawn, rules.droneRadius),
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
        ...(liveActors ? { actorLives: { defeated: [], deaths: 0, impacts: 0 } } : {}),
        events: [],
        shots: 0,
        hits: 0,
        ...(contactHunt ? { hunt: createContactHuntState(source.spawn, rules.droneRadius) } : {}),
        ...(pursuit ? { pursuit: { bonusCaught: [] } } : {}),
        ...(hasSkills && !encounterPhysicsOnly
          ? { skill: { index: 0, status: 'entry', reason: 'enter-zone' } }
          : {}),
        ...(hasActorTracking && !encounterPhysicsOnly
          ? { actorTrack: { index: 0, status: 'acquire', reason: 'acquire-subject', travel: 0 } }
          : {}),
      };
      for (const a of sorted(encounterPhysicsOnly ? [] : source.actors)) {
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
          ...(liveActors
            ? {
                generation: 0,
                spawnId: `${a.id}:0`,
                defeatedTick: null,
                replacementTick: null,
                impactTick: -13,
                touching: false,
              }
            : {}),
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
      if (encounterPhysicsOnly && encounterPool)
        for (const descriptor of sorted([...encounterPool.values()])) {
          const actor = encounterActor(descriptor);
          collision.addActor(actor, 'support-v1');
          state.actors.push(actor);
        }
      stagedEncounter = null;
      acceptedEncounterMotion = null;
      physicalTransaction = null;
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
      initializeFlightSupport(state, ground);
    } catch (error) {
      collision.dispose();
      throw error;
    }
    return snapshot();
  }
  reset();
  const needsSubject = (id) =>
    source.steps[mode]
      .slice(state.step)
      .some(
        (target) =>
          (target.type === 'actor-track-v1' && target.actorId === id) ||
          (target.type === HUNT_CONTACT_CRITERION &&
            target.targets.includes(id) &&
            !state.hunt.caught.includes(id)),
      );
  function syncLiveColliders() {
    for (const actor of state.actors) {
      collision.removeActor(actor.id);
      if (actor.status === 'active')
        collision.addActor(actor, descriptors.get(actor.id)?.groundMotion);
    }
  }
  function actorFact(
    actor,
    cause,
    damage,
    impactPosition,
    direction,
    rewardEligible = false,
    eventType = 'actor-hit',
  ) {
    const descriptor = descriptors.get(actor.id);
    const magnitude = Math.hypot(direction.x, direction.y, direction.z) || 1;
    return {
      actor: actor.id,
      sourceId: actor.id,
      spawnId: actor.spawnId,
      generation: actor.generation,
      eventId: `${actor.spawnId}:${state.ticks}:${eventType}`,
      tick: state.ticks,
      actorType: actor.type,
      position: clone(actor.position),
      radius: actor.radius,
      height: actor.height,
      family: actor.pursuit?.family ?? (descriptor.speed ? 'patroller' : 'lookout'),
      material: ['patrol', 'sentry'].includes(actor.type) ? 'organic' : 'electronic',
      appearance: {
        type: actor.type,
        family: actor.pursuit?.family ?? (descriptor.speed ? 'patroller' : 'lookout'),
      },
      cause,
      weapon: cause,
      damage,
      impactPosition: clone(impactPosition),
      impactDirection: Object.fromEntries(
        AXES.map((k) => [k, Math.round((direction[k] / magnitude) * Q)]),
      ),
      velocity: clone(state.velocity),
      seed: (state.rng ^ state.ticks ^ actor.generation) >>> 0,
      rewardEligible,
    };
  }
  function damageActor(actor, damage, cause, position, direction) {
    if (!liveActors || actor?.status !== 'active' || damage <= 0) return;
    const inflicted = Math.min(actor.health, damage);
    actor.health -= inflicted;
    state.events.push({
      type: 'actor-hit',
      ...actorFact(actor, cause, inflicted, position, direction),
    });
    if (actor.health) return;
    actor.status = 'defeated';
    actor.defeatedTick = state.ticks;
    actor.replacementTick = needsSubject(actor.id) ? state.ticks + SUBJECT_REPLACEMENT_TICKS : null;
    const rewardEligible = !state.actorLives.defeated.includes(actor.id);
    if (rewardEligible) state.actorLives.defeated.push(actor.id);
    state.actorLives.deaths++;
    collision.removeActor(actor.id);
    if (
      source.steps[mode][state.step]?.type === 'actor-track-v1' &&
      source.steps[mode][state.step].actorId === actor.id
    ) {
      state.hold = 0;
      state.actorTrack = {
        index: state.step,
        status: 'acquire',
        reason: 'subject-replacement',
        travel: 0,
      };
    }
    state.events.push({
      type: 'defeat',
      ...actorFact(actor, cause, inflicted, position, direction, rewardEligible, 'defeat'),
    });
  }
  function replaceSubjects() {
    if (!liveActors) return;
    for (const actor of state.actors) {
      if (
        actor.status !== 'defeated' ||
        actor.replacementTick === null ||
        state.ticks < actor.replacementTick ||
        !needsSubject(actor.id)
      )
        continue;
      const descriptor = descriptors.get(actor.id);
      const candidates = actor.pursuit
        ? [descriptor.position]
        : [descriptor.position, ...descriptor.path];
      for (let index = 0; index < candidates.length; index++) {
        const position = clone(candidates[(index + actor.generation + 1) % candidates.length]);
        const candidate = { ...actor, position, health: actor.maxHealth, status: 'active' };
        if (['patrol', 'sentry', 'vehicle'].includes(actor.type)) {
          const support = collision.support(
            { ...position, y: position.y + 100 },
            actor.radius,
            320,
          );
          if (!support || Math.abs(support.y - position.y) > 220) continue;
          position.y = Math.round(support.y);
        }
        const centre = actorCentre(candidate);
        const overlaps = (at, radius, height) =>
          Math.abs(centre.y - (at.y + height / 2)) < (actor.height + height) / 2 + 200 &&
          Math.hypot(position.x - at.x, position.z - at.z) < actor.radius + radius + 1000;
        if (
          !within(position, source.bounds) ||
          overlaps(
            state.position,
            rules.droneRadius + Math.ceil(length(state.velocity) / WORLD_FLIGHT_HZ),
            rules.droneRadius * 2,
          ) ||
          state.actors.some(
            (other) =>
              other !== actor &&
              other.status === 'active' &&
              overlaps(other.position, other.radius, other.height),
          )
        )
          continue;
        collision.addActor(candidate, descriptor.groundMotion);
        if (!collision.clearActorSpawn(candidate)) {
          collision.removeActor(actor.id);
          continue;
        }
        Object.assign(actor, {
          position,
          health: actor.maxHealth,
          status: 'active',
          generation: actor.generation + 1,
          spawnId: `${actor.id}:${actor.generation + 1}`,
          defeatedTick: null,
          replacementTick: null,
          impactTick: state.ticks,
          touching: false,
          pathIndex: 0,
          cooldown: descriptor.fireEveryTicks,
          blocked: false,
        });
        if (actor.pursuit) {
          actor.pursuit = createPursuitActorState(pursuitPolicies.get(actor.id), source.pursuit);
          // A surviving rendezvous member has already changed to independent
          // pursuit. Its replacement must not wait forever for a retired pair.
          if (
            actor.pursuit.family === 'rendezvous-pair' &&
            state.actors.some(
              (other) =>
                other !== actor &&
                other.status === 'active' &&
                other.pursuit?.family === 'runner' &&
                pursuitPolicies.get(other.id)?.pair === pursuitPolicies.get(actor.id).pair,
            )
          )
            actor.pursuit.family = 'runner';
        }
        state.events.push({
          type: 'replacement',
          actor: actor.id,
          spawnId: actor.spawnId,
          generation: actor.generation,
        });
        break;
      }
    }
  }
  function moveActors() {
    if (encounterPhysicsOnly) {
      const proposal = stagedEncounter;
      if (!proposal) return [];
      state.actors = proposal.actors.map(encounterActor).sort((a, b) => a.id.localeCompare(b.id));
      for (const actor of state.actors) collision.placeActor(actor);
      return clone(proposal.motions.filter((motion) => motion.enabled !== false));
    }
    replaceSubjects();
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
              (liveActors ||
                (!contactTargets.has(a.id) &&
                  !couriers.has(a.id) &&
                  (a.role === 'hostile' || a.type === 'hazard'))),
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
          if (actor && (liveActors || actor.role === 'hostile')) {
            // Enemy pulses are blocked by allies, but cannot farm player objectives.
            if (p.owner === 'player') {
              if (liveActors) {
                if (!actor.pursuit || !pursuitContactProtected(actor, p.position)) {
                  const at = Object.fromEntries(
                    AXES.map((k) => [
                      k,
                      Math.round(p.position[k] + (next[k] - p.position[k]) * (hit.toi ?? 1)),
                    ]),
                  );
                  damageActor(actor, p.damage, 'pulse', at, p.velocity);
                  state.hits++;
                }
              } else {
                actor.health = Math.max(0, actor.health - p.damage);
                state.hits++;
                if (!actor.health) {
                  actor.status = 'defeated';
                  state.events.push({ type: 'defeat', actor: actor.id });
                }
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
    if (!actor || actor.status !== 'active')
      return reset(
        liveActors && actor && actor.replacementTick !== null
          ? 'subject-replacement'
          : 'subject-unavailable',
      );
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
      accepted = target.targets.every((id) =>
        liveActors
          ? state.actorLives.defeated.includes(id)
          : state.actors.find((a) => a.id === id).status === 'defeated',
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
  function step(input, { quantized = false, motion = null } = {}) {
    assertLive();
    const command = quantized ? validateCommand(input) : quantizeWorldInput(input);
    if (state.status !== 'active') return snapshot();
    required(Boolean(motion) === physicalPractice, 'Physical mission motion is required');
    if (!unscoredPractice && state.ticks >= rules.maxTicks) {
      state.status = 'expired';
      return snapshot();
    }
    state.events = liveActors && physicalTransaction ? [...physicalTransaction.events] : [];
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
      ? new Map(
          (physicalTransaction?.saved.actors ?? state.actors)
            .filter((a) => a.pursuit)
            .map((a) => [a.id, clone(a)]),
        )
      : null;
    const pendingCatches = [],
      deferredCatchContacts = [];
    const motions = physicalTransaction?.motions ?? moveActors();
    const delta = {};
    if (motion) {
      state.velocity = { ...motion.velocity };
      state.orientation = [...motion.orientation];
      state.angular = { ...motion.angular };
    } else advanceFlightAir(state, command, mode, rates, delta);
    const incomingVelocity = encounterPhysicsOnly || liveActors ? clone(state.velocity) : null;
    const impactSpeed = motion?.landingSpeed ?? length(state.velocity);
    const tailMotions = (state.hunt?.tail ?? []).map((point, index) => ({
      id: huntTailId(index),
      from: { ...point, y: point.y - contactHunt.tail.radius },
      to: { ...point, y: point.y - contactHunt.tail.radius },
    }));
    const moved =
      motion ??
      collision.moveSphere(before, delta, rules.droneRadius, [...motions, ...tailMotions]);
    state.position = moved.position;
    const touching = new Set();
    if (state.contactCooldown > 0) state.contactCooldown--;
    for (const hit of moved.contacts) {
      if (contactHunt && hit.id.startsWith('$hunt-tail-')) {
        state.hunt.failure = 'echo-tail';
        state.health = 0;
        state.events.push({ type: 'hunt-tail', actor: hit.id });
      }
      const catchable = contactHunt && (contactTargets.has(hit.id) || couriers.has(hit.id));
      const protectedContact =
        (pursuit || liveActors) &&
        (catchable || liveActors) &&
        contactPoses?.has(hit.id) &&
        pursuitContactProtected(contactPoses.get(hit.id), before);
      if (
        (pursuit || liveActors) &&
        catchable &&
        !protectedContact &&
        source.steps[mode][state.step]?.type === HUNT_CONTACT_CRITERION
      )
        pendingCatches.push(hit.id);
      const caught =
        !pursuit &&
        !liveActors &&
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
      if (liveActors) {
        const actor = state.actors.find((item) => item.id === hit.id);
        if (actor?.status === 'active') {
          touching.add(actor.id);
          const actorMotion = motions.find((entry) => entry.id === actor.id);
          const relative = Math.max(
            0,
            -AXES.reduce(
              (sum, key) =>
                sum +
                ((incomingVelocity[key] -
                  (actorMotion
                    ? (actorMotion.to[key] - actorMotion.from[key]) * WORLD_FLIGHT_HZ
                    : 0)) *
                  hit.normal[key]) /
                  Q,
              0,
            ),
          );
          const speed = hit.relativeNormalSpeedMmS ?? relative;
          const damage = Math.min(100, Math.max(0, Math.floor((speed - 2000) / 100)));
          if (
            !protectedContact &&
            !actor.touching &&
            state.ticks - actor.impactTick >= 13 &&
            damage > 0
          ) {
            actor.impactTick = state.ticks;
            state.actorLives.impacts++;
            damageActor(
              actor,
              damage,
              'impact',
              actorCentre(actor),
              Object.fromEntries(AXES.map((key) => [key, -hit.normal[key]])),
            );
          }
        }
      }
      // Only an accepted opt-in catch retains its incoming momentum. Keep the
      // swept contact position and all other hull/support responses unchanged.
      if (!motion && (!momentumCatch || !caught)) {
        if (liveActors && momentumCatch && pendingCatches.includes(hit.id))
          deferredCatchContacts.push(hit);
        else state.velocity = projectContactVelocity(state.velocity, hit, into);
      }
      const hard = hit.moving || hit.normal.y < 866025 || impactSpeed > 1500;
      if (hard) {
        if (caught) continue;
        if (pursuit && catchable && !protectedContact) continue;
        state.contacts++;
        if (state.contactCooldown === 0) {
          const actor = descriptors.get(hit.id);
          const damage = encounterPhysicsOnly
            ? 0
            : protectedContact
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
    for (const k of motion ? [] : AXES) {
      const n = clamp(state.position[k], source.bounds.min[k], source.bounds.max[k]);
      if (n !== state.position[k]) {
        state.position[k] = n;
        state.velocity[k] = 0;
        state.contacts++;
      }
    }
    if (motion) {
      state.grounded = motion.grounded;
      state.support = clone(motion.support);
      state.landingSpeed = motion.landingSpeed;
      state.landingTilt = motion.landingTilt;
    } else {
      const ground = collision.support(state.position, rules.droneRadius, 60);
      applyFlightSupport(state, ground, wasGrounded, impactSpeed);
    }
    if (!encounterPhysicsOnly) weapons(command, motions, before);
    // Successor contacts are committed only after all native hull damage and
    // projectile impacts. A fatal transaction cannot also award a catch.
    if ((pursuit || liveActors) && state.health > 0)
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
    for (const hit of deferredCatchContacts) {
      if (state.events.some((event) => event.type === 'catch' && event.actor === hit.id)) continue;
      const into = roundDiv(
        AXES.reduce((sum, key) => sum + state.velocity[key] * hit.normal[key], 0),
        Q,
      );
      state.velocity = projectContactVelocity(state.velocity, hit, into);
    }
    if (liveActors) {
      for (const actor of state.actors) {
        actor.touching = actor.status === 'active' && touching.has(actor.id);
        if (actor.status === 'caught') collision.removeActor(actor.id);
      }
      for (const event of state.events) {
        if (event.type !== 'catch') continue;
        const actor = state.actors.find((entry) => entry.id === event.actor);
        Object.assign(
          event,
          actorFact(
            actor,
            'catch',
            0,
            actorCentre(actor),
            state.velocity,
            !state.actorLives.defeated.includes(actor.id),
            'catch',
          ),
        );
        if (!state.actorLives.defeated.includes(actor.id)) state.actorLives.defeated.push(actor.id);
      }
    }
    if (contactHunt) updateHuntTail(state.hunt, contactHunt, state.position, rules.droneRadius);
    state.ticks++;
    state.lastInput = { ...command };
    state.heightRange.min = Math.min(state.heightRange.min, state.position.y);
    state.heightRange.max = Math.max(state.heightRange.max, state.position.y);
    if (state.health === 0) state.status = 'failed';
    else if (!encounterPhysicsOnly) evaluate(before, command, skillBefore, motions);
    if (!unscoredPractice && state.status === 'active' && state.ticks >= rules.maxTicks)
      state.status = 'expired';
    if (encounterPhysicsOnly) {
      acceptedEncounterMotion = {
        trace: [
          { position: clone(before), velocity: clone(incomingVelocity) },
          { position: clone(state.position), velocity: clone(state.velocity) },
        ],
        contacts: moved.contacts
          .filter((hit) => encounterPool?.has(hit.id))
          .map((hit) => {
            const actorMotion = motions.find((entry) => entry.id === hit.id),
              actorVelocity = actorMotion
                ? Object.fromEntries(
                    AXES.map((key) => [
                      key,
                      (actorMotion.to[key] - actorMotion.from[key]) * WORLD_FLIGHT_HZ,
                    ]),
                  )
                : { x: 0, y: 0, z: 0 },
              normalLength = Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z) || 1,
              unitNormal = Object.fromEntries(
                AXES.map((key) => [key, hit.normal[key] / normalLength]),
              );
            return {
              actorId: hit.id,
              normal: unitNormal,
              relativeNormalSpeedMmS: Math.max(
                0,
                -AXES.reduce(
                  (sum, key) =>
                    sum + (incomingVelocity[key] - actorVelocity[key]) * unitNormal[key],
                  0,
                ),
              ),
            };
          }),
      };
      stagedEncounter = null;
    }
    if (liveActors) {
      acceptedDefeats.push(...state.events.filter((event) => event.type === 'defeat').map(clone));
      if (acceptedDefeats.length > 1024) acceptedDefeats.splice(0, acceptedDefeats.length - 1024);
    }
    physicalTransaction = null;
    return snapshot();
  }
  const flight = {
    identity,
    course: () => clone(source),
    response: () => structuredClone(rates),
    snapshot,
    defeatHistory: () => clone(acceptedDefeats),
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
  if (encounterPhysicsOnly) {
    flight.configureEncounterActors = (actors) => {
      required(
        !encounterPool &&
          state.ticks === 0 &&
          Array.isArray(actors) &&
          actors.length > 0 &&
          actors.length <= 128,
        'Configure encounter actors once before flight',
      );
      const candidatePool = new Map();
      const admittedActors = [];
      for (const value of actors) {
        const actor = encounterActor(value);
        required(
          typeof actor.id === 'string' &&
            !candidatePool.has(actor.id) &&
            WORLD_ACTOR_TYPES.includes(actor.type) &&
            int(actor.radius, 100, 2000) &&
            int(actor.height, 100, 5000),
          'Invalid encounter collision pool',
        );
        vector(actor.position);
        candidatePool.set(actor.id, {
          ...clone(actor),
          health: actor.maxHealth,
          status: 'active',
          path: [],
          fireEveryTicks: 0,
        });
        admittedActors.push(actor);
      }
      for (const actor of admittedActors) collision.addActor(actor, 'support-v1');
      encounterPool = candidatePool;
      state.actors = actors.map(encounterActor).sort((a, b) => a.id.localeCompare(b.id));
    };
    flight.stageEncounterActors = (proposal) => {
      required(
        encounterPool &&
          !physicalTransaction &&
          Array.isArray(proposal?.actors) &&
          Array.isArray(proposal?.motions) &&
          proposal.actors.length === encounterPool.size,
        'Invalid encounter proposal',
      );
      for (const actor of proposal.actors) {
        const shape = encounterPool.get(actor.slotId ?? actor.id);
        required(
          shape &&
            shape.radius === actor.radius &&
            shape.height === actor.height &&
            shape.type === (actor.type === 'prop' ? 'hazard' : actor.type),
          'Encounter collision archetype changed',
        );
        vector(actor.position);
      }
      const ids = new Set();
      for (const entry of proposal.motions) {
        required(
          encounterPool.has(entry.id) && !ids.has(entry.id),
          'Unknown or duplicate encounter motion',
        );
        ids.add(entry.id);
        vector(entry.from);
        vector(entry.to);
      }
      required(
        ids.size === encounterPool.size &&
          new Set(proposal.actors.map((a) => a.slotId ?? a.id)).size === encounterPool.size,
        'Incomplete encounter collision proposal',
      );
      stagedEncounter = clone(proposal);
    };
    flight.encounterMotion = () => clone(acceptedEncounterMotion);
    flight.encounterCheckpoint = () => ({
      format: 'FPVEncounterFlightCheckpoint.v1',
      identity: dataIdentity(identity),
      state: clone(state),
    });
    flight.restoreEncounterCheckpoint = (record) => {
      required(
        !physicalTransaction &&
          record?.format === 'FPVEncounterFlightCheckpoint.v1' &&
          record.identity === dataIdentity(identity),
        'Encounter flight checkpoint differs',
      );
      required(encounterPool, 'Encounter collision pool must be configured before restore');
      const saved = validateAircraftMissionCheckpoint(
        {
          format: 'AircraftMissionCheckpoint.v1',
          identity: record.identity,
          state: record.state,
          feedback: null,
        },
        { identity, source: encounterSource(), mode, world: true },
      ).state;
      state = clone(saved);
      state.status = 'paused';
      stagedEncounter = null;
      acceptedEncounterMotion = null;
      for (const actor of state.actors) collision.placeActor(actor);
      return snapshot();
    };
  }
  if (physicalPractice) {
    flight.physicalTail = () =>
      contactHunt
        ? {
            radius: contactHunt.tail.radius,
            ids: Array.from({ length: HUNT_TAIL_LIMITS.links }, (_, index) => huntTailId(index)),
          }
        : null;
    flight.physicalCheckpoint = () => ({
      format: liveActors ? 'AircraftMissionCheckpoint.v2' : 'AircraftMissionCheckpoint.v1',
      identity: dataIdentity(identity),
      state: clone(state),
      feedback: null,
    });
    flight.validatePhysicalCheckpoint = (value) =>
      validateAircraftMissionCheckpoint(value, {
        identity,
        source: encounterPhysicsOnly ? encounterSource() : source,
        mode,
        world: true,
      });
    flight.restorePhysicalCheckpoint = (value) => {
      required(!physicalTransaction, 'A physical mission is pending');
      const saved = flight.validatePhysicalCheckpoint(value);
      state = clone(saved.state);
      acceptedDefeats = [];
      state.status = state.status === 'active' ? 'paused' : state.status;
      stagedEncounter = null;
      acceptedEncounterMotion = null;
      if (liveActors) syncLiveColliders();
      else for (const actor of state.actors) collision.placeActor(actor);
      return snapshot();
    };
    flight.preparePhysicalStep = () => {
      required(!physicalTransaction, 'A physical mission is pending');
      const saved = clone(state);
      if (liveActors) state.events = [];
      const motions = moveActors();
      physicalTransaction = { saved, motions, events: clone(state.events) };
      return clone(motions);
    };
    flight.cancelPhysicalStep = () => {
      if (!physicalTransaction) return;
      state = physicalTransaction.saved;
      if (liveActors) syncLiveColliders();
      else for (const actor of state.actors) collision.placeActor(actor);
      physicalTransaction = null;
    };
  }
  if (liveActors && unscoredPractice)
    flight.adoptLivePractice = (previous) => {
      required(
        !physicalTransaction && previous?.identity && previous?.snapshot,
        'A verified flight is required',
      );
      const previousRules = previous.identity.actorRules ?? null;
      required(
        dataIdentity(previous.identity) ===
          dataIdentity(identityForWorldCourse(source, mode, rates, previousRules)),
        'Live practice belongs to another course',
      );
      const value = clone(previous.snapshot());
      for (const key of ['attitude', 'target', 'total', 'maxHealth']) delete value[key];
      validateAircraftMissionCheckpoint(
        {
          format: previousRules ? 'AircraftMissionCheckpoint.v2' : 'AircraftMissionCheckpoint.v1',
          identity: dataIdentity(previous.identity),
          state: value,
          feedback: null,
        },
        { identity: previous.identity, source, mode, world: true },
      );
      if (!previousRules) {
        value.actorLives = {
          defeated: value.actors.filter((a) => a.status !== 'active').map((a) => a.id),
          deaths: value.actors.filter((a) => a.status === 'defeated').length,
          impacts: 0,
        };
        for (const actor of value.actors)
          Object.assign(actor, {
            generation: 0,
            spawnId: `${actor.id}:0`,
            defeatedTick: actor.status === 'defeated' ? value.ticks : null,
            replacementTick: null,
            impactTick: -13,
            touching: false,
          });
        value.events = [];
      }
      liveMigrationBoundaries.set(flight, {
        ticks: value.ticks,
        stateIdentity: worldStateIdentity(previous.snapshot()),
        identity: clone(previous.identity),
      });
      acceptedDefeats = previous.defeatHistory?.().slice(-1024) ?? [];
      state = value;
      state.status = 'paused';
      for (const actor of state.actors)
        if (actor.status === 'defeated' && needsSubject(actor.id) && actor.replacementTick === null)
          actor.replacementTick = state.ticks + SUBJECT_REPLACEMENT_TICKS;
      syncLiveColliders();
      return snapshot();
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
        format:
          flight.identity.actorRules === LIVE_ACTOR_RULES
            ? 'FlightAttempt.v4'
            : [PURSUIT_MODEL, PURSUIT_MODEL_V2].includes(flight.identity.model)
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
      'comparisonIdentity',
      'rulesIdentity',
      'conditionsIdentity',
      'response',
      'frames',
      'finalStateIdentity',
      ...(proof.format === 'FlightAttempt.v4' ? ['actorRules'] : []),
    ],
    'world proof',
  );
  const acceptedCourse = validateWorldCourse(course);
  required(
    (proof.format === 'FlightAttempt.v4'
      ? proof.actorRules === LIVE_ACTOR_RULES
      : proof.format ===
        (acceptedCourse.format === PURSUIT_COURSE ? 'FlightAttempt.v3' : 'FlightAttempt.v2')) &&
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
    actorRules: proof.format === 'FlightAttempt.v4' ? proof.actorRules : null,
  });
  let keep = false;
  try {
    required(
      Object.hasOwn(proof, 'comparisonIdentity') ===
        Object.hasOwn(flight.identity, 'comparisonIdentity') &&
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
const continuationFormat = (value) =>
  typeof value === 'string'
    ? value.includes('FlightPracticeContinuation.v1')
    : value?.format === 'FlightPracticeContinuation.v1';
export const replayWorldFlight = (course, proof, options = {}) =>
  continuationFormat(proof)
    ? replayContinuation(course, proof, options)
    : replayInternal(course, proof, options);
export const recoverWorldFlight = (course, proof, options = {}) =>
  continuationFormat(proof)
    ? replayContinuation(course, proof, { ...options, retain: true })
    : replayInternal(course, proof, { ...options, retain: true });

/** Continue old verified runs as a new, explicitly unscored live boundary. */
export function migrateWorldFlightToLive(previous) {
  const flight = createWorldFlight({
    course: previous.course(),
    mode: previous.identity.mode,
    response: previous.response(),
    actorRules: LIVE_ACTOR_RULES,
    unscoredPractice: true,
  });
  try {
    flight.adoptLivePractice(previous);
    return flight;
  } catch (error) {
    flight.dispose();
    throw error;
  }
}

/** A bounded new timeline anchored to immutable, verified historical evidence. */
export function createWorldContinuationRecorder(flight, { boundaryProof, prefix = [] } = {}) {
  const boundary = liveMigrationBoundaries.get(flight);
  required(boundary && unscoredWorldFlights.has(flight), 'A migrated live practice is required');
  const proof = boundedJSON(boundaryProof, {
    maxBytes: 2 * 1024 * 1024,
    maxNodes: WORLD_MAX_TICKS * 7 + 1000,
    maxArray: WORLD_MAX_TICKS,
    maxDepth: 10,
  });
  required(
    ['FlightAttempt.v2', 'FlightAttempt.v3', 'FlightAttempt.v4'].includes(proof.format) &&
      proof.finalStateIdentity === boundary.stateIdentity &&
      Object.entries(boundary.identity).every(([key, value]) => proof[key] === value),
    'Continuation needs its original verified boundary',
  );
  const frames = prefix.map((frame) => [...frame]);
  required(
    frames.length <= WORLD_MAX_TICKS && frames.length + boundary.ticks === flight.snapshot().ticks,
    'Continuation clock differs',
  );
  let retainedStateIdentity =
    frames.length === WORLD_MAX_TICKS ? worldStateIdentity(flight.snapshot()) : null;
  return {
    record(input, { quantized = false } = {}) {
      if (frames.length === WORLD_MAX_TICKS) return false;
      const state = flight.snapshot();
      required(
        state.ticks === boundary.ticks + frames.length + 1,
        'Record exactly one accepted continuation tick',
      );
      const command =
        input === undefined
          ? state.lastInput
          : quantized
            ? validateCommand(input)
            : quantizeWorldInput(input);
      required(
        COMMANDS.every((key) => command[key] === state.lastInput[key]),
        'Record the consumed continuation command',
      );
      frames.push(COMMANDS.map((key) => state.lastInput[key]));
      if (frames.length === WORLD_MAX_TICKS) retainedStateIdentity = worldStateIdentity(state);
      return true;
    },
    ticks: () => frames.length,
    recordingStatus: () => ({
      recordedFrames: frames.length,
      maxFrames: WORLD_MAX_TICKS,
      retainedTick: boundary.ticks + frames.length,
      exhausted: frames.length === WORLD_MAX_TICKS,
    }),
    export() {
      required(
        retainedStateIdentity !== null ||
          flight.snapshot().ticks === boundary.ticks + frames.length,
        'Unrecorded continuation ticks',
      );
      return {
        format: 'FlightPracticeContinuation.v1',
        unscored: true,
        actorRules: LIVE_ACTOR_RULES,
        boundaryProof: clone(proof),
        frames: frames.map((frame) => [...frame]),
        finalStateIdentity: retainedStateIdentity ?? worldStateIdentity(flight.snapshot()),
      };
    },
  };
}
async function replayContinuation(
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
  required(int(sampleEvery, 0, WORLD_MAX_TICKS), 'Invalid continuation sample interval');
  const proof = readContinuationProof(input);
  const origin = await replayInternal(course, proof.boundaryProof, {
    signal,
    yieldControl,
    retain: true,
  });
  let flight,
    keep = false;
  try {
    flight = migrateWorldFlightToLive(origin.flight);
    const recorder = createWorldContinuationRecorder(flight, {
      boundaryProof: proof.boundaryProof,
    });
    // Migrated practice has no scored sectors and may outlive the original
    // scored tick ceiling. Its retained proof boundary remains independently
    // verified without extending the historical sector schema.
    const path = [];
    flight.arm();
    for (let i = 0; i < proof.frames.length; i++) {
      if (i % 200 === 0) {
        signal?.throwIfAborted();
        await yieldControl();
        signal?.throwIfAborted();
      }
      const frame = proof.frames[i];
      required(
        Array.isArray(frame) && frame.length === 5 && flight.snapshot().status === 'active',
        'Invalid continuation interval',
      );
      const state = flight.step(Object.fromEntries(COMMANDS.map((key, j) => [key, frame[j]])), {
        quantized: true,
      });
      recorder.record();
      if (sampleEvery && (i % sampleEvery === 0 || state.status !== 'active'))
        path.push({
          tick: state.ticks,
          position: state.position,
          orientation: state.orientation,
          input: state.lastInput,
        });
    }
    required(
      worldStateIdentity(flight.snapshot()) === proof.finalStateIdentity,
      'Continuation state does not match its evidence',
    );
    if (retain) {
      required(flight.snapshot().status === 'active', 'Only unfinished practice can continue');
      flight.pause();
      keep = true;
      return {
        flight,
        recorder,
        state: flight.snapshot(),
        ...(includeSectors ? { sectors: [] } : {}),
        unscored: true,
      };
    }
    return {
      identity: flight.identity,
      state: flight.snapshot(),
      path,
      ...(includeSectors ? { sectors: [] } : {}),
      unscored: true,
    };
  } finally {
    origin.flight.dispose();
    if (!keep) flight?.dispose();
  }
}

function readContinuationProof(input) {
  const proof = boundedJSON(input, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: WORLD_MAX_TICKS * 14 + 2000,
    maxArray: WORLD_MAX_TICKS,
    maxDepth: 12,
  });
  exactKeys(
    proof,
    ['format', 'unscored', 'actorRules', 'boundaryProof', 'frames', 'finalStateIdentity'],
    'Practice continuation',
  );
  required(
    proof.format === 'FlightPracticeContinuation.v1' &&
      proof.unscored === true &&
      proof.actorRules === LIVE_ACTOR_RULES &&
      ['FlightAttempt.v2', 'FlightAttempt.v3', 'FlightAttempt.v4'].includes(
        proof.boundaryProof?.format,
      ) &&
      Array.isArray(proof.frames) &&
      proof.frames.length <= WORLD_MAX_TICKS,
    'Invalid practice continuation',
  );
  return proof;
}

/** Prepare Watch at the verified migration boundary; the host verifies the full
 * continuation before offering Watch and owns the returned paused flight. */
export async function prepareWorldContinuationReplay(course, input, { signal, yieldControl } = {}) {
  const proof = readContinuationProof(input);
  for (const frame of proof.frames) {
    required(Array.isArray(frame) && frame.length === 5, 'Invalid continuation frame');
    validateCommand(Object.fromEntries(COMMANDS.map((key, index) => [key, frame[index]])));
  }
  const origin = await replayInternal(course, proof.boundaryProof, {
    signal,
    yieldControl,
    retain: true,
  });
  try {
    const flight = migrateWorldFlightToLive(origin.flight);
    return {
      flight,
      frames: proof.frames.map((frame) => [...frame]),
      mode: flight.identity.mode,
      response: flight.response(),
      boundaryTicks: flight.snapshot().ticks,
      unscored: true,
    };
  } finally {
    origin.flight.dispose();
  }
}
