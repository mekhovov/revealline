/** Presentation reads the gameplay clock and accepted state only. It neither
 * advances attacks nor writes cosmetic timers onto pooled simulation actors. */
export const OVERFLIGHT_COMBAT_CLIPS = Object.freeze({
  preparing: 'anticipation',
  attacking: 'fire',
  exposed: 'recovery',
  'armor-break': 'caught',
  stagger: 'blocked',
});

export function overflightEnemyPresentation(enemy, time = 0, previous = null, output = {}) {
  const sameActor = previous?.id === enemy.id;
  const phase = enemy.behaviorPhase;
  const crosscut =
    enemy.movementPreset === 'crosscut' || enemy.movementPreset === 'crosscut-interceptor';
  const movementWarning = crosscut && enemy.movementPhase === 'preparing';
  const movementAttack = crosscut && enemy.movementPhase === 'committed';
  const armor = enemy.armorSegments ?? enemy.armor ?? 0;
  const guard = enemy.guardIntegrity ?? 0;
  const armorBroken =
    sameActor && (armor < previous.armor || (guard < previous.guard && guard <= 0));
  const damaged = sameActor && enemy.hp < previous.hp;
  const armorUntil = armorBroken ? time + 0.25 : sameActor ? previous.armorUntil : -Infinity;
  const staggerUntil = damaged ? time + 0.12 : sameActor ? previous.staggerUntil : -Infinity;
  let state = 'moving';
  if (phase === 'windup' || phase === 'rally-warning' || enemy.attackWarning > 0 || movementWarning)
    state = 'preparing';
  else if (phase === 'burst' || phase === 'firing' || movementAttack) state = 'attacking';
  else if (armorUntil > time) state = 'armor-break';
  else if (staggerUntil > time) state = 'stagger';
  else if (phase === 'recovery' || enemy.exposureRemaining > 0) state = 'exposed';
  const started = sameActor && previous.state === state ? previous.started : time;
  output.id = enemy.id;
  output.state = state;
  output.clip = OVERFLIGHT_COMBAT_CLIPS[state] ?? 'move';
  output.elapsed = Math.max(0, time - started);
  output.started = started;
  output.armorUntil = armorUntil;
  output.staggerUntil = staggerUntil;
  output.armor = armor;
  output.guard = guard;
  output.hp = enemy.hp;
  // A committed guard facing takes precedence over locomotion facing.
  output.heading =
    enemy.maxGuardIntegrity > 0 && enemy.guardIntegrity > 0
      ? (enemy.guardHeading ?? enemy.heading ?? 0)
      : (movementWarning || movementAttack) && Number.isFinite(enemy.movementFacing)
        ? enemy.movementFacing
        : (enemy.heading ?? 0);
  output.remaining = Math.max(
    0,
    state === 'preparing'
      ? enemy.attackWarning ||
          (movementWarning ? enemy.movementRemaining : enemy.phaseRemaining) ||
          0
      : state === 'exposed'
        ? enemy.exposureRemaining || enemy.phaseRemaining || 0
        : (movementAttack ? enemy.movementRemaining : enemy.phaseRemaining) || 0,
  );
  return output;
}

export function createOverflightPresentationState() {
  let actors = new WeakMap();
  return {
    enemy(enemy, time) {
      const previous = actors.get(enemy);
      const next = overflightEnemyPresentation(enemy, time, previous, previous ?? {});
      actors.set(enemy, next);
      return next;
    },
    reset() {
      actors = new WeakMap();
    },
  };
}
