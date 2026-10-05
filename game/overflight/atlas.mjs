import {
  drawHuntActor,
  INDUSTRIAL_ROSTER_ART_REVISION,
  INDUSTRIAL_ROSTER_SAMPLES,
} from '../hunt/actor-art.mjs';
import { drawMachinerySpecimen } from '../presentation/industrial-machinery.mjs';
import { industrialMaterialPixels } from '../presentation/industrial-materials.mjs';
import {
  OVERFLIGHT_FIELD_KIT_IDS,
  overflightFieldKitArt,
} from '../presentation/overflight-field-kit-art.mjs';
import { actorImagePaintMetrics } from '../ui/actor-presentation.mjs';
import { paintRotor } from '../ui/rotor-presentation.mjs';
import { paintOverflightEffectGeometry } from '../presentation/overflight-motion.mjs';
import { OVERFLIGHT_SOLDIERS, OVERFLIGHT_MACHINERY } from './project.mjs';

export const OVERFLIGHT_ATLAS_BUDGET = 32 * 1024 * 1024;
export const OVERFLIGHT_WARDROBES = Object.freeze(['tactical', 'rivals', 'arcade']);
const CELL = 68,
  COLUMNS = 15;
const geometryFrames = ['ring', 'disc', 'line', 'hero-ring', 'arrow', 'shadow', 'bar'];
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
export function overflightAtlasInventory() {
  const entries = [];
  const add = (id, kind, size, extra = {}) =>
    entries.push({ id, kind, width: size, height: size, ...extra });
  for (const family of OVERFLIGHT_SOLDIERS)
    for (const wardrobe of OVERFLIGHT_WARDROBES)
      for (let pose = 0; pose < 6; pose++)
        add(`soldier:${family}:${wardrobe}:${pose}`, 'soldier', 32, { family, wardrobe, pose });
  for (const family of OVERFLIGHT_MACHINERY)
    for (let pose = 0; pose < 6; pose++)
      add(`machine:${family}:${pose}`, 'machine', 64, { family, pose });
  for (let pose = 0; pose < 4; pose++) add(`hero:${pose}`, 'hero', 48, { pose });
  for (const slot of OVERFLIGHT_FIELD_KIT_IDS) add(slot, 'equipment', 16, { slot });
  for (const id of geometryFrames) add(id, 'geometry', 48);
  for (let i = 0; i < entries.length; i++) {
    const frame = entries[i];
    frame.x = (i % COLUMNS) * CELL + 2;
    frame.y = Math.floor(i / COLUMNS) * CELL + 2;
  }
  const width = CELL * COLUMNS,
    height = Math.ceil(entries.length / COLUMNS) * CELL;
  const baseRGBABytes = width * height * 4 + 256 * 256 * 4;
  if (baseRGBABytes > OVERFLIGHT_ATLAS_BUDGET)
    throw new RangeError('Overflight atlas exceeds the 32 MiB budget.');
  return Object.freeze({
    width,
    height,
    frames: Object.freeze(entries.map(Object.freeze)),
    textures: 2,
    baseRGBABytes,
    retainedCanvasBytes: baseRGBABytes,
    soldierFrames: OVERFLIGHT_SOLDIERS.length * OVERFLIGHT_WARDROBES.length * 6,
    machineryFrames: OVERFLIGHT_MACHINERY.length * 6,
    heroFrames: 4,
    equipmentFrames: OVERFLIGHT_FIELD_KIT_IDS.length,
  });
}

function canvasFor(document, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A 2D context is required to prepare the native artwork.');
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
    ctx.arc(center, center, id === 'hero-ring' ? 20 : 22, 0, Math.PI * 2);
    if (id === 'hero-ring') {
      ctx.strokeStyle = '#09120f';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
    }
    if (id === 'disc') ctx.fill();
    else ctx.stroke();
    if (id === 'hero-ring') {
      ctx.fillRect(23, 0, 2, 5);
      ctx.fillRect(23, 43, 2, 5);
      ctx.fillRect(0, 23, 5, 2);
      ctx.fillRect(43, 23, 5, 2);
    }
  }
}

/** Prepare all native recipes once. The returned canvas sources remain alive
 * for Phaser's WebGL restoration and are released only after Game.destroy. */
export function bakeOverflightAtlas(appearance, document = globalThis.document) {
  const inventory = overflightAtlasInventory();
  const { canvas, ctx } = canvasFor(document, inventory.width, inventory.height);
  const temp = canvasFor(document, 64, 64);
  const hero =
    appearance?.snapshot?.image('player.scout.detailed') ??
    appearance?.snapshot?.image('player.scout.compact');
  if (!hero?.image) throw new Error('Overflight requires the accepted native Scout artwork.');
  const geometry = hero.geometry;
  const heroMetrics = actorImagePaintMetrics(32, geometry);
  for (const frame of inventory.frames) {
    ctx.save();
    ctx.translate(frame.x, frame.y);
    if (frame.kind === 'soldier') {
      drawHuntActor(ctx, 0, 0, 32, frame.pose, {
        family: frame.family,
        cast: frame.wardrobe,
        artRevision: appearance?.artRevision ?? INDUSTRIAL_ROSTER_ART_REVISION,
        facingRadians: 0,
        shadow: false,
        detail: 'compact',
        animationClip: 'move',
        timeMs: soldierClips[frame.family].frames[frame.pose].start + 1,
      });
    } else if (frame.kind === 'machine') {
      drawMachinerySpecimen(ctx, frame.family, {
        x: 32,
        y: 32,
        size: 64,
        heading: 0,
        frame: { travelPhase: frame.pose / 6, phase: frame.pose / 3, reduced: false },
      });
    } else if (frame.kind === 'hero') {
      ctx.translate(24, 24);
      const { width, height } = heroMetrics;
      ctx.drawImage(
        hero.image,
        -(geometry?.pivot?.x ?? 0.5) * width,
        -(geometry?.pivot?.y ?? 0.5) * height,
        width,
        height,
      );
      for (const anchor of geometry?.rotors ?? []) {
        ctx.save();
        ctx.translate(anchor.x * width, anchor.y * height);
        paintRotor(ctx, {
          radius: 0.16 * anchor.radiusScale * width,
          phase:
            ((frame.pose * Math.PI) / 12) * anchor.direction +
            ((anchor.phaseDegrees ?? 0) * Math.PI) / 180,
          direction: anchor.direction,
          bladeCount: anchor.bladeCount,
          pixel: Math.max(width / 64, 0.1),
        });
        ctx.restore();
      }
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
  const ground = canvasFor(document, 256, 256);
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
  temp.canvas.width = 0;
  temp.canvas.height = 0;
  return {
    canvas,
    ground: ground.canvas,
    inventory,
    heroArtwork: Object.freeze({
      assetId: hero.asset?.id ?? null,
      rotorCount: geometry?.rotors?.length ?? 0,
      visibleDiameter: 32,
      bakedFrameSize: 48,
      paintedWidth: heroMetrics.width,
      paintedHeight: heroMetrics.height,
    }),
    dispose() {
      canvas.width = 0;
      canvas.height = 0;
      ground.canvas.width = 0;
      ground.canvas.height = 0;
    },
  };
}

export function overflightEnemyFrame(enemy, time, reduced = false, cast = 'authored') {
  if (machineryFrames[enemy.family]) {
    const pose = reduced ? 0 : Math.floor(time * 9 + (enemy.id % 6)) % 6;
    return machineryFrames[enemy.family][pose];
  }
  const clip = soldierClips[enemy.family];
  if (!clip) throw new TypeError(`Unknown native Overflight family: ${enemy.family}`);
  const selected = OVERFLIGHT_WARDROBES.indexOf(cast);
  const wardrobe = selected >= 0 ? selected : (enemy.wardrobe ?? 0) % OVERFLIGHT_WARDROBES.length;
  const phase = reduced ? 0 : (time * 1000 + ((enemy.id % 6) * clip.duration) / 6) % clip.duration;
  let pose = 0;
  while (pose < clip.frames.length - 1 && phase >= clip.frames[pose].end) pose++;
  return clip.ids[wardrobe][pose];
}
