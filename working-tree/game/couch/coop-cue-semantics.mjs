const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const playerTarget = (value) => value === 0 || value === 1;

/** Read actual Team state only; a cue never owns a phase, timer or target. */
export function describeCoopEnemyCue(enemy, time) {
  if (!record(enemy) || typeof enemy.type !== 'string' || enemy.active === false) return null;
  const slowed =
    Number.isFinite(time) &&
    time >= 0 &&
    Number.isFinite(enemy.speedScale) &&
    enemy.speedScale > 0 &&
    enemy.speedScale < 1 &&
    Number.isFinite(enemy.slowUntil) &&
    enemy.slowUntil > time;
  if (enemy.type !== 'hunter') return Object.freeze({ text: '', mark: null, priority: 2, slowed });
  const target = playerTarget(enemy.target) ? `P${enemy.target + 1}` : 'H';
  if (enemy.phase === 'warning')
    return Object.freeze({ text: target, mark: 'hunter-lock', priority: 1, slowed });
  if (enemy.phase === 'commit')
    return Object.freeze({ text: target, mark: 'hunter-charge', priority: 1, slowed });
  return Object.freeze({
    text: 'H',
    mark: enemy.phase === 'recovery' ? 'hunter-recovery' : 'hunter',
    priority: 2,
    slowed,
  });
}

/** Compact current threats for the existing advisory; rescue and terminal copy keep priority. */
export function coopThreatSummary(run) {
  if (
    !record(run) ||
    !['running', 'paused'].includes(run.status) ||
    !Array.isArray(run.players) ||
    !Array.isArray(run.enemies) ||
    run.players.some((player) => player?.status === 'downed')
  )
    return null;
  const activePlayers = new Set(
      run.players
        .filter((player) => player?.status === 'active' && playerTarget(player.id))
        .map((player) => player.id),
    ),
    locks = new Set(),
    charges = new Set();
  for (const enemy of run.enemies) {
    if (
      !record(enemy) ||
      enemy.active === false ||
      enemy.type !== 'hunter' ||
      !playerTarget(enemy.target) ||
      !activePlayers.has(enemy.target)
    )
      continue;
    if (enemy.phase === 'warning') locks.add(enemy.target + 1);
    else if (enemy.phase === 'commit') charges.add(enemy.target + 1);
  }
  const describe = (targets) =>
    `${targets.size === 1 ? 'Player' : 'Players'} ${[...targets].sort().join(' and ')}`;
  return (
    [
      locks.size ? `Hunter lock: ${describe(locks)}` : null,
      charges.size ? `Hunter charge: ${describe(charges)}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  );
}
