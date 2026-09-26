import { createHash } from 'node:crypto';
import { getSummary } from '../../game/core/index.mjs';

export const COMPANY_ROUTE_EVIDENCE_FORMAT = 'revealline-company-route-evidence.v2';
export const COMPANY_ROUTE_EVENT_TYPES = new Set([
  'boss.warning',
  'player.failed',
  'cut.closed',
  'lineImpact.created',
  'relay.opened',
  'objective.captured',
  'encounter.stageChanged',
  'encounter.defeated',
]);

/** Diagnostic provenance for raw, unrounded checkpoint references. Runtime
 * replay verification remains exact; this does not change core serialization. */
export function companyCheckpointRuntime() {
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
  };
}

/** Fixed feasibility evidence follows the main host's portable outcome contract.
 * It pins every claimed cell and objective flag without rounding coordinates or
 * accepting multiple authoritative checkpoint hashes. Continuous enemy state is
 * still checked in full by an independent replay on the executing runtime. */
export function companyRouteWitness(run) {
  const summary = getSummary(run);
  // A terminal classic step retains its swept sub-tick elapsed time instead
  // of snapping to the end-of-tick clock. Its decimal tail can vary with Math
  // approximations. Pin the exact integer tick here; the complete continuous
  // clock stays in the exact same-runtime replay.
  delete summary.time;
  return {
    summary,
    board: {
      width: run.width,
      height: run.height,
      sha256: createHash('sha256').update(Uint8Array.from(run.cells)).digest('hex'),
    },
    objectives: run.objectives.map((objective) => ({
      id: objective.id,
      required: objective.required,
      hidden: objective.hidden,
      captured: objective.captured,
      revealed: objective.revealed,
    })),
  };
}
