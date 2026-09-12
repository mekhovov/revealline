#!/usr/bin/env node
/** Input-only campaign proof and bounded straight-cut route search. No run fields are edited. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRun, stepRun, getSummary, FIXED_DT, CELL } from '../game/core/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROOF_FILE = path.join(ROOT, 'game/replays/campaign-routes.json');
export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const directions = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'right', dx: 1, dy: 0 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
];
const center = (index) => ({ x: (index % 48) + 0.5, y: Math.floor(index / 48) + 0.5 });
const idx = (x, y) => y * 48 + x;

export async function loadInputs() {
  return {
    campaign: JSON.parse(await fs.readFile(path.join(ROOT, 'game/content/campaign.json'), 'utf8')),
    classes: JSON.parse(await fs.readFile(path.join(ROOT, 'game/content/classes.json'), 'utf8')),
  };
}

function safePaths(state) {
  const start = idx(Math.floor(state.player.x), Math.floor(state.player.y));
  const parents = new Int32Array(48 * 36).fill(-1),
    queue = [start];
  parents[start] = start;
  for (let p = 0; p < queue.length; p++) {
    const current = queue[p],
      x = current % 48,
      y = Math.floor(current / 48);
    for (const d of directions) {
      const nx = x + d.dx,
        ny = y + d.dy;
      if (nx < 0 || nx > 47 || ny < 0 || ny > 35) continue;
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
  const { start, parents, reachable } = safePaths(state),
    result = [];
  for (const origin of reachable)
    for (const d of directions) {
      let x = (origin % 48) + d.dx,
        y = Math.floor(origin / 48) + d.dy;
      if (x < 1 || x > 46 || y < 1 || y > 34 || state.cells[idx(x, y)] !== CELL.FIELD) continue;
      let length = 0;
      while (x >= 0 && x < 48 && y >= 0 && y < 36 && state.cells[idx(x, y)] === CELL.FIELD) {
        length++;
        x += d.dx;
        y += d.dy;
      }
      if (x < 0 || x > 47 || y < 0 || y > 35 || state.cells[idx(x, y)] !== CELL.SAFE) continue;
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

function travel(state, target, segments, { action = false, counter } = {}) {
  const dx = target.x - state.player.x,
    dy = target.y - state.player.y;
  if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6) return false;
  const distance = Math.abs(dx) + Math.abs(dy);
  if (distance < 1e-6) return true;
  const direction = Math.abs(dx) > 1e-6 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  const ticks = Math.round(
    distance / (state.rules.moveSpeed * state.rules.boostMultiplier * FIXED_DT),
  );
  for (let i = 0; i < ticks && state.status !== 'won' && state.status !== 'lost'; i++) {
    const input = { direction, boost: true, action: action && i === 0 };
    stepRun(state, input, FIXED_DT);
    if (counter) counter.ticks++;
    append(segments, input, 1);
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
  const points = candidate.path.map(center);
  let prior = center(idx(Math.floor(original.player.x), Math.floor(original.player.y))),
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
  if (!travel(state, center(candidate.end), segments, { action: true, counter })) return null;
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
  { maxCuts = 14, maxMilliseconds = 45000 } = {},
) {
  const started = performance.now();
  let state = createRun(level, {
    seed: 1,
    turnPolicy,
    classId: 'interceptor',
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

export function replayProof(level, classes, route) {
  if (route.levelSha256 !== digest(level) || route.classesSha256 !== digest(classes))
    throw new Error(`Proof content changed: ${route.levelId}`);
  if (
    route.levelId !== level.id ||
    !['immediate', 'grid-center'].includes(route.turnPolicy) ||
    route.classId !== 'interceptor' ||
    route.seed !== 1
  )
    throw new Error('Unsupported proof identity');
  const state = createRun(level, {
    seed: route.seed,
    turnPolicy: route.turnPolicy,
    classId: route.classId,
    classRecipes: classes,
  });
  let ticks = 0;
  for (const segment of route.segments) {
    if (!Number.isInteger(segment.ticks) || segment.ticks < 1 || ticks + segment.ticks > 20000)
      throw new Error('Invalid proof tick budget');
    for (let i = 0; i < segment.ticks; i++) {
      if (state.status === 'won' || state.status === 'lost')
        throw new Error('Proof contains input after terminal result');
      stepRun(state, segment.input, FIXED_DT);
      ticks++;
    }
  }
  if (
    state.status !== 'won' ||
    state.coverage + 1e-9 < level.goal.coverage ||
    state.objectives.some((o) => o.required && !o.captured)
  )
    throw new Error(`Route did not complete ${level.id}/${route.turnPolicy}`);
  return getSummary(state);
}

export async function verifyCampaign(file = PROOF_FILE) {
  const { campaign, classes } = await loadInputs(),
    proof = JSON.parse(await fs.readFile(file, 'utf8'));
  if (
    proof.version !== 'xonix-campaign-proof.v1' ||
    proof.campaignId !== campaign.id ||
    proof.campaignRevision !== campaign.revision ||
    proof.routes.length !== campaign.levels.length * 2
  )
    throw new Error('Incomplete or mismatched campaign proof');
  const summaries = [],
    seen = new Set();
  for (const route of proof.routes) {
    const key = `${route.levelId}/${route.turnPolicy}`;
    if (seen.has(key)) throw new Error(`Duplicate route ${key}`);
    seen.add(key);
    const level = campaign.levels.find((l) => l.id === route.levelId);
    if (!level) throw new Error(`Unknown proof level ${route.levelId}`);
    const result = replayProof(level, classes, route);
    if (JSON.stringify(result) !== JSON.stringify(route.expected))
      throw new Error(`Proof result changed: ${key}`);
    summaries.push(result);
  }
  return { campaign: campaign.id, verified: summaries.length, summaries };
}

async function discover(out) {
  const { campaign, classes } = await loadInputs(),
    routes = [],
    started = performance.now();
  let examined = 0,
    simulatedTicks = 0;
  for (const level of campaign.levels) {
    const route = findRoute(level, classes, 'immediate');
    examined += route.examined;
    simulatedTicks += route.simulatedTicks;
    process.stdout.write(
      `${level.id}: ${route.won ? 'won' : 'UNSOLVED'} ${route.reason}, ${route.examined} candidates, ${Math.round(route.milliseconds)}ms, coverage ${(route.summary.coverage * 100).toFixed(1)}%\n`,
    );
    if (!route.won)
      throw new Error(
        `Bounded route search stopped at ${level.id}; no success is claimed for remaining levels`,
      );
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const fixture = {
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: digest(level),
        classesSha256: digest(classes),
        seed: 1,
        turnPolicy,
        classId: 'interceptor',
        segments: route.segments,
      };
      fixture.expected = replayProof(level, classes, fixture);
      routes.push(fixture);
    }
  }
  const proof = {
    version: 'xonix-campaign-proof.v1',
    campaignId: campaign.id,
    campaignRevision: campaign.revision,
    method:
      'Input-only greedy straight-cut search; full normal createRun and unmodified stepRun. No claim about balance or player skill.',
    routes,
  };
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(
    JSON.stringify({
      out,
      routes: routes.length,
      examined,
      simulatedTicks,
      milliseconds: Math.round(performance.now() - started),
    }) + '\n',
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const task =
    args[0] === '--discover' && args[1] === '--out' && args.length === 3
      ? discover(path.resolve(args[2]))
      : args.length === 0
        ? verifyCampaign().then((result) =>
            process.stdout.write(JSON.stringify(result, null, 2) + '\n'),
          )
        : Promise.reject(
            new Error('Use no arguments to verify, or --discover --out NEW_FILE.json'),
          );
  task.catch((error) => {
    process.stderr.write(`Campaign proof error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
