const GOLD = 0xf4c765,
  OPEN = 0x9aebda,
  DANGER = 0xf9a275;
const layer = (frame, x, y, width, height, tint, alpha = 1, rotation = 0) => ({
  frame,
  x,
  y,
  width,
  height,
  tint,
  alpha,
  rotation,
});

/** Shared V2 geometry. Rendering never infers damage from an appearance family. */
export function overflightTacticalEnemyLayers(enemy, size = 24) {
  const layers = [];
  if (enemy.maxGuardIntegrity > 0) {
    const intact = enemy.guardIntegrity > 0;
    const heading = enemy.guardHeading ?? enemy.heading ?? 0;
    if (intact)
      for (let index = 0; index < 7; index++) {
        const angle = heading - Math.PI / 2 + (index * Math.PI) / 6;
        const radius = size * 0.65;
        layers.push(
          layer(
            'bar',
            enemy.x + Math.cos(angle) * radius,
            enemy.y + Math.sin(angle) * radius,
            size * 0.31,
            3,
            GOLD,
            1,
            angle + Math.PI / 2,
          ),
        );
      }
    const fraction = Math.max(0, Math.min(1, enemy.guardIntegrity / enemy.maxGuardIntegrity));
    layers.push(layer('bar', enemy.x, enemy.y - size * 0.78, 25, 5, 0x12241f));
    if (fraction)
      layers.push(
        layer('bar', enemy.x - 11 * (1 - fraction), enemy.y - size * 0.78, 22 * fraction, 3, GOLD),
      );
    else layers.push(layer('arrow', enemy.x, enemy.y - size * 0.7, 12, 12, OPEN, 1, Math.PI / 2));
  }
  if (enemy.maxArmor > 0) {
    const fraction = Math.max(0, Math.min(1, enemy.armor / enemy.maxArmor));
    const exposed = enemy.exposureRemaining > 0 || enemy.armor <= 0;
    layers.push(layer('bar', enemy.x, enemy.y - size * 0.68, 34, 6, 0x12241f));
    if (fraction)
      layers.push(
        layer('bar', enemy.x - 15 * (1 - fraction), enemy.y - size * 0.68, fraction * 30, 4, GOLD),
      );
    if (exposed)
      for (const side of [-1, 1])
        layers.push(
          layer(
            'arrow',
            enemy.x + side * size * 0.75,
            enemy.y,
            13,
            13,
            OPEN,
            1,
            side < 0 ? 0 : Math.PI,
          ),
        );
    else
      for (const side of [-1, 1])
        layers.push(
          layer('bar', enemy.x + side * size * 0.53, enemy.y, size * 0.7, 4, GOLD, 1, Math.PI / 2),
        );
  }
  return layers;
}

export function overflightAttackLayers(attack) {
  const layers = [],
    originX = attack.originX ?? attack.x,
    originY = attack.originY ?? attack.y;
  if (!['lane', 'fan'].includes(attack.kind))
    return [layer('ring', attack.x, attack.y, attack.radius * 2, attack.radius * 2, DANGER, 0.85)];
  const heading = attack.heading ?? 0,
    length = attack.length ?? 200;
  const ray = (angle) => {
    const half = attack.radius ?? 8;
    for (const side of [-1, 1]) {
      const x = originX - Math.sin(angle) * half * side,
        y = originY + Math.cos(angle) * half * side;
      layers.push(
        layer(
          'bar',
          x + (Math.cos(angle) * length) / 2,
          y + (Math.sin(angle) * length) / 2,
          length,
          2,
          DANGER,
          0.9,
          angle,
        ),
      );
    }
    layers.push(
      layer(
        'arrow',
        originX + Math.cos(angle) * length,
        originY + Math.sin(angle) * length,
        14,
        14,
        DANGER,
        1,
        angle,
      ),
    );
  };
  if (attack.kind === 'lane') ray(heading);
  else
    for (const offset of [-(attack.spread ?? 0.32), 0, attack.spread ?? 0.32])
      ray(heading + offset);
  return layers;
}

export function overflightCacheLayers(cache) {
  if (cache.state !== 'open') return [];
  return cache.rewards.flatMap((reward) => {
    const repair = reward.id === 'repair',
      tint = reward.enabled ? (repair ? OPEN : GOLD) : 0x667268;
    const layers = [layer('ring', reward.x, reward.y, 35, 35, tint, 0.85)];
    if (repair) {
      layers.push(layer('bar', reward.x, reward.y, 17, 4, tint));
      layers.push(layer('bar', reward.x, reward.y, 4, 17, tint));
    } else {
      layers.push(layer('arrow', reward.x, reward.y - 4, 14, 14, tint));
      layers.push(layer('arrow', reward.x, reward.y + 5, 14, 14, tint, 1, Math.PI));
    }
    return layers;
  });
}
