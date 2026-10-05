import {
  createOverflightGrid,
  overflightGridCell,
  rebuildOverflightGrid,
  visitOverflightGrid,
} from './grid.mjs';
import {
  applyOverflightUpgrade,
  createOverflightBuild,
  draftOverflightUpgrades,
  overflightModuleRank,
  overflightPayload,
} from './upgrades.mjs';

export const OVERFLIGHT_STEP = 1 / 60;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const heavyFamilies = new Set(['cargo-truck', 'armored-carrier', 'tracked-tank']);
const specialistFamilies = new Set(['radar-truck', 'relay-warden', 'brace-trooper']);
const supportFamilies = new Set(['radar-truck', 'relay-warden']);
const machineFamilies = new Set([
  'utility-car',
  'cargo-truck',
  'armored-carrier',
  'scout-car',
  'tracked-tank',
  'radar-truck',
]);
const fastFamilies = new Set(['runner', 'sprinter', 'courier', 'scout-car']);
const weaponIds = ['primary', 'slow-field', 'proximity-pulse', 'side-burst', 'scanner'];
const wrap = (value, min, max) =>
  min + ((((value - min) % (max - min)) + (max - min)) % (max - min));

function random(run, key = '_randomState') {
  let value = run[key];
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  run[key] = value >>> 0;
  return run[key] / 0x100000000;
}

function sound(run, type, value = 1) {
  const existing = run.events.find((event) => event.type === type);
  if (existing) {
    existing.count++;
    existing.value += value;
  } else run.events.push({ type, count: 1, value });
}

function camera(run) {
  const arena = run.compiled.arena;
  run.camera.x = clamp(run.player.x, run.camera.width / 2, arena.width - run.camera.width / 2);
  run.camera.y = clamp(run.player.y, run.camera.height / 2, arena.height - run.camera.height / 2);
}

function visible(run, record, margin = 0) {
  return (
    Math.abs(record.x - run.camera.x) <= run.camera.width / 2 + margin &&
    Math.abs(record.y - run.camera.y) <= run.camera.height / 2 + margin
  );
}

function effect(run, kind, x, y, radius, life = 0.28, extra = null) {
  if (!run._effectFree.length) {
    run.stats.droppedVisualEffects++;
    return null;
  }
  const index = run._effectFree.pop();
  const record = run.effects[index];
  Object.assign(record, { active: true, kind, x, y, radius, age: 0, life, x2: x, y2: y });
  if (extra) Object.assign(record, extra);
  return record;
}

function makePool(size, factory) {
  return Array.from({ length: size }, (_, index) => factory(index));
}

export function createOverflightRun(
  compiled,
  { seed = compiled?.seed, airframes = 1, slowResume = true, fixture = null } = {},
) {
  if (compiled?.format !== 'OverflightCompiledV1')
    throw new TypeError('A compiled Overflight project is required.');
  if (![1, 3].includes(airframes)) throw new RangeError('Choose one or three airframes.');
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff)
    throw new RangeError('Seed must be a nonzero uint32.');
  if (![null, 'reference', 'stress'].includes(fixture))
    throw new RangeError('Unknown benchmark fixture.');
  const enemyCapacity = fixture === 'stress' ? 2500 : compiled.population.capacity;
  const pickupCapacity = compiled.resources?.pools?.pickups ?? 2048;
  const effectCapacity = compiled.resources?.pools?.effects ?? 512;
  const projectileCapacity = compiled.resources?.pools?.projectiles ?? 512;
  const run = {
    compiled,
    seed,
    phase: 'ready',
    time: 0,
    tick: 0,
    fixture,
    slowResume: !!slowResume,
    airframes,
    airframesRemaining: airframes,
    player: {
      x: compiled.arena.width / 2,
      y: compiled.arena.height / 2,
      heading: -Math.PI / 2,
      vx: 0,
      vy: 0,
      radius: 9,
      hull: 100,
      maxHull: 100,
      boostRemaining: 0,
      boostCooldown: 0,
      invulnerable: 0,
      shield: 0,
      shieldCooldown: 0,
    },
    camera: {
      x: compiled.arena.width / 2,
      y: compiled.arena.height / 2,
      width: compiled.arena.cameraWidth,
      height: compiled.arena.cameraHeight,
    },
    enemies: makePool(enemyCapacity, (index) => ({
      id: 0,
      _slot: index,
      active: false,
      x: 0,
      y: 0,
      heading: 0,
      family: 'patroller',
      wardrobe: 0,
      hp: 0,
      maxHp: 0,
      radius: 9,
      warning: 0,
      heavy: false,
      specialist: false,
      role: 'common',
      speed: 0,
      pattern: 'pursuit',
      vx: 0,
      vy: 0,
      slowUntil: 0,
      attackWarning: 0,
      attackX: 0,
      attackY: 0,
      attackRadius: 0,
      attackCooldown: 0,
      xp: 1,
    })),
    pickups: makePool(pickupCapacity, (index) => ({
      id: index + 1,
      active: false,
      x: 0,
      y: 0,
      value: 0,
      age: 0,
    })),
    effects: makePool(effectCapacity, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      age: 0,
      life: 0,
      kind: 'pulse',
      x2: 0,
      y2: 0,
    })),
    projectiles: makePool(projectileCapacity, (index) => ({
      id: index,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      remaining: 0,
      damage: 0,
      piercing: false,
      hits: new Set(),
    })),
    fields: makePool(4, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      remaining: 0,
      clock: 0,
      damage: 0,
    })),
    priorityAttacks: makePool(compiled.population.priorityAttacks, () => ({
      active: false,
      owner: 0,
      x: 0,
      y: 0,
      radius: 0,
      remaining: 0,
      damage: 0,
    })),
    offers: [],
    events: [],
    build: createOverflightBuild(),
    progression: {
      xp: 0,
      choices: 0,
      maxChoices: compiled.upgrades.choices,
      nextThreshold: compiled.upgrades.thresholds[0],
      rerolls: compiled.upgrades.rerolls,
      history: [],
    },
    goals: {
      eliteSpawned: false,
      eliteDefeated: false,
      finalSpawned: false,
      finalDefeated: false,
      finalId: null,
    },
    stats: {
      kills: 0,
      spawned: 0,
      enemiesAlive: 0,
      enemiesVisible: 0,
      peakAlive: 0,
      peakVisible: 0,
      heaviesAlive: 0,
      specialistsAlive: 0,
      priorityAttacks: 0,
      damageDealt: 0,
      damageTaken: 0,
      xpEarned: 0,
      xpCollected: 0,
      xpOnGround: 0,
      pickupsAlive: 0,
      pickupMerges: 0,
      boostsUsed: 0,
      airframesLost: 0,
      upgradesChosen: 0,
      rerollsUsed: 0,
      droppedVisualEffects: 0,
      collisionCandidates: 0,
      hits: 0,
      retired: 0,
      spawnDeferred: 0,
      fixtureDefeats: 0,
      projectileDeferrals: 0,
    },
    resultReason: null,
    _randomState: seed >>> 0,
    _draftRandomState: (seed ^ 0x9e3779b9) >>> 0 || 1,
    _permittedFamilies: new Set([...compiled.resources.soldiers, ...compiled.resources.machinery]),
    _nextId: 1,
    _enemyFree: Array.from({ length: enemyCapacity }, (_, index) => enemyCapacity - 1 - index),
    _pickupFree: Array.from({ length: pickupCapacity }, (_, index) => pickupCapacity - 1 - index),
    _effectFree: Array.from({ length: effectCapacity }, (_, index) => effectCapacity - 1 - index),
    _projectileFree: Array.from(
      { length: projectileCapacity },
      (_, index) => projectileCapacity - 1 - index,
    ),
    _maxEnemyRadius: 28,
    // The authored specialist limit bounds each steering decision to eight sources.
    _supportSources: new Array(8).fill(null),
    _grid: createOverflightGrid(compiled.arena.width, compiled.arena.height, enemyCapacity),
    _spawnCredit: 0,
    _encounterIndex: 0,
    _boostHeld: false,
    _cooldowns: {
      primary: 0.2,
      'slow-field': 0,
      'proximity-pulse': 0,
      'side-burst': 0,
      scanner: 0,
    },
    _echoes: makePool(8, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      damage: 0,
      remaining: 0,
      count: 1,
      spacing: 0,
      heading: 0,
      kind: 'drop',
    })),
    _pulses: makePool(4, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      damage: 0,
      remaining: 0,
      push: 0,
      kind: 'proximity-pulse',
    })),
    _side: 1,
    _resumePhase: 'playing',
  };
  if (fixture) initializeFixture(run);
  camera(run);
  rebuildOverflightGrid(run._grid, run.enemies);
  updatePopulationStats(run);
  return run;
}

export function startOverflight(run) {
  if (run.phase !== 'ready') return false;
  run.events.length = 0;
  run.phase = 'playing';
  sound(run, 'start');
  return true;
}

export function pauseOverflight(run) {
  if (!['playing', 'upgrade'].includes(run.phase)) return false;
  run._resumePhase = run.phase;
  run.phase = 'paused';
  run.events.length = 0;
  return true;
}

export function resumeOverflight(run) {
  if (run.phase !== 'paused') return false;
  run.phase = run._resumePhase;
  run.events.length = 0;
  // Timing and optional global slow resume belong to the fixed-step host.
  return true;
}

function updatePopulationStats(run) {
  if (run.fixture) run._fixtureBuckets.fill(0);
  let count = 0,
    shown = 0,
    heavy = 0,
    specialist = 0;
  for (const enemy of run.enemies) {
    if (!enemy.active) continue;
    count++;
    if (visible(run, enemy)) {
      shown++;
      if (run.fixture) {
        const column = clamp(
          Math.floor(((enemy.x - run.camera.x + run.camera.width / 2) / run.camera.width) * 10),
          0,
          9,
        );
        const row = clamp(
          Math.floor(((enemy.y - run.camera.y + run.camera.height / 2) / run.camera.height) * 6),
          0,
          5,
        );
        run._fixtureBuckets[row * 10 + column]++;
      }
    }
    if (enemy.heavy) heavy++;
    if (enemy.specialist) specialist++;
  }
  let attacks = 0;
  for (const attack of run.priorityAttacks) if (attack.active) attacks++;
  Object.assign(run.stats, {
    enemiesAlive: count,
    enemiesVisible: shown,
    heaviesAlive: heavy,
    specialistsAlive: specialist,
    priorityAttacks: attacks,
  });
  run.stats.peakAlive = Math.max(run.stats.peakAlive, count);
  run.stats.peakVisible = Math.max(run.stats.peakVisible, shown);
  if (run.fixture) {
    let occupied = 0,
      maximum = 0;
    for (const count of run._fixtureBuckets) {
      if (count) occupied++;
      maximum = Math.max(maximum, count);
    }
    run.fixtureWorkload.occupiedScreenBuckets = occupied;
    run.fixtureWorkload.maximumScreenBucketPopulation = maximum;
  }
}

/** Explicit spawn entry point also supports reproducible collision fixtures. */
export function spawnOverflightEnemy(run, options = {}) {
  if (!run._enemyFree.length) {
    run.stats.spawnDeferred++;
    return null;
  }
  const family = options.family ?? 'patroller';
  if (!run._permittedFamilies.has(family))
    throw new TypeError(`Unsupported enemy family: ${family}`);
  const heavy = options.heavy ?? heavyFamilies.has(family);
  const specialist = options.specialist ?? specialistFamilies.has(family);
  if (
    (heavy && run.stats.heaviesAlive >= run.compiled.population.heavies) ||
    (specialist && run.stats.specialistsAlive >= run.compiled.population.specialists)
  ) {
    run.stats.spawnDeferred++;
    return null;
  }
  const slot = run._enemyFree.pop();
  const enemy = run.enemies[slot];
  const hp = options.hp ?? 30;
  const x = clamp(options.x ?? run.player.x + 300, 0, run.compiled.arena.width);
  const y = clamp(options.y ?? run.player.y, 0, run.compiled.arena.height);
  const heading = Math.atan2(run.player.y - y, run.player.x - x);
  Object.assign(enemy, {
    id: run._nextId++,
    active: true,
    x,
    y,
    heading,
    family,
    wardrobe: options.wardrobe ?? Math.floor(random(run) * 3),
    hp,
    maxHp: hp,
    radius: options.radius ?? (heavy ? 21 : machineFamilies.has(family) ? 15 : 8),
    warning: options.warning ?? 0.65,
    heavy,
    specialist,
    role: options.role ?? 'common',
    speed: options.speed ?? 40,
    pattern: options.pattern ?? 'pursuit',
    vx: Math.cos(heading),
    vy: Math.sin(heading),
    steeringX: Math.cos(heading),
    steeringY: Math.sin(heading),
    pushX: 0,
    pushY: 0,
    slowUntil: 0,
    markUntil: 0,
    attackWarning: 0,
    attackX: x,
    attackY: y,
    attackRadius: 0,
    attackCooldown: 3 + random(run) * 4,
    xp:
      options.xp ??
      (heavy ? 8 : specialist ? 4 : family === 'courier' ? 3 : family === 'refuge-seeker' ? 2 : 1),
    rewardTarget: family === 'courier' || family === 'refuge-seeker',
    behaviorPhase: 'pursuit',
    supportRadius: family === 'radar-truck' ? 140 : family === 'relay-warden' ? 160 : 0,
    rallyX: x,
    rallyY: y,
    _behaviorAge:
      family === 'sprinter' ? 90 + ((run._nextId * 37) % 150) : 180 + ((run._nextId * 37) % 300),
    _burstX: Math.cos(heading),
    _burstY: Math.sin(heading),
    _radarSlot: -1,
    _radarId: 0,
    _rallySlot: -1,
    _rallyId: 0,
    _rallySteeringX: 0,
    _rallySteeringY: 0,
  });
  if (supportFamilies.has(family)) {
    const index = run._supportSources.indexOf(null);
    if (index >= 0) run._supportSources[index] = enemy;
  }
  run._maxEnemyRadius = Math.max(run._maxEnemyRadius, enemy.radius);
  run.stats.spawned++;
  run.stats.enemiesAlive++;
  if (heavy) run.stats.heaviesAlive++;
  if (specialist) run.stats.specialistsAlive++;
  return enemy;
}

function retireEnemy(run, enemy) {
  if (!enemy.active) return false;
  enemy.active = false;
  run._enemyFree.push(enemy._slot);
  run.stats.enemiesAlive--;
  if (enemy.heavy) run.stats.heaviesAlive--;
  if (enemy.specialist) run.stats.specialistsAlive--;
  const sourceIndex = run._supportSources.indexOf(enemy);
  if (sourceIndex >= 0) run._supportSources[sourceIndex] = null;
  for (const attack of run.priorityAttacks) {
    if (attack.active && attack.owner === enemy.id) attack.active = false;
  }
  enemy.attackWarning = 0;
  return true;
}

/** The pool merges value rather than silently dropping XP when full. */
export function dropOverflightSalvage(run, x, y, value) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new RangeError('Salvage must be a positive safe integer.');
  run.stats.xpEarned += value;
  run.stats.xpOnGround += value;
  if (run._pickupFree.length) {
    const pickup = run.pickups[run._pickupFree.pop()];
    Object.assign(pickup, { active: true, x, y, value, age: 0 });
    run.stats.pickupsAlive++;
    return pickup;
  }
  let nearest = null,
    best = Infinity;
  for (const pickup of run.pickups) {
    if (!pickup.active) continue;
    const distance = (pickup.x - x) ** 2 + (pickup.y - y) ** 2;
    if (distance < best) {
      nearest = pickup;
      best = distance;
    }
  }
  if (!nearest) throw new Error('Salvage pool bookkeeping is inconsistent.');
  nearest.value += value;
  run.stats.pickupMerges++;
  return nearest;
}

function defeatEnemy(run, enemy) {
  if (!enemy.active) return false;
  if (run.fixture) {
    // Reposition only during the next movement phase, after all queries using
    // this tick's grid. Ordinary gameplay never restores or recycles enemies.
    enemy.hp = enemy.maxHp;
    enemy._fixtureRecycle = true;
    run.stats.fixtureDefeats++;
    effect(run, 'impact', enemy.x, enemy.y, enemy.radius + 6, 0.18);
    return true;
  }
  if (!retireEnemy(run, enemy)) return false;
  run.stats.kills++;
  if (enemy.role === 'elite') {
    run.goals.eliteDefeated = true;
    sound(run, 'elite');
  }
  if (enemy.role === 'final') {
    run.goals.finalDefeated = true;
    sound(run, 'final');
  }
  dropOverflightSalvage(run, enemy.x, enemy.y, enemy.xp);
  effect(run, 'impact', enemy.x, enemy.y, enemy.radius + 6, 0.18);
  sound(run, 'defeat');
  if (enemy.role === 'final') {
    run.phase = 'won';
    run.resultReason = 'sortie-complete';
    for (const attack of run.priorityAttacks) attack.active = false;
    for (const other of run.enemies) other.attackWarning = 0;
    sound(run, 'won');
  }
  return true;
}

/** Exact area damage: grid pruning only, no per-cell or per-attack target cap. */
export function damageOverflightArea(run, x, y, radius, damage, { push = 0, slow = 0 } = {}) {
  if (![x, y, radius, damage].every(Number.isFinite) || radius < 0 || damage < 0)
    throw new RangeError('Invalid area attack.');
  let hit = 0;
  const candidates = visitOverflightGrid(run._grid, x, y, radius + run._maxEnemyRadius, (enemy) => {
    if (enemy.warning > 0 || run.phase === 'won' || run.phase === 'lost') return;
    const dx = enemy.x - x,
      dy = enemy.y - y;
    if (dx * dx + dy * dy > (radius + enemy.radius) ** 2) return;
    hit++;
    if (slow) enemy.slowUntil = Math.max(enemy.slowUntil, run.tick + Math.ceil(slow * 60));
    // Store impulse for next movement update so later attacks query the same grid.
    if (push) {
      const length = Math.hypot(dx, dy) || 1;
      enemy.pushX = (enemy.pushX ?? 0) + (dx / length) * push;
      enemy.pushY = (enemy.pushY ?? 0) + (dy / length) * push;
    }
    damageEnemy(run, enemy, damage);
  });
  run.stats.collisionCandidates += candidates;
  return hit;
}

function damageEnemy(run, enemy, damage) {
  if (
    !enemy.active ||
    enemy.warning > 0 ||
    run.phase === 'won' ||
    run.phase === 'lost' ||
    (run.fixture && enemy._fixtureRecycle)
  )
    return false;
  const actual = Math.min(enemy.hp, damage * (enemy.markUntil > run.tick ? 1.3 : 1));
  enemy.hp -= actual;
  run.stats.damageDealt += actual;
  run.stats.hits++;
  if (enemy.hp <= 0) defeatEnemy(run, enemy);
  return true;
}

function safeHandoff(run) {
  const player = run.player;
  let bestX = player.x,
    bestY = player.y,
    bestScore = Infinity;
  for (let index = 0; index < 21; index++) {
    if (index === 9 && bestScore === 0) break;
    const angle = ((index - 1) / 8) * TAU;
    const x =
      index < 9
        ? clamp(player.x + (index ? Math.cos(angle) * 120 : 0), 20, run.compiled.arena.width - 20)
        : run.compiled.arena.width * ((((index - 9) % 4) + 0.5) / 4);
    const y =
      index < 9
        ? clamp(player.y + (index ? Math.sin(angle) * 120 : 0), 20, run.compiled.arena.height - 20)
        : run.compiled.arena.height * ((Math.floor((index - 9) / 4) + 0.5) / 3);
    let score = 0;
    visitOverflightGrid(run._grid, x, y, 80, (enemy) => {
      if ((enemy.x - x) ** 2 + (enemy.y - y) ** 2 < 80 ** 2) score++;
    });
    for (const attack of run.priorityAttacks) {
      if (attack.active && (attack.x - x) ** 2 + (attack.y - y) ** 2 < (attack.radius + 20) ** 2)
        score += 50;
    }
    if (score < bestScore) {
      bestScore = score;
      bestX = x;
      bestY = y;
    }
  }
  player.x = bestX;
  player.y = bestY;
  player.vx = 0;
  player.vy = 0;
  camera(run);
}

function damagePlayer(run, amount) {
  const player = run.player;
  if (run.fixture || player.invulnerable > 0 || run.phase !== 'playing') return false;
  if (player.shield > 0) {
    player.shield = 0;
    const rank = overflightModuleRank(run.build, 'shield');
    player.shieldCooldown = [0, 10, 7, 5][rank];
    player.invulnerable = 0.75;
    effect(run, 'shield', player.x, player.y, 30, 0.3);
    sound(run, 'shield');
    return true;
  }
  const actual = Math.min(player.hull, amount);
  player.hull -= actual;
  run.stats.damageTaken += actual;
  player.invulnerable = 0.75;
  sound(run, 'hit', actual);
  if (player.hull > 0) return true;
  run.airframesRemaining--;
  run.stats.airframesLost++;
  if (run.airframesRemaining > 0) {
    player.hull = player.maxHull;
    player.invulnerable = 1.5;
    player.boostRemaining = 0;
    safeHandoff(run);
    effect(run, 'handoff', player.x, player.y, 80, 0.6);
    sound(run, 'handoff');
  } else {
    run.phase = 'lost';
    run.resultReason = 'airframes-exhausted';
    sound(run, 'lost');
  }
  return true;
}

function movePlayer(run, input) {
  const player = run.player;
  player.boostRemaining = Math.max(0, player.boostRemaining - OVERFLIGHT_STEP);
  player.boostCooldown = Math.max(0, player.boostCooldown - OVERFLIGHT_STEP);
  player.invulnerable = Math.max(0, player.invulnerable - OVERFLIGHT_STEP);
  if (player.shieldCooldown > 0) {
    player.shieldCooldown = Math.max(0, player.shieldCooldown - OVERFLIGHT_STEP);
    if (!player.shieldCooldown && overflightModuleRank(run.build, 'shield')) player.shield = 1;
  }
  const boost = input.boost === true;
  let x = Number.isFinite(input.x) ? input.x : 0;
  let y = Number.isFinite(input.y) ? input.y : 0;
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }
  if (boost && !run._boostHeld && !player.boostCooldown) {
    player.boostRemaining = 0.3;
    player.boostCooldown = 2.5;
    if (overflightModuleRank(run.build, 'shield') === 3) {
      // Resolve after the movement/grid pass, at the departure position.
      queuePulse(run, player.x, player.y, 100, 30, 0, 35, 'shield');
    }
    run.stats.boostsUsed++;
    sound(run, 'boost');
  }
  run._boostHeld = boost;
  if (magnitude > 0.05) player.heading = Math.atan2(y, x);
  const speed = player.boostRemaining > 0 ? 330 : 180;
  if (player.boostRemaining > 0 && magnitude < 0.05) {
    x = Math.cos(player.heading);
    y = Math.sin(player.heading);
  }
  player.vx += (x * speed - player.vx) * 0.35;
  player.vy += (y * speed - player.vy) * 0.35;
  if (!run.fixture) {
    player.x = clamp(
      player.x + player.vx * OVERFLIGHT_STEP,
      player.radius,
      run.compiled.arena.width - player.radius,
    );
    player.y = clamp(
      player.y + player.vy * OVERFLIGHT_STEP,
      player.radius,
      run.compiled.arena.height - player.radius,
    );
  }
  if (player.boostRemaining > 0 && run.tick % 3 === 0)
    effect(run, 'boost', player.x, player.y, 13, 0.2);
  camera(run);
}

function currentEncounter(run) {
  const encounters = run.compiled.encounters;
  while (run._encounterIndex < encounters.length && run.time >= encounters[run._encounterIndex].end)
    run._encounterIndex++;
  const encounter = encounters[run._encounterIndex];
  return encounter && run.time >= encounter.start ? encounter : null;
}

function arrivalPoint(run, pattern = 'pursuit') {
  const halfWidth = run.camera.width / 2 + 30;
  const halfHeight = run.camera.height / 2 + 30;
  const edge = pattern === 'crossing' ? Math.floor(random(run) * 2) : Math.floor(random(run) * 4);
  let x = run.camera.x,
    y = run.camera.y;
  if (edge < 2) {
    x += edge ? halfWidth : -halfWidth;
    y += (random(run) * 2 - 1) * halfHeight;
  } else {
    y += edge === 2 ? -halfHeight : halfHeight;
    x += (random(run) * 2 - 1) * halfWidth;
  }
  return {
    x: clamp(x, 12, run.compiled.arena.width - 12),
    y: clamp(y, 12, run.compiled.arena.height - 12),
  };
}

function spawnEncounter(run, encounter) {
  if (!encounter || run.fixture) return;
  run._spawnCredit = Math.min(2, run._spawnCredit + encounter.spawnPerSecond * OVERFLIGHT_STEP);
  while (run._spawnCredit >= 1) {
    run._spawnCredit--;
    let family = encounter.families[Math.floor(random(run) * encounter.families.length)];
    // Reserve one heavy slot for a goal; use a native common family at the cap.
    const heavyLimit = Math.max(0, run.compiled.population.heavies - 1);
    if (
      (heavyFamilies.has(family) && run.stats.heaviesAlive >= heavyLimit) ||
      (specialistFamilies.has(family) &&
        run.stats.specialistsAlive >= run.compiled.population.specialists)
    ) {
      family = encounter.families.find(
        (id) => !heavyFamilies.has(id) && !specialistFamilies.has(id),
      );
      if (!family) {
        run.stats.spawnDeferred++;
        continue;
      }
    }
    const heavy = heavyFamilies.has(family);
    spawnOverflightEnemy(run, {
      ...arrivalPoint(run, encounter.pattern),
      family,
      hp: encounter.hp * (heavy ? 5 : machineFamilies.has(family) ? 2 : 1),
      speed: encounter.speed * (fastFamilies.has(family) ? 1.25 : heavy ? 0.7 : 1),
      pattern: encounter.pattern,
      warning: encounter.pattern === 'surge' ? 0.9 : 0.65,
    });
  }
}

function spawnGoal(run, role) {
  if (!run._enemyFree.length) {
    const common = run.enemies.find((enemy) => enemy.active && enemy.role === 'common');
    if (common) {
      retireEnemy(run, common);
      run.stats.retired++;
    }
  }
  const heavy = run.compiled.population.heavies > 0;
  if (heavy && run.stats.heaviesAlive >= run.compiled.population.heavies) {
    const prior = run.enemies.find(
      (enemy) => enemy.active && enemy.heavy && enemy.role !== 'final',
    );
    if (prior) {
      retireEnemy(run, prior);
      run.stats.retired++;
    }
  }
  const enemy = spawnOverflightEnemy(run, {
    ...arrivalPoint(run),
    family: heavy ? 'tracked-tank' : 'shield-bearer',
    heavy,
    specialist: false,
    role,
    hp: role === 'final' ? run.compiled.goals.finalHp : 720,
    radius: heavy ? 28 : 12,
    speed: role === 'final' ? 35 : 42,
    warning: 1.2,
    xp: role === 'final' ? 45 : 25,
  });
  if (!enemy) return false;
  if (role === 'final') {
    run.goals.finalSpawned = true;
    run.goals.finalId = enemy.id;
  } else run.goals.eliteSpawned = true;
  sound(run, 'arrival');
  return true;
}

function director(run) {
  if (run.fixture) return;
  const encounter = currentEncounter(run);
  run.encounter = encounter?.id ?? null;
  run.pressure = encounter?.pattern ?? 'relief';
  spawnEncounter(run, encounter);
  if (!run.goals.eliteSpawned && run.time >= run.compiled.goals.eliteAt) spawnGoal(run, 'elite');
  if (!run.goals.finalSpawned && run.time >= run.compiled.goals.finalAt) spawnGoal(run, 'final');
}

function prepareSupportSources(run) {
  for (const source of run._supportSources) {
    if (!source || source.warning > 0) continue;
    if (source.family === 'radar-truck') {
      source.behaviorPhase = 'support';
      continue;
    }
    const phase = source._behaviorAge % 480;
    source.behaviorPhase = phase < 60 ? 'rally-warning' : phase < 180 ? 'rally' : 'pursuit';
    if (phase === 60) {
      const dx = run.player.x - source.x,
        dy = run.player.y - source.y;
      const length = Math.hypot(dx, dy) || 1;
      const side = source.id % 2 ? 1 : -1;
      source.rallyX = clamp(
        run.player.x - (dy / length) * 140 * side,
        24,
        run.compiled.arena.width - 24,
      );
      source.rallyY = clamp(
        run.player.y + (dx / length) * 140 * side,
        24,
        run.compiled.arena.height - 24,
      );
    }
  }
}

function supportSteering(run, enemy) {
  enemy._radarSlot = -1;
  enemy._rallySlot = -1;
  let nearestRally = Infinity;
  for (let index = 0; index < run._supportSources.length; index++) {
    const source = run._supportSources[index];
    if (!source || source.warning > 0) continue;
    const distance = distanceSquared(enemy, source);
    if (distance > source.supportRadius ** 2) continue;
    if (source.family === 'radar-truck' && enemy._radarSlot < 0) {
      enemy._radarSlot = index;
      enemy._radarId = source.id;
    } else if (source.behaviorPhase === 'rally' && distance < nearestRally) {
      nearestRally = distance;
      enemy._rallySlot = index;
      enemy._rallyId = source.id;
      const dx = source.rallyX - enemy.x,
        dy = source.rallyY - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      enemy._rallySteeringX = enemy.steeringX * 0.8 + (dx / length) * 0.2;
      enemy._rallySteeringY = enemy.steeringY * 0.8 + (dy / length) * 0.2;
    }
  }
}

function moveEnemies(run) {
  prepareSupportSources(run);
  for (const enemy of run.enemies) {
    if (!enemy.active) continue;
    if (run.fixture) {
      enemy._fixtureAge++;
      if (enemy._fixtureRecycle || enemy._fixtureAge >= 720 + (enemy._slot % 721))
        recycleFixtureEnemy(run, enemy);
    }
    enemy.warning = Math.max(0, enemy.warning - OVERFLIGHT_STEP);
    if (enemy.warning > 0) continue;
    const behaviorTick = enemy._behaviorAge++;
    if (enemy.family === 'sprinter') {
      const phase = behaviorTick % 240;
      enemy.behaviorPhase = phase < 60 ? 'windup' : phase < 90 ? 'burst' : 'pursuit';
      if (phase === 60) {
        enemy._burstX = enemy.steeringX;
        enemy._burstY = enemy.steeringY;
      }
    }
    let distance = Infinity;
    if (
      (run.tick + enemy._slot) % 6 === 0 ||
      enemy.heavy ||
      enemy.specialist ||
      enemy.role !== 'common'
    ) {
      const targetX = run.player.x - enemy.x,
        targetY = run.player.y - enemy.y;
      distance = Math.hypot(targetX, targetY) || 1;
      if (enemy.pattern === 'crossing' && distance > 120) {
        enemy.steeringX = enemy.vx;
        enemy.steeringY = enemy.vy;
      } else {
        enemy.steeringX = targetX / distance;
        enemy.steeringY = targetY / distance;
      }
      if (!enemy.heavy && !enemy.specialist && enemy.role === 'common') supportSteering(run, enemy);
    }
    let dx = enemy.steeringX,
      dy = enemy.steeringY;
    const rally = run._supportSources[enemy._rallySlot];
    if (rally?.id === enemy._rallyId && rally.behaviorPhase === 'rally') {
      dx = enemy._rallySteeringX;
      dy = enemy._rallySteeringY;
    }
    const bursting = enemy.behaviorPhase === 'burst';
    if (bursting) {
      dx = enemy._burstX;
      dy = enemy._burstY;
    }
    // Cell-centroid separation is intentionally approximate steering. It never
    // limits the independent exact collision/damage queries.
    const cell = overflightGridCell(run._grid, enemy.x, enemy.y);
    const count = run._grid.counts[cell];
    if (count > 3 && !bursting) {
      let sx = enemy.x - run._grid.sumX[cell] / count;
      let sy = enemy.y - run._grid.sumY[cell] / count;
      let length = Math.hypot(sx, sy);
      if (length < 0.01) {
        sx = Math.cos(enemy.id * 2.399963);
        sy = Math.sin(enemy.id * 2.399963);
        length = 1;
      }
      const force = Math.min(0.65, (count - 3) * 0.025);
      dx += (sx / length) * force;
      dy += (sy / length) * force;
    }
    const radar = run._supportSources[enemy._radarSlot];
    const supported = radar?.id === enemy._radarId;
    const behaviorSpeed = bursting ? 2 : enemy.behaviorPhase === 'windup' ? 0.5 : 1;
    const speed =
      enemy.speed *
      behaviorSpeed *
      (supported ? 1.08 : 1) *
      (enemy.slowUntil > run.tick ? 0.45 : 1);
    enemy.x = clamp(
      enemy.x + dx * speed * OVERFLIGHT_STEP + (enemy.pushX ?? 0),
      enemy.radius,
      run.compiled.arena.width - enemy.radius,
    );
    enemy.y = clamp(
      enemy.y + dy * speed * OVERFLIGHT_STEP + (enemy.pushY ?? 0),
      enemy.radius,
      run.compiled.arena.height - enemy.radius,
    );
    enemy.pushX = 0;
    enemy.pushY = 0;
    enemy.heading = Math.atan2(dy, dx);
    if (run.fixture) wrapFixtureEnemy(run, enemy);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - OVERFLIGHT_STEP);
    if (
      (enemy.family === 'brace-trooper' || enemy.role !== 'common') &&
      !enemy.attackCooldown &&
      distance < 330 &&
      distance > 55
    ) {
      const attack = run.priorityAttacks.find((record) => !record.active);
      if (attack) {
        Object.assign(attack, {
          active: true,
          owner: enemy.id,
          x: run.player.x,
          y: run.player.y,
          radius: enemy.role === 'final' ? 57 : 40,
          remaining: 1.1,
          damage: enemy.role === 'final' ? 24 : 15,
        });
        Object.assign(enemy, {
          attackWarning: attack.remaining,
          attackX: attack.x,
          attackY: attack.y,
          attackRadius: attack.radius,
          attackCooldown: enemy.role === 'final' ? 3.8 : 6.5,
        });
        sound(run, 'warning');
      }
    }
  }
}

function resolveThreats(run) {
  for (const attack of run.priorityAttacks) {
    if (!attack.active) continue;
    const owner = run.enemies.find((enemy) => enemy.active && enemy.id === attack.owner);
    if (!owner) {
      attack.active = false;
      continue;
    }
    attack.remaining = Math.max(0, attack.remaining - OVERFLIGHT_STEP);
    owner.attackWarning = attack.remaining;
    if (attack.remaining > 0) continue;
    attack.active = false;
    effect(run, 'hostile-impact', attack.x, attack.y, attack.radius, 0.35);
    if (distanceSquared(run.player, attack) <= (attack.radius + run.player.radius) ** 2)
      damagePlayer(run, attack.damage);
  }
  if (run.player.invulnerable > 0) return;
  run.stats.collisionCandidates += visitOverflightGrid(
    run._grid,
    run.player.x,
    run.player.y,
    run._maxEnemyRadius + run.player.radius,
    (enemy) => {
      if (enemy.warning > 0 || run.player.invulnerable > 0 || run.phase !== 'playing') return;
      if (distanceSquared(run.player, enemy) <= (enemy.radius + run.player.radius) ** 2)
        damagePlayer(run, 20);
    },
  );
}

function primaryAttack(run) {
  const payload = overflightPayload(run.build);
  const heading = run.player.heading;
  const x = run.player.x - Math.cos(heading) * 28;
  const y = run.player.y - Math.sin(heading) * 28;
  queuePayload(run, {
    x,
    y,
    ...payload,
    heading,
    remaining: 0.45,
    kind: payload.count > 1 ? 'scatter' : 'drop',
  });
  effect(run, 'drop-warning', x, y, payload.radius, 0.45);
  for (let index = 0; index < payload.echoes; index++) {
    queuePayload(run, {
      x,
      y,
      radius: payload.radius + (index + 1) * 27,
      damage: payload.damage * (index ? 0.75 : 0.85),
      remaining: 0.45 + (index + 1) * 0.2,
      count: 1,
      spacing: 0,
      heading,
      kind: 'bell',
    });
  }
  run._cooldowns.primary = payload.cooldown;
  sound(run, 'payload');
}

function queuePayload(run, payload) {
  const echo = run._echoes.find((record) => !record.active);
  if (!echo) throw new Error('Primary payload pool is too small for its fire rate.');
  Object.assign(echo, payload, { active: true });
}

function queuePulse(run, x, y, radius, damage, remaining, push = 0, kind = 'proximity-pulse') {
  const pulse = run._pulses.find((record) => !record.active);
  if (!pulse) throw new Error('Pulse pool is too small for its fire rate.');
  Object.assign(pulse, { active: true, x, y, radius, damage, remaining, push, kind });
}

function launchSideBurst(run, rank) {
  // The full launch is deferred if the finite pool cannot admit both shots.
  // No projectile or its eventual damage is silently discarded.
  if (run._projectileFree.length < 2) {
    run.stats.projectileDeferrals++;
    return false;
  }
  for (let side = -1; side <= 1; side += 2) {
    const projectile = run.projectiles[run._projectileFree.pop()];
    const angle = run.player.heading + (side * Math.PI) / 2;
    Object.assign(projectile, {
      active: true,
      x: run.player.x,
      y: run.player.y,
      vx: Math.cos(angle) * 340,
      vy: Math.sin(angle) * 340,
      radius: 7 + rank * 2,
      remaining: 0.9,
      damage: 22 + rank * 12,
      piercing: rank === 3,
    });
    projectile.hits.clear();
  }
  return true;
}

function segmentDistanceSquared(x, y, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((x - ax) * dx + (y - ay) * dy) / length, 0, 1) : 0;
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}

function segmentCircleEntry(x, y, radius, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const fx = ax - x,
    fy = ay - y;
  const outside = fx * fx + fy * fy - radius * radius;
  if (outside <= 0) return 0;
  const length = dx * dx + dy * dy;
  if (!length) return Infinity;
  const along = fx * dx + fy * dy;
  const discriminant = along * along - length * outside;
  if (discriminant < 0) return Infinity;
  const entry = (-along - Math.sqrt(discriminant)) / length;
  return entry >= 0 && entry <= 1 ? entry : Infinity;
}

function advanceProjectiles(run) {
  for (let index = 0; index < run.projectiles.length; index++) {
    if (run.phase !== 'playing') return;
    const projectile = run.projectiles[index];
    if (!projectile.active) continue;
    const oldX = projectile.x,
      oldY = projectile.y;
    projectile.x += projectile.vx * OVERFLIGHT_STEP;
    projectile.y += projectile.vy * OVERFLIGHT_STEP;
    projectile.remaining -= OVERFLIGHT_STEP;
    const segmentLength = Math.hypot(projectile.x - oldX, projectile.y - oldY);
    let nearest = null,
      nearestDistance = Infinity;
    run.stats.collisionCandidates += visitOverflightGrid(
      run._grid,
      (oldX + projectile.x) / 2,
      (oldY + projectile.y) / 2,
      segmentLength / 2 + projectile.radius + run._maxEnemyRadius,
      (enemy) => {
        if (enemy.warning > 0 || projectile.hits.has(enemy.id)) return;
        if (
          segmentDistanceSquared(enemy.x, enemy.y, oldX, oldY, projectile.x, projectile.y) >
          (projectile.radius + enemy.radius) ** 2
        )
          return;
        if (projectile.piercing) {
          projectile.hits.add(enemy.id);
          damageEnemy(run, enemy, projectile.damage);
        } else {
          const distance = segmentCircleEntry(
            enemy.x,
            enemy.y,
            enemy.radius + projectile.radius,
            oldX,
            oldY,
            projectile.x,
            projectile.y,
          );
          if (
            distance < nearestDistance ||
            (distance === nearestDistance && enemy.id < nearest.id)
          ) {
            nearest = enemy;
            nearestDistance = distance;
          }
        }
      },
    );
    if (nearest) {
      damageEnemy(run, nearest, projectile.damage);
      projectile.remaining = 0;
    }
    if (
      projectile.remaining <= 0 ||
      projectile.x < 0 ||
      projectile.y < 0 ||
      projectile.x > run.compiled.arena.width ||
      projectile.y > run.compiled.arena.height
    ) {
      projectile.active = false;
      projectile.hits.clear();
      run._projectileFree.push(index);
    }
  }
}

function scanner(run) {
  const rank = overflightModuleRank(run.build, 'scanner');
  if (!rank || run._cooldowns.scanner > 0) return;
  let target = null,
    score = -Infinity;
  visitOverflightGrid(run._grid, run.player.x, run.player.y, 280, (enemy) => {
    if (enemy.warning > 0 || distanceSquared(enemy, run.player) > 280 ** 2) return;
    const candidate =
      (enemy.role !== 'common' ? 100000 : enemy.heavy || enemy.specialist ? 50000 : 0) +
      enemy.hp -
      Math.sqrt(distanceSquared(enemy, run.player));
    if (candidate > score) {
      target = enemy;
      score = candidate;
    }
  });
  if (target) {
    target.markUntil = run.tick + (rank === 1 ? 120 : 180);
    effect(run, 'scanner', target.x, target.y, target.radius + 14, 0.4);
    if (rank === 3) {
      const hit = new Set();
      let origin = target;
      for (let hop = 0; hop < 3; hop++) {
        const fromX = origin.x,
          fromY = origin.y;
        let next = hop === 0 ? target : null,
          best = Infinity;
        if (hop)
          visitOverflightGrid(run._grid, fromX, fromY, 120, (enemy) => {
            const distance = (enemy.x - fromX) ** 2 + (enemy.y - fromY) ** 2;
            if (
              enemy.warning <= 0 &&
              !hit.has(enemy.id) &&
              distance <= 120 ** 2 &&
              distance < best
            ) {
              next = enemy;
              best = distance;
            }
          });
        if (!next) break;
        hit.add(next.id);
        damageEnemy(run, next, 24);
        effect(run, 'chain', fromX, fromY, 7, 0.2, { x2: next.x, y2: next.y });
        origin = next;
      }
    }
  }
  run._cooldowns.scanner = rank === 3 ? 1.6 : 2.2;
}

function automaticSystems(run) {
  for (const module of run.build.combat) {
    if (run._cooldowns[module.id] > 0) continue;
    const { id, rank } = module;
    const player = run.player;
    if (id === 'proximity-pulse') {
      const radius = 54 + rank * 22;
      queuePulse(run, player.x, player.y, radius, 22 + rank * 10, 0.3, 12 + rank * 5);
      effect(run, 'pulse-warning', player.x, player.y, radius, 0.3);
      if (rank === 3) queuePulse(run, player.x, player.y, radius, 38, 0.72, 22, 'return-pulse');
      run._cooldowns[id] = 2 - rank * 0.25;
    } else if (id === 'slow-field') {
      const field = run.fields.find((record) => !record.active);
      if (!field) throw new Error('Slow field pool is too small for its lifetime.');
      Object.assign(field, {
        active: true,
        x: player.x,
        y: player.y,
        radius: 58 + rank * 20,
        remaining: 1.2 + rank * 0.6,
        clock: 0,
        damage: 4 + rank * 3,
      });
      effect(run, 'slow-field', field.x, field.y, field.radius, field.remaining);
      run._cooldowns[id] = 2.4;
    } else if (id === 'side-burst') {
      if (launchSideBurst(run, rank)) run._cooldowns[id] = 1.45 - rank * 0.15;
    }
    sound(run, 'system');
  }
}

function weapons(run) {
  for (const key of weaponIds)
    run._cooldowns[key] = Math.max(0, run._cooldowns[key] - OVERFLIGHT_STEP);
  scanner(run);
  if (run.phase !== 'playing') return;
  for (const echo of run._echoes) {
    if (!echo.active) continue;
    echo.remaining -= OVERFLIGHT_STEP;
    if (echo.remaining > 0) continue;
    echo.active = false;
    for (let index = 0; index < echo.count; index++) {
      const offset = (index - (echo.count - 1) / 2) * echo.spacing;
      const x = echo.x - Math.sin(echo.heading) * offset,
        y = echo.y + Math.cos(echo.heading) * offset;
      damageOverflightArea(run, x, y, echo.radius, echo.damage);
      effect(run, echo.kind, x, y, echo.radius, 0.35);
      if (run.phase !== 'playing') return;
    }
  }
  if (!run._cooldowns.primary) primaryAttack(run);
  automaticSystems(run);
  for (const pulse of run._pulses) {
    if (!pulse.active) continue;
    pulse.remaining -= OVERFLIGHT_STEP;
    if (pulse.remaining > 0) continue;
    pulse.active = false;
    damageOverflightArea(run, pulse.x, pulse.y, pulse.radius, pulse.damage, { push: pulse.push });
    effect(run, pulse.kind, pulse.x, pulse.y, pulse.radius, 0.4);
    if (run.phase !== 'playing') return;
  }
  advanceProjectiles(run);
  if (run.phase !== 'playing') return;
  for (const field of run.fields) {
    if (!field.active) continue;
    field.remaining -= OVERFLIGHT_STEP;
    field.clock -= OVERFLIGHT_STEP;
    if (field.clock <= 0) {
      damageOverflightArea(run, field.x, field.y, field.radius, field.damage, { slow: 0.5 });
      field.clock = 0.35;
      if (run.phase !== 'playing') return;
    }
    if (field.remaining <= 0) field.active = false;
  }
}

function collectPickup(run, pickup, index) {
  if (!pickup.active) return;
  pickup.active = false;
  run._pickupFree.push(index);
  run.stats.pickupsAlive--;
  run.stats.xpOnGround -= pickup.value;
  run.stats.xpCollected += pickup.value;
  run.progression.xp += pickup.value;
  sound(run, 'salvage', pickup.value);
  pickup.value = 0;
}

function collectSalvage(run, forcedRadius = 0) {
  if (run.fixture) return;
  const rank = overflightModuleRank(run.build, 'scanner');
  const radius = forcedRadius || 62 + rank * 23;
  for (let index = 0; index < run.pickups.length; index++) {
    const pickup = run.pickups[index];
    if (!pickup.active) continue;
    pickup.age += OVERFLIGHT_STEP;
    const distance = distanceSquared(pickup, run.player);
    if (distance <= radius ** 2) collectPickup(run, pickup, index);
  }
}

function offerUpgrade(run) {
  if (
    run.fixture ||
    run.phase !== 'playing' ||
    run.progression.choices >= run.progression.maxChoices
  )
    return;
  if (run.progression.xp < run.progression.nextThreshold) return;
  run.offers = draftOverflightUpgrades(run.build, run.compiled.upgrades.modules, () =>
    random(run, '_draftRandomState'),
  );
  run.phase = 'upgrade';
  sound(run, 'upgrade-ready');
}

export function chooseOverflightUpgrade(run, id) {
  if (run.phase !== 'upgrade') return false;
  const offer = run.offers.find((candidate) => candidate.id === id);
  if (!offer || !applyOverflightUpgrade(run.build, offer, run.compiled.upgrades.modules))
    return false;
  run.events.length = 0;
  run.progression.history.push({ id: offer.id, time: run.time, tick: run.tick });
  run.progression.choices++;
  run.stats.upgradesChosen++;
  run.progression.nextThreshold = run.compiled.upgrades.thresholds[run.progression.choices] ?? null;
  run.phase = 'playing';
  // Confirm and boost commonly share a button. Require release after a card.
  run._boostHeld = true;
  if (offer.system === 'reinforce') {
    run.player.maxHull += 12;
    run.player.hull = Math.min(run.player.maxHull, run.player.hull + 12);
  }
  if (offer.system === 'repair') {
    run.player.hull = Math.min(run.player.maxHull, run.player.hull + 35);
    damageOverflightArea(run, run.player.x, run.player.y, 100, 20, { push: 35 });
    effect(run, 'shield', run.player.x, run.player.y, 100, 0.4);
  }
  if (offer.system === 'recovery') {
    collectSalvage(run, 260);
    run.player.boostCooldown = 0;
  }
  if (offer.system === 'shield') {
    run.player.shield = 1;
    run.player.shieldCooldown = 0;
  }
  run.offers = [];
  sound(run, offer.kind === 'evolution' ? 'evolution' : 'upgrade');
  offerUpgrade(run);
  updatePopulationStats(run);
  return true;
}

export function rerollOverflightUpgrades(run) {
  if (run.phase !== 'upgrade' || run.progression.rerolls <= 0) return false;
  const previous = run.offers.map((offer) => offer.id);
  run.offers = draftOverflightUpgrades(
    run.build,
    run.compiled.upgrades.modules,
    () => random(run, '_draftRandomState'),
    previous,
  );
  run.progression.rerolls--;
  run.stats.rerollsUsed++;
  run.events.length = 0;
  sound(run, 'reroll');
  return true;
}

function ageEffects(run) {
  for (let index = 0; index < run.effects.length; index++) {
    const record = run.effects[index];
    if (!record.active) continue;
    record.age += OVERFLIGHT_STEP;
    if (record.age >= record.life) {
      record.active = false;
      run._effectFree.push(index);
    }
  }
}

/** The host owns wall-clock accumulation. Simulation advances exactly one 60 Hz tick. */
export function stepOverflight(run, input = {}, dt = OVERFLIGHT_STEP) {
  if (!Number.isFinite(dt) || Math.abs(dt - OVERFLIGHT_STEP) > 1e-12)
    throw new RangeError('Overflight uses fixed 1/60 second simulation steps.');
  run.events.length = 0;
  if (run.phase !== 'playing') return run;
  run.tick++;
  run.time = run.tick / 60;
  ageEffects(run);
  movePlayer(run, input);
  director(run);
  rebuildOverflightGrid(run._grid, run.enemies);
  moveEnemies(run);
  rebuildOverflightGrid(run._grid, run.enemies);
  weapons(run);
  if (run.phase === 'playing') resolveThreats(run);
  if (run.phase === 'playing') collectSalvage(run);
  updatePopulationStats(run);
  offerUpgrade(run);
  return run;
}

function initializeFixture(run) {
  const alive = run.fixture === 'stress' ? 2500 : 1500;
  const shown = run.fixture === 'stress' ? 1200 : 700;
  if (run.compiled.population.heavies < 4 || run.compiled.population.specialists < 8)
    throw new RangeError(
      'Benchmark fixtures require capacity for four heavies and eight specialists.',
    );
  run.fixtureWorkload = {
    alive,
    visible: shown,
    heavies: 4,
    specialists: 8,
    supportSources: 6,
    aimedAttackSources: 2,
    ordinaryFamilyBehaviors: true,
    frozenPositions: false,
    partitionWrapping: true,
    recycledEnemyHull: true,
    repositionAfterDefeat: true,
    maximumActorLifetimeSeconds: 24,
    distributionColumns: 10,
    distributionRows: 6,
    recycledActors: 0,
    gameplayResult: false,
  };
  run._fixtureBuckets = new Uint16Array(60);
  run.build.primary = { rank: 4, branch: 'wide', evolved: true };
  run.build.combat = [
    { id: 'proximity-pulse', rank: 3 },
    { id: 'slow-field', rank: 3 },
  ].filter((module) => run.compiled.upgrades.modules.includes(module.id));
  run.build.support = run.compiled.upgrades.modules.includes('scanner')
    ? { id: 'scanner', rank: 3 }
    : null;
  const soldiers = run.compiled.resources.soldiers.filter((id) => !specialistFamilies.has(id));
  const representative = [
    'tracked-tank',
    'armored-carrier',
    'cargo-truck',
    'tracked-tank',
    'utility-car',
    'scout-car',
    'radar-truck',
    'relay-warden',
    'brace-trooper',
    'radar-truck',
    'relay-warden',
    'brace-trooper',
    'radar-truck',
    'relay-warden',
  ];
  for (let index = 0; index < alive; index++) {
    let x, y;
    if (index < shown) {
      x = run.camera.x + (random(run) - 0.5) * (run.camera.width - 36);
      y = run.camera.y + (random(run) - 0.5) * (run.camera.height - 36);
    } else {
      const left = index % 2 === 0;
      const space = (run.compiled.arena.width - run.camera.width) / 2 - 40;
      // Default arena has room beyond both camera sides; custom narrow arenas
      // cannot truthfully host an offscreen workload and are rejected below.
      if (space <= 0)
        throw new RangeError('Benchmark fixtures require an arena wider than the camera.');
      x = left ? 16 + random(run) * space : run.compiled.arena.width - 16 - random(run) * space;
      y = 16 + random(run) * (run.compiled.arena.height - 32);
    }
    const family =
      index < representative.length && index < shown
        ? representative[index]
        : soldiers[index % soldiers.length];
    const enemy = spawnOverflightEnemy(run, {
      x,
      y,
      family,
      hp: 60,
      warning: 0,
      speed: 40 + (index % 7) * 6,
      wardrobe: index % 3,
    });
    if (!enemy) throw new Error('Fixture cannot admit its representative population.');
    enemy._fixturePartition = index < shown ? 'visible' : index % 2 === 0 ? 'left' : 'right';
    enemy._fixtureAge = 0;
    enemy._fixtureRecycle = false;
  }
  for (let index = 0; index < Math.min(480, run.pickups.length); index++) {
    dropOverflightSalvage(
      run,
      run.camera.x + (random(run) - 0.5) * 880,
      run.camera.y + (random(run) - 0.5) * 450,
      1,
    );
  }
}

function recycleFixtureEnemy(run, enemy) {
  const camera = run.camera,
    arena = run.compiled.arena;
  if (enemy._fixturePartition === 'visible') {
    enemy.x = camera.x + (random(run) - 0.5) * (camera.width - 36);
    enemy.y = camera.y + (random(run) - 0.5) * (camera.height - 36);
  } else {
    const left = enemy._fixturePartition === 'left';
    const min = left ? 16 : camera.x + camera.width / 2 + 24;
    const max = left ? camera.x - camera.width / 2 - 24 : arena.width - 16;
    enemy.x = min + random(run) * (max - min);
    enemy.y = 16 + random(run) * (arena.height - 32);
  }
  const dx = run.player.x - enemy.x,
    dy = run.player.y - enemy.y,
    length = Math.hypot(dx, dy) || 1;
  enemy.steeringX = dx / length;
  enemy.steeringY = dy / length;
  enemy.pushX = 0;
  enemy.pushY = 0;
  enemy.slowUntil = 0;
  enemy.markUntil = 0;
  enemy.hp = enemy.maxHp;
  enemy._fixtureAge = 0;
  enemy._fixtureRecycle = false;
  // A committed attack remains a world-space threat at its locked position.
  run.fixtureWorkload.recycledActors++;
}

function wrapFixtureEnemy(run, enemy) {
  const camera = run.camera,
    arena = run.compiled.arena;
  let minX,
    maxX,
    minY = 16,
    maxY = arena.height - 16;
  if (enemy._fixturePartition === 'visible') {
    minX = camera.x - camera.width / 2 + 18;
    maxX = camera.x + camera.width / 2 - 18;
    minY = camera.y - camera.height / 2 + 18;
    maxY = camera.y + camera.height / 2 - 18;
  } else if (enemy._fixturePartition === 'left') {
    minX = 16;
    maxX = camera.x - camera.width / 2 - 24;
  } else {
    minX = camera.x + camera.width / 2 + 24;
    maxX = arena.width - 16;
  }
  enemy.x = wrap(enemy.x, minX, maxX);
  enemy.y = wrap(enemy.y, minY, maxY);
}

export function overflightSummary(run) {
  return {
    format: 'OverflightRunSummaryV1',
    projectId: run.compiled.id,
    projectIdentity: run.compiled.projectIdentity ?? null,
    seed: run.seed,
    phase: run.phase,
    outcome: run.fixture
      ? 'technical-fixture'
      : run.phase === 'won'
        ? 'won'
        : run.phase === 'lost'
          ? 'lost'
          : 'incomplete',
    reason: run.resultReason,
    fixture: run.fixture,
    fixtureWorkload: run.fixtureWorkload ? { ...run.fixtureWorkload } : null,
    time: run.time,
    tick: run.tick,
    airframes: run.airframes,
    airframesRemaining: run.airframesRemaining,
    stats: { ...run.stats },
    build: {
      primary: { ...run.build.primary },
      combat: run.build.combat.map((module) => ({ ...module })),
      support: run.build.support ? { ...run.build.support } : null,
      reinforcement: run.build.reinforcement,
      repair: run.build.repair,
    },
    upgrades: run.progression.history.map((entry) => ({ ...entry })),
    goals: { ...run.goals },
  };
}
