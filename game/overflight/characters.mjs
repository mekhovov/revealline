import { CLASSES } from '../core/registry.mjs';
import { contentText } from '../i18n/content.mjs';
import { paintRotor } from '../ui/rotor-presentation.mjs';
import { overflightHeroGeometry, OVERFLIGHT_HERO_FRAMES } from './atlas.mjs';

export const DEFAULT_OVERFLIGHT_CHARACTER = 'scout';

// Only identity and presentation slots cross into Overflight. Native Solo
// abilities, movement, capacity and equipment descriptions are not adopted.
export const OVERFLIGHT_CHARACTERS = Object.freeze(
  CLASSES.map(({ id }) =>
    Object.freeze({
      id,
      slots: Object.freeze([`player.${id}.detailed`, `player.${id}.compact`]),
      rotorSlot: `player.${id}.rotors`,
    }),
  ),
);
export const OVERFLIGHT_CHARACTER_IMAGE_SLOTS = Object.freeze(
  OVERFLIGHT_CHARACTERS.flatMap(({ slots }) => slots),
);
const characters = new Map(OVERFLIGHT_CHARACTERS.map((entry) => [entry.id, entry]));
const nativeClasses = new Map(CLASSES.map((entry) => [entry.id, entry]));

/** Sanitize persisted/query preferences at the host boundary. Rendering uses
 * the strict resolver below, so an invalid active identity never changes craft. */
export function normalizeOverflightCharacterId(value) {
  return characters.has(value) ? value : DEFAULT_OVERFLIGHT_CHARACTER;
}

function character(id) {
  const entry = characters.get(id);
  if (!entry) throw new TypeError(`Unsupported Overflight character: ${String(id)}.`);
  return entry;
}

/** Read on each locale refresh; retain the shared exact-record translations. */
export function overflightCharacterName(id = DEFAULT_OVERFLIGHT_CHARACTER) {
  character(id);
  return contentText(nativeClasses.get(id), 'label');
}

/** Consume the accepted presentation snapshot (after the selected appearance
 * adapter), never manufacture a replacement image or infer geometry. A compact
 * fallback stays within the selected character and preserves custom overrides. */
export function resolveOverflightCharacter(snapshot, id = DEFAULT_OVERFLIGHT_CHARACTER) {
  const entry = character(id);
  if (typeof snapshot?.image !== 'function')
    throw new TypeError('Overflight characters require an accepted presentation snapshot.');
  for (const playerSlot of entry.slots) {
    const frame = snapshot.image(playerSlot);
    if (!frame?.image) continue;
    if (!frame.geometry)
      throw new TypeError(`Accepted character geometry is missing: ${playerSlot}.`);
    return Object.freeze({ id, playerSlot, frame });
  }
  throw new Error(`Accepted character artwork is not prepared: ${id}.`);
}

/** Eagerly resolve the bounded native roster before exposing selector choices.
 * The board host decodes these slots; an appearance adapter may create their
 * variants lazily. Keep that adapter alive until all previews/atlas users retire. */
export function prepareOverflightCharacters(snapshot) {
  return Object.freeze(
    OVERFLIGHT_CHARACTERS.map(({ id }) => resolveOverflightCharacter(snapshot, id)),
  );
}

/** Static native preview, using the atlas's exact body fit and bounded rotor
 * sweep. The caller owns this canvas; no URL, image decode or art copy is made. */
export function paintOverflightCharacterPreview(canvas, entry, { size = 64, pose = 0 } = {}) {
  const definition = character(entry?.id);
  if (!definition.slots.includes(entry.playerSlot) || !entry.frame?.image || !entry.frame.geometry)
    throw new TypeError('Preview requires a resolved Overflight character.');
  if (!Number.isInteger(size) || size < 16 || size > 256 || !Number.isFinite(pose))
    throw new TypeError('Use a 16–256 pixel character preview and a finite pose.');
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) throw new TypeError('Character preview requires a 2D canvas.');
  canvas.width = size;
  canvas.height = size;
  ctx.imageSmoothingEnabled = false;
  const { frame } = entry,
    geometry = frame.geometry,
    metrics = overflightHeroGeometry(geometry),
    { width, height } = metrics;
  ctx.save();
  try {
    ctx.translate(size / 2, size / 2);
    ctx.scale(size / metrics.frameSize, size / metrics.frameSize);
    ctx.drawImage(
      frame.image,
      -(geometry.pivot?.x ?? 0.5) * width,
      -(geometry.pivot?.y ?? 0.5) * height,
      width,
      height,
    );
    for (const anchor of metrics.rotors) {
      ctx.save();
      ctx.translate(anchor.x, anchor.y);
      paintRotor(ctx, {
        radius: anchor.radius,
        phase:
          ((pose * Math.PI * 2) / (OVERFLIGHT_HERO_FRAMES * anchor.bladeCount)) * anchor.direction +
          ((anchor.phaseDegrees ?? 0) * Math.PI) / 180,
        direction: anchor.direction,
        bladeCount: anchor.bladeCount,
        blurOpacity: 0.1,
        pixel: Math.max(width / 64, 0.1),
      });
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }
  return canvas;
}
