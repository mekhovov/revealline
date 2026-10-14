import { drawClassicStructureModule } from '../snake/classic-structure-art.mjs';
import { OVERFLIGHT_WORLD_KITS } from '../overflight/world-layout-presentation.mjs';
import {
  industrialMaterialPixels,
  INDUSTRIAL_ENVIRONMENT_REVISION,
} from './industrial-materials.mjs';
import {
  OVERFLIGHT_WORLD_MATERIAL_SLOTS,
  OVERFLIGHT_WORLD_PROP_SLOTS,
  OVERFLIGHT_WORLD_ASSEMBLY_SLOTS,
} from './overflight-world-slots.mjs';

const box = (ctx, color, x, y, width, height) => {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
};
const materialFrames = new Map();
const materialFrame = (material, variant) => {
  const key = `${material}:${variant}`;
  if (!materialFrames.has(key))
    materialFrames.set(
      key,
      industrialMaterialPixels({ width: 32, height: 32 }, material, {
        revision: INDUSTRIAL_ENVIRONMENT_REVISION,
        variant,
      }),
    );
  return materialFrames.get(key);
};
const familyScene = {
  shelter: 'relay',
  planter: 'orchard',
  container: 'freight',
  dispatch: 'freight',
  antenna: 'relay',
  receiver: 'relay',
  pump: 'harbor',
  floodgate: 'harbor',
  terrace: 'quarry',
  reclaimer: 'quarry',
  glasshouse: 'orchard',
  irrigator: 'orchard',
};

/** Hosts crop static frames once; Studio may provide the original atlas bitmap. */
export function overflightWorldSourceFrame(source) {
  const frame = source.geometry?.frame ?? { x: 0, y: 0, width: 32, height: 32 };
  const width = source.image?.naturalWidth ?? source.image?.width,
    height = source.image?.naturalHeight ?? source.image?.height;
  return width === frame.width && height === frame.height ? { ...frame, x: 0, y: 0 } : frame;
}

/** Native-sized art preserves authored crop/pivot/occupied bounds. It never
 * stretches a single small source over a whole building or a long path. */
export function drawOverflightWorldModuleImage(ctx, source, x, y, size = 28) {
  if (!source?.image) return false;
  const frame = overflightWorldSourceFrame(source),
    pivot = source.geometry?.pivot ?? { x: 0.5, y: 0.5 },
    occupied = source.geometry?.occupiedBounds ?? { x: 0, y: 0, width: 1, height: 1 },
    scale = size / Math.max(frame.width, frame.height);
  ctx.drawImage(
    source.image,
    frame.x + occupied.x * frame.width,
    frame.y + occupied.y * frame.height,
    occupied.width * frame.width,
    occupied.height * frame.height,
    x + (occupied.x - pivot.x) * frame.width * scale,
    y + (occupied.y - pivot.y) * frame.height * scale,
    occupied.width * frame.width * scale,
    occupied.height * frame.height * scale,
  );
  return true;
}
function material(ctx, region, world, image) {
  const [base, low, , high] = world.palette,
    custom = image(OVERFLIGHT_WORLD_MATERIAL_SLOTS[region.material]);
  box(ctx, region.variant % 2 ? base : low, region.x, region.y, region.width, region.height);
  if (custom?.image) {
    const frame = overflightWorldSourceFrame(custom);
    for (let y = 0; y < region.height; y += 32)
      for (let x = 0; x < region.width; x += 32) {
        const width = Math.min(32, region.width - x),
          height = Math.min(32, region.height - y);
        ctx.drawImage(
          custom.image,
          frame.x,
          frame.y,
          (frame.width * width) / 32,
          (frame.height * height) / 32,
          region.x + x,
          region.y + y,
          width,
          height,
        );
      }
    return;
  }
  // Broad quiet patches, with different grain direction and joins per material.
  ctx.globalAlpha = 0.15;
  for (let y = 25; y < region.height - 12; y += 67)
    for (let x = 18; x < region.width - 18; x += 97) {
      const n = (Math.floor(x / 97) * 13 + Math.floor(y / 67) * 7 + region.variant * 5) % 11;
      if (n < 3)
        box(
          ctx,
          n === 0 ? base : high,
          region.x + x,
          region.y + y,
          Math.min(67, region.width - x),
          n === 2 ? 3 : 12,
        );
    }
  const frame = materialFrame(region.material, region.variant);
  ctx.globalAlpha = 0.13;
  for (let y = 9; y < region.height - 9; y += 31)
    for (let x = 13; x < region.width - 13; x += 43) {
      const at = (((x * 3 + y * 7) % 32) * 32 + ((x * 11 + y * 5) % 32)) * 4;
      box(
        ctx,
        `rgb(${frame.rgba[at]},${frame.rgba[at + 1]},${frame.rgba[at + 2]})`,
        region.x + x,
        region.y + y,
        2 + (x % 4),
        1 + (y % 2),
      );
    }
  ctx.globalAlpha = 0.22;
  if (['concrete', 'masonry', 'damaged'].includes(region.material)) {
    for (let x = 128; x < region.width; x += 176)
      box(ctx, base, region.x + x, region.y + 8, 2, region.height - 16);
    for (let y = 112; y < region.height; y += 160)
      box(ctx, base, region.x + 8, region.y + y, region.width - 16, 2);
    if (region.material === 'damaged')
      for (let i = 0; i < 6; i++) {
        const x = region.x + 25 + ((i * 113) % Math.max(1, region.width - 80)),
          y = region.y + 15 + ((i * 67) % Math.max(1, region.height - 50));
        box(ctx, base, x, y, 2, 17);
        box(ctx, base, x + 2, y + 15, 12, 2);
      }
  } else if (region.material === 'earth') {
    for (let y = 30; y < region.height - 18; y += 74)
      for (let x = 18; x < region.width - 45; x += 71)
        box(ctx, high, region.x + x, region.y + y, 31, 2);
  } else if (region.material === 'timber') {
    for (let y = 12; y < region.height; y += 20)
      box(ctx, base, region.x + 8, region.y + y, region.width - 16, 1);
  } else {
    for (let y = 20; y < region.height - 20; y += 48)
      for (let x = 20; x < region.width - 20; x += 64)
        box(ctx, high, region.x + x, region.y + y, 6, 1);
  }
  ctx.globalAlpha = 1;
}
function segment(ctx, a, b, width, ink) {
  const length = Math.hypot(b.x - a.x, b.y - a.y),
    steps = Math.max(1, Math.ceil(length / 4));
  for (let i = 0; i <= steps; i++)
    box(
      ctx,
      ink,
      a.x + ((b.x - a.x) * i) / steps - width / 2,
      a.y + ((b.y - a.y) * i) / steps - width / 2,
      width,
      width,
    );
}
function path(ctx, path, world, image) {
  const custom = image(OVERFLIGHT_WORLD_PROP_SLOTS[path.kind]),
    [base, low, mid] = world.palette;
  for (let at = 1; at < path.points.length; at++) {
    const a = path.points[at - 1],
      b = path.points[at],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const dx = (b.x - a.x) / length,
      dy = (b.y - a.y) / length,
      nx = -dy,
      ny = dx;
    if (path.kind === 'road') {
      segment(ctx, a, b, path.width + 8, base);
      segment(ctx, a, b, path.width, '#343c36');
      segment(ctx, a, b, Math.max(4, path.width - 12), low);
    } else if (path.kind === 'tracks') {
      segment(ctx, a, b, path.width, low);
      for (const side of [-1, 1])
        segment(
          ctx,
          { x: a.x + nx * path.width * 0.28 * side, y: a.y + ny * path.width * 0.28 * side },
          { x: b.x + nx * path.width * 0.28 * side, y: b.y + ny * path.width * 0.28 * side },
          7,
          '#34382d',
        );
    } else if (path.kind === 'rail') {
      for (let step = 0; step < length; step += 22) {
        const c = { x: a.x + dx * step, y: a.y + dy * step };
        segment(
          ctx,
          { x: c.x - nx * 20, y: c.y - ny * 20 },
          { x: c.x + nx * 20, y: c.y + ny * 20 },
          5,
          '#62523d',
        );
      }
      for (const side of [-1, 1])
        segment(
          ctx,
          { x: a.x + nx * 12 * side, y: a.y + ny * 12 * side },
          { x: b.x + nx * 12 * side, y: b.y + ny * 12 * side },
          3,
          '#778173',
        );
    } else {
      segment(ctx, a, b, path.kind === 'irrigation' ? 8 : 5, '#192d2c');
      segment(ctx, a, b, 2, path.kind === 'irrigation' ? '#58736b' : '#595745');
    }
    for (let step = 16; step < length; step += 32) {
      const x = a.x + dx * step,
        y = a.y + dy * step;
      if (custom?.image) drawOverflightWorldModuleImage(ctx, custom, x, y, 28);
      else if (path.kind === 'road' && Math.floor(step / 32) % 3 === 0)
        box(ctx, mid, x - 8, y - 1, 16, 2);
    }
  }
}
function prop(ctx, item, world, image) {
  const { x, y, kind } = item,
    [, low, mid, high] = world.palette;
  if (
    drawOverflightWorldModuleImage(
      ctx,
      image(OVERFLIGHT_WORLD_PROP_SLOTS[kind]),
      x + item.width / 2,
      y + item.height / 2,
      32,
    )
  )
    return;
  const dark = '#1e2a26',
    steel = '#6f7b70',
    wood = '#796243';
  if (['pallet', 'timber-stack', 'crate'].includes(kind)) {
    box(ctx, dark, x + 3, y + 5, 32, 21);
    for (let i = 0; i < 4; i++) box(ctx, i % 2 ? wood : '#8d7752', x + 2, y + 2 + i * 5, 30, 3);
    box(ctx, '#403a2d', x + 7, y, 3, 22);
    box(ctx, '#403a2d', x + 25, y, 3, 22);
    if (kind === 'crate') {
      box(ctx, '#958258', x + 2, y, 30, 2);
      box(ctx, '#958258', x + 2, y + 20, 30, 2);
    }
  } else if (['barrel', 'bollard', 'wheel', 'stump'].includes(kind)) {
    box(ctx, dark, x + 10, y + 6, 17, 19);
    box(ctx, kind === 'stump' ? wood : mid, x + 8, y + 3, 16, 18);
    box(ctx, kind === 'wheel' ? dark : high, x + 10, y + 3, 12, 3);
    box(ctx, dark, x + 8, y + 13, 16, 3);
    if (kind === 'bollard') box(ctx, steel, x + 4, y + 8, 24, 4);
  } else if (['cable', 'pipe', 'irrigation'].includes(kind)) {
    box(ctx, dark, x, y + 11, 35, 7);
    box(ctx, kind === 'cable' ? wood : steel, x, y + 10, 35, 3);
    box(ctx, steel, x + 20, y, 5, 13);
    box(ctx, high, x + 18, y + 7, 9, 8);
    box(ctx, dark, x + 20, y + 9, 5, 4);
  } else if (kind === 'survey-post') {
    box(ctx, wood, x + 17, y + 2, 4, 23);
    box(ctx, '#b49a60', x + 8, y + 2, 22, 7);
    box(ctx, dark, x + 15, y + 3, 8, 2);
  } else if (kind === 'conveyor') {
    box(ctx, dark, x, y + 7, 40, 13);
    for (let i = 2; i < 38; i += 7) {
      box(ctx, steel, x + i, y + 6, 3, 15);
      box(ctx, mid, x + i, y + 9, 2, 8);
    }
  } else if (kind === 'puddle') {
    box(ctx, '#263b3a', x + 4, y + 7, 30, 12);
    box(ctx, '#324a47', x + 9, y + 5, 19, 3);
    box(ctx, '#536660', x + 12, y + 7, 9, 1);
  } else if (kind === 'crater') {
    box(ctx, mid, x + 3, y + 7, 32, 13);
    box(ctx, low, x + 7, y + 4, 25, 20);
    box(ctx, dark, x + 9, y + 7, 21, 14);
    box(ctx, '#161f1b', x + 13, y + 10, 14, 8);
    box(ctx, high, x + 9, y + 21, 15, 2);
  } else if (kind === 'tree') {
    box(ctx, dark, x + 5, y + 7, 31, 22);
    box(ctx, low, x + 1, y + 2, 30, 20);
    box(ctx, mid, x + 7, y, 18, 13);
    box(ctx, high, x + 10, y + 1, 8, 3);
    box(ctx, wood, x + 16, y + 20, 4, 8);
  } else if (kind === 'antenna') {
    box(ctx, low, x + 5, y + 18, 30, 9);
    box(ctx, steel, x + 18, y, 3, 24);
    for (let i = 3; i < 18; i += 6) box(ctx, mid, x + 8, y + i, 23, 2);
  } else if (kind === 'tracks') {
    for (const dx of [7, 24])
      for (let dy = 0; dy < 28; dy += 7) box(ctx, mid, x + dx, y + dy, 7, 3);
  } else {
    for (let i = 0; i < 7; i++) {
      const xx = x + ((i * 13) % 32),
        yy = y + ((i * 7) % 22);
      box(ctx, dark, xx + 1, yy + 2, 8, 5);
      box(ctx, kind === 'glass' ? '#607a72' : i % 2 ? mid : high, xx, yy, 7, 3);
    }
  }
}
function finishAssembly(ctx, item, world, custom) {
  if (custom || item.width < 112 || item.height < 84) return;
  const { x, y, width: w, height: h, family } = item;
  const industrial = ['container', 'dispatch', 'shelter', 'receiver', 'pump'].includes(family);
  if (industrial) {
    // One roof has opaque light/shadow planes. Native modules define the edge;
    // the interior must read as one structure rather than many tiny crates.
    const roof = family === 'container' ? ['#775344', '#624939'] : ['#6a7769', '#536256'];
    ctx.globalAlpha = 1;
    box(ctx, roof[0], x + 5, y + 5, w - 10, h * 0.48 - 5);
    box(ctx, roof[1], x + 5, y + h * 0.48, w - 10, h * 0.52 - 9);
    ctx.globalAlpha = 1;
    box(ctx, '#a38d6a', x + 5, y + h * 0.48, w - 10, 2);
    box(ctx, '#433e32', x + 5, y + h * 0.48 + 2, w - 10, 3);
    for (let panel = 112; panel < w - 42; panel += 140) {
      box(ctx, '#4b493b', x + panel, y + 6, 2, h - 18);
      box(ctx, '#8b8063', x + panel + 2, y + 6, 1, h - 18);
    }
    for (const side of [0.25, 0.73]) {
      const vx = x + Math.floor((w * side) / 2) * 2,
        vy = y + Math.floor((h * 0.28) / 2) * 2;
      box(ctx, '#273b34', vx + 3, vy + 4, 30, 20);
      box(ctx, '#a1a78a', vx, vy, 28, 18);
      box(ctx, '#46574b', vx + 3, vy + 3, 22, 12);
      for (let row = 5; row < 14; row += 4) box(ctx, '#77836b', vx + 5, vy + row, 18, 1);
    }
    // A single continuous loading edge and two doors establish the building's scale.
    box(ctx, '#303e33', x + 5, y + h - 15, w - 10, 9);
    for (const side of [0.22, 0.76]) {
      const dx = x + Math.floor(w * side);
      box(ctx, '#1d302a', dx, y + h - 21, 24, 15);
      box(ctx, '#7f8468', dx, y + h - 22, 25, 2);
      for (let row = 0; row < 3; row++) box(ctx, '#465044', dx + 3, y + h - 17 + row * 4, 18, 1);
    }
  } else if (family === 'planter') {
    // A continuous raised field/shelterbelt, with a few long planted strips.
    box(ctx, '#434b2e', x + 4, y + 4, w - 8, h - 8);
    box(ctx, '#646747', x + 5, y + 5, w - 10, 4);
    box(ctx, '#28362a', x + 5, y + h - 13, w - 10, 8);
    for (let row = 24; row < h - 20; row += 48) {
      box(ctx, '#344730', x + 12, y + row + 3, w - 24, 19);
      box(ctx, '#53633b', x + 12, y + row, w - 24, 13);
      for (let gap = 100; gap < w - 48; gap += 168) box(ctx, '#434b2e', x + gap, y + row, 14, 22);
    }
  } else if (family === 'glasshouse') {
    box(ctx, '#658275', x + 4, y + 4, w - 8, h / 2 - 4);
    box(ctx, '#4b695a', x + 4, y + h / 2, w - 8, h / 2 - 7);
    // Joined glazing bays have a broken ridge, not a grid of detached mini houses.
    for (let panel = 84; panel < w - 20; panel += 112) {
      box(ctx, '#324a3d', x + panel, y + 4, 3, h - 8);
      box(ctx, '#b1b795', x + panel - 1, y + 4, 1, h - 8);
    }
    box(ctx, '#a2b19a', x + 2, y + Math.floor(h / 2), w - 4, 3);
    for (let panel = 52; panel < w - 32; panel += 168) {
      box(ctx, '#2c4235', x + panel, y + h * 0.6, 27, 17);
      box(ctx, '#708c7b', x + panel + 3, y + h * 0.6 + 3, 9, 3);
    }
  } else if (family === 'terrace') {
    box(ctx, '#77775d', x + 4, y + 4, w - 8, h - 8);
    for (let row = 26; row < h - 8; row += 56) {
      box(ctx, '#60624f', x + 5, y + row, w - 10, 7);
      box(ctx, world.palette[3], x + 5, y + row, w - 10, 2);
    }
    for (let ledge = 72; ledge < w - 36; ledge += 176)
      box(ctx, '#666a53', x + ledge, y + h * 0.35, 24, 8);
  } else {
    // Large equipment uses a quiet plinth and a few recognizable components.
    // This prevents native modules becoming a carpet of repeated machinery.
    box(ctx, world.palette[1], x + 4, y + 4, w - 8, h - 8);
    box(ctx, world.palette[2], x + 8, y + 8, w - 16, 3);
    const cy = y + Math.floor(h / 2),
      cx = x + Math.floor(w / 2);
    if (family === 'floodgate') {
      box(ctx, '#293f3b', x + 10, y + 20, w - 20, h - 40);
      box(ctx, '#66766a', x + 12, cy - 9, w - 24, 18);
      for (let brace = 32; brace < w - 20; brace += 112)
        box(ctx, '#8c9174', x + brace, y + 14, 8, h - 28);
    } else if (family === 'reclaimer') {
      box(ctx, '#3c463a', x + 14, cy - 20, w - 28, 40);
      box(ctx, '#8c7d51', x + 14, cy - 23, w - 28, 4);
      box(ctx, '#b19a62', cx - 25, cy - 33, 50, 58);
      box(ctx, '#50594a', cx - 17, cy - 23, 34, 34);
      for (let rib = 38; rib < w - 20; rib += 48) box(ctx, '#65705c', x + rib, cy - 14, 3, 28);
    } else if (family === 'irrigator') {
      box(ctx, '#213e34', x + 14, cy - 4, w - 28, 12);
      box(ctx, '#75866a', x + 14, cy - 6, w - 28, 4);
      for (const at of [0.25, 0.72]) {
        const px = x + Math.floor(w * at);
        box(ctx, '#2b4135', px + 3, cy - 19, 27, 42);
        box(ctx, '#6c7b56', px, cy - 22, 25, 38);
        box(ctx, '#9aa27a', px + 4, cy - 22, 17, 4);
      }
    } else if (family === 'antenna') {
      box(ctx, '#2b3c35', cx - 29, cy - 28, 58, 56);
      box(ctx, '#708072', cx - 24, cy - 33, 48, 52);
      box(ctx, '#a1ac91', cx - 18, cy - 33, 36, 3);
      box(ctx, '#354c40', cx - 3, y + 16, 6, h - 32);
      for (const at of [0.25, 0.75]) box(ctx, '#8f9b82', cx - 26, y + h * at, 52, 3);
      box(ctx, '#71816d', x + 16, cy + 30, w - 32, 3);
    }
  }
}

function assembly(ctx, item, world, image) {
  const size = 28,
    columns = Math.ceil(item.width / size),
    rows = Math.ceil(item.height / size),
    slots = OVERFLIGHT_WORLD_ASSEMBLY_SLOTS[item.family],
    occupied = new Set();
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) occupied.add(`${column},${row}`);
  box(ctx, '#182722', item.x + 5, item.y + 7, item.width, item.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(item.x, item.y, item.width, item.height);
  ctx.clip();
  const nativeScaleContext = {
    set fillStyle(color) {
      ctx.fillStyle = color;
    },
    fillRect: (...args) => ctx.fillRect(...args),
    save: () => ctx.save(),
    restore: () => ctx.restore(),
    translate: (...args) => ctx.translate(...args),
  };
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const cap = row === 0 || row === rows - 1 || column === 0 || column === columns - 1,
        corner = (row === 0 || row === rows - 1) && (column === 0 || column === columns - 1),
        custom = image(slots[corner ? 'corner' : cap ? 'cap' : 'panel']) ?? image(slots.panel);
      ctx.save();
      ctx.translate(item.x + column * size, item.y + row * size);
      if (!drawOverflightWorldModuleImage(ctx, custom, size / 2, size / 2, size))
        drawClassicStructureModule(
          nativeScaleContext,
          { x: column, y: row },
          familyScene[item.family],
          {
            treatment: world.id === 'relay-ruins' ? 'atmospheric-ruins' : 'living-circuit',
            structure: { x: 0, y: 0, width: columns, height: rows },
            occupied,
            composition: { structure: item.family },
          },
        );
      ctx.restore();
    }
  finishAssembly(
    ctx,
    item,
    world,
    Object.values(slots).some((slot) => image(slot)?.image),
  );
  // The contact edge is sharp, continuous, and separate from the repeating panels.
  box(ctx, world.palette[3], item.x, item.y, item.width, 2);
  box(ctx, '#1b2925', item.x, item.y + item.height - 4, item.width, 4);
  box(ctx, '#1b2925', item.x + item.width - 3, item.y, 3, item.height);
  ctx.restore();
}

/** Prepared once into selected-world tiles. No animation clock or combat RNG. */
export function paintOverflightWorldV2(
  ctx,
  presentation,
  arena,
  world,
  { scale = 1, image = () => null } = {},
) {
  if (!OVERFLIGHT_WORLD_KITS[world.id]) return false;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(0, 0, arena.width, arena.height);
  ctx.clip();
  box(ctx, world.palette[0], 0, 0, arena.width, arena.height);
  for (const region of presentation.regions) material(ctx, region, world, image);
  for (const entry of presentation.paths) path(ctx, entry, world, image);
  for (const item of presentation.landmarks) prop(ctx, item, world, image);
  for (const item of presentation.assemblies) assembly(ctx, item, world, image);
  ctx.restore();
  return true;
}
