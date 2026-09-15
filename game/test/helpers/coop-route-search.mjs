import { createCoop, startCoop, stepCoop } from '../../coop/core.mjs';
import { FIRST_CONNECTION } from '../../coop/first-connection.mjs';
import { RELAY_YARD } from '../../coop/relay-yard.mjs';

const command = (direction = null, support = false, boost = true) => ({
  direction,
  boost,
  support,
});
/** Rehearsed waypoint controller: the only simulation writes are public commands.
 * Per-seat release ticks mirror the host after banking/down/recovery. Support
 * reacts to visible threats in range; the final log can be replayed without a planner.
 */
export function trial(
  level,
  difficulty,
  { cover = true, boost = true, coverDrifters = true } = {},
) {
  const run = startCoop(createCoop(level, { difficulty, seed: 17 }));
  const log = [],
    events = [],
    stages = [],
    release = new Set();
  function tick(directions) {
    const inputs = directions.map((direction, id) => {
      if (release.delete(id)) return command(null, false, false);
      const player = run.players[id];
      const support =
        cover &&
        player.support.readyAt <= run.time &&
        (run.enemies.some(
          (enemy) =>
            enemy.active !== false &&
            ((coverDrifters && enemy.type === 'drifter') ||
              ['warning', 'commit'].includes(enemy.phase)) &&
            Math.hypot(enemy.x - player.x, enemy.y - player.y) <= 5.9,
        ) ||
          run.impacts.some(
            (impact) => Math.hypot(impact.x - player.x, impact.y - player.y) <= 5.9,
          ));
      return command(direction, support, boost);
    });
    stepCoop(run, inputs);
    log.push(inputs);
    events.push(...structuredClone(run.events));
    for (const event of run.events)
      if (['cut.closed', 'player.downed', 'player.revived'].includes(event.type))
        release.add(event.player);
    return !events.some((event) => event.type === 'player.downed');
  }
  function stage(label, directions, finished, limit = 1800) {
    let count = 0;
    while (!finished() && run.status === 'running' && count++ < limit) {
      if (!tick(typeof directions === 'function' ? directions(run) : directions)) break;
    }
    stages.push({
      label,
      tick: run.tick,
      time: run.time,
      coverage: run.coverage,
      players: run.players.map(({ x, y, status, cutting }) => ({ x, y, status, cutting })),
      enemies: run.enemies.map(({ id, x, y, phase }) => ({ id, x, y, phase })),
    });
    return finished() && !events.some((event) => event.type === 'player.downed');
  }
  const to = (axis, targets) =>
    run.players.map((player, id) =>
      Math.abs(player[axis] - targets[id]) <= 0.051
        ? null
        : player[axis] < targets[id]
          ? axis === 'x'
            ? 'right'
            : 'down'
          : axis === 'x'
            ? 'left'
            : 'up',
    );
  const at = (axis, targets) =>
    run.players.every((player, id) => Math.abs(player[axis] - targets[id]) <= 0.051);
  return { run, log, events, stages, tick, stage, to, at };
}

export function yardOpening(difficulty, options = {}) {
  const t = trial(RELAY_YARD, difficulty, options),
    { run, stage, to, at } = t;
  if (
    !stage(
      'up outside pillars',
      () => to('y', [12.5, 12.5]),
      () => at('y', [12.5, 12.5]),
    )
  )
    return t;
  if (!stage('join above pillars', ['right', 'left'], () => run.claimedCount > 0)) return t;
  const resumeTick = run.tick + (options.waitAfterOpening || 0);
  if (!stage('wait on newly banked safe ground', [null, null], () => run.tick >= resumeTick))
    return t;
  if (
    !stage(
      'spread to anchors',
      () => to('x', [23.5, 48.5]),
      () => at('x', [23.5, 48.5]),
    )
  )
    return t;
  if (
    !stage('bank both anchors', ['up', 'up'], () =>
      run.strongholds[0].anchors.every((a) => a.captured),
    )
  )
    return t;
  if (
    !stage(
      'align with exposed core',
      () => to('y', [6.5, 6.5]),
      () => at('y', [6.5, 6.5]),
    )
  )
    return t;
  stage('joint core cut', ['right', 'left'], () => run.status === 'won');
  return t;
}

export function coverageOpening(difficulty, row = 5.5, options) {
  const t = trial(FIRST_CONNECTION, difficulty, options),
    { run, stage, to, at } = t;
  if (
    !stage(
      'move along perimeter',
      () => to('y', [row, row]),
      () => at('y', [row, row]),
    )
  )
    return t;
  stage('join upper field', ['right', 'left'], () => run.claimedCount > 0);
  return t;
}

export function coverageClear(difficulty, options) {
  // Let the lower patrols pass out of the planned capture. Blindly slowing every
  // nearby drifter would change which side of that cut retains its territory.
  const t = coverageOpening(difficulty, 12.5, { ...options, coverDrifters: false }),
    { run, stage, to, at } = t;
  if (t.events.some((e) => e.type === 'player.downed')) return t;
  if (
    !stage(
      'spread to lower flanks',
      () => to('x', [26.5, 45.5]),
      () => at('x', [26.5, 45.5]),
    )
  )
    return t;
  if (
    !stage('bank lower outer strips', ['down', 'down'], () =>
      run.players.every((p) => p.y >= 34.99),
    )
  )
    return t;
  if (
    !stage(
      'up earned safe columns',
      () => to('y', [22.5, 22.5]),
      () => at('y', [22.5, 22.5]),
    )
  )
    return t;
  const upper = run.claimedCount;
  if (!stage('upper central join', ['right', 'left'], () => run.claimedCount > upper)) return t;
  if (
    !stage(
      'spread again',
      () => to('x', [26.5, 45.5]),
      () => at('x', [26.5, 45.5]),
    )
  )
    return t;
  if (
    !stage(
      'down earned safe columns',
      () => to('y', [26.5, 26.5]),
      () => at('y', [26.5, 26.5]),
    )
  )
    return t;
  const lower = run.claimedCount;
  stage(
    'lower central join',
    ['right', 'left'],
    () => run.status === 'won' || run.claimedCount > lower,
  );
  return t;
}

export function cornerOpening(level, difficulty) {
  const t = trial(level, difficulty, { cover: false, boost: false }),
    { run, stage, to, at } = t;
  if (
    !stage(
      'up safe perimeter',
      () => to('y', [0.5, 0.5]),
      () => at('y', [0.5, 0.5]),
    )
  )
    return t;
  if (
    !stage(
      'along safe top',
      () => to('x', [6.5, 65.5]),
      () => at('x', [6.5, 65.5]),
    )
  )
    return t;
  if (
    !stage(
      'short cuts down',
      () => to('y', [8.5, 8.5]),
      () => at('y', [8.5, 8.5]),
    )
  )
    return t;
  stage(
    'return to perimeter',
    ['left', 'right'],
    () => run.claimedCount > 0 && run.players.every((p) => !p.cutting),
  );
  return t;
}

export function oldYardShortcut(difficulty) {
  const t = trial(RELAY_YARD, difficulty, { cover: false, boost: true }),
    { run, stage } = t;
  if (
    !stage(
      'inward past outer lanes',
      ['right', 'left'],
      () => run.players[0].x >= 14.45 && run.players[1].x <= 57.55,
    )
  )
    return t;
  if (!stage('up before pillars', ['up', 'up'], () => run.players.every((p) => p.y <= 11.51)))
    return t;
  if (
    !stage('join through anchors', ['right', 'left'], () =>
      run.strongholds[0].anchors.every((a) => a.captured),
    )
  )
    return t;
  if (
    !stage(
      'small spread',
      ['left', 'right'],
      () => run.players[0].x <= 33.51 && run.players[1].x >= 38.49,
    )
  )
    return t;
  if (!stage('unguarded-core shortcut', ['up', 'up'], () => run.players.every((p) => p.y <= 4.51)))
    return t;
  stage('small joint loop', ['right', 'left'], () => run.status === 'won');
  return t;
}

export function replayRoute(
  level,
  difficulty,
  log,
  { swapped = false, withoutSupport = false } = {},
) {
  const authored = structuredClone(level);
  if (swapped) authored.spawns.reverse();
  const run = startCoop(createCoop(authored, { difficulty, seed: 17 })),
    events = [];
  for (const inputs of log) {
    const commands = inputs.map((command) => ({
      ...command,
      ...(withoutSupport ? { support: false } : {}),
    }));
    if (swapped) commands.reverse();
    const previous = run.tick;
    stepCoop(run, commands);
    if (run.tick !== previous) events.push(...structuredClone(run.events));
  }
  return { run, events };
}

if (process.argv[1]?.endsWith('coop-route-search.mjs')) {
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    for (const route of [coverageClear, yardOpening]) {
      const result = route(difficulty);
      const without = replayRoute(
        route === coverageClear ? FIRST_CONNECTION : RELAY_YARD,
        difficulty,
        result.log,
        { withoutSupport: true },
      );
      console.log(
        JSON.stringify({
          evidence: 'rehearsed public-command route, not typical human performance',
          level: result.run.level.id,
          difficulty,
          status: result.run.status,
          seconds: result.run.time,
          coverage: result.run.coverage,
          downs: result.events.filter((event) => event.type === 'player.downed').length,
          withoutSupport: {
            status: without.run.status,
            downs: without.events.filter((event) => event.type === 'player.downed').length,
          },
        }),
      );
    }
  }
}
