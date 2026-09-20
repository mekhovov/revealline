import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { DEFAULT_RULES, FIXED_DT } from '../core/registry.mjs';
import { ARCADE_ACTIONS_VERSION } from '../core/arcade-actions.mjs';

export const freezeDesign = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDesign);
    Object.freeze(value);
  }
  return value;
};

export const LEGACY_JOURNEY_POLICY = freezeDesign({
  format: 'JourneyGameplayPolicyV1',
  id: 'journey-v1',
  fixedTimestep: FIXED_DT,
  capture: 'enemy-seeded-four-connected',
  turnPolicy: 'immediate-or-global-grid-buffer',
  recovery: 'fresh-direction',
  transitionInput: 'consume-and-rearm-per-control',
  rules: {
    ...DEFAULT_RULES,
    moveSpeed: 10,
    lives: 3,
    respawnSeconds: 0.65,
    timeLimitSeconds: 0,
    cutTimeLimitSeconds: 0,
    maxTrailCells: 0,
    stopOnCapture: true,
  },
});
// New projects select contact bonuses explicitly; old imported projects retain their rules.
export const JOURNEY_POLICY = freezeDesign({
  ...LEGACY_JOURNEY_POLICY,
  id: 'journey-arcade-v2',
  arcadeActions: { version: ARCADE_ACTIONS_VERSION },
});
export function journeyPolicy(id) {
  if (id === LEGACY_JOURNEY_POLICY.id) return LEGACY_JOURNEY_POLICY;
  if (id === JOURNEY_POLICY.id) return JOURNEY_POLICY;
  throw new Error('Project must pin a registered Journey policy.');
}
export const DIFFICULTY_CATALOG = freezeDesign({
  format: 'DifficultyCatalogV1',
  id: 'journey-difficulty-v1',
  presets: {
    gentle: {
      lives: 5,
      enemySpeedFactor: 0.85,
      failingDeadline: false,
      description: 'Five lives, enemies 15% slower, no failing countdown.',
    },
    standard: {
      lives: 3,
      enemySpeedFactor: 1,
      failingDeadline: true,
      description: 'Three lives and the authored enemy tier.',
    },
    expert: {
      lives: 2,
      enemySpeedFactor: 1.1,
      failingDeadline: true,
      description: 'Two lives, enemies 10% faster. Player handling is unchanged.',
    },
  },
});
export const ACTOR_CATALOG = freezeDesign({
  format: 'ActorCatalogV1',
  id: 'journey-actors-v1',
  roles: {
    'field-keeper': {
      type: 'bouncer',
      domain: 'unclaimed-field',
      damageTarget: 'body-and-trail',
      retainsField: true,
      captureResponse: 'remains-in-retained-region',
      warning: 'continuous-visible-motion',
      action: 'reflect-in-field',
      recovery: 'continuous',
      counterplay: 'Time a short cut or herd it away from a larger enclosure.',
      speeds: { measured: 2.4, standard: 3.2, brisk: 4 },
    },
    'perimeter-patrol': {
      type: 'border-patrol',
      domain: 'outer-perimeter',
      damageTarget: 'body',
      retainsField: false,
      captureResponse: 'outer-route-unchanged',
      warning: 'visible-perimeter-route',
      action: 'follow-outer-perimeter',
      recovery: 'continuous',
      counterplay: 'Depart before it arrives; return behind its path.',
      speeds: { measured: 1.8, standard: 2.4, brisk: 3 },
    },
    'frontier-patrol': {
      type: 'contour-patrol',
      domain: 'moving-frontier',
      damageTarget: 'body-and-trail',
      retainsField: false,
      captureResponse: 'rejoin-connected-frontier-without-teleport',
      warning: 'visible-frontier-route',
      action: 'follow-field-reclaimed-boundary',
      recovery: 'safe-route-rejoin',
      counterplay: 'Shape the frontier to move patrol pressure away from your next return.',
      speeds: { measured: 1.8, standard: 2.4, brisk: 3 },
    },
  },
});

// A new authored catalogue adds an existing engine role without rewriting v1.
// Historical projects keep their exact role set and compiled motion values.
export const ROVER_ACTOR_CATALOG = freezeDesign({
  format: 'ActorCatalogV1',
  id: 'journey-actors-v2',
  roles: {
    ...ACTOR_CATALOG.roles,
    'reclaimed-roamer': {
      type: 'claimed-rover',
      domain: 'reclaimed-ground',
      damageTarget: 'body-and-trail-while-active',
      retainsField: false,
      captureResponse: 'warn-then-activate-on-reclaimed-ground',
      warning: '120-actor-ticks-after-full-body-reclamation',
      action: 'reflect-within-reclaimed-ground',
      recovery: 'continuous-domain-reflection',
      counterplay:
        'Keep an escape corridor before enclosing it; the warning gives time to move away. Reclaimed ground still closes cuts but is not universally safe.',
      speeds: { measured: 1.6, standard: 2.2, brisk: 2.8 },
    },
  },
});

export function journeyActors(id = ACTOR_CATALOG.id) {
  const catalogs = {
    [ACTOR_CATALOG.id]: ACTOR_CATALOG,
    [ROVER_ACTOR_CATALOG.id]: ROVER_ACTOR_CATALOG,
  };
  required(Object.hasOwn(catalogs, id), 'Project must pin a registered actor catalog.');
  return catalogs[id];
}

export function journeyPreset(id = 'standard') {
  required(Object.hasOwn(DIFFICULTY_CATALOG.presets, id), 'Unsupported Journey difficulty.');
  return DIFFICULTY_CATALOG.presets[id];
}

export function compileActor(source, difficulty = 'standard', catalogId = ACTOR_CATALOG.id) {
  const actor = boundedJSON(source, { maxBytes: 4096, maxNodes: 64, maxDepth: 5, maxArray: 2 });
  const catalog = journeyActors(catalogId);
  const role = catalog.roles[actor.role];
  required(Object.hasOwn(catalog.roles, actor.role), 'Unsupported actor role.');
  required(Object.hasOwn(role.speeds, actor.tier), 'Unsupported actor speed tier.');
  const speed = role.speeds[actor.tier] * journeyPreset(difficulty).enemySpeedFactor;
  if (['bouncer', 'claimed-rover'].includes(role.type)) {
    exactKeys(actor, ['id', 'role', 'tier', 'x', 'y', 'heading'], 'actor');
    required(
      Array.isArray(actor.heading) &&
        actor.heading.length === 2 &&
        actor.heading.every((n) => Number.isInteger(n) && n >= -1 && n <= 1) &&
        actor.heading.some((n) => n !== 0),
      'Actor heading must be a nonzero eight-way direction.',
    );
    const magnitude = Math.hypot(...actor.heading);
    return {
      id: actor.id,
      type: role.type,
      x: actor.x,
      y: actor.y,
      vx: (actor.heading[0] * speed) / magnitude,
      vy: (actor.heading[1] * speed) / magnitude,
    };
  }
  exactKeys(
    actor,
    ['id', 'role', 'tier', 'clockwise', ...(role.type === 'border-patrol' ? ['x', 'y'] : ['edge'])],
    'actor',
  );
  required(typeof actor.clockwise === 'boolean', 'Patrol direction must be explicit.');
  return {
    id: actor.id,
    type: role.type,
    speed,
    clockwise: actor.clockwise,
    ...(role.type === 'border-patrol' ? { x: actor.x, y: actor.y } : { edge: actor.edge }),
  };
}
