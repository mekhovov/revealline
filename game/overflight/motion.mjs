/** One finite motion vocabulary for warning admission and both actor models.
 * Velocities are units/second; committed targets stop prediction at the end of
 * the current leg. A subsequent leg must be admitted separately. */
export function overflightEnemyVelocity(enemy) {
  if (Number.isFinite(enemy._motionVX) && Number.isFinite(enemy._motionVY))
    return { x: enemy._motionVX, y: enemy._motionVY };
  if (enemy.huntRulesVersion)
    return {
      x: Number.isFinite(enemy.vx) ? enemy.vx : 0,
      y: Number.isFinite(enemy.vy) ? enemy.vy : 0,
    };
  const burst = enemy.behaviorPhase === 'burst';
  const multiplier = burst ? Math.min(2, 144 / (enemy.speed || 1)) : 1;
  const x = burst ? enemy._burstX : enemy.steeringX;
  const y = burst ? enemy._burstY : enemy.steeringY;
  return {
    x: Number.isFinite(x) ? x * enemy.speed * multiplier : 0,
    y: Number.isFinite(y) ? y * enemy.speed * multiplier : 0,
  };
}

/** Raid's exposed bodies are opportunities, not harmful escape blockers.
 * The caller supplies the predicted body and player contact positions. */
export function overflightHarmfulBody(enemy, playerX, playerY, bodyX = enemy.x, bodyY = enemy.y) {
  if (!enemy.huntRulesVersion) return true;
  const phase = enemy.behaviorPhase;
  const front =
    (playerX - bodyX) * Math.cos(enemy.heading) + (playerY - bodyY) * Math.sin(enemy.heading) >
    1e-9;
  if (enemy.maxArmorSegments > 0)
    return phase !== 'recovery' && (enemy.huntRulesVersion < 3 || front);
  if (enemy.behavior === 'brace') return ['guarding', 'windup', 'burst'].includes(phase);
  if (enemy.behavior === 'shield')
    return !(enemy.huntRulesVersion >= 3 && phase === 'recovery') && front;
  return false;
}

export function overflightMotionLeg(enemy, seconds, override = null) {
  const velocity = override ?? overflightEnemyVelocity(enemy);
  const committedSeconds = override ? override.seconds : enemy._motionSeconds;
  let duration = Number.isFinite(committedSeconds)
    ? Math.min(seconds, Math.max(0, committedSeconds))
    : seconds;
  const target = override ? override.target : enemy._motionTarget;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (target && speed > 0)
    duration = Math.min(duration, Math.hypot(target.x - enemy.x, target.y - enemy.y) / speed);
  return { x: velocity.x, y: velocity.y, duration: Math.max(0, duration) };
}
