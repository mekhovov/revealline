import assert from 'node:assert/strict';

// Historical assessors retain their original arithmetic and report schema.
// Current qualification boundaries must apply this separate acceptance policy.
export const EMPIRICAL_CLOCK_ASSESSMENT = 'SoloEmpiricalClockSensitivityV2';
export const EMPIRICAL_CLOCK_LIMITATION =
  'The observed minimum clock increment is not an independently justified duration-error bound; the calculated interval is conditional sensitivity evidence and cannot clear the 5% qualification gate.';

export function assessEmpiricalClockOverhead(analysis) {
  assert(analysis && typeof analysis === 'object', 'Missing conditional overhead analysis');
  assert(
    ['pass', 'fail', 'pass-scoped-envelope', 'fail-scoped-envelope', 'unresolved'].includes(
      analysis.status,
    ),
    'Unknown conditional overhead status',
  );
  assert.equal(analysis.limit, 0.05, 'The overhead qualification limit is unchanged');
  assert(Array.isArray(analysis.reasons), 'Missing conditional analysis reasons');
  return {
    ...analysis,
    status: 'unresolved',
    conditionalStatus: analysis.status,
    qualificationAssessment: {
      format: EMPIRICAL_CLOCK_ASSESSMENT,
      eligible: false,
      clockEvidence: 'empirical-minimum-step-only',
    },
    reasons: [...analysis.reasons, EMPIRICAL_CLOCK_LIMITATION],
  };
}
