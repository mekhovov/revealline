/** Presentation advice for an already validated arena. Never changes its recipe. */
export function coopArenaGuidance(level, { jointCuts = true } = {}) {
  const hunters = level.enemies.some((enemy) => enemy.type === 'hunter');
  const drifters = level.enemies.some((enemy) => enemy.type === 'drifter');
  const relays = Boolean(level.strongholds?.length);
  const requiredCores = level.goal.cores?.length ?? 0;
  const threats = [];
  const slow = level.terrain?.some((area) => area.kind === 'slow'),
    lethal = level.terrain?.some((area) => area.kind === 'lethal');
  if (slow)
    threats.push(
      'Paired dashes slow only your craft on unclaimed field; enemies keep their speed.',
    );
  if (lethal)
    threats.push(
      'Framed crosses harm your craft on unclaimed field. Enclose them before crossing.',
    );
  if (slow || lethal)
    threats.push('Capturing field neutralizes its terrain for both craft. Walls never close cuts.');
  if (hunters)
    threats.push(
      'Hunters mark a route before charging. Cross during recovery, or use Support to slow them.',
    );
  if (drifters)
    threats.push(
      'Drifters patrol continuously and can hit your craft or unfinished line. Keep cuts short when one is nearby.',
    );
  if (relays)
    threats.push(
      'Relay cores warn before sending a spark along an unfinished line. Bank the threatened line or use Support near the spark.',
    );
  const pulse =
    hunters || drifters
      ? `Tap Support to slow nearby enemies${relays ? ' and intercept nearby sparks' : ''}. A dashed ring shows the slowdown. `
      : relays
        ? 'Tap Support near a travelling spark to intercept it. '
        : '';
  const rescue =
    'Hold Support on safe ground beside a downed partner for one second to rescue them without spending a reserve. Avoid steering while rescuing.';
  const route = jointCuts
    ? 'Start with a small loop, then meet your partner to join a larger cut.'
    : 'Bring each cut back to safe ground. Meeting your partner does not join the lines.';
  return {
    threatTitle: threats.length ? 'Watch the threats.' : 'Practice your routes.',
    threatText: threats.length
      ? threats.join(' ')
      : 'This arena has no enemies or relay emitters. Build safe ground with short loops, then try longer routes.',
    supportText: pulse + rescue,
    showStrongholds: relays,
    strongholdTitle: requiredCores ? 'Secure the relay cores.' : 'Relay defenses.',
    strongholdText:
      'Capture both anchors of a stronghold to expose its core. Claim the exposed core with a later cut to stop its emitter. A shielded core blocks entry.' +
      (requiredCores ? '' : ' Your goal is the coverage target.'),
    briefingTitle:
      requiredCores > 1
        ? 'SECURE THE REQUIRED CORES'
        : requiredCores
          ? 'TAKE THE STRONGHOLD TOGETHER'
          : 'MAKE YOUR COMMON GROUND',
    levelNote: requiredCores
      ? 'Plan routes to the anchors, then claim the exposed cores with later cuts.'
      : 'Create safe routes together. Use the revealed ground to launch your next cut.',
    startMessage: hunters
      ? `Watch the Hunter warnings and cross during recovery. ${route}`
      : drifters
        ? `Keep cuts short near patrolling Drifters. ${route}`
        : relays
          ? `Watch relay warnings; bank the threatened line or intercept its spark with Support. ${route}`
          : route,
  };
}
