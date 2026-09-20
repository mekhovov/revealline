import { CELL } from '../../core/index.mjs';
import { roverLinks } from './rover-goal.mjs';

// Test-only predicates: these do not award progress or change completion rules.
export function createFractureGoalEvidence() {
  return {
    eroded: new Set(),
    repairs: new Set(),
    districts: new Set(),
    anchorCoverage: new Map(),
    activeClosure: false,
  };
}

export function observeFractureGoal(run, evidence, before) {
  for (const event of run.events) {
    if (event.type === 'cells.eroded') for (const cell of event.indices) evidence.eroded.add(cell);
    if (event.type === 'cut.closed') {
      for (const cell of evidence.eroded)
        if (run.cells[cell] === CELL.SAFE) evidence.repairs.add(cell);
      for (const cell of before.trail) {
        const x = cell % run.width;
        if (x < 34) evidence.districts.add('west');
        if (x >= 38) evidence.districts.add('east');
      }
      evidence.activeClosure ||= before.activeRoamer;
    }
  }
  for (const objective of run.objectives)
    if (objective.required && objective.captured && !evidence.anchorCoverage.has(objective.id))
      evidence.anchorCoverage.set(objective.id, run.coverage);
}

export function inspectFractureGoal({ missionId, run, foundations, evidence, coverageTarget }) {
  const repair = evidence.repairs.size > 0;
  const allLinked = roverLinks(run, foundations);
  const required = run.objectives.filter((o) => o.required);
  const anchors = required.every((o) => o.captured);
  const earlyAnchors = (fraction) =>
    required.every(
      (o) =>
        evidence.anchorCoverage.has(o.id) &&
        evidence.anchorCoverage.get(o.id) < coverageTarget * fraction,
    );
  const materialsNeutralized = run.classic.terrain.every(
    (kind, cell) => !kind || run.cells[cell] !== CELL.FIELD,
  );
  const lethalNeutralized = run.classic.terrain.every(
    (kind, cell) => kind !== 2 || run.cells[cell] !== CELL.FIELD,
  );
  const conditions = {
    'first-fracture': repair,
    'island-reserve': allLinked && repair,
    'two-districts': evidence.districts.size === 2 && lethalNeutralized,
    'bank-the-crossing': earlyAnchors(0.5),
    'five-anchors': earlyAnchors(0.75),
    'staggered-reserve': anchors && materialsNeutralized,
    'fracture-remix': anchors && repair && evidence.activeClosure,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Fractured Grid goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    repair,
    allLinked,
    anchors,
    anchorCoverage: [...evidence.anchorCoverage],
    materialsNeutralized,
    lethalNeutralized,
    districts: [...evidence.districts],
    activeClosure: evidence.activeClosure,
  };
}
