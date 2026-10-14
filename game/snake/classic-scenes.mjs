import { drawClassicStructureModule } from './classic-structure-art.mjs';
import {
  industrialMaterialPixels,
  INDUSTRIAL_ENVIRONMENT_REVISION,
} from '../presentation/industrial-materials.mjs';
import { drawMachinerySpecimen } from '../presentation/industrial-machinery.mjs';
import {
  classicBattlefieldPalette,
  classicBattlefieldWorld,
  drawClassicBattlefield,
} from './classic-battlefield-art.mjs';

import { resolveClassicWorld } from './classic-worlds.mjs';
export { CLASSIC_BOARD_SCENES } from './classic-worlds.mjs';
export const CLASSIC_SCENE_MATERIAL_REVISION = INDUSTRIAL_ENVIRONMENT_REVISION;
const SCENES = Object.freeze({
  orchard: Object.freeze({
    field: '#535c36',
    alternate: '#59613b',
    grid: '#303c32',
    text: '#f6f3df',
    muted: '#9da990',
    accent: '#ffd06c',
    safe: '#92d8ef',
    danger: '#ff8478',
    material: 'earth',
    tint: [83, 93, 54],
    wall: 'timber',
    wallTint: [151, 125, 75],
  }),
  workshop: Object.freeze({
    field: '#344650',
    alternate: '#394b54',
    grid: '#1d303c',
    text: '#f6f3df',
    muted: '#a3b8ba',
    accent: '#ffc464',
    safe: '#92d8ef',
    danger: '#ff8478',
    material: 'metal',
    tint: [52, 69, 80],
    wall: 'metal',
    wallTint: [164, 104, 69],
  }),
  relay: Object.freeze({
    field: '#566264',
    alternate: '#5d6868',
    grid: '#303f44',
    text: '#f6f3df',
    muted: '#bac4ba',
    accent: '#ffce6a',
    safe: '#92d8ef',
    danger: '#ff8478',
    material: 'concrete',
    tint: [83, 95, 96],
    wall: 'concrete',
    wallTint: [164, 173, 169],
  }),
  freight: Object.freeze({
    field: '#3e4c52',
    alternate: '#455359',
    grid: '#2c383d',
    text: '#f6f3df',
    muted: '#aeb0a5',
    accent: '#efb85e',
    safe: '#92d8ef',
    danger: '#ff8478',
    material: 'concrete',
    tint: [62, 76, 82],
    wall: 'metal',
    wallTint: [164, 78, 57],
  }),
  harbor: Object.freeze({
    field: '#456162',
    alternate: '#4b6767',
    grid: '#2b484a',
    text: '#f6f3df',
    muted: '#bac4ba',
    accent: '#f3a486',
    safe: '#92d8ef',
    danger: '#ff8478',
    material: 'concrete',
    tint: [69, 97, 98],
    wall: 'concrete',
    wallTint: [150, 182, 172],
  }),
  quarry: Object.freeze({
    field: '#394b43',
    alternate: '#405249',
    grid: '#263930',
    text: '#f6f3df',
    muted: '#aeb9a5',
    accent: '#d4c57e',
    safe: '#92d8ef',
    danger: '#ff8478',
    material: 'earth',
    tint: [57, 75, 67],
    wall: 'masonry',
    wallTint: [106, 120, 118],
  }),
});
/** Cosmetic chapter selection never reads a run or its random streams. */
export function resolveClassicBoardScene(options = {}) {
  return resolveClassicWorld(options).scene;
}
export function classicScenePalette(scene, treatment = 'living-circuit') {
  const base = SCENES[resolveClassicBoardScene({ boardScene: scene })];
  if (treatment === 'fpv-battlefield') return { ...base, ...classicBattlefieldPalette(scene) };
  if (treatment === 'theme')
    return { ...base, field: '#354749', tint: [53, 71, 73], wallTint: [101, 121, 118] };
  if (treatment === 'retro')
    return { ...base, field: '#283b34', tint: [40, 59, 52], wallTint: [125, 144, 112] };
  if (treatment === 'toybox')
    return {
      ...base,
      wall: 'timber',
      wallTint: base.wallTint.map((v) => Math.min(220, v + 26)),
      material: 'timber',
      field: '#99ae8b',
      tint: {
        orchard: [153, 174, 139],
        freight: [168, 143, 112],
        workshop: [132, 164, 172],
        harbor: [140, 179, 178],
        relay: [159, 169, 186],
        quarry: [151, 164, 144],
      }[scene] ?? [153, 174, 139],
      grid: '#73846d',
      muted: '#506759',
    };
  if (treatment === 'atmospheric-ruins')
    return {
      ...base,
      wall: 'masonry',
      wallTint: base.wallTint.map((v) => Math.round(v * 0.7 + 28)),
      tint: base.tint.map((v) => Math.round(v * 0.65)),
      grid: '#283932',
    };
  if (treatment === 'night-arcade')
    return {
      ...base,
      wall: 'metal',
      wallTint: [43, 62, 77],
      tint: [19, 29, 42],
      field: '#131d2a',
      grid: '#233446',
    };
  return base;
}

export function classicSceneMaterial(
  scene,
  { wall = false, variant = 0, treatment = 'living-circuit' } = {},
) {
  const palette = classicScenePalette(scene, treatment);
  const sample = industrialMaterialPixels(
    { width: 32, height: 32 },
    wall ? palette.wall : palette.material,
    {
      revision: CLASSIC_SCENE_MATERIAL_REVISION,
      variant: variant % 4,
    },
  );
  for (let at = 0; at < sample.rgba.length; at += 4) {
    const luminance = sample.rgba[at] * 0.3 + sample.rgba[at + 1] * 0.6 + sample.rgba[at + 2] * 0.1;
    // The playable floor is quiet; recognizable raised bevels belong only to
    // accepted wall cells. All material pixels remain opaque.
    for (let channel = 0; channel < 3; channel++) {
      sample.rgba[at + channel] = wall
        ? palette.wallTint[channel] + (luminance - 125) * 0.72
        : palette.tint[channel] + (luminance - 110) * 0.07;
    }
  }
  return sample;
}
const surfaces = new WeakMap();
const backdrops = new WeakMap();
export const CLASSIC_BACKDROP_SIZE = Object.freeze({ width: 256, height: 192 });
function canvasFactory(owner) {
  return () =>
    owner?.createElement?.('canvas') ??
    (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : null);
}
function texture(owner, scene, wall, variant, treatment = 'living-circuit') {
  if (!owner || typeof owner !== 'object') return null;
  const world = resolveClassicWorld({ boardScene: scene, boardStyle: treatment });
  scene = world.scene;
  treatment = world.treatment;
  variant = ((variant % 4) + 4) % 4;
  if (!surfaces.has(owner)) surfaces.set(owner, new Map());
  const cache = surfaces.get(owner),
    key = `${scene}/${wall}/${variant}/${treatment}`;
  if (cache.has(key)) {
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  const canvas = canvasFactory(owner)(),
    pixels = classicSceneMaterial(scene, { wall, variant, treatment });
  if (!canvas) return null;
  canvas.width = canvas.height = 32;
  const context = canvas.getContext?.('2d');
  if (!context?.createImageData || !context?.putImageData) return null;
  const image = context.createImageData(32, 32);
  if (!image?.data?.set) return null;
  image.data.set(pixels.rgba);
  context.putImageData(image, 0, 0);
  cache.set(key, canvas);
  // All six appearances share the same bounded material surface allowance.
  while (cache.size > 192) {
    const oldest = cache.keys().next().value;
    const released = cache.get(oldest);
    cache.delete(oldest);
    released.width = released.height = 1;
  }
  return canvas;
}

/** Exact original playable rectangle. Scenery lives in the shell backdrop. */
export function drawClassicLivingGround(
  ctx,
  level,
  scene,
  { unit = 28, document, treatment = 'living-circuit', zoning = 'court', composition = {} } = {},
) {
  const palette = classicScenePalette(scene, treatment);
  if (treatment === 'fpv-battlefield') {
    drawClassicBattlefield(ctx, scene, level.width * unit, level.height * unit);
    return;
  }
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, level.width * unit, level.height * unit);
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const tile = texture(document, scene, false, (x * 7 + y * 11) % 4, treatment);
      if (tile) ctx.drawImage(tile, x * unit, y * unit, unit, unit);
      // Floor zoning is deliberately low contrast and cannot read as a wall.
      const marked =
        zoning === 'rows'
          ? y % 5 === 2
          : zoning === 'tracks'
            ? x % 6 === 2
            : zoning === 'quays'
              ? y === 2 || y === level.height - 3
              : zoning === 'bays'
                ? x % 6 < 3 && y % 6 < 3
                : x > 2 && x < level.width - 3 && (y === 2 || y === level.height - 3);
      if (marked && !composition.floorPlan) {
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = palette.accent;
        ctx.fillRect(x * unit, y * unit, unit, unit);
        ctx.globalAlpha = 1;
      }
    }
  drawFloorIdentity(ctx, level, scene, treatment, palette, unit);
  drawAuthoredFloorLight(ctx, level, unit, composition);
  drawFloorComposition(ctx, level, palette, unit, composition, treatment);
}

// Flat printed/stained surface details give even obstacle-free lessons identity.
// They have no bevel, shadow or solid outline; every cell remains fully playable.
function drawFloorIdentity(ctx, level, scene, treatment, palette, unit) {
  const width = level.width * unit,
    height = level.height * unit,
    toy = treatment === 'toybox';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.strokeStyle = toy ? '#eadbb1' : palette.accent;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = toy ? 0.24 : 0.1;
  ctx.lineWidth = unit * 0.035;
  if (toy) {
    // Enamel mat on a miniature tabletop: broad soft tiles and painted stitching.
    ctx.fillStyle = '#f6edc4';
    ctx.globalAlpha = 0.055;
    for (let y = 0; y < level.height; y += 4)
      for (let x = 0; x < level.width; x += 4)
        if ((x + y) % 8 === 0) ctx.fillRect(x * unit, y * unit, 4 * unit, 4 * unit);
    ctx.globalAlpha = 0.23;
    ctx.strokeStyle = '#f1e8bc';
    ctx.setLineDash([unit * 0.22, unit * 0.24]);
    ctx.strokeRect(unit * 0.2, unit * 0.2, width - unit * 0.4, height - unit * 0.4);
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.09;
    for (let x = 2; x < level.width - 1; x += 3) {
      ctx.fillRect(x * unit, unit * 0.12, unit * 0.45, unit * 0.09);
      ctx.fillRect(x * unit, height - unit * 0.21, unit * 0.45, unit * 0.09);
    }
  }
  // A world-specific flat maker's mark replaces a generic diamond on open boards.
  ctx.translate(width / 2, height / 2);
  ctx.scale(unit, unit);
  ctx.globalAlpha = toy ? 0.13 : 0.1;
  ctx.fillStyle = toy ? '#f9efc8' : palette.accent;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 0.055;
  if (scene === 'orchard') {
    ctx.beginPath();
    ctx.ellipse(-0.85, -0.45, 1.1, 0.45, 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.85, -0.45, 1.1, 0.45, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-0.06, -0.3, 0.12, 2.1);
  } else if (scene === 'harbor') {
    for (let y = -1; y <= 1; y++) {
      ctx.beginPath();
      ctx.moveTo(-2, y);
      ctx.bezierCurveTo(-0.6, y - 0.7, 0.6, y + 0.7, 2, y);
      ctx.stroke();
    }
  } else if (scene === 'relay') {
    for (const radius of [0.8, 1.4, 2]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillRect(-0.08, -0.7, 0.16, 2);
    ctx.fillRect(-0.7, 1.2, 1.4, 0.12);
  } else if (scene === 'workshop') {
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.9, -0.8);
    ctx.stroke();
    ctx.fillRect(-0.2, -0.2, 0.4, 0.4);
  } else if (scene === 'freight') {
    for (const x of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - 0.4, -0.9);
      ctx.lineTo(x + 0.4, 0);
      ctx.lineTo(x - 0.4, 0.9);
      ctx.stroke();
    }
  } else {
    for (const n of [0, 0.6, 1.2]) {
      ctx.beginPath();
      ctx.moveTo(-2 + n, 1.4 - n);
      ctx.lineTo(1.7, 1.4 - n);
      ctx.lineTo(1.7, -1.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Static illumination stays beneath the grid, walls and actors. It supplies
 * the authored chapter time of day without fog, glare or a new gameplay cue. */
function drawAuthoredFloorLight(ctx, level, unit, world) {
  if (!['morning', 'late', 'night'].includes(world.light)) return;
  const width = level.width * unit,
    height = level.height * unit;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  if (world.light === 'night') {
    // A quiet equipment pool around the authored focus. Four nested bands
    // total less than six percent opacity even where they overlap.
    const [fx, fy] = world.focus ?? [level.width / 2, level.height / 2];
    ctx.fillStyle = '#accfdb';
    ctx.globalAlpha = 0.014;
    for (const radius of [5, 4, 3, 2]) {
      ctx.beginPath();
      ctx.ellipse(fx * unit, fy * unit, radius * unit, radius * unit * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const vertical = world.axis === 'vertical';
    const length = vertical ? height : width;
    const band = length / 8;
    ctx.fillStyle = world.light === 'morning' ? '#ffe9b8' : '#e5a078';
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.06 * (1 - i / 8);
      const start = world.light === 'morning' ? i * band : length - (i + 1) * band;
      ctx.fillRect(
        vertical ? 0 : start,
        vertical ? start : 0,
        vertical ? width : band,
        vertical ? band : height,
      );
    }
  }
  ctx.restore();
}

/** Literal floor paint in board coordinates. No raised edges, collision-like
 * outlines, simulation state, or retained surfaces. These broad aprons support
 * the existing structure arrangement even at mobile size. */
function drawAuthoredFloorPlan(ctx, level, palette, unit, plan, treatment) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, level.width * unit, level.height * unit);
  ctx.clip();
  ctx.scale(unit, unit);
  ctx.fillStyle = palette.accent;
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = treatment === 'night-arcade' ? 0.075 : 0.055;
  for (const patch of plan.patches ?? []) ctx.fillRect(...patch);
  ctx.lineWidth = treatment === 'toybox' ? 0.1 : 0.055;
  ctx.globalAlpha = treatment === 'night-arcade' ? 0.19 : 0.14;
  if (treatment === 'atmospheric-ruins') ctx.setLineDash([0.7, 0.18, 0.14, 0.18]);
  const path = (points) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  for (const points of plan.paths ?? []) path(points);
  ctx.setLineDash([]);
  const [x, y, mark] = plan.seal;
  ctx.translate(x, y);
  // World-specific painted station insignia; deliberately no square frame.
  // Their scale and low contrast cannot be mistaken for a parcel or enemy.
  ctx.lineWidth = 0.09;
  ctx.globalAlpha = 0.18;
  if (mark === 'leaf') {
    path([
      [0, 1.1],
      [0, -1.1],
    ]);
    path([
      [0, 0.4],
      [-0.8, 0],
      [-0.8, -0.5],
      [0, -0.1],
      [0.8, -0.7],
      [0.8, -1.1],
      [0, -0.5],
    ]);
  } else if (mark === 'tide') {
    for (const y of [-0.6, 0, 0.6])
      path([
        [-1.2, y],
        [-0.6, y - 0.25],
        [0, y],
        [0.6, y - 0.25],
        [1.2, y],
      ]);
  } else if (mark === 'signal') {
    path([
      [0, 1],
      [0, -0.5],
      [-0.45, -1],
      [0.45, -1],
      [0, -0.5],
    ]);
    for (const s of [-1, 1])
      path([
        [s * 0.75, -0.9],
        [s * 1.1, -0.35],
        [s * 0.75, 0.2],
      ]);
  } else if (mark === 'valve') {
    ctx.beginPath();
    ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
    ctx.stroke();
    path([
      [-0.65, -0.65],
      [0.65, 0.65],
    ]);
    path([
      [-0.65, 0.65],
      [0.65, -0.65],
    ]);
  } else if (mark === 'freight') {
    for (const x of [-0.65, 0.2])
      path([
        [x - 0.4, -0.75],
        [x + 0.35, 0],
        [x - 0.4, 0.75],
      ]);
  } else if (mark === 'survey') {
    path([
      [-1, 0.7],
      [0, -1],
      [1, 0.7],
      [-1, 0.7],
    ]);
    path([
      [0, 0.3],
      [0, 1.1],
    ]);
  }
  ctx.restore();
}

// Flat, low-contrast inlays identify a place without suggesting solid geometry.
// The focal position is authored; wall silhouettes always cover this floor layer.
function drawFloorComposition(ctx, level, palette, unit, world, treatment) {
  if (world.floorPlan) {
    drawAuthoredFloorPlan(ctx, level, palette, unit, world.floorPlan, treatment);
    return;
  }
  const [fx, fy] = world.focus ?? [level.width / 2, level.height / 2];
  const vertical = world.axis === 'vertical';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, level.width * unit, level.height * unit);
  ctx.clip();
  ctx.translate(fx * unit, fy * unit);
  if (vertical) ctx.rotate(Math.PI / 2);
  ctx.scale(unit, unit);
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineWidth = 0.035;
  ctx.globalAlpha = treatment === 'night-arcade' ? 0.18 : 0.1;
  const box = (x, y, w, h) => ctx.fillRect(x, y, w, h);
  const path = (points) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  switch (world.floor) {
    case 'oval':
      for (const radius of [3, 5]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.5, radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'ring':
      ctx.strokeRect(-5, -4, 10, 8);
      ctx.strokeRect(-6, -5, 12, 10);
      break;
    case 'elbow':
      path([
        [-10, 2],
        [2, 2],
        [2, -8],
      ]);
      path([
        [-10, 3],
        [3, 3],
        [3, -8],
      ]);
      break;
    case 'fork':
      path([
        [-12, 0],
        [0, 0],
        [7, -5],
      ]);
      path([
        [0, 0],
        [7, 5],
      ]);
      break;
    case 'seam':
      for (let x = -24; x < 24; x += 3) {
        path([
          [x, -1],
          [x + 1, 0],
          [x, 1],
        ]);
      }
      break;
    case 'cross':
      box(-18, -1, 36, 2);
      box(-1, -18, 2, 36);
      break;
    case 'islands':
      for (const [x, y] of [
        [-5, -3],
        [3, 3],
      ]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'slalom':
      path([
        [-12, -3],
        [-6, -3],
        [-6, 3],
        [0, 3],
        [0, -3],
        [6, -3],
        [6, 3],
        [12, 3],
      ]);
      break;
    case 'terraces':
      for (let n = 0; n < 4; n++)
        path([
          [-9 + n * 2, 6 - n * 2],
          [8, 6 - n * 2],
          [8, -6],
        ]);
      break;
    case 'rows':
      for (let y = -12; y < 12; y += 3) box(-9, y, 18, 0.28);
      break;
    case 'bays':
      for (let x = -12; x < 12; x += 5) ctx.strokeRect(x, -4, 3, 8);
      break;
  }
  // A flat station seal is the landmark for open lessons; it is not a new obstacle.
  ctx.globalAlpha = 0.15;
  ctx.strokeRect(-0.8, -0.8, 1.6, 1.6);
  path([
    [-0.6, 0],
    [0, -0.6],
    [0.6, 0],
    [0, 0.6],
    [-0.6, 0],
  ]);
  ctx.restore();
}

/** Four-connected components; holes and removed cells never enter a footprint. */
export function classicWallStructures(walls) {
  const remaining = new Map(walls.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const result = new Map();
  while (remaining.size) {
    const start = remaining.values().next().value;
    const queue = [start],
      cells = [];
    remaining.delete(`${start.x},${start.y}`);
    for (let at = 0; at < queue.length; at++) {
      const cell = queue[at];
      cells.push(cell);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const key = `${cell.x + dx},${cell.y + dy}`;
        if (remaining.has(key)) {
          queue.push(remaining.get(key));
          remaining.delete(key);
        }
      }
    }
    const x = Math.min(...cells.map((cell) => cell.x));
    const y = Math.min(...cells.map((cell) => cell.y));
    const structure = Object.freeze({
      x,
      y,
      width: Math.max(...cells.map((cell) => cell.x)) - x + 1,
      height: Math.max(...cells.map((cell) => cell.y)) - y + 1,
    });
    for (const cell of cells) result.set(`${cell.x},${cell.y}`, structure);
  }
  return result;
}

/** External edges belong to the accepted solid-cell union. All inlays and
 * silhouettes stay inside their own cell, including corners beside a passage. */
export function drawClassicLivingWall(
  ctx,
  wall,
  scene,
  {
    unit = 28,
    document,
    treatment = 'living-circuit',
    occupied = new Set(),
    structure = null,
    composition = {},
  } = {},
) {
  const x = wall.x * unit,
    y = wall.y * unit;
  const tile = texture(document, scene, true, (wall.x + wall.y) % 4, treatment);
  const p = classicScenePalette(scene, treatment);
  ctx.fillStyle = `rgb(${p.wallTint.join(',')})`;
  ctx.fillRect(x, y, unit, unit);
  if (tile) ctx.drawImage(tile, x, y, unit, unit);
  const top = !occupied.has(`${wall.x},${wall.y - 1}`),
    bottom = !occupied.has(`${wall.x},${wall.y + 1}`),
    left = !occupied.has(`${wall.x - 1},${wall.y}`),
    right = !occupied.has(`${wall.x + 1},${wall.y}`);
  // Native 28px modular specimens scale with the same square geometry.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(unit / 28, unit / 28);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 28, 28);
  ctx.clip();
  drawClassicStructureModule(ctx, wall, scene, {
    structure,
    composition,
    occupied,
    treatment,
    palette: p,
  });
  ctx.restore();
  const rim = treatment === 'night-arcade' ? p.accent : '#293b38';
  // A continuous rim, rather than a pile of separately outlined tiles.
  if (top) rect(ctx, '#ded5af', 0, 0, 28, 2);
  if (left) rect(ctx, '#b1b49a', 0, 0, 2, 28);
  if (bottom) rect(ctx, rim, 0, 25, 28, 3);
  if (right) rect(ctx, rim, 26, 0, 2, 28);
  ctx.restore();
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function crate(ctx, x, y, size = 20) {
  rect(ctx, '#17282b', x, y, size, size);
  rect(ctx, '#786039', x + 1, y + 1, size - 2, size - 2);
  rect(ctx, '#b08c50', x + 2, y + 2, size - 4, 2);
  rect(ctx, '#433d2c', x + 3, y + 5, size - 6, size - 8);
  ctx.strokeStyle = '#a0834d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + size - 4, y + size - 4);
  ctx.stroke();
}
function tree(ctx, x, y, phase) {
  rect(ctx, '#3d3827', x + 11, y + 12, 5, 18);
  for (const [dx, dy, size] of [
    [3, 9, 21],
    [0, 3, 18],
    [13, 0, 16],
    [12, 13, 18],
  ]) {
    rect(ctx, '#1b3430', x + dx, y + dy + 2, size, size);
    rect(ctx, '#31513b', x + dx + 2, y + dy, size - 3, size - 3);
    rect(ctx, '#577044', x + dx + 4, y + dy + 1, size - 8, 3);
  }
  for (let i = 0; i < 5; i++) {
    const dx = 4 + ((i * 11 + phase * 3) % 21),
      dy = 3 + ((i * 7 + phase) % 20);
    rect(ctx, '#b16c26', x + dx, y + dy + 1, 4, 4);
    rect(ctx, '#f3b847', x + dx, y + dy, 3, 3);
  }
}
function workshop(ctx, x, y, width = 76, height = 32) {
  rect(ctx, '#0d242d', x, y, width, height);
  rect(ctx, '#314656', x + 1, y + 1, width - 2, height - 3);
  for (let at = 3; at < width - 3; at += 7) rect(ctx, '#547080', x + at, y + 1, 2, height - 4);
  rect(ctx, '#091b23', x, y + height - 6, width, 6);
  for (let at = 10; at < width - 8; at += 24) {
    rect(ctx, '#7c542e', x + at - 2, y + height - 9, 13, 9);
    rect(ctx, '#eaae50', x + at, y + height - 7, 9, 6);
    rect(ctx, '#ffe1a0', x + at + 1, y + height - 7, 2, 5);
  }
}

/** Scenery is a background for the host's outer frame, never a board overlay.
 * No generated asset files, network fetch, simulation seed or animation clock. */
export function classicSceneBackdrop(
  scene,
  { document = globalThis.document, treatment = 'living-circuit' } = {},
) {
  if (!document || typeof document !== 'object') return null;
  const world = resolveClassicWorld({ boardScene: scene, boardStyle: treatment });
  const selected = world.scene;
  treatment = ['theme', 'retro'].includes(world.treatment) ? 'living-circuit' : world.treatment;
  const key = `${treatment === 'fpv-battlefield' ? classicBattlefieldWorld(selected) : selected}/${treatment}`;
  if (!backdrops.has(document)) backdrops.set(document, new Map());
  const cache = backdrops.get(document);
  if (cache.has(key)) return cache.get(key);
  const canvas = canvasFactory(document)();
  if (!canvas?.toDataURL) return null;
  canvas.width = CLASSIC_BACKDROP_SIZE.width;
  canvas.height = CLASSIC_BACKDROP_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  // Keep the authored composition coordinates while bounding every decoded
  // CSS image, including previously selected looks retained by the browser.
  ctx.scale(canvas.width / 384, canvas.height / 288);
  if (treatment === 'fpv-battlefield') {
    drawClassicBattlefield(ctx, selected, 384, 288, { backdrop: true });
    const url = canvas.toDataURL('image/png');
    canvas.width = canvas.height = 1;
    cache.set(key, url);
    return url;
  }
  const material = texture(document, selected, false, 0, treatment);
  rect(ctx, '#172c34', 0, 0, 384, 288);
  if (material)
    for (let y = 0; y < 288; y += 32)
      for (let x = 0; x < 384; x += 32) ctx.drawImage(material, x, y);
  // Wide/short viewports may expose substantial letterboxing around the real
  // canvas. This remains quiet ground, never a repeated wall/barrier texture.
  ctx.globalAlpha = 0.3;
  rect(ctx, '#10252a', 0, 0, 384, 288);
  ctx.globalAlpha = 1;
  // Native shared machinery and materials tie the perimeter to the core game.
  for (let x = 0; x < 384; x += 38) {
    if (selected === 'orchard') {
      tree(ctx, x - 3, -10, x % 7);
      tree(ctx, x + 9, 266, x % 5);
    } else {
      workshop(ctx, x - 6, -20, 35, 32);
      crate(ctx, x + 2, 274, 17);
    }
  }
  for (let y = 24; y < 270; y += 42) {
    if (selected === 'orchard') {
      tree(ctx, -10, y, y % 7);
      tree(ctx, 27, y + 16, y % 5);
      tree(ctx, 334, y + 5, y % 3);
      tree(ctx, 368, y + 19, y % 5);
    } else {
      workshop(ctx, -9, y, 43, 27);
      workshop(ctx, 354, y + 9, 40, 28);
      crate(ctx, 34, y + 14, 17);
      crate(ctx, 335, y + 24, 16);
    }
    for (const x of [58, 322]) {
      rect(ctx, '#2c332b', x - 2, y + 19, 8, 13);
      rect(ctx, '#bf8244', x - 1, y + 20, 6, 10);
      rect(ctx, '#ffdd85', x, y + 21, 4, 7);
    }
  }
  workshop(ctx, 145, -18, 98, 33);
  drawMachinerySpecimen(ctx, selected === 'relay' ? 'radar-truck' : 'utility-car', {
    x: 18,
    y: 220,
    size: 38,
    heading: Math.PI,
  });
  drawMachinerySpecimen(ctx, selected === 'relay' ? 'radar-truck' : 'cargo-truck', {
    x: 300,
    y: 287,
    size: 48,
    heading: Math.PI / 2,
  });
  if (selected === 'relay')
    for (const [x, y] of [
      [15, 6],
      [367, 9],
      [14, 275],
    ]) {
      rect(ctx, '#20303b', x - 3, y - 10, 6, 24);
      rect(ctx, '#a0afb2', x - 1, y - 12, 2, 23);
      rect(ctx, '#dd7068', x - 2, y - 14, 4, 4);
    }
  const url = canvas.toDataURL('image/png');
  canvas.width = canvas.height = 1; // Only the bounded encoded backdrop is retained.
  cache.set(key, url);
  return url;
}
