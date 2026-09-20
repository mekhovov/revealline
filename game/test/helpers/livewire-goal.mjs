import { CELL } from '../../core/index.mjs';
import { CLASSIC_MATERIAL } from '../../core/classic-state.mjs';
import { roverLinks } from './rover-goal.mjs';
import { createPhaseGoalEvidence, observePhaseGoal } from './phase-goal.mjs';

// Test evidence only: never grants player progress or substitutes a completion rule.
export function createLivewireGoalEvidence(run) {
  return { ...createPhaseGoalEvidence(run), warningClosure: false };
}

export function livewireBeforeStep(run) {
  return {
    trail: run.trail.map((cell) => cell.index),
    activeRoamer: run.enemies.some(
      (actor) => actor.type === 'claimed-rover' && actor.classic.mode === 'active',
    ),
    playerFrontIds: (run.classic.lineImpact?.fronts ?? [])
      .filter((front) => front.direction === 1)
      .map((front) => front.id),
    warningTrail: run.enemies.some((actor) => {
      if (actor.type !== 'lane-boss' || actor.bossPhase !== 'warning') return false;
      const half = (actor.laneWidth ?? 1.2) / 2;
      return run.trail.some((cell) => {
        const position = actor.axis === 'horizontal' ? cell.y : cell.x;
        return position <= actor.lane + half && position + 1 >= actor.lane - half;
      });
    }),
  };
}

export function observeLivewireGoal(run, evidence, before) {
  observePhaseGoal(run, evidence, before);
  if (run.events.some((event) => event.type === 'cut.closed'))
    evidence.warningClosure ||= before.warningTrail;
}

export function inspectLivewireGoal({ missionId, run, foundations, evidence }) {
  const allLinked = roverLinks(run, foundations);
  const lethalNeutralized = run.classic.terrain.every(
    (kind, cell) => kind !== CLASSIC_MATERIAL.lethal || run.cells[cell] !== CELL.FIELD,
  );
  const conditions = {
    'read-the-lock': evidence.warningClosure,
    'cross-the-afterglow': allLinked,
    switchyard: allLinked && lethalNeutralized,
    'split-junction': allLinked && lethalNeutralized,
    'crossbar-depot': allLinked,
    'cooling-loop': allLinked && lethalNeutralized,
    'livewire-remix': evidence.activeImpactClosure,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Livewire goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    allLinked,
    lethalNeutralized,
    warningClosure: evidence.warningClosure,
    activeImpactClosure: evidence.activeImpactClosure,
  };
}
