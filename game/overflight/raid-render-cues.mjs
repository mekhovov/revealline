import { overflightHuntParameters } from './raid-upgrades.mjs';
const OPEN = 0x9aebda,
  GUARDED = 0xf9a275,
  OBJECTIVE = 0xf4c765;
/** Same structural cues in both quality modes: facing plates, open brackets,
 * discrete armor and objective chevrons. Colors supplement the geometry. */
export function overflightHuntEnemyLayers(enemy, size = 24) {
  const layers = [];
  const add = (frame, dx, dy, width, height, tint, rotation = 0) =>
    layers.push({ frame, dx, dy, width, height, tint, rotation });
  const heading = enemy.heading ?? 0;
  const protectedState = ['guarded', 'machinery-guarded'].includes(enemy.contactState);
  if (enemy.behavior === 'shield' && !enemy.maxGuardIntegrity) {
    const reach = size * 0.52;
    add(
      'bar',
      Math.cos(heading) * reach,
      Math.sin(heading) * reach,
      3,
      size * 0.8,
      GUARDED,
      heading,
    );
    for (const side of [-1, 1])
      add(
        'bar',
        Math.cos(heading) * reach + Math.cos(heading + Math.PI / 2) * side * size * 0.33,
        Math.sin(heading) * reach + Math.sin(heading + Math.PI / 2) * side * size * 0.33,
        6,
        3,
        GUARDED,
        heading,
      );
  } else if (enemy.contactState && !enemy.maxGuardIntegrity) {
    if (protectedState) {
      add('bar', 0, size * 0.4, size * 0.7, 3, GUARDED);
      add('bar', 0, -size * 0.4, size * 0.7, 3, GUARDED);
    } else if (enemy.maxArmorSegments > 0) {
      for (const side of [-1, 1]) {
        add('bar', side * size * 0.6, 0, 2, size * 0.65, OPEN);
        add('arrow', side * size * 0.82, 0, 12, 12, OPEN, side === -1 ? 0 : Math.PI);
      }
    }
  }
  if (enemy.maxArmorSegments > 0) {
    const total = Math.min(3, enemy.maxArmorSegments);
    for (let index = 0; index < total; index++)
      add(
        'bar',
        (index - (total - 1) / 2) * 12,
        -size * 0.65,
        9,
        4,
        index < enemy.armorSegments ? (protectedState ? GUARDED : OPEN) : 0x4b564b,
      );
  }
  if (enemy.objectiveId) add('arrow', 0, -size * 0.8 - 8, 14, 14, OBJECTIVE, Math.PI / 2);
  if (enemy.behavior === 'courier')
    add('pickup.salvage-cluster', -size * 0.65, 0, 12, 12, OBJECTIVE);
  return layers;
}

/** The attack reaches beyond the body only during boost. Short side streaks
 * visualize its actual width; there is never a permanent enclosing halo. */
export function overflightHuntStrikeLayers(run) {
  if (!run.hunt || run.player.boostRemaining <= 0) return [];
  const player = run.player,
    heading = player.heading ?? 0;
  const reach = player.radius * overflightHuntParameters(run.build).strikeWidth;
  return [-1, 1].map((side) => ({
    frame: 'bar',
    dx: Math.cos(heading) * 5 - Math.sin(heading) * reach * side,
    dy: Math.sin(heading) * 5 + Math.cos(heading) * reach * side,
    width: 20,
    height: 2,
    tint: run.hunt.rushRemaining > 0 ? OBJECTIVE : OPEN,
    alpha: 0.8,
    rotation: heading,
  }));
}
