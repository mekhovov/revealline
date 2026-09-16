import {
  actorDiameter,
  createActorPresentation,
  drawPresentedActor,
} from '../ui/actor-presentation.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';

import { coopPilotBodyOffset } from './coop-actor-layout.mjs';

const CELL = 16;
const DIRECTION = Object.freeze({ up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] });
// Image reuse is explicit. These roles never replace a Team behavior/type.
export const COOP_ACTOR_ROLES = Object.freeze({
  pilot: Object.freeze({ role: 'team-pilot', slot: 'player.scout' }),
  drifter: Object.freeze({ role: 'team-field-bouncer', slot: 'enemy.bouncer' }),
  hunter: Object.freeze({ role: 'team-line-hunter', slot: 'enemy.border-patrol' }),
  core: Object.freeze({ role: 'team-stronghold', slot: 'enemy.relay-sentinel' }),
});
const key = (kind, id) => `${kind}:${id}`;

/** Borrow prepared sprites and keep cosmetic samples only; never acquire assets or mutate a run. */
export function createCoopActorPresentation() {
  const sampler = createActorPresentation();
  let snapshot = null,
    sprites = new Map(),
    entries = new Map(),
    attempt = null,
    previousTick = null,
    previousTime = 0;
  function reset() {
    sampler.reset();
    entries = new Map();
    attempt = null;
    previousTick = null;
    previousTime = 0;
  }
  function setPresentation(next) {
    const prepared = new Map();
    if (typeof next?.image === 'function') {
      for (const slot of [
        'player.scout.compact',
        'player.scout.detailed',
        'enemy.bouncer',
        'enemy.border-patrol',
        'enemy.relay-sentinel',
      ]) {
        const sprite = next.image(slot);
        if (sprite?.image && sprite.geometry) prepared.set(slot, sprite);
      }
    }
    snapshot = next;
    sprites = prepared;
    reset();
  }
  function update(
    run,
    { reduced = false, motionScale = 1, canvasCSSWidth = 1152, style = 'hybrid' } = {},
  ) {
    if (attempt !== run || run.tick < previousTick || run.time < previousTime) {
      reset();
      attempt = run;
    }
    const width = Number.isFinite(canvasCSSWidth) && canvasCSSWidth > 0 ? canvasCSSWidth : 1152;
    const screenScale = width / (run.width * CELL);
    const elapsed =
      previousTick === null || previousTick === run.tick
        ? 0
        : Math.max(0, Math.min(0.1, run.time - previousTime));
    const scale = Number.isFinite(motionScale) ? Math.max(0, Math.min(1, motionScale)) : 1;
    reduced ||= scale === 0;
    const treatment = style === 'microtile' || width < 480 ? 'compact' : 'detailed';
    const actors = [],
      descriptions = new Map(),
      frozen = [];
    for (const player of run.players) {
      const id = key('pilot', player.id),
        vector = DIRECTION[player.direction] ?? [0, 0];
      actors.push({
        id,
        type: 'team-pilot',
        x: player.x,
        y: player.y,
        vx: vector[0],
        vy: vector[1],
        radius: player.radius,
      });
      descriptions.set(id, {
        ...COOP_ACTOR_ROLES.pilot,
        radius: player.radius,
        slot: `${COOP_ACTOR_ROLES.pilot.slot}.${treatment}`,
      });
      if (player.status === 'downed') frozen.push({ id, frozen: true, stunned: true });
    }
    for (const enemy of run.enemies) {
      if (enemy.active === false || !['drifter', 'hunter'].includes(enemy.type)) continue;
      const id = key('enemy', enemy.id);
      actors.push({
        id,
        type: enemy.type,
        x: enemy.x,
        y: enemy.y,
        vx: enemy.vx,
        vy: enemy.vy,
        radius: enemy.radius,
      });
      descriptions.set(id, { ...COOP_ACTOR_ROLES[enemy.type], radius: enemy.radius });
    }
    for (const stronghold of run.strongholds || []) {
      const id = key('core', stronghold.id);
      actors.push({ id, type: 'team-stronghold', x: stronghold.core.x, y: stronghold.core.y });
      descriptions.set(id, { ...COOP_ACTOR_ROLES.core, secured: stronghold.defeated });
      frozen.push({ id, frozen: true });
    }
    const frames = sampler.sample(actors, {
      tick: run.tick,
      time: run.time,
      dt: elapsed * scale,
      paused: run.status !== 'running',
      reduced,
      classic: { enemies: frozen },
      style,
      themeId: 'fpv',
      screenScale,
      canvasCSSWidth: width,
    });
    const next = new Map();
    for (const [id, frame] of frames) {
      const description = descriptions.get(id),
        core = description.role === COOP_ACTOR_ROLES.core.role;
      const sprite = sprites.get(description.slot) ?? null;
      const bodyOffset =
        description.role === COOP_ACTOR_ROLES.pilot.role && sprite
          ? coopPilotBodyOffset(
              frame,
              sprite.geometry,
              run.width * CELL,
              run.height * CELL,
              1 / screenScale,
            )
          : null;
      next.set(id, {
        sprite,
        secured: description.secured === true,
        frame: Object.freeze({
          ...frame,
          role: description.role,
          sourceSlot: description.slot,
          bodyOffset,
          // The shared sampler bounds cosmetic data; Team owns the real footprint.
          radius: core ? 0 : description.radius * CELL,
          // Team cores have no circular contact hitbox. Only their body uses boss sizing.
          diameter: core
            ? actorDiameter({ role: 'boss', style, screenScale, canvasCSSWidth: width })
            : frame.diameter,
        }),
      });
    }
    entries = next;
    previousTick = run.tick;
    previousTime = run.time;
  }
  function frame(kind, id) {
    return entries.get(key(kind, id))?.frame ?? null;
  }
  function draw(ctx, kind, id, palette) {
    const entry = entries.get(key(kind, id));
    if (!snapshot || !entry?.sprite) return false;
    const { frame, sprite } = entry;
    ctx.save();
    try {
      // Shared actor helpers use pixels; Team's surrounding painter uses cells.
      ctx.scale(1 / CELL, 1 / CELL);
      ctx.imageSmoothingEnabled = false;
      if (kind === 'core') {
        ctx.globalAlpha = entry.secured ? 0.45 : 1;
        drawPresentationImage(
          ctx,
          sprite.image,
          frame.x,
          frame.y,
          frame.diameter,
          frame.diameter,
          sprite.geometry,
        );
      } else
        drawPresentedActor(ctx, frame, palette, sprite.image, sprite.geometry, null, {
          bodyOffset: frame.bodyOffset,
        });
    } finally {
      ctx.restore();
    }
    return true;
  }
  return { setPresentation, reset, update, frame, draw };
}
