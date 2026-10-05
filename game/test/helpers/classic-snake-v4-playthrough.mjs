import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
} from '../../snake/classic-core.mjs';
import {
  classicSnakeContactHazardV4,
  classicSnakeHazardAtV4,
} from '../../snake/classic-core-v4.mjs';

const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const opposite = { up: 'down', right: 'left', down: 'up', left: 'right' };
const key = ({ x, y }) => `${x},${y}`;
const same = (a, b) => a.x === b.x && a.y === b.y;
function inputs(run) {
  const choices = run.snakes.map((snake) =>
    Object.keys(directions).filter((dir) => dir !== opposite[snake.direction]),
  );
  return choices.length === 1
    ? choices[0].map((dir) => [dir])
    : choices[0].flatMap((a) => choices[1].map((b) => [a, b]));
}
function safelyContinues(run) {
  if (run.status === 'won') return true;
  return inputs(run).some((input) => {
    const next = structuredClone(run);
    input.forEach((dir, playerId) => queueClassicSnakeTurn(next, playerId, dir));
    stepClassicSnake(next);
    return next.status !== 'lost';
  });
}

function distanceToObjectives(run, snake) {
  const walls = new Set(
    run.level.walls.filter((at) => !run.removedWalls.some((cell) => same(cell, at))).map(key),
  );
  for (const actor of run.snakes) for (const at of actor.body.slice(1, -1)) walls.add(key(at));
  for (const gate of run.shutters) if (gate.closed) for (const at of gate.cells) walls.add(key(at));
  const objectives = run.targets.filter(
    (target) => target.kind !== 'relay' || target.phase === 'open',
  );
  for (const relay of run.relays) if (!relay.collected) objectives.push(relay);
  for (const target of run.targets)
    if (target.kind === 'relay' && target.phase !== 'open') walls.add(key(target));
  const goals = new Set(objectives.map(key)),
    start = snake.body[0];
  const visited = new Set([key(start)]),
    queue = [{ ...start, distance: 0 }];
  let nearest = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    if (goals.has(key(at))) nearest = Math.min(nearest, at.distance);
    for (const [dx, dy] of Object.values(directions)) {
      const next = { x: at.x + dx, y: at.y + dy },
        identity = key(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= run.level.width ||
        next.y >= run.level.height ||
        walls.has(identity) ||
        visited.has(identity) ||
        classicSnakeHazardAtV4(run, next, at)
      )
        continue;
      const target = run.targets.find((actor) => same(actor, next));
      if (target && classicSnakeContactHazardV4(run.level, target, at)) continue;
      visited.add(identity);
      queue.push({ ...next, distance: at.distance + 1 });
    }
  }
  if (!objectives.length) {
    const policy =
      run.level.targets.required[run.spawnedRequired % run.level.targets.required.length];
    nearest = policy.at
      ? Math.max(0, 6 - Math.abs(start.x - policy.at.x) - Math.abs(start.y - policy.at.y))
      : 0;
  }
  return { distance: Number.isFinite(nearest) ? nearest : 200, space: visited.size };
}

/** A deterministic qualification pilot: only submits ordinary player input.
 * It is deliberately not used by gameplay or by the rating runtime. */
export function proveClassicSnakeV4(level, { seed = 17, mode = 'solo', maxSteps = 2400 } = {}) {
  const run = createClassicSnake(level, { seed, mode });
  const visited = new Map();
  while (run.status === 'running' && run.tick < maxSteps) {
    const ranked = [];
    for (const input of inputs(run)) {
      const candidate = structuredClone(run);
      input.forEach((dir, playerId) => queueClassicSnakeTurn(candidate, playerId, dir));
      stepClassicSnake(candidate);
      if (candidate.status === 'lost') continue;
      let score =
        (candidate.catches - run.catches) * 10000 +
        candidate.events.filter((event) => event.type === 'relay.collected').length * 10000;
      for (const snake of candidate.snakes) {
        const result = distanceToObjectives(candidate, snake);
        score -= result.distance * 100;
        if (result.space < snake.body.length + 4) score -= 20000;
        score -= (visited.get(`${snake.id}:${key(snake.body[0])}:${candidate.catches}`) ?? 0) * 9;
        if (input[snake.id] === run.snakes[snake.id].direction) score += 0.25;
      }
      ranked.push({ score: candidate.status === 'won' ? Infinity : score, input, candidate });
    }
    ranked.sort((a, b) => b.score - a.score);
    const best = ranked.find(({ candidate }) => safelyContinues(candidate));
    if (!best)
      throw new Error(`No safe qualification move: ${level.id}/${mode}/${seed}, tick ${run.tick}`);
    best.input.forEach((dir, playerId) => queueClassicSnakeTurn(run, playerId, dir));
    stepClassicSnake(run);
    for (const snake of run.snakes) {
      const identity = `${snake.id}:${key(snake.body[0])}:${run.catches}`;
      visited.set(identity, (visited.get(identity) ?? 0) + 1);
    }
  }
  if (run.status !== 'won')
    throw new Error(
      `No qualification win: ${level.id}/${mode}/${seed}, ${run.catches}/${run.level.goal} catches, tick ${run.tick}, state ${JSON.stringify({ snakes: run.snakes, targets: run.targets, relays: run.relays })}`,
    );
  return exportClassicSnakeReplay(run);
}
