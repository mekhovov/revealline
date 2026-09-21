// Test-only adapters for existing authored-goal predicates, never runtime awards.
import { CELL } from '../../core/index.mjs';
import { inspectCaptureSnapshot } from '../../core/capture-regions.mjs';
import { inspectNeonGoal } from './neon-goal.mjs';
import { createSignalGoalEvidence, observeSignalGoal, inspectSignalGoal } from './signal-goal.mjs';
import { inspectRoverGoal, roverLinks } from './rover-goal.mjs';
import {
  createPhaseGoalEvidence,
  phaseBeforeStep,
  observePhaseGoal,
  inspectPhaseGoal,
} from './phase-goal.mjs';
import {
  createSentinelGoalEvidence,
  observeSentinelGoal,
  inspectSentinelGoal,
} from './sentinel-goal.mjs';
import {
  createOpeningObservations,
  openingBeforeStep,
  observeOpeningStep,
  inspectOpeningObservations,
} from './opening-route-observations.mjs';

export function createMiddleEvidence(chapter, run, map) {
  if (!['signal', 'neon', 'rover', 'phase', 'sentinel'].includes(chapter))
    throw Error('Unsupported pressure evidence chapter');
  return {
    chapter,
    initialComponents: inspectCaptureSnapshot(run).components,
    spatial: createOpeningObservations(run),
    closedTrails: [],
    roverClosures: [],
    phase: chapter === 'phase' ? createPhaseGoalEvidence(run) : null,
    sentinel: chapter === 'sentinel' ? createSentinelGoalEvidence() : null,
    signal: chapter === 'signal' ? createSignalGoalEvidence(map, run) : null,
    firstActive: new Map(),
    impactSeeds: 0,
  };
}
export function middleBeforeStep(run, evidence) {
  return {
    spatial: openingBeforeStep(run),
    activeIds: run.enemies
      .filter((a) => a.type === 'claimed-rover' && a.classic.mode === 'active')
      .map((a) => a.id),
    phase: evidence.chapter === 'phase' ? phaseBeforeStep(run) : null,
  };
}
export function observeMiddleEvidence(run, evidence, before) {
  observeOpeningStep(run, evidence.spatial, before.spatial);
  if (run.events.some((e) => e.type === 'cut.closed')) {
    evidence.closedTrails.push(before.spatial.trail);
    evidence.roverClosures.push({
      trail: before.spatial.trail,
      activeIds: before.activeIds,
      allLinked: run.level.foundations.length === 0 || roverLinks(run, run.level.foundations),
    });
  }
  for (const actor of run.enemies)
    if (
      actor.type === 'claimed-rover' &&
      actor.classic.mode === 'active' &&
      !evidence.firstActive.has(actor.id)
    )
      evidence.firstActive.set(actor.id, run.tick);
  evidence.impactSeeds += run.events.filter((e) => e.type === 'lineImpact.seeded').length;
  if (evidence.phase) observePhaseGoal(run, evidence.phase, before.phase);
  if (evidence.sentinel) observeSentinelGoal(run, evidence.sentinel);
  if (evidence.signal) observeSignalGoal(run, evidence.signal);
}
export function inspectMiddleEvidence(run, evidence) {
  const args = {
    missionId: run.level.id,
    run,
    foundations: run.level.foundations,
    initialComponents: evidence.initialComponents,
  };
  const optionalGoal =
    evidence.chapter === 'neon'
      ? inspectNeonGoal({ ...args, closedTrails: evidence.closedTrails })
      : evidence.chapter === 'rover'
        ? inspectRoverGoal({ ...args, closures: evidence.roverClosures })
        : evidence.chapter === 'phase'
          ? inspectPhaseGoal({ ...args, evidence: evidence.phase })
          : evidence.chapter === 'sentinel'
            ? inspectSentinelGoal({ ...args, evidence: evidence.sentinel })
            : inspectSignalGoal({ ...args, evidence: evidence.signal });
  return {
    optionalGoal,
    spatial: inspectOpeningObservations(run, evidence.spatial),
    firstActive: [...evidence.firstActive],
    impactSeeds: evidence.impactSeeds,
    activeClosures: evidence.roverClosures.filter((c) => c.activeIds.length > 0).length,
    remainingSlow: run.classic.terrain.reduce(
      (n, kind, i) => n + Number(kind === 1 && run.cells[i] === CELL.FIELD),
      0,
    ),
    remainingLethal: run.classic.terrain.reduce(
      (n, kind, i) => n + Number(kind === 2 && run.cells[i] === CELL.FIELD),
      0,
    ),
  };
}
