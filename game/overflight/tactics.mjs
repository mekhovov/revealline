/** Shared, deterministic combat rules for Overflight V2. No renderer or clock owner. */
export const OVERFLIGHT_DIFFICULTIES = Object.freeze(['standard', 'veteran']);
export function seededOverflightRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}
export function overflightFormationSchedule(seed, difficulty, encounterSet) {
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
    const pattern = start === 0 && difficulty === 'standard' ? 'pursuit' : deck.shift();
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
  return { damage: damage - blocked, blocked, broken: enemy.guardIntegrity === 0 };
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
  return angles.some((offset) => {
    const angle = attack.heading + offset;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    return (
      along >= -radius &&
      along <= attack.length + radius &&
      Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= attack.radius + radius
    );
  });
}
/** Admit only if a baseline-speed straight escape remains inside the arena.
 * Existing committed geometry participates; boost availability never matters. */
export function hasOverflightEscape(run, candidate) {
  const attacks = run.priorityAttacks.filter((a) => a.active).concat(candidate);
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    // Test each impact at its own time: the earliest warning must not mask a
    // later fan, and a new warning must never retarget after admission.
    const safe = attacks.every((attack) => {
      const distance = Math.min(180, Math.max(0, attack.remaining) * 160);
      const x = run.player.x + Math.cos(angle) * distance;
      const y = run.player.y + Math.sin(angle) * distance;
      if (
        x < 18 ||
        y < 18 ||
        x > run.compiled.arena.width - 18 ||
        y > run.compiled.arena.height - 18
      )
        return false;
      return !overflightAttackContains(attack, x, y, run.player.radius + 8);
    });
    if (safe) return true;
  }
  return false;
}
export function createOverflightCaches(compiled) {
  if (compiled.rulesVersion !== 2 || !compiled.combat?.supplies.enabled) return [];
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
/** Finite physical rewards: no magnet, clock, modal or input binding. */
export function updateOverflightCaches(run, spawn, notify) {
  if (run.fixture || run.rulesVersion !== 2 || run.phase !== 'playing') return;
  for (const cache of run.caches) {
    const due = run.hunt ? run.hunt.sector >= cache.sector : run.time >= cache.trigger;
    if (cache.state === 'dormant' && due) cache.state = 'locked';
    if (cache.state === 'locked') {
      // An authored finite ordinary pack stays finite and does not reserve scarce
      // specialist slots or prevent the other independent cache appearing.
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
            { x: cache.x + Math.cos(angle) * 80, y: cache.y + Math.sin(angle) * 80 },
            { x: cache.x - Math.cos(angle) * 80, y: cache.y - Math.sin(angle) * 80 },
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
    cache.rewards[0].enabled = run.player.hull < run.player.maxHull;
    cache.rewards[1].enabled =
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
      else {
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
