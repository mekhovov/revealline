import {
  industrialMaterialPixels,
  INDUSTRIAL_ENVIRONMENT_REVISION,
} from '../presentation/industrial-materials.mjs';
import { drawMachinerySpecimen } from '../presentation/industrial-machinery.mjs';

export const CLASSIC_BOARD_SCENES = Object.freeze(['auto', 'orchard', 'workshop', 'relay']);
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
    wall: 'concrete',
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
  }),
});
const CHAPTER_SCENES = new Map([
  ...[
    'first-coils',
    'wide-turns',
    'island-circuits',
    'moving-quarry',
    'escape-lines',
    'field-supplies',
  ].map((id) => [`classic-snake-${id}`, 'orchard']),
  ...[
    'borderless-routes',
    'chicanes',
    'shared-circuits',
    'final-weave',
    'burst-timing',
    'route-windows',
    'moving-windows',
  ].map((id) => [`classic-snake-${id}`, 'workshop']),
  ...[
    'patrol-routes',
    'combined-pursuit',
    'twin-intercepts',
    'signal-tactics',
    'patrol-frontiers',
    'field-mastery',
  ].map((id) => [`classic-snake-${id}`, 'relay']),
]);
const fingerprint = (value) => {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
};

/** Cosmetic chapter selection never reads a run, its seed, or a random stream. */
export function resolveClassicBoardScene({
  boardScene = 'auto',
  chapterId = '',
  levelId = '',
} = {}) {
  if (Object.hasOwn(SCENES, boardScene)) return boardScene;
  if (CHAPTER_SCENES.has(chapterId)) return CHAPTER_SCENES.get(chapterId);
  const identity = chapterId || levelId;
  return identity ? ['orchard', 'workshop', 'relay'][fingerprint(identity) % 3] : 'orchard';
}
export const classicScenePalette = (scene) =>
  SCENES[resolveClassicBoardScene({ boardScene: scene })];

export function classicSceneMaterial(scene, { wall = false, variant = 0 } = {}) {
  const palette = classicScenePalette(scene);
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
        ? [79, 101, 119][channel] + (luminance - 125) * 0.72
        : palette.tint[channel] + (luminance - 110) * 0.15;
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
function texture(owner, scene, wall, variant) {
  if (!owner || typeof owner !== 'object') return null;
  if (!surfaces.has(owner)) surfaces.set(owner, new Map());
  const cache = surfaces.get(owner),
    key = `${scene}/${wall}/${variant}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = canvasFactory(owner)(),
    pixels = classicSceneMaterial(scene, { wall, variant });
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
export function drawClassicLivingGround(ctx, level, scene, { unit = 28, document } = {}) {
  const palette = classicScenePalette(scene);
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, level.width * unit, level.height * unit);
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const tile = texture(document, scene, false, (x * 7 + y * 11) % 4);
      if (tile) ctx.drawImage(tile, x * unit, y * unit, unit, unit);
      else if ((x + y) % 2) {
        ctx.fillStyle = palette.alternate;
        ctx.fillRect(x * unit, y * unit, unit, unit);
      }
      // Tiny chips become sparser toward the clear central routes.
      const edge = Math.min(x, y, level.width - x - 1, level.height - y - 1);
      if (edge < 2 && (x * 17 + y * 5) % 3 === 0) {
        ctx.fillStyle = scene === 'orchard' ? '#71804a' : '#7b8580';
        ctx.fillRect(x * unit + 4, y * unit + 17, 2, 2);
        ctx.fillStyle = palette.grid;
        ctx.fillRect(x * unit + 7, y * unit + 19, 3, 1);
      }
    }
}

export function drawClassicLivingWall(ctx, wall, scene, { unit = 28, document } = {}) {
  const x = wall.x * unit,
    y = wall.y * unit;
  const tile = texture(document, scene, true, (wall.x + wall.y) % 4);
  if (tile) ctx.drawImage(tile, x, y, unit, unit);
  else {
    ctx.fillStyle = '#4f6577';
    ctx.fillRect(x, y, unit, unit);
  }
  ctx.fillStyle = '#a2b5bd';
  ctx.fillRect(x + 1, y + 1, unit - 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, unit - 2);
  ctx.fillStyle = '#233742';
  ctx.fillRect(x, y + unit - 3, unit, 3);
  ctx.fillRect(x + unit - 2, y + 2, 2, unit - 2);
  ctx.strokeStyle = '#122932';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, unit - 1, unit - 1);
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
export function classicSceneBackdrop(scene, { document = globalThis.document } = {}) {
  if (!document || typeof document !== 'object') return null;
  const selected = resolveClassicBoardScene({ boardScene: scene });
  if (!backdrops.has(document)) backdrops.set(document, new Map());
  const cache = backdrops.get(document);
  if (cache.has(selected)) return cache.get(selected);
  const canvas = canvasFactory(document)();
  if (!canvas?.toDataURL) return null;
  canvas.width = 384;
  canvas.height = 288;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const material = texture(document, selected, false, 0);
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
  cache.set(selected, url);
  return url;
}
