import { CELL } from '../../core/index.mjs';
import { CLASSIC_MATERIAL } from '../../core/classic-state.mjs';
import { inspectCaptureSnapshot } from '../../core/capture-regions.mjs';
import { roverLinks } from './rover-goal.mjs';

// Test-only evidence. Never awards progress or changes required completion.
export function createPhaseGoalEvidence(run) {
  return {
    initialRegions: inspectCaptureSnapshot(run).components.map((region) => new Set(region.cells)),
    districts: new Set(),
    impactClosure: false,
    activeClosure: false,
    activeImpactClosure: false,
  };
}

export function phaseBeforeStep(run) {
  return {
    trail: run.trail.map((cell) => cell.index),
    activeRoamer: run.enemies.some(
      (actor) => actor.type === 'claimed-rover' && actor.classic.mode === 'active',
    ),
    playerFrontIds: run.classic.lineImpact.fronts
      .filter((front) => front.direction === 1)
      .map((front) => front.id),
  };
}

export function observePhaseGoal(run, evidence, before) {
  if (!run.events.some((event) => event.type === 'cut.closed')) return;
  const cleared = run.events
    .filter((event) => event.type === 'lineImpact.cleared' && event.reason === 'capture')
    .flatMap((event) => event.ids);
  const impactClosure = before.playerFrontIds.some((id) => cleared.includes(id));
  evidence.impactClosure ||= impactClosure;
  evidence.activeClosure ||= before.activeRoamer;
  evidence.activeImpactClosure ||= impactClosure && before.activeRoamer;
  for (const [index, region] of evidence.initialRegions.entries())
    if (before.trail.some((cell) => region.has(cell))) evidence.districts.add(index);
}

export function inspectPhaseGoal({ missionId, run, foundations, evidence }) {
  const allLinked = roverLinks(run, foundations);
  const lethalNeutralized = run.classic.terrain.every(
    (kind, cell) => kind !== CLASSIC_MATERIAL.lethal || run.cells[cell] !== CELL.FIELD,
  );
  const conditions = {
    'return-in-reserve': evidence.impactClosure,
    'two-ways-home': allLinked && evidence.impactClosure,
    'dogleg-transfer': evidence.districts.size === 2 && lethalNeutralized,
    'crossed-bands': lethalNeutralized && evidence.impactClosure,
    'pressure-ladder': allLinked && evidence.impactClosure,
    'signal-channels': lethalNeutralized && evidence.activeClosure,
    'phase-remix': lethalNeutralized && evidence.activeImpactClosure,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Phaseworks goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    allLinked,
    lethalNeutralized,
    districts: [...evidence.districts],
    impactClosure: evidence.impactClosure,
    activeClosure: evidence.activeClosure,
    activeImpactClosure: evidence.activeImpactClosure,
  };
}
