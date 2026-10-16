import { CELL, FIXED_DT, stepRun, loadoutHash } from './core/index.mjs';
import { canonicalJSON } from './data-json.mjs';
import { authoritativeCheckpoint } from './replay.mjs';

export const LIVE_BOT_LEVEL_IDS = Object.freeze(['orchard-crossing', 'courtyard-exits']);
export const BOT_LIMITS = Object.freeze({
  candidates: 16,
  candidateTicks: 1200,
  totalTicks: 12000,
});
const DIRECTIONS = [
  { name: 'up', x: 0, y: -1 },
  { name: 'right', x: 1, y: 0 },
  { name: 'down', x: 0, y: 1 },
  { name: 'left', x: -1, y: 0 },
];
const EPS = 1e-6;
const fingerprint = (value) => {
  let hash = 2166136261;
  for (const char of canonicalJSON(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};
// Exact current Standard (gameplay-pressure.v4) recipes, not the raw authored
// maps. Content or tuning revisions require fresh policy/seed qualification.
const QUALIFIED = Object.freeze({
  'orchard-crossing': '6113d4b4',
  'courtyard-exits': 'db252ca9',
});
const physics = (level) => {
  const { name, description, ...rest } = level;
  return rest;
};
export function supportsDemoBot(level, options = {}) {
  try {
    return (
      !!level &&
      Object.hasOwn(QUALIFIED, level.id) &&
      fingerprint(physics(level)) === QUALIFIED[level.id] &&
      (options.seed === undefined || [1, 2, 3].includes(options.seed)) &&
      (options.classId === undefined || options.classId === 'scout') &&
      (options.turnPolicy === undefined ||
        ['immediate', 'grid-center'].includes(options.turnPolicy)) &&
      (options.classRecipes === undefined ||
        (options.classRecipes.length === 1 &&
          loadoutHash(options.classRecipes[0]) === 'loadout-v1-8360440c'))
    );
  } catch {
    return false;
  }
}
export function demoBotLevelFingerprint(level) {
  return fingerprint(physics(level));
}
const point = (index, width) => ({ x: (index % width) + 0.5, y: Math.floor(index / width) + 0.5 });
const indexAt = (state, x, y) => Math.floor(y) * state.width + Math.floor(x);
const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.width && y < s.height;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function randomFor(seed) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}
function append(segments, direction) {
  const prior = segments.at(-1);
  if (prior?.input.direction === direction) prior.ticks++;
  else segments.push({ ticks: 1, input: { direction } });
}
function safePaths(state) {
  // A capture stops at its contact point, often between centers. Resume along
  // its retained heading to the next safe center as part of the next route;
  // never move to a center and then manufacture another neutral stop.
  const anchor = { x: state.player.x, y: state.player.y };
  const heading = DIRECTIONS.find((d) => d.name === state.player.direction);
  const axis = heading.x ? 'x' : 'y',
    value = anchor[axis],
    sign = heading.x || heading.y;
  if (Math.abs(value - Math.round(value - 0.5) - 0.5) > EPS)
    anchor[axis] = sign > 0 ? Math.ceil(value - 0.5) + 0.5 : Math.floor(value - 0.5) + 0.5;
  const start = indexAt(state, anchor.x, anchor.y);
  const parents = new Int32Array(state.cells.length).fill(-1),
    lengths = new Int32Array(state.cells.length),
    queue = [start];
  parents[start] = start;
  for (let pos = 0; pos < queue.length; pos++) {
    const from = queue[pos],
      x = from % state.width,
      y = Math.floor(from / state.width);
    for (const d of DIRECTIONS) {
      const nx = x + d.x,
        ny = y + d.y,
        next = ny * state.width + nx;
      if (inside(state, nx, ny) && parents[next] < 0 && state.cells[next] === CELL.SAFE) {
        parents[next] = from;
        lengths[next] = lengths[from] + 1;
        queue.push(next);
      }
    }
  }
  return { start, anchor, parents, lengths, queue };
}
function ray(state, origin, d) {
  const cells = [];
  for (let i = 1; i <= state.width + state.height; i++) {
    const x = origin.x + d.x * i,
      y = origin.y + d.y * i;
    if (!inside(state, x, y)) return { cells, end: null };
    const kind = state.cells[indexAt(state, x, y)];
    if (kind !== CELL.FIELD) return { cells, end: kind === CELL.SAFE ? { x, y } : null };
    cells.push({ x, y });
  }
  return { cells, end: null };
}
function pathsFor(state, random, preferBent, compactCuts = false) {
  const paths = safePaths(state),
    result = [],
    seen = new Set();
  // A cheap straight-course estimate ranks routes only. Walls, terrain, patrols
  // and pursuit are still decided by the complete authoritative simulation.
  const sampleSeconds = 0.25,
    speed = state.rules.moveSpeed;
  const reflect = (value, low, high) => {
    const span = high - low,
      phase = (((value - low) % (2 * span)) + 2 * span) % (2 * span);
    return low + (phase <= span ? phase : 2 * span - phase);
  };
  const courses = Array.from({ length: 64 }, (_, sample) =>
    state.enemies
      .filter((enemy) => enemy.type === 'bouncer')
      .map((enemy) => ({
        x: reflect(
          enemy.x + enemy.vx * sample * sampleSeconds,
          1 + enemy.radius,
          state.width - 1 - enemy.radius,
        ),
        y: reflect(
          enemy.y + enemy.vy * sample * sampleSeconds,
          1 + enemy.radius,
          state.height - 1 - enemy.radius,
        ),
      })),
  );
  function routeRisk(origin, vertices, relocation, exposure) {
    let clearance = Infinity;
    for (
      let sample = Math.ceil(relocation / speed / sampleSeconds);
      sample * sampleSeconds * speed < relocation + exposure && sample < courses.length;
      sample++
    ) {
      let remaining = sample * sampleSeconds * speed - relocation,
        from = point(origin, state.width);
      for (const target of vertices) {
        if (remaining <= 0) break;
        const leg = distance(from, target),
          portion = Math.min(1, remaining / leg),
          x = from.x + (target.x - from.x) * portion,
          y = from.y + (target.y - from.y) * portion;
        for (const enemy of courses[sample]) {
          const dx =
              enemy.x - Math.max(Math.min(from.x, x), Math.min(Math.max(from.x, x), enemy.x)),
            dy = enemy.y - Math.max(Math.min(from.y, y), Math.min(Math.max(from.y, y), enemy.y));
          clearance = Math.min(clearance, dx * dx + dy * dy);
        }
        remaining -= leg;
        from = target;
      }
    }
    return 24 / (1 + clearance / 4);
  }
  function add(origin, vertices, area, bends) {
    const key = `${origin}/${vertices.map((p) => `${p.x},${p.y}`).join('/')}`;
    if (seen.has(key)) return;
    seen.add(key);
    let length = paths.lengths[origin],
      from = point(origin, state.width);
    for (const target of vertices) {
      length += distance(from, target);
      from = target;
    }
    if (length > 110 || vertices.some((p) => !inside(state, p.x, p.y))) return;
    const advantage =
      Math.sqrt(area) * 2 -
      length * 0.12 -
      paths.lengths[origin] * 0.15 -
      routeRisk(origin, vertices, paths.lengths[origin], length - paths.lengths[origin]);
    result.push({
      origin,
      vertices,
      bends,
      length,
      exposure: length - paths.lengths[origin],
      advantage,
      jitter: random(),
    });
  }
  // Pressure Lines' pursuing enemies need short closure windows. Preserve the
  // broader legacy routes instead of turning those performances into dozens
  // of tiny captures.
  const cutSpans = compactCuts ? [1, 2, 4, 8, 12, 16, 24] : [4, 8, 12, 16, 24];
  // Candidate geometry is bounded independently of simulation work.
  const origins = paths.queue.filter((i) => paths.lengths[i] <= 48);
  for (const origin of origins) {
    const from = point(origin, state.width);
    for (const d of DIRECTIONS) {
      const first = ray(state, from, d);
      if (!first.cells.length) continue;
      if (first.end) add(origin, [first.end], first.cells.length * 4, 0);
      for (const depth of cutSpans) {
        const elbow = first.cells[depth - 1];
        if (!elbow) continue;
        for (const side of DIRECTIONS.filter((p) => p.x * d.x + p.y * d.y === 0)) {
          const across = ray(state, elbow, side);
          if (across.end && across.cells.length)
            add(origin, [elbow, across.end], (depth * (across.cells.length + 1)) / 2, 1);
          for (const width of cutSpans) {
            const corner = across.cells[width - 1];
            if (!corner) continue;
            const back = ray(state, corner, { x: -d.x, y: -d.y });
            if (back.end) add(origin, [elbow, corner, back.end], depth * width, 2);
          }
        }
      }
    }
    if (result.length >= 10000) break;
  }
  const pool = preferBent ? result.filter((c) => c.bends > 0) : result;
  pool.sort((a, b) => b.advantage + b.jitter * 6 - (a.advantage + a.jitter * 6));
  // Reserve attempts for several exposed lengths instead of spending the
  // entire allowance on large cuts that share the same dangerous crossing.
  const exposures = compactCuts ? [8, 24, 40, Infinity] : [24, 40, 60, Infinity];
  const shortlisted = [];
  // Adjacent starting cells often generate nearly identical large cuts. Spend
  // the finite simulation allowance on different locations and route shapes,
  // retaining short alternatives for tighter enemy windows.
  function similarity(a, b) {
    if (a.vertices.length !== b.vertices.length) return 0;
    let separation = distance(point(a.origin, state.width), point(b.origin, state.width));
    for (let i = 0; i < a.vertices.length; i++)
      separation += distance(a.vertices[i], b.vertices[i]);
    return Math.max(0, 1 - separation / (12 * (a.vertices.length + 1)));
  }
  for (let slot = 0; slot < BOT_LIMITS.candidates; slot++) {
    const choices = pool.filter((c) => c.exposure <= exposures[slot % 4]);
    let best = null,
      bestScore = -Infinity;
    for (const candidate of choices) {
      if (shortlisted.includes(candidate)) continue;
      const overlap = shortlisted.reduce(
        (max, prior) => Math.max(max, similarity(candidate, prior)),
        0,
      );
      const score = candidate.advantage + candidate.jitter * 6 - overlap * 18;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (best) shortlisted.push(best);
  }
  return { candidates: shortlisted, paths };
}
function waypointsFor(candidate, paths, state) {
  const indices = [];
  for (let cursor = candidate.origin; cursor !== paths.start; cursor = paths.parents[cursor])
    indices.push(cursor);
  indices.reverse();
  const points = indices.map((i) => point(i, state.width)),
    waypoints = [];
  if (distance(state.player, paths.anchor) > EPS) waypoints.push(paths.anchor);
  // Immediate steering can stop a fraction away from a cell center. Keep that
  // real offset until the next purposeful turn rather than briefly reversing
  // direction just to chase a nominal center.
  let previous = point(paths.start, state.width),
    prior = null;
  for (let i = 0; i < points.length; i++) {
    const dir = directionTo(previous, points[i]);
    if (prior && dir !== prior) waypoints.push(points[i - 1]);
    prior = dir;
    previous = points[i];
  }
  if (points.length) waypoints.push(points.at(-1));
  return [...waypoints, ...candidate.vertices];
}
function directionTo(a, b) {
  // Follow the purposeful leg, not a sub-tick lateral offset left by the
  // previous capture. The core retains the actual coordinates throughout.
  if (Math.abs(b.x - a.x) > Math.abs(b.y - a.y)) return b.x > a.x ? 'right' : 'left';
  return b.y > a.y ? 'down' : 'up';
}

/** Run only public commands against an owned candidate. Never publish a candidate state as live authority. */
function evaluate(
  original,
  vertices,
  budget,
  { allowHazardLoss = false, safeApproach = false } = {},
) {
  if ((budget.candidates ?? 0) >= BOT_LIMITS.candidates) return null;
  budget.candidates = (budget.candidates ?? 0) + 1;
  const state = structuredClone(original),
    segments = [];
  let localTicks = 0,
    closed = false,
    bends = 0,
    priorDirection = null,
    exposedTicks = 0,
    failure = null;
  function tick(direction) {
    if (localTicks >= BOT_LIMITS.candidateTicks || budget.ticks >= BOT_LIMITS.totalTicks)
      return false;
    // Improvised performances must never manufacture a loss by retracing the
    // live cable, including a queued turn under grid-center steering.
    if (allowHazardLoss && state.player.cutting && direction) {
      const heading = DIRECTIONS.find((d) => d.name === state.player.direction),
        requested = DIRECTIONS.find((d) => d.name === direction);
      if (heading.x * requested.x + heading.y * requested.y === -1) return false;
    }
    localTicks++;
    budget.ticks++;
    if (state.player.cutting) exposedTicks++;
    if (state.player.cutting && direction && priorDirection && direction !== priorDirection)
      bends++;
    if (direction) priorDirection = direction;
    stepRun(state, { direction }, FIXED_DT);
    append(segments, direction);
    if (
      safeApproach &&
      (state.player.cutting || state.events.some((event) => event.type === 'cut.started'))
    )
      return false;
    if (
      state.lives !== original.lives ||
      state.status === 'lost' ||
      state.status === 'respawning'
    ) {
      const event = state.events.find((event) => event.type === 'player.failed');
      // A plausible overreach: a real moving threat catches an already
      // established cut. Never select self-contact, wall/terrain blunders,
      // an idle death, or an immediate loss at departure.
      if (
        allowHazardLoss &&
        !closed &&
        exposedTicks >= 240 &&
        ['enemy-trail', 'enemy-player', 'boss-lane', 'combat-projectile'].includes(event?.cause)
      )
        failure = event.cause;
      return false;
    }
    if (state.events.some((e) => e.type === 'cut.closed')) closed = true;
    return true;
  }
  let from = { ...state.player };
  for (let v = 0; v < vertices.length && !closed && state.status !== 'won'; v++) {
    const target = vertices[v],
      direction = directionTo(from, target),
      axis = ['left', 'right'].includes(direction) ? 'x' : 'y',
      sign = ['right', 'down'].includes(direction) ? 1 : -1;
    const nextDirection = v + 1 < vertices.length ? directionTo(target, vertices[v + 1]) : null;
    let stagnant = 0;
    while ((target[axis] - state.player[axis]) * sign > EPS && !closed) {
      const before = { ...state.player },
        remaining = (target[axis] - before[axis]) * sign;
      const queueTurn = state.turnPolicy === 'grid-center' && nextDirection && remaining < 1 - EPS;
      if (!tick(queueTurn ? nextDirection : direction))
        return failure ? { state, segments, bends, ticks: localTicks, failure } : null;
      if (closed || state.status === 'won') break;
      if (queueTurn && state.player.direction === nextDirection) break;
      stagnant = distance(before, state.player) < EPS ? stagnant + 1 : 0;
      if (stagnant >= 3) return null;
    }
    from = target;
  }
  // Encounter isolation can finish during travel, without cut.closed. Retain
  // its exact terminal tick instead of stepping a won state until 'stagnant'.
  if (state.status === 'won') return { state, segments, bends, ticks: localTicks };
  if (safeApproach) {
    if (
      closed ||
      state.coverage !== original.coverage ||
      distance(state.player, vertices.at(-1)) > 1 ||
      distance(state.player, original.player) < 4
    )
      return null;
    return { state, segments, bends, ticks: localTicks, approach: true };
  }
  if (!closed || state.coverage <= original.coverage) return null;
  if (state.status !== 'won') {
    // The authored stop-on-capture permits a short pause before a new gesture.
    // This is part of the evaluated input macro, not a claim that safe
    // terrain is invulnerable to contour patrols or claimed rovers.
    for (let i = 0; i < 60 && state.status !== 'won'; i++) {
      // A readable capture pause is optional. Leave time to depart before a
      // patrol reaches this stop: safe ground is not an invulnerable waiting
      // area. The next maneuver still requires full simulation validation.
      if (
        state.enemies.some(
          (enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 3,
        )
      )
        break;
      if (!tick(null)) return null;
    }
  }
  return { state, segments, bends, ticks: localTicks };
}

/** Reach a distant required relay along existing safe ground before cutting.
 * This runs only after an unsuccessful capture shortlist. Every retained tick
 * is simulated; touching field or a threat rejects the entire approach. */
function approachObjective(original, budget) {
  const goals = original.objectives.filter(
    (objective) => objective.required && !objective.captured,
  );
  if (!goals.length) return null;
  const paths = safePaths(original),
    targets = [];
  for (const goal of goals) {
    const before = distance(original.player, goal);
    for (const origin of paths.queue) {
      const from = point(origin, original.width);
      if (
        !DIRECTIONS.some(
          (d) =>
            inside(original, from.x + d.x, from.y + d.y) &&
            original.cells[indexAt(original, from.x + d.x, from.y + d.y)] === CELL.FIELD,
        )
      )
        continue;
      let target = origin;
      while (paths.lengths[target] > 48) target = paths.parents[target];
      // A fixed tick can carry us just beyond a waypoint. Grid-center steering
      // must still reach the next center before turning, so do not finish an
      // approach aimed straight from safe ground into an unplanned live cut.
      while (paths.lengths[target] >= 8) {
        const at = point(target, original.width);
        const previous = point(paths.parents[target], original.width);
        const heading = DIRECTIONS.find(
          (direction) => direction.name === directionTo(previous, at),
        );
        const x = at.x + heading.x,
          y = at.y + heading.y;
        if (inside(original, x, y) && original.cells[indexAt(original, x, y)] === CELL.SAFE) break;
        target = paths.parents[target];
      }
      const end = point(target, original.width);
      if (paths.lengths[target] < 8 || before - distance(end, goal) < 4) continue;
      targets.push({
        origin: target,
        vertices: [],
        score: distance(from, goal) + paths.lengths[origin] * 0.02,
      });
    }
  }
  targets.sort((a, b) => a.score - b.score);
  const seen = new Set();
  for (const target of targets) {
    if (seen.has(target.origin)) continue;
    seen.add(target.origin);
    const trial = evaluate(original, waypointsFor(target, paths, original), budget, {
      safeApproach: true,
    });
    if (trial) {
      if (trial.state.status === 'won') return trial;
      const following = safePaths(trial.state).anchor;
      if (
        inside(trial.state, following.x, following.y) &&
        trial.state.cells[indexAt(trial.state, following.x, following.y)] === CELL.SAFE
      )
        return trial;
    }
    if (seen.size >= 4 || budget.ticks >= BOT_LIMITS.totalTicks) break;
  }
  return null;
}

/** Wait only for an actual simulation-owned boundary, never arbitrary padding.
 * The complete hold is rehearsed: safe territory can still contain threats. */
function settleBoundary(original, budget, retryEncounter = false) {
  const recovery = original.player.graceUntil > original.time + EPS;
  const isolated =
    original.encounter &&
    !original.encounter.defeated &&
    ['transition', 'exposed'].includes(original.encounter.stage) &&
    original.cells.reduce((count, cell) => count + Number(cell === CELL.FIELD), 0) <=
      original.level.encounter.minReleaseCutCells;
  const phaseWait =
    retryEncounter &&
    original.encounter &&
    !original.encounter.defeated &&
    ['warning', 'active'].includes(original.encounter.phase);
  if (!recovery && !isolated && !phaseWait) return null;
  if ((budget.candidates ?? 0) >= BOT_LIMITS.candidates) return null;
  budget.candidates = (budget.candidates ?? 0) + 1;
  const state = structuredClone(original),
    segments = [];
  for (
    let ticks = 1;
    ticks <= BOT_LIMITS.candidateTicks && budget.ticks < BOT_LIMITS.totalTicks;
    ticks++
  ) {
    budget.ticks++;
    stepRun(state, {}, FIXED_DT);
    append(segments, null);
    if (
      state.lives !== original.lives ||
      state.player.cutting ||
      !['running', 'won'].includes(state.status)
    )
      return null;
    if (
      state.status === 'won' ||
      (recovery && !isolated && state.time + EPS >= state.player.graceUntil) ||
      (phaseWait &&
        (state.encounter.phase !== original.encounter.phase ||
          state.encounter.cycle !== original.encounter.cycle))
    )
      return { state, segments, bends: 0, ticks, boundary: recovery ? 'recovery' : 'encounter' };
  }
  return null;
}

/** A nearby patrol can make every immediate cut unsafe. Rehearse a short
 * escape on already safe ground before trying another departure. Never turn
 * over a live cable, retain a loss or pad a scene with ineffective movement. */
function escapeOnSafeGround(original, budget) {
  const clearance = (state) =>
    Math.min(...state.enemies.map((enemy) => distance(state.player, enemy)));
  const before = clearance(original);
  if (before > 8) return null;
  let best = null,
    score = -Infinity;
  for (const direction of DIRECTIONS) {
    if ((budget.candidates ?? 0) >= BOT_LIMITS.candidates) break;
    budget.candidates = (budget.candidates ?? 0) + 1;
    const state = structuredClone(original),
      segments = [];
    let valid = true;
    for (let tick = 0; tick < 90 && budget.ticks < BOT_LIMITS.totalTicks; tick++) {
      budget.ticks++;
      stepRun(state, { direction: direction.name }, FIXED_DT);
      append(segments, direction.name);
      if (
        state.lives !== original.lives ||
        state.player.cutting ||
        state.events.some((event) => event.type === 'cut.started') ||
        state.status !== 'running'
      ) {
        valid = false;
        break;
      }
    }
    const improvement = clearance(state) - before;
    if (
      valid &&
      segments.reduce((ticks, segment) => ticks + segment.ticks, 0) === 90 &&
      distance(state.player, original.player) >= 3 &&
      improvement >= 1 &&
      improvement > score
    ) {
      score = improvement;
      best = { state, segments, bends: 0, ticks: 90, escape: true };
    }
  }
  return best;
}

/** Prepare varied, purposeful recording inputs without widening live-bot
 * qualification. Every route reconnects geometrically; only a late encounter
 * with a real moving threat may be retained as a recoverable overreach. */
export async function planImprovMacro(
  original,
  {
    plannerSeed = 1,
    decision = 0,
    allowRisk = false,
    preferSafe = false,
    seekFrontier = false,
    signal,
  } = {},
) {
  const check = () => {
    if (signal?.aborted) throw new DOMException('Improvised demo cancelled.', 'AbortError');
  };
  check();
  if (original.status !== 'running' || original.player.cutting) return null;
  const budget = { ticks: 0 },
    settled = settleBoundary(original, budget, seekFrontier);
  check();
  if (settled) return settled;
  if (seekFrontier) {
    const approach = approachObjective(original, budget);
    if (approach) return approach;
    const escape = escapeOnSafeGround(original, budget);
    if (escape) return escape;
  }
  const random = randomFor((plannerSeed ^ Math.imul(decision + 1, 2654435761)) >>> 0),
    { candidates, paths } = pathsFor(original, random, false, seekFrontier),
    safe = [],
    risky = [];
  for (const candidate of candidates) {
    if (budget.ticks >= BOT_LIMITS.totalTicks) break;
    // Yield between bounded simulations so loading cancellation remains usable
    // on mobile even though this fallback does not require a Worker.
    await new Promise((resolve) => setTimeout(resolve, 0));
    check();
    const trial = evaluate(original, waypointsFor(candidate, paths, original), budget, {
      allowHazardLoss: true,
    });
    if (!trial) continue;
    // A genuine finish needs no further search for cosmetic scoring gains.
    // Keep its exact independently simulated terminal tick and public inputs.
    if (trial.state.status === 'won') return trial;
    const score = trial.failure
      ? candidate.advantage + candidate.jitter * 4
      : (trial.state.coverage - original.coverage) * 60 +
        Math.min(trial.bends, 2) * 2 -
        trial.ticks / 400 +
        candidate.jitter * 5;
    (trial.failure ? risky : safe).push({ ...trial, score });
    // On the opening/recovery route, three useful alternatives including a
    // bend already provide seeded variety. Keep the remaining allowance for
    // difficult boards rather than always simulating sixteen similar routes.
    // Overreach searches retain their full allowance and real hazard choices.
    if (
      (!allowRisk || preferSafe) &&
      budget.candidates >= 8 &&
      safe.filter((move) => move.state.coverage - original.coverage >= 0.04).length >= 3 &&
      safe.some((move) => move.bends > 0)
    )
      break;
  }
  const choices =
    allowRisk && risky.length && (!safe.length || (!preferSafe && random() < 0.25)) ? risky : safe;
  choices.sort((a, b) => b.score - a.score);
  // Seeded choice among good routes changes strategy rather than injecting
  // steering jitter into a maneuver already in progress.
  return choices[Math.floor(random() * Math.min(3, choices.length))] ?? null;
}

/** Deterministic finite planning. Intended for a Worker; tests may call it directly. */
export function planDemoMacro(
  original,
  { plannerSeed = 1, decision = 0, preferBent = decision === 0 } = {},
) {
  if (
    original.status !== 'running' ||
    original.player.cutting ||
    !original.classic ||
    original.rules.stopOnCapture !== true
  )
    return { ok: false, reason: 'unsafe-planning-boundary' };
  const start = authoritativeCheckpoint(original),
    random = randomFor((plannerSeed ^ Math.imul(decision + 1, 2654435761)) >>> 0);
  const { candidates, paths } = pathsFor(original, random, preferBent, true);
  const budget = { ticks: 0 };
  let best = null,
    examined = 0;
  for (const candidate of candidates) {
    if (budget.ticks >= BOT_LIMITS.totalTicks) break;
    examined++;
    const trial = evaluate(original, waypointsFor(candidate, paths, original), budget);
    if (!trial) continue;
    const score =
      (trial.state.coverage - original.coverage) * 100 +
      (trial.state.status === 'won' ? 15 : 0) +
      Math.min(trial.bends, 2) * 0.5 -
      trial.ticks / 300 +
      candidate.jitter * 0.3;
    if (!best || score > best.score) best = { ...trial, score };
    // A fully simulated useful move is enough; searching for a perfect cut
    // spends the next maneuver's deadline on marginal improvements. Keep the
    // remaining allowance for cases where these first choices are unsafe.
    const gained = best.state.coverage - original.coverage;
    if (best.state.status === 'won' || (examined >= 4 && gained >= (best.bends ? 0.04 : 0.08)))
      break;
  }
  if (!best) return { ok: false, reason: 'no-safe-macro', examined, simulatedTicks: budget.ticks };
  return {
    ok: true,
    startTick: original.tick,
    startHash: start.hash,
    endTick: best.state.tick,
    endHash: authoritativeCheckpoint(best.state).hash,
    segments: best.segments,
    predictedState: best.state,
    metrics: {
      examined,
      simulatedTicks: budget.ticks,
      bends: best.bends,
      ticks: best.ticks,
      gainedCoverage: best.state.coverage - original.coverage,
    },
  };
}
