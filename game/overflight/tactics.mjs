import { overflightTerrainClear } from './terrain.mjs';
import { visitOverflightGrid } from './grid.mjs';
import { OVERFLIGHT_FLIGHT_PROFILES, OVERFLIGHT_PLAYER_RADIUS } from './flight-profile.mjs';
const slowestEscapeSpeed =
  Math.min(...Object.values(OVERFLIGHT_FLIGHT_PROFILES).map((profile) => profile.speed)) * 0.9;
/** Shared, deterministic combat rules for Overflight V2. No renderer or clock owner. */
export const OVERFLIGHT_DIFFICULTIES = Object.freeze(['relaxed', 'standard', 'veteran']);
export function seededOverflightRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}
export function overflightFormationSchedule(seed, difficulty, encounterSet, rulesVersion = 2) {
  const random = seededOverflightRandom(seed ^ 0x6d2b79f5);
  const patterns =
    encounterSet === 'crossing'
      ? ['crossing', 'flank', 'support', 'armored']
      : encounterSet === 'mixed'
        ? ['support', 'armored', 'flank', 'crossing']
        : ['flank', 'crossing', 'armored', 'support'];
  const schedule = [];
  let start = 0,
    last = '',
    deck = [];
  while (start < 355) {
    if (!deck.length) {
      deck = [...patterns];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (deck[0] === last) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    const pattern =
      start === 0 && (difficulty === 'standard' || rulesVersion >= 3) ? 'pursuit' : deck.shift();
    last = pattern;
    const duration = 30 + Math.floor(random() * 16);
    const end = Math.min(360, start + duration);
    schedule.push({ start, end, pattern });
    start = end;
  }
  return schedule;
}
export function applyOverflightGuard(enemy, damage, origin) {
  if (!(enemy.guardIntegrity > 0) || !origin) return { damage, blocked: 0, broken: false };
  const dx = origin.x - enemy.x,
    dy = origin.y - enemy.y;
  if (
    Math.hypot(dx, dy) <= enemy.radius ||
    dx * Math.cos(enemy.guardHeading) + dy * Math.sin(enemy.guardHeading) <= 1e-9
  )
    return { damage, blocked: 0, broken: false };
  const blocked = Math.min(enemy.guardIntegrity, damage * (enemy.guardAbsorption ?? 0.75));
  enemy.guardIntegrity = Math.max(0, enemy.guardIntegrity - blocked);
  return {
    damage: damage - blocked,
    blocked,
    broken: enemy.guardIntegrity === 0,
  };
}
export function overflightArmoredDamage(amount, rank) {
  return Math.max(1, Math.ceil(amount * (1 - Math.min(2, Math.max(0, rank)) * 0.1)));
}
export function overflightAttackSpec(enemy, player, profile = null) {
  const kind =
    enemy.family === 'armored-carrier'
      ? 'fan'
      : enemy.family === 'tracked-tank' && (enemy.attackCycle ?? 0) % 2
        ? 'ground'
        : 'lane';
  const heading = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  return {
    kind,
    originX: enemy.x,
    originY: enemy.y,
    heading,
    length: 620,
    spread: kind === 'fan' ? 0.32 : 0,
    x: player.x,
    y: player.y,
    radius: kind === 'ground' ? 45 : 8,
    remaining: (profile?.attacks.warningSeconds ?? 1.2) + 1 / 60,
    damage: 20,
  };
}
export function overflightAttackContains(attack, x, y, radius = 9) {
  if (attack.kind === 'ground' || !attack.kind)
    return Math.hypot(x - attack.x, y - attack.y) <= attack.radius + radius;
  const dx = x - attack.originX,
    dy = y - attack.originY;
  const angles = attack.kind === 'fan' ? [-attack.spread, 0, attack.spread] : [0];
  return angles.some((offset, index) => {
    const angle = attack.heading + offset;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    return (
      along >= -radius &&
      along <= (attack.rayLengths?.[index] ?? attack.length) + radius &&
      Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= attack.radius + radius
    );
  });
}
/** Admit only if a baseline-speed straight escape remains inside the arena.
 * Existing committed geometry participates; boost availability never matters. */
function bodyClearPath(run, endX, endY, seconds) {
  if (
    !overflightTerrainClear(
      run.terrain,
      run.player.x,
      run.player.y,
      endX,
      endY,
      run.player.radius + 2,
    )
  )
    return false;
  const dx = endX - run.player.x,
    dy = endY - run.player.y;
  let clear = true;
  visitOverflightGrid(
    run._grid,
    (run.player.x + endX) / 2,
    (run.player.y + endY) / 2,
    Math.hypot(dx, dy) / 2 + 160 * seconds + run._maxEnemyRadius + run.player.radius,
    (enemy) => {
      if (!clear || enemy.warning > seconds) return;
      // Conservative relative sweep against the currently committed motion.
      const factor = (enemy.behaviorPhase === 'burst' ? 2 : 1) * enemy.speed;
      const vx = (enemy.behaviorPhase === 'burst' ? enemy._burstX : enemy.steeringX) * factor;
      const vy = (enemy.behaviorPhase === 'burst' ? enemy._burstY : enemy.steeringY) * factor;
      const rx = run.player.x - enemy.x,
        ry = run.player.y - enemy.y;
      const sx = dx - vx * seconds,
        sy = dy - vy * seconds;
      const t = Math.max(0, Math.min(1, -(rx * sx + ry * sy) / (sx * sx + sy * sy || 1)));
      if ((rx + sx * t) ** 2 + (ry + sy * t) ** 2 < (enemy.radius + run.player.radius + 2) ** 2)
        clear = false;
    },
  );
  return clear;
}

export function hasOverflightEscape(run, candidate) {
  const attacks = run.priorityAttacks.filter((a) => a.active).concat(candidate);
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    // Test each impact at its own time: the earliest warning must not mask a
    // later fan, and a new warning must never retarget after admission.
    const safe = attacks.every((attack) => {
      const speed = run.rulesVersion >= 3 ? slowestEscapeSpeed : 160;
      const travelSeconds =
        attack.stage === 'active'
          ? Math.min(candidate.remaining, attack.remaining)
          : Math.max(0, attack.remaining);
      const distance = Math.min(180, travelSeconds * speed);
      const x = run.player.x + Math.cos(angle) * distance;
      const y = run.player.y + Math.sin(angle) * distance;
      if (
        x < 18 ||
        y < 18 ||
        x > run.compiled.arena.width - 18 ||
        y > run.compiled.arena.height - 18
      )
        return false;
      if (overflightAttackContains(attack, x, y, run.player.radius + 8)) return false;
      if (run.rulesVersion >= 3) {
        if (!bodyClearPath(run, x, y, travelSeconds)) return false;
        if (attack.stage === 'active') {
          for (let sample = 0; sample <= 8; sample++)
            if (
              overflightAttackContains(
                attack,
                run.player.x + ((x - run.player.x) * sample) / 8,
                run.player.y + ((y - run.player.y) * sample) / 8,
                run.player.radius + 8,
              )
            )
              return false;
        }
      }
      return true;
    });
    if (safe) return true;
  }
  return false;
}
export function createOverflightCaches(compiled) {
  if (compiled.rulesVersion < 2 || !compiled.combat?.supplies.enabled) return [];
  return compiled.props.slice(0, 2).map((prop, index) => ({
    id: prop.id,
    x: prop.x,
    y: prop.y,
    state: 'dormant',
    guardIds: [],
    guardTarget: compiled.combat.supplies.guardCount,
    trigger: [90, 210][index],
    sector: index,
    selectedReward: null,
    armed: false,
    rewards: [
      ...(compiled.rulesVersion >= 3 &&
      compiled.combat.supplies.overdrive &&
      !compiled.sourceFormat?.startsWith('OverflightHunt')
        ? [
            {
              id: 'overdrive',
              x: Math.max(28, Math.min(compiled.arena.width - 28, prop.x)),
              y: Math.max(28, Math.min(compiled.arena.height - 28, prop.y + 52)),
              enabled: true,
            },
          ]
        : []),
      {
        id: 'repair',
        x: Math.max(28, Math.min(compiled.arena.width - 116, prop.x - 44)),
        y: Math.max(28, Math.min(compiled.arena.height - 28, prop.y)),
        enabled: true,
      },
      {
        id: 'recalibrate',
        x: Math.max(116, Math.min(compiled.arena.width - 28, prop.x + 44)),
        y: Math.max(28, Math.min(compiled.arena.height - 28, prop.y)),
        enabled: true,
      },
    ],
  }));
}

/** Authoring must not promise supplies hidden inside solid experimental cover.
 * Reuse native cache positions, including all available reward offsets. */
export function validateOverflightSupplyTerrain(project) {
  if (!project.terrain) return;
  const caches = createOverflightCaches({
    ...project,
    rulesVersion: 3,
    sourceFormat: project.format,
  });
  for (const cache of caches)
    for (const point of [cache, ...cache.rewards])
      if (
        !overflightTerrainClear(
          project.terrain,
          point.x,
          point.y,
          point.x,
          point.y,
          OVERFLIGHT_PLAYER_RADIUS,
        )
      )
        throw new TypeError(
          `Supply case ${cache.id} and every reward need drone clearance from experimental terrain.`,
        );
}
/** Finite physical rewards: no magnet, clock, modal or input binding. */
export function updateOverflightCaches(run, spawn, notify) {
  if (run.fixture || run.rulesVersion < 2 || run.phase !== 'playing') return;
  for (const cache of run.caches) {
    const due = run.hunt ? run.hunt.sector >= cache.sector : run.time >= cache.trigger;
    if (
      cache.state === 'dormant' &&
      due &&
      (run.rulesVersion < 3 ||
        !run.caches.some((other) => other !== cache && other.state === 'locked'))
    )
      cache.state = 'locked';
    if (cache.state === 'locked') {
      // A finite ordinary guard pack does not reserve scarce specialist slots.
      // Current rules admit the next opportunity only after this pack is cleared;
      // opened rewards can remain available without delaying the next encounter.
      while (cache.guardIds.length < cache.guardTarget) {
        const i = cache.guardIds.length,
          angle = (i * Math.PI * 2) / cache.guardTarget;
        const enemy = spawn({
          family: 'guard',
          x: cache.x + Math.cos(angle) * 65,
          y: cache.y + Math.sin(angle) * 65,
          hp: 45,
          speed: 55,
          warning: 1,
          behavior: 'patrol',
          pattern: 'pursuit',
          route: [
            {
              x: cache.x + Math.cos(angle) * 80,
              y: cache.y + Math.sin(angle) * 80,
            },
            {
              x: cache.x - Math.cos(angle) * 80,
              y: cache.y - Math.sin(angle) * 80,
            },
          ],
        });
        if (!enemy) break;
        enemy.cacheId = cache.id;
        cache.guardIds.push(enemy.id);
      }
      if (
        cache.guardIds.length === cache.guardTarget &&
        !run.enemies.some((enemy) => enemy.active && cache.guardIds.includes(enemy.id))
      ) {
        cache.state = 'open';
        cache.openedTick = run.tick;
        const prop = run.props?.find((p) => p.id === cache.id);
        if (prop) prop.open = true;
        notify('supply');
      }
    }
    if (cache.state !== 'open') continue;
    cache.rewards.find((r) => r.id === 'repair').enabled = run.player.hull < run.player.maxHull;
    const overdrive = cache.rewards.find((r) => r.id === 'overdrive');
    if (overdrive)
      overdrive.enabled = !run.hunt && !run.player.overdriveReady && !run.player.overdriveRemaining;
    cache.rewards.find((r) => r.id === 'recalibrate').enabled =
      run.progression.rerolls < run.compiled.combat.supplies.rerollCap ||
      run.player.boostCooldown > 0;
    // Require leaving the reward area after opening before deliberately flying
    // back in: a killing boost cannot accidentally spend the new reward.
    if (!cache.armed) {
      cache.armed = cache.rewards.every(
        (reward) => Math.hypot(run.player.x - reward.x, run.player.y - reward.y) > 28,
      );
      continue;
    }

    for (const reward of cache.rewards) {
      if (!reward.enabled || Math.hypot(run.player.x - reward.x, run.player.y - reward.y) > 21)
        continue;
      if (reward.id === 'repair')
        run.player.hull = Math.min(
          run.player.maxHull,
          run.player.hull + run.compiled.combat.supplies.repairHull,
        );
      else if (reward.id === 'overdrive') {
        run.player.overdriveReady = true;
        run._boostHeld = true;
      } else {
        run.progression.rerolls = Math.min(
          run.compiled.combat.supplies.rerollCap,
          run.progression.rerolls + 1,
        );
        run.player.boostCooldown = 0;
        run._boostHeld = true;
      }
      cache.state = 'claimed';
      cache.selectedReward = reward.id;
      run.stats.cachesClaimed = (run.stats.cachesClaimed ?? 0) + 1;
      notify('supply');
      break;
    }
  }
}
