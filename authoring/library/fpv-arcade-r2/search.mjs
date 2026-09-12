/** Bounded input-only route search adapted from verify-campaign. Every capture gets one released tick before a fresh command. */
import { performance } from 'node:perf_hooks';
import {
  createRun,
  stepRun,
  getSummary,
  FIXED_DT,
  CELL,
  geometryForRun,
} from '../../../game/core/index.mjs';

const directions = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'right', dx: 1, dy: 0 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
];
const center = (index, width) => ({ x: (index % width) + 0.5, y: Math.floor(index / width) + 0.5 });

function safePaths(state) {
  const { width, height } = geometryForRun(state);
  const idx = (x, y) => y * width + x;
  const start = idx(Math.floor(state.player.x), Math.floor(state.player.y));
  const parents = new Int32Array(width * height).fill(-1),
    queue = [start];
  parents[start] = start;
  for (let p = 0; p < queue.length; p++) {
    const current = queue[p],
      x = current % width,
      y = Math.floor(current / width);
    for (const d of directions) {
      const nx = x + d.dx,
        ny = y + d.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const next = idx(nx, ny);
      if (parents[next] === -1 && state.cells[next] === CELL.SAFE) {
        parents[next] = current;
        queue.push(next);
      }
    }
  }
  return { start, parents, reachable: queue };
}

function candidates(state) {
  const { width, height } = geometryForRun(state);
  const idx = (x, y) => y * width + x;
  const { start, parents, reachable } = safePaths(state),
    result = [];
  for (const origin of reachable)
    for (const d of directions) {
      let x = (origin % width) + d.dx,
        y = Math.floor(origin / width) + d.dy;
      if (
        x < 1 ||
        x >= width - 1 ||
        y < 1 ||
        y >= height - 1 ||
        state.cells[idx(x, y)] !== CELL.FIELD
      )
        continue;
      let length = 0;
      while (x >= 0 && x < width && y >= 0 && y < height && state.cells[idx(x, y)] === CELL.FIELD) {
        length++;
        x += d.dx;
        y += d.dy;
      }
      if (x < 0 || x >= width || y < 0 || y >= height || state.cells[idx(x, y)] !== CELL.SAFE)
        continue;
      const path = [];
      for (let cursor = origin; cursor !== start; cursor = parents[cursor]) path.push(cursor);
      path.reverse();
      result.push({ path, origin, end: idx(x, y), direction: d.name, length });
    }
  return result;
}

function append(segments, input, ticks) {
  if (!ticks) return;
  const last = segments.at(-1);
  if (last && JSON.stringify(last.input) === JSON.stringify(input)) last.ticks += ticks;
  else segments.push({ ticks, input: { ...input } });
}

function travel(state, target, segments, { counter } = {}) {
  const dx = target.x - state.player.x,
    dy = target.y - state.player.y;
  if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6) return false;
  const distance = Math.abs(dx) + Math.abs(dy);
  if (distance < 1e-6) return true;
  const direction = Math.abs(dx) > 1e-6 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  // Signal regions and declarative class speeds can change within a cut. Step
  // legal held input until the target center rather than assuming one speed.
  const maximumTicks = Math.ceil(distance / (state.rules.moveSpeed * 0.125 * FIXED_DT)) + 240;
  for (let i = 0; i < maximumTicks && state.status === 'running'; i++) {
    const remaining = Math.abs(state.player.x - target.x) + Math.abs(state.player.y - target.y);
    if (remaining < 1e-5) break;
    const input = { direction, boost: true };
    stepRun(state, input, FIXED_DT);
    if (counter) counter.ticks++;
    append(segments, input, 1);
    if (
      state.status === 'running' &&
      state.events.some((event) => event.type === 'capture.stopped')
    ) {
      const released = { direction: null, boost: false };
      stepRun(state, released, FIXED_DT);
      append(segments, released, 1);
      if (counter) counter.ticks++;
    }
    const after = Math.abs(state.player.x - target.x) + Math.abs(state.player.y - target.y);
    if (after > remaining + 1e-5) break;
  }
  return (
    state.status === 'won' ||
    (state.status === 'running' &&
      Math.abs(state.player.x - target.x) < 1e-5 &&
      Math.abs(state.player.y - target.y) < 1e-5)
  );
}

function tryCandidate(original, candidate, counter) {
  const state = structuredClone(original),
    segments = [];
  // Collapse same-direction steps in the SAFE-only BFS route into turn waypoints.
  const points = candidate.path.map((index) => center(index, state.width));
  let prior = { x: Math.floor(original.player.x) + 0.5, y: Math.floor(original.player.y) + 0.5 },
    lastDirection = null;
  const waypoints = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i],
      direction = point.x !== prior.x ? 'x' : 'y';
    if (lastDirection && direction !== lastDirection) waypoints.push(points[i - 1]);
    lastDirection = direction;
    prior = point;
  }
  if (points.length) waypoints.push(points.at(-1));
  for (const point of waypoints) if (!travel(state, point, segments, { counter })) return null;
  if (!travel(state, center(candidate.end, state.width), segments, { counter })) return null;
  if (
    state.status !== 'won' &&
    (state.status !== 'running' ||
      state.lives < original.lives ||
      state.coverage <= original.coverage)
  )
    return null;
  return { state, segments };
}

export function findRoute(
  level,
  classes,
  turnPolicy,
  { maxCuts = 14, maxMilliseconds = 45000, classId = 'scout' } = {},
) {
  const started = performance.now();
  let state = createRun(level, {
    seed: 1,
    turnPolicy,
    classId,
    classRecipes: classes,
  });
  const segments = [];
  let examined = 0,
    simulatedTicks = 0;
  for (let cut = 0; cut < maxCuts && state.status !== 'won'; cut++) {
    let best = null,
      bestScore = -Infinity;
    for (const candidate of candidates(state)) {
      if (performance.now() - started > maxMilliseconds)
        return {
          won: false,
          reason: 'Search time budget reached',
          examined,
          simulatedTicks,
          milliseconds: performance.now() - started,
          summary: getSummary(state),
        };
      const counter = { ticks: 0 },
        trial = tryCandidate(state, candidate, counter);
      examined++;
      simulatedTicks += counter.ticks;
      if (!trial) continue;
      const required =
        trial.state.objectives.filter((o) => o.required && o.captured).length -
        state.objectives.filter((o) => o.required && o.captured).length;
      const score =
        (trial.state.status === 'won' ? 10000 : 0) +
        (trial.state.coverage - state.coverage) * 100 +
        required * 30 -
        (trial.state.tick - state.tick) / 2400;
      if (score > bestScore) {
        best = trial;
        bestScore = score;
      }
    }
    if (!best)
      return {
        won: false,
        reason: 'No improving safe straight cut found',
        examined,
        simulatedTicks,
        milliseconds: performance.now() - started,
        summary: getSummary(state),
      };
    for (const segment of best.segments) append(segments, segment.input, segment.ticks);
    state = best.state;
  }
  return {
    won: state.status === 'won',
    reason: state.status === 'won' ? 'completed' : 'Cut budget reached',
    segments,
    examined,
    simulatedTicks,
    milliseconds: performance.now() - started,
    summary: getSummary(state),
  };
}
