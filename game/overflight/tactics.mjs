import { overflightTerrainClear, overflightTerrainWaypoint } from './terrain.mjs';
import { overflightHarmfulBody, overflightMotionLeg } from './motion.mjs';
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
/** Relative sweeps include Raid's actual velocity and harmful contact rules.
 * A committed leg may stop, so sweep its moving and settled portions separately. */
function bodyClearPath(run, from, to, seconds, startTime = 0) {
  // Match physical cover clearance: an inflated radius makes every direction
  // start inside cover when the real hull legitimately rests against a wall.
  if (!overflightTerrainClear(run.terrain, from.x, from.y, to.x, to.y, run.player.radius))
    return false;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  let clear = true;
  visitOverflightGrid(
    run._grid,
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    Math.hypot(dx, dy) / 2 + 360 * (startTime + seconds) + run._maxEnemyRadius + run.player.radius,
    (enemy) => {
      if (!clear || enemy.warning > startTime + seconds) return;
      const override = run._motionOverride?.enemy === enemy ? run._motionOverride.velocity : null;
      const leg = overflightMotionLeg(enemy, startTime + seconds, override);
      const cuts = [
        startTime,
        Math.max(startTime, Math.min(startTime + seconds, leg.duration)),
        startTime + seconds,
      ];
      for (let i = 0; i < 2 && clear; i++) {
        const begin = cuts[i],
          end = cuts[i + 1];
        if (end <= begin) continue;
        const pa = (begin - startTime) / (seconds || 1),
          pb = (end - startTime) / (seconds || 1);
        const ex = enemy.x + leg.x * Math.min(begin, leg.duration);
        const ey = enemy.y + leg.y * Math.min(begin, leg.duration);
        const px = from.x + dx * pa,
          py = from.y + dy * pa;
        const sx =
          dx * (pb - pa) - leg.x * (Math.min(end, leg.duration) - Math.min(begin, leg.duration));
        const sy =
          dy * (pb - pa) - leg.y * (Math.min(end, leg.duration) - Math.min(begin, leg.duration));
        const rx = px - ex,
          ry = py - ey;
        const radius = enemy.radius + run.player.radius + 2;
        const a = sx * sx + sy * sy;
        const b = rx * sx + ry * sy;
        const c = rx * rx + ry * ry - radius * radius;
        // Facing matters at first contact. Testing the closest point could put
        // a sweep at the body's centre and incorrectly call its front exposed.
        const discriminant = b * b - a * c;
        if (c > 0 && (a === 0 || discriminant < 0)) continue;
        const t = c <= 0 ? 0 : (-b - Math.sqrt(discriminant)) / a;
        if (
          t >= 0 &&
          t <= 1 &&
          overflightHarmfulBody(
            enemy,
            px + dx * (pb - pa) * t,
            py + dy * (pb - pa) * t,
            ex + leg.x * (Math.min(end, leg.duration) - Math.min(begin, leg.duration)) * t,
            ey + leg.y * (Math.min(end, leg.duration) - Math.min(begin, leg.duration)) * t,
          )
        )
          clear = false;
      }
    },
  );
  return clear;
}

function escapeAlong(run, attacks, points) {
  const speed = run.rulesVersion >= 3 ? slowestEscapeSpeed : 160;
  return attacks.every((attack) => {
    const seconds = Math.max(0, attack.remaining);
    let remaining = Math.min(180, seconds * speed),
      elapsed = 0;
    let from = { x: run.player.x, y: run.player.y };
    for (const point of points) {
      const length = Math.hypot(point.x - from.x, point.y - from.y);
      const distance = Math.min(remaining, length);
      const to = length
        ? {
            x: from.x + ((point.x - from.x) * distance) / length,
            y: from.y + ((point.y - from.y) * distance) / length,
          }
        : from;
      const duration = distance / speed;
      if (
        to.x < 18 ||
        to.y < 18 ||
        to.x > run.compiled.arena.width - 18 ||
        to.y > run.compiled.arena.height - 18
      )
        return false;
      if (run.rulesVersion >= 3 && !bodyClearPath(run, from, to, duration, elapsed)) return false;
      if (attack.stage === 'active') {
        for (let sample = 0; sample <= 8; sample++)
          if (
            overflightAttackContains(
              attack,
              from.x + ((to.x - from.x) * sample) / 8,
              from.y + ((to.y - from.y) * sample) / 8,
              run.player.radius + 8,
            )
          )
            return false;
      }
      elapsed += duration;
      remaining -= distance;
      from = to;
      if (remaining <= 1e-9) break;
    }
    if (overflightAttackContains(attack, from.x, from.y, run.player.radius + 8)) return false;
    // An escape may reach its endpoint before a later impact. Bodies still move
    // during that wait; stopping at a safe point must not mask a later crossing.
    return (
      run.rulesVersion < 3 ||
      seconds <= elapsed ||
      bodyClearPath(run, from, from, seconds - elapsed, elapsed)
    );
  });
}

/** No-boost admission shares committed motion with runtime. For V4 cover,
 * a bounded two-leg navigation route supplements the 24 direct escape rays. */
export function hasOverflightEscape(run, candidate = null, stopOwner = null) {
  if (stopOwner) {
    const previous = run._motionOverride;
    run._motionOverride = { enemy: stopOwner, velocity: { x: 0, y: 0 } };
    try {
      return hasOverflightEscape(run, candidate);
    } finally {
      run._motionOverride = previous;
    }
  }
  const attacks = run.priorityAttacks.filter((a) => a.active);
  if (candidate) attacks.push(candidate);
  if (!attacks.length) return true;
  const origin = {
    x: run.player.x,
    y: run.player.y,
    radius: run.player.radius,
  };
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    const goal = {
      x: origin.x + Math.cos(angle) * 180,
      y: origin.y + Math.sin(angle) * 180,
    };
    if (escapeAlong(run, attacks, [goal])) return true;
  }
  if (run.rulesVersion >= 4 && run.terrain) {
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const goal = {
        x: Math.max(18, Math.min(run.compiled.arena.width - 18, origin.x + Math.cos(angle) * 180)),
        y: Math.max(18, Math.min(run.compiled.arena.height - 18, origin.y + Math.sin(angle) * 180)),
      };
      const via = overflightTerrainWaypoint(run.terrain, origin, goal, run.compiled.arena);
      if (via !== goal && escapeAlong(run, attacks, [via, goal])) return true;
    }
  }
  return false;
}

/** A new coordinated leg may not silently invalidate a live warned escape. */
export function admitOverflightMotion(run, enemy, velocity) {
  if (run.rulesVersion < 4 || !run.priorityAttacks.some((attack) => attack.active)) return true;
  const previous = run._motionOverride;
  run._motionOverride = { enemy, velocity };
  try {
    const admitted = hasOverflightEscape(run);
    if (!admitted) run.stats.motionDeferrals = (run.stats.motionDeferrals ?? 0) + 1;
    return admitted;
  } finally {
    run._motionOverride = previous;
  }
}
/** Facing/exposure changes alter Raid's harmful body shape too. */
export function admitOverflightBodyState(run, enemy, changes) {
  if (run.rulesVersion < 4 || !run.priorityAttacks.some((attack) => attack.active)) return true;
  const before = Object.fromEntries(Object.keys(changes).map((key) => [key, enemy[key]]));
  Object.assign(enemy, changes);
  try {
    const admitted = hasOverflightEscape(run);
    if (!admitted) run.stats.motionDeferrals = (run.stats.motionDeferrals ?? 0) + 1;
    return admitted;
  } finally {
    Object.assign(enemy, before);
  }
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
