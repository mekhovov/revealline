import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  plainObject,
  required,
  stableId,
} from '../../game/data-json.mjs';
import { createWorldCollision } from './world-collision.mjs';
import { admitEncounterServicePad } from './encounter-geometry.mjs';
import {
  createPursuitActorState,
  createPursuitController,
  pursuitContactProtected,
  PURSUIT_FORMAT_V2,
  WORLD_VEHICLE_MODELS,
} from './world-pursuit.mjs';

export const ENCOUNTER_FORMAT = 'FPVEncounterDefinition.v1';
export const ENCOUNTER_STATE = 'FPVEncounterState.v1';
export const ENCOUNTER_FORMAT_V2 = 'FPVEncounterDefinition.v2';
export const ENCOUNTER_STATE_V2 = 'FPVEncounterState.v2';
export const ENCOUNTER_WEAPONS = Object.freeze({
  autocannon: Object.freeze({
    damage: 12,
    pellets: 1,
    interval: 5,
    magazine: 30,
    reload: 90,
    speed: 60000,
    range: 120000,
    spread: 0.007,
  }),
  scatter: Object.freeze({
    damage: 10,
    pellets: 6,
    interval: 30,
    magazine: 6,
    reload: 120,
    speed: 40000,
    range: 32000,
    spread: 0.07,
  }),
  precision: Object.freeze({
    damage: 80,
    pellets: 1,
    interval: 40,
    magazine: 5,
    reload: 125,
    speed: 120000,
    range: 180000,
    spread: 0,
  }),
  rocket: Object.freeze({
    damage: 40,
    pellets: 1,
    interval: 50,
    magazine: 2,
    reload: 150,
    speed: 25000,
    range: 100000,
    spread: 0,
    blast: 60,
    blastRadius: 4000,
  }),
});
export function normalizeEncounterConfig(options = {}) {
  const activity = ['continuous', 'hunting', 'elimination', 'strike', 'survival'].includes(
    options.activity,
  )
    ? options.activity
    : 'continuous';
  const loadout = Array.isArray(options.loadout)
    ? options.loadout.filter((id) => Object.hasOwn(ENCOUNTER_WEAPONS, id))
    : [];
  const first = loadout[0] ?? 'autocannon',
    second = loadout.find((id) => id !== first) ?? (first === 'scatter' ? 'precision' : 'scatter');
  return {
    activity,
    difficulty: Object.hasOwn(POLICIES, options.difficulty) ? options.difficulty : 'normal',
    population: (activity === 'survival' ? [64, 96, 128] : [6, 12, 20]).includes(options.population)
      ? options.population
      : activity === 'survival'
        ? 96
        : 12,
    survivalMode: options.survivalMode === 'endless' ? 'endless' : 'timed',
    loadout: [first, second],
    payload: ['bomb', 'remote', 'drone'].includes(options.payload) ? options.payload : 'bomb',
    ammoPreset: ['balanced', 'arcade', 'tactical'].includes(options.ammoPreset)
      ? options.ammoPreset
      : 'balanced',
    playerDamage: options.playerDamage === 'invulnerable' ? 'invulnerable' : 'normal',
    enemyDamage: options.enemyDamage === 'one-hit' ? 'one-hit' : 'normal',
  };
}
const militaryArchetype = (a) =>
  a.appearance?.archetype ??
  (humanoid(a)
    ? 'military-trooper'
    : a.type === 'hazard'
      ? 'interceptor-uav'
      : a.type === 'drone'
        ? 'military-uav'
        : a.type === 'prop'
          ? a.speed
            ? [...String(a.id ?? '')].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 2
              ? 'explosive-rover'
              : 'tracked-robot'
            : 'supply-container'
          : (a.vehicleModel ?? 'field-utility'));
export const resolveMilitaryEncounterActor = (a) => ({
  ...a,
  role: 'hostile',
  appearance: {
    family: a.family,
    cast: ['tactical', 'rivals', 'arcade'].includes(a.appearance?.cast)
      ? a.appearance.cast
      : 'tactical',
    archetype: militaryArchetype(a),
  },
});
export const ENCOUNTER_RULES = Object.freeze({
  hz: 50,
  actors: 20,
  projectiles: 64,
  remains: 1024,
  huntTicks: 9000,
  replacementTicks: 50,
  breakTicks: 250,
  hurtBreakTicks: 500,
  impactCooldown: 13,
  pulseDamage: 25,
  fireCooldown: 8,
});
const AXES = ['x', 'y', 'z'];
const TYPES = ['patrol', 'sentry', 'vehicle', 'drone', 'hazard', 'prop'];
const FAMILIES = [
  'lookout',
  'patroller',
  'runner',
  'sprinter',
  'refuge-seeker',
  'switchback',
  'rendezvous-pair',
  'courier',
  'shield-bearer',
  'brace-trooper',
];
const MATERIALS = ['organic', 'metal', 'wood', 'electronic', 'glass'];
const POLICIES = {
  easy: { attackers: 2, incoming: 0.5, self: 0 },
  normal: { attackers: 3, incoming: 1, self: 0.1 },
  hard: { attackers: 4, incoming: 1.5, self: 0.25 },
};
const clone = (v) => structuredClone(v);
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const zero = () => ({ x: 0, y: 0, z: 0 });
const subtract = (a, b) => Object.fromEntries(AXES.map((k) => [k, a[k] - b[k]]));
const length = (v) => Math.hypot(v.x, v.y, v.z);
const distance = (a, b) => length(subtract(a, b));
const unit = (v) => {
  const n = length(v);
  return n ? Object.fromEntries(AXES.map((k) => [k, v[k] / n])) : { x: 0, y: 0, z: 1 };
};
const dot = (a, b) => AXES.reduce((n, k) => n + a[k] * b[k], 0);
const add = (a, b, factor = 1) =>
  Object.fromEntries(AXES.map((k) => [k, Math.round(a[k] + b[k] * factor)]));
const mix = (a, b, t) => add(a, subtract(b, a), t);
const within = (p, box) => AXES.every((k) => p[k] >= box.min[k] && p[k] <= box.max[k]);
const ground = (a) => ['patrol', 'sentry', 'vehicle', 'prop'].includes(a.type);
const humanoid = (a) => ['patrol', 'sentry'].includes(a.type);
const lift = (a) => (humanoid(a) ? a.height / 2 : a.radius);
const centre = (a) => ({ ...a.position, y: a.position.y + lift(a) });
const slotId = (i) => `encounter-slot-${String(i + 1).padStart(2, '0')}`;
const seedStep = (value) => {
  let n = value >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return n >>> 0;
};
function vector(v, label = 'Encounter position') {
  exactKeys(v, AXES, label);
  required(
    AXES.every((k) => integer(v[k], -1000000000, 1000000000)),
    `${label} must use integer millimetres`,
  );
}
function box(v) {
  exactKeys(v, ['min', 'max'], 'Encounter bounds');
  vector(v.min);
  vector(v.max);
  required(
    AXES.every((k) => v.min[k] < v.max[k]),
    'Empty encounter bounds',
  );
}
function normalizeActor(v, index = 0) {
  const type = v.type ?? 'patrol',
    radius =
      v.radius ??
      {
        patrol: 350,
        sentry: 350,
        vehicle: 900,
        drone: 450,
        hazard: 600,
        prop: 450,
      }[type];
  const family = v.family ?? v.appearance?.family ?? (v.speed ? 'patroller' : 'lookout');
  return {
    id: v.id ?? `target-${index + 1}`,
    type,
    role: v.role ?? 'hostile',
    position: clone(v.position),
    path: clone(v.path ?? []),
    speed: v.speed ?? 1200,
    radius,
    height: v.height ?? (humanoid({ type }) ? 1800 : radius * 2),
    health: v.health ?? (type === 'vehicle' ? 100 : 50),
    fireEveryTicks: v.fireEveryTicks ?? (['hazard', 'prop'].includes(type) ? 0 : 100),
    damage: v.damage ?? 10,
    projectileSpeed: v.projectileSpeed ?? 8000,
    range: v.range ?? 20000,
    family,
    material:
      v.material ?? (humanoid({ type }) ? 'organic' : type === 'drone' ? 'electronic' : 'metal'),
    appearance: { family, cast: v.appearance?.cast ?? 'authored' },
    destructible: v.destructible ?? true,
    ...(ground({ type }) ? { groundMotion: 'support-v1' } : {}),
    ...(v.vehicleModel ? { vehicleModel: v.vehicleModel } : {}),
    ...(v.spawnZone ? { spawnZone: clone(v.spawnZone) } : {}),
  };
}
export function validateEncounterDefinition(source) {
  const v = boundedJSON(source, {
    maxBytes: 1048576,
    maxNodes: 64000,
    maxArray: 256,
    maxDepth: 12,
    maxString: 512,
  });
  const v2 = v.format === ENCOUNTER_FORMAT_V2;
  exactKeys(
    v,
    [
      ...(v2
        ? [
            'survivalMode',
            'loadout',
            'payload',
            'ammoPreset',
            'playerDamage',
            'enemyDamage',
            'servicePad',
            'crowdModel',
          ]
        : []),
      'format',
      'revision',
      'baseIdentity',
      'activity',
      'difficulty',
      'population',
      'seed',
      'bounds',
      'spawn',
      'actors',
    ],
    'Encounter definition',
  );
  required(
    (v.format === ENCOUNTER_FORMAT && v.revision === 'r1') || (v2 && v.revision === 'r2'),
    'Unsupported encounter definition',
  );
  required(
    typeof v.baseIdentity === 'string' && v.baseIdentity.length > 0 && v.baseIdentity.length <= 256,
    'Encounter base identity required',
  );
  required(
    (v2
      ? ['continuous', 'hunting', 'elimination', 'strike', 'survival']
      : ['continuous', 'hunting', 'elimination']
    ).includes(v.activity) &&
      Object.hasOwn(POLICIES, v.difficulty) &&
      (v2 && v.activity === 'survival' ? [64, 96, 128] : [6, 12, 20]).includes(v.population),
    'Unsupported encounter activity, difficulty or population',
  );
  if (v2) {
    required(
      v.crowdModel === undefined || v.crowdModel === 'squad-lanes-v1',
      'Unsupported crowd model',
    );
    const config = normalizeEncounterConfig(v);
    for (const key of Object.keys(config))
      required(JSON.stringify(v[key]) === JSON.stringify(config[key]), `Invalid encounter ${key}`);
  }
  required(integer(v.seed, 1, 0xffffffff), 'Encounter seed must be nonzero uint32');
  box(v.bounds);
  vector(v.spawn);
  required(within(v.spawn, v.bounds), 'Encounter spawn outside bounds');
  if (v2 && v.servicePad != null) {
    vector(v.servicePad);
    required(within(v.servicePad, v.bounds), 'Service pad outside encounter bounds');
  }
  if (v2 && v.ammoPreset === 'tactical')
    required(
      v.servicePad != null,
      'Tactical ammunition needs a supported, reachable service pad. Choose another starting area or ammunition preset.',
    );
  required(
    Array.isArray(v.actors) &&
      v.actors.length > 0 &&
      v.actors.length <= (v2 ? 128 : ENCOUNTER_RULES.actors),
    'No admitted encounter targets or actor budget exceeded',
  );
  const ids = new Set();
  for (const a of v.actors) {
    exactKeys(
      a,
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
        'family',
        'material',
        'appearance',
        'destructible',
        'groundMotion',
        'vehicleModel',
        'spawnZone',
      ],
      'Encounter actor',
    );
    required(
      stableId(a.id) && !ids.has(a.id) && TYPES.includes(a.type),
      'Unique supported encounter actor required',
    );
    ids.add(a.id);
    required(
      (v2 ? ['hostile'] : ['hostile', 'rival', 'civilian']).includes(a.role) &&
        FAMILIES.includes(a.family) &&
        MATERIALS.includes(a.material) &&
        a.destructible === true,
      'Invalid encounter appearance or capabilities',
    );
    exactKeys(
      a.appearance,
      v2 ? ['family', 'cast', 'archetype'] : ['family', 'cast'],
      'Encounter appearance',
    );
    if (v2)
      required(
        ['tactical', 'rivals', 'arcade'].includes(a.appearance.cast) &&
          [
            'military-trooper',
            'interceptor-uav',
            'military-uav',
            'tracked-robot',
            'explosive-rover',
            'supply-container',
            ...WORLD_VEHICLE_MODELS,
          ].includes(a.appearance.archetype),
        'Military appearance required',
      );
    required(
      a.appearance.family === a.family &&
        typeof a.appearance.cast === 'string' &&
        a.appearance.cast.length <= 64,
      'Invalid encounter appearance',
    );
    required(
      a.groundMotion === undefined || a.groundMotion === 'support-v1',
      'Unsupported ground motion',
    );
    required(
      a.vehicleModel === undefined ||
        (a.type === 'vehicle' && WORLD_VEHICLE_MODELS.includes(a.vehicleModel)),
      'Invalid vehicle appearance model',
    );
    for (const [key, min, max] of [
      ['speed', 0, 15000],
      ['radius', 100, 2000],
      ['height', 200, 5000],
      ['health', 1, 1000],
      ['fireEveryTicks', 0, 5000],
      ['damage', 0, 1000],
      ['projectileSpeed', 1000, 60000],
      ['range', 100, 100000],
    ])
      required(integer(a[key], min, max), `Invalid encounter ${key}`);
    required(!humanoid(a) || a.height >= a.radius * 2, 'Invalid humanoid height');
    required(Array.isArray(a.path) && a.path.length <= 64, 'Encounter route budget exceeded');
    if (a.spawnZone) box(a.spawnZone);
    for (const p of [a.position, ...a.path]) {
      vector(p);
      required(
        within(p, v.bounds) && (!a.spawnZone || within(p, a.spawnZone)),
        'Encounter route outside bounds',
      );
    }
  }
  required(
    v.actors.slice(0, v.population).some((a) => a.destructible && a.type !== 'prop'),
    'Encounter requires destructible targets in active population',
  );
  if (v2 && v.activity === 'survival') {
    const final = v.actors.find((a) => ['vehicle', 'drone', 'hazard'].includes(a.type));
    required(
      final && v.actors.some((a) => a !== final && a.type !== 'prop'),
      'Survival needs a validated final enemy and a separate ordinary target',
    );
  }
  return v;
}
export function encounterPhysicsCourse(course) {
  return {
    format: 'FlightCourse.v2',
    id: course.id,
    revision: course.revision ?? 'r1',
    environment: course.environment ?? 'encounter',
    world: clone(
      course.world ?? {
        id: course.environment ?? 'encounter',
        theme: 'academy',
        style: 'meadow',
      },
    ),
    locales: clone(course.locales),
    spawn: clone(course.spawn),
    bounds: clone(course.bounds),
    obstacles: clone(course.obstacles ?? []),
    actors: [],
    steps: {
      'self-level': [{ type: 'survive', ticks: 36000 }],
      acro: [{ type: 'survive', ticks: 36000 }],
    },
    rules: { seed: 1, maxTicks: 36000, collisionDamage: 0 },
    conditions: clone(course.conditions ?? { profile: 'clear', revision: 'r1' }),
  };
}
/** Admission uses native collision/support; visible scenery alone is never treated as solid. */
export function createNativeEncounterGeometry(course) {
  const collision = createWorldCollision(encounterPhysicsCourse(course)),
    movers = new Set();
  let serial = 0;
  const serviceSurface = (point) => {
    const support = collision.support(
      { ...point, y: Math.max(point.y, course.spawn.y) + 200 },
      100,
      4000000,
    );
    return support ? { position: { ...point, y: support.y }, normal: unit(support.normal) } : null;
  };
  return {
    admitServicePad(position = course.spawn, { exact = false } = {}) {
      return admitEncounterServicePad(position, {
        bounds: course.bounds,
        launch: course.spawn,
        surface: serviceSurface,
        sweepStatic: (from, to, radius) => collision.castStatic(from, subtract(to, from), radius),
        exact,
      });
    },
    sweepStatic(from, to, radius = 25) {
      return collision.castStatic
        ? collision.castStatic(from, subtract(to, from), radius)
        : collision.castPulse(from, to, []);
    },
    visible: (from, to) => collision.visible(from, to),
    surface(p, radius = 350) {
      const support = collision.support({ ...p, y: p.y + 500 }, radius, 20000);
      return support ? { position: { ...p, y: support.y }, normal: unit(support.normal) } : null;
    },
    moveActor(source, delta) {
      const actor = { ...source, id: source.slotId ?? source.id };
      if (!movers.has(actor.id)) {
        required(movers.size < 128, 'Encounter motion proxy budget exceeded');
        collision.addActor(actor, 'support-v1');
        movers.add(actor.id);
      }
      collision.placeActor(actor);
      if (ground(actor)) return collision.moveGroundActor(actor, delta);
      const to = add(actor.position, delta),
        hit = collision.castStatic(centre(actor), delta, actor.radius);
      return { position: hit ? clone(actor.position) : to, blocked: !!hit };
    },
    admitActor(
      source,
      { requireAttackPosition = false, attackRange = Infinity, attackRadius = 1 } = {},
    ) {
      const actor = clone(source),
        originalId = actor.id;
      actor.id = `probe-${++serial}`;
      const points = [clone(actor.position), ...clone(actor.path)];
      if (ground(actor))
        for (const p of points) {
          const support = collision.support(
            { ...p, y: Math.min(course.bounds.max.y - 100, p.y + 10000) },
            actor.radius,
            20000,
          );
          if (!support || support.normal.y < 866025) return null;
          p.y = support.y + 12;
        }
      actor.position = clone(points[0]);
      collision.addActor(actor, 'support-v1');
      try {
        const route = [...points, ...(points.length > 2 ? [points[1]] : [])];
        for (let i = 0; i < route.length; i++) {
          const from = route[Math.max(0, i - 1)],
            to = route[i],
            size = distance(from, to);
          if (
            size > 20000 ||
            (ground(actor) &&
              Math.abs(to.y - from.y) > Math.hypot(to.x - from.x, to.z - from.z) * 0.57735 + 200)
          )
            return null;
          for (let n = 0, count = Math.max(1, Math.ceil(size / 100)); n <= count; n++) {
            actor.position = mix(from, to, n / count);
            collision.placeActor(actor);
            if (!collision.clearActorSpawn(actor)) return null;
            if (ground(actor)) {
              const support = collision.support(actor.position, actor.radius, 220);
              if (
                !support ||
                support.normal.y < 866025 ||
                Math.abs(support.y - actor.position.y) > 220
              )
                return null;
            }
          }
        }
        if (requireAttackPosition) {
          const launchCentre = { ...course.spawn, y: course.spawn.y + 220 };
          if (
            !points.some((position) => {
              const target = centre({ ...actor, position });
              return (
                distance(launchCentre, target) <= attackRange &&
                !collision.castStatic(launchCentre, subtract(target, launchCentre), attackRadius)
              );
            })
          )
            return null;
        }
        return {
          ...source,
          id: originalId,
          position: points[0],
          path: points.slice(1),
        };
      } finally {
        collision.removeActor(actor.id);
      }
    },
    dispose: () => collision.dispose(),
  };
}
/** A single equipped weapon must satisfy both range and projectile clearance. */
export function encounterAttackAdmission(loadout) {
  required(
    Array.isArray(loadout) &&
      loadout.length === 2 &&
      loadout.every((id) => Object.hasOwn(ENCOUNTER_WEAPONS, id)),
    'Invalid admission loadout',
  );
  const longest = [...loadout].sort(
    (a, b) => ENCOUNTER_WEAPONS[b].range - ENCOUNTER_WEAPONS[a].range,
  )[0];
  return {
    requireAttackPosition: true,
    attackRange: ENCOUNTER_WEAPONS[longest].range,
    attackRadius: longest === 'rocket' ? 100 : 25,
  };
}

export function createEncounterDefinition({
  course,
  baseIdentity = dataIdentity(course),
  activity = 'continuous',
  difficulty = 'normal',
  population = 12,
  seed = 1,
  admitActor,
  admitServicePad,
  spawnZones = [],
  version = 1,
  ...options
}) {
  const v2 = version === 2;
  const config = normalizeEncounterConfig({ ...options, activity, difficulty, population });
  if (v2) ({ activity, difficulty, population } = config);
  required(course?.bounds && course?.spawn, 'Encounter requires world bounds and spawn');
  // New attempts transfer every authored actor to encounter ownership before
  // adding procedural opponents. Recovery retains its immutable definition.
  if (v2 && (course.actors?.length ?? 0) > population) {
    const minimum = (activity === 'survival' ? [64, 96, 128] : [6, 12, 20]).find(
      (count) => count >= course.actors.length,
    );
    required(
      minimum,
      'The authored actor roster exceeds this activity’s supported population. Reduce it in Studio or choose Survival.',
    );
    population = config.population = minimum;
  }
  const owned = admitActor ? null : createNativeEncounterGeometry(course),
    admit = admitActor ?? owned.admitActor,
    actors = [],
    ids = new Set();
  const accept = (candidate, authored = false) => {
    if (actors.length >= population) return false;
    if (
      v2 &&
      activity === 'survival' &&
      !authored &&
      candidate.type === 'vehicle' &&
      actors.filter((a) => a.type === 'vehicle').length >= 4
    )
      return false;
    const normalized = normalizeActor({ ...candidate, destructible: true }, actors.length);
    if (
      v2 &&
      activity === 'survival' &&
      ['shield-bearer', 'brace-trooper', 'courier', 'rendezvous-pair'].includes(
        normalized.family,
      ) &&
      actors.filter((a) =>
        ['shield-bearer', 'brace-trooper', 'courier', 'rendezvous-pair'].includes(a.family),
      ).length >= 8
    )
      normalized.family = normalized.appearance.family = 'patroller';
    if (ids.has(normalized.id)) return false;
    const admitted = admit(
      clone(normalized),
      v2 ? encounterAttackAdmission(config.loadout) : undefined,
    );
    if (!admitted) return false;
    const normalizedActor = normalizeActor(admitted, actors.length);
    const actor = v2
      ? resolveMilitaryEncounterActor({
          ...normalizedActor,
          appearance: {
            ...normalizedActor.appearance,
            ...(admitted.appearance?.archetype ? { archetype: admitted.appearance.archetype } : {}),
          },
        })
      : normalizedActor;
    if (
      ![actor.position, ...actor.path].every((p) => within(p, course.bounds)) ||
      distance(actor.position, course.spawn) < actor.radius + 3500 ||
      actors.some(
        (other) => distance(centre(actor), centre(other)) < actor.radius + other.radius + 800,
      )
    )
      return false;
    actors.push(actor);
    ids.add(actor.id);
    return true;
  };
  const acceptAuthored = (candidate) => {
    if (accept(candidate, true) || !v2) return;
    // An unsupported decorative patrol path must not leave an invulnerable
    // original behind. Prefer its supported location, then a bounded nearby
    // route/position that passes the same full geometry and reachability check.
    if (accept({ ...candidate, path: [], speed: 0 }, true)) return;
    let salt = seed >>> 0;
    for (const character of String(candidate.id)) salt = seedStep(salt ^ character.charCodeAt(0));
    for (let attempt = 0; attempt < 96; attempt++) {
      const source = attempt < 16 ? candidate.position : course.spawn,
        angle = attempt * 2.399963229728653 + (salt / 4294967296) * Math.PI * 2,
        range = 4000 + Math.floor(attempt / 8) * 1800,
        position = {
          x: Math.round(source.x + Math.cos(angle) * range),
          y: candidate.position.y,
          z: Math.round(source.z + Math.sin(angle) * range),
        };
      if (!within(position, course.bounds)) continue;
      const end = { ...position, x: position.x + 1600, z: position.z + 800 },
        route = { ...candidate, position, path: [clone(position), end] };
      if (
        (within(end, course.bounds) && accept(route, true)) ||
        accept({ ...route, path: [], speed: 0 }, true)
      )
        return;
    }
    throw new Error(
      `No admitted position for authored actor ${candidate.id}. Its route or placement is blocked; adjust the encounter in Studio.`,
    );
  };
  try {
    for (const original of course.actors ?? []) {
      const policy = course.pursuit?.actors.find((row) => row.id === original.id);
      if (!policy) {
        acceptAuthored(original);
        continue;
      }
      const nodes = new Map(course.pursuit.nodes.map((node) => [node.id, node.position])),
        neighbors = new Map([...nodes.keys()].map((id) => [id, []]));
      for (const edge of course.pursuit.edges) {
        neighbors.get(edge.from).push(edge.to);
        neighbors.get(edge.to).push(edge.from);
      }
      const route = [policy.start];
      for (const goal of [...policy.goals, policy.start]) {
        const pending = [[route.at(-1)]],
          seen = new Set();
        let found;
        for (const candidate of pending) {
          const last = candidate.at(-1);
          if (last === goal) {
            found = candidate;
            break;
          }
          if (seen.has(last)) continue;
          seen.add(last);
          for (const next of neighbors.get(last))
            if (!seen.has(next)) pending.push([...candidate, next]);
        }
        if (found) route.push(...found.slice(1));
      }
      acceptAuthored({
        ...original,
        family: policy.family,
        path: route.slice(0, 64).map((id) => nodes.get(id)),
        speed: 1500,
      });
    }
    let rng = seed >>> 0;
    const next = () => {
      rng = seedStep(rng);
      return rng / 4294967296;
    };
    const types =
      v2 && activity === 'survival'
        ? ['patrol', 'patrol', 'drone', 'patrol', 'prop', 'patrol', 'hazard', 'vehicle']
        : ['patrol', 'drone', 'patrol', 'vehicle', 'hazard', 'prop'];
    for (let index = 0; index < (v2 ? 1800 : 180) && actors.length < population; index++) {
      const zone = spawnZones.length ? spawnZones[index % spawnZones.length] : course.bounds;
      box(zone);
      const type = types[index % types.length],
        radius = type === 'vehicle' ? 900 : type === 'hazard' ? 600 : 350;
      const position = {
        x: 0,
        y: ground({ type })
          ? zone.min.y
          : Math.min(zone.max.y - 1500, Math.max(zone.min.y + 2500, course.spawn.y + 2500)),
        z: 0,
      };
      for (const k of ['x', 'z']) {
        const low = Math.max(zone.min[k] + radius, course.spawn[k] - 28000),
          high = Math.min(zone.max[k] - radius, course.spawn[k] + 28000);
        position[k] = Math.round(low + next() * Math.max(0, high - low));
      }
      const to = clone(position);
      for (const k of ['x', 'z'])
        to[k] = Math.round(
          Math.max(
            zone.min[k] + radius,
            Math.min(
              zone.max[k] - radius,
              position[k] + (next() < 0.5 ? -1 : 1) * (k === 'x' ? 4000 : 2000),
            ),
          ),
        );
      accept({
        id: `encounter-target-${index + 1}`,
        type,
        position,
        path: [clone(position), to],
        speed: type === 'prop' ? 600 : 1000 + Math.floor(next() * 800),
        family: FAMILIES[index % FAMILIES.length],
        ...(spawnZones.length ? { spawnZone: zone } : {}),
      });
    }
    if (v2 && activity === 'survival') {
      const boss = actors.findIndex((a) => ['vehicle', 'drone', 'hazard'].includes(a.type));
      required(boss >= 0, 'Survival needs a validated military vehicle or UAV entry');
      actors.push(...actors.splice(boss, 1));
    }
    return validateEncounterDefinition({
      ...(v2
        ? {
            ...config,
            crowdModel: 'squad-lanes-v1',
            servicePad: (admitServicePad ?? owned?.admitServicePad)?.(course.spawn) ?? null,
          }
        : {}),
      format: v2 ? ENCOUNTER_FORMAT_V2 : ENCOUNTER_FORMAT,
      revision: v2 ? 'r2' : 'r1',
      baseIdentity,
      activity,
      difficulty,
      population,
      seed,
      bounds: clone(course.bounds),
      spawn: clone(course.spawn),
      actors,
    });
  } finally {
    owned?.dispose();
  }
}
function sweptSphere(a, b, radius, actor, from = actor.position, to = actor.position) {
  const start = { ...from, y: from.y + lift(actor) },
    end = { ...to, y: to.y + lift(actor) };
  const half = humanoid(actor) ? Math.max(0, actor.height / 2 - actor.radius) : 0;
  const relative = subtract(a, start),
    delta = subtract(subtract(b, a), subtract(end, start)),
    size = radius + actor.radius;
  const candidates = [],
    closest = { x: 0, y: Math.max(-half, Math.min(half, relative.y)), z: 0 };
  if (distance(relative, closest) <= size) candidates.push(0);
  const roots = (aa, bb, cc) =>
    aa > 0 && bb * bb >= 4 * aa * cc
      ? [
          (-bb - Math.sqrt(bb * bb - 4 * aa * cc)) / (2 * aa),
          (-bb + Math.sqrt(bb * bb - 4 * aa * cc)) / (2 * aa),
        ]
      : [];
  for (const height of half ? [-half, half] : [0]) {
    const p = { ...relative, y: relative.y - height };
    candidates.push(...roots(dot(delta, delta), 2 * dot(p, delta), dot(p, p) - size * size));
  }
  if (half)
    for (const t of roots(
      delta.x ** 2 + delta.z ** 2,
      2 * (relative.x * delta.x + relative.z * delta.z),
      relative.x ** 2 + relative.z ** 2 - size ** 2,
    ))
      if (Math.abs(relative.y + delta.y * t) <= half) candidates.push(t);
  const toi = Math.min(...candidates.filter((t) => t >= 0 && t <= 1));
  if (!Number.isFinite(toi)) return null;
  const position = mix(a, b, toi),
    target = mix(start, end, toi);
  target.y += Math.max(-half, Math.min(half, position.y - target.y));
  return { toi, position, normal: unit(subtract(position, target)) };
}
export const encounterImpactDamage = (speed) =>
  Math.min(100, Math.max(0, Math.floor((speed - 2000) / 100)));
/** Staged simulation state is private until the host accepts its physics transaction. */
export function createEncounterRuntime(source, { geometry, runId = null } = {}) {
  if (source?.format === ENCOUNTER_FORMAT_V2)
    return createEncounterRuntimeV2(source, { geometry, runId });
  const definition = validateEncounterDefinition(source),
    identity = dataIdentity(definition),
    prototypes = definition.actors.slice(0, definition.population),
    policy = POLICIES[definition.difficulty];
  required(
    typeof geometry?.sweepStatic === 'function' && typeof geometry?.visible === 'function',
    'Encounter needs verified geometry queries',
  );
  runId ??= `encounter-${identity}`;
  required(
    typeof runId === 'string' && runId.length > 0 && runId.length <= 256,
    'Invalid encounter run ID',
  );
  let state = {
    format: ENCOUNTER_STATE,
    definitionIdentity: identity,
    runId,
    ticks: 0,
    rng: definition.seed,
    status: 'active',
    phase: 'wave',
    waitingForClearSpawn: false,
    wave: 1,
    nextWaveTick: null,
    lastDamageTick: -10000,
    health: 100,
    maxHealth: 100,
    score: 0,
    kills: 0,
    shots: 0,
    hits: 0,
    successfulImpacts: 0,
    streak: 0,
    bestStreak: 0,
    nextSpawn: 1,
    nextProjectile: 1,
    nextEvent: 1,
    cooldown: 0,
    actors: [],
    projectiles: [],
    events: [],
    contactLocks: {},
    result: null,
  };
  let pending = null,
    serial = 0,
    defeatRecords = [];
  const movementCache = new Map();
  function movementFor(actor) {
    if (!humanoid(actor) || !actor.path.length || !actor.speed) return null;
    const index = Number(actor.slotId.slice('encounter-slot-'.length)) - 1,
      prototype = prototypes[index],
      key = `${actor.slotId}:${actor.family}`;
    if (movementCache.has(key)) return movementCache.get(key);
    const points = [prototype.position, ...prototype.path].filter(
      (point, i, all) => all.findIndex((other) => distance(point, other) < 30) === i,
    );
    if (points.length < 2) return null;
    const nodes = points.map((position, i) => ({ id: `route-${i}`, position })),
      ordered = [prototype.position, ...prototype.path].map(
        (point) => nodes.find((node) => distance(point, node.position) < 30).id,
      ),
      edges = [],
      seenEdges = new Set();
    for (let i = 1; i < ordered.length; i++) {
      const from = ordered[i - 1],
        to = ordered[i],
        key = [from, to].sort().join(':');
      if (from !== to && !seenEdges.has(key)) {
        edges.push({ from, to });
        seenEdges.add(key);
      }
    }
    const policy = {
      id: actor.slotId,
      family: actor.family === 'rendezvous-pair' ? 'runner' : actor.family,
      start: nodes[0].id,
      goals: nodes.map((n) => n.id),
      pair: null,
    };
    const source = {
        format: PURSUIT_FORMAT_V2,
        nodes,
        edges,
        actors: [policy],
      },
      movement = {
        source,
        policy,
        controller: createPursuitController(source),
      };
    movementCache.set(key, movement);
    return movement;
  }
  const snapshot = ({ includeDefeats = false } = {}) => ({
    ...clone(state),
    accuracy: state.shots ? state.hits / state.shots : null,
    ...(includeDefeats ? { defeats: clone(defeatRecords) } : {}),
  });
  function emit(draft, type, actor, extra = {}) {
    const event = {
      eventId: `${runId}:${draft.nextEvent++}`,
      type,
      tick: draft.ticks + 1,
      ...(actor
        ? {
            actor: actor.id,
            spawnId: actor.id,
            slotId: actor.slotId,
            sourceId: actor.sourceId,
            position: clone(actor.position),
            normal: { x: 0, y: 1, z: 0 },
            velocity: clone(actor.velocity),
            material: actor.material,
            family:
              actor.type === 'vehicle'
                ? ({
                    'field-utility': 'utility-car',
                    'field-tank': 'tracked-tank',
                    'relay-truck': 'radar-truck',
                  }[actor.vehicleModel] ??
                  actor.vehicleModel ??
                  'utility-car')
                : actor.family,
            humanoid: humanoid(actor),
            machine:
              actor.type === 'vehicle'
                ? actor.vehicleModel === 'field-tank'
                  ? 'tracked'
                  : 'wheeled'
                : false,
            radius: actor.radius,
            height: actor.height,
            appearance: {
              ...actor.appearance,
              type: actor.type,
              ...(actor.vehicleModel ? { model: actor.vehicleModel } : {}),
            },
          }
        : {}),
      ...extra,
    };
    draft.events.push(event);
    return event;
  }
  function spawn(draft, index, initial = false) {
    const prototype = prototypes[index],
      actor = {
        ...clone(prototype),
        id: `${runId}:${draft.nextSpawn++}`,
        slotId: slotId(index),
        sourceId: prototype.id,
        position: clone(prototype.position),
        velocity: zero(),
        status: 'active',
        maxHealth: prototype.health,
        health: prototype.health,
        pathIndex: 0,
        cooldown: 50,
        warning: false,
        heading: { x: 0, y: 0, z: -1 },
        spawnTick: draft.ticks,
        defeatedTick: null,
      };
    actor.spawnId = actor.id;
    actor.blocked = false;
    if (!initial && definition.activity === 'continuous') {
      draft.rng = seedStep(draft.rng);
      if (humanoid(actor)) {
        const prior = draft.actors[index]?.family;
        const choices = FAMILIES.filter(
          (family) => family !== prior && family !== 'rendezvous-pair',
        );
        actor.family = choices[draft.rng % choices.length];
        actor.appearance.family = actor.family;
      }
      actor.speed = Math.min(15000, Math.round(prototype.speed * (0.8 + (draft.rng % 5) / 10)));
    }
    const movement = movementFor(actor);
    if (movement) actor.pursuit = createPursuitActorState(movement.policy, movement.source);
    draft.actors[index] = actor;
    if (!initial) emit(draft, 'spawn', actor);
  }
  prototypes.forEach((_, index) => spawn(state, index, true));
  const protectedHit = (draft, actor, origin) => {
    const before = state.actors.find((a) => a.id === actor.id) ?? actor;
    return before.pursuit
      ? pursuitContactProtected(before, origin)
      : !humanoid(before)
        ? false
        : before.family === 'brace-trooper'
          ? (draft.ticks - before.spawnTick) % 160 < 60
          : before.family === 'shield-bearer' &&
            dot(subtract(origin, before.position), before.heading) > 0;
  };
  function move(draft, actor, player) {
    const from = clone(actor.position);
    actor.velocity = zero();
    actor.warning = false;
    if (actor.status !== 'active' || !actor.path.length || !actor.speed) return from;
    const movement = movementFor(actor);
    if (movement) {
      const moving = { ...actor, id: actor.slotId },
        motionGeometry = {
          visible: geometry.visible,
          placeActor() {},
          moveGroundActor(body, delta) {
            const target = movement.source.nodes.find((n) => n.id === actor.pursuit.next)?.position,
              scale = Math.min(
                actor.speed / 1500,
                target && length(delta) ? distance(body.position, target) / length(delta) : 1,
              );
            const scaled = Object.fromEntries(
                AXES.map((key) => [key, Math.round(delta[key] * scale)]),
              ),
              candidate = add(body.position, scaled);
            if (geometry.moveActor) return geometry.moveActor(actor, scaled);
            const supported = geometry.surface?.(candidate, body.radius);
            if (geometry.surface && !supported) return { position: body.position, blocked: true };
            if (supported) {
              if (Math.abs(supported.position.y - candidate.y) > 220 || supported.normal.y < 0.866)
                return { position: body.position, blocked: true };
              candidate.y = Math.round(supported.position.y + 12);
            }
            const blocked = [body.radius, body.height / 2, body.height - body.radius].some(
              (height) =>
                geometry.sweepStatic(
                  { ...body.position, y: body.position.y + height },
                  { ...candidate, y: candidate.y + height },
                  body.radius,
                ),
            );
            return {
              position: blocked ? body.position : candidate,
              blocked: !!blocked,
            };
          },
        };
      const locomotion = {
        ticks: draft.ticks,
        position: player.position,
        droneRadius: player.radius ?? 220,
        actors: draft.actors.map((other) => ({ ...other, id: other.slotId })),
        events: [],
      };
      movement.controller.move(moving, locomotion, motionGeometry);
      actor.position = moving.position;
      actor.blocked = moving.blocked;
      actor.warning = ['warning', 'turning', 'notice'].includes(actor.pursuit.phase);
      actor.heading = {
        x: actor.pursuit.heading.x / 1000000,
        y: 0,
        z: actor.pursuit.heading.z / 1000000,
      };
      actor.velocity = Object.fromEntries(AXES.map((k) => [k, (actor.position[k] - from[k]) * 50]));
      return from;
    }
    let target = actor.path[actor.pathIndex],
      remaining = distance(actor.position, target);
    if (remaining < 35) {
      actor.pathIndex = (actor.pathIndex + 1) % actor.path.length;
      target = actor.path[actor.pathIndex];
      remaining = distance(actor.position, target);
    }
    let speed = actor.speed;
    const phase = (draft.ticks - actor.spawnTick) % 160;
    if (['sprinter', 'brace-trooper'].includes(actor.family)) {
      actor.warning = phase < 40;
      speed = phase < 40 ? 0 : phase < 60 ? speed * 2 : phase < 100 ? speed / 3 : speed;
    }
    if (remaining && speed) {
      const direction = unit(subtract(target, actor.position));
      actor.heading = direction;
      const to = add(actor.position, direction, Math.min(remaining, speed / 50));
      const moved = geometry.moveActor?.(actor, subtract(to, actor.position));
      if (moved) {
        actor.position = clone(moved.position);
        actor.blocked = !!moved.blocked;
      } else {
        const hit = geometry.sweepStatic(
          centre(actor),
          { ...to, y: to.y + lift(actor) },
          actor.radius,
        );
        if (!hit) actor.position = to;
      }
    }
    actor.velocity = Object.fromEntries(AXES.map((k) => [k, (actor.position[k] - from[k]) * 50]));
    return from;
  }
  function hurt(draft, actor, amount, cause, detail, origin) {
    if (actor.status !== 'active' || !actor.destructible || amount <= 0) return;
    detail = {
      ...detail,
      impactPosition: clone(detail.position ?? actor.position),
      position: clone(actor.position),
    };
    if (protectedHit(draft, actor, origin)) {
      emit(draft, 'impact', actor, {
        ...detail,
        cause,
        damage: 0,
        protected: true,
      });
      return;
    }
    actor.health = Math.max(0, actor.health - amount);
    if (cause === 'pulse') draft.hits++;
    else draft.successfulImpacts++;
    emit(draft, 'impact', actor, { ...detail, cause, damage: amount });
    if (actor.health > 0) return;
    actor.status = 'defeated';
    actor.defeatedTick = draft.ticks + 1;
    draft.kills++;
    draft.score += 100;
    draft.streak++;
    draft.bestStreak = Math.max(draft.bestStreak, draft.streak);
    const surface = geometry.surface?.(actor.position, actor.radius) ?? null,
      event = emit(draft, 'defeat', actor, {
        ...detail,
        cause,
        ...(surface ? { surface: clone(surface) } : {}),
      });
    actor.velocity = zero();
    draft.defeats.push(event);
    if (draft.defeats.length > 1024) draft.defeats.shift();
  }
  const playerHit = (draft, damage, detail = {}) => {
    if (damage > 0) {
      const acceptedDamage = Math.min(draft.health, damage);
      draft.health = Math.max(0, draft.health - damage);
      draft.lastDamageTick = draft.ticks + 1;
      draft.streak = 0;
      if (acceptedDamage)
        emit(draft, 'player-damage', null, {
          damage: acceptedDamage,
          health: draft.health,
          ...detail,
        });
    }
  };
  function fire(draft, owner, position, direction, speed, damage) {
    if (draft.projectiles.length >= 64) return false;
    draft.projectiles.push({
      id: draft.nextProjectile++,
      owner,
      position: clone(position),
      velocity: add(zero(), unit(direction), speed),
      damage,
      ttl: 150,
    });
    emit(
      draft,
      'fire',
      owner === 'player' ? null : draft.actors.find((actor) => actor.id === owner),
      { actor: owner, position: clone(position) },
    );
    return true;
  }
  function prepare({ player, input = {} }) {
    required(!pending, 'An encounter transaction is pending');
    required(state.status === 'active', 'Encounter has ended');
    vector(player.position);
    vector(player.velocity ?? zero());
    required(
      player.radius === undefined || integer(player.radius, 10, 3000),
      'Invalid player radius',
    );
    if (input.nose !== undefined)
      required(
        AXES.every((k) => Number.isFinite(input.nose[k])) && length(input.nose) > 0,
        'Invalid firing direction',
      );
    const draft = clone(state);
    draft.events = [];
    draft.defeats = [];
    if (draft.phase === 'intermission' && draft.ticks >= draft.nextWaveTick) {
      draft.waitingForClearSpawn = prototypes.some(
        (actor) =>
          distance(actor.position, player.position) < actor.radius + (player.radius ?? 220) + 1000,
      );
      if (draft.waitingForClearSpawn) draft.nextWaveTick = draft.ticks + 1;
      else {
        draft.wave++;
        draft.phase = 'wave';
        draft.nextWaveTick = null;
        prototypes.forEach((_, index) => spawn(draft, index));
        emit(draft, 'wave', null, { wave: draft.wave });
      }
    }
    if (definition.activity === 'hunting')
      for (let i = 0; i < draft.actors.length; i++) {
        const a = draft.actors[i];
        if (
          a.status === 'defeated' &&
          draft.ticks - a.defeatedTick >= 50 &&
          distance(prototypes[i].position, player.position) >
            a.radius + (player.radius ?? 220) + 1000 &&
          draft.actors.every(
            (other, index) =>
              index === i ||
              other.status !== 'active' ||
              distance(prototypes[i].position, other.position) > a.radius + other.radius + 300,
          )
        )
          spawn(draft, i);
      }
    const motions = draft.actors.map((actor) => {
      const from = move(draft, actor, player);
      return {
        id: actor.slotId,
        actorId: actor.id,
        from,
        to: clone(actor.position),
        enabled: actor.status === 'active',
      };
    });
    pending = {
      transaction: ++serial,
      draft,
      before: clone(player),
      input: clone(input),
      motions,
    };
    return {
      transaction: pending.transaction,
      motions: clone(motions),
      actors: clone(draft.actors),
    };
  }
  function commit({ transaction, accepted = true, player, trace = null, contacts = [] }) {
    required(pending && transaction === pending.transaction, 'Unknown encounter transaction');
    if (!accepted) {
      pending = null;
      return snapshot();
    }
    const { draft, before, input, motions } = pending;
    vector(player.position);
    vector(player.velocity ?? zero());
    required(
      player.radius === undefined || integer(player.radius, 10, 3000),
      'Invalid player radius',
    );
    required(Array.isArray(contacts) && contacts.length <= 1024, 'Invalid accepted contact budget');
    for (const contact of contacts)
      required(
        (contact.relativeNormalSpeedMmS === undefined ||
          (Number.isFinite(contact.relativeNormalSpeedMmS) &&
            contact.relativeNormalSpeedMmS >= 0)) &&
          (contact.normal === undefined || AXES.every((k) => Number.isFinite(contact.normal[k]))),
        'Invalid accepted contact',
      );
    const radius = player.radius ?? 220,
      path =
        trace?.length >= 2
          ? trace.map((p) => clone(p.position ?? p))
          : [before.position, player.position];
    path.forEach((p) => vector(p));
    const touching = new Set();
    for (const actor of draft.actors) {
      if (actor.status !== 'active') continue;
      const motion = motions.find((m) => m.id === actor.slotId);
      let hit = null;
      for (let i = 1; i < path.length && !hit; i++)
        hit = sweptSphere(
          { ...path[i - 1], y: path[i - 1].y + radius },
          { ...path[i], y: path[i].y + radius },
          radius,
          actor,
          mix(motion.from, motion.to, (i - 1) / (path.length - 1)),
          mix(motion.from, motion.to, i / (path.length - 1)),
        );
      const explicit = contacts.find((c) => [actor.id, actor.slotId].includes(c.actorId ?? c.id));
      if (explicit)
        hit = {
          position: clone(actor.position),
          ...hit,
          normal: unit(explicit.normal ?? hit?.normal ?? subtract(before.position, actor.position)),
        };
      if (!hit) continue;
      touching.add(actor.id);
      const lock = draft.contactLocks[actor.id];
      if (lock && (!lock.separated || draft.ticks - lock.tick < 13)) continue;
      const speed =
          explicit?.relativeNormalSpeedMmS ??
          Math.max(0, -dot(subtract(before.velocity ?? zero(), actor.velocity), hit.normal)),
        damage = encounterImpactDamage(speed);
      if (damage > 0) {
        hurt(
          draft,
          actor,
          damage,
          'impact',
          { normal: hit.normal, position: hit.position, velocity: add(zero(), hit.normal, -speed) },
          before.position,
        );
        playerHit(draft, Math.floor(damage * policy.self), {
          cause: 'impact',
          position: clone(player.position),
          normal: clone(hit.normal),
          sourceId: actor.sourceId,
        });
        draft.contactLocks[actor.id] = { tick: draft.ticks, separated: false };
      }
    }
    const lives = new Set(draft.actors.map((a) => a.id));
    for (const [id, lock] of Object.entries(draft.contactLocks)) {
      if (!lives.has(id)) delete draft.contactLocks[id];
      else if (!touching.has(id)) lock.separated = true;
    }
    const playerCentre = { ...player.position, y: player.position.y + radius };
    if (draft.cooldown > 0) draft.cooldown--;
    if ((input.fire || input.actions & 1) && draft.cooldown === 0) {
      if (fire(draft, 'player', playerCentre, input.nose ?? { x: 0, y: 0, z: -1 }, 20000, 25))
        draft.shots++;
      draft.cooldown = 8;
    }
    const attackers =
      definition.activity === 'hunting'
        ? []
        : draft.actors
            .filter(
              (a) =>
                a.status === 'active' &&
                a.role === 'hostile' &&
                a.fireEveryTicks > 0 &&
                distance(centre(a), playerCentre) <= a.range &&
                geometry.visible(centre(a), playerCentre),
            )
            .sort(
              (a, b) =>
                distance(centre(a), playerCentre) - distance(centre(b), playerCentre) ||
                a.slotId.localeCompare(b.slotId),
            )
            .slice(0, policy.attackers);
    for (const actor of attackers) {
      actor.cooldown = Math.max(0, actor.cooldown - 1);
      actor.warning ||= actor.cooldown <= 40;
      if (!actor.cooldown) {
        fire(
          draft,
          actor.id,
          centre(actor),
          subtract(playerCentre, centre(actor)),
          actor.projectileSpeed,
          Math.round(actor.damage * policy.incoming),
        );
        actor.cooldown = Math.max(50, actor.fireEveryTicks);
      }
    }
    const survivors = [];
    for (const pulse of draft.projectiles) {
      const next = add(pulse.position, pulse.velocity, 0.02),
        wall = geometry.sweepStatic(pulse.position, next, 25);
      let best = wall ? { ...wall, actor: null } : null;
      if (pulse.owner === 'player')
        for (const actor of draft.actors) {
          if (actor.status !== 'active') continue;
          const motion = motions.find((m) => m.id === actor.slotId),
            hit = sweptSphere(pulse.position, next, 25, actor, motion.from, motion.to);
          if (hit && (!best || hit.toi < best.toi)) best = { ...hit, actor };
        }
      else {
        const body = {
            position: player.position,
            type: 'drone',
            radius,
            height: radius * 2,
          },
          hit = sweptSphere(pulse.position, next, 25, body, before.position, player.position);
        if (hit && (!best || hit.toi < best.toi)) best = { ...hit, player: true };
        for (const actor of draft.actors) {
          if (actor.status !== 'active' || actor.id === pulse.owner) continue;
          const motion = motions.find((m) => m.id === actor.slotId),
            cover = sweptSphere(pulse.position, next, 25, actor, motion.from, motion.to);
          if (cover && (!best || cover.toi < best.toi)) best = { ...cover, cover: true };
        }
      }
      if (best?.actor)
        hurt(
          draft,
          best.actor,
          pulse.damage,
          'pulse',
          { normal: best.normal, position: best.position, velocity: clone(pulse.velocity) },
          pulse.position,
        );
      else if (best?.player)
        playerHit(draft, pulse.damage, {
          cause: 'pulse',
          position: clone(best.position),
          normal: clone(best.normal),
          sourceId: pulse.owner,
        });
      else if (!best && --pulse.ttl > 0 && within(next, definition.bounds))
        survivors.push({ ...pulse, position: next });
    }
    draft.projectiles = survivors;
    draft.ticks++;
    if (draft.health <= 0) {
      draft.status = 'failed';
      draft.result = {
        reason: 'player-defeated',
        tick: draft.ticks,
        kills: draft.kills,
        score: draft.score,
      };
    } else if (definition.activity === 'hunting' && draft.ticks >= 9000) {
      draft.status = 'complete';
      draft.result = {
        reason: 'time-complete',
        tick: draft.ticks,
        kills: draft.kills,
        score: draft.score,
      };
    } else if (
      draft.phase === 'wave' &&
      draft.actors.every((a) => a.status === 'defeated' || !a.destructible || a.type === 'prop')
    ) {
      if (definition.activity === 'elimination') {
        draft.status = 'complete';
        draft.result = {
          reason: 'targets-cleared',
          tick: draft.ticks,
          kills: draft.kills,
          score: draft.score,
        };
      } else if (definition.activity === 'continuous') {
        draft.phase = 'intermission';
        draft.nextWaveTick = draft.ticks + (draft.ticks - draft.lastDamageTick <= 250 ? 500 : 250);
      }
    }
    if (draft.result)
      emit(draft, 'result', null, {
        tick: draft.ticks,
        result: clone(draft.result),
      });
    if (draft.defeats.length) defeatRecords = [...defeatRecords, ...draft.defeats].slice(-1024);
    delete draft.defeats;
    state = draft;
    pending = null;
    return snapshot();
  }
  function checkpoint() {
    const saved = { ...clone(state), defeats: clone(defeatRecords) };
    return {
      format: 'FPVEncounterCheckpoint.v1',
      definition: clone(definition),
      state: saved,
      checksum: dataIdentity({ definition, state: saved }),
    };
  }
  function restore(record) {
    required(!pending, 'An encounter transaction is pending');
    const saved = boundedJSON(record, {
      maxBytes: 2097152,
      maxNodes: 200000,
      maxArray: 4096,
      maxDepth: 16,
      maxString: 1024,
    });
    exactKeys(saved, ['format', 'definition', 'state', 'checksum'], 'Encounter checkpoint');
    required(
      saved.format === 'FPVEncounterCheckpoint.v1' &&
        dataIdentity(validateEncounterDefinition(saved.definition)) === identity &&
        saved.checksum === dataIdentity({ definition: saved.definition, state: saved.state }),
      'Encounter checkpoint identity or checksum differs',
    );
    const next = saved.state;
    exactKeys(next, [...Object.keys(state), 'defeats'], 'Encounter checkpoint state');
    required(
      Object.keys(state).every((key) => Object.hasOwn(next, key)) &&
        next.format === ENCOUNTER_STATE &&
        next.definitionIdentity === identity &&
        next.runId === runId,
      'Invalid encounter checkpoint identity',
    );
    for (const key of [
      'ticks',
      'wave',
      'score',
      'kills',
      'shots',
      'hits',
      'successfulImpacts',
      'streak',
      'bestStreak',
      'nextSpawn',
      'nextProjectile',
      'nextEvent',
      'cooldown',
    ])
      required(
        integer(next[key], 0, Number.MAX_SAFE_INTEGER),
        `Invalid encounter checkpoint ${key}`,
      );
    required(
      next.ticks <= 1000000000 &&
        next.shots <= next.ticks &&
        next.kills < next.nextSpawn &&
        next.score === next.kills * 100 &&
        next.successfulImpacts <= next.ticks * 20 &&
        next.wave <= next.ticks + 1 &&
        next.nextSpawn <= prototypes.length + next.ticks * 20 + 1 &&
        next.wave >= 1 &&
        next.nextSpawn > 0 &&
        next.nextProjectile > 0 &&
        next.nextEvent > 0 &&
        next.cooldown <= 8 &&
        next.hits <= next.shots &&
        next.streak <= next.bestStreak &&
        next.bestStreak <= next.kills &&
        integer(next.rng, 1, 0xffffffff),
      'Invalid encounter checkpoint counters',
    );
    required(
      ['active', 'failed', 'complete'].includes(next.status) &&
        ['wave', 'intermission'].includes(next.phase) &&
        typeof next.waitingForClearSpawn === 'boolean' &&
        (!next.waitingForClearSpawn || next.phase === 'intermission') &&
        integer(next.health, 0, 100) &&
        next.maxHealth === 100 &&
        integer(next.lastDamageTick, -10000, next.ticks),
      'Invalid encounter checkpoint progress',
    );
    required(
      next.phase === 'intermission'
        ? integer(next.nextWaveTick, next.ticks, next.ticks + 500)
        : next.nextWaveTick === null,
      'Invalid encounter wave deadline',
    );
    required(
      Array.isArray(next.actors) &&
        next.actors.length === prototypes.length &&
        Array.isArray(next.projectiles) &&
        next.projectiles.length <= 64 &&
        Array.isArray(next.defeats) &&
        next.defeats.length <= 1024 &&
        Array.isArray(next.events) &&
        next.events.length <= 256,
      'Invalid encounter checkpoint budgets',
    );
    required(
      (next.status === 'failed') === (next.health === 0),
      'Encounter health and status differ',
    );
    required(
      next.phase !== 'intermission' || definition.activity === 'continuous',
      'Unexpected wave break',
    );
    if (next.status === 'complete')
      required(
        definition.activity === 'hunting'
          ? next.ticks === 9000 && next.result?.reason === 'time-complete'
          : definition.activity === 'elimination' &&
              next.result?.reason === 'targets-cleared' &&
              next.actors.every(
                (a) => a.type === 'prop' || !a.destructible || a.status === 'defeated',
              ),
        'Invalid encounter completion',
      );
    if (next.status === 'failed')
      required(next.result?.reason === 'player-defeated', 'Invalid defeat result');
    required(next.kills >= next.defeats.length, 'Defeat ledger exceeds accepted kills');
    const actorIds = new Set(),
      logicalId = (id) =>
        typeof id === 'string' &&
        id.startsWith(`${runId}:`) &&
        integer(Number(id.slice(runId.length + 1)), 1, next.nextSpawn - 1);
    for (const [i, actor] of next.actors.entries()) {
      exactKeys(
        actor,
        [
          ...Object.keys(prototypes[i]),
          'slotId',
          'sourceId',
          'spawnId',
          'velocity',
          'status',
          'maxHealth',
          'pathIndex',
          'cooldown',
          'warning',
          'heading',
          'spawnTick',
          'defeatedTick',
          'blocked',
          'pursuit',
        ],
        'Encounter checkpoint actor',
      );
      required(
        actor.slotId === slotId(i) &&
          actor.sourceId === prototypes[i].id &&
          logicalId(actor.id) &&
          actor.spawnId === actor.id &&
          !actorIds.has(actor.id),
        'Invalid encounter checkpoint actor identity',
      );
      actorIds.add(actor.id);
      required(
        actor.type === prototypes[i].type &&
          actor.radius === prototypes[i].radius &&
          actor.height === prototypes[i].height &&
          actor.maxHealth === prototypes[i].health &&
          integer(actor.health, 0, actor.maxHealth) &&
          ['active', 'defeated'].includes(actor.status) &&
          (actor.status === 'defeated') === (actor.health === 0),
        'Invalid encounter checkpoint actor body',
      );
      required(
        integer(actor.pathIndex, 0, Math.max(0, actor.path.length - 1)) &&
          integer(actor.cooldown, 0, 5000) &&
          integer(actor.spawnTick, 0, next.ticks) &&
          (actor.status === 'defeated'
            ? integer(actor.defeatedTick, actor.spawnTick, next.ticks)
            : actor.defeatedTick === null) &&
          typeof actor.warning === 'boolean',
        'Invalid encounter actor timeline',
      );
      vector(actor.position);
      vector(actor.velocity);
      required(within(actor.position, definition.bounds), 'Encounter actor outside bounds');
      required(
        dataIdentity(actor.path) === dataIdentity(prototypes[i].path) &&
          FAMILIES.includes(actor.family) &&
          actor.appearance.family === actor.family &&
          MATERIALS.includes(actor.material) &&
          integer(actor.speed, 0, 15000),
        'Encounter actor rules changed',
      );
      for (const key of [
        'role',
        'material',
        'destructible',
        'fireEveryTicks',
        'damage',
        'projectileSpeed',
        'range',
        'groundMotion',
        'vehicleModel',
        'spawnZone',
      ])
        required(
          JSON.stringify(actor[key]) === JSON.stringify(prototypes[i][key]),
          'Encounter actor capabilities changed',
        );
      exactKeys(actor.appearance, ['family', 'cast'], 'Encounter actor appearance');
      required(
        actor.appearance.cast === prototypes[i].appearance.cast &&
          typeof actor.blocked === 'boolean',
        'Invalid actor appearance or motion',
      );
      const movement = movementFor(actor);
      required(!!actor.pursuit === !!movement, 'Encounter movement state missing');
      if (movement) {
        const p = actor.pursuit,
          nodes = movement.source.nodes.map((n) => n.id);
        exactKeys(
          p,
          [
            'family',
            'node',
            'next',
            'goal',
            'previous',
            'phase',
            'phaseTicks',
            'decision',
            'cursor',
            'heading',
            'nextHeading',
            'delivered',
          ],
          'Encounter pursuit',
        );
        required(
          p.family === movement.policy.family &&
            nodes.includes(p.node) &&
            nodes.includes(p.goal) &&
            (p.next === null || nodes.includes(p.next)) &&
            (p.previous === null || nodes.includes(p.previous)),
          'Invalid pursuit route',
        );
        required(
          [
            'idle',
            'warning',
            'burst',
            'recovering',
            'waiting',
            'committed',
            'turning',
            'notice',
            'flee',
          ].includes(p.phase) &&
            integer(p.phaseTicks, 0, 80) &&
            integer(p.decision, 0, 40) &&
            integer(p.cursor, 0, movement.policy.goals.length - 1) &&
            integer(p.delivered, 0, next.ticks),
          'Invalid pursuit progress',
        );
        for (const h of [p.heading, p.nextHeading].filter(Boolean)) {
          exactKeys(h, ['x', 'z'], 'Pursuit heading');
          required(
            ['x', 'z'].every((k) => integer(h[k], -1001000, 1001000)),
            'Invalid pursuit heading',
          );
        }
        required(
          p.phase !== 'turning' || (p.family === 'shield-bearer' && p.nextHeading !== null),
          'Missing pursuit turn',
        );
      }
      const prototype = prototypes[i];
      if (definition.activity !== 'continuous' || next.wave === 1)
        required(
          actor.family === prototype.family && actor.speed === prototype.speed,
          'Initial encounter movement rules changed',
        );
      else
        required(
          (!humanoid(actor) || actor.family !== 'rendezvous-pair') &&
            [0.8, 0.9, 1, 1.1, 1.2].some(
              (scale) => actor.speed === Math.min(15000, Math.round(prototype.speed * scale)),
            ),
          'Invalid seeded movement variation',
        );
      exactKeys(actor.heading, AXES, 'Encounter actor heading');
      required(
        AXES.every(
          (key) => Number.isFinite(actor.heading[key]) && Math.abs(actor.heading[key]) <= 1.00001,
        ),
        'Invalid actor heading',
      );
    }
    const pulseIds = new Set();
    for (const pulse of next.projectiles) {
      exactKeys(
        pulse,
        ['id', 'owner', 'position', 'velocity', 'damage', 'ttl'],
        'Encounter projectile',
      );
      required(
        integer(pulse.id, 1, next.nextProjectile - 1) &&
          !pulseIds.has(pulse.id) &&
          (pulse.owner === 'player' || logicalId(pulse.owner)) &&
          integer(pulse.damage, 0, 1500) &&
          integer(pulse.ttl, 1, 150),
        'Invalid encounter projectile',
      );
      pulseIds.add(pulse.id);
      vector(pulse.position);
      vector(pulse.velocity);
      required(
        within(pulse.position, definition.bounds) && length(pulse.velocity) <= 60001,
        'Projectile outside admitted limits',
      );
    }
    required(
      next.contactLocks &&
        typeof next.contactLocks === 'object' &&
        !Array.isArray(next.contactLocks) &&
        Object.keys(next.contactLocks).length <= 20,
      'Invalid contact lock budget',
    );
    for (const [id, lock] of Object.entries(next.contactLocks)) {
      exactKeys(lock, ['tick', 'separated'], 'Contact lock');
      required(
        actorIds.has(id) &&
          integer(lock.tick, 0, next.ticks) &&
          typeof lock.separated === 'boolean',
        'Invalid contact lock',
      );
    }
    const eventIds = new Set();
    for (const event of next.defeats) {
      exactKeys(
        event,
        [
          'eventId',
          'type',
          'tick',
          'actor',
          'spawnId',
          'slotId',
          'sourceId',
          'position',
          'normal',
          'velocity',
          'material',
          'family',
          'humanoid',
          'machine',
          'radius',
          'height',
          'appearance',
          'cause',
          'surface',
          'impactPosition',
        ],
        'Settled defeat',
      );
      required(
        event.type === 'defeat' &&
          logicalId(event.actor) &&
          event.spawnId === event.actor &&
          typeof event.eventId === 'string' &&
          !eventIds.has(event.eventId) &&
          integer(event.tick, 1, next.ticks) &&
          MATERIALS.includes(event.material),
        'Invalid settled defeat',
      );
      eventIds.add(event.eventId);
      vector(event.position);
      if (event.impactPosition) vector(event.impactPosition);
      vector(event.velocity);
      required(
        typeof event.humanoid === 'boolean' &&
          (event.machine === false || ['tracked', 'wheeled'].includes(event.machine)) &&
          typeof event.family === 'string' &&
          event.family.length <= 64 &&
          integer(event.radius, 100, 2000) &&
          integer(event.height, 200, 5000) &&
          ['impact', 'pulse'].includes(event.cause) &&
          prototypes.some((p) => p.id === event.sourceId),
        'Invalid settled defeat source',
      );
      exactKeys(event.appearance, ['family', 'cast', 'type', 'model'], 'Defeat appearance');
      required(
        FAMILIES.includes(event.appearance.family) &&
          TYPES.includes(event.appearance.type) &&
          typeof event.appearance.cast === 'string' &&
          event.appearance.cast.length <= 64 &&
          (event.appearance.model === undefined ||
            WORLD_VEHICLE_MODELS.includes(event.appearance.model)),
        'Invalid defeat appearance',
      );
      exactKeys(event.normal, AXES, 'Defeat normal');
      required(
        AXES.every((k) => Number.isFinite(event.normal[k]) && Math.abs(event.normal[k]) <= 1.00001),
        'Invalid defeat normal',
      );
      if (event.surface) {
        exactKeys(event.surface, ['position', 'normal'], 'Defeat support');
        vector(event.surface.position);
        exactKeys(event.surface.normal, AXES, 'Support normal');
        required(
          AXES.every(
            (k) =>
              Number.isFinite(event.surface.normal[k]) &&
              Math.abs(event.surface.normal[k]) <= 1.00001,
          ),
          'Invalid defeat support normal',
        );
      }
    }
    required(
      next.result === null
        ? next.status === 'active'
        : next.status !== 'active' &&
            next.result.tick === next.ticks &&
            ['player-defeated', 'time-complete', 'targets-cleared'].includes(next.result.reason) &&
            next.result.kills === next.kills &&
            next.result.score === next.score,
      'Invalid encounter result',
    );
    defeatRecords = clone(next.defeats);
    state = clone(next);
    delete state.defeats;
    state.events = [];
    return snapshot();
  }
  return Object.freeze({
    definition: () => clone(definition),
    identity,
    snapshot,
    summary: () => ({
      status: state.status,
      phase: state.phase,
      ticks: state.ticks,
      runId: state.runId,
      lastCommandSeq: state.lastCommandSeq,
    }),
    prepare,
    commit,
    cancel(transaction = pending?.transaction) {
      required(!pending || transaction === pending.transaction, 'Unknown encounter transaction');
      pending = null;
      return snapshot();
    },
    checkpoint,
    restore,
    defeats: () => clone(defeatRecords),
    requestNextWave() {
      required(
        !pending && state.status === 'active' && state.phase === 'intermission',
        'No wave break to skip',
      );
      state.nextWaveTick = state.ticks;
      return snapshot();
    },
    export: () => canonicalJSON(checkpoint()),
  });
}

/** Validate a portable recovery before navigation can replace the current flight. */
export function inspectEncounterRecovery(value) {
  required(plainObject(value), 'A combat recovery must be a plain object');
  const fields = Object.getOwnPropertyDescriptors(value);
  required(
    fields.gameplay &&
      Object.hasOwn(fields.gameplay, 'value') &&
      fields.checksum &&
      Object.hasOwn(fields.checksum, 'value'),
    'Invalid combat recovery fields',
  );
  const gameplay = boundedJSON(fields.gameplay.value, {
    maxBytes: 40 * 1024 * 1024,
    maxNodes: 3500000,
    maxArray: 786432,
    maxDepth: 48,
    maxString: 12 * 1024 * 1024,
  });
  exactKeys(
    gameplay,
    [
      'format',
      'identity',
      'encounter',
      'physical',
      'recording',
      ...(gameplay.format === 'FPVCombatRecovery.v2' ? ['session'] : []),
    ],
    'Combat recovery',
  );
  required(
    ['FPVCombatRecovery.v1', 'FPVCombatRecovery.v2'].includes(gameplay.format) &&
      fields.checksum.value === dataIdentity(gameplay),
    'Invalid combat session or checksum',
  );
  // Cosmetic presentation cannot invalidate an otherwise valid gameplay recovery.
  let presentation = null;
  try {
    if (fields.presentation && Object.hasOwn(fields.presentation, 'value'))
      presentation = boundedJSON(fields.presentation.value, {
        maxBytes: 8 * 1024 * 1024,
        maxNodes: 1000000,
        maxArray: 4096,
        maxDepth: 24,
        maxString: 4096,
      });
  } catch {
    /* The renderer can reconstruct settled remains from accepted defeat facts. */
  }
  let launch = null;
  try {
    if (fields.launch && Object.hasOwn(fields.launch, 'value')) {
      const candidate = boundedJSON(fields.launch.value, {
        maxBytes: 128 * 1024,
        maxNodes: 8192,
        maxArray: 1024,
        maxDepth: 24,
        maxString: 4096,
      });
      exactKeys(
        candidate,
        ['format', 'configuration', 'mode', 'regional'],
        'Combat launch metadata',
      );
      required(
        candidate.format === 'FPVCombatLaunch.v1' &&
          plainObject(candidate.configuration) &&
          ['self-level', 'acro'].includes(candidate.mode),
        'Invalid combat launch metadata',
      );
      if (candidate.regional !== undefined) {
        const regional = candidate.regional;
        exactKeys(
          regional,
          ['spawnId', 'savedStart', 'initialHeading', 'continuous', 'geometryProfile'],
          'Combat regional launch',
        );
        required(
          regional.spawnId === undefined || stableId(regional.spawnId),
          'Invalid combat launch spawn',
        );
        required(
          regional.continuous === undefined || typeof regional.continuous === 'boolean',
          'Invalid continuous launch',
        );
        required(
          regional.geometryProfile === undefined ||
            ['terrain-v1', 'terrain-scenery-v1'].includes(regional.geometryProfile),
          'Invalid launch geometry profile',
        );
        required(
          regional.initialHeading === undefined ||
            regional.initialHeading === 'region-centre' ||
            integer(regional.initialHeading, 0, 35999),
          'Invalid launch heading',
        );
        if (regional.savedStart !== undefined) {
          exactKeys(regional.savedStart, ['position', 'heading'], 'Combat saved start');
          exactKeys(regional.savedStart.position, AXES, 'Combat start position');
          required(
            integer(regional.savedStart.heading, 0, 35999) &&
              AXES.every(
                (k) =>
                  Number.isFinite(regional.savedStart.position[k]) &&
                  Math.abs(regional.savedStart.position[k]) <= 100000000,
              ),
            'Invalid combat saved start',
          );
        }
      }
      launch = candidate;
    }
  } catch {
    /* Exact session identity still protects recovery without this optional launch hint. */
  }
  const saved = { gameplay, checksum: fields.checksum.value, presentation, launch };
  const definition = validateEncounterDefinition(gameplay.encounter?.definition);
  required(
    gameplay.identity?.format ===
      (definition.format === ENCOUNTER_FORMAT_V2
        ? 'FPVEncounterSession.v2'
        : 'FPVEncounterSession.v1') && gameplay.identity.encounter === dataIdentity(definition),
    'Combat session definition identity differs',
  );
  const validation = createEncounterRuntime(definition, {
    geometry: { sweepStatic: () => null, visible: () => false },
    runId: gameplay.encounter.state?.runId,
  });
  validation.restore(gameplay.encounter);
  if (gameplay.format === 'FPVCombatRecovery.v2') {
    const session = gameplay.session;
    exactKeys(session, ['ticks', 'nextCommandSeq', 'commands'], 'Encounter session clock');
    required(
      integer(session.ticks, gameplay.encounter.state.ticks, 1000000000) &&
        integer(
          session.nextCommandSeq,
          gameplay.encounter.state.lastCommandSeq + 1,
          Number.MAX_SAFE_INTEGER,
        ) &&
        Array.isArray(session.commands) &&
        session.commands.length <= 16,
      'Invalid encounter command queue',
    );
    let previous = gameplay.encounter.state.lastCommandSeq;
    for (const command of session.commands) {
      exactKeys(
        command,
        ['commandSeq', 'reload', 'switchWeapon', 'payload', 'detonate', 'startNextWave'],
        'Encounter command',
      );
      required(
        Object.keys(command).length === 2 &&
          integer(command.commandSeq, previous + 1, session.nextCommandSeq - 1) &&
          (Object.hasOwn(command, 'switchWeapon')
            ? [0, 1].includes(command.switchWeapon)
            : ['reload', 'payload', 'detonate', 'startNextWave'].some(
                (key) => command[key] === true,
              )),
        'Invalid queued command',
      );
      previous = command.commandSeq;
    }
  }
  return { saved, definition };
}

/** New Studio attempts reserve the authored roster; historical recovery is exact. */
export function prepareEncounterDefinition({
  course,
  baseIdentity,
  selection,
  authored = null,
  recovery = null,
  admitActor,
  admitServicePad,
}) {
  const retained = recovery
    ? inspectEncounterRecovery(recovery).definition
    : (authored?.definition ?? authored);
  const v2 = !recovery && selection?.version === 2;
  const selected = v2
    ? normalizeEncounterConfig(selection)
    : Object.fromEntries(Object.entries(selection ?? {}).filter(([key]) => key !== 'version'));
  // A newly launched Studio companion owns its complete authored roster.
  // Historical recovery bypasses this branch and retains its exact population.
  if (v2 && retained && retained.actors.length > selected.population) {
    const minimum = (selected.activity === 'survival' ? [64, 96, 128] : [6, 12, 20]).find(
      (count) => count >= retained.actors.length,
    );
    required(
      minimum,
      'The authored actor roster exceeds this activity’s supported population. Reduce it in Studio or choose Survival.',
    );
    selected.population = minimum;
  }
  const expanded =
    v2 &&
    retained &&
    selected.population > retained.actors.length &&
    course?.bounds &&
    course?.spawn
      ? createEncounterDefinition({
          course: { ...course, actors: retained.actors },
          baseIdentity,
          ...selected,
          seed: retained.seed,
          version: 2,
          admitActor,
          admitServicePad,
        })
      : null;
  const definition =
    expanded ??
    (retained
      ? validateEncounterDefinition(
          recovery
            ? retained
            : v2
              ? {
                  ...retained,
                  ...selected,
                  format: ENCOUNTER_FORMAT_V2,
                  revision: 'r2',
                  crowdModel: 'squad-lanes-v1',
                  servicePad: retained.servicePad ?? admitServicePad?.(course.spawn) ?? null,
                  actors: retained.actors.map(resolveMilitaryEncounterActor),
                }
              : { ...retained, ...selected },
        )
      : createEncounterDefinition({
          course,
          baseIdentity,
          ...selection,
          admitActor,
          admitServicePad,
        }));
  required(
    definition.baseIdentity === baseIdentity,
    'This combat session belongs to a different map revision. Open its original map before continuing.',
  );
  if (definition.format === ENCOUNTER_FORMAT_V2 && definition.servicePad && admitServicePad)
    required(
      admitServicePad(definition.servicePad, { exact: true }),
      'The saved service pad no longer fits the verified geometry.',
    );
  if (retained && admitActor)
    required(
      definition.actors.every((actor) =>
        admitActor(clone(actor), {
          requireAttackPosition: definition.format === ENCOUNTER_FORMAT_V2,
          ...(definition.format === ENCOUNTER_FORMAT_V2
            ? encounterAttackAdmission(definition.loadout)
            : {}),
        }),
      ),
      'The saved encounter does not fit the verified geometry at this starting point.',
    );
  return definition;
}

/** V2 has its own rule dispatch so historical pulse recordings retain their exact simulation. */
function createEncounterRuntimeV2(source, { geometry, runId = null } = {}) {
  const definition = validateEncounterDefinition(source),
    identity = dataIdentity(definition);
  const admitted = [...definition.actors];
  if (definition.activity === 'survival') {
    // Keep every authored prototype in the immutable definition while reserving
    // an admitted final-enemy body even when a smaller population is selected.
    const finalIndex = admitted.findLastIndex((a) =>
      ['vehicle', 'drone', 'hazard'].includes(a.type),
    );
    const [final] = admitted.splice(finalIndex, 1);
    const firstHostile = admitted.findIndex((a) => a.type !== 'prop');
    if (firstHostile > 0) admitted.unshift(...admitted.splice(firstHostile, 1));
    admitted.splice(definition.population - 1);
    admitted.push(final);
  }
  const prototypes = admitted.slice(0, definition.population),
    policy = POLICIES[definition.difficulty];
  required(
    typeof geometry?.sweepStatic === 'function' && typeof geometry?.visible === 'function',
    'Encounter needs verified geometry queries',
  );
  const queryGeometry = geometry;
  const unavailable = () => {
    const error = new Error('Combat geometry is still loading');
    error.code = 'ENCOUNTER_GEOMETRY_UNAVAILABLE';
    throw error;
  };
  geometry = {
    ...queryGeometry,
    visible: (...args) => queryGeometry.visible(...args),
    sweepStatic(from, to, radius) {
      const hit = queryGeometry.sweepStatic(from, to, radius);
      if (hit?.unavailable) unavailable();
      if (!hit) return null;
      const position = hit.position ?? mix(from, to, hit.toi),
        normal = unit(hit.normal ?? { x: 0, y: 1, z: 0 });
      return {
        ...hit,
        position,
        normal,
        // Physics advances the swept sphere centre. Cosmetic marks belong to
        // the contacted surface, which is one projectile radius behind it.
        surfacePosition: hit.surfacePosition ?? add(position, normal, -(radius ?? 25)),
      };
    },
    ...(queryGeometry.surface
      ? {
          surface(...args) {
            const hit = queryGeometry.surface(...args);
            if (hit?.unavailable) unavailable();
            return hit;
          },
        }
      : {}),
  };
  runId ??= `encounter-${identity}`;
  required(
    typeof runId === 'string' && runId.length > 0 && runId.length <= 256,
    'Invalid encounter run ID',
  );
  const isSurvival = definition.activity === 'survival',
    squadLanes = definition.crowdModel === 'squad-lanes-v1',
    bossIndex = prototypes.length - 1;
  const payloadCapacity =
    definition.ammoPreset === 'tactical' ? 1 : { bomb: 3, remote: 2, drone: 1 }[definition.payload];
  const weaponState = (id) => {
    const rule = ENCOUNTER_WEAPONS[id],
      heavy = id === 'rocket';
    return {
      id,
      ammo: rule.magazine,
      reserve: heavy
        ? definition.ammoPreset === 'tactical'
          ? 0
          : 2
        : definition.ammoPreset === 'tactical'
          ? rule.magazine * 2
          : -1,
      reloadTicks: 0,
      reloadTotal: rule.reload,
      cooldown: 0,
    };
  };
  const challengeTypes = ['disable-component'];
  if (definition.activity !== 'hunting' && prototypes.some((a) => a.fireEveryTicks > 0))
    challengeTypes.push('interrupt-attack');
  const interceptors = prototypes.filter((a) => ['drone', 'hazard'].includes(a.type)).length;
  if (interceptors) challengeTypes.push('interceptor-group');
  if (
    prototypes.some((a, i) =>
      prototypes.some((b, j) => j > i && distance(a.position, b.position) < 9000),
    )
  )
    challengeTypes.push('multi-target-blast');
  const challengeType = challengeTypes[definition.seed % challengeTypes.length];
  const challengeGoal =
    challengeType === 'interceptor-group'
      ? Math.min(3, interceptors)
      : challengeType === 'multi-target-blast'
        ? 2
        : 1;
  const initial = {
    format: ENCOUNTER_STATE_V2,
    definitionIdentity: identity,
    runId,
    ticks: 0,
    rng: definition.seed,
    status: 'active',
    phase: 'wave',
    waitingForClearSpawn: false,
    wave: 1,
    nextWaveTick: null,
    lastDamageTick: -10000,
    health: 100,
    maxHealth: 100,
    score: 0,
    kills: 0,
    rewardKills: 0,
    shots: 0,
    hits: 0,
    successfulImpacts: 0,
    streak: 0,
    bestStreak: 0,
    nextSpawn: 1,
    nextProjectile: 1,
    nextEvent: 1,
    nextAttack: 1,
    nextPickup: 1,
    cooldown: 0,
    actors: [],
    projectiles: [],
    ordnance: [],
    events: [],
    contactLocks: {},
    result: null,
    weaponIndex: 0,
    weapons: definition.loadout.map(weaponState),
    payloadAmmo: payloadCapacity,
    payloadArmed: false,
    lastCommandSeq: 0,
    commandMask: 0,
    fireReleasedTicks: 0,
    serviceTicks: 0,
    pickups: [],
    pendingPickups: [],
    attackHits: [],
    nextHealthReward: 12,
    nextAmmoReward: 3,
    contactProtectionUntil: 0,
    aftermathUntil: null,
    challenge: {
      type: challengeType,
      goal: challengeGoal,
      progress: 0,
      complete: false,
      startTick: 0,
    },
    survival: {
      mode: definition.survivalMode,
      finalSpawned: false,
      finalDefeated: false,
      nextEliteTick: 6000,
      reliefUntil: 0,
      formation: 'advance',
      nextFormationTick: 1500,
      nextSpawnTick: 0,
      nextSupplyTick: 4500,
      pressure: 0.4,
      regroupUntil: 0,
      nextReliefAllowed: 0,
      recentDefeats: [],
      supplies: 0,
    },
  };
  let state = initial,
    pending = null,
    serial = 0,
    defeatRecords = [],
    impactRecords = [];
  const nextRandom = (draft) => {
    draft.rng = seedStep(draft.rng);
    return draft.rng / 4294967296;
  };
  const actorEvent = (actor) =>
    actor
      ? {
          actor: actor.id,
          spawnId: actor.id,
          slotId: actor.slotId,
          sourceId: actor.sourceId,
          position: clone(actor.position),
          velocity: clone(actor.velocity),
          normal: { x: 0, y: 1, z: 0 },
          material: actor.material,
          family:
            actor.type === 'vehicle'
              ? ({
                  'field-utility': 'utility-car',
                  'field-tank': 'tracked-tank',
                  'relay-truck': 'radar-truck',
                }[actor.vehicleModel] ?? 'utility-car')
              : actor.family,
          humanoid: humanoid(actor),
          machine:
            !humanoid(actor) && actor.type !== 'prop'
              ? actor.type === 'vehicle'
                ? 'wheeled'
                : 'rotor'
              : actor.type === 'prop' && actor.speed > 0
                ? 'tracked'
                : false,
          radius: actor.radius,
          height: actor.height,
          appearance: {
            ...clone(actor.appearance),
            type: actor.type,
            ...(actor.vehicleModel ? { model: actor.vehicleModel } : {}),
          },
          componentMask: actor.componentMask,
        }
      : {};
  function emit(draft, type, actor = null, detail = {}) {
    const event = {
      eventId: `${runId}:${draft.nextEvent++}`,
      type,
      tick: draft.ticks + 1,
      ...actorEvent(actor),
      ...detail,
    };
    draft.events.push(event);
    return event;
  }
  function spawn(draft, index, initialSpawn = false, at = null, special = null) {
    const prototype = prototypes[index],
      previous = draft.actors[index];
    const actor = {
      ...clone(prototype),
      id: `${runId}:${draft.nextSpawn++}`,
      slotId: slotId(index),
      sourceId: prototype.id,
      slotIndex: index,
      position: clone(at ?? prototype.position),
      velocity: zero(),
      status: 'active',
      maxHealth: prototype.health * (special === 'final' ? 4 : special === 'elite' ? 2 : 1),
      health: prototype.health * (special === 'final' ? 4 : special === 'elite' ? 2 : 1),
      pathIndex: 0,
      cooldown: special === 'final' ? 0 : 100,
      warning: false,
      heading: { x: 0, y: 0, z: -1 },
      spawnTick: draft.ticks,
      defeatedTick: null,
      replacementTick: null,
      blocked: false,
      componentMask: 0,
      special,
      squad: Math.floor(index / 6),
      lastHitTick: -10000,
      lastPositionIndex: 0,
      routeDirection: 1,
      nextSpawnChoice: 0,
    };
    actor.spawnId = actor.id;
    const component = (id, ratio) => ({
      id,
      health: Math.max(1, Math.ceil(actor.maxHealth * ratio)),
      maxHealth: Math.max(1, Math.ceil(actor.maxHealth * ratio)),
    });
    if (!initialSpawn && definition.activity === 'continuous' && humanoid(actor)) {
      const families = FAMILIES.filter(
        (family) => family !== previous?.family && family !== 'rendezvous-pair',
      );
      actor.family = families[Math.floor(nextRandom(draft) * families.length)];
      actor.appearance.family = actor.family;
    }
    actor.components = [
      component(
        actor.family === 'shield-bearer' ? 'plate' : 'mount',
        actor.family === 'shield-bearer' ? 0.4 : 0.3,
      ),
      component(humanoid(actor) ? 'equipment' : 'core', 0.25),
    ];
    actor.lastPositionIndex = Math.max(
      0,
      [prototype.position, ...prototype.path]
        .filter((p, i, all) => all.findIndex((other) => distance(p, other) < 100) === i)
        .findIndex((p) => distance(p, actor.position) < 100),
    );
    actor.pathIndex = Math.max(
      0,
      actor.path.findIndex((point) => distance(point, actor.position) < 100),
    );
    draft.actors[index] = actor;
    if (!initialSpawn) emit(draft, 'spawn', actor, { special });
    return actor;
  }
  prototypes.forEach((_, index) => {
    const actor = spawn(state, index, true);
    if (
      isSurvival &&
      (index >= Math.max(1, Math.floor((prototypes.length - 1) * 0.4)) || index === bossIndex)
    )
      actor.status = 'waiting';
  });
  const snapshot = ({ includeDefeats = false, includeImpacts = false } = {}) => ({
    ...clone(state),
    accuracy: state.shots ? state.hits / state.shots : null,
    ...(includeDefeats ? { defeats: clone(defeatRecords) } : {}),
    ...(includeImpacts ? { impactRecords: clone(impactRecords) } : {}),
  });
  let frameState = null,
    frameView = null;
  const freezeFrame = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const item of Object.values(value)) freezeFrame(item);
      Object.freeze(value);
    }
    return value;
  };
  // Presentation never needs authored routes, component health, collision locks
  // or past accuracy identities. This owned frozen view may be shared within one
  // accepted interval; full snapshots and recovery remain independent copies.
  function frameSnapshot() {
    if (frameState !== state) {
      const { actors, contactLocks, attackHits, pendingPickups, ...visible } = state;
      void contactLocks;
      void attackHits;
      void pendingPickups;
      frameView = freezeFrame({
        ...clone(visible),
        accuracy: state.shots ? state.hits / state.shots : null,
        actors: actors.map((actor) =>
          clone(
            Object.fromEntries(
              [
                'id',
                'sourceId',
                'slotId',
                'spawnId',
                'spawnTick',
                'type',
                'radius',
                'height',
                'status',
                'health',
                'maxHealth',
                'lastHitTick',
                'position',
                'heading',
                'velocity',
                'material',
                'family',
                'vehicleModel',
                'appearance',
                'explosive',
                'componentMask',
                'warning',
                'blocked',
                'pursuit',
                'special',
              ]
                .filter((key) => Object.hasOwn(actor, key))
                .map((key) => [key, actor[key]]),
            ),
          ),
        ),
      });
      frameState = state;
    }
    return frameView;
  }
  const supportedPosition = (actor, position) => {
    if (!within(position, definition.bounds)) return null;
    if (!ground(actor)) return clone(position);
    const support = geometry.surface?.(position, actor.radius);
    if (geometry.surface && (!support || support.normal.y < 0.866)) return null;
    const result = support
      ? { ...position, y: Math.round(support.position.y + 12) }
      : clone(position);
    return within(result, definition.bounds) ? result : null;
  };
  function clearSpawn(draft, index, player, rotate = true, reservations = []) {
    const prototype = prototypes[index],
      prior = draft.actors[index];
    const candidates = [prototype.position, ...prototype.path].filter(
      (p, i, all) => all.findIndex((other) => distance(p, other) < 100) === i,
    );
    const start = rotate
      ? (prior.lastPositionIndex + 1 + prior.nextSpawnChoice) % candidates.length
      : 0;
    for (let offset = 0; offset < candidates.length; offset++) {
      const candidateIndex = (start + offset) % candidates.length;
      if (
        rotate &&
        candidates.length > 1 &&
        candidateIndex === prior.lastPositionIndex &&
        offset < candidates.length - 1
      )
        continue;
      const position = supportedPosition(prototype, candidates[candidateIndex]);
      if (
        !position ||
        distance(position, player.position) < prototype.radius + (player.radius ?? 220) + 3000
      )
        continue;
      // Do not materialize in the imminent flight corridor.
      const forward = add(player.position, player.velocity ?? zero(), 0.5);
      if (distance(position, forward) < prototype.radius + 1800) continue;
      if (
        draft.actors.some(
          (a, i) =>
            i !== index &&
            a.status === 'active' &&
            distance(centre(a), centre({ ...prototype, position })) <
              prototype.radius + a.radius + 500,
        )
      )
        continue;
      if (
        geometry.sweepStatic(
          centre({ ...prototype, position }),
          centre({ ...prototype, position }),
          prototype.radius,
        )
      )
        continue;
      if (
        reservations.some(
          (other) =>
            distance(centre(other), centre({ ...prototype, position })) <
            prototype.radius + other.radius + 500,
        )
      )
        continue;
      return position;
    }
    return null;
  }
  function actorIndex(actors, motions = null) {
    const cells = new Map(),
      cellSize = 8000;
    for (const actor of actors) {
      if (actor.status !== 'active') continue;
      const motion = motions?.get(actor.slotId),
        from = motion?.from ?? actor.position,
        to = motion?.to ?? actor.position;
      const minX = Math.floor((Math.min(from.x, to.x) - actor.radius) / cellSize),
        maxX = Math.floor((Math.max(from.x, to.x) + actor.radius) / cellSize);
      const minZ = Math.floor((Math.min(from.z, to.z) - actor.radius) / cellSize),
        maxZ = Math.floor((Math.max(from.z, to.z) + actor.radius) / cellSize);
      for (let x = minX; x <= maxX; x++)
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x}:${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(actor);
        }
    }
    return (from, to = from, radius = 0) => {
      const minX = Math.floor((Math.min(from.x, to.x) - radius) / cellSize),
        maxX = Math.floor((Math.max(from.x, to.x) + radius) / cellSize);
      const minZ = Math.floor((Math.min(from.z, to.z) - radius) / cellSize),
        maxZ = Math.floor((Math.max(from.z, to.z) + radius) / cellSize);
      if ((maxX - minX + 1) * (maxZ - minZ + 1) > 1024) return actors;
      const found = new Map();
      for (let x = minX; x <= maxX; x++)
        for (let z = minZ; z <= maxZ; z++)
          for (const actor of cells.get(`${x}:${z}`) ?? []) found.set(actor.slotIndex, actor);
      return [...found.values()].sort((a, b) => a.slotIndex - b.slotIndex);
    };
  }
  function moveActor(draft, actor, player, neighbours) {
    const from = clone(actor.position);
    actor.velocity = zero();
    // Once the aircraft crashes, its last accepted collider interval is frozen.
    // Deployed ordnance resolves against those poses without unrecorded worker motion.
    if (draft.phase === 'aftermath') {
      actor.warning = false;
      return from;
    }
    actor.warning =
      actor.status === 'active' &&
      actor.fireEveryTicks > 0 &&
      actor.cooldown <= 40 &&
      draft.ticks - actor.spawnTick >= 100 &&
      distance(centre(actor), player.position) <= actor.range &&
      geometry.visible(centre(actor), player.position);
    if (actor.special === 'final') actor.warning = (draft.ticks - actor.spawnTick) % 300 < 60;
    const contactWindow =
      squadLanes &&
      isSurvival &&
      actor.fireEveryTicks === 0 &&
      Math.floor(draft.ticks / 500) % 4 === actor.slotIndex % 4;
    const contactWindup = contactWindow && draft.ticks % 500 < 25;
    if (contactWindup) actor.warning = true;
    if (actor.status !== 'active' || !actor.path.length || !actor.speed) return from;
    let target = actor.path[actor.pathIndex];
    if (distance(actor.position, target) < Math.max(35, actor.speed / 50)) {
      if (isSurvival)
        actor.routeDirection =
          (draft.survival.formation === 'flank' && actor.squad % 2) ||
          (draft.survival.formation === 'interceptors' && !ground(actor))
            ? -1
            : 1;
      actor.pathIndex =
        (actor.pathIndex + actor.routeDirection + actor.path.length) % actor.path.length;
      target = actor.path[actor.pathIndex];
    }
    let speed = actor.speed;
    if (isSurvival) {
      const formation = draft.survival.formation;
      if (formation === 'shield-front' && actor.family !== 'shield-bearer') speed *= 0.65;
      if (formation === 'interceptors' && !ground(actor)) speed *= 1.25;
      if (formation === 'support-cover' && actor.family === 'courier') speed *= 0.6;
      const support = draft.actors.some(
        (a) =>
          a.status === 'active' &&
          (a.vehicleModel === 'relay-truck' || a.family === 'courier') &&
          distance(a.position, actor.position) < 10000,
      );
      if (support) speed *= 1.08;
    }
    const phase = (draft.ticks - actor.spawnTick + actor.squad * 11) % 160;
    if (['sprinter', 'brace-trooper'].includes(actor.family)) {
      actor.warning = phase < 40;
      speed *= phase < 40 ? 0 : phase < 60 ? 2 : phase < 100 ? 0.33 : 1;
    }
    if (actor.special === 'final') {
      const phase = (draft.ticks - actor.spawnTick) % 300;
      speed *= phase < 60 ? 0.15 : phase < 120 ? 1.5 : phase >= 220 ? 0.5 : 1;
    }
    if (isSurvival && draft.survival.regroupUntil > draft.ticks) speed *= 0.5;
    if (actor.components[0].id === 'mount' && actor.componentMask & 1 && !humanoid(actor))
      speed *= 0.75;
    if (contactWindup) {
      speed = 0;
      actor.warning = true;
    }
    const routeHeading = unit(subtract(target, actor.position));
    let heading = routeHeading;
    if (isSurvival) {
      // Decisions are staggered at 10 Hz; each actual move still requires support,
      // full-body static clearance and living-actor separation at 50 Hz.
      heading = actor.heading;
      if (
        (draft.ticks + actor.slotIndex) % 5 === 0 ||
        actor.blocked ||
        draft.ticks === actor.spawnTick
      ) {
        const approach = subtract(player.position, actor.position);
        if (ground(actor)) approach.y = 0;
        const toward = unit(approach);
        const lane = (actor.slotIndex + actor.squad) % 3;
        const standoff =
          actor.vehicleModel === 'relay-truck' || actor.family === 'courier'
            ? 14000
            : actor.type === 'vehicle'
              ? 8000
              : actor.type === 'sentry'
                ? 5000
                : !squadLanes
                  ? 1000
                  : ground(actor)
                    ? 1500
                    : 2400;
        // Stable slots spread a squad around distinct approach lanes. Rotorcraft
        // also use separate height bands instead of sharing one point above the
        // aircraft; every actual move still passes the same geometry admission.
        const angle = actor.slotIndex * 2.399963229728653 + actor.squad * 0.17;
        const assault = contactWindow && !contactWindup;
        const radius = assault ? 0 : standoff + lane * (ground(actor) ? 850 : 1300);
        const flank =
          draft.survival.formation === 'flank' && actor.family !== 'shield-bearer'
            ? (actor.squad % 2 ? 1 : -1) *
              Math.min(5000, distance(actor.position, player.position) * 0.35)
            : 0;
        const destination = squadLanes
          ? {
              x: player.position.x + Math.sin(angle) * radius - toward.z * flank,
              y: ground(actor)
                ? actor.position.y
                : assault
                  ? player.position.y - actor.radius
                  : player.position.y + 600 + lane * 1300,
              z: player.position.z + Math.cos(angle) * radius + toward.x * flank,
            }
          : {
              x: player.position.x - toward.x * standoff - toward.z * flank,
              y: ground(actor) ? actor.position.y : player.position.y + 800,
              z: player.position.z - toward.z * standoff + toward.x * flank,
            };
        heading =
          distance(destination, actor.position) <= Math.max(100, speed / 50)
            ? zero()
            : unit(subtract(destination, actor.position));
      }
    }
    const attempt = (direction, length) => {
      const to = add(actor.position, direction, length);
      const supported = supportedPosition(actor, to);
      if (!supported || (ground(actor) && Math.abs(supported.y - actor.position.y) > 220))
        return null;
      if (
        neighbours(to, to, actor.radius + (squadLanes ? 3000 : 2200)).some(
          (other) =>
            other.id !== actor.id &&
            other.status === 'active' &&
            crowdSeparation(actor, supported, other) < 1 &&
            crowdSeparation(actor, supported, other) <
              crowdSeparation(actor, actor.position, other),
        )
      )
        return null;
      // Sweep the bottom, middle and top of upright bodies, not only their centre.
      const heights = ground(actor)
        ? [actor.radius, actor.height / 2, actor.height - actor.radius]
        : [actor.radius];
      if (
        heights.some((height) =>
          geometry.sweepStatic(
            { ...actor.position, y: actor.position.y + height },
            { ...supported, y: supported.y + height },
            actor.radius,
          ),
        )
      )
        return null;
      return supported;
    };
    let supported = attempt(
      heading,
      isSurvival ? speed / 50 : Math.min(distance(target, actor.position), speed / 50),
    );
    actor.blocked = !supported;
    if (!supported && isSurvival)
      supported = attempt(routeHeading, Math.min(distance(target, actor.position), speed / 50));
    if (supported) actor.position = supported;
    actor.heading = heading;
    actor.velocity = Object.fromEntries(
      AXES.map((key) => [key, (actor.position[key] - from[key]) * 50]),
    );
    return from;
  }
  function crowdSeparation(actor, position, other) {
    if (!squadLanes)
      return (
        distance(centre({ ...actor, position }), centre(other)) / (actor.radius + other.radius + 80)
      );
    const extra = isSurvival
      ? (humanoid(actor) ? 180 : ground(actor) ? 220 : 400) +
        (humanoid(other) ? 180 : ground(other) ? 220 : 400)
      : 80;
    const radius = actor.radius + other.radius + extra;
    if (!ground(actor) && !ground(other))
      return distance(centre({ ...actor, position }), centre(other)) / radius;
    // Upright actors occupy their whole cylinder. Comparing only body centres
    // lets a tall troop and a shorter robot visually intersect on the same floor.
    const height = ground(actor) ? actor.height : actor.radius * 2;
    const otherHeight = ground(other) ? other.height : other.radius * 2;
    const horizontal =
      Math.hypot(position.x - other.position.x, position.z - other.position.z) / radius;
    const vertical =
      Math.abs(position.y + height / 2 - other.position.y - otherHeight / 2) /
      ((height + otherHeight) / 2 + 80);
    return horizontal >= 1 || vertical >= 1
      ? Math.max(horizontal, vertical)
      : 1 - (1 - horizontal) * (1 - vertical);
  }
  function pickupSupport(position) {
    const support = geometry.surface?.(position, 250);
    if (!support || support.normal.y < 0.866 || !within(support.position, definition.bounds))
      return null;
    const settled = { ...support.position, y: Math.round(support.position.y + 12) };
    const body = { ...settled, y: settled.y + 250 };
    return within(settled, definition.bounds) && !geometry.sweepStatic(body, body, 200)
      ? settled
      : null;
  }
  function pickup(draft, kind, position, guarded = false) {
    const max = kind === 'health' ? 2 : 8;
    const supported = pickupSupport(position);
    const item = {
      id: `${runId}:pickup-${draft.nextPickup++}`,
      kind,
      position: clone(supported ?? position),
      surfacePending: !supported,
      guarded,
      entryReady: !guarded,
      spawnTick: draft.ticks + 1,
    };
    if (supported && draft.pickups.filter((p) => p.kind === kind).length < max)
      draft.pickups.push(item);
    else if (draft.pendingPickups.filter((p) => p.kind === kind).length < max)
      draft.pendingPickups.push(item);
    emit(draft, 'supply', null, { kind, position: clone(position), guarded });
  }
  function recordSurface(draft, contact, extra = {}) {
    const position = clone(contact.surfacePosition ?? contact.position),
      normal = unit(contact.normal ?? { x: 0, y: 1, z: 0 });
    const event = emit(draft, 'surface-impact', null, {
      sourceId: String(contact.surfaceId ?? contact.id ?? 'terrain'),
      position,
      normal,
      material: contact.material ?? 'stone',
      surface: { position, normal, ...(contact.surfaceId ? { surfaceId: contact.surfaceId } : {}) },
      ...extra,
    });
    draft.newImpacts.push(event);
  }
  function playerDamage(draft, amount, detail = {}) {
    if (
      definition.playerDamage === 'invulnerable' ||
      draft.phase === 'aftermath' ||
      amount <= 0 ||
      draft.health <= 0
    )
      return;
    const damage = Math.min(draft.health, Math.max(0, Math.round(amount)));
    draft.health -= damage;
    draft.lastDamageTick = draft.ticks + 1;
    draft.streak = 0;
    emit(draft, 'player-damage', null, { damage, health: draft.health, ...detail });
  }
  function countAttack(draft, attackId) {
    if (!Number.isSafeInteger(attackId) || attackId < 1 || draft.attackHits.includes(attackId))
      return;
    draft.attackHits.push(attackId);
    draft.hits++;
    if (draft.attackHits.length > 256) draft.attackHits.shift();
  }
  function protectedHit(actor, origin, tick) {
    if (!humanoid(actor) || actor.componentMask & 1) return false;
    return actor.family === 'shield-bearer'
      ? dot(subtract(origin, actor.position), actor.heading) > 0
      : actor.family === 'brace-trooper' && (tick - actor.spawnTick) % 160 < 60;
  }
  function challengeProgress(draft, type, amount = 1) {
    if (draft.challenge.type !== type || draft.challenge.complete) return;
    draft.challenge.progress = Math.min(draft.challenge.goal, draft.challenge.progress + amount);
    draft.challenge.complete = draft.challenge.progress === draft.challenge.goal;
    emit(draft, 'challenge', null, { challenge: clone(draft.challenge) });
  }
  function hurt(draft, actor, amount, weapon, contact, origin, attackId, chain = new Set()) {
    if (actor.status !== 'active' || amount <= 0 || !actor.destructible) return false;
    const normal = unit(contact.normal ?? subtract(origin, centre(actor)));
    const detail = {
      impactPosition: clone(contact.position ?? centre(actor)),
      impactDirection: unit(contact.velocity ?? subtract(centre(actor), origin)),
      normal,
      velocity: clone(contact.velocity ?? zero()),
      weapon,
      cause: weapon === 'impact' ? 'impact' : weapon === 'explosion' ? 'explosion' : 'pulse',
      severity: amount >= 100 ? 'explosive' : amount >= 60 ? 'high' : 'localized',
      attackId: attackId ?? null,
    };
    const protectedBody = protectedHit(actor, origin, draft.ticks);
    const relativeHeight = (detail.impactPosition.y - actor.position.y) / actor.height;
    const componentIndex =
      protectedBody || relativeHeight > 0.64
        ? 0
        : !humanoid(actor) && relativeHeight < 0.4
          ? 1
          : -1;
    if (componentIndex >= 0 && actor.components[componentIndex].health > 0) {
      const component = actor.components[componentIndex];
      component.health = Math.max(0, component.health - Math.round(amount));
      if (!component.health) {
        actor.componentMask |= 1 << componentIndex;
        emit(draft, 'component', actor, { ...detail, component: component.id, damage: amount });
        if (component.id === 'core') amount = Math.max(amount, actor.health);
        challengeProgress(draft, 'disable-component');
      }
    }
    if (protectedBody && !(actor.componentMask & 1)) {
      emit(draft, 'impact', actor, { ...detail, damage: 0, protected: true });
      return false;
    }
    if (definition.enemyDamage === 'one-hit') amount = actor.health;
    const damage = Math.min(actor.health, Math.max(1, Math.round(amount)));
    actor.health -= damage;
    actor.lastHitTick = draft.ticks + 1;
    countAttack(draft, attackId);
    if (weapon === 'impact') draft.successfulImpacts++;
    if (actor.warning) {
      challengeProgress(draft, 'interrupt-attack');
      actor.cooldown = Math.max(actor.cooldown, 50);
      actor.warning = false;
    }
    emit(draft, 'impact', actor, { ...detail, damage });
    if (actor.health > 0) return true;
    actor.status = 'defeated';
    actor.defeatedTick = draft.ticks + 1;
    actor.replacementTick = actor.defeatedTick + 200 + Math.floor(nextRandom(draft) * 201);
    actor.nextSpawnChoice = Math.floor(nextRandom(draft) * Math.max(1, actor.path.length - 1));
    draft.kills++;
    draft.score += 100;
    draft.streak++;
    draft.bestStreak = Math.max(draft.bestStreak, draft.streak);
    const surface = geometry.surface?.(actor.position, actor.radius);
    const event = emit(draft, 'defeat', actor, {
      ...detail,
      ...(surface ? { surface: clone(surface) } : {}),
      seed: seedStep(draft.rng ^ draft.nextSpawn),
    });
    draft.defeats.push(event);
    if (['drone', 'hazard'].includes(actor.type)) challengeProgress(draft, 'interceptor-group');
    actor.velocity = zero();
    if (actor.special === 'final') draft.survival.finalDefeated = true;
    if (actor.vehicleModel === 'relay-truck' || actor.family === 'courier')
      draft.survival.regroupUntil = draft.ticks + 150;
    if (actor.type !== 'prop') {
      draft.rewardKills++;
      if (draft.rewardKills >= draft.nextHealthReward) {
        pickup(draft, 'health', surface?.position ?? actor.position);
        draft.nextHealthReward += 12;
      }
      if (definition.ammoPreset === 'balanced' && draft.rewardKills >= draft.nextAmmoReward) {
        pickup(draft, 'ammo', surface?.position ?? actor.position);
        draft.nextAmmoReward += 3;
      }
    }
    if (isSurvival) {
      draft.survival.recentDefeats = [
        ...draft.survival.recentDefeats.filter((tick) => tick > draft.ticks - 50),
        draft.ticks,
      ];
      const duration = { easy: 500, normal: 400, hard: 250 }[definition.difficulty];
      if (
        draft.survival.recentDefeats.length >= 20 &&
        draft.ticks >= draft.survival.nextReliefAllowed
      ) {
        draft.survival.reliefUntil = draft.ticks + duration;
        draft.survival.nextReliefAllowed = draft.ticks + duration * 3;
      }
    }
    if (
      !humanoid(actor) &&
      (actor.type !== 'prop' || actor.appearance.archetype === 'explosive-rover') &&
      !chain.has(actor.id)
    ) {
      chain.add(actor.id);
      explode(
        draft,
        centre(actor),
        actor.type === 'vehicle' || actor.appearance.archetype === 'explosive-rover' ? 75 : 40,
        actor.type === 'vehicle' || actor.appearance.archetype === 'explosive-rover' ? 3500 : 2000,
        'machine',
        null,
        chain,
      );
    }
    return true;
  }
  function explode(draft, position, damage, radius, weapon, attackId = null, chain = new Set()) {
    const killsBefore = draft.kills;
    emit(draft, 'explosion', null, {
      position: clone(position),
      radius,
      weapon,
      damage,
      severity: 'explosive',
    });
    const support = geometry.surface?.(position, 100);
    if (support && distance(support.position, position) <= radius)
      recordSurface(draft, support, { weapon, cause: 'explosion', damage, severity: 'explosive' });
    for (const actor of draft.actors) {
      if (actor.status !== 'active') continue;
      const range = distance(centre(actor), position);
      if (range > radius + actor.radius || !geometry.visible(position, centre(actor))) continue;
      const inflicted = Math.round(
        damage * Math.max(0, 1 - Math.max(0, range - actor.radius) / radius),
      );
      hurt(
        draft,
        actor,
        inflicted,
        'explosion',
        {
          position: centre(actor),
          normal: unit(subtract(centre(actor), position)),
          velocity: add(zero(), unit(subtract(centre(actor), position)), inflicted * 100),
        },
        position,
        attackId,
        chain,
      );
    }
    if (draft.kills - killsBefore >= 2) challengeProgress(draft, 'multi-target-blast', 2);
  }
  function addShots(draft, owner, position, direction, rule, weapon, inherited = zero()) {
    const player = owner === 'player';
    if (
      draft.projectiles.filter((p) => (p.owner === 'player') === player).length + rule.pellets >
      (player ? 48 : 16)
    )
      return false;
    const attackId = player ? draft.nextAttack++ : null;
    const forward = unit(direction),
      side = unit({ x: forward.z, y: 0, z: -forward.x });
    const up = unit({
      x: side.y * forward.z - side.z * forward.y,
      y: side.z * forward.x - side.x * forward.z,
      z: side.x * forward.y - side.y * forward.x,
    });
    const radius = weapon === 'rocket' ? 100 : 25;
    for (let i = 0; i < rule.pellets; i++) {
      const angle = nextRandom(draft) * Math.PI * 2,
        spread = Math.sqrt(nextRandom(draft)) * rule.spread;
      const aim = unit(
        Object.fromEntries(
          AXES.map((key) => [
            key,
            forward[key] +
              side[key] * Math.cos(angle) * spread +
              up[key] * Math.sin(angle) * spread,
          ]),
        ),
      );
      draft.projectiles.push({
        id: draft.nextProjectile++,
        owner,
        attackId,
        position: clone(position),
        velocity: add(inherited, aim, rule.speed),
        damage: rule.damage,
        ttl: Math.ceil((rule.range / rule.speed) * 50),
        remainingRange: rule.range,
        radius,
        weapon,
        blast: rule.blast ?? 0,
        blastRadius: rule.blastRadius ?? 0,
      });
    }
    if (player) draft.shots++;
    emit(draft, 'fire', player ? null : draft.actors.find((a) => a.id === owner), {
      actor: owner,
      position: clone(position),
      direction: forward,
      weapon,
      attackId,
      pellets: rule.pellets,
    });
    return true;
  }
  function resupply(draft, complete = false) {
    let changed = false;
    for (const weapon of draft.weapons) {
      const before = weapon.ammo + Math.max(0, weapon.reserve),
        rule = ENCOUNTER_WEAPONS[weapon.id];
      if (weapon.id === 'rocket')
        weapon.reserve = Math.min(
          (definition.ammoPreset === 'tactical' ? 2 : 4) - weapon.ammo,
          weapon.reserve + (complete ? 4 : 2),
        );
      else if (complete && definition.ammoPreset === 'tactical')
        weapon.reserve = rule.magazine * 3 - weapon.ammo;
      if (weapon.ammo + Math.max(0, weapon.reserve) > before) changed = true;
    }
    const prior = draft.payloadAmmo;
    draft.payloadAmmo = Math.min(
      payloadCapacity,
      draft.payloadAmmo + (complete ? payloadCapacity : 1),
    );
    return changed || draft.payloadAmmo > prior;
  }
  function commandInput(draft, input) {
    const mask =
      (input.reload ? 1 : 0) |
      (input.switchWeapon !== undefined ? 2 : 0) |
      (input.payload ? 4 : 0) |
      (input.detonate ? 8 : 0) |
      (input.startNextWave ? 16 : 0);
    const fresh =
      input.commandSeq === undefined
        ? mask & ~draft.commandMask
        : input.commandSeq > draft.lastCommandSeq
          ? mask
          : 0;
    if (input.commandSeq !== undefined && input.commandSeq > draft.lastCommandSeq)
      draft.lastCommandSeq = input.commandSeq;
    draft.commandMask = mask;
    return {
      reload: !!(fresh & 1),
      switchWeapon: fresh & 2 ? input.switchWeapon : undefined,
      payload: !!(fresh & 4),
      detonate: !!(fresh & 8),
      startNextWave: !!(fresh & 16),
    };
  }
  const coveredEndpoint = (position, radius) =>
    ['x', 'z'].every(
      (axis) =>
        position[axis] >= definition.bounds.min[axis] + radius + 1 &&
        position[axis] <= definition.bounds.max[axis] - radius - 1,
    );
  function weapons(draft, player, input, command) {
    if (draft.phase === 'aftermath' || draft.health <= 0) return;
    if (command.switchWeapon !== undefined) {
      draft.weaponIndex = command.switchWeapon;
      emit(draft, 'weapon-selected', null, { weapon: draft.weapons[draft.weaponIndex].id });
    }
    const weapon = draft.weapons[draft.weaponIndex],
      rule = ENCOUNTER_WEAPONS[weapon.id];
    for (const item of draft.weapons) if (item.cooldown > 0) item.cooldown--;
    if (weapon.reloadTicks > 0) {
      weapon.reloadTicks--;
      if (!weapon.reloadTicks) {
        const amount = Math.min(
          rule.magazine - weapon.ammo,
          weapon.reserve < 0 ? rule.magazine : weapon.reserve,
        );
        weapon.ammo += amount;
        if (weapon.reserve >= 0) weapon.reserve -= amount;
        emit(draft, 'reload-ready', null, { weapon: weapon.id, ammo: weapon.ammo });
      }
    }
    const held = !!(input.fire || input.actions & 1);
    draft.fireReleasedTicks = held ? 0 : draft.fireReleasedTicks + 1;
    if (definition.ammoPreset === 'arcade' && draft.fireReleasedTicks >= 50) {
      const elapsed = draft.fireReleasedTicks - 50;
      for (const item of draft.weapons) {
        const wait = item.id === 'rocket' ? 200 : 100;
        if (elapsed >= wait && item.ammo < ENCOUNTER_WEAPONS[item.id].magazine) {
          item.ammo = ENCOUNTER_WEAPONS[item.id].magazine;
          item.reloadTicks = 0;
          emit(draft, 'reload-ready', null, { weapon: item.id, ammo: item.ammo });
        }
      }
      if (elapsed >= 500) draft.payloadAmmo = payloadCapacity;
    }
    const beginReload = () => {
      if (!weapon.reloadTicks && weapon.ammo < rule.magazine && weapon.reserve !== 0) {
        weapon.reloadTicks = rule.reload;
        emit(draft, 'reload-start', null, { weapon: weapon.id, ticks: rule.reload });
      }
    };
    if (command.reload) beginReload();
    if (held && !weapon.cooldown && !weapon.reloadTicks) {
      if (!weapon.ammo) {
        emit(draft, 'weapon-empty', null, { weapon: weapon.id });
        weapon.cooldown = 15;
        beginReload();
      } else {
        const nose = unit(input.nose ?? { x: 0, y: 0, z: -1 }),
          origin = {
            ...player.position,
            y: player.position.y + (player.supportHeight ?? player.radius ?? 220),
          };
        const muzzle = input.muzzle ?? add(origin, nose, (player.radius ?? 220) + 40);
        const shotRadius = weapon.id === 'rocket' ? 100 : 25;
        if (!coveredEndpoint(origin, shotRadius) || !coveredEndpoint(muzzle, shotRadius)) {
          weapon.cooldown = rule.interval;
          emit(draft, 'weapon-blocked', null, { weapon: weapon.id, reason: 'encounter-boundary' });
        } else {
          const obstruction = geometry.sweepStatic(origin, muzzle, shotRadius);
          if (obstruction) {
            const attackId = draft.nextAttack++;
            weapon.ammo--;
            weapon.cooldown = rule.interval;
            draft.shots++;
            emit(draft, 'fire', null, {
              actor: 'player',
              position: origin,
              direction: nose,
              weapon: weapon.id,
              attackId,
              pellets: rule.pellets,
            });
            recordSurface(draft, obstruction, {
              weapon: weapon.id,
              damage: rule.damage,
              cause: 'pulse',
              severity: 'localized',
            });
            if (rule.blast)
              explode(
                draft,
                obstruction.position,
                rule.blast,
                rule.blastRadius,
                weapon.id,
                attackId,
              );
          } else if (
            addShots(draft, 'player', muzzle, nose, rule, weapon.id, player.velocity ?? zero())
          ) {
            weapon.ammo--;
            weapon.cooldown = rule.interval;
          }
        }
      }
    }
    draft.cooldown = weapon.cooldown;
    if (command.detonate || command.payload) {
      const remote = draft.ordnance.find((o) => o.kind === 'remote' && o.settled);
      if (definition.payload === 'remote' && remote && command.detonate) {
        explode(draft, remote.position, 200, 6000, 'remote');
        draft.ordnance = draft.ordnance.filter((o) => o.id !== remote.id);
      } else if (definition.payload === 'drone' && draft.payloadArmed && command.detonate) {
        draft.payloadArmed = false;
        explode(draft, player.position, 240, 7000, 'drone');
        playerDamage(draft, 100, { cause: 'drone-detonation' });
      } else if (command.payload && draft.payloadAmmo > 0 && draft.ordnance.length < 16) {
        if (definition.payload === 'drone' && !draft.payloadArmed) {
          draft.payloadAmmo--;
          draft.payloadArmed = true;
          draft.fireReleasedTicks = 0;
          emit(draft, 'payload-armed', null, { weapon: 'drone' });
        } else if (
          definition.payload !== 'drone' &&
          !(definition.payload === 'remote' && draft.ordnance.some((o) => o.kind === 'remote'))
        ) {
          const origin = {
              ...player.position,
              y: player.position.y + (player.supportHeight ?? player.radius ?? 220),
            },
            release = { ...origin, y: origin.y - 180 };
          if (
            coveredEndpoint(origin, 80) &&
            coveredEndpoint(release, 80) &&
            !geometry.sweepStatic(origin, release, 80)
          ) {
            draft.payloadAmmo--;
            draft.fireReleasedTicks = 0;
            const ordnance = {
              id: draft.nextProjectile++,
              kind: definition.payload,
              position: release,
              velocity: clone(player.velocity ?? zero()),
              settled: false,
              age: 0,
            };
            draft.ordnance.push(ordnance);
            emit(draft, 'payload', null, { position: release, weapon: definition.payload });
          }
        }
      }
    }
    if (
      definition.servicePad &&
      distance(player.position, definition.servicePad) < 2200 &&
      length(player.velocity ?? zero()) < 900 &&
      (input.throttle ?? player.throttle ?? 0) <= 0.1 &&
      !held &&
      !command.payload &&
      !command.detonate
    ) {
      draft.serviceTicks++;
      if (draft.serviceTicks === 250 && resupply(draft, true)) emit(draft, 'service-complete');
    } else draft.serviceTicks = 0;
  }
  function replenish(draft, player, command) {
    if (draft.phase === 'aftermath') return;
    if (
      draft.phase === 'intermission' &&
      (draft.ticks >= draft.nextWaveTick || command.startNextWave)
    ) {
      const reservations = [];
      const placements = prototypes.map((prototype, i) => {
        const at = clearSpawn(draft, i, player, true, reservations);
        if (at) reservations.push({ ...prototype, position: at });
        return at;
      });
      draft.waitingForClearSpawn = placements.some((p) => !p);
      if (!draft.waitingForClearSpawn) {
        draft.wave++;
        draft.phase = 'wave';
        draft.nextWaveTick = null;
        const previousComposition = draft.actors
          .map((a) => `${a.type}:${a.family}`)
          .sort()
          .join('|');
        placements.forEach((at, i) => spawn(draft, i, false, at));
        if (
          draft.actors
            .map((a) => `${a.type}:${a.family}`)
            .sort()
            .join('|') === previousComposition
        ) {
          const changed = draft.actors.find((a) => humanoid(a));
          if (changed) {
            changed.family = changed.appearance.family =
              FAMILIES[(FAMILIES.indexOf(changed.family) + 1) % FAMILIES.length];
            const plate = changed.family === 'shield-bearer';
            changed.components[0] = {
              id: plate ? 'plate' : 'mount',
              health: Math.max(1, Math.ceil(changed.maxHealth * (plate ? 0.4 : 0.3))),
              maxHealth: Math.max(1, Math.ceil(changed.maxHealth * (plate ? 0.4 : 0.3))),
            };
          }
        }
        emit(draft, 'wave', null, { wave: draft.wave });
      } else draft.nextWaveTick = draft.ticks + 1;
    }
    if (definition.activity === 'hunting' && draft.ticks < 9000)
      for (const [i, actor] of draft.actors.entries()) {
        if (actor.status !== 'defeated' || draft.ticks < actor.replacementTick) continue;
        const at = clearSpawn(draft, i, player);
        if (at) spawn(draft, i, false, at);
      }
    if (!isSurvival) return;
    const survival = draft.survival,
      minute = (draft.ticks + 1) / 3000;
    survival.pressure = minute < 1 ? 0.4 : minute < 2 ? 0.65 : minute < 4 ? 0.85 : 1;
    if (draft.ticks >= survival.nextFormationTick) {
      const forms = ['advance', 'flank', 'shield-front', 'interceptors', 'support-cover'].filter(
        (f) => f !== survival.formation,
      );
      survival.formation = forms[Math.floor(nextRandom(draft) * forms.length)];
      survival.nextFormationTick = draft.ticks + 1500 + Math.floor(nextRandom(draft) * 751);
      survival.reliefUntil =
        draft.ticks + { easy: 500, normal: 400, hard: 250 }[definition.difficulty];
      emit(draft, 'formation', null, { formation: survival.formation });
    }
    if (draft.ticks + 1 >= 15000 && !survival.finalSpawned) {
      const at = clearSpawn(draft, bossIndex, player);
      draft.waitingForClearSpawn = !at;
      if (at) {
        spawn(draft, bossIndex, false, at, 'final');
        survival.finalSpawned = true;
        emit(draft, 'final-arrival', draft.actors[bossIndex]);
      }
    }
    if (
      draft.waitingForClearSpawn ||
      (definition.survivalMode === 'timed' && draft.ticks + 1 >= 18000)
    )
      return;
    if (draft.ticks + 1 >= survival.nextEliteTick) {
      const index = draft.actors.findIndex((a, i) => i !== bossIndex && a.status !== 'active');
      const at = index >= 0 ? clearSpawn(draft, index, player) : null;
      if (at) {
        spawn(draft, index, false, at, 'elite');
        survival.nextEliteTick += 6000;
        emit(draft, 'elite-arrival', draft.actors[index]);
      } else if (index < 0) survival.nextEliteTick += 50;
    }
    if (draft.ticks + 1 >= survival.nextSupplyTick) {
      const candidate = draft.actors.find(
        (a) => a.status === 'active' && distance(a.position, player.position) > 5000,
      );
      if (candidate) {
        pickup(draft, 'guarded', candidate.position, true);
        survival.supplies++;
        survival.nextSupplyTick = survival.supplies === 1 ? 10500 : survival.nextSupplyTick + 6000;
      }
    }
    const target = Math.max(1, Math.floor((prototypes.length - 1) * survival.pressure));
    const active = draft.actors.filter((a, i) => i !== bossIndex && a.status === 'active').length;
    if (
      active >= target ||
      draft.ticks < survival.nextSpawnTick ||
      draft.ticks < survival.reliefUntil
    )
      return;
    const candidates = draft.actors
      .map((a, i) => ({ a, i }))
      .filter(
        ({ a, i }) =>
          i !== bossIndex &&
          a.status !== 'active' &&
          (a.replacementTick === null || draft.ticks >= a.replacementTick),
      );
    const entry = candidates.length
      ? candidates[Math.floor(nextRandom(draft) * candidates.length)]
      : null;
    if (entry) {
      const at = clearSpawn(draft, entry.i, player);
      if (at) spawn(draft, entry.i, false, at);
    }
    const base = minute < 1 ? 2 : minute < 2 ? 3 : minute < 4 ? 4 : 6;
    const rate = Math.min(
      10,
      base *
        (definition.survivalMode === 'endless' && minute > 6
          ? 1.1 ** Math.floor((minute - 6) / 2)
          : 1),
    );
    survival.nextSpawnTick = draft.ticks + Math.ceil(50 / rate);
  }
  function prepare({ player, input = {} }) {
    required(!pending, 'An encounter transaction is pending');
    required(state.status === 'active', 'Encounter has ended');
    vector(player.position);
    vector(player.velocity ?? zero());
    required(
      player.radius === undefined || integer(player.radius, 10, 3000),
      'Invalid player radius',
    );
    required(
      player.supportHeight === undefined || integer(player.supportHeight, 0, 3000),
      'Invalid player support height',
    );
    if (input.nose !== undefined)
      required(
        AXES.every((key) => Number.isFinite(input.nose[key])) && length(input.nose) > 0,
        'Invalid firing direction',
      );
    if (input.muzzle !== undefined) {
      vector(input.muzzle);
      required(distance(input.muzzle, player.position) <= 5000, 'Invalid muzzle offset');
    }
    if (input.commandSeq !== undefined)
      required(integer(input.commandSeq, 0, Number.MAX_SAFE_INTEGER), 'Invalid command sequence');
    required(
      input.switchWeapon === undefined || [0, 1].includes(input.switchWeapon),
      'Invalid weapon slot',
    );
    const draft = clone(state);
    draft.events = [];
    draft.defeats = [];
    draft.newImpacts = [];
    const command = commandInput(draft, input);
    if (definition.activity === 'strike' && player.crashed && draft.phase !== 'aftermath') {
      draft.health = 0;
      draft.phase = 'aftermath';
      draft.aftermathUntil = draft.ticks + 1000;
      draft.projectiles = draft.projectiles.filter((p) => p.owner === 'player');
      emit(draft, 'aftermath');
    }
    replenish(draft, player, command);
    const neighbours = actorIndex(draft.actors);
    const motions = draft.actors.map((actor) => ({
      id: actor.slotId,
      actorId: actor.id,
      from: moveActor(draft, actor, player, neighbours),
      to: clone(actor.position),
      enabled: actor.status === 'active',
    }));
    pending = {
      transaction: ++serial,
      draft,
      before: clone(player),
      input: clone(input),
      command,
      motions,
    };
    return {
      transaction: pending.transaction,
      motions: clone(motions),
      actors: clone(draft.actors),
    };
  }
  function commit(
    { transaction, accepted = true, player, trace = null, contacts = [] },
    presentation = false,
  ) {
    const view = presentation ? frameSnapshot : snapshot;
    required(pending && pending.transaction === transaction, 'Unknown encounter transaction');
    if (!accepted) {
      pending = null;
      return view();
    }
    vector(player.position);
    vector(player.velocity ?? zero());
    required(Array.isArray(contacts) && contacts.length <= 1024, 'Invalid contact budget');
    required(
      player.radius === undefined || integer(player.radius, 10, 3000),
      'Invalid player radius',
    );
    required(
      player.supportHeight === undefined || integer(player.supportHeight, 0, 3000),
      'Invalid player support height',
    );
    for (const contact of contacts)
      required(
        (contact.normal === undefined ||
          AXES.every((key) => Number.isFinite(contact.normal[key]))) &&
          (contact.relativeNormalSpeedMmS === undefined ||
            (Number.isFinite(contact.relativeNormalSpeedMmS) &&
              contact.relativeNormalSpeedMmS >= 0)),
        'Invalid accepted contact',
      );
    const { draft, before, input, command, motions } = pending,
      radius = player.radius ?? 220;
    const motionBySlot = new Map(motions.map((m) => [m.id, m]));
    const path =
      trace?.length >= 2
        ? trace.map((p) => clone(p.position ?? p))
        : [before.position, player.position];
    required(path.length <= 1024, 'Invalid accepted trace budget');
    path.forEach((p) => vector(p));
    const touching = new Set();
    if (
      draft.phase !== 'aftermath' &&
      draft.payloadArmed &&
      state.payloadArmed &&
      (player.crashed || contacts.length)
    ) {
      draft.payloadArmed = false;
      explode(draft, player.position, 240, 7000, 'drone');
      playerDamage(draft, 100, { cause: 'drone-detonation' });
    }
    if (draft.phase !== 'aftermath')
      for (const actor of draft.actors) {
        if (actor.status !== 'active') continue;
        const motion = motionBySlot.get(actor.slotId);
        let hit = null;
        for (let i = 1; i < path.length && !hit; i++)
          hit = sweptSphere(
            { ...path[i - 1], y: path[i - 1].y + (before.supportHeight ?? radius) },
            { ...path[i], y: path[i].y + (player.supportHeight ?? radius) },
            radius,
            actor,
            mix(motion.from, motion.to, (i - 1) / (path.length - 1)),
            mix(motion.from, motion.to, i / (path.length - 1)),
          );
        const explicit = contacts.find((c) => [actor.id, actor.slotId].includes(c.actorId ?? c.id));
        if (explicit) {
          required(
            explicit.relativeNormalSpeedMmS === undefined ||
              (Number.isFinite(explicit.relativeNormalSpeedMmS) &&
                explicit.relativeNormalSpeedMmS >= 0),
            'Invalid contact speed',
          );
          hit = {
            ...hit,
            position: clone(hit?.position ?? centre(actor)),
            normal: unit(
              explicit.normal ?? hit?.normal ?? subtract(before.position, actor.position),
            ),
          };
        }
        if (!hit) continue;
        touching.add(actor.id);
        if (draft.payloadArmed) {
          draft.payloadArmed = false;
          explode(draft, player.position, 240, 7000, 'drone');
          playerDamage(draft, 100, { cause: 'drone-detonation' });
        }
        const lock = draft.contactLocks[actor.id];
        const impactLocked = lock && (!lock.separated || draft.ticks - lock.tick < 13);
        // Legacy impact locks also suppressed an enemy's ongoing contact attack.
        // New crowd rules keep impact re-hit protection independent of pressure.
        if (impactLocked && !squadLanes) continue;
        const speed =
          explicit?.relativeNormalSpeedMmS ??
          Math.max(0, -dot(subtract(before.velocity ?? zero(), actor.velocity), hit.normal));
        const damage = encounterImpactDamage(speed);
        if (!impactLocked && damage > 0) {
          const healthBefore = actor.health;
          hurt(
            draft,
            actor,
            damage,
            'impact',
            { ...hit, velocity: add(zero(), hit.normal, -speed) },
            before.position,
          );
          playerDamage(draft, Math.floor((healthBefore - actor.health) * policy.self), {
            cause: 'impact',
            position: clone(player.position),
          });
          draft.contactLocks[actor.id] = { tick: draft.ticks, separated: false };
        }
        if (
          definition.activity !== 'hunting' &&
          actor.status === 'active' &&
          (!squadLanes || draft.ticks - actor.spawnTick >= 100) &&
          draft.ticks >= draft.contactProtectionUntil
        ) {
          playerDamage(draft, Math.round(20 * policy.incoming), {
            cause: 'contact',
            sourceId: actor.id,
          });
          draft.contactProtectionUntil = draft.ticks + 38;
        }
      }
    const living = new Set(draft.actors.map((a) => a.id));
    for (const [id, lock] of Object.entries(draft.contactLocks)) {
      if (!living.has(id)) delete draft.contactLocks[id];
      else if (!touching.has(id)) lock.separated = true;
    }
    weapons(draft, player, input, command);
    const playerCentre = {
      ...player.position,
      y: player.position.y + (player.supportHeight ?? radius),
    };
    const attackers =
      definition.activity === 'hunting' || draft.phase === 'aftermath'
        ? []
        : draft.actors
            .filter(
              (a) =>
                a.status === 'active' &&
                (a.fireEveryTicks > 0 || a.special === 'final') &&
                !(a.componentMask & 1 && a.components[0].id === 'mount') &&
                draft.ticks - a.spawnTick >= 100 &&
                distance(centre(a), playerCentre) <= a.range &&
                geometry.visible(centre(a), playerCentre),
            )
            .sort(
              (a, b) =>
                distance(centre(a), playerCentre) - distance(centre(b), playerCentre) ||
                a.slotIndex - b.slotIndex,
            )
            .slice(0, policy.attackers);
    for (const actor of attackers) {
      const final = actor.special === 'final',
        attackPhase = (draft.ticks - actor.spawnTick) % 300;
      if (final && (attackPhase < 60 || attackPhase >= 120)) {
        actor.warning ||= attackPhase < 60;
        continue;
      }
      actor.cooldown = Math.max(0, actor.cooldown - 1);
      actor.warning ||= actor.cooldown <= 40;
      if (!actor.cooldown) {
        const heavy = actor.type === 'vehicle',
          scatter = actor.family === 'shield-bearer';
        const rule = {
          pellets: scatter || final ? 3 : 1,
          damage: Math.round(
            Math.max(final ? 15 : 0, actor.damage) * policy.incoming * (scatter || final ? 0.5 : 1),
          ),
          speed: actor.projectileSpeed,
          range: actor.range,
          spread: scatter || final ? 0.05 : 0,
          ...(heavy ? { blast: Math.round(20 * policy.incoming), blastRadius: 2000 } : {}),
        };
        addShots(
          draft,
          actor.id,
          centre(actor),
          subtract(playerCentre, centre(actor)),
          rule,
          actor.type === 'vehicle'
            ? 'enemy-heavy'
            : actor.type === 'drone' || actor.type === 'hazard'
              ? 'enemy-energy'
              : 'enemy-rifle',
        );
        actor.cooldown = final ? 20 : Math.max(50, actor.fireEveryTicks);
      }
    }
    const queryActors = actorIndex(draft.actors, motionBySlot);
    // Resident encounter geometry ends at the admitted horizontal boundary.
    // Sweep only the supported portion; leaving it expires a shot without
    // inventing a wall impact or querying an unloaded neighboring cell.
    const admittedSegment = (from, to, radius) => {
      let fraction = 1;
      for (const axis of ['x', 'z']) {
        const low = definition.bounds.min[axis] + radius + 1;
        const high = definition.bounds.max[axis] - radius - 1;
        if (from[axis] < low || from[axis] > high) return null;
        const change = to[axis] - from[axis];
        if (to[axis] < low) fraction = Math.min(fraction, (low - from[axis]) / change);
        if (to[axis] > high) fraction = Math.min(fraction, (high - from[axis]) / change);
      }
      return { to: mix(from, to, fraction), exits: fraction < 1 };
    };
    const survivors = [];
    for (const projectile of draft.projectiles) {
      const segment = admittedSegment(
        projectile.position,
        add(projectile.position, projectile.velocity, 0.02),
        projectile.radius,
      );
      if (!segment) continue;
      const next = segment.to;
      const wall = geometry.sweepStatic(projectile.position, next, projectile.radius);
      let best = wall ? { ...wall } : null;
      if (projectile.owner === 'player')
        for (const actor of queryActors(projectile.position, next, projectile.radius)) {
          if (actor.status !== 'active') continue;
          const motion = motionBySlot.get(actor.slotId);
          const hit = sweptSphere(
            projectile.position,
            next,
            projectile.radius,
            actor,
            motion.from,
            motion.to,
          );
          if (hit && (!best || hit.toi < best.toi)) best = { ...hit, actor };
        }
      else {
        if (draft.phase !== 'aftermath') {
          const hit = sweptSphere(
            projectile.position,
            next,
            projectile.radius,
            { position: player.position, type: 'drone', radius, height: radius * 2 },
            {
              ...before.position,
              y: before.position.y + (before.supportHeight ?? radius) - radius,
            },
            {
              ...player.position,
              y: player.position.y + (player.supportHeight ?? radius) - radius,
            },
          );
          if (hit && (!best || hit.toi < best.toi)) best = { ...hit, player: true };
        }
        for (const actor of queryActors(projectile.position, next, projectile.radius)) {
          if (actor.status !== 'active' || actor.id === projectile.owner) continue;
          const motion = motionBySlot.get(actor.slotId),
            hit = sweptSphere(
              projectile.position,
              next,
              projectile.radius,
              actor,
              motion.from,
              motion.to,
            );
          if (hit && (!best || hit.toi < best.toi)) best = { ...hit, cover: true };
        }
      }
      if (best) {
        if (best.actor)
          hurt(
            draft,
            best.actor,
            projectile.damage,
            projectile.weapon,
            { ...best, velocity: projectile.velocity },
            projectile.position,
            projectile.attackId,
          );
        else if (best.player)
          playerDamage(draft, projectile.damage, {
            cause: 'pulse',
            position: best.position,
            normal: best.normal,
            weapon: projectile.weapon,
          });
        else if (!best.cover)
          recordSurface(draft, best, {
            weapon: projectile.weapon,
            cause: 'pulse',
            damage: projectile.damage,
            severity: projectile.damage >= 60 ? 'high' : 'localized',
          });
        if (projectile.blast) {
          const position = add(best.position, best.normal ?? { x: 0, y: 1, z: 0 }, 30);
          if (projectile.owner === 'player')
            explode(
              draft,
              position,
              projectile.blast,
              projectile.blastRadius,
              projectile.weapon,
              projectile.attackId,
            );
          else {
            emit(draft, 'explosion', null, {
              position,
              radius: projectile.blastRadius,
              weapon: projectile.weapon,
              damage: projectile.blast,
              severity: 'explosive',
            });
            const range = distance(position, playerCentre);
            if (range < projectile.blastRadius && geometry.visible(position, playerCentre))
              playerDamage(
                draft,
                Math.round(projectile.blast * (1 - range / projectile.blastRadius)),
                { cause: 'explosion', position, weapon: projectile.weapon },
              );
          }
        }
      } else {
        projectile.ttl--;
        projectile.remainingRange -= distance(projectile.position, next);
        if (
          !segment.exits &&
          projectile.ttl > 0 &&
          projectile.remainingRange > 0 &&
          within(next, definition.bounds)
        )
          survivors.push({ ...projectile, position: next });
      }
    }
    draft.projectiles = survivors;
    const ordnance = [];
    for (const item of draft.ordnance) {
      if (item.settled) {
        ordnance.push(item);
        continue;
      }
      item.age++;
      item.velocity.y -= 196;
      const segment = admittedSegment(item.position, add(item.position, item.velocity, 0.02), 80);
      if (!segment) continue;
      const next = segment.to,
        hit = geometry.sweepStatic(item.position, next, 80);
      if (hit) {
        if (item.kind === 'bomb')
          explode(
            draft,
            add(hit.position, hit.normal ?? { x: 0, y: 1, z: 0 }, 90),
            160,
            5000,
            'bomb',
          );
        else {
          item.position = add(hit.position, hit.normal ?? { x: 0, y: 1, z: 0 }, 90);
          item.velocity = zero();
          item.settled = true;
          ordnance.push(item);
          emit(draft, 'payload-ready', null, { weapon: 'remote', position: item.position });
        }
      } else if (!segment.exits && within(next, definition.bounds) && item.age <= 1500) {
        item.position = next;
        ordnance.push(item);
      }
    }
    draft.ordnance = ordnance;
    // The accepted aircraft can be destroyed independently of combat hull
    // damage. Ordinary activities give that terminal failure priority over a
    // simultaneous last defeat; Strike retains its explicit payload exception.
    if (player.crashed) draft.health = 0;
    if (draft.health > 0 && draft.phase !== 'aftermath') {
      const kept = [];
      for (const item of draft.pickups) {
        let consumed = false;
        const near = distance(item.position, player.position) <= 1800;
        const guarded =
          item.guarded &&
          draft.actors.some(
            (a) => a.status === 'active' && distance(a.position, item.position) < 4500,
          );
        if (item.guarded && !near) item.entryReady = true;
        if (item.guarded && near && guarded) item.entryReady = false;
        if (near && !guarded && item.kind === 'health' && draft.health < draft.maxHealth) {
          draft.health = Math.min(draft.maxHealth, draft.health + 25);
          consumed = true;
        }
        if (near && !guarded && item.kind === 'ammo' && definition.ammoPreset === 'balanced')
          consumed = resupply(draft);
        if (near && !guarded && item.entryReady && item.kind === 'guarded') {
          if (draft.health < draft.maxHealth) {
            draft.health = Math.min(
              draft.maxHealth,
              draft.health + { easy: 35, normal: 25, hard: 15 }[definition.difficulty],
            );
            consumed = true;
          } else if (definition.ammoPreset !== 'tactical') consumed = resupply(draft);
        }
        if (consumed)
          emit(draft, 'pickup', null, {
            kind: item.kind,
            health: draft.health,
            position: item.position,
          });
        else kept.push(item);
      }
      draft.pickups = kept;
      draft.pendingPickups = draft.pendingPickups.filter((item) => {
        if (item.surfacePending) {
          const support = pickupSupport(item.position);
          if (!support) return true;
          item.position = support;
          item.surfacePending = false;
        }
        if (
          draft.pickups.filter((p) => p.kind === item.kind).length <
          (item.kind === 'health' ? 2 : 8)
        ) {
          draft.pickups.push(item);
          return false;
        }
        return true;
      });
    }
    draft.ticks++;
    const requiredActors = draft.actors.filter((a) => a.type !== 'prop'),
      allDefeated = requiredActors.every((a) => a.status === 'defeated');
    const strikeTarget = draft.actors.find((a) => a.type === 'vehicle') ?? requiredActors.at(-1);
    let reason = null;
    if (definition.activity === 'strike' && strikeTarget?.status === 'defeated') {
      draft.status = 'complete';
      reason = 'strike-complete';
    } else if (draft.health <= 0) {
      if (
        definition.activity === 'strike' &&
        draft.phase !== 'aftermath' &&
        (draft.ordnance.length || draft.projectiles.some((p) => p.owner === 'player'))
      ) {
        draft.phase = 'aftermath';
        draft.aftermathUntil = draft.ticks + 1000;
        draft.projectiles = draft.projectiles.filter((p) => p.owner === 'player');
        emit(draft, 'aftermath');
      } else if (draft.phase !== 'aftermath' || draft.ticks >= draft.aftermathUntil) {
        draft.status = 'failed';
        reason = 'player-defeated';
      }
    } else if (definition.activity === 'hunting' && draft.ticks >= 9000) {
      draft.status = 'complete';
      reason = 'time-complete';
    } else if (definition.activity === 'elimination' && allDefeated) {
      draft.status = 'complete';
      reason = 'targets-cleared';
    } else if (
      isSurvival &&
      definition.survivalMode === 'timed' &&
      draft.ticks >= 18000 &&
      draft.survival.finalDefeated
    ) {
      draft.status = 'complete';
      reason = 'survival-complete';
    } else if (definition.activity === 'continuous' && draft.phase === 'wave' && allDefeated) {
      draft.phase = 'intermission';
      draft.nextWaveTick = draft.ticks + (draft.ticks - draft.lastDamageTick <= 250 ? 500 : 250);
    }
    if (reason) {
      draft.result = { reason, tick: draft.ticks, kills: draft.kills, score: draft.score };
      emit(draft, 'result', null, { result: clone(draft.result) });
    }
    if (draft.defeats.length) defeatRecords = [...defeatRecords, ...draft.defeats].slice(-1024);
    if (draft.newImpacts.length)
      impactRecords = [...impactRecords, ...draft.newImpacts].slice(-1024);
    delete draft.defeats;
    delete draft.newImpacts;
    state = draft;
    pending = null;
    return view();
  }
  function checkpoint() {
    const saved = {
      ...clone(state),
      defeats: clone(defeatRecords),
      impactRecords: clone(impactRecords),
    };
    return {
      format: 'FPVEncounterCheckpoint.v2',
      definition: clone(definition),
      state: saved,
      checksum: dataIdentity({ definition, state: saved }),
    };
  }
  function restore(record) {
    required(!pending, 'An encounter transaction is pending');
    const saved = boundedJSON(record, {
      maxBytes: 8 * 1024 * 1024,
      maxNodes: 800000,
      maxArray: 4096,
      maxDepth: 24,
      maxString: 4096,
    });
    exactKeys(saved, ['format', 'definition', 'state', 'checksum'], 'Encounter checkpoint');
    required(
      saved.format === 'FPVEncounterCheckpoint.v2' &&
        dataIdentity(validateEncounterDefinition(saved.definition)) === identity &&
        saved.checksum === dataIdentity({ definition: saved.definition, state: saved.state }),
      'Encounter checkpoint identity or checksum differs',
    );
    const next = saved.state;
    exactKeys(
      next,
      [...Object.keys(initial), 'defeats', 'impactRecords'],
      'Encounter checkpoint state',
    );
    required(
      Object.keys(initial).every((key) => Object.hasOwn(next, key)) &&
        next.format === ENCOUNTER_STATE_V2 &&
        next.definitionIdentity === identity &&
        next.runId === runId,
      'Invalid encounter checkpoint identity',
    );
    for (const key of [
      'ticks',
      'wave',
      'kills',
      'rewardKills',
      'shots',
      'hits',
      'score',
      'successfulImpacts',
      'streak',
      'bestStreak',
      'nextSpawn',
      'nextProjectile',
      'nextAttack',
      'nextPickup',
      'nextEvent',
      'cooldown',
      'lastCommandSeq',
      'commandMask',
      'fireReleasedTicks',
      'serviceTicks',
      'contactProtectionUntil',
    ])
      required(integer(next[key], 0, 1000000000), `Invalid encounter checkpoint ${key}`);
    required(
      integer(next.health, 0, 100) &&
        next.maxHealth === 100 &&
        next.hits <= next.shots &&
        next.score === next.kills * 100 &&
        next.rewardKills <= next.kills &&
        next.streak <= next.bestStreak &&
        next.bestStreak <= next.kills &&
        integer(next.rng, 1, 0xffffffff),
      'Invalid encounter counters',
    );
    required(
      ['active', 'failed', 'complete'].includes(next.status) &&
        ['wave', 'intermission', 'aftermath'].includes(next.phase) &&
        (next.phase !== 'aftermath' || definition.activity === 'strike'),
      'Invalid encounter progress',
    );
    required(
      Array.isArray(next.actors) &&
        next.actors.length === prototypes.length &&
        Array.isArray(next.projectiles) &&
        next.projectiles.length <= 64 &&
        Array.isArray(next.ordnance) &&
        next.ordnance.length <= 16 &&
        Array.isArray(next.defeats) &&
        next.defeats.length <= 1024 &&
        Array.isArray(next.impactRecords) &&
        next.impactRecords.length <= 1024 &&
        Array.isArray(next.pickups) &&
        next.pickups.length <= 20 &&
        Array.isArray(next.pendingPickups) &&
        next.pendingPickups.length <= 20,
      'Invalid encounter budgets',
    );
    required(
      [0, 1].includes(next.weaponIndex) &&
        Array.isArray(next.weapons) &&
        next.weapons.length === 2 &&
        integer(next.payloadAmmo, 0, payloadCapacity) &&
        typeof next.payloadArmed === 'boolean',
      'Invalid loadout state',
    );
    for (const [i, item] of next.weapons.entries()) {
      exactKeys(
        item,
        ['id', 'ammo', 'reserve', 'reloadTicks', 'reloadTotal', 'cooldown'],
        'Weapon state',
      );
      const rule = ENCOUNTER_WEAPONS[definition.loadout[i]];
      required(
        item.id === definition.loadout[i] &&
          integer(item.ammo, 0, rule.magazine) &&
          integer(item.reserve, -1, rule.magazine * 3) &&
          integer(item.reloadTicks, 0, rule.reload) &&
          item.reloadTotal === rule.reload &&
          integer(item.cooldown, 0, rule.interval),
        'Invalid weapon state',
      );
    }
    required(
      integer(next.nextHealthReward, 12, 1000000000) &&
        next.nextHealthReward === (Math.floor(next.rewardKills / 12) + 1) * 12 &&
        integer(next.nextAmmoReward, 3, 1000000000) &&
        (definition.ammoPreset !== 'balanced' ||
          next.nextAmmoReward === (Math.floor(next.rewardKills / 3) + 1) * 3),
      'Invalid reward thresholds',
    );
    required(
      next.commandMask <= 31 &&
        integer(next.lastDamageTick, -10000, next.ticks) &&
        typeof next.waitingForClearSpawn === 'boolean' &&
        (next.phase !== 'intermission' || definition.activity === 'continuous') &&
        (next.phase !== 'intermission' || integer(next.nextWaveTick, 0, next.ticks + 500)),
      'Invalid encounter phase',
    );
    required(next.status !== 'failed' || next.health === 0, 'Invalid failed health');
    required(
      next.health > 0 ||
        next.status === 'failed' ||
        (definition.activity === 'strike' &&
          (next.phase === 'aftermath' || next.status === 'complete')),
      'Invalid living health',
    );
    required(
      next.aftermathUntil === null ||
        (definition.activity === 'strike' && integer(next.aftermathUntil, 0, next.ticks + 1000)),
      'Invalid aftermath deadline',
    );
    required(
      Array.isArray(next.events) &&
        next.events.length <= 2048 &&
        Array.isArray(next.attackHits) &&
        next.attackHits.length <= 256 &&
        new Set(next.attackHits).size === next.attackHits.length &&
        next.attackHits.every((id) => integer(id, 1, next.nextAttack - 1)),
      'Invalid encounter events or hit accounting',
    );
    const seen = new Set();
    for (const [i, actor] of next.actors.entries()) {
      exactKeys(
        actor,
        [
          ...Object.keys(prototypes[i]),
          'slotIndex',
          'slotId',
          'sourceId',
          'spawnId',
          'velocity',
          'status',
          'maxHealth',
          'pathIndex',
          'cooldown',
          'warning',
          'heading',
          'spawnTick',
          'defeatedTick',
          'replacementTick',
          'blocked',
          'componentMask',
          'special',
          'squad',
          'lastHitTick',
          'lastPositionIndex',
          'routeDirection',
          'nextSpawnChoice',
          'components',
        ],
        'Encounter checkpoint actor',
      );
      required(
        actor.slotIndex === i &&
          actor.slotId === slotId(i) &&
          actor.sourceId === prototypes[i].id &&
          actor.id === actor.spawnId &&
          typeof actor.id === 'string' &&
          actor.id.startsWith(`${runId}:`) &&
          !seen.has(actor.id),
        'Invalid actor identity',
      );
      seen.add(actor.id);
      vector(actor.position);
      vector(actor.velocity);
      required(
        within(actor.position, definition.bounds) &&
          actor.type === prototypes[i].type &&
          actor.radius === prototypes[i].radius &&
          actor.height === prototypes[i].height &&
          integer(actor.health, 0, actor.maxHealth) &&
          [prototypes[i].health, prototypes[i].health * 2, prototypes[i].health * 4].includes(
            actor.maxHealth,
          ) &&
          ['active', 'defeated', 'waiting'].includes(actor.status) &&
          (actor.status === 'defeated') === (actor.health === 0) &&
          integer(actor.componentMask, 0, 3),
        'Invalid actor body',
      );
      required(
        dataIdentity(actor.path) === dataIdentity(prototypes[i].path) &&
          actor.appearance.cast === prototypes[i].appearance.cast &&
          actor.appearance.archetype === prototypes[i].appearance.archetype &&
          actor.role === 'hostile' &&
          integer(actor.pathIndex, 0, Math.max(0, actor.path.length - 1)),
        'Invalid actor capabilities',
      );
      required(
        Array.isArray(actor.components) &&
          actor.components.length === 2 &&
          actor.components.every(
            (c) =>
              ['plate', 'mount', 'equipment', 'core'].includes(c.id) &&
              integer(c.health, 0, c.maxHealth) &&
              integer(c.maxHealth, 1, 4000),
          ),
        'Invalid actor components',
      );
      required(
        FAMILIES.includes(actor.family) &&
          actor.appearance.family === actor.family &&
          [null, 'elite', 'final'].includes(actor.special) &&
          (actor.special === null || isSurvival) &&
          (actor.special !== 'final' || i === bossIndex) &&
          actor.maxHealth ===
            prototypes[i].health *
              (actor.special === 'final' ? 4 : actor.special === 'elite' ? 2 : 1),
        'Invalid actor role',
      );
      for (const key of [
        'speed',
        'material',
        'destructible',
        'fireEveryTicks',
        'damage',
        'projectileSpeed',
        'range',
        'groundMotion',
        'vehicleModel',
        'spawnZone',
      ])
        required(
          JSON.stringify(actor[key]) === JSON.stringify(prototypes[i][key]),
          'Actor capabilities changed',
        );
      exactKeys(actor.appearance, ['family', 'cast', 'archetype'], 'Actor appearance');
      required(
        integer(actor.cooldown, 0, 5000) &&
          integer(actor.spawnTick, 0, next.ticks) &&
          integer(actor.lastHitTick, -10000, next.ticks) &&
          typeof actor.warning === 'boolean' &&
          typeof actor.blocked === 'boolean' &&
          actor.squad === Math.floor(i / 6) &&
          [-1, 1].includes(actor.routeDirection) &&
          integer(actor.lastPositionIndex, 0, actor.path.length) &&
          integer(actor.nextSpawnChoice, 0, Math.max(0, actor.path.length - 2)),
        'Invalid actor timeline',
      );
      required(actor.status !== 'waiting' || isSurvival, 'Unexpected dormant actor');
      if (actor.status === 'defeated')
        required(
          integer(actor.defeatedTick, actor.spawnTick, next.ticks) &&
            integer(actor.replacementTick, actor.defeatedTick + 200, actor.defeatedTick + 400),
          'Invalid replacement time',
        );
      else
        required(
          actor.defeatedTick === null && actor.replacementTick === null,
          'Unexpected defeat timeline',
        );
      exactKeys(actor.heading, AXES, 'Actor heading');
      required(
        AXES.every(
          (key) => Number.isFinite(actor.heading[key]) && Math.abs(actor.heading[key]) <= 1.00001,
        ),
        'Invalid actor heading',
      );
      for (const [j, c] of actor.components.entries()) {
        exactKeys(c, ['id', 'health', 'maxHealth'], 'Actor component');
        const expected = j
          ? humanoid(actor)
            ? 'equipment'
            : 'core'
          : actor.family === 'shield-bearer'
            ? 'plate'
            : 'mount';
        required(
          c.id === expected &&
            c.maxHealth ===
              Math.max(
                1,
                Math.ceil(actor.maxHealth * (j ? 0.25 : expected === 'plate' ? 0.4 : 0.3)),
              ) &&
            Boolean(actor.componentMask & (1 << j)) === (c.health === 0),
          'Invalid component capabilities',
        );
      }
    }
    for (const shot of next.projectiles) {
      vector(shot.position);
      vector(shot.velocity);
      required(
        integer(shot.id, 1, next.nextProjectile - 1) &&
          integer(shot.ttl, 1, 10000) &&
          Number.isFinite(shot.remainingRange) &&
          shot.remainingRange > 0 &&
          integer(shot.damage, 0, 1500) &&
          (shot.owner === 'player' ||
            (typeof shot.owner === 'string' && shot.owner.startsWith(`${runId}:`))),
        'Invalid projectile',
      );
    }
    for (const item of next.ordnance) {
      vector(item.position);
      vector(item.velocity);
      required(
        ['bomb', 'remote'].includes(item.kind) &&
          typeof item.settled === 'boolean' &&
          integer(item.age, 0, 1500),
        'Invalid payload',
      );
    }
    for (const item of [...next.pickups, ...next.pendingPickups]) {
      vector(item.position);
      required(
        ['health', 'ammo', 'guarded'].includes(item.kind) &&
          within(item.position, definition.bounds),
        'Invalid pickup',
      );
    }
    required(
      integer(next.survival.nextEliteTick, 0, 1000000000) &&
        integer(next.survival.nextSpawnTick, 0, 1000000000) &&
        next.survival.mode === definition.survivalMode &&
        typeof next.survival.finalDefeated === 'boolean' &&
        typeof next.survival.finalSpawned === 'boolean',
      'Invalid survival state',
    );
    required(
      next.status === 'active'
        ? next.result === null
        : next.result?.tick === next.ticks &&
            next.result.kills === next.kills &&
            next.result.score === next.score,
      'Invalid result',
    );
    if (next.status === 'complete')
      required(
        definition.activity === 'hunting'
          ? next.ticks === 9000 && next.result.reason === 'time-complete'
          : definition.activity === 'elimination'
            ? next.result.reason === 'targets-cleared' &&
              next.actors.every((a) => a.type === 'prop' || a.status === 'defeated')
            : definition.activity === 'strike'
              ? next.result.reason === 'strike-complete' &&
                (
                  next.actors.find((a) => a.type === 'vehicle') ??
                  next.actors.filter((a) => a.type !== 'prop').at(-1)
                )?.status === 'defeated'
              : isSurvival &&
                definition.survivalMode === 'timed' &&
                next.ticks >= 18000 &&
                next.survival.finalDefeated &&
                next.result.reason === 'survival-complete',
        'Invalid encounter completion',
      );
    if (next.status === 'failed')
      required(next.result.reason === 'player-defeated', 'Invalid defeat result');
    const eventIds = new Set();
    for (const event of [...next.defeats, ...next.impactRecords]) {
      required(
        typeof event.eventId === 'string' &&
          event.eventId.startsWith(`${runId}:`) &&
          integer(Number(event.eventId.slice(runId.length + 1)), 1, next.nextEvent - 1) &&
          !eventIds.has(event.eventId) &&
          integer(event.tick, 1, next.ticks),
        'Invalid presentation event identity',
      );
      eventIds.add(event.eventId);
      vector(event.position);
      required(event.type === 'defeat' || event.type === 'surface-impact', 'Invalid durable event');
      if (event.surface) {
        vector(event.surface.position);
        required(
          AXES.every(
            (key) =>
              Number.isFinite(event.surface.normal?.[key]) &&
              Math.abs(event.surface.normal[key]) <= 1.00001,
          ),
          'Invalid impact surface',
        );
      }
    }
    required(next.defeats.length <= next.kills, 'Defeat ledger exceeds rewards');
    const survival = next.survival;
    exactKeys(survival, Object.keys(initial.survival), 'Survival state');
    for (const key of [
      'reliefUntil',
      'nextFormationTick',
      'nextSupplyTick',
      'regroupUntil',
      'nextReliefAllowed',
      'supplies',
    ])
      required(integer(survival[key], 0, 1000000000), 'Invalid survival clock');
    required(
      ['advance', 'flank', 'shield-front', 'interceptors', 'support-cover'].includes(
        survival.formation,
      ) &&
        [0.4, 0.65, 0.85, 1].includes(survival.pressure) &&
        Array.isArray(survival.recentDefeats) &&
        survival.recentDefeats.length <= 128 &&
        survival.recentDefeats.every((tick) => integer(tick, 0, next.ticks)),
      'Invalid survival progression',
    );
    if (survival.finalDefeated)
      required(
        survival.finalSpawned &&
          next.actors[bossIndex].special === 'final' &&
          next.actors[bossIndex].status === 'defeated',
        'Invalid final defeat',
      );
    exactKeys(
      next.challenge,
      ['type', 'goal', 'progress', 'complete', 'startTick'],
      'Skill challenge',
    );
    required(
      next.challenge.type === challengeType &&
        next.challenge.goal === challengeGoal &&
        integer(next.challenge.progress, 0, challengeGoal) &&
        typeof next.challenge.complete === 'boolean' &&
        next.challenge.complete === (next.challenge.progress === challengeGoal) &&
        next.challenge.startTick === 0,
      'Invalid challenge',
    );
    for (const lock of Object.values(next.contactLocks)) {
      exactKeys(lock, ['tick', 'separated'], 'Contact lock');
      required(
        integer(lock.tick, 0, next.ticks) && typeof lock.separated === 'boolean',
        'Invalid contact lock',
      );
    }
    defeatRecords = clone(next.defeats);
    impactRecords = clone(next.impactRecords);
    delete next.defeats;
    delete next.impactRecords;
    next.events = [];
    state = next;
    return snapshot();
  }
  return Object.freeze({
    definition: () => clone(definition),
    identity,
    snapshot,
    frameSnapshot,
    summary: () => ({
      status: state.status,
      phase: state.phase,
      ticks: state.ticks,
      runId: state.runId,
      lastCommandSeq: state.lastCommandSeq,
    }),
    prepare(options) {
      try {
        if (geometry.ready && !geometry.ready(definition.bounds)) unavailable();
        return prepare(options);
      } catch (error) {
        if (error.code !== 'ENCOUNTER_GEOMETRY_UNAVAILABLE') throw error;
        pending = null;
        return { transaction: null, rejected: 'geometry-unavailable', actors: [], motions: [] };
      }
    },
    commit(options, presentation = false) {
      try {
        if (geometry.ready && !geometry.ready(definition.bounds)) unavailable();
        return commit(options, presentation);
      } catch (error) {
        if (error.code !== 'ENCOUNTER_GEOMETRY_UNAVAILABLE') throw error;
        pending = null;
        return {
          ...(presentation ? frameSnapshot() : snapshot()),
          rejected: 'geometry-unavailable',
        };
      }
    },
    commitFrame(options) {
      return this.commit(options, true);
    },
    checkpoint,
    restore,
    cancel(transaction, presentation = false) {
      required(pending && pending.transaction === transaction, 'Unknown encounter transaction');
      pending = null;
      return presentation ? frameSnapshot() : snapshot();
    },
    cancelFrame(transaction) {
      return this.cancel(transaction, true);
    },
    defeats: () => clone(defeatRecords),
    impacts: () => clone(impactRecords),
    requestNextWave() {
      required(
        !pending && state.status === 'active' && state.phase === 'intermission',
        'No wave break to skip',
      );
      state.nextWaveTick = state.ticks;
      frameState = null;
      return snapshot();
    },
    export: () => canonicalJSON(checkpoint()),
  });
}
