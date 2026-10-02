import { boundedJSON, exactKeys, required, stableId } from '../data-json.mjs';

export const HUNT_VERSION = 'humanoid-hunt.v1';
export const HUNT_STATE_VERSION = 'humanoid-hunt-state.v1';
export const HUNT_MODES = Object.freeze(['bonus', 'capture-quota', 'hunt']);
export const HUNT_MAX_ACTORS = 24;
export const HUNT_TOUCH_SCORE = 100;
export const HUNT_CAPTURE_SCORE = 50;
export const HUNT_RUNNER_TURN_TICKS = 60;
export const HUNT_RUNNER_SENSE_RADIUS = 6;
export const HUNT_HEADINGS = Object.freeze(
  [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ].map(Object.freeze),
);

/** Validate an explicit finite population. Actors are owned validated runtime recipes.
 * Gameplay does not infer humanoids from a theme, filename, title or visual skin. */
export function validateHuntDefinition(source, actors, { ordinaryCount = 0, enabled = true } = {}) {
  const value = boundedJSON(source, { maxBytes: 8192, maxNodes: 180, maxDepth: 4, maxArray: 24 });
  exactKeys(value, ['version', 'mode', 'quota', 'targets'], 'Humanoid hunt');
  required(
    value.version === HUNT_VERSION && HUNT_MODES.includes(value.mode),
    'Unsupported hunt rules.',
  );
  required(enabled === true, 'Hunting requires its accepted population to be enabled.');
  required(
    Array.isArray(actors) &&
      Number.isSafeInteger(ordinaryCount) &&
      ordinaryCount >= 0 &&
      actors.length + ordinaryCount <= HUNT_MAX_ACTORS,
    'Hunt editions support at most 24 total actors.',
  );
  required(
    Array.isArray(value.targets) &&
      value.targets.length > 0 &&
      value.targets.length <= actors.length,
    'Hunting needs a nonempty finite target population.',
  );
  required(
    Number.isSafeInteger(value.quota) &&
      (value.mode === 'bonus'
        ? value.quota === 0
        : value.mode === 'hunt'
          ? value.quota === value.targets.length
          : value.quota >= 1 && value.quota <= value.targets.length),
    'Bonus quota is zero; dedicated Hunt requires every target; capture quota must be achievable.',
  );
  const ids = new Set();
  for (const target of value.targets) {
    exactKeys(target, ['id', 'kind'], 'Hunt target');
    required(
      stableId(target.id) && !ids.has(target.id) && ['runner', 'guard'].includes(target.kind),
      'Hunt targets need distinct stable IDs and a registered kind.',
    );
    const matches = actors.filter((actor) => actor.id === target.id);
    required(
      matches.length === 1 && matches[0].role === (target.kind === 'runner' ? 'scout' : 'sentry'),
      'Every hunt target must reference its exact runner or guard actor.',
    );
    required(
      target.kind !== 'runner' || matches[0].turnTicks === HUNT_RUNNER_TURN_TICKS,
      'Humanoid runners use the fixed 60-tick decision cadence.',
    );
    ids.add(target.id);
  }
  return value;
}

export const huntTargetKind = (definition, id) =>
  definition?.targets.find((target) => target.id === id)?.kind ?? null;
export const createHuntState = () => ({
  version: HUNT_STATE_VERSION,
  kills: 0,
  touchKills: 0,
  captureKills: 0,
  score: 0,
});

/** Called once by the authoritative alive-to-eliminated transaction, never by a view. */
export function recordHuntElimination(state, definition, id, cause) {
  if (!state || !huntTargetKind(definition, id)) return false;
  required(
    ['ram', 'capture'].includes(cause),
    'Hunt elimination needs a resolved contact or capture cause.',
  );
  state.kills++;
  if (cause === 'ram') state.touchKills++;
  else state.captureKills++;
  state.score += cause === 'ram' ? HUNT_TOUCH_SCORE : HUNT_CAPTURE_SCORE;
  return true;
}

/** The caller also retains ordinary required objectives and encounter obligations. */
export function huntObjectiveSatisfied(definition, state, coverageSatisfied) {
  if (!definition) return coverageSatisfied;
  if (definition.mode === 'bonus') return coverageSatisfied;
  const quotaSatisfied = !!state && state.kills >= definition.quota;
  return quotaSatisfied && (definition.mode === 'hunt' || coverageSatisfied);
}

export function huntSummary(definition, state) {
  if (!definition || !state) return null;
  return {
    version: HUNT_STATE_VERSION,
    mode: definition.mode,
    quota: definition.quota,
    total: definition.targets.length,
    remaining: definition.targets.length - state.kills,
    kills: state.kills,
    touchKills: state.touchKills,
    captureKills: state.captureKills,
    score: state.score,
  };
}

/** Fixed v1 fleeing rule shared across modes. The caller provides a geometric
 * clearance fraction in [0,1] for a half-second lookahead. No wall clock or shared RNG. */
export function chooseHuntRunnerHeading({ actor, players, speed, rotation, clearance }) {
  const active = players.filter(
    (player) =>
      player &&
      (!player.status || player.status === 'active') &&
      Number.isFinite(player.x) &&
      Number.isFinite(player.y),
  );
  const nearest = active.reduce(
    (best, player) => Math.min(best, Math.hypot(player.x - actor.x, player.y - actor.y)),
    Infinity,
  );
  if (nearest > HUNT_RUNNER_SENSE_RADIUS) return HUNT_HEADINGS[rotation % HUNT_HEADINGS.length];
  let best = null;
  for (let offset = 0; offset < HUNT_HEADINGS.length; offset++) {
    const heading = HUNT_HEADINGS[(rotation + offset) % HUNT_HEADINGS.length];
    const length = Math.hypot(...heading),
      distance = speed * 0.5;
    const end = {
      x: actor.x + (heading[0] / length) * distance,
      y: actor.y + (heading[1] / length) * distance,
    };
    const fraction = Math.max(0, Math.min(1, clearance(actor, end)));
    const reachable = {
      x: actor.x + (end.x - actor.x) * fraction,
      y: actor.y + (end.y - actor.y) * fraction,
    };
    const separation = Math.min(
      ...active.map((player) => Math.hypot(player.x - reachable.x, player.y - reachable.y)),
    );
    const score = separation + fraction * 0.01;
    if (!best || score > best.score + 1e-9) best = { heading, score };
  }
  return best.heading;
}
