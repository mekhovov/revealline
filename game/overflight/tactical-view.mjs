import { insideOverflightCamera } from './benchmark.mjs';

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

/** Pending friendly impacts stay at their released positions, including echoes.
 * These light footprints are below hostile warnings and never predict a hit. */
export function overflightPendingPayloadLayers(payload) {
  if (!payload.active || payload.remaining <= 0) return [];
  const result = [];
  const alpha = 0.18 + 0.18 * (1 - Math.min(1, payload.remaining / 0.85));
  for (let index = 0; index < payload.count; index++) {
    const offset = (index - (payload.count - 1) / 2) * payload.spacing;
    const x = payload.x - Math.sin(payload.heading) * offset;
    const y = payload.y + Math.cos(payload.heading) * offset;
    result.push(layer('ring', x, y, payload.radius * 2, payload.radius * 2, GOLD, alpha));
    result.push(layer('bar', x, y, 4, 4, GOLD, 0.6));
  }
  return result;
}

/** At most three actual links; reduced effects retains every affected target. */
export function overflightEscortShotLayers(escort, reduced = false) {
  if (escort.beamRemaining <= 0) return [];
  const segments = escort.shotSegments
    ? escort.shotSegments.slice(0, escort.shotSegmentCount)
    : [escort];
  const tint = escort.role === 'sweeper' ? 0x9aebda : GOLD;
  return segments.map((segment) => {
    const dx = segment.targetX - segment.x,
      dy = segment.targetY - segment.y;
    return layer(
      'bar',
      segment.x + dx / 2,
      segment.y + dy / 2,
      Math.hypot(dx, dy),
      2,
      tint,
      reduced ? 0.45 : 0.8,
      Math.atan2(dy, dx),
    );
  });
}

/** One persistent final objective, visually distinct from transient attack arrows. */
export function overflightFinalTargetLayers(enemy, camera, frame) {
  if (!enemy.active) return [];
  const offscreen = !insideOverflightCamera(enemy.x, enemy.y - 47, camera, -60);
  const dx = enemy.x - camera.x,
    dy = enemy.y - camera.y;
  const amount = Math.min(
    (camera.width / 2 - 48) / Math.max(Math.abs(dx), 0.01),
    (camera.height / 2 - 80) / Math.max(Math.abs(dy), 0.01),
  );
  const x = offscreen ? camera.x + dx * amount : enemy.x;
  const y = offscreen ? camera.y + dy * amount : enemy.y - 47;
  const result = [];
  if (offscreen) {
    result.push(layer('bar', x, y, 28, 28, 0x09120f, 0.94, Math.PI / 4));
    result.push(layer(frame, x, y, 23, 23, 0xffffff));
    const angle = Math.atan2(dy, dx);
    result.push(
      layer('arrow', x + Math.cos(angle) * 29, y + Math.sin(angle) * 29, 17, 17, GOLD, 1, angle),
    );
  }
  const radius = offscreen ? 18 : 7;
  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    result.push(
      layer(
        'bar',
        x + (sx * radius) / 2,
        y + (sy * radius) / 2,
        radius * Math.SQRT2,
        2,
        GOLD,
        1,
        (-sx * sy * Math.PI) / 4,
      ),
    );
  return result;
}

/** Shared V2 geometry. Rendering never infers damage from an appearance family. */
export function overflightTacticalEnemyLayers(enemy, size = 24, player = null) {
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
    // Distant ordinary armor stays legible without enclosing the whole crowd
    // in large brackets. Ease to full detail before contact; priority targets
    // and Raid (no player context) always keep the complete approach geometry.
    const priority = enemy.heavy || enemy.objectiveId || ['elite', 'final'].includes(enemy.role);
    const detail =
      !player || priority
        ? 1
        : Math.max(
            0,
            Math.min(1, (240 - Math.hypot(enemy.x - player.x, enemy.y - player.y)) / 100),
          );
    const mix = (compact, full) => compact + (full - compact) * detail;
    const width = mix(14, 30),
      barY = enemy.y - size * mix(0.48, 0.68);
    const fraction = Math.max(0, Math.min(1, enemy.armor / enemy.maxArmor));
    const exposed = enemy.exposureRemaining > 0 || enemy.armor <= 0;
    layers.push(layer('bar', enemy.x, barY, width + mix(2, 4), mix(3, 6), 0x12241f));
    if (fraction)
      layers.push(
        layer(
          'bar',
          enemy.x - (width / 2) * (1 - fraction),
          barY,
          fraction * width,
          mix(2, 4),
          GOLD,
        ),
      );
    if (exposed)
      for (const side of [-1, 1])
        layers.push(
          layer(
            'arrow',
            enemy.x + side * size * mix(0.46, 0.75),
            enemy.y,
            mix(8, 13),
            mix(8, 13),
            OPEN,
            1,
            side < 0 ? 0 : Math.PI,
          ),
        );
    else
      for (const side of [-1, 1])
        layers.push(
          layer(
            'bar',
            enemy.x + side * size * mix(0.4, 0.53),
            enemy.y,
            size * mix(0.24, 0.7),
            mix(2, 4),
            GOLD,
            1,
            Math.PI / 2,
          ),
        );
  }
  return layers;
}

export function overflightAttackLayers(attack) {
  const layers = [],
    originX = attack.originX ?? attack.x,
    originY = attack.originY ?? attack.y;
  if (!['lane', 'fan'].includes(attack.kind)) {
    const result = [
      layer('ring', attack.x, attack.y, attack.radius * 2, attack.radius * 2, DANGER, 0.85),
    ];
    if (attack.kind === 'ground' && attack.stage === 'active') {
      // A solid cross-hatched patch differs from its outline-only warning even
      // without color or animation. The drawing stays inside damage geometry.
      for (const fraction of [-0.6, -0.3, 0, 0.3, 0.6]) {
        const offset = attack.radius * fraction;
        const width = Math.sqrt(Math.max(0, attack.radius ** 2 - offset ** 2)) * 2;
        result.push(layer('bar', attack.x, attack.y + offset, width, 3, DANGER, 0.55));
      }
      result.push(layer('bar', attack.x, attack.y, 4, attack.radius * 1.5, DANGER, 0.9));
    }
    return result;
  }
  const heading = attack.heading ?? 0,
    length = attack.length ?? 200;
  const ray = (angle, rayIndex = 0) => {
    const rayLength = attack.rayLengths?.[rayIndex] ?? length;
    if (rayLength <= 0) return;
    const half = attack.radius ?? 8;
    for (const side of [-1, 1]) {
      const x = originX - Math.sin(angle) * half * side,
        y = originY + Math.cos(angle) * half * side;
      layers.push(
        layer(
          'bar',
          x + (Math.cos(angle) * rayLength) / 2,
          y + (Math.sin(angle) * rayLength) / 2,
          rayLength,
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
        originX + Math.cos(angle) * rayLength,
        originY + Math.sin(angle) * rayLength,
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
    for (const [index, offset] of [-(attack.spread ?? 0.32), 0, attack.spread ?? 0.32].entries())
      ray(heading + offset, index);
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
    } else if (reward.id === 'overdrive') {
      for (const offset of [-7, 0, 7])
        layers.push(layer('arrow', reward.x + offset, reward.y, 12, 12, tint, 1, -Math.PI / 2));
    } else {
      layers.push(layer('arrow', reward.x, reward.y - 4, 14, 14, tint));
      layers.push(layer('arrow', reward.x, reward.y + 5, 14, 14, tint, 1, Math.PI));
    }
    return layers;
  });
}
