import {
  actorDiameter,
  createActorPresentation,
  drawPresentedActor,
} from '../ui/actor-presentation.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';
import { TEAM_ACTOR_SLOTS, teamActorSlotId } from '../presentation/team-actor-slots.mjs';

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
const TAU = Math.PI * 2;
const turnDelta = (target, heading) =>
  ((((target - heading + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** Two cosmetic observations only: downed rotors stay frozen while real crawl
 * displacement can turn the body. State transitions may teleport to an anchor;
 * those displacements must never masquerade as crawling. */
function pilotPose(run, player, frame, old, dt, reduced) {
  const running = run.status === 'running',
    changed = old && old.tick !== run.tick,
    sameStatus = old?.status === player.status;
  let heading = old?.heading ?? frame.heading,
    target = sameStatus ? old.target : heading,
    moving = running && sameStatus && !changed ? old.moving : false;
  if (running && changed && sameStatus) {
    const dx = player.x - old.x,
      dy = player.y - old.y;
    moving = Math.hypot(dx, dy) > 0.00001;
    if (moving) target = Math.atan2(dy, dx) + Math.PI / 2;
    if (player.status === 'active' || moving)
      heading = reduced
        ? target
        : heading + Math.max(-dt * 12, Math.min(dt * 12, turnDelta(target, heading)));
  }
  const rescue = player.rescue,
    partner =
      running && player.status === 'active' && Number.isInteger(rescue?.target)
        ? run.players.find((other) => other.id === rescue.target && other.id !== player.id)
        : null,
    rescueTarget = partner?.status === 'downed' ? partner.id : null;
  const pilotState =
    player.status === 'downed'
      ? moving
        ? 'crawling'
        : 'downed'
      : rescueTarget !== null
        ? 'rescuing'
        : player.cutting
          ? 'cutting'
          : player.graceUntil > run.time
            ? 'recovery'
            : 'normal';
  return {
    sample: {
      x: player.x,
      y: player.y,
      tick: run.tick,
      status: player.status,
      heading,
      target,
      moving,
    },
    pose: { heading, pilotState, rescueTarget },
  };
}

/** Borrow prepared sprites and keep cosmetic samples only; never acquire assets or mutate a run. */
export function createCoopActorPresentation() {
  const sampler = createActorPresentation();
  let snapshot = null,
    sprites = new Map(),
    entries = new Map(),
    pilots = new Map(),
    attempt = null,
    previousTick = null,
    previousTime = 0;
  function reset() {
    sampler.reset();
    entries = new Map();
    pilots = new Map();
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
    for (const { id } of TEAM_ACTOR_SLOTS) {
      const declared = next?.resolved?.assets?.[id];
      if (!declared) continue;
      const sprite = typeof next?.image === 'function' ? next.image(id) : null;
      if (declared.kind !== 'image' || !sprite?.image || !sprite.geometry)
        throw new TypeError(`Team actor state needs its prepared image: ${id}.`);
      prepared.set(id, sprite);
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
        player,
        radius: player.radius,
        slot: `${COOP_ACTOR_ROLES.pilot.slot}.${treatment}`,
        kind: 'pilot',
        actor: player,
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
      descriptions.set(id, {
        ...COOP_ACTOR_ROLES[enemy.type],
        radius: enemy.radius,
        kind: 'enemy',
        actor: enemy,
      });
    }
    for (const stronghold of run.strongholds || []) {
      const id = key('core', stronghold.id);
      actors.push({ id, type: 'team-stronghold', x: stronghold.core.x, y: stronghold.core.y });
      descriptions.set(id, {
        ...COOP_ACTOR_ROLES.core,
        secured: stronghold.defeated,
        kind: 'core',
        actor: stronghold,
      });
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
    const next = new Map(),
      nextPilots = new Map();
    for (const [id, sampled] of frames) {
      const description = descriptions.get(id),
        core = description.role === COOP_ACTOR_ROLES.core.role;
      let frame = sampled;
      if (description.player) {
        const result = pilotPose(
          run,
          description.player,
          sampled,
          pilots.get(id),
          elapsed * scale,
          reduced,
        );
        nextPilots.set(id, result.sample);
        // Geometry must use the final heading, including pivot and rotor bounds.
        frame = { ...sampled, ...result.pose };
      }
      const stateSlot = teamActorSlotId(description.kind, description.actor, {
        state: frame.pilotState,
        treatment,
      });
      const selectedSlot = stateSlot && sprites.has(stateSlot) ? stateSlot : description.slot;
      const sprite = sprites.get(selectedSlot) ?? null;
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
          sourceSlot: selectedSlot,
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
    pilots = nextPilots;
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
