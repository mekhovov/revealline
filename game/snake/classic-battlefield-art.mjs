import {
  createOverflightWorldPresentation,
  overflightWorldDefinition,
} from '../overflight/worlds.mjs';
import { paintOverflightWorld } from '../presentation/overflight-world-art.mjs';

/** An explicit Snake appearance reuses the original world source. No level,
 * collision cell, accepted skin, replay setting or RNG is changed. */
export function classicBattlefieldWorld(scene) {
  return (
    {
      orchard: 'field-crossing',
      quarry: 'field-crossing',
      workshop: 'freight-depot',
      freight: 'freight-depot',
      harbor: 'relay-ruins',
      relay: 'relay-ruins',
    }[scene] ?? 'field-crossing'
  );
}

export function classicBattlefieldPalette(scene) {
  const world = overflightWorldDefinition(classicBattlefieldWorld(scene));
  const rgb = (value) => [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return {
    field: world.palette[0],
    alternate: world.palette[1],
    grid: world.palette[2],
    material: world.material,
    tint: rgb(world.palette[0]),
    wallTint: rgb(world.palette[3]),
  };
}

export function drawClassicBattlefield(ctx, scene, width, height, { backdrop = false } = {}) {
  // Paint in the source world's own units to retain pixel proportions; only the
  // final canvas mapping changes. Tall landmarks remain outside playable cells.
  const arena = { width: 2880, height: 1080 },
    presentation = createOverflightWorldPresentation(classicBattlefieldWorld(scene), arena);
  if (!backdrop)
    presentation.landmarks = presentation.landmarks.filter(
      (entry) => !['tree', 'container', 'antenna'].includes(entry.kind),
    );
  ctx.save();
  ctx.scale(width / arena.width, height / arena.height);
  paintOverflightWorld(ctx, presentation, arena);
  ctx.restore();
}
