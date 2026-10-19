const cues = {
  'cut.started': 'demo:tipCut',
  'cut.closed': 'demo:tipClose',
  'capture.stopped': 'demo:tipStop',
  'boss.warning': 'demo:tipLane',
  'pickup.collected': 'demo:tipPickup',
  'powerup.collected': 'demo:tipPowerup',
  'ability.used': 'demo:tipAbility',
  'class.switched': 'demo:tipClass',
  'player.failed': 'demo:tipFailure',
  'lineImpact.seeded': 'demo:tipImpact',
  'objective.captured': 'demo:tipObjective',
};

/** Interpret actual Solo events without inferring an unobserved success. */
export function soloDemoCaption(event) {
  if (event.type === 'ability.used' && event.primitive === 'scan') return 'demo:tipScan';
  if (event.type === 'signal.changed')
    return Array.isArray(event.zoneIds) &&
      event.zoneIds.length > 0 &&
      event.resistant === false &&
      ((Number.isFinite(event.speedFactor) && event.speedFactor < 1) ||
        event.boostBlocked === true ||
        event.abilityBlocked === true)
      ? 'demo:tipSignal'
      : null;
  return Object.hasOwn(cues, event.type) ? cues[event.type] : null;
}
