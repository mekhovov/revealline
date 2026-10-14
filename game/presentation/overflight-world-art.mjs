import { paintOverflightWorldV2, overflightWorldSourceFrame } from './overflight-world-art-v2.mjs';
import {
  industrialMaterialPixels,
  INDUSTRIAL_ENVIRONMENT_REVISION,
} from './industrial-materials.mjs';
import { overflightWorldDefinition } from '../overflight/worlds.mjs';
import {
  OVERFLIGHT_WORLD_MATERIAL_SLOTS,
  OVERFLIGHT_WORLD_PROP_SLOTS,
} from './overflight-world-slots.mjs';

const materialFrames = new Map();
function materialFrame(material) {
  if (!materialFrames.has(material))
    materialFrames.set(
      material,
      industrialMaterialPixels({ width: 32, height: 32 }, material, {
        revision: INDUSTRIAL_ENVIRONMENT_REVISION,
      }),
    );
  return materialFrames.get(material);
}
const box = (ctx, color, x, y, width, height) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
};

/** One-time native pixel painting. Decorative regions deliberately omit the
 * industrial tile borders that signify damaging/slowing terrain in other modes. */
export function paintOverflightWorld(
  ctx,
  presentation,
  arena,
  { scale = 1, image = () => null } = {},
) {
  const world = overflightWorldDefinition(presentation?.world);
  if (!world) return false;
  if (presentation.format === 'OverflightWorldPresentationV2')
    return paintOverflightWorldV2(ctx, presentation, arena, world, { scale, image });
  const [base, low, mid, high] = world.palette;
  ctx.save();
  ctx.scale(scale, scale);
  box(ctx, base, 0, 0, arena.width, arena.height);
  for (const region of presentation.regions) {
    const customMaterial = image(OVERFLIGHT_WORLD_MATERIAL_SLOTS[region.material]);
    if (customMaterial?.image) {
      const frame = overflightWorldSourceFrame(customMaterial);
      for (let y = 0; y < region.height; y += 32)
        for (let x = 0; x < region.width; x += 32) {
          const w = Math.min(32, region.width - x),
            h = Math.min(32, region.height - y);
          ctx.drawImage(
            customMaterial.image,
            frame.x,
            frame.y,
            (frame.width * w) / 32,
            (frame.height * h) / 32,
            region.x + x,
            region.y + y,
            w,
            h,
          );
        }
      continue;
    }
    // Broken edges read as material changes, not rectangular collision walls.
    for (let strip = 0; strip < region.height; strip += 16) {
      const inset = ((Math.floor(strip / 16) * 7) % 5) * 3;
      box(
        ctx,
        low,
        region.x + inset,
        region.y + strip,
        region.width - inset * 2,
        Math.min(16, region.height - strip),
      );
    }
    ctx.globalAlpha = 0.12;
    if (region.material === 'earth') {
      for (let row = 35; row < region.height - 20; row += 67)
        for (let step = 15; step < region.width - 30; step += 39)
          box(ctx, high, region.x + step, region.y + row + (step % 5), 27, 2);
    } else {
      for (let row = 112; row < region.height; row += 128)
        box(ctx, base, region.x + 12, region.y + row, region.width - 24, 2);
      for (let column = 120; column < region.width; column += 144)
        box(ctx, base, region.x + column, region.y + 12, 2, region.height - 24);
    }
    ctx.globalAlpha = 1;
    const sample = materialFrame(region.material);
    ctx.globalAlpha = 0.11;
    for (let y = 8; y < region.height - 8; y += 19)
      for (let x = 8; x < region.width - 8; x += 23) {
        const u = (x * 7 + y * 11) % 32,
          v = (x * 3 + y * 13) % 32,
          at = (v * 32 + u) * 4;
        box(
          ctx,
          `rgb(${sample.rgba[at]},${sample.rgba[at + 1]},${sample.rgba[at + 2]})`,
          region.x + x,
          region.y + y,
          2 + (x % 5),
          1 + (y % 3),
        );
      }
    ctx.globalAlpha = 1;
  }
  for (const item of presentation.landmarks) {
    const { kind, x, y, width: w, height: h } = item;
    const customProp = image(OVERFLIGHT_WORLD_PROP_SLOTS[kind]);
    if (customProp?.image) {
      const frame = overflightWorldSourceFrame(customProp);
      ctx.drawImage(customProp.image, frame.x, frame.y, frame.width, frame.height, x, y, w, h);
      continue;
    }
    if (kind === 'road') {
      box(ctx, '#1c2524', x, y, w, h);
      box(ctx, low, x, y + 6, w, h - 12);
      box(ctx, '#252e2a', x, y + h * 0.27, w, 12);
      box(ctx, '#252e2a', x, y + h * 0.68, w, 10);
      for (let i = 38; i < w - 20; i += 123) {
        box(ctx, mid, x + i, y + h / 2, 34, 3);
        box(ctx, '#1e2825', x + i + 53, y + h * 0.3, 14, 3);
        box(ctx, '#1e2825', x + i + 60, y + h * 0.3 + 3, 3, 12);
        box(ctx, base, x + i + 31, y, 21, 8 + (i % 7));
        box(ctx, mid, x + i + 23, y + 7, 9, 3);
        box(ctx, base, x + i + 8, y + h - 10, 31, 10);
      }
    } else if (kind === 'tracks') {
      box(ctx, mid, x, y, w, h);
      for (const factor of [0.21, 0.71]) {
        box(ctx, low, x + w * factor, y, w * 0.13, h);
        for (let step = 0; step < h; step += 18)
          box(ctx, high, x + w * factor, y + step, w * 0.13, 2);
      }
    } else if (kind === 'rail') {
      for (let step = 4; step < w; step += 24) {
        box(ctx, '#1d2524', x + step + 3, y + 3, 11, h);
        box(ctx, '#514b38', x + step, y, 8, h - 4);
      }
      for (const factor of [0.23, 0.71]) {
        box(ctx, '#1b2526', x, y + h * factor, w, 6);
        box(ctx, '#6d766b', x, y + h * factor, w, 2);
      }
    } else if (kind === 'foundation') {
      box(ctx, low, x, y, w, h);
      for (let step = 0; step < w; step += 24) {
        box(ctx, mid, x + step, y, 18, 5);
        box(ctx, '#1c2729', x + step, y + h - 5, 18, 5);
      }
      for (let step = 10; step < h - 8; step += 24) {
        box(ctx, mid, x, y + step, 5, 15);
        box(ctx, '#1c2729', x + w - 5, y + step, 5, 15);
      }
      box(ctx, mid, x + w * 0.6, y + h * 0.2, 18, 3);
      box(ctx, '#202b2c', x + w * 0.35, y + h * 0.5, 3, h * 0.25);
    } else if (kind === 'crater') {
      box(ctx, mid, x + 8, y, w - 16, h);
      box(ctx, mid, x, y + 7, w, h - 14);
      box(ctx, '#20291f', x + 6, y + 7, w - 12, h - 13);
      box(ctx, '#161f1c', x + 14, y + 11, w - 28, h - 19);
      box(ctx, high, x + 8, y + 2, w * 0.4, 2);
    } else if (kind === 'tree') {
      box(ctx, '#14211d', x + 9, y + 9, w - 3, h - 3);
      box(ctx, '#19291e', x + 3, y + 5, w - 9, h - 12);
      box(ctx, '#30402a', x + 9, y, w - 20, h - 9);
      box(ctx, '#3c4a2e', x + 11, y + 4, w - 24, h * 0.25);
      box(ctx, '#263923', x + w * 0.5, y + h * 0.5, w * 0.4, h * 0.4);
      box(ctx, '#6b5b3b', x + w * 0.45, y + h - 8, 5, 10);
    } else if (kind === 'container') {
      box(ctx, '#172425', x + 6, y + 7, w, h);
      box(ctx, '#635341', x, y, w, h);
      box(ctx, '#80715a', x, y, w, 3);
      box(ctx, '#403f34', x, y + h - 9, w, 9);
      for (let step = 8; step < w - 8; step += 10) {
        box(ctx, '#74634a', x + step, y + 5, 2, h - 17);
        box(ctx, '#504838', x + step + 2, y + 5, 2, h - 17);
      }
      box(ctx, '#9b9470', x + 8, y + 11, 13, 6);
    } else if (kind === 'antenna') {
      box(ctx, '#182327', x + 8, y + h - 15, w, 20);
      box(ctx, '#525e55', x, y + h - 22, w, 22);
      box(ctx, '#7b8673', x + w / 2 - 2, y, 4, h - 15);
      for (let step = 7; step < h - 18; step += 12) {
        box(ctx, '#73836f', x + 9, y + step, w - 18, 3);
        box(ctx, '#384841', x + 9, y + step + 3, w - 18, 2);
      }
      box(ctx, '#a7a278', x + w / 2 - 3, y, 6, 4);
    } else if (kind === 'rubble') {
      for (let i = 0; i < 7; i++) {
        const dx = (i * 17) % Math.max(1, w - 12),
          dy = (i * 13) % Math.max(1, h - 10);
        box(ctx, '#1b2629', x + dx + 2, y + dy + 3, 11, 7);
        box(ctx, i % 2 ? mid : high, x + dx, y + dy, 10, 5);
      }
    }
  }
  ctx.restore();
  return true;
}
