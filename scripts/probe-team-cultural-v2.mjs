// Bounded input-only route search for the second Ukrainian Team spatial slice.
// Feasibility evidence only: it does not establish fun, ordinary player timing,
// cultural approval or release readiness, and it never writes a fixture.
import { performance } from 'node:perf_hooks';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../game/content-design/team-cultural-specialist-v2-originals.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createCoop, FIXED_DT, SAFE, FIELD, startCoop, stepCoop } from '../game/coop/core.mjs';

const DIRECTIONS = Object.freeze([
  { name: 'up', dx: 0, dy: -1 },
  { name: 'right', dx: 1, dy: 0 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
]);
const project = compileContentProject(createTeamCulturalSpecialistV2OriginalCandidates());
const requestedId = process.argv[2] ?? 'all';
const difficulty = process.argv[3] ?? 'standard';
const seed = Number(process.argv[4] ?? 17);
const maxMilliseconds = Number(process.argv[5] ?? 45000);
if (!['gentle', 'standard', 'expert'].includes(difficulty))
  throw new Error('Difficulty must be gentle, standard or expert.');
if (!Number.isSafeInteger(seed) || seed < 1 || seed > 2147483647)
  throw new Error('Seed must be a positive 32-bit integer.');
if (!Number.isSafeInteger(maxMilliseconds) || maxMilliseconds < 1000 || maxMilliseconds > 180000)
  throw new Error('Search budget must be 1000..180000 milliseconds.');

const command = (direction = null) => ({ direction, boost: false, support: false });
const commands = (seat, direction) =>
  [0, 1].map((player) => command(player === seat ? direction : null));

function append(segments, seat, direction, ticks = 1) {
  const next = { a: seat === 0 ? direction : null, b: seat === 1 ? direction : null, ticks };
  const last = segments.at(-1);
  if (last && last.a === next.a && last.b === next.b) last.ticks += ticks;
  else segments.push(next);
}

function step(run, seat, direction, segments) {
  stepCoop(run, commands(seat, direction));
  append(segments, seat, direction);
  return !run.events.some(({ type }) => type === 'player.downed');
}

function safePaths(run, seat) {
  const start = run.players[seat].cellIndex;
  const previous = new Int32Array(run.cells.length).fill(-1);
  const queue = [start];
  previous[start] = start;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    const x = cell % run.level.width;
    const y = Math.floor(cell / run.level.width);
    for (const direction of DIRECTIONS) {
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      if (nx < 0 || nx >= run.level.width || ny < 0 || ny >= run.level.height) continue;
      const next = ny * run.level.width + nx;
      if (previous[next] >= 0 || run.cells[next] !== SAFE) continue;
      previous[next] = cell;
      queue.push(next);
    }
  }
  return { start, previous, reachable: queue };
}

function candidates(run, seat) {
  const { start, previous, reachable } = safePaths(run, seat);
  const options = [];
  for (const origin of reachable) {
    const ox = origin % run.level.width;
    const oy = Math.floor(origin / run.level.width);
    for (const direction of DIRECTIONS) {
      let x = ox + direction.dx;
      let y = oy + direction.dy;
      if (
        x < 0 ||
        x >= run.level.width ||
        y < 0 ||
        y >= run.level.height ||
        run.cells[y * run.level.width + x] !== FIELD
      )
        continue;
      let length = 0;
      while (
        x >= 0 &&
        x < run.level.width &&
        y >= 0 &&
        y < run.level.height &&
        run.cells[y * run.level.width + x] === FIELD
      ) {
        length++;
        x += direction.dx;
        y += direction.dy;
      }
      if (
        x < 0 ||
        x >= run.level.width ||
        y < 0 ||
        y >= run.level.height ||
        run.cells[y * run.level.width + x] !== SAFE
      )
        continue;
      const path = [];
      for (let cell = origin; cell !== start; cell = previous[cell]) path.push(cell);
      path.reverse();
      options.push({ seat, path, direction: direction.name, length });
    }
  }
  options.sort((a, b) => a.length + a.path.length - b.length - b.path.length);
  const selected = [
    ...options.slice(0, 12),
    ...options.slice(-12),
    ...Array.from(
      { length: Math.min(32, options.length) },
      (_, index) => options[Math.floor((index * options.length) / Math.min(32, options.length))],
    ),
  ];
  const seen = new Set();
  return selected.filter((option) => {
    if (!option) return false;
    const key = `${option.seat}/${option.path.at(-1)}/${option.direction}/${option.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pathWaypoints(run, seat, path) {
  const points = path.map((cell) => ({
    x: (cell % run.level.width) + 0.5,
    y: Math.floor(cell / run.level.width) + 0.5,
  }));
  let previous = {
    x: Math.floor(run.players[seat].x) + 0.5,
    y: Math.floor(run.players[seat].y) + 0.5,
  };
  let axis = null;
  const waypoints = [];
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const nextAxis = point.x !== previous.x ? 'x' : 'y';
    if (axis && nextAxis !== axis) waypoints.push(points[index - 1]);
    axis = nextAxis;
    previous = point;
  }
  if (points.length) waypoints.push(points.at(-1));
  return waypoints;
}

function travelSafe(run, seat, target, segments) {
  for (let tick = 0; tick < 1200 && run.status === 'running'; tick++) {
    const player = run.players[seat];
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    if (Math.abs(dx) < 0.045 && Math.abs(dy) < 0.045) return !player.cutting;
    const direction = Math.abs(dx) >= 0.045 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (!step(run, seat, direction, segments) || run.players[seat].cutting) return false;
  }
  return false;
}

function tryCandidate(original, option, waitTicks) {
  const run = structuredClone(original);
  const segments = [];
  const reserves = run.team.reserves;
  for (let tick = 0; tick < waitTicks; tick++)
    if (!step(run, option.seat, null, segments)) return null;
  // A neutral sample is the required fresh-input boundary after a closure.
  if (!step(run, option.seat, null, segments)) return null;
  for (const waypoint of pathWaypoints(run, option.seat, option.path))
    if (!travelSafe(run, option.seat, waypoint, segments)) return null;
  let closed = false;
  for (let tick = 0; tick < 1200 && run.status === 'running'; tick++) {
    if (!step(run, option.seat, option.direction, segments)) return null;
    if (
      run.events.some(
        ({ type, player, reason }) =>
          type === 'cut.closed' && player === option.seat && reason === 'return',
      )
    ) {
      closed = true;
      break;
    }
  }
  if (run.status !== 'won' && !closed) return null;
  if (
    run.status === 'lost' ||
    run.team.reserves !== reserves ||
    run.players.some(({ support }) => support.uses !== 0) ||
    (run.status !== 'won' && run.coverage <= original.coverage)
  )
    return null;
  return { run, segments };
}

function replay(level, segments) {
  const run = startCoop(createCoop(level, { seed, jointCuts: false }));
  let downs = 0;
  for (const segment of segments)
    for (let tick = 0; tick < segment.ticks && run.status === 'running'; tick++) {
      stepCoop(run, [command(segment.a), command(segment.b)]);
      downs += run.events.filter(({ type }) => type === 'player.downed').length;
    }
  return { run, downs };
}

function search(level) {
  const started = performance.now();
  let run = startCoop(createCoop(level, { seed, jointCuts: false }));
  const segments = [];
  let cuts = 0;
  let examined = 0;
  while (run.status === 'running' && cuts < 40 && performance.now() - started < maxMilliseconds) {
    let best = null;
    for (const seat of [0, 1])
      for (const option of candidates(run, seat))
        for (const waitTicks of [0, 60, 180]) {
          if (performance.now() - started >= maxMilliseconds) break;
          const trial = tryCandidate(run, option, waitTicks);
          examined++;
          if (!trial) continue;
          const gain = trial.run.coverage - run.coverage;
          const score =
            (trial.run.status === 'won' ? 1e9 : 0) +
            gain * 10000 -
            (trial.run.tick - run.tick) / 1200;
          if (!best || score > best.score) best = { ...trial, score };
        }
    if (!best) break;
    run = best.run;
    for (const segment of best.segments) {
      const last = segments.at(-1);
      if (last && last.a === segment.a && last.b === segment.b) last.ticks += segment.ticks;
      else segments.push(structuredClone(segment));
    }
    cuts++;
  }
  const fresh = replay(level, segments);
  return {
    won:
      run.status === 'won' &&
      fresh.run.status === 'won' &&
      fresh.downs === 0 &&
      fresh.run.players.every(({ support }) => support.uses === 0),
    run: fresh.run,
    downs: fresh.downs,
    segments,
    cuts,
    examined,
    elapsedMilliseconds: Math.round(performance.now() - started),
  };
}

for (const mission of project.missions.filter(
  ({ id }) => requestedId === 'all' || id === requestedId,
)) {
  const manifest = resolveMission(project, mission.id, { mode: 'team', difficulty });
  const result = search(manifest.level);
  console.log(
    JSON.stringify({
      evidence: 'bounded omniscient input-only feasibility search; not human balance evidence',
      missionId: mission.id,
      difficulty,
      seed,
      status: result.won ? 'won' : 'route-not-found',
      coverage: result.run.coverage,
      goal: manifest.level.goal.coverage,
      seconds: result.run.time,
      cuts: result.cuts,
      downs: result.downs,
      supportUses: result.run.players.map(({ support }) => support.uses),
      examined: result.examined,
      elapsedMilliseconds: result.elapsedMilliseconds,
      segments: result.won ? result.segments : undefined,
    }),
  );
}
