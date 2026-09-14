import { EPS, movingCirclesTime } from '../core/geometry.mjs';
import {
  cellAt,
  positionAt,
  nextCell,
  enemyWallContact,
  playerWallContact,
  reflectEnemy,
  trailContact,
  circleFitsField,
} from './geometry.mjs';

export const COOP_RULESET = 'revealline-coop.v1';
export const COOP_LEVEL_VERSION = 'revealline-coop-level.v1';
export const FIXED_DT = 1 / 120;
export const FIELD = 0;
export const SAFE = 1;
export const WALL = 2;
export const CELL = Object.freeze({ FIELD, SAFE, WALL });
const PLAYER_RADIUS = 0.18;
const RECOVERY_SECONDS = 0.65;
const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
});
const DIFFICULTIES = Object.freeze({ gentle: 5, standard: 3, expert: 1 });
const finite = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const plain = (value) =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const ownData = (value) =>
  Object.values(Object.getOwnPropertyDescriptors(value)).every((d) => Object.hasOwn(d, 'value'));
const keys = (value, allowed) =>
  plain(value) && ownData(value) && Reflect.ownKeys(value).every((key) => allowed.includes(key));
const dataArray = (value) =>
  Array.isArray(value) &&
  Object.getPrototypeOf(value) === Array.prototype &&
  ownData(value) &&
  Object.keys(value).length === value.length &&
  Reflect.ownKeys(value).length === value.length + 1 &&
  Object.keys(value).every((key, index) => key === String(index));
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 100;

function buildGrid(level) {
  const cells = new Uint8Array(level.width * level.height);
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++)
      if (!x || !y || x === level.width - 1 || y === level.height - 1)
        cells[y * level.width + x] = SAFE;
  for (const [rectangles, kind] of [
    [level.safeRects || [], SAFE],
    [level.walls || [], WALL],
  ])
    for (const rectangle of rectangles)
      for (let y = rectangle.y; y < rectangle.y + rectangle.h; y++)
        for (let x = rectangle.x; x < rectangle.x + rectangle.w; x++)
          cells[y * level.width + x] = kind;
  return cells;
}

/** Validate before adopting content; the engine owns its copy and never changes the caller's level. */
export function validateCoopLevel(level) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  if (
    !keys(level, [
      'version',
      'id',
      'revision',
      'name',
      'width',
      'height',
      'spawns',
      'walls',
      'safeRects',
      'enemies',
      'goal',
      'rules',
    ])
  )
    return {
      valid: false,
      errors: ['Co-op level must be a plain data object with supported fields.'],
    };
  check(level.version === COOP_LEVEL_VERSION, 'Unsupported co-op level version.');
  check(level.width === 72 && level.height === 36, 'Co-op boards must be 72 × 36.');
  check(
    identifier(level.id) && identifier(level.name),
    'Level id and name must be nonempty strings.',
  );
  check(
    identifier(level.revision) || (Number.isInteger(level.revision) && level.revision > 0),
    'Level revision is required.',
  );
  check(
    keys(level.goal, ['coverage']) && finite(level.goal.coverage, 0.0001, 1),
    'Goal coverage must be greater than zero and at most one.',
  );
  const rects = (value) =>
    dataArray(value) &&
    value.length <= 128 &&
    value.every(
      (r) =>
        keys(r, ['x', 'y', 'w', 'h']) &&
        ['x', 'y', 'w', 'h'].every((k) => Number.isInteger(r[k])) &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.w > 0 &&
        r.h > 0 &&
        r.x + r.w <= 72 &&
        r.y + r.h <= 36,
    );
  check(
    level.walls === undefined || rects(level.walls),
    'Walls must be bounded integer rectangles.',
  );
  check(
    level.safeRects === undefined || rects(level.safeRects),
    'Safe areas must be bounded integer rectangles.',
  );
  check(
    dataArray(level.spawns) &&
      level.spawns.length === 2 &&
      level.spawns.every(
        (spawn) =>
          keys(spawn, ['x', 'y']) && finite(spawn.x, 0.5, 71.5) && finite(spawn.y, 0.5, 35.5),
      ),
    'Two in-board spawn points are required.',
  );
  const ids = new Set();
  check(
    dataArray(level.enemies) &&
      level.enemies.length <= 16 &&
      level.enemies.every((enemy) => {
        if (
          !keys(enemy, ['id', 'type', 'x', 'y', 'vx', 'vy', 'radius']) ||
          !identifier(enemy.id) ||
          ids.has(enemy.id)
        )
          return false;
        ids.add(enemy.id);
        return (
          enemy.type === 'drifter' &&
          finite(enemy.x, 1, 71) &&
          finite(enemy.y, 1, 35) &&
          finite(enemy.vx, -20, 20) &&
          finite(enemy.vy, -20, 20) &&
          Math.hypot(enemy.vx, enemy.vy) <= 20 &&
          finite(enemy.radius, 0.01, 0.49)
        );
      }),
    'Enemies must be unique bounded drifters.',
  );
  check(
    level.rules === undefined ||
      (keys(level.rules, ['moveSpeed', 'boostMultiplier']) &&
        (level.rules.moveSpeed === undefined || finite(level.rules.moveSpeed, 1, 20)) &&
        (level.rules.boostMultiplier === undefined || finite(level.rules.boostMultiplier, 1, 3))),
    'Unsupported movement rules.',
  );
  if (errors.length) return { valid: false, errors };
  const board = { width: 72, height: 36, cells: buildGrid(level) };
  check(
    board.cells.some((cell) => cell === FIELD),
    'The board needs claimable field.',
  );
  for (const spawn of level.spawns)
    check(
      board.cells[cellAt(board, spawn.x, spawn.y)] === SAFE,
      'Spawn points must be on safe ground.',
    );
  for (const enemy of level.enemies)
    check(circleFitsField(board, enemy), `Drifter ${enemy.id} must fit entirely inside field.`);
  // Recovery routes must not be disconnected by authored walls or isolated initial islands.
  const firstSafe = board.cells.findIndex((cell) => cell === SAFE);
  const seen = new Set(firstSafe < 0 ? [] : [firstSafe]);
  const queue = [...seen];
  for (let head = 0; head < queue.length; head++)
    for (const next of neighbors(board, queue[head]))
      if (board.cells[next] === SAFE && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  check(
    seen.size === board.cells.filter((cell) => cell === SAFE).length,
    'Initial safe ground must be connected.',
  );
  return { valid: !errors.length, errors };
}

function neighbors(run, index) {
  const x = index % run.width;
  const y = Math.floor(index / run.width);
  return [
    y > 0 ? index - run.width : -1,
    x + 1 < run.width ? index + 1 : -1,
    y + 1 < run.height ? index + run.width : -1,
    x > 0 ? index - 1 : -1,
  ].filter((i) => i >= 0);
}

export function createCoop(
  level,
  { seed = 17, difficulty = 'standard', jointCuts = true, assistCaptures = true } = {},
) {
  const validation = validateCoopLevel(level);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Object.hasOwn(DIFFICULTIES, difficulty) ||
    typeof jointCuts !== 'boolean' ||
    typeof assistCaptures !== 'boolean'
  )
    throw new TypeError('Invalid co-op options.');
  const owned = structuredClone(level);
  const cells = buildGrid(owned);
  const run = {
    ruleset: COOP_RULESET,
    level: owned,
    width: owned.width,
    height: owned.height,
    cells,
    seed,
    difficulty,
    config: { jointCuts, assistCaptures },
    rules: { moveSpeed: 8, boostMultiplier: 1.5, ...owned.rules },
    players: owned.spawns.map((spawn, id) => ({
      id,
      x: spawn.x,
      y: spawn.y,
      cellIndex: cellAt(owned, spawn.x, spawn.y),
      radius: PLAYER_RADIUS,
      direction: null,
      status: 'active',
      cutting: false,
      trail: [],
      safeAnchor: { ...spawn },
      downedUntil: null,
      blockedDirection: null,
      departureIndex: null,
    })),
    enemies: owned.enemies.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    tick: 0,
    time: 0,
    status: 'ready',
    totalClaimable: cells.filter((cell) => cell === FIELD).length,
    claimedCount: 0,
    coverage: 0,
    team: { reserves: DIFFICULTIES[difficulty], recoveryAt: null },
    events: [],
    headsTouching: false,
    needsNeutral: [false, false],
  };
  run.headsTouching = headsTouch(run);
  return run;
}

export function releaseCoopInputs(run) {
  for (const player of run.players) {
    player.direction = null;
    player.blockedDirection = null;
  }
  run.needsNeutral = [true, true];
  return run;
}
export function startCoop(run) {
  if (run.status === 'ready') run.status = 'running';
  return run;
}
export function pauseCoop(run) {
  if (run.status === 'running') {
    run.status = 'paused';
    releaseCoopInputs(run);
  }
  return run;
}
export function resumeCoop(run) {
  if (run.status === 'paused') {
    run.status = 'running';
    releaseCoopInputs(run);
  }
  return run;
}

function validateCommands(commands) {
  if (
    !dataArray(commands) ||
    commands.length !== 2 ||
    !commands.every(
      (command) =>
        keys(command, ['direction', 'boost', 'support']) &&
        Object.keys(command).length === 3 &&
        (command.direction === null || Object.hasOwn(DIRECTIONS, command.direction)) &&
        typeof command.boost === 'boolean' &&
        typeof command.support === 'boolean',
    )
  )
    throw new TypeError('Exactly two co-op direction/boost/support commands are required.');
}

function emit(run, type, data = {}) {
  run.events.push({ type, tick: run.tick, time: run.time, ...data });
}
const headsTouch = (run) =>
  Math.hypot(run.players[0].x - run.players[1].x, run.players[0].y - run.players[1].y) <=
  PLAYER_RADIUS * 2 + EPS;
const cellDescription = (run, index) => ({
  x: index % run.width,
  y: Math.floor(index / run.width),
  index,
});

function movement(run, commands, stopped) {
  return run.players.map((player, index) => {
    const command = commands[index];
    let direction = command.direction;
    if (run.needsNeutral[index]) {
      if (direction === null && !command.boost && !command.support) run.needsNeutral[index] = false;
      direction = null;
    }
    if (player.blockedDirection !== null) {
      if (direction !== player.blockedDirection) player.blockedDirection = null;
      else direction = null;
    }
    if (player.status !== 'active' || stopped.has(player.id)) direction = null;
    player.direction = direction;
    const axis = DIRECTIONS[direction] || { x: 0, y: 0 };
    const speed = run.rules.moveSpeed * (command.boost ? run.rules.boostMultiplier : 1);
    return { x: axis.x * speed, y: axis.y * speed };
  });
}

function knockDown(run, player, cause, commands, enemy = null) {
  if (player.status !== 'active') return;
  player.status = 'downed';
  player.downedUntil = run.time + RECOVERY_SECONDS;
  player.cutting = false;
  player.trail = [];
  player.departureIndex = null;
  player.x = player.safeAnchor.x;
  player.y = player.safeAnchor.y;
  player.cellIndex = cellAt(run, player.x, player.y);
  player.direction = null;
  player.blockedDirection = commands[player.id].direction;
  emit(run, 'player.downed', { player: player.id, cause, ...(enemy === null ? {} : { enemy }) });
}

function revive(run, player, commands) {
  player.status = 'active';
  player.downedUntil = null;
  player.direction = null;
  player.blockedDirection = commands[player.id].direction;
  emit(run, 'player.revived', { player: player.id });
}

function finish(run, status) {
  if (['won', 'lost'].includes(run.status)) return;
  run.status = status;
  emit(run, 'run.completed', { status, coverage: run.coverage });
  releaseCoopInputs(run);
}

function recover(run, commands) {
  const downed = run.players.filter((player) => player.status === 'downed');
  if (run.team.recoveryAt !== null) {
    if (run.time + EPS >= run.team.recoveryAt) {
      run.team.recoveryAt = null;
      for (const player of downed) revive(run, player, commands);
    }
    return;
  }
  if (downed.length === 2) {
    if (!run.team.reserves) {
      finish(run, 'lost');
      return;
    }
    run.team.reserves--;
    run.team.recoveryAt = run.time + RECOVERY_SECONDS;
    for (const player of downed) player.downedUntil = run.team.recoveryAt;
    emit(run, 'team.recovery', { reserves: run.team.reserves });
    return;
  }
  for (const player of downed)
    if (run.time + EPS >= player.downedUntil && run.team.reserves > 0) {
      run.team.reserves--;
      revive(run, player, commands);
    }
}

/** Enemy centers alone retain field. Friendly trails never suppress another player's fill. */
function flood(run, secured) {
  const retained = new Uint8Array(run.cells.length);
  const queue = [];
  for (const enemy of run.enemies) {
    const index = cellAt(run, enemy.x, enemy.y);
    if (run.cells[index] === FIELD && !retained[index]) {
      retained[index] = 1;
      queue.push(index);
    }
  }
  for (let head = 0; head < queue.length; head++)
    for (const index of neighbors(run, queue[head]))
      if (run.cells[index] === FIELD && !retained[index]) {
        retained[index] = 1;
        queue.push(index);
      }
  for (let index = 0; index < run.cells.length; index++)
    if (run.cells[index] === FIELD && !retained[index]) {
      run.cells[index] = SAFE;
      secured.add(index);
    }
}

/** One monotonic transaction banks every eligible prefix before its next fill. */
function capture(run, closers, commands, stopped, joint = false) {
  const secured = new Set();
  const completed = new Map();
  const secure = (trail) => {
    for (const cell of trail)
      if (run.cells[cell.index] === FIELD) {
        run.cells[cell.index] = SAFE;
        secured.add(cell.index);
      }
  };
  const complete = (player, reason) => {
    secure(player.trail);
    player.trail = [];
    player.cutting = false;
    player.departureIndex = null;
    player.direction = null;
    player.blockedDirection = commands[player.id].direction;
    player.safeAnchor = {
      x: (player.cellIndex % run.width) + 0.5,
      y: Math.floor(player.cellIndex / run.width) + 0.5,
    };
    stopped.add(player.id);
    completed.set(player.id, reason);
  };
  for (const player of closers) complete(player, joint ? 'joint' : 'return');
  flood(run, secured);
  for (let iteration = 0; iteration <= run.cells.length; iteration++) {
    let changed = false;
    const prefixes = [];
    const assistedClosers = [];
    for (const player of run.players) {
      if (player.status !== 'active' || !player.cutting) continue;
      if (run.cells[player.cellIndex] === SAFE) {
        assistedClosers.push(player);
        changed = true;
        continue;
      }
      let lastSafe = -1;
      for (let i = 0; i < player.trail.length; i++)
        if (run.cells[player.trail[i].index] === SAFE) lastSafe = i;
      if (lastSafe < 0) continue;
      const anchor = player.trail[lastSafe];
      if (run.config.assistCaptures) prefixes.push(player.trail.slice(0, lastSafe + 1));
      player.trail = player.trail.slice(lastSafe + 1);
      player.safeAnchor = { x: anchor.x + 0.5, y: anchor.y + 0.5 };
      player.departureIndex = anchor.index;
      changed = true;
      emit(run, 'trail.anchored', { player: player.id, index: anchor.index });
    }
    for (const prefix of prefixes) secure(prefix);
    for (const player of assistedClosers) complete(player, 'assist');
    if (!changed) break;
    flood(run, secured);
    if (iteration === run.cells.length) throw new Error('Co-op capture failed to converge.');
  }
  run.claimedCount += secured.size;
  run.coverage = run.claimedCount / run.totalClaimable;
  emit(run, 'cells.claimed', {
    indices: [...secured].sort((a, b) => a - b),
    cells: secured.size,
    coverage: run.coverage,
  });
  for (const [player, reason] of [...completed].sort((a, b) => a[0] - b[0]))
    emit(run, 'cut.closed', { player, reason, cells: secured.size });
  if (joint)
    emit(run, 'cut.joint', {
      players: closers.map((player) => player.id).sort(),
      cells: secured.size,
    });
}

function hazards(run, velocities, horizon) {
  const contacts = [];
  for (const player of run.players) {
    if (player.status !== 'active' || !player.cutting) continue;
    for (const enemy of run.enemies) {
      const time = trailContact(run, enemy, player.trail, horizon);
      if (time !== null)
        contacts.push({ time, player: player.id, enemy: enemy.id, cause: 'enemy-trail' });
      const fraction = movingCirclesTime(
        player,
        positionAt(player, velocities[player.id], horizon),
        enemy,
        positionAt(enemy, { x: enemy.vx, y: enemy.vy }, horizon),
        PLAYER_RADIUS + enemy.radius,
      );
      if (fraction !== null)
        contacts.push({
          time: fraction * horizon,
          player: player.id,
          enemy: enemy.id,
          cause: 'enemy-player',
        });
    }
  }
  return contacts.sort(
    (a, b) =>
      a.time - b.time ||
      a.player - b.player ||
      (a.enemy < b.enemy ? -1 : a.enemy > b.enemy ? 1 : 0) ||
      (a.cause < b.cause ? -1 : 1),
  );
}

/** A shared event clock resolves swept hazards before closures, including exact-time ties. */
export function stepCoop(run, commands, dt = FIXED_DT) {
  if (dt !== FIXED_DT) throw new TypeError('Co-op advances exactly one 120 Hz tick per step.');
  validateCommands(commands);
  if (run.status !== 'running') return run;
  run.events = [];
  const tickStart = run.tick * FIXED_DT;
  const tickEnd = (run.tick + 1) * FIXED_DT;
  run.time = tickStart;
  const stopped = new Set();
  let iterations = 0;
  while (run.time < tickEnd - EPS && run.status === 'running') {
    if (++iterations > 128) throw new Error('Co-op movement failed to advance.');
    const horizon = tickEnd - run.time;
    const velocities = movement(run, commands, stopped);
    const transitions = run.players.map((player, index) =>
      player.status === 'active' ? nextCell(run, player, velocities[index], horizon) : null,
    );
    const obstacles = run.players.map((player, index) =>
      player.status === 'active'
        ? playerWallContact(run, player, velocities[index], horizon)
        : null,
    );
    const walls = run.enemies.map((enemy) => enemyWallContact(run, enemy, horizon));
    const contacts = hazards(run, velocities, horizon);
    if (!headsTouch(run)) run.headsTouching = false;
    const meeting = run.headsTouching
      ? null
      : movingCirclesTime(
          run.players[0],
          positionAt(run.players[0], velocities[0], horizon),
          run.players[1],
          positionAt(run.players[1], velocities[1], horizon),
          PLAYER_RADIUS * 2,
        );
    const meetingTime = meeting === null ? null : meeting * horizon;
    const deadlines =
      run.team.recoveryAt === null
        ? run.players
            .filter((player) => player.status === 'downed' && run.team.reserves > 0)
            .map((player) => player.downedUntil)
        : [run.team.recoveryAt];
    let elapsed = horizon;
    for (const event of [...transitions, ...obstacles, ...walls, ...contacts])
      if (event) elapsed = Math.min(elapsed, event.time);
    if (meetingTime !== null) elapsed = Math.min(elapsed, meetingTime);
    for (const deadline of deadlines) elapsed = Math.min(elapsed, Math.max(0, deadline - run.time));
    const due = (time) => time !== null && time <= elapsed + EPS;
    for (const player of run.players) {
      const next = positionAt(player, velocities[player.id], elapsed);
      player.x = next.x;
      player.y = next.y;
    }
    for (const enemy of run.enemies) {
      enemy.x += enemy.vx * elapsed;
      enemy.y += enemy.vy * elapsed;
    }
    run.time += elapsed;
    for (const player of run.players)
      if (obstacles[player.id] && due(obstacles[player.id].time)) {
        stopped.add(player.id);
        player.direction = null;
      }
    const closers = [];
    const selfHits = [];
    for (const player of run.players) {
      const transition = transitions[player.id];
      if (!transition || !due(transition.time)) continue;
      const index = transition.index;
      if (index < 0 || run.cells[index] === WALL) {
        stopped.add(player.id);
        player.direction = null;
        continue;
      }
      const previous = player.cellIndex;
      player.cellIndex = index;
      if (run.cells[index] === SAFE) {
        if (player.cutting) closers.push(player);
        else
          player.safeAnchor = {
            x: (index % run.width) + 0.5,
            y: Math.floor(index / run.width) + 0.5,
          };
      } else {
        if (!player.cutting) {
          player.cutting = true;
          player.departureIndex = previous;
          emit(run, 'cut.started', { player: player.id });
        }
        if (player.trail.some((cell) => cell.index === index)) selfHits.push(player);
        else player.trail.push(cellDescription(run, index));
      }
    }
    // Freshly entered trail cells participate in this same instant before either player can bank.
    const instantContacts = hazards(run, velocities, 0);
    const hits = [...contacts.filter((contact) => due(contact.time)), ...instantContacts];
    for (const player of selfHits) knockDown(run, player, 'self-trail', commands);
    for (const contact of hits)
      knockDown(run, run.players[contact.player], contact.cause, commands, contact.enemy);
    for (let i = 0; i < walls.length; i++)
      if (walls[i] && due(walls[i].time)) reflectEnemy(run.enemies[i], walls[i].normals);
    const newMeeting = meetingTime !== null && due(meetingTime);
    if (newMeeting) run.headsTouching = true;
    const joint =
      newMeeting &&
      run.config.jointCuts &&
      run.players.every((player) => player.status === 'active' && player.cutting);
    const surviving = joint ? run.players : closers.filter((player) => player.status === 'active');
    if (surviving.length) capture(run, surviving, commands, stopped, joint);
    recover(run, commands);
    if (run.status === 'running' && run.coverage + EPS >= run.level.goal.coverage)
      finish(run, 'won');
  }
  run.tick++;
  run.time = run.tick * FIXED_DT;
  run.headsTouching = headsTouch(run);
  return run;
}

export function getCoopSummary(run) {
  return {
    ruleset: run.ruleset,
    levelId: run.level.id,
    status: run.status,
    tick: run.tick,
    time: run.time,
    seed: run.seed,
    difficulty: run.difficulty,
    config: { ...run.config },
    coverage: run.coverage,
    goal: run.level.goal.coverage,
    claimedCount: run.claimedCount,
    totalClaimable: run.totalClaimable,
    reserves: run.team.reserves,
    players: run.players.map((player) => ({
      id: player.id,
      status: player.status,
      cutting: player.cutting,
      trailCells: player.trail.length,
      x: player.x,
      y: player.y,
      downedUntil: player.downedUntil,
    })),
  };
}
