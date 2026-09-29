/** Short visual copy for the two-pad compact deck. Full instructions stay accessible. */
export function compactPlayerCopy(run, player) {
  const down = player.status === 'downed';
  const recharge = Math.max(0, (player.support?.readyAt || 0) - run.time);
  return {
    state: down
      ? run.team.reserves === 0
        ? 'Down · rescue'
        : `Down ${Math.max(0, Math.ceil(player.downedUntil - run.time))}s`
      : player.cutting
        ? 'Line exposed'
        : player.graceUntil > run.time
          ? 'Shield · safe only'
          : 'Safe ground',
    charge: down
      ? `Crawl to ${player.id === 0 ? 2 : 1}`
      : player.rescue
        ? `Rescue ${Math.min(100, Math.floor((run.time - player.rescue.startedAt) * 100))}%`
        : recharge > 0
          ? `Support ${recharge.toFixed(1)}s`
          : 'Support ready',
    deckCharge: down
      ? `Crawl to ${player.id === 0 ? 2 : 1}`
      : player.rescue
        ? `Rescue ${Math.min(100, Math.floor((run.time - player.rescue.startedAt) * 100))}%`
        : recharge > 0
          ? `${recharge.toFixed(1)}s`
          : 'Ready',
  };
}

export function compactObjectiveCopy(run) {
  const required = run.strongholds.filter((item) => run.level.goal.cores?.includes(item.id));
  const next = required.find((item) => !item.defeated);
  if (!next)
    return required.length
      ? 'All cores secured'
      : `Reveal ${Math.ceil(run.level.goal.coverage * 10000 - 1e-9) / 100}%`;
  const summary =
    required.length > 1
      ? `Cores ${required.filter((item) => item.defeated).length}/${required.length}\nRelay ${run.strongholds.indexOf(next) + 1}\n`
      : '';
  return (
    summary +
    (next.shielded
      ? `Anchors ${next.anchors.filter((anchor) => anchor.captured).length}/2\nthen core`
      : 'Core exposed\nCapture new cut')
  );
}

export function compactEventCopy(run, event) {
  const player = event.player + 1;
  const relayIndex = run.strongholds.findIndex((item) => item.id === event.stronghold);
  const relay = relayIndex < 0 ? 'Core' : `Relay ${relayIndex + 1}`;
  switch (event.type) {
    case 'cut.joint':
      return 'Joint cut!\nLines safe.';
    case 'player.downed': {
      const cause =
        event.cause === 'self-trail'
          ? 'self-cut'
          : event.cause === 'line-impact'
            ? 'spark hit'
            : ['enemy-trail', 'enemy-player'].includes(event.cause)
              ? run.enemies.some((enemy) => enemy.id === event.enemy && enemy.type === 'hunter')
                ? 'Hunter hit'
                : 'enemy hit'
              : 'down';
      return `${player} ${cause}.\nAlly: hold\nSupport nearby.`;
    }
    case 'player.revived':
      return `${player} back. Steer.${event.reason === 'reserve' ? '\n−1 reserve.' : ''}`;
    case 'team.recovery':
      return 'Both back.\n−1 reserve.\nSteer again.';
    case 'shield.disabled':
      return `${relay} open.\nUse a new cut.`;
    case 'core.defeated':
      return `${relay} clear.\nIts sparks stop.`;
    case 'support.pulse':
      return event.interceptedImpacts?.length
        ? `${player} blocked spark.`
        : event.slowedEnemies?.length
          ? `${player} slowed threats.`
          : null;
    case 'rescue.completed':
      return `${player} rescued ally.\nSteer again.`;
    case 'rescue.cancelled':
      return 'Rescue stopped.\nSteer, or hold\nSupport nearby.';
    default:
      return null;
  }
}

/** Preserve complete live-region text; compact visuals are decorative duplicates. */
export function createResponsiveCopy(document) {
  const parts = new WeakMap();
  return (element, full, compact = full, deck = compact) => {
    let pair = parts.get(element);
    if (!pair) {
      const complete = document.createElement('span');
      complete.className = 'coop-full-copy';
      const short = document.createElement('span');
      short.className = 'coop-compact-copy';
      short.setAttribute('aria-hidden', 'true');
      const pad = document.createElement('span');
      pad.className = 'coop-deck-copy';
      pad.setAttribute('aria-hidden', 'true');
      element.textContent = '';
      element.append(complete, short, pad);
      pair = { complete, short, pad };
      parts.set(element, pair);
    }
    if (pair.complete.textContent !== full) pair.complete.textContent = full;
    if (pair.short.textContent !== compact) pair.short.textContent = compact;
    if (pair.pad.textContent !== deck) pair.pad.textContent = deck;
  };
}
