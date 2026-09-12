import { EPS } from './geometry.mjs';

export function updateAbilities(state) {
  state.ability.fields = state.ability.fields.filter((field) => field.until > state.time + EPS);
  for (const e of state.enemies) {
    e.stunnedUntil = 0;
    e.slowUntil = 0;
    e.slowFactor = 1;
    if (e.type === 'border-patrol') continue;
    for (const f of state.ability.fields)
      if (Math.hypot(e.x - f.x, e.y - f.y) <= f.radius + e.radius) {
        if (f.kind === 'stun-field') e.stunnedUntil = Math.max(e.stunnedUntil, f.until);
        else {
          e.slowUntil = Math.max(e.slowUntil, f.until);
          e.slowFactor = Math.min(e.slowFactor, f.slowFactor);
        }
      }
  }
}

export function useAbilities(state, input) {
  const action = input.action && !state._input.action,
    pickup = input.pickup && !state._input.pickup;
  state._input = { action: !!input.action, pickup: !!input.pickup };
  if (state.status !== 'running') return;
  const ability = state.ability,
    recipe = state.classRecipe;
  if (pickup && ability.capacity > 0) {
    const pad = state.supplies.find(
      (p) => Math.hypot(state.player.x - p.x, state.player.y - p.y) <= p.radius,
    );
    if (pad && ability.ammo < ability.capacity) {
      ability.ammo = ability.capacity;
      state.events.push({
        type: 'pickup.collected',
        tick: state.tick,
        time: state.time,
        id: pad.id,
        ammo: ability.ammo,
      });
    } else
      state.events.push({
        type: 'ability.rejected',
        tick: state.tick,
        time: state.time,
        reason: pad ? 'already-full' : 'out-of-range',
      });
  }
  if (!action) return;
  if (ability.cooldownUntil > state.time + EPS) {
    state.events.push({
      type: 'ability.rejected',
      tick: state.tick,
      time: state.time,
      reason: 'cooldown',
    });
    return;
  }
  if (ability.capacity > 0 && ability.ammo <= 0) {
    state.events.push({
      type: 'ability.rejected',
      tick: state.tick,
      time: state.time,
      reason: 'empty',
    });
    return;
  }
  ability.cooldownUntil = state.time + recipe.cooldown;
  if (ability.capacity > 0) ability.ammo--;
  if (recipe.primitive === 'scan') {
    ability.scanUntil = state.time + recipe.duration;
    for (const p of state.objectives)
      if (Math.hypot(state.player.x - p.x, state.player.y - p.y) <= recipe.radius)
        p.revealed = true;
  } else if (recipe.primitive === 'shield') ability.shieldUntil = state.time + recipe.duration;
  else
    ability.fields.push({
      id: `field-${state.tick}-${state._abilitySerial++}`,
      kind: recipe.primitive,
      x: state.player.x,
      y: state.player.y,
      radius: recipe.radius,
      until: state.time + recipe.duration,
      slowFactor: recipe.slowFactor ?? 1,
    });
  state.events.push({
    type: 'ability.used',
    tick: state.tick,
    time: state.time,
    primitive: recipe.primitive,
    ammo: ability.ammo,
  });
  updateAbilities(state);
}
