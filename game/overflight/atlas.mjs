import {
  drawHuntActor,
  INDUSTRIAL_ROSTER_ART_REVISION,
  INDUSTRIAL_ROSTER_SAMPLES,
} from '../hunt/actor-art.mjs';
import {
  drawMachinerySpecimen,
  drawMachineryDebris,
} from '../presentation/industrial-machinery.mjs';
import { drawHuntRemains, createHuntDestruction } from '../hunt/destruction.mjs';
import { createDestructionBudget } from '../hunt/destruction-budget.mjs';
import { industrialMaterialPixels } from '../presentation/industrial-materials.mjs';
import {
  OVERFLIGHT_FIELD_KIT_IDS,
  overflightFieldKitArt,
} from '../presentation/overflight-field-kit-art.mjs';
import { actorImagePaintMetrics } from '../ui/actor-presentation.mjs';
import { paintRotor } from '../ui/rotor-presentation.mjs';
import { paintOverflightEffectGeometry } from '../presentation/overflight-motion.mjs';
import { OVERFLIGHT_SOLDIERS, OVERFLIGHT_MACHINERY } from './project.mjs';
import { paintOverflightWorld } from '../presentation/overflight-world-art.mjs';
import { OVERFLIGHT_COMBAT_CLIPS, overflightEnemyPresentation } from './presentation-state.mjs';
import { prepareOverflightActorOverrides } from './actor-overrides.mjs';

export const OVERFLIGHT_ATLAS_BUDGET = 32 * 1024 * 1024;
export const OVERFLIGHT_WARDROBES = Object.freeze(['tactical', 'rivals', 'arcade']);
export const OVERFLIGHT_HERO_FRAMES = 12;
export const OVERFLIGHT_ATLAS_MAX_EDGE = 2048;
const GUTTER = 2;
const geometryFrames = ['ring', 'disc', 'line', 'arrow', 'shadow', 'bar'];

/** Native frame and motor anchors stay intact. Larger prop sweeps leave a
 * narrow battery/body between the motors, like the existing ten-inch FPV rig. */
export function overflightHeroGeometry(geometry) {
  const metrics = actorImagePaintMetrics(34, geometry);
  const rotors = (geometry?.rotors ?? []).map((anchor) => {
    const x = anchor.x * metrics.width,
      y = anchor.y * metrics.height;
    let radius = 0.16 * anchor.radiusScale * metrics.width * 1.75;
    for (const other of geometry.rotors) {
      if (other === anchor) continue;
      radius = Math.min(
        radius,
        Math.hypot((other.x - anchor.x) * metrics.width, (other.y - anchor.y) * metrics.height) *
          0.47,
      );
    }
    radius = Math.max(0, Math.min(radius, 31 - Math.abs(x), 31 - Math.abs(y)));
    return Object.freeze({ ...anchor, x, y, radius });
  });
  return Object.freeze({
    ...metrics,
    rotors: Object.freeze(rotors),
    frameSize: 64,
  });
}
const soldierClips = Object.fromEntries(
  OVERFLIGHT_SOLDIERS.map((family) => {
    const descriptor = INDUSTRIAL_ROSTER_SAMPLES[family];
    let duration = 0;
    const frames = descriptor.clips.move.frames.map((id) => {
      const start = duration;
      duration += descriptor.frames.find((frame) => frame.id === id).durationMs;
      return { start, end: duration };
    });
    return [
      family,
      {
        duration,
        frames,
        ids: OVERFLIGHT_WARDROBES.map((wardrobe) =>
          frames.map((_, pose) => `soldier:${family}:${wardrobe}:${pose}`),
        ),
      },
    ];
  }),
);
const machineryFrames = Object.fromEntries(
  OVERFLIGHT_MACHINERY.map((family) => [
    family,
    Array.from({ length: 6 }, (_, pose) => `machine:${family}:${pose}`),
  ]),
);

/** Inventory is built before canvas allocation. This is base RGBA GPU storage;
 * there are no mipmaps. Retained CPU source canvases use the same byte count. */
export function overflightAtlasInventory({
  maxTextureSize = OVERFLIGHT_ATLAS_MAX_EDGE,
  presentation = null,
  arena = { width: 2880, height: 1080 },
  actorOverrides = null,
} = {}) {
  const entries = [];
  const add = (id, kind, size, extra = {}) =>
    entries.push({ id, kind, width: size, height: size, ...extra });
  for (const family of OVERFLIGHT_SOLDIERS)
    for (const wardrobe of OVERFLIGHT_WARDROBES)
      for (let pose = 0; pose < 6; pose++)
        if (!actorOverrides?.has(family, wardrobe))
          add(`soldier:${family}:${wardrobe}:${pose}`, 'soldier', 32, {
            family,
            wardrobe,
            pose,
          });
  for (const family of OVERFLIGHT_MACHINERY)
    for (let pose = 0; pose < 6; pose++)
      if (!actorOverrides?.has(family))
        add(`machine:${family}:${pose}`, 'machine', 64, { family, pose });
  for (let pose = 0; pose < OVERFLIGHT_HERO_FRAMES; pose++)
    add(`hero:${pose}`, 'hero', 64, { pose });
  for (const role of ['sweeper', 'breaker'])
    for (let pose = 0; pose < OVERFLIGHT_HERO_FRAMES; pose++)
      add(`escort:${role}:${pose}`, 'hero', 64, { role, pose });
  for (const [state, clip] of Object.entries(OVERFLIGHT_COMBAT_CLIPS)) {
    for (const family of OVERFLIGHT_SOLDIERS)
      for (const wardrobe of OVERFLIGHT_WARDROBES)
        for (let pose = 0; pose < 2; pose++)
          if (!actorOverrides?.has(family, wardrobe))
            add(`soldier:${family}:${wardrobe}:${state}:${pose}`, 'soldier', 32, {
              family,
              wardrobe,
              state,
              clip,
              pose,
            });
    for (const family of OVERFLIGHT_MACHINERY)
      for (let pose = 0; pose < 2; pose++)
        if (!actorOverrides?.has(family))
          add(`machine:${family}:${state}:${pose}`, 'machine', 64, {
            family,
            state,
            pose,
          });
  }
  entries.push(...(actorOverrides?.entries ?? []));
  for (const slot of OVERFLIGHT_FIELD_KIT_IDS) add(slot, 'equipment', 16, { slot });
  for (const id of geometryFrames) add(id, 'geometry', 48);
  for (const family of OVERFLIGHT_SOLDIERS)
    for (const wardrobe of OVERFLIGHT_WARDROBES)
      for (const mode of ['clean', 'debris', 'blood']) {
        const suffix = `soldier:${family}:${wardrobe}:${mode}`;
        add(`remains:${suffix}`, 'remains', 48, { family, wardrobe, mode });
        for (let pose = 0; pose < 4; pose++)
          add(`defeat:${suffix}:${pose}`, 'defeat', 64, {
            family,
            wardrobe,
            mode,
            pose,
          });
      }
  for (const family of OVERFLIGHT_MACHINERY)
    for (const mode of ['clean', 'debris']) {
      add(`remains:machine:${family}:${mode}`, 'scrap', 48, { family, mode });
      for (let pose = 0; pose < 4; pose++)
        add(`defeat:machine:${family}:${mode}:${pose}`, 'scrap-motion', 64, {
          family,
          mode,
          pose,
        });
    }
  const packed = packOverflightAtlasFrames(entries, { maxTextureSize });
  const worldTiles = [];
  if (presentation) {
    if (
      ![arena.width, arena.height].every(
        (value) => Number.isInteger(value) && value > 0 && value <= 8192,
      )
    )
      throw new RangeError('Overflight world preparation needs bounded arena dimensions.');
    const tileWidth = Math.min(960, packed.maxTextureSize),
      tileHeight = Math.min(540, packed.maxTextureSize);
    for (let y = 0; y < arena.height; y += tileHeight)
      for (let x = 0; x < arena.width; x += tileWidth)
        worldTiles.push(
          Object.freeze({
            index: worldTiles.length,
            x,
            y,
            width: Math.min(tileWidth, arena.width - x),
            height: Math.min(tileHeight, arena.height - y),
          }),
        );
  }
  const groundTileEdge = Math.min(256, packed.maxTextureSize);
  const groundRGBABytes = presentation ? 0 : groundTileEdge * groundTileEdge * 4;
  const worldRGBABytes = worldTiles.reduce((sum, tile) => sum + tile.width * tile.height * 4, 0);
  const baseRGBABytes = packed.spriteRGBABytes + groundRGBABytes + worldRGBABytes;
  return Object.freeze({
    ...packed,
    textures: packed.pages.length + (presentation ? worldTiles.length : 1),
    worldRGBABytes,
    worldTiles: Object.freeze(worldTiles),
    baseRGBABytes,
    groundRGBABytes,
    groundTileEdge,
    retainedCanvasBytes: baseRGBABytes,
    preparationScratchBytes: 64 * 64 * 4,
    customActorFrames: actorOverrides?.entries.length ?? 0,
    acceptedActorOverrides: actorOverrides?.summary ?? [],
    combatStateFrames:
      Object.keys(OVERFLIGHT_COMBAT_CLIPS).length *
      (OVERFLIGHT_SOLDIERS.length * OVERFLIGHT_WARDROBES.length + OVERFLIGHT_MACHINERY.length) *
      2,
    escortFrames: OVERFLIGHT_HERO_FRAMES * 2,
    soldierFrames: OVERFLIGHT_SOLDIERS.length * OVERFLIGHT_WARDROBES.length * 6,
    machineryFrames: OVERFLIGHT_MACHINERY.length * 6,
    heroFrames: OVERFLIGHT_HERO_FRAMES,
    equipmentFrames: OVERFLIGHT_FIELD_KIT_IDS.length,
    remainsFrames:
      OVERFLIGHT_SOLDIERS.length * OVERFLIGHT_WARDROBES.length * 3 +
      OVERFLIGHT_MACHINERY.length * 2,
    defeatFrames:
      (OVERFLIGHT_SOLDIERS.length * OVERFLIGHT_WARDROBES.length * 3 +
        OVERFLIGHT_MACHINERY.length * 2) *
      4,
  });
}

/** Stable height-first shelf packing uses actual frame dimensions and gutters.
 * Page caps are checked before allocating canvases, including low-end devices. */
export function packOverflightAtlasFrames(
  entries,
  { maxTextureSize = OVERFLIGHT_ATLAS_MAX_EDGE } = {},
) {
  const edge = Math.min(OVERFLIGHT_ATLAS_MAX_EDGE, Math.floor(maxTextureSize));
  if (!Number.isFinite(edge) || edge < 68)
    throw new RangeError('Overflight requires textures of at least 68 pixels.');
  const frames = entries.map((frame) => ({ ...frame }));
  const ids = new Set();
  for (const frame of frames) {
    if (ids.has(frame.id)) throw new TypeError(`Duplicate Overflight frame: ${frame.id}`);
    ids.add(frame.id);
    if (
      ![frame.width, frame.height].every(
        (value) => Number.isInteger(value) && value > 0 && value + 2 * GUTTER <= edge,
      )
    )
      throw new RangeError(`Overflight frame exceeds device texture size: ${frame.id}`);
  }
  const ordered = frames
    .map((frame, index) => ({ frame, index }))
    .sort(
      (a, b) =>
        b.frame.height - a.frame.height || b.frame.width - a.frame.width || a.index - b.index,
    );
  const pages = [];
  let page,
    x = 0,
    y = 0,
    rowHeight = 0;
  for (const { frame } of ordered) {
    const width = frame.width + 2 * GUTTER,
      height = frame.height + 2 * GUTTER;
    if (!page) {
      page = { index: pages.length, width: 0, height: 0, frames: [] };
      pages.push(page);
    }
    if (x + width > edge) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    if (y + height > edge) {
      page = { index: pages.length, width: 0, height: 0, frames: [] };
      pages.push(page);
      x = y = rowHeight = 0;
    }
    Object.assign(frame, { page: page.index, x: x + GUTTER, y: y + GUTTER });
    page.frames.push(frame);
    page.width = Math.max(page.width, x + width);
    page.height = Math.max(page.height, y + height);
    x += width;
    rowHeight = Math.max(rowHeight, height);
  }
  const spriteRGBABytes = pages.reduce((sum, page) => sum + page.width * page.height * 4, 0);
  if (spriteRGBABytes > OVERFLIGHT_ATLAS_BUDGET)
    throw new RangeError('Overflight sprite atlases exceed the 32 MiB budget.');
  return Object.freeze({
    width: Math.max(0, ...pages.map((page) => page.width)),
    height: Math.max(0, ...pages.map((page) => page.height)),
    maxTextureSize: edge,
    spriteRGBABytes,
    frames: Object.freeze(frames.map(Object.freeze)),
    pages: Object.freeze(
      pages.map((page) => Object.freeze({ ...page, frames: Object.freeze(page.frames) })),
    ),
  });
}

function canvasFor(document, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.width = canvas.height = 0;
    throw new Error('A 2D context is required to prepare the native artwork.');
  }
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function paintPixels(ctx, pixels, x = 0, y = 0) {
  const data = ctx.createImageData(pixels.width, pixels.height);
  data.data.set(pixels.rgba);
  ctx.putImageData(data, x, y);
}

function paintGeometry(ctx, id, size) {
  if (paintOverflightEffectGeometry(ctx, id, { size })) return;
  const center = size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  if (id === 'bar') ctx.fillRect(0, 0, size, size);
  else if (id === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(35, center);
    ctx.lineTo(15, 13);
    ctx.lineTo(20, center);
    ctx.lineTo(15, 35);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'shadow') {
    ctx.fillStyle = '#09120f';
    ctx.beginPath();
    ctx.ellipse(center, center, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(center, center, 22, 0, Math.PI * 2);
    if (id === 'disc') ctx.fill();
    else ctx.stroke();
  }
}

function paintEscortRole(ctx, role) {
  // Both attachments use the native airframe, leave its rotors visible, and
  // remain recognizable without a color distinction or an enclosing ring.
  ctx.fillStyle = '#101c1b';
  if (role === 'sweeper') {
    ctx.fillRect(-12, 7, 24, 7);
    ctx.fillStyle = '#78bcaa';
    for (const x of [-9, -2, 5]) ctx.fillRect(x, 8, 4, 5);
    ctx.fillStyle = '#d5dac0';
    ctx.fillRect(-10, 7, 20, 1);
  } else {
    ctx.fillRect(-5, -23, 10, 19);
    ctx.fillStyle = '#b89d65';
    ctx.fillRect(-3, -20, 6, 13);
    ctx.fillStyle = '#eee0a6';
    ctx.fillRect(-2, -23, 4, 4);
    ctx.fillStyle = '#42584e';
    ctx.fillRect(-7, -10, 14, 3);
  }
}

function paintMachineryState(ctx, state, pose) {
  // Chassis-mounted panels signal real state rather than screen-wide rings.
  if (state === 'preparing' || state === 'attacking') {
    ctx.fillStyle = '#182521';
    ctx.fillRect(27, 8 + pose, 10, 10);
    ctx.fillStyle = state === 'attacking' ? '#ffe8ac' : '#cc9270';
    ctx.fillRect(29, 7 + pose, 6, state === 'attacking' ? 7 : 3);
  } else if (state === 'exposed' || state === 'armor-break') {
    ctx.fillStyle = '#101b17';
    ctx.fillRect(23, 24, 18, 15);
    ctx.fillStyle = '#9ebca1';
    ctx.fillRect(20 - pose, 23, 4, 15);
    ctx.fillRect(40 + pose, 23, 4, 15);
    ctx.fillStyle = state === 'armor-break' ? '#f2d196' : '#51675b';
    ctx.fillRect(27, 28, 10, 7);
  } else if (state === 'stagger') {
    ctx.fillStyle = '#f1d3a0';
    ctx.fillRect(15, 25, 5, 2);
    ctx.fillRect(43, 35, 6, 2);
  }
}

/** Prepare all native recipes once. The returned canvas sources remain alive
 * for Phaser's WebGL restoration and are released only after Game.destroy. */
export function bakeOverflightAtlas(appearance, document = globalThis.document, options = {}) {
  const actorOverrides = prepareOverflightActorOverrides(appearance?.snapshot);
  const inventory = overflightAtlasInventory({ ...options, actorOverrides });
  const allocated = [];
  const prepareCanvas = (width, height) => {
    const surface = canvasFor(document, width, height);
    allocated.push(surface.canvas);
    return surface;
  };
  const release = () => {
    for (const canvas of allocated) canvas.width = canvas.height = 0;
  };
  try {
    const pages = inventory.pages.map((page) => prepareCanvas(page.width, page.height));
    const temp = prepareCanvas(64, 64);
    const playerSlot = appearance?.playerSlot ?? 'player.scout.detailed';
    if (
      !/^player\.(scout|bomber|carrier|interceptor|fiber|impact|trapper)\.(detailed|compact)$/.test(
        playerSlot,
      )
    )
      throw new Error('Overflight requires an accepted native player slot.');
    const hero =
      appearance?.snapshot?.image(playerSlot) ??
      appearance?.snapshot?.image(playerSlot.replace(/\.detailed$/, '.compact'));
    if (!hero?.image) throw new Error('Overflight requires the selected native player artwork.');
    const geometry = hero.geometry;
    const heroMetrics = overflightHeroGeometry(geometry);
    // Bake the real shared defeat animation once with an isolated preparation
    // budget. This never takes the live game's or a settings preview's FX lease.
    const defeatBudget = createDestructionBudget({ now: () => 0 });
    const defeat = createHuntDestruction({
      budget: defeatBudget,
      now: () => 0,
      artRevision: appearance?.artRevision ?? INDUSTRIAL_ROSTER_ART_REVISION,
    });
    for (const frame of inventory.frames) {
      const ctx = pages[frame.page].ctx;
      ctx.save();
      ctx.translate(frame.x, frame.y);
      if (frame.kind === 'custom-actor') {
        const custom = frame.override;
        if (custom.descriptor?.rig === 'overhead-soldier.v1') {
          drawHuntActor(ctx, 0, 0, frame.width, 0, {
            family: custom.family,
            cast: custom.wardrobe,
            artRevision: INDUSTRIAL_ROSTER_ART_REVISION,
            facingRadians: 0,
            shadow: false,
            detail: 'compact',
            animation: custom.descriptor,
            animationClip: frame.clip,
            timeMs: frame.timeMs,
          });
        } else {
          const region = frame.sample?.region;
          const geometry = custom.source.geometry;
          const metrics = actorImagePaintMetrics(
            frame.width,
            region ? { ...geometry, frame: region } : geometry,
          );
          const x = frame.width / 2 - (geometry?.pivot?.x ?? 0.5) * metrics.width;
          const y = frame.height / 2 - (geometry?.pivot?.y ?? 0.5) * metrics.height;
          ctx.beginPath();
          ctx.rect(0, 0, frame.width, frame.height);
          ctx.clip();
          if (region)
            ctx.drawImage(
              custom.source.image,
              region.x,
              region.y,
              region.width,
              region.height,
              x,
              y,
              metrics.width,
              metrics.height,
            );
          else ctx.drawImage(custom.source.image, x, y, metrics.width, metrics.height);
        }
      } else if (frame.kind === 'soldier') {
        drawHuntActor(ctx, 0, 0, 32, frame.pose, {
          family: frame.family,
          cast: frame.wardrobe,
          artRevision: appearance?.artRevision ?? INDUSTRIAL_ROSTER_ART_REVISION,
          facingRadians: 0,
          shadow: false,
          detail: 'compact',
          animationClip: frame.clip ?? 'move',
          state:
            frame.state === 'exposed'
              ? 'recover'
              : frame.state === 'stagger'
                ? 'blocked'
                : frame.state === 'armor-break'
                  ? 'caught'
                  : undefined,
          phase: frame.state === 'preparing' ? 'warning' : undefined,
          timeMs: frame.clip
            ? frame.pose
              ? INDUSTRIAL_ROSTER_SAMPLES[frame.family].frames.find(
                  (pose) =>
                    pose.id === INDUSTRIAL_ROSTER_SAMPLES[frame.family].clips[frame.clip].frames[0],
                ).durationMs + 1
              : 1
            : soldierClips[frame.family].frames[frame.pose].start + 1,
        });
      } else if (frame.kind === 'machine') {
        drawMachinerySpecimen(ctx, frame.family, {
          x: 32,
          y: 32,
          size: 64,
          heading: 0,
          frame: {
            travelPhase: frame.state ? 0 : frame.pose / 6,
            phase: frame.pose / 3,
            reduced: false,
          },
        });
        if (frame.state) paintMachineryState(ctx, frame.state, frame.pose);
      } else if (frame.kind === 'hero') {
        ctx.translate(32, 32);
        const { width, height } = heroMetrics;
        ctx.drawImage(
          hero.image,
          -(geometry?.pivot?.x ?? 0.5) * width,
          -(geometry?.pivot?.y ?? 0.5) * height,
          width,
          height,
        );
        for (const anchor of heroMetrics.rotors) {
          ctx.save();
          ctx.translate(anchor.x, anchor.y);
          paintRotor(ctx, {
            radius: anchor.radius,
            phase:
              ((frame.pose * Math.PI * 2) / (OVERFLIGHT_HERO_FRAMES * anchor.bladeCount)) *
                anchor.direction +
              ((anchor.phaseDegrees ?? 0) * Math.PI) / 180,
            direction: anchor.direction,
            bladeCount: anchor.bladeCount,
            blurOpacity: 0.1,
            pixel: Math.max(width / 64, 0.1),
          });
          ctx.restore();
        }
        if (frame.role) paintEscortRole(ctx, frame.role);
      } else if (frame.kind === 'remains' || frame.kind === 'defeat') {
        ctx.translate(frame.width / 2, frame.height / 2);
        const mark = {
          id: frame.family,
          family: frame.family,
          cast: frame.wardrobe,
          tick: 0,
          x: 0,
          y: 0,
          cause: 'capture',
        };
        const settings = {
          brutal: frame.mode !== 'clean',
          blood: frame.mode === 'blood',
          artRevision: appearance?.artRevision ?? INDUSTRIAL_ROSTER_ART_REVISION,
        };
        if (frame.kind === 'remains') drawHuntRemains(ctx, mark, { ...settings, unit: 1.35 });
        else {
          defeat.reset();
          const key = {},
            view = { valid: true, eliminations: [] };
          defeat.advance(view, 0, { ...settings, key });
          view.eliminations.push(mark);
          defeat.advance(view, 0, { ...settings, key });
          for (let step = 0; step < frame.pose; step++)
            defeat.advance(view, 0.08, { ...settings, key });
          defeat.draw(ctx, { unit: 1.35 });
        }
      } else if (frame.kind === 'scrap' || frame.kind === 'scrap-motion') {
        drawMachineryDebris(ctx, frame.family, {
          x: frame.width / 2,
          y: frame.height / 2,
          size: 36,
          brutal: frame.mode !== 'clean',
          progress: frame.kind === 'scrap' ? 1 : frame.pose / 3,
        });
      } else if (frame.kind === 'equipment') {
        const override = appearance?.snapshot?.image(frame.slot);
        if (override?.image) ctx.drawImage(override.image, 0, 0, 16, 16);
        else {
          // putImageData ignores transforms: upload on the scratch canvas first.
          temp.ctx.clearRect(0, 0, 64, 64);
          paintPixels(temp.ctx, overflightFieldKitArt(frame.slot));
          ctx.drawImage(temp.canvas, 0, 0, 16, 16, 0, 0, 16, 16);
        }
      } else paintGeometry(ctx, frame.id, frame.width);
      ctx.restore();
    }
    defeat.reset();
    defeatBudget.clear();
    const worldTiles = inventory.worldTiles.map((tile) => {
      const surface = prepareCanvas(tile.width, tile.height);
      surface.ctx.translate(-tile.x, -tile.y);
      paintOverflightWorld(
        surface.ctx,
        options.presentation,
        options.arena ?? { width: 2880, height: 1080 },
        { image: (slot) => appearance?.snapshot?.image?.(slot) },
      );
      return { ...tile, canvas: surface.canvas };
    });
    let ground = null;
    if (!worldTiles.length) {
      ground = prepareCanvas(inventory.groundTileEdge, inventory.groundTileEdge);
      paintPixels(temp.ctx, industrialMaterialPixels({ width: 64, height: 64 }, 'earth'));
      ground.ctx.fillStyle = '#172a22';
      ground.ctx.fillRect(0, 0, 256, 256);
      ground.ctx.globalAlpha = 0.12;
      for (let index = 0; index < 80; index++) {
        const x = (index * 97 + index * index * 3 + 23) % 256;
        const y = (index * 53 + index * index * 7 + 17) % 256;
        ground.ctx.drawImage(temp.canvas, (index * 13) % 48, (index * 7) % 48, 4, 2, x, y, 4, 2);
      }
      ground.ctx.globalAlpha = 1;
      // Quiet soil and flattened grass share the existing industrial material;
      // deterministic decoration consumes none of the encounter/draft RNG.
      for (let index = 0; index < 190; index++) {
        const x = (index * 97 + 23) % 256,
          y = (index * 53 + 17) % 256;
        ground.ctx.fillStyle = index % 4 ? '#24392b' : '#334231';
        ground.ctx.fillRect(x, y, (index % 3) + 1, 1);
      }
    }
    temp.canvas.width = 0;
    temp.canvas.height = 0;
    return {
      canvas: pages[0].canvas,
      pages: pages.map((page) => page.canvas),
      ground: ground?.canvas ?? null,
      worldTiles,
      inventory,
      enemyFrame(enemy, time, reduced = false, cast = 'authored', presentation = null) {
        const state = presentation ?? overflightEnemyPresentation(enemy, time);
        return (
          actorOverrides.frame(enemy, time, reduced, cast, state) ??
          overflightEnemyFrame(enemy, time, reduced, cast, state)
        );
      },
      heroArtwork: Object.freeze({
        assetId: hero.asset?.id ?? null,
        playerSlot,
        rotorCount: heroMetrics.rotors.length,
        visibleDiameter: 34,
        bakedFrameSize: 64,
        rotorFrames: OVERFLIGHT_HERO_FRAMES,
        rotorRadii: heroMetrics.rotors.map((rotor) => rotor.radius),
        paintedWidth: heroMetrics.width,
        paintedHeight: heroMetrics.height,
      }),
      dispose: release,
    };
  } catch (error) {
    release();
    throw error;
  }
}

export function overflightEnemyFrame(
  enemy,
  time,
  reduced = false,
  cast = 'authored',
  presentation = null,
) {
  const state = presentation ?? overflightEnemyPresentation(enemy, time);
  const statePose = reduced ? 0 : Math.min(1, Math.floor((state.elapsed ?? 0) / 0.15));
  if (machineryFrames[enemy.family]) {
    if (state.state !== 'moving') return `machine:${enemy.family}:${state.state}:${statePose}`;
    const pose = reduced ? 0 : Math.floor(time * 9 + (enemy.id % 6)) % 6;
    return machineryFrames[enemy.family][pose];
  }
  const clip = soldierClips[enemy.family];
  if (!clip) throw new TypeError(`Unknown native Overflight family: ${enemy.family}`);
  const selected = OVERFLIGHT_WARDROBES.indexOf(cast);
  const wardrobe = selected >= 0 ? selected : (enemy.wardrobe ?? 0) % OVERFLIGHT_WARDROBES.length;
  if (state.state !== 'moving')
    return `soldier:${enemy.family}:${OVERFLIGHT_WARDROBES[wardrobe]}:${state.state}:${statePose}`;
  const phase = reduced ? 0 : (time * 1000 + ((enemy.id % 6) * clip.duration) / 6) % clip.duration;
  let pose = 0;
  while (pose < clip.frames.length - 1 && phase >= clip.frames[pose].end) pose++;
  return clip.ids[wardrobe][pose];
}
