import { createOverflightGroundPresentation, OVERFLIGHT_WORLDS } from '../overflight/worlds.mjs';
import { paintOverflightWorld } from './overflight-world-art.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from './industrial-arcade-builtins.mjs';

export const BATTLEFIELD_GROUND_KEY = 'revealline.battlefield-ground.v1';
export const BATTLEFIELD_GROUND_CHOICES = Object.freeze([
  'authored',
  ...OVERFLIGHT_WORLDS.map((w) => w.id),
]);
const valid = (world) => BATTLEFIELD_GROUND_CHOICES.includes(world);

/** Cosmetic display intent only. This never edits authored mission or attempt pins. */
export function createBattlefieldGroundPreferences({
  window: win = globalThis,
  getStorage = () => globalThis.localStorage,
} = {}) {
  let world = 'authored',
    durable = true,
    disposed = false,
    pending = false;
  const listeners = new Set();
  const read = () => {
    const raw = getStorage()?.getItem(BATTLEFIELD_GROUND_KEY);
    if (raw == null) return 'authored';
    if (raw.length > 160) throw new TypeError('Invalid battlefield preference.');
    const record = JSON.parse(raw);
    if (
      record?.format !== 'BattlefieldGroundV1' ||
      !valid(record.world) ||
      Object.keys(record).length !== 2
    )
      throw new TypeError('Invalid battlefield preference.');
    return record.world;
  };
  try {
    world = read();
  } catch {
    durable = false;
  }
  const snapshot = () => Object.freeze({ world, durable });
  const notify = () => {
    for (const listener of [...listeners]) listener(snapshot());
  };
  const refresh = (event) => {
    if (disposed || pending || event.key !== BATTLEFIELD_GROUND_KEY) return;
    try {
      const storage = getStorage();
      if (
        event.storageArea !== storage ||
        event.newValue !== storage?.getItem(BATTLEFIELD_GROUND_KEY)
      )
        return;
      world = read();
      durable = true;
      notify();
    } catch {
      /* An invalid external record cannot replace accepted intent. */
    }
  };
  win?.addEventListener?.('storage', refresh);
  return {
    snapshot,
    set(next) {
      if (disposed) return snapshot();
      if (!valid(next)) throw new TypeError('Unknown battlefield ground.');
      world = next;
      pending = true;
      try {
        read(); // Never overwrite a future/unsupported record.
        const storage = getStorage();
        if (!storage) throw new Error('Storage unavailable.');
        const raw = JSON.stringify({ format: 'BattlefieldGroundV1', world });
        storage.setItem(BATTLEFIELD_GROUND_KEY, raw);
        if (storage.getItem(BATTLEFIELD_GROUND_KEY) !== raw)
          throw new Error('Preference not saved.');
        durable = true;
        pending = false;
      } catch {
        durable = false;
      }
      notify();
      return snapshot();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      win?.removeEventListener?.('storage', refresh);
    },
  };
}
let preferences;
export const sharedBattlefieldGround = () => (preferences ??= createBattlefieldGroundPreferences());

/** Pinned chapter identity and custom terrain always take precedence. */
export function battlefieldGroundAllowed({ environmentPin, presentation, overrides = {} } = {}) {
  if (
    environmentPin ||
    ['wall', 'slowTerrain', 'lethalTerrain', 'background'].some((key) => overrides[key])
  )
    return false;
  for (const slot of ['terrain.wall', 'terrain.slow', 'terrain.lethal']) {
    const asset = presentation?.resolved?.assets?.[slot] ?? presentation?.canvas?.assets?.[slot];
    if (asset && !INDUSTRIAL_BUILTIN_SPRITES[slot]?.includes(asset.file?.sha256)) return false;
  }
  return true;
}

/** One bounded surface per painter. The same native world art is sampled only
 * inside covered cells, beneath actual walls, danger tiles, trails and actors.
 * No world collision, RNG, simulation clock or revealed picture is replaced. */
export function createBattlefieldGroundSurface({
  canvasFactory = () => globalThis.document?.createElement('canvas'),
  onContextLoss = () => {},
  onContextRestored = () => {},
} = {}) {
  let canvas = null,
    key = '',
    lost = false;
  const contextLost = () => {
    lost = true;
    onContextLoss({ source: 'battlefield-ground', owner: canvas });
  };
  const contextRestored = () => {
    const owner = canvas;
    lost = false;
    clear();
    onContextRestored({ source: 'battlefield-ground', owner });
  };
  function clear() {
    const owner = canvas,
      wasLost = lost;
    canvas = null;
    key = '';
    lost = false;
    owner?.removeEventListener?.('contextlost', contextLost);
    owner?.removeEventListener?.('contextrestored', contextRestored);
    if (owner) owner.width = owner.height = 0;
    if (wasLost) onContextRestored({ source: 'battlefield-ground', owner, retired: true });
  }
  return {
    prepare(world, width, height, allowed = true) {
      if (!allowed || world === 'authored' || !valid(world)) {
        this.clear();
        return null;
      }
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        return null;
      const factor = Math.min(1, 1024 / width, 1024 / height),
        w = Math.max(1, Math.round(width * factor)),
        h = Math.max(1, Math.round(height * factor)),
        next = `${world}:${w}:${h}`;
      if (lost && next === key) return null;
      if (canvas && next === key) return canvas;
      this.clear();
      canvas = canvasFactory();
      const ctx = canvas?.getContext?.('2d');
      if (!ctx) {
        canvas = null;
        return null;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.addEventListener?.('contextlost', contextLost);
      canvas.addEventListener?.('contextrestored', contextRestored);
      const arena = { width: 2880, height: 1080 },
        source = createOverflightGroundPresentation(world, arena);
      ctx.save();
      ctx.scale(w / arena.width, h / arena.height);
      paintOverflightWorld(ctx, source, arena);
      ctx.restore();
      key = next;
      return canvas;
    },
    clear,
  };
}

export function paintBattlefieldGroundSpan(
  ctx,
  surface,
  x,
  y,
  width,
  height,
  arenaWidth,
  arenaHeight,
) {
  if (!surface) return false;
  ctx.drawImage(
    surface,
    (x * surface.width) / arenaWidth,
    (y * surface.height) / arenaHeight,
    (width * surface.width) / arenaWidth,
    (height * surface.height) / arenaHeight,
    x,
    y,
    width,
    height,
  );
  return true;
}
