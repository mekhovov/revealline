// Test-only route observations. Never changes runtime state, awards or clear rules.
export function createRelayGoalEvidence() {
  return {
    used: new Set(),
    landingVisits: new Map(),
    simultaneous: false,
    impactRelayClosure: false,
  };
}
export function relayBeforeStep(run) {
  return {
    playerFrontIds: (run.classic.lineImpact?.fronts ?? [])
      .filter((front) => front.direction === 1)
      .map((front) => front.id),
  };
}
export function observeRelayGoal(run, evidence, before) {
  const opened = run.events.filter((event) => event.type === 'relay.opened');
  if (run.events.some((event) => event.type === 'cut.closed')) {
    evidence.simultaneous ||= new Set(opened.map((event) => event.objectiveId)).size >= 2;
    const cleared = run.events
      .filter((event) => event.type === 'lineImpact.cleared' && event.reason === 'capture')
      .flatMap((event) => event.ids);
    evidence.impactRelayClosure ||=
      opened.length > 0 && before.playerFrontIds.some((id) => cleared.includes(id));
  }
  const index = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
  for (const gate of run.relay.gates)
    if (gate.openedTick !== null && gate.cells.includes(index)) evidence.used.add(gate.id);
  for (const [index, rectangle] of run.level.foundations.entries())
    if (
      run.player.x >= rectangle.x &&
      run.player.x < rectangle.x + rectangle.w &&
      run.player.y >= rectangle.y &&
      run.player.y < rectangle.y + rectangle.h
    )
      evidence.landingVisits.set(index, run.tick);
}

export function inspectRelayGoal({ missionId, run, evidence }) {
  const tick = (id) => run.relay.gates.find((gate) => gate.id === id)?.openedTick ?? null;
  const before = (first, second) =>
    tick(first) !== null && tick(second) !== null && tick(first) < tick(second);
  const visitedAfter = (index, gate) =>
    tick(gate) !== null && (evidence.landingVisits.get(index) ?? -1) > tick(gate);
  const conditions = {
    'first-link': evidence.used.has('south-bridge') && visitedAfter(1, 'south-bridge'),
    'second-approach': before('east-bridge', 'west-bridge'),
    'three-compounds': visitedAfter(1, 'west-link') && visitedAfter(2, 'east-link'),
    'spiral-stores': evidence.simultaneous,
    'nested-relays': before('lower-link', 'inner-link'),
    'watchpost-exchange': evidence.used.has('west-junction') && evidence.used.has('east-junction'),
    'relay-remix': evidence.impactRelayClosure,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Relay Labyrinth goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    condition: conditions[missionId],
    used: [...evidence.used],
    landingVisits: [...evidence.landingVisits],
    simultaneous: evidence.simultaneous,
    impactRelayClosure: evidence.impactRelayClosure,
  };
}
