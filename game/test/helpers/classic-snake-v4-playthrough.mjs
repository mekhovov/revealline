import { operationActivationsMet } from '../../snake/classic-routing-v5.mjs';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
  classicSnakeUsesVariableHazards,
  CLASSIC_SNAKE_V4_CORE,
  CLASSIC_SNAKE_V5_CORE,
} from '../../snake/classic-core.mjs';
import {
  classicSnakeContactHazardV4,
  classicSnakeHazardAtV4,
} from '../../snake/classic-core-v4.mjs';

const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const opposite = { up: 'down', right: 'left', down: 'up', left: 'right' };
const key = ({ x, y }) => `${x},${y}`;
const same = (a, b) => a.x === b.x && a.y === b.y;
const targetsOf = (run) => run.targets ?? (run.target ? [run.target] : []);
function destination(level, at, dx, dy) {
  const x = at.x + dx,
    y = at.y + dy;
  return level.wrap
    ? { x: (x + level.width) % level.width, y: (y + level.height) % level.height }
    : { x, y };
}
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
    run.level.walls.filter((at) => !run.removedWalls?.some((cell) => same(cell, at))).map(key),
  );
  for (const actor of run.snakes) for (const at of actor.body.slice(1, -1)) walls.add(key(at));
  for (const gate of run.shutters ?? [])
    if (gate.closed) for (const at of gate.cells) walls.add(key(at));
  const targets = targetsOf(run);
  let objectives = targets.filter(
    (target) => target.role !== 'bonus' && (target.kind !== 'relay' || target.phase === 'open'),
  );
  for (const relay of run.relays ?? []) if (!relay.collected) objectives.push(relay);
  for (const target of targets)
    if (target.kind === 'relay' && target.phase !== 'open') walls.add(key(target));
  if (run.operation) {
    const recipe = run.level.operation,
      state = run.operation,
      stage = recipe.stages[state.stage];
    const carried = state.parcels.filter((p) => p.state === 'carried' && p.carrier === snake.id);
    const waiting = recipe.parcels.filter(
      (p) =>
        stage?.deliveries.includes(p.id) &&
        state.parcels.some((s) => s.id === p.id && s.state === 'waiting'),
    );
    const docks = carried.map(
      (p) => recipe.docks.find((d) => d.id === recipe.parcels.find((r) => r.id === p.id).dockId).at,
    );
    const pendingActivations = (stage?.activations ?? [])
      .filter((goal) => {
        const s = (goal.kind === 'switchyard' ? state.switchyards : state.plates).find(
          (s) => s.id === goal.id,
        );
        return (goal.kind === 'switchyard' ? s.toggles : s.activations) < goal.count;
      })
      .flatMap((goal) =>
        goal.kind === 'switchyard'
          ? recipe.switchyards.find((g) => g.id === goal.id).switches
          : recipe.plates.find((g) => g.id === goal.id).pads,
      );
    const ready =
      stage &&
      operationActivationsMet(run, stage) &&
      run.catches >= stage.catches &&
      stage.deliveries.every((id) =>
        state.parcels.some((p) => p.id === id && p.state === 'delivered'),
      );
    objectives = pendingActivations.length
      ? pendingActivations
      : docks.length
        ? docks
        : waiting.length
          ? waiting.map((p) => p.at)
          : ready && stage.exit
            ? [stage.exit]
            : stage && run.catches < stage.catches
              ? objectives
              : [];
  }
  const goals = new Set(objectives.map(key)),
    start = snake.body[0];
  const visited = new Set([key(start)]),
    queue = [{ ...start, distance: 0 }];
  let nearest = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    if (goals.has(key(at))) nearest = Math.min(nearest, at.distance);
    for (const [dx, dy] of Object.values(directions)) {
      const next = destination(run.level, at, dx, dy),
        identity = key(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= run.level.width ||
        next.y >= run.level.height ||
        walls.has(identity) ||
        visited.has(identity) ||
        ([CLASSIC_SNAKE_V4_CORE, CLASSIC_SNAKE_V5_CORE].includes(run.version) &&
          classicSnakeHazardAtV4(run, next, at))
      )
        continue;
      const target = targets.find((actor) => same(actor, next));
      if (target && classicSnakeContactHazardV4(run.level, target, at)) {
        // Stay close to a protected objective without pretending its cell is
        // traversable. Otherwise a temporary shield makes every route equally
        // distant and the pilot leaves just before the recovery window.
        if (goals.has(identity)) nearest = Math.min(nearest, at.distance + 1);
        continue;
      }
      visited.add(identity);
      queue.push({ ...next, distance: at.distance + 1 });
    }
  }
  if (!objectives.length && !run.operation) {
    const policies = run.level.targets?.required;
    const policy = policies?.[run.spawnedRequired % policies.length];
    nearest = policy?.at
      ? Math.max(0, 6 - Math.abs(start.x - policy.at.x) - Math.abs(start.y - policy.at.y))
      : 0;
  }
  if (!objectives.length && run.operation) nearest = 0;
  return { distance: Number.isFinite(nearest) ? nearest : 200, space: visited.size };
}

/** A deterministic qualification pilot for v1-v5: only submits ordinary player input.
 * It is deliberately not used by gameplay or by the rating runtime. */
export function proveClassicSnakeV4(
  level,
  { seed = 17, hazardSeed = 17, mode = 'solo', maxSteps = 2400, maxBacktracks = 512 } = {},
) {
  let run = createClassicSnake(level, {
    seed,
    mode,
    ...(classicSnakeUsesVariableHazards(level) ? { hazardSeed } : {}),
  });
  const progressKey = (run) =>
    run.operation ? JSON.stringify([run.catches, run.operation]) : run.catches;
  let visited = new Map();
  const decisions = [];
  let backtracks = 0;
  const apply = (input) => {
    input.forEach((dir, playerId) => queueClassicSnakeTurn(run, playerId, dir));
    stepClassicSnake(run);
    for (const snake of run.snakes) {
      const identity = `${snake.id}:${key(snake.body[0])}:${progressKey(run)}`;
      visited.set(identity, (visited.get(identity) ?? 0) + 1);
    }
  };
  const resumeAlternative = () => {
    while (decisions.length && backtracks < maxBacktracks) {
      const decision = decisions.at(-1);
      const input = decision.remaining.shift();
      if (!decision.remaining.length) decisions.pop();
      backtracks++;
      // Search resumes from a state reached by real input, never by placing
      // actors or modifying clocks. Only the winning branch is exported.
      run = structuredClone(decision.run);
      visited = new Map(decision.visited);
      apply(input);
      if (run.status !== 'lost' && safelyContinues(run)) return true;
    }
    return false;
  };
  while (run.status === 'running') {
    if (run.tick >= maxSteps) {
      if (resumeAlternative()) continue;
      break;
    }
    const ranked = [];
    for (const input of inputs(run)) {
      const candidate = structuredClone(run);
      input.forEach((dir, playerId) => queueClassicSnakeTurn(candidate, playerId, dir));
      stepClassicSnake(candidate);
      if (candidate.status === 'lost') continue;
      let score =
        (candidate.catches - run.catches) * 10000 +
        candidate.events.filter((event) =>
          [
            'relay.collected',
            'cargo.collected',
            'cargo.delivered',
            'operation.stage-completed',
          ].includes(event.type),
        ).length *
          10000;
      for (const goal of run.level.operation?.stages[run.operation.stage]?.activations ?? []) {
        const value = (r) => {
          const state = (
            goal.kind === 'switchyard' ? r.operation.switchyards : r.operation.plates
          ).find((s) => s.id === goal.id);
          return Math.min(
            goal.count,
            goal.kind === 'switchyard' ? state.toggles : state.activations,
          );
        };
        score += (value(candidate) - value(run)) * 10000;
      }
      for (const snake of candidate.snakes) {
        const result = distanceToObjectives(candidate, snake);
        score -= result.distance * 100;
        if (result.space < snake.body.length + 4) score -= 20000;
        score -=
          (visited.get(`${snake.id}:${key(snake.body[0])}:${progressKey(candidate)}`) ?? 0) * 9;
        if (input[snake.id] === run.snakes[snake.id].direction) score += 0.25;
      }
      ranked.push({ score: candidate.status === 'won' ? Infinity : score, input, candidate });
    }
    ranked.sort((a, b) => b.score - a.score);
    const bestIndex = ranked.findIndex(({ candidate }) => safelyContinues(candidate));
    if (bestIndex < 0) {
      if (resumeAlternative()) continue;
      throw new Error(`No safe qualification move: ${level.id}/${mode}/${seed}, tick ${run.tick}`);
    }
    const remaining = ranked.slice(bestIndex + 1).map(({ input }) => input);
    if (remaining.length) {
      decisions.push({ run: structuredClone(run), visited: new Map(visited), remaining });
      // Keep search memory bounded even for a long journal.
      if (decisions.length > 48) decisions.shift();
    }
    apply(ranked[bestIndex].input);
  }
  if (run.status !== 'won')
    throw new Error(
      `No qualification win: ${level.id}/${mode}/${seed}, ${run.catches}/${run.level.goal} catches, tick ${run.tick}, state ${JSON.stringify({ snakes: run.snakes, targets: run.targets, relays: run.relays })}`,
    );
  return exportClassicSnakeReplay(run);
}
