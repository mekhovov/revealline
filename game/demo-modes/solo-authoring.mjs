import { CELL, FIXED_DT, createRun, stepRun } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  MAX_REPLAY_TICKS,
} from '../replay.mjs';

const DIRECTIONS = [
  { name: 'up', x: 0, y: -1 },
  { name: 'right', x: 1, y: 0 },
  { name: 'down', x: 0, y: 1 },
  { name: 'left', x: -1, y: 0 },
];
const at = (run, point) => Math.floor(point.y) * run.width + Math.floor(point.x);
const center = (run, cell) => ({
  x: (cell % run.width) + 0.5,
  y: Math.floor(cell / run.width) + 0.5,
});
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const direction = (a, b) =>
  Math.abs(a.x - b.x) > 1e-6 ? (b.x > a.x ? 'right' : 'left') : b.y > a.y ? 'down' : 'up';
const adjacent = (run, cell) =>
  DIRECTIONS.map((d) => ({ cell: cell + d.x + d.y * run.width, d })).filter(
    ({ cell: next, d }) =>
      next >= 0 &&
      next < run.cells.length &&
      (d.x === 0 || Math.floor(next / run.width) === Math.floor(cell / run.width)),
  );
const safe = (run, cell) => run.cells[cell] === CELL.SAFE;
const field = (run, cell) => run.cells[cell] === CELL.FIELD && run.classic?.terrain[cell] !== 2;

function candidates(run, decision) {
  const anchor = { x: run.player.x, y: run.player.y },
    heading = DIRECTIONS.find((d) => d.name === run.player.direction);
  const axis = heading.x ? 'x' : 'y',
    sign = heading.x || heading.y;
  if (Math.abs(anchor[axis] - Math.round(anchor[axis] - 0.5) - 0.5) > 1e-6)
    anchor[axis] =
      sign > 0 ? Math.ceil(anchor[axis] - 0.5) + 0.5 : Math.floor(anchor[axis] - 0.5) + 0.5;
  const start = at(run, anchor),
    parents = new Int32Array(run.cells.length).fill(-1),
    queue = [start];
  parents[start] = start;
  for (let i = 0; i < queue.length; i++)
    for (const { cell } of adjacent(run, queue[i]))
      if (parents[cell] < 0 && safe(run, cell)) {
        parents[cell] = queue[i];
        queue.push(cell);
      }
  const result = [],
    origins = queue.filter((cell) => adjacent(run, cell).some((next) => field(run, next.cell)));
  for (const origin of origins) {
    const previous = new Int32Array(run.cells.length).fill(-1),
      depths = new Uint16Array(run.cells.length),
      open = [];
    previous[origin] = origin;
    for (const { cell } of adjacent(run, origin))
      if (field(run, cell)) {
        previous[cell] = origin;
        depths[cell] = 1;
        open.push(cell);
      }
    for (let pos = 0; pos < open.length; pos++) {
      const cell = open[pos];
      if (depths[cell] > 96) continue;
      for (const { cell: next } of adjacent(run, cell)) {
        if (
          next !== origin &&
          safe(run, next) &&
          depths[cell] >= 2 &&
          distance(center(run, origin), center(run, next)) >= 2
        ) {
          const trail = [next];
          for (let cursor = cell; cursor !== origin; cursor = previous[cursor]) trail.push(cursor);
          trail.push(origin);
          trail.reverse();
          const points = trail.map((value) => center(run, value));
          const area =
            (Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))) *
            (Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)));
          const approach = [];
          for (let cursor = origin; cursor !== start; cursor = parents[cursor])
            approach.push(cursor);
          approach.reverse();
          const all = [...approach, ...trail.slice(1)].map((value) => center(run, value)),
            vertices = [];
          const startCenter = center(run, start);
          let prior = startCenter;
          for (let i = 0; i < all.length; i++) {
            if (i === all.length - 1 || direction(prior, all[i]) !== direction(all[i], all[i + 1]))
              vertices.push(all[i]);
            prior = all[i];
          }
          const prefix = [];
          if (distance(run.player, anchor) > 1e-6) prefix.push(anchor);
          if (distance(anchor, startCenter) > 1e-6) prefix.push(startCenter);
          vertices.unshift(...prefix);
          result.push({
            origin,
            end: next,
            vertices,
            score: Math.sqrt(area) + depths[cell] * 0.25 - approach.length * 0.1,
            exposed: depths[cell],
          });
        } else if (previous[next] < 0 && field(run, next)) {
          previous[next] = cell;
          depths[next] = depths[cell] + 1;
          open.push(next);
        }
      }
    }
  }
  result.sort((a, b) => b.score - a.score);
  const chosen = [],
    buckets = new Set();
  // Mix long and short, geographically distinct cuts. Narrow mazes need safe
  // partial reveals before a larger route becomes accessible.
  const offset = decision % 7;
  for (const limit of [8, 16, 32, 64, 96]) {
    let added = 0;
    for (let i = offset; i < result.length && added < 16; i++) {
      const item = result[i],
        key = `${Math.floor((item.origin % run.width) / 3)},${Math.floor(Math.floor(item.origin / run.width) / 3)}/${Math.floor(item.exposed / 6)}`;
      if (item.exposed > limit || buckets.has(key)) continue;
      buckets.add(key);
      chosen.push(item);
      added++;
    }
  }
  return chosen;
}

function evaluate(original, route, allowHazardLoss) {
  const run = structuredClone(original),
    segments = [];
  let ticks = 0,
    exposedTicks = 0,
    captured = false;
  const tick = (command) => {
    if (++ticks > 6000) return false;
    if (run.player.cutting) exposedTicks++;
    stepRun(run, command, FIXED_DT);
    const prior = segments.at(-1);
    if (prior?.input.direction === command.direction) prior.ticks++;
    else segments.push({ input: command, ticks: 1 });
    captured ||= run.events.some((event) => event.type === 'cut.closed');
    if (run.lives < original.lives || run.status === 'respawning' || run.status === 'lost')
      return false;
    return true;
  };
  let from = { ...run.player };
  for (const target of route.vertices) {
    const command = { direction: direction(from, target) },
      axis = ['left', 'right'].includes(command.direction) ? 'x' : 'y',
      sign = ['right', 'down'].includes(command.direction) ? 1 : -1;
    let stagnant = 0;
    while ((target[axis] - run.player[axis]) * sign > 1e-6 && !captured && run.status !== 'won') {
      const before = run.player[axis];
      if (!tick(command)) {
        const cause = run.events.find((event) => event.type === 'player.failed')?.cause;
        if (
          allowHazardLoss &&
          exposedTicks >= 240 &&
          ['enemy-trail', 'enemy-player', 'boss-lane', 'combat-projectile'].includes(cause)
        )
          return { segments, run, failure: cause };
        return null;
      }
      stagnant = before === run.player[axis] ? stagnant + 1 : 0;
      if (stagnant > 4) return null;
    }
    if (captured || run.status === 'won') break;
    from = target;
  }
  return captured && run.coverage > original.coverage ? { segments, run } : null;
}

/** Offline authoring only. Route searches are proposals; ordinary native input
 * simulation chooses every cut and the final replay independently proves it. */
export async function authorSoloTerrainDemo(level, options, { onProgress = () => {} } = {}) {
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'revealline-terrain-demo.v1');
  let captures = 0;
  const apply = (input) => {
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
    captures += run.events.filter((e) => e.type === 'cut.closed').length;
  };
  for (let decision = 0; decision < 160 && !['won', 'lost'].includes(run.status); decision++) {
    if (
      captures > 0 &&
      run.encounter &&
      ['transition', 'exposed'].includes(run.encounter.stage) &&
      run.cells.filter((cell) => cell === CELL.FIELD).length <=
        run.level.encounter.minReleaseCutCells
    ) {
      // Isolating the Sentinel is an ordinary goal path: its core opens after
      // the announced attack cycle. Keep this short observation only when the
      // actual engine awards a no-loss win; never retain an idle failure.
      const observed = structuredClone(run),
        recipe = run.level.encounter,
        budget =
          recipe.transitionTicks +
          2 *
            (recipe.exposed.warningTicks + recipe.exposed.activeTicks + recipe.exposed.openTicks) +
          2;
      let ticks = 0;
      while (ticks < budget && observed.status === 'running' && observed.lives === run.lives) {
        stepRun(observed, {}, FIXED_DT);
        ticks++;
      }
      if (observed.status === 'won' && observed.lives === run.lives) {
        for (let tick = 0; tick < ticks; tick++) apply({});
        break;
      }
    }
    const routes = candidates(run, decision),
      successful = [],
      failed = [];
    for (const route of routes) {
      const trial = evaluate(run, route, captures > 0);
      if (trial) (trial.failure ? failed : successful).push(trial);
    }
    successful.sort((a, b) => b.run.coverage - a.run.coverage);
    let chosen = successful[0] ?? failed[0];
    if (!chosen) {
      // A moving hazard can seal every presently safe exit. Observe a short,
      // verified opening from stopped safe ground, then attempt a real route.
      // Never retain an idle loss or turn bounded waiting into a terminal run.
      const waiting = structuredClone(run);
      for (let window = 1; window <= 8 && !chosen; window++) {
        let safeWait = true;
        for (let tick = 0; tick < 30; tick++) {
          stepRun(waiting, {}, FIXED_DT);
          if (waiting.status !== 'running' || waiting.lives !== run.lives) {
            safeWait = false;
            break;
          }
        }
        if (!safeWait) break;
        const alternate = [];
        for (const route of candidates(waiting, decision + window)) {
          const trial = evaluate(waiting, route, false);
          if (trial) alternate.push(trial);
        }
        alternate.sort((a, b) => b.run.coverage - a.run.coverage);
        if (alternate.length)
          chosen = {
            ...alternate[0],
            segments: [{ input: {}, ticks: window * 30 }, ...alternate[0].segments],
          };
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    onProgress({
      decision,
      routes: routes.length,
      captures,
      coverage: run.coverage,
      tick: run.tick,
      chosen: !!chosen,
    });
    if (!chosen)
      throw new Error(`No legal goal-directed route after ${captures} captures (${run.coverage}).`);
    if (
      run.tick + chosen.segments.reduce((total, segment) => total + segment.ticks, 0) >
      MAX_REPLAY_TICKS - 600
    )
      break;
    for (const segment of chosen.segments)
      for (let tick = 0; tick < segment.ticks; tick++) apply(segment.input);
    while (run.status === 'respawning') apply({});
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!captures || !['won', 'lost'].includes(run.status))
    throw new Error('Terrain planner did not reach a purposeful terminal outcome.');
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  if (!verified.match)
    throw new Error('Terrain performance failed independent native verification.');
  return replay;
}
