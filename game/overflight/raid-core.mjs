import {
  overflightArmoredDamage,
  overflightAttackSpec,
  overflightAttackContains,
  hasOverflightEscape,
  updateOverflightCaches,
} from './tactics.mjs';
import { createOverflightRun, OVERFLIGHT_STEP } from './core.mjs';
import { rebuildOverflightGrid, visitOverflightGrid } from './grid.mjs';
import { recordOverflightDefeat } from './defeat-feed.mjs';
import {
  createOverflightHuntBuild,
  overflightHuntParameters,
  draftOverflightHuntUpgrades,
  applyOverflightHuntUpgrade,
} from './raid-upgrades.mjs';

export { OVERFLIGHT_STEP };
export const OVERFLIGHT_HUNT_RULES = 'overflight-raid.v1';
export const OVERFLIGHT_HUNT_RULES_V2 = 'overflight-raid.v2';
const STEP = OVERFLIGHT_STEP;
const EPS = 1e-9;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const remainingAfter = (remaining, elapsed) =>
  remaining <= elapsed + EPS ? 0 : remaining - elapsed;
const machinery = new Set([
  'utility-car',
  'cargo-truck',
  'armored-carrier',
  'scout-car',
  'tracked-tank',
  'radar-truck',
]);
const behaviorForFamily = (family) =>
  machinery.has(family)
    ? 'vehicle'
    : family === 'shield-bearer'
      ? 'shield'
      : family === 'brace-trooper'
        ? 'brace'
        : ['runner', 'sprinter', 'courier'].includes(family)
          ? family
          : 'patrol';

function random(run, key = '_randomState') {
  let value = run[key];
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  run[key] = value >>> 0;
  return run[key] / 0x100000000;
}
function sound(run, type, position = run.player, value = 1) {
  const family = ['defeat', 'hunt-kill', 'armor-break'].includes(type)
    ? position.family
    : undefined;
  const previous = run.events.find((event) => event.type === type && event.family === family);
  if (previous) {
    previous.count++;
    previous.value += value;
    previous.x += (position.x - previous.x) / previous.count;
    previous.y += (position.y - previous.y) / previous.count;
  } else
    run.events.push({
      type,
      count: 1,
      value,
      x: position.x,
      y: position.y,
      ...(family
        ? {
            family,
            machine: machinery.has(family)
              ? family === 'tracked-tank'
                ? 'tracked'
                : 'wheeled'
              : false,
          }
        : {}),
    });
}
function effect(run, kind, x, y, radius, life = 0.24) {
  const slot = run._effectFree.pop();
  if (slot === undefined) {
    run.stats.droppedVisualEffects++;
    return;
  }
  Object.assign(run.effects[slot], {
    active: true,
    kind,
    x,
    y,
    x2: x,
    y2: y,
    radius,
    age: 0,
    life,
  });
}
function updateCamera(run) {
  const { arena } = run.compiled;
  run.camera.x = clamp(run.player.x, run.camera.width / 2, arena.width - run.camera.width / 2);
  run.camera.y = clamp(run.player.y, run.camera.height / 2, arena.height - run.camera.height / 2);
}
function population(run) {
  let alive = 0,
    visible = 0,
    heavies = 0,
    specialists = 0;
  for (const enemy of run.enemies)
    if (enemy.active) {
      alive++;
      if (
        Math.abs(enemy.x - run.camera.x) <= run.camera.width / 2 &&
        Math.abs(enemy.y - run.camera.y) <= run.camera.height / 2
      )
        visible++;
      if (enemy.heavy) heavies++;
      if (enemy.specialist) specialists++;
    }
  Object.assign(run.stats, {
    enemiesAlive: alive,
    enemiesVisible: visible,
    heaviesAlive: heavies,
    specialistsAlive: specialists,
    priorityAttacks: run.priorityAttacks.filter((attack) => attack.active).length,
  });
  run.stats.peakAlive = Math.max(run.stats.peakAlive, alive);
  run.stats.peakVisible = Math.max(run.stats.peakVisible, visible);
}

export function createOverflightHuntRun(
  compiled,
  { seed = compiled?.seed, airframes = 3, slowResume = true, fixture = null } = {},
) {
  if (!['OverflightHuntCompiledV1', 'OverflightHuntCompiledV2'].includes(compiled?.format))
    throw new TypeError('A compiled Overflight Hunt project is required.');
  if (![null, 'raid-reference'].includes(fixture)) throw new RangeError('Unknown Raid fixture.');
  // The same pooled state allocation is used by both modes. No second scene,
  // sprite owner, audio mixer or texture cache is introduced.
  const run = createOverflightRun(
    {
      ...compiled,
      format: compiled.rulesVersion === 2 ? 'OverflightCompiledV2' : 'OverflightCompiledV1',
    },
    { seed, airframes, slowResume },
  );
  run.compiled = compiled;
  run.rules = run.rulesVersion === 2 ? OVERFLIGHT_HUNT_RULES_V2 : OVERFLIGHT_HUNT_RULES;
  run.mode = 'raid';
  run.fixture = fixture;
  run.build = createOverflightHuntBuild();
  run.hunt = {
    sector: -1,
    objectives: compiled.encounters.flatMap((encounter, sector) =>
      encounter.objectives.map((objective) => ({
        id: objective.id,
        family: objective.family,
        sector,
        enemyId: null,
        completed: false,
      })),
    ),
    score: 0,
    chain: 0,
    bestChain: 0,
    chainRemaining: 0,
    multiplier: 1,
    rushCharge: 0,
    rushRemaining: 0,
    ordinaryKills: 0,
    couriersCaught: 0,
    couriersEscaped: 0,
    armorHits: 0,
    objectivesCompleted: 0,
    pendingChoices: 0,
  };
  Object.assign(run.stats, {
    blockedContacts: 0,
    cleanArmorHits: 0,
    boostRefunds: 0,
    rushActivations: 0,
    noTargetSeconds: 0,
    distanceFlown: 0,
    objectiveChoices: 0,
    optionalChoices: 0,
    projectilesFired: 0,
  });
  run.progression.nextThreshold = compiled.upgrades.thresholds[0];
  run._boostStartedTick = -1000;
  run._boostRefunded = false;
  run._boostKillCount = 0;
  run._boostInterrupted = false;
  run._optionalAwards = 0;
  run._sectorPending = false;
  run._replacementTick = -1;
  run._contacts = Array.from({ length: run.enemies.length + run.projectiles.length }, () => ({
    time: 0,
    enemy: null,
    projectile: null,
    id: 0,
  }));
  run._contactOrder = [];
  run._contactSeen = new Uint32Array(run.enemies.length);
  run._wakes = Array.from({ length: 32 }, () => ({
    active: false,
    x: 0,
    y: 0,
    remaining: 0,
    radius: 20,
  }));
  run._wakeIndex = 0;
  const entry = compiled.encounters[0]?.entry;
  if (entry) Object.assign(run.player, { x: entry.x, y: entry.y });
  enterSector(run, 0);
  if (fixture) initializeFixture(run);
  updateCamera(run);
  population(run);
  rebuildOverflightGrid(run._grid, run.enemies);
  run.events.length = 0;
  return run;
}
export function startOverflightHunt(run) {
  if (run.phase !== 'ready') return false;
  run.phase = 'playing';
  run.events.length = 0;
  sound(run, 'start');
  return true;
}
export function pauseOverflightHunt(run) {
  if (!['playing', 'upgrade'].includes(run.phase)) return false;
  run._resumePhase = run.phase;
  run.phase = 'paused';
  run.events.length = 0;
  return true;
}
export function resumeOverflightHunt(run) {
  if (run.phase !== 'paused') return false;
  run.phase = run._resumePhase;
  run.events.length = 0;
  run._boostHeld = true;
  return true;
}

/** Explicit spawn supports reproducible contact fixtures and authored packs. */
export function spawnOverflightHuntEnemy(run, options = {}) {
  const family = options.family ?? 'patroller';
  if (!run._permittedFamilies.has(family))
    throw new TypeError(`Unsupported Raid enemy family: ${family}`);
  const slot = run._enemyFree.pop();
  if (slot === undefined) {
    run.stats.spawnDeferred++;
    return null;
  }
  const enemy = run.enemies[slot],
    isMachine = machinery.has(family);
  const behavior = options.behavior ?? behaviorForFamily(family);
  const segments = isMachine
    ? (options.armorSegments ??
      (family === 'tracked-tank' ? 3 : family === 'armored-carrier' ? 2 : 1))
    : 0;
  const x = clamp(options.x ?? run.player.x + 180, 28, run.compiled.arena.width - 28);
  const y = clamp(options.y ?? run.player.y, 28, run.compiled.arena.height - 28);
  const route = (
    options.route?.length
      ? options.route
      : [
          { x: x - 70, y },
          { x: x + 70, y },
        ]
  ).map((point) => ({
    x: clamp(point.x, 28, run.compiled.arena.width - 28),
    y: clamp(point.y, 28, run.compiled.arena.height - 28),
  }));
  Object.assign(enemy, {
    id: run._nextId++,
    active: true,
    family,
    wardrobe: options.wardrobe ?? Math.floor(random(run) * 3),
    x,
    y,
    prevX: x,
    prevY: y,
    heading: options.heading ?? Math.PI,
    vx: 0,
    vy: 0,
    radius: options.radius ?? (isMachine ? (segments > 1 ? 23 : 17) : 8),
    hp: segments || 1,
    maxHp: segments || 1,
    armorSegments: segments,
    maxArmorSegments: segments,
    heavy: isMachine && segments > 1,
    specialist: ['shield', 'brace'].includes(behavior),
    behavior,
    behaviorPhase:
      options.behaviorPhase ??
      (['vehicle', 'brace'].includes(behavior)
        ? options.objectiveId
          ? 'guarding'
          : 'recovery'
        : 'patrol'),
    phaseRemaining:
      options.phaseRemaining ??
      (['vehicle', 'brace'].includes(behavior)
        ? options.objectiveId
          ? 0
          : 3.5 + random(run)
        : 1.2 + random(run)),
    contactState: isMachine
      ? options.objectiveId
        ? 'machinery-guarded'
        : 'machinery-exposed'
      : behavior === 'shield' || (behavior === 'brace' && options.objectiveId)
        ? 'guarded'
        : 'exposed',
    role:
      options.role ??
      (options.objectiveId ? (family === 'tracked-tank' ? 'final' : 'elite') : 'common'),
    objectiveId: options.objectiveId ?? null,
    warning: options.warning ?? 1,
    speed:
      options.speed ??
      (isMachine
        ? 40
        : behavior === 'runner'
          ? 112
          : behavior === 'courier'
            ? 105
            : behavior === 'sprinter'
              ? 95
              : 52),
    route,
    routeIndex: 0,
    routeRecovery: 0,
    routeDirection: 1,
    slowUntil: 0,
    slowMultiplier: 1,
    markUntil: 0,
    supportRadius: 0,
    attackWarning: 0,
    attackX: x,
    attackY: y,
    attackRadius: 24,
    attackCooldown: 0,
    rewardTarget: behavior === 'courier',
    armorContactLatched: false,
    pendingFire: false,
    attackKind: null,
    attackCycle: 0,
    attackFireCount: 0,
    burstNextTick: 0,
    cacheId: null,
    escapeRemaining: 18,
    revealed: false,
    _beforeHeading: options.heading ?? Math.PI,
    _beforePhase: 'recovery',
  });
  run._maxEnemyRadius = Math.max(run._maxEnemyRadius, enemy.radius);
  run.stats.spawned++;
  return enemy;
}
function enterSector(run, index) {
  const encounter = run.compiled.encounters[index];
  if (!encounter) return;
  run.hunt.sector = index;
  run._sectorPending = false;
  resetChain(run);
  for (const pack of encounter.packs) {
    const columns = Math.ceil(Math.sqrt(pack.count));
    for (let i = 0; i < pack.count; i++) {
      const dx = ((i % columns) - (columns - 1) / 2) * pack.spacing;
      const dy =
        (Math.floor(i / columns) - (Math.ceil(pack.count / columns) - 1) / 2) * pack.spacing;
      const jitter = () => (random(run) - 0.5) * 3;
      const route = pack.route.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      spawnOverflightHuntEnemy(run, {
        ...pack,
        x: pack.x + dx + jitter(),
        y: pack.y + dy + jitter(),
        route,
      });
    }
  }
  for (const objective of encounter.objectives) {
    const enemy = spawnOverflightHuntEnemy(run, {
      ...objective,
      objectiveId: objective.id,
      role: index === run.compiled.encounters.length - 1 ? 'final' : 'elite',
    });
    if (!enemy) throw new Error('Raid objective population exceeds compiled capacity.');
    run.hunt.objectives.find((item) => item.id === objective.id).enemyId = enemy.id;
  }
  sound(run, index === 2 ? 'final' : 'arrival');
}

/** Facing is body-local; side and rear contacts expose a shield. */
export function overflightHuntContactState(enemy, point = null, before = false) {
  const phase = before ? enemy._beforePhase : enemy.behaviorPhase;
  if (enemy.maxArmorSegments > 0)
    return phase === 'recovery' ? 'machinery-exposed' : 'machinery-guarded';
  if (enemy.behavior === 'brace')
    return ['guarding', 'windup', 'burst'].includes(phase) ? 'guarded' : 'exposed';
  if (enemy.behavior === 'shield') {
    if (!point) return 'guarded';
    const heading = before ? enemy._beforeHeading : enemy.heading;
    return (point.x - enemy.x) * Math.cos(heading) + (point.y - enemy.y) * Math.sin(heading) > EPS
      ? 'guarded'
      : 'exposed';
  }
  return 'exposed';
}
function resetChain(run) {
  run.hunt.chain = 0;
  run.hunt.chainRemaining = 0;
  run.hunt.multiplier = 1;
}
function chargeRush(run, value) {
  if (run.hunt.rushRemaining > 0 || run.hunt.rushCharge >= 20) return;
  run.hunt.rushCharge = Math.min(20, run.hunt.rushCharge + value);
  if (run.hunt.rushCharge === 20) sound(run, 'rush-ready');
}
function retire(run, enemy) {
  if (!enemy.active) return false;
  enemy.active = false;
  run._enemyFree.push(enemy._slot);
  enemy.pendingFire = false;
  for (const warning of run.priorityAttacks)
    if (warning.active && warning.owner === enemy.id) warning.active = false;
  return true;
}
function defeat(run, enemy, params) {
  if (!retire(run, enemy)) return;
  recordOverflightDefeat(run, enemy);
  const hunt = run.hunt;
  run.stats.kills++;
  if (!enemy.maxArmorSegments) {
    run.stats.damageDealt++;
    run.stats.hits++;
  }
  hunt.chain++;
  hunt.bestChain = Math.max(hunt.bestChain, hunt.chain);
  hunt.multiplier =
    hunt.chain >= 35 ? 5 : hunt.chain >= 20 ? 4 : hunt.chain >= 10 ? 3 : hunt.chain >= 5 ? 2 : 1;
  hunt.chainRemaining = params.chainWindow;
  hunt.score +=
    (enemy.objectiveId
      ? 500
      : enemy.behavior === 'courier'
        ? 200
        : enemy.maxArmorSegments
          ? 150
          : 50) *
    hunt.multiplier *
    (hunt.rushRemaining > 0 ? 2 : 1);
  chargeRush(run, 1);
  if (enemy.behavior === 'courier') {
    hunt.couriersCaught++;
    sound(run, 'courier', enemy);
  }
  if (run.fixture) {
    run._fixtureRecycles.push(enemy._fixtureDefinition);
    run.stats.fixtureDefeats++;
  } else if (enemy.objectiveId) {
    const objective = hunt.objectives.find((item) => item.id === enemy.objectiveId);
    objective.completed = true;
    hunt.objectivesCompleted++;
    run.player.shield = params.shieldCapacity;
    sound(run, 'objective', enemy);
    if (objective.sector < run.compiled.encounters.length - 1) {
      hunt.pendingChoices++;
      run.stats.objectiveChoices++;
    }
    if (hunt.objectives.every((item) => item.completed)) finish(run, true);
    else if (
      hunt.objectives.filter((item) => item.sector === hunt.sector).every((item) => item.completed)
    )
      run._sectorPending = true;
  } else if (!enemy.maxArmorSegments) {
    hunt.ordinaryKills++;
    run.stats.xpEarned++;
    run.stats.xpCollected++;
    run.progression.xp++;
    while (
      run._optionalAwards < run.compiled.upgrades.thresholds.length &&
      hunt.ordinaryKills >= run.compiled.upgrades.thresholds[run._optionalAwards]
    ) {
      run._optionalAwards++;
      hunt.pendingChoices++;
      run.stats.optionalChoices++;
      run.progression.nextThreshold = run.compiled.upgrades.thresholds[run._optionalAwards] ?? null;
    }
  }
  if (run.player.boostRemaining > 0) {
    run._boostKillCount++;
    if (run._boostKillCount === 3) chargeRush(run, params.rushBonus);
    if (!run._boostInterrupted && params.interruptRadius) {
      run._boostInterrupted = true;
      let closest = null,
        distance = Infinity;
      visitOverflightGrid(run._grid, enemy.x, enemy.y, params.interruptRadius, (guard) => {
        const d = Math.hypot(guard.x - enemy.x, guard.y - enemy.y);
        if (
          ['shield', 'brace', 'vehicle'].includes(guard.behavior) &&
          guard.behaviorPhase === 'windup' &&
          d <= params.interruptRadius &&
          (d < distance || (d === distance && guard.id < closest.id))
        ) {
          closest = guard;
          distance = d;
        }
      });
      if (closest) {
        closest.behaviorPhase = 'recovery';
        closest.phaseRemaining = 3 + params.heavyExposureBonus;
        closest.pendingFire = false;
        for (const warning of run.priorityAttacks)
          if (warning.owner === closest.id) warning.active = false;
      }
    }
  }
  sound(run, 'hunt-kill', enemy);
  sound(run, 'defeat', enemy);
  effect(run, 'impact', enemy.x, enemy.y, enemy.radius + 8);
}
function finish(run, won) {
  run.phase = won ? 'won' : 'lost';
  run.resultReason = won ? 'objectives-complete' : 'airframes-exhausted';
  for (const projectile of run.projectiles) projectile.active = false;
  for (const attack of run.priorityAttacks) attack.active = false;
  for (const enemy of run.enemies) enemy.pendingFire = false;
  run.player.boostRemaining = 0;
  sound(run, won ? 'won' : 'lost');
}
function refundBoost(run) {
  if (run.player.boostRemaining <= 0 || run._boostRefunded) return;
  run._boostRefunded = true;
  run.player.boostCooldown = Math.max(0, run.player.boostCooldown - 0.75);
  run.stats.boostRefunds++;
}
function replaceAirframe(run) {
  if (run.fixture) {
    run.player.hull = 100;
    run.player.invulnerable = 0.75;
    run.stats.fixtureDefeats++;
    return;
  }
  run.airframesRemaining--;
  run.stats.airframesLost++;
  if (!run.airframesRemaining) {
    finish(run, false);
    return;
  }
  let bestX = run.player.x,
    bestY = run.player.y,
    bestClearance = -Infinity;
  // Fixed lattice plus current position gives a deterministic safe placement;
  // both living bodies and independent projectiles participate in the score.
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 17; col++) {
      const x = 60 + (col * (run.compiled.arena.width - 120)) / 16;
      const y = 60 + (row * (run.compiled.arena.height - 120)) / 6;
      let clearance = 400;
      for (const enemy of run.enemies)
        if (enemy.active)
          clearance = Math.min(clearance, Math.hypot(x - enemy.x, y - enemy.y) - enemy.radius);
      for (const projectile of run.projectiles)
        if (projectile.active)
          clearance = Math.min(
            clearance,
            Math.hypot(x - projectile.x, y - projectile.y) - projectile.radius,
          );
      const score = clearance - Math.hypot(x - run.player.x, y - run.player.y) * 0.035;
      if (score > bestClearance) {
        bestClearance = score;
        bestX = x;
        bestY = y;
      }
    }
  Object.assign(run.player, {
    x: bestX,
    y: bestY,
    hull: 100,
    vx: 0,
    vy: 0,
    boostRemaining: 0,
    invulnerable: 1.5,
  });
  run._replacementTick = run.tick;
  run._boostHeld = true;
  sound(run, 'handoff');
}
function damagePlayer(run) {
  if (run.player.invulnerable > 0 || run.phase !== 'playing') return false;
  resetChain(run);
  run.player.invulnerable = 0.75;
  if (run.player.shield > 0) {
    run.player.shield--;
    sound(run, 'shield');
    return true;
  }
  const rank = run.rulesVersion === 2 ? (run.build.hunt.plating ?? 0) : 0;
  run.player.armorReduction = rank * 0.1;
  const actual = Math.min(run.player.hull, rank ? overflightArmoredDamage(20, rank) : 20);
  run.player.hull -= actual;
  run.stats.damageTaken += actual;
  sound(run, 'damage');
  if (!run.player.hull) replaceAirframe(run);
  return true;
}

function movePlayer(run, input, params) {
  const player = run.player,
    hunt = run.hunt;
  player.prevX = player.x;
  player.prevY = player.y;
  player.boostRemaining = remainingAfter(player.boostRemaining, STEP);
  player.boostCooldown = remainingAfter(
    player.boostCooldown,
    STEP * (hunt.rushRemaining > 0 ? 2 : 1),
  );
  player.invulnerable = remainingAfter(player.invulnerable, STEP);
  hunt.rushRemaining = remainingAfter(hunt.rushRemaining, STEP);
  hunt.chainRemaining = remainingAfter(hunt.chainRemaining, STEP);
  if (!hunt.chainRemaining) resetChain(run);
  const boost = input.boost === true;
  let x = Number.isFinite(input.x) ? input.x : 0,
    y = Number.isFinite(input.y) ? input.y : 0;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  if (
    boost &&
    !run._boostHeld &&
    player.boostCooldown <= EPS &&
    run.tick - run._boostStartedTick >= 54
  ) {
    if (hunt.rushCharge >= 20 && hunt.rushRemaining <= 0) {
      hunt.rushCharge = 0;
      hunt.rushRemaining = 5;
      run.stats.rushActivations++;
      sound(run, 'rush');
    }
    player.boostRemaining = params.boostDuration;
    player.boostCooldown = params.boostCooldown;
    run._boostStartedTick = run.tick;
    run._boostRefunded = false;
    run._boostKillCount = 0;
    run._boostInterrupted = false;
    run.stats.boostsUsed++;
    sound(run, 'boost');
  }
  run._boostHeld = boost;
  if (length > 0.05) player.heading = Math.atan2(y, x);
  if (player.boostRemaining > 0 && length < 0.05) {
    x = Math.cos(player.heading);
    y = Math.sin(player.heading);
  }
  const speed = player.boostRemaining > 0 ? 330 : 180;
  player.vx += (x * speed - player.vx) * 0.35;
  player.vy += (y * speed - player.vy) * 0.35;
  player.x = clamp(
    player.x + player.vx * STEP,
    player.radius,
    run.compiled.arena.width - player.radius,
  );
  player.y = clamp(
    player.y + player.vy * STEP,
    player.radius,
    run.compiled.arena.height - player.radius,
  );
  if (run.fixture) {
    // Keep measurable offscreen partitions on both sides of the camera.
    player.x = clamp(
      player.x,
      run.camera.width / 2 + 96,
      run.compiled.arena.width - run.camera.width / 2 - 96,
    );
    player.y = clamp(
      player.y,
      run.camera.height / 2 + 24,
      run.compiled.arena.height - run.camera.height / 2 - 24,
    );
  }
  run.stats.distanceFlown += Math.hypot(player.x - player.prevX, player.y - player.prevY);
  if (player.boostRemaining > 0 && run.tick % 3 === 0) {
    effect(run, 'boost', player.x, player.y, 13, 0.2);
    if (params.wakeDuration) {
      Object.assign(run._wakes[run._wakeIndex++ % run._wakes.length], {
        active: true,
        x: player.x,
        y: player.y,
        remaining: params.wakeDuration,
        radius: 20,
      });
      effect(run, 'slow-field', player.x, player.y, 20, params.wakeDuration);
    }
  }
}
function setWarning(run, enemy) {
  const warning = run.priorityAttacks.find((record) => !record.active);
  if (!warning) return false;
  const spec =
    run.rulesVersion === 2 && !run.fixture
      ? overflightAttackSpec(enemy, run.player, run.compiled.combat)
      : null;
  if (
    spec &&
    (Math.abs(enemy.x - run.camera.x) > run.camera.width / 2 - 20 ||
      Math.abs(enemy.y - run.camera.y) > run.camera.height / 2 - 20 ||
      !hasOverflightEscape(run, spec))
  )
    return false;
  enemy.behaviorPhase = 'windup';
  enemy.phaseRemaining = spec?.remaining ?? 1.2;
  enemy.heading = Math.atan2(run.player.y - enemy.y, run.player.x - enemy.x);
  enemy.attackX = run.player.x;
  enemy.attackY = run.player.y;
  Object.assign(warning, {
    active: true,
    owner: enemy.id,
    x: enemy.attackX,
    y: enemy.attackY,
    radius: 25,
    remaining: 1.2,
    damage: 20,
    kind: null,
    ...(spec ?? {}),
  });
  enemy.attackKind = spec?.kind ?? null;
  enemy.attackSpec = spec;
  enemy.attackCycle++;
  enemy.attackFireCount = 0;
  enemy.burstNextTick = 0;
  sound(run, 'warning', enemy);
  return true;
}
function moveEnemies(run, params) {
  run._maxEnemyTravel = 0;
  let nearby = false;
  for (const enemy of run.enemies) {
    if (!enemy.active) continue;
    enemy.prevX = enemy.x;
    enemy.prevY = enemy.y;
    enemy._beforeHeading = enemy.heading;
    enemy._beforePhase = enemy.behaviorPhase;
    enemy.pendingFire = !!(
      enemy.burstNextTick &&
      run.tick >= enemy.burstNextTick &&
      enemy.behaviorPhase === 'burst'
    );
    const distance = Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y);
    if (distance <= 540) nearby = true;
    enemy._beforeWarning = enemy.warning;
    enemy.warning = Math.max(0, enemy.warning - STEP);
    if (enemy._beforeWarning > 0) continue;
    const isAttacker = ['brace', 'vehicle'].includes(enemy.behavior);
    enemy.phaseRemaining -= STEP;
    if (isAttacker) {
      if (['guarding', 'recovery'].includes(enemy.behaviorPhase) && enemy.phaseRemaining <= 0) {
        if (distance < 520) setWarning(run, enemy);
        else enemy.phaseRemaining = 0.25;
      } else if (enemy.behaviorPhase === 'windup' && enemy.phaseRemaining <= 0) {
        enemy.behaviorPhase = 'burst';
        enemy.phaseRemaining = 0.35;
        enemy.pendingFire = true;
        for (const warning of run.priorityAttacks)
          if (warning.owner === enemy.id && warning.active) warning.remaining = 0.35;
      } else if (enemy.behaviorPhase === 'burst' && enemy.phaseRemaining <= 0) {
        enemy.behaviorPhase = 'recovery';
        enemy.phaseRemaining =
          (run.compiled.combat?.machinery.exposureSeconds ?? 3) + params.heavyExposureBonus;
        for (const warning of run.priorityAttacks)
          if (warning.owner === enemy.id) warning.active = false;
      }
      enemy.attackWarning = enemy.behaviorPhase === 'windup' ? enemy.phaseRemaining : 0;
    } else if (enemy.behavior === 'shield' && enemy.phaseRemaining <= 0) {
      // Commit the shield orientation, giving the player time to flank it.
      enemy.heading = Math.atan2(run.player.y - enemy.y, run.player.x - enemy.x);
      enemy.phaseRemaining = run.compiled.combat?.guard.commitSeconds ?? 1.8;
    } else if (enemy.behavior === 'sprinter') {
      if (enemy.behaviorPhase === 'patrol' && enemy.phaseRemaining <= 0 && distance < 260) {
        enemy.behaviorPhase = 'windup';
        enemy.phaseRemaining = 1;
      } else if (enemy.behaviorPhase === 'windup' && enemy.phaseRemaining <= 0) {
        enemy.behaviorPhase = 'burst';
        enemy.phaseRemaining = 0.65;
      } else if (enemy.behaviorPhase === 'burst' && enemy.phaseRemaining <= 0) {
        enemy.behaviorPhase = 'recovery';
        enemy.phaseRemaining = 1;
      } else if (
        ['guarding', 'recovery'].includes(enemy.behaviorPhase) &&
        enemy.phaseRemaining <= 0
      ) {
        enemy.behaviorPhase = 'patrol';
        enemy.phaseRemaining = 2;
      }
    }
    if (enemy.behavior === 'courier' && !enemy.objectiveId) {
      if (
        !enemy.revealed &&
        Math.abs(enemy.x - run.camera.x) < run.camera.width / 2 &&
        Math.abs(enemy.y - run.camera.y) < run.camera.height / 2
      ) {
        enemy.revealed = true;
        sound(run, 'courier', enemy);
      }
      if (enemy.revealed) enemy.escapeRemaining -= STEP;
      if (enemy.escapeRemaining <= 0 && run.fixture) enemy.escapeRemaining = 18;
      if (enemy.escapeRemaining <= 0) {
        retire(run, enemy);
        run.hunt.couriersEscaped++;
        continue;
      }
    }
    const stationary =
      (isAttacker && ['windup', 'burst'].includes(enemy.behaviorPhase)) ||
      enemy.behavior === 'shield' ||
      enemy.behaviorPhase === 'windup';
    let speed = enemy.speed;
    if (enemy.behavior === 'sprinter')
      speed *=
        enemy.behaviorPhase === 'burst' ? 2.3 : enemy.behaviorPhase === 'recovery' ? 0.35 : 1;
    if (stationary) speed = 0;
    if (enemy.slowUntil > run.tick) speed *= 0.55;
    for (const wake of run._wakes)
      if (
        wake.active &&
        Math.hypot(wake.x - enemy.x, wake.y - enemy.y) <= wake.radius + enemy.radius
      ) {
        enemy.slowUntil = run.tick + 12;
        speed *= 0.55;
        break;
      }
    if (enemy.routeRecovery > 0) {
      enemy.routeRecovery -= STEP;
      speed = 0;
    }
    const target = enemy.route[enemy.routeIndex];
    if (target && speed) {
      const dx = target.x - enemy.x,
        dy = target.y - enemy.y,
        length = Math.hypot(dx, dy);
      if (length <= speed * STEP + 2) {
        enemy.routeIndex = (enemy.routeIndex + 1) % enemy.route.length;
        enemy.routeRecovery = ['runner', 'courier'].includes(enemy.behavior) ? 0.45 : 0.1;
      } else {
        enemy.vx = (dx / length) * speed;
        enemy.vy = (dy / length) * speed;
        enemy.x = clamp(
          enemy.x + enemy.vx * STEP,
          enemy.radius,
          run.compiled.arena.width - enemy.radius,
        );
        enemy.y = clamp(
          enemy.y + enemy.vy * STEP,
          enemy.radius,
          run.compiled.arena.height - enemy.radius,
        );
        if (!isAttacker && enemy.behavior !== 'shield') enemy.heading = Math.atan2(dy, dx);
      }
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
    }
    enemy.contactState = overflightHuntContactState(enemy);
    if (
      enemy.armorContactLatched &&
      Math.hypot(run.player.prevX - enemy.prevX, run.player.prevY - enemy.prevY) >
        enemy.radius + run.player.radius * params.strikeWidth + 5
    )
      enemy.armorContactLatched = false;
    run._maxEnemyTravel = Math.max(
      run._maxEnemyTravel,
      Math.hypot(enemy.x - enemy.prevX, enemy.y - enemy.prevY),
    );
  }
  if (!nearby) run.stats.noTargetSeconds += STEP;
  for (const warning of run.priorityAttacks)
    if (warning.active) warning.remaining = Math.max(0, warning.remaining - STEP);
}
function firePending(run) {
  for (const enemy of run.enemies) {
    if (!enemy.active || !enemy.pendingFire) continue;
    enemy.pendingFire = false;
    const spec = enemy.attackSpec;
    if (run.rulesVersion === 2 && spec?.kind === 'ground') {
      if (overflightAttackContains(spec, run.player.x, run.player.y, run.player.radius))
        damagePlayer(run);
      effect(run, 'hostile-impact', spec.x, spec.y, spec.radius, 0.35);
      sound(run, 'impact', enemy);
      continue;
    }
    const offsets =
      run.rulesVersion === 2 && spec?.kind === 'fan' ? [-spec.spread, 0, spec.spread] : [0];
    // Reserve the complete attack before firing, never silently drop fan rays.
    if (run._projectileFree.length < offsets.length) {
      run.stats.projectileDeferrals++;
      continue;
    }
    for (const offset of offsets) {
      const slot = run._projectileFree.pop();
      const heading = enemy.heading + offset;
      const projectile = run.projectiles[slot];
      Object.assign(projectile, {
        id: run._nextId++,
        active: true,
        hostile: true,
        owner: enemy.id,
        x: enemy.x + Math.cos(heading) * (enemy.radius + 5),
        y: enemy.y + Math.sin(heading) * (enemy.radius + 5),
        vx: Math.cos(heading) * 230,
        vy: Math.sin(heading) * 230,
        radius: 5,
        remaining: 2.8,
        damage: 20,
        _slot: slot,
      });
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
      run.stats.projectilesFired++;
    }
    enemy.attackFireCount++;
    enemy.burstNextTick =
      run.rulesVersion === 2 &&
      enemy.family === 'tracked-tank' &&
      spec?.kind === 'lane' &&
      enemy.attackFireCount < 3
        ? run.tick + 8
        : 0;
    sound(run, 'fire', enemy);
  }
}
function retireProjectile(run, projectile) {
  if (!projectile.active) return;
  projectile.active = false;
  run._projectileFree.push(projectile._slot);
}
function age(run) {
  for (let index = 0; index < run.effects.length; index++) {
    const item = run.effects[index];
    if (!item.active) continue;
    item.age += STEP;
    if (item.age >= item.life) {
      item.active = false;
      run._effectFree.push(index);
    }
  }
  for (const wake of run._wakes)
    if (wake.active) {
      wake.remaining -= STEP;
      if (wake.remaining <= 0) wake.active = false;
    }
  for (const projectile of run.projectiles)
    if (projectile.active) {
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
      const duration = Math.min(STEP, Math.max(0, projectile.remaining));
      projectile._endTime = duration / STEP;
      projectile.x += projectile.vx * duration;
      projectile.y += projectile.vy * duration;
      projectile.remaining = Math.max(0, projectile.remaining - STEP);
      // The last active segment still collides; retire after the transaction.
    }
}

/** Earliest moving-circle contact in a normalized interval; both participants move. */
export function overflightHuntSweep(ax, ay, bx, by, cx, cy, dx, dy, radius) {
  const x = ax - cx,
    y = ay - cy,
    vx = bx - ax - (dx - cx),
    vy = by - ay - (dy - cy);
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = vx * vx + vy * vy;
  if (a < EPS) return null;
  const b = 2 * (x * vx + y * vy),
    discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= -EPS && t <= 1 + EPS ? clamp(t, 0, 1) : null;
}
function collectContacts(run, params, from, x, y, endX, endY) {
  let count = 0;
  const order = run._contactOrder;
  order.length = 0;
  const boosted = run.player.boostRemaining > 0;
  const radius = run.player.radius * (boosted ? params.strikeWidth : 1);
  const add = (record, enemy, projectile, t) => {
    if (t === null) return;
    const item = run._contacts[count++];
    Object.assign(item, { time: from + t * (1 - from), enemy, projectile, id: record.id });
    order.push(item);
  };
  const mx = (x + endX) / 2,
    my = (y + endY) / 2;
  const broad =
    Math.hypot(endX - x, endY - y) / 2 + radius + run._maxEnemyRadius + run._maxEnemyTravel;
  visitOverflightGrid(run._grid, mx, my, broad, (enemy) => {
    if (run._contactSeen[enemy._slot] === run.tick || enemy._beforeWarning > 0) return;
    run.stats.collisionCandidates++;
    const sx = enemy.prevX + (enemy.x - enemy.prevX) * from;
    const sy = enemy.prevY + (enemy.y - enemy.prevY) * from;
    let t = overflightHuntSweep(x, y, endX, endY, sx, sy, enemy.x, enemy.y, radius + enemy.radius);
    if (t === null) return;
    const px = x + (endX - x) * t,
      py = y + (endY - y) * t;
    const ex = sx + (enemy.x - sx) * t,
      ey = sy + (enemy.y - sy) * t;
    const state = contactAt(enemy, px, py, ex, ey);
    if (state === 'guarded' || state === 'machinery-guarded')
      t = overflightHuntSweep(
        x,
        y,
        endX,
        endY,
        sx,
        sy,
        enemy.x,
        enemy.y,
        run.player.radius + enemy.radius,
      );
    add(enemy, enemy, null, t);
  });
  for (const projectile of run.projectiles)
    if (projectile.active && projectile._endTime > from) {
      const end = projectile._endTime;
      const sx = projectile.prevX + ((projectile.x - projectile.prevX) * from) / end;
      const sy = projectile.prevY + ((projectile.y - projectile.prevY) * from) / end;
      const fraction = (end - from) / (1 - from);
      const t = overflightHuntSweep(
        x,
        y,
        x + (endX - x) * fraction,
        y + (endY - y) * fraction,
        sx,
        sy,
        projectile.x,
        projectile.y,
        run.player.radius + projectile.radius,
      );
      add(projectile, null, projectile, t === null ? null : t * fraction);
    }
  order.sort((a, b) => a.time - b.time || a.id - b.id);
  return order;
}
function contactAt(enemy, px, py, ex, ey) {
  if (enemy.behavior === 'shield')
    return (px - ex) * Math.cos(enemy._beforeHeading) + (py - ey) * Math.sin(enemy._beforeHeading) >
      EPS
      ? 'guarded'
      : 'exposed';
  return overflightHuntContactState(enemy, null, true);
}
function contacts(run, params) {
  const player = run.player;
  let from = 0,
    x = player.prevX,
    y = player.prevY,
    endX = player.x,
    endY = player.y;
  let queue = collectContacts(run, params, from, x, y, endX, endY),
    index = 0;
  while (index < queue.length && run.phase === 'playing' && run._replacementTick !== run.tick) {
    const contact = queue[index++];
    const t = (contact.time - from) / (1 - from || 1);
    const px = x + (endX - x) * t,
      py = y + (endY - y) * t;
    if (contact.projectile) {
      if (!contact.projectile.active) continue;
      retireProjectile(run, contact.projectile);
      damagePlayer(run);
      continue;
    }
    const enemy = contact.enemy;
    if (!enemy.active) continue;
    run._contactSeen[enemy._slot] = run.tick;
    const ex = enemy.prevX + (enemy.x - enemy.prevX) * contact.time;
    const ey = enemy.prevY + (enemy.y - enemy.prevY) * contact.time;
    const state = contactAt(enemy, px, py, ex, ey);
    if (state === 'exposed') {
      defeat(run, enemy, params);
      refundBoost(run);
      continue;
    }
    if (state === 'machinery-exposed' && enemy.armorContactLatched) continue;
    if (state === 'machinery-exposed' && player.boostRemaining > 0) {
      enemy.armorContactLatched = true;
      enemy.armorSegments--;
      enemy.hp = enemy.armorSegments;
      run.hunt.armorHits++;
      run.stats.cleanArmorHits++;
      run.stats.damageDealt++;
      run.stats.hits++;
      refundBoost(run);
      sound(run, 'armor-break', enemy);
      effect(run, 'impact', ex, ey, enemy.radius + 12);
      if (!enemy.armorSegments) defeat(run, enemy, params);
      continue;
    }
    // Block at the actual time of impact, then rebuild remaining contacts against
    // the stopped player. This prevents killing bodies behind a blocking shield.
    run.stats.blockedContacts++;
    sound(run, 'hunt-blocked', enemy);
    if (state === 'guarded' || state === 'machinery-guarded') damagePlayer(run);
    if (run._replacementTick === run.tick || run.phase !== 'playing') break;
    const length = Math.hypot(px - ex, py - ey) || 1;
    player.vx = ((px - ex) / length) * 70;
    player.vy = ((py - ey) / length) * 70;
    endX = px;
    endY = py;
    player.x = px;
    player.y = py;
    from = contact.time;
    x = px;
    y = py;
    queue = collectContacts(run, params, from, x, y, endX, endY);
    index = 0;
  }
}
function offerUpgrade(run) {
  if (
    run.fixture ||
    run.phase !== 'playing' ||
    run.player.boostRemaining > EPS ||
    run.hunt.pendingChoices <= 0 ||
    run.progression.choices >= run.progression.maxChoices
  )
    return;
  run.offers = draftOverflightHuntUpgrades(run.build, run.compiled.upgrades.modules, () =>
    random(run, '_draftRandomState'),
  );
  if (run.offers.length !== 3)
    throw new Error('Raid content cannot offer three distinct legal upgrades.');
  run.phase = 'upgrade';
  sound(run, 'upgrade-ready');
}
export function chooseOverflightHuntUpgrade(run, id) {
  if (run.phase !== 'upgrade') return false;
  const offer = run.offers.find((candidate) => candidate.id === id);
  if (!offer || !applyOverflightHuntUpgrade(run.build, offer, run.compiled.upgrades.modules))
    return false;
  run.events.length = 0;
  run.progression.history.push({ id, time: run.time, tick: run.tick });
  run.progression.choices++;
  run.stats.upgradesChosen++;
  run.hunt.pendingChoices--;
  run.player.armorReduction = overflightHuntParameters(run.build).armorReduction;
  if (offer.system === 'recovery-shield')
    run.player.shield = overflightHuntParameters(run.build).shieldCapacity;
  run.phase = 'playing';
  run._boostHeld = true;
  run.offers = [];
  sound(run, 'upgrade');
  offerUpgrade(run);
  return true;
}
export function rerollOverflightHuntUpgrades(run) {
  if (run.phase !== 'upgrade' || run.progression.rerolls <= 0) return false;
  run.offers = draftOverflightHuntUpgrades(
    run.build,
    run.compiled.upgrades.modules,
    () => random(run, '_draftRandomState'),
    run.offers.map((offer) => offer.id),
  );
  run.progression.rerolls--;
  run.stats.rerollsUsed++;
  run.events.length = 0;
  sound(run, 'reroll');
  return true;
}
export function stepOverflightHunt(run, input = {}, dt = STEP) {
  if (!Number.isFinite(dt) || Math.abs(dt - STEP) > 1e-12)
    throw new RangeError('Raid uses fixed 1/60 second simulation steps.');
  run.events.length = 0;
  if (run.phase !== 'playing') return run;
  run.tick++;
  run.time = run.tick / 60;
  const params = overflightHuntParameters(run.build);
  age(run);
  movePlayer(run, input, params);
  moveEnemies(run, params);
  rebuildOverflightGrid(run._grid, run.enemies);
  contacts(run, params);
  if (run.fixture) {
    updateCamera(run);
    maintainFixture(run);
  }
  for (const projectile of run.projectiles)
    if (projectile.active && projectile.remaining <= 0) retireProjectile(run, projectile);
  if (run.phase === 'playing') {
    firePending(run);
    if (run._sectorPending) enterSector(run, run.hunt.sector + 1);
    updateOverflightCaches(
      run,
      (options) => spawnOverflightHuntEnemy(run, options),
      (type) => sound(run, type),
    );
    offerUpgrade(run);
  }
  updateCamera(run);
  population(run);
  return run;
}
export function overflightHuntSummary(run) {
  return {
    format: 'OverflightHuntRunSummaryV1',
    rules: run.rules,
    projectId: run.compiled.id,
    projectIdentity: run.compiled.projectIdentity ?? null,
    seed: run.seed,
    phase: run.phase,
    outcome: run.fixture
      ? 'technical-fixture'
      : ['won', 'lost'].includes(run.phase)
        ? run.phase
        : 'incomplete',
    reason: run.resultReason,
    fixture: run.fixture,
    fixtureWorkload: run.fixtureWorkload ? { ...run.fixtureWorkload } : null,
    time: run.time,
    tick: run.tick,
    airframes: run.airframes,
    airframesRemaining: run.airframesRemaining,
    slowResume: run.slowResume,
    stats: { ...run.stats },
    build: {
      ...run.build,
      primary: { ...run.build.primary },
      combat: [],
      support: null,
      hunt: { ...run.build.hunt },
    },
    upgrades: run.progression.history.map((entry) => ({ ...entry })),
    hunt: { ...run.hunt, objectives: run.hunt.objectives.map((item) => ({ ...item })) },
    goals: { ...run.goals, finalDefeated: run.phase === 'won' },
  };
}

/** This benchmark keeps actual contact/AI/effects active indefinitely. Recycling
 * and spatial partitions are technical workload rules, never Raid game rules. */
function initializeFixture(run) {
  for (let i = 1; i < run.compiled.encounters.length; i++) enterSector(run, i);
  run.player.x = run.compiled.arena.width / 2;
  run.player.y = run.compiled.arena.height / 2;
  updateCamera(run);
  for (const id of Object.keys(run.build.hunt)) run.build.hunt[id] = 2;
  run.player.shield = 2;
  run._fixtureRecycles = [];
  const actors = run.enemies
    .filter((enemy) => enemy.active)
    .sort(
      (a, b) =>
        Number(b.maxArmorSegments > 0 || b.specialist) -
          Number(a.maxArmorSegments > 0 || a.specialist) || a.id - b.id,
    );
  const shown = Math.min(200, actors.length);
  let visibleSpecialists = 0;
  const visibleActors = new Set();
  for (const enemy of actors) {
    if (visibleActors.size === shown) break;
    if (enemy.specialist && visibleSpecialists >= 8) continue;
    visibleActors.add(enemy.id);
    if (enemy.specialist) visibleSpecialists++;
  }
  run._fixtureBounds = {
    visible: new Float64Array(4),
    left: new Float64Array(4),
    right: new Float64Array(4),
  };
  run.fixtureWorkload = {
    kind: 'raid-reference',
    gameplayResult: false,
    alive: actors.length,
    visible: shown,
    fullBuild: true,
    independentProjectiles: true,
    movingContactCollisions: true,
    partitionWrapping: true,
    recycledActors: 0,
    ordinaryFamilyBehaviors: true,
    poolPolicy: 'same-owned-pools',
    progressionPolicy: 'disabled-for-controlled-fixture',
  };
  actors.forEach((enemy, index) => {
    const definition = Object.freeze({
      family: enemy.family,
      behavior: enemy.behavior,
      armorSegments: enemy.maxArmorSegments,
      objectiveId: enemy.objectiveId,
      wardrobe: enemy.wardrobe,
      speed: enemy.speed,
      partition: visibleActors.has(enemy.id) ? 'visible' : index % 2 ? 'left' : 'right',
    });
    enemy._fixtureDefinition = definition;
    fixturePosition(run, enemy, true);
  });
  run.events.length = 0;
}
function fixtureBounds(run, partition) {
  const { camera, compiled } = run;
  const bounds = run._fixtureBounds[partition];
  bounds[2] = partition === 'visible' ? camera.y - camera.height / 2 + 20 : 28;
  bounds[3] =
    partition === 'visible' ? camera.y + camera.height / 2 - 20 : compiled.arena.height - 28;
  if (partition === 'visible') {
    bounds[0] = camera.x - camera.width / 2 + 20;
    bounds[1] = camera.x + camera.width / 2 - 20;
  } else if (partition === 'left') {
    bounds[0] = 28;
    bounds[1] = Math.max(56, camera.x - camera.width / 2 - 48);
  } else {
    bounds[0] = Math.min(compiled.arena.width - 56, camera.x + camera.width / 2 + 48);
    bounds[1] = compiled.arena.width - 28;
  }
  return bounds;
}
function fixturePosition(run, enemy, reset = false) {
  const [minX, maxX, minY, maxY] = fixtureBounds(run, enemy._fixtureDefinition.partition);
  if (!reset && enemy.x >= minX && enemy.x <= maxX && enemy.y >= minY && enemy.y <= maxY) return;
  enemy.x = minX + random(run) * (maxX - minX);
  enemy.y = minY + random(run) * (maxY - minY);
  enemy.prevX = enemy.x;
  enemy.prevY = enemy.y;
  enemy.warning = 0;
  enemy._beforeWarning = 0;
  enemy.route = [
    { x: clamp(enemy.x + 80, minX, maxX), y: clamp(enemy.y + 40, minY, maxY) },
    { x: clamp(enemy.x - 80, minX, maxX), y: clamp(enemy.y - 40, minY, maxY) },
  ];
  enemy.routeIndex = 0;
}
function maintainFixture(run) {
  for (const definition of run._fixtureRecycles) {
    const enemy = spawnOverflightHuntEnemy(run, { ...definition, warning: 0 });
    if (!enemy) throw new Error('Raid fixture failed to recycle a released actor slot.');
    enemy._fixtureDefinition = definition;
    fixturePosition(run, enemy, true);
    run.fixtureWorkload.recycledActors++;
  }
  run._fixtureRecycles.length = 0;
  for (const enemy of run.enemies) if (enemy.active) fixturePosition(run, enemy);
}
export function overflightHuntFixtureInput(run) {
  if (run.fixture !== 'raid-reference')
    throw new TypeError('Raid fixture input requires a technical workload.');
  const player = run.player;
  let target = null,
    nearest = Infinity;
  for (const enemy of run.enemies) {
    if (
      !enemy.active ||
      enemy._fixtureDefinition.partition !== 'visible' ||
      enemy.maxArmorSegments ||
      enemy.specialist
    )
      continue;
    if (
      enemy.x < run.camera.width / 2 + 96 ||
      enemy.x > run.compiled.arena.width - run.camera.width / 2 - 96 ||
      enemy.y < run.camera.height / 2 + 24 ||
      enemy.y > run.compiled.arena.height - run.camera.height / 2 - 24
    )
      continue;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < nearest) {
      nearest = distance;
      target = enemy;
    }
  }
  let x = target ? (target.x - player.x) / (nearest || 1) : Math.cos(run.time * 0.7);
  let y = target ? (target.y - player.y) / (nearest || 1) : Math.sin(run.time * 1.1);
  for (const enemy of run.enemies) {
    if (!enemy.active || !(enemy.maxArmorSegments || enemy.specialist)) continue;
    const dx = player.x - enemy.x,
      dy = player.y - enemy.y,
      distance = Math.hypot(dx, dy);
    if (distance < 70) {
      const force = (70 - distance) / 20;
      x += (dx / (distance || 1)) * force;
      y += (dy / (distance || 1)) * force;
    }
  }
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length, boost: run.tick % 2 === 0 && player.boostCooldown <= EPS };
}
