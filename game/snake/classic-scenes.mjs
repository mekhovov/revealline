import {
  industrialMaterialPixels,
  INDUSTRIAL_ENVIRONMENT_REVISION,
} from '../presentation/industrial-materials.mjs';
import { drawMachinerySpecimen } from '../presentation/industrial-machinery.mjs';

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
  if (treatment === 'toybox')
    return {
      ...base,
      wall: 'timber',
      wallTint: base.wallTint.map((v) => Math.min(220, v + 26)),
      tint: base.tint.map((v) => v + 15),
      grid: '#444b44',
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
  if (cache.has(key)) return cache.get(key);
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
  return canvas;
}

/** Exact original playable rectangle. Scenery lives in the shell backdrop. */
export function drawClassicLivingGround(
  ctx,
  level,
  scene,
  { unit = 28, document, treatment = 'living-circuit', zoning = 'court' } = {},
) {
  const palette = classicScenePalette(scene, treatment);
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
      if (marked) {
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = palette.accent;
        ctx.fillRect(x * unit, y * unit, unit, unit);
        ctx.globalAlpha = 1;
      }
    }
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
  if (structure) {
    ctx.translate((structure.x - wall.x) * 28, (structure.y - wall.y) * 28);
    ctx.scale(structure.width, structure.height);
  }
  if (scene === 'orchard') {
    rect(ctx, '#425a49', 5, 5, 18, 18);
    rect(ctx, '#77917a', 7, 7, 6, 14);
    rect(ctx, '#8da189', 15, 7, 6, 14);
    rect(ctx, '#c3b47f', 5, 13, 18, 2);
  } else if (scene === 'freight') {
    for (let at = 5; at < 24; at += 5) {
      rect(ctx, '#7b4036', at, 4, 2, 20);
      rect(ctx, '#d89872', at + 2, 4, 1, 20);
    }
    if (bottom) rect(ctx, '#ead0a0', 7, 20, 11, 3);
  } else if (scene === 'workshop') {
    rect(ctx, '#4b5550', 4, 6, 20, 16);
    rect(ctx, '#c58a5a', 7, 4, 14, 20);
    rect(ctx, '#e7b47a', 8, 6, 2, 16);
    rect(ctx, '#547e78', 4, 11, 20, 5);
    rect(ctx, '#a1c5af', 5, 11, 18, 1);
  } else if (scene === 'relay') {
    rect(ctx, '#526375', 5, 5, 18, 18);
    rect(ctx, '#c3c4ae', 7, 7, 14, 8);
    for (let at = 8; at < 22; at += 4) rect(ctx, '#384451', at, 18, 2, 4);
    rect(ctx, '#d7a961', 19, 5, 4, 5);
  } else if (scene === 'harbor') {
    rect(ctx, '#467970', 5, 5, 18, 18);
    rect(ctx, '#a2c9b3', 8, 7, 12, 3);
    for (let at = 12; at < 22; at += 4) rect(ctx, '#244b4c', 8, at, 12, 2);
    rect(ctx, '#d68d75', 4, 4, 4, 4);
  } else {
    rect(ctx, '#454f51', 4, 12, 20, 2);
    rect(ctx, '#b2b9a5', 4, 5, 20, 2);
    rect(ctx, '#414e4a', 13, 5, 2, 7);
    rect(ctx, '#414e4a', 8, 14, 2, 9);
    rect(ctx, '#758657', 18, 17, 6, 6);
  }
  if (treatment === 'toybox') {
    // Enamel face within a timber frame and four oversized recessed fittings.
    rect(ctx, '#dfc291', 3, 3, 22, 2);
    rect(ctx, '#674831', 3, 23, 22, 2);
    for (const [a, b] of [
      [4, 4],
      [21, 4],
      [4, 21],
      [21, 21],
    ]) {
      rect(ctx, '#efd7a4', a, b, 3, 3);
      rect(ctx, '#745638', a + 1, b + 1, 1, 1);
    }
  } else if (treatment === 'atmospheric-ruins') {
    ctx.globalAlpha = 0.38;
    rect(ctx, '#34494a', 3, 3, 22, 22);
    ctx.globalAlpha = 1;
    for (const [a, b] of [
      [12, 3],
      [11, 7],
      [14, 11],
      [13, 15],
    ])
      rect(ctx, '#283b39', a, b, 2, 5);
    rect(ctx, '#638258', 3, 18, 5, 6);
    rect(ctx, '#9aaa6a', 5, 20, 2, 3);
  } else if (treatment === 'night-arcade') {
    ctx.globalAlpha = 0.76;
    rect(ctx, '#172a3b', 3, 3, 22, 22);
    ctx.globalAlpha = 1;
    rect(ctx, p.accent, 6, 6, 16, 1);
    rect(ctx, p.accent, 6, 7, 1, 9);
    rect(ctx, '#7cbdc9', 16, 15, 6, 2);
    rect(ctx, '#7cbdc9', 21, 11, 1, 10);
  }
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
  treatment = world.treatment;
  const key = `${selected}/${treatment}`;
  if (!backdrops.has(document)) backdrops.set(document, new Map());
  const cache = backdrops.get(document);
  if (cache.has(key)) return cache.get(key);
  const canvas = canvasFactory(document)();
  if (!canvas?.toDataURL) return null;
  canvas.width = 384;
  canvas.height = 288;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
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
  cache.set(key, url);
  return url;
}
