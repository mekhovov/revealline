import { COMMIT, SHA, digest, exact, parseJSON, safePath } from './metadata.mjs';

export const V2_NON_TEST_GATES = Object.freeze([
  'validate',
  'lint',
  'format',
  'native-format',
  'motion-syntax',
]);
export const V2_NON_TEST_COMMANDS = Object.freeze([
  'npm run validate',
  'npm run lint',
  'npm run format:check',
  'npm run format:native:check',
  'node --check authoring/motion-lab/app.js',
]);

const successfulStep = (row) =>
  row?.step?.status === 'completed' && row?.step?.conclusion === 'success';
const positive = (value, maximum) => Number.isSafeInteger(value) && value > 0 && value <= maximum;
const genericEvidencePin = (pin) =>
  exact(pin, ['path', 'bytes', 'sha256']) &&
  Number.isSafeInteger(pin.bytes) &&
  pin.bytes >= 0 &&
  pin.bytes <= 64 * 1024 * 1024 &&
  SHA.test(pin.sha256) &&
  (() => {
    safePath(pin.path);
    return true;
  })();
const boundedEvidencePin = (pin, maximum) =>
  genericEvidencePin(pin) && positive(pin.bytes, maximum);
const samePin = (left, right) =>
  left.path === right.path && left.bytes === right.bytes && left.sha256 === right.sha256;

/**
 * Validate the temporary, explicitly authorized v2 qualification without ever
 * representing skipped automated tests as passed. The policy reader must return
 * the original file from the exact qualified source commit.
 */
export async function validateWaivedSourceQualification({
  qualification,
  version,
  sourceRevision,
  sourceTree = '',
  readPolicyEvidence,
}) {
  if (
    !qualification ||
    typeof qualification !== 'object' ||
    Array.isArray(qualification) ||
    qualification.format !== 'revealline-source-qualification.v2' ||
    qualification.status !== 'qualified-with-test-waiver' ||
    qualification.releaseEligible !== true ||
    qualification.version !== version ||
    qualification.sourceRevision !== sourceRevision ||
    !COMMIT.test(qualification.sourceTree) ||
    (sourceTree && qualification.sourceTree !== sourceTree) ||
    qualification.actualCheckoutCommit !== qualification.sourceRevision ||
    qualification.actualCheckoutTree !== qualification.sourceTree ||
    qualification.allTrackedSourceContentsAndModesMatch !== true ||
    Object.hasOwn(qualification, 'passed') ||
    ['testFiles', 'testShards', 'shards', 'additionalManualQualification'].some((key) =>
      Object.hasOwn(qualification, key),
    ) ||
    !exact(qualification.tests, ['status', 'counts']) ||
    qualification.tests.status !== 'waived' ||
    qualification.tests.counts !== null ||
    !Array.isArray(qualification.gates) ||
    qualification.gates.length !== V2_NON_TEST_GATES.length ||
    qualification.gates.some(
      (row, index) =>
        row?.gate !== V2_NON_TEST_GATES[index] ||
        row?.command !== V2_NON_TEST_COMMANDS[index] ||
        !positive(row?.jobId, 1e14) ||
        Object.hasOwn(row, 'actualJobSteps') ||
        typeof row?.step?.name !== 'string' ||
        !row.step.name ||
        !positive(row.step.number, 10_000) ||
        !successfulStep(row),
    )
  )
    throw new Error('Waived source qualification identity or result mismatch.');

  const testPolicy = qualification.testPolicy;
  if (
    !exact(testPolicy, ['mode', 'authorization', 'reason', 'policyEvidence']) ||
    testPolicy.mode !== 'waived' ||
    testPolicy.authorization !== 'explicit-user-request-20260922' ||
    typeof testPolicy.reason !== 'string' ||
    !testPolicy.reason.trim() ||
    testPolicy.reason.length > 2000
  )
    throw new Error('Waived source qualification needs the explicit test policy.');
  const pin = testPolicy.policyEvidence;
  if (
    !boundedEvidencePin(pin, 16 * 1024) ||
    pin.path !== 'publishing/test-policy.json' ||
    typeof readPolicyEvidence !== 'function'
  )
    throw new Error('Waived source qualification needs exact policy evidence.');
  const waiver = qualification.waiverEvidence,
    evidencePins = qualification.evidencePins;
  if (
    !exact(waiver, ['runId', 'runEvidence', 'jobsEvidence']) ||
    !positive(waiver.runId, 1e14) ||
    !boundedEvidencePin(waiver.runEvidence, 4 * 1024 * 1024) ||
    !boundedEvidencePin(waiver.jobsEvidence, 4 * 1024 * 1024) ||
    !Array.isArray(evidencePins) ||
    evidencePins.length < 3 ||
    evidencePins.length > 2000 ||
    evidencePins.some((item) => !genericEvidencePin(item)) ||
    new Set(evidencePins.map((item) => item.path)).size !== evidencePins.length ||
    [pin, waiver.runEvidence, waiver.jobsEvidence].some(
      (wanted) => !evidencePins.some((item) => samePin(item, wanted)),
    )
  )
    throw new Error('Waived source qualification evidence pins are incomplete.');
  const premerge = qualification.preMergeValidationCorroboration,
    legacyBuild = qualification.ordinaryBuildCorroboration,
    focused = qualification.focusedAdmissionCorroboration,
    frozen = qualification.frozenArtifactCorroboration;
  const focusedValid =
    exact(focused, [
      'runId', 'jobId', 'aggregateJobId', 'sourceRevision', 'sourceTree',
      'classificationSteps', 'genericBuild', 'fullTests', 'scope',
    ]) &&
    positive(focused?.runId, 1e14) && positive(focused?.jobId, 1e14) &&
    positive(focused?.aggregateJobId, 1e14) && COMMIT.test(focused?.sourceRevision) &&
    focused?.sourceTree === qualification.sourceTree &&
    Array.isArray(focused?.classificationSteps) && focused.classificationSteps.length === 2 &&
    focused.classificationSteps.every((row) =>
      exact(row, ['name', 'number', 'status', 'conclusion']) &&
      positive(row.number, 10_000) && row.status === 'completed' && row.conclusion === 'success') &&
    focused.classificationSteps.map((row) => row.name).join('\n') ===
      'Capture the reviewed changed-path set\nSelect the fail-closed focused gate' &&
    exact(focused?.genericBuild, ['jobId', 'status']) &&
    positive(focused.genericBuild.jobId, 1e14) &&
    focused.genericBuild.status === 'skipped-by-fast-release-policy' &&
    exact(focused?.fullTests, ['status']) && focused.fullTests.status === 'waived-and-skipped' &&
    typeof focused.scope === 'string' && Boolean(focused.scope.trim());
  if (
    [premerge, legacyBuild, focused].filter((item) => item !== undefined).length !== 1 ||
    !(
      (premerge?.command === 'npm run validate' &&
        exact(premerge, [
          'runId',
          'jobId',
          'command',
          'step',
          'sourceRevision',
          'sourceTree',
          'artifactBuild',
          'scope',
        ]) &&
        positive(premerge.runId, 1e14) &&
        positive(premerge.jobId, 1e14) &&
        successfulStep(premerge) &&
        COMMIT.test(premerge.sourceRevision) &&
        COMMIT.test(premerge.sourceTree) &&
        typeof premerge.scope === 'string' &&
        Boolean(premerge.scope.trim()) &&
        exact(premerge.artifactBuild, ['status', 'step']) &&
        premerge.artifactBuild?.status === 'deferred-to-frozen-source' &&
        successfulStep(premerge.artifactBuild)) ||
      (legacyBuild?.command === 'npm run build' && successfulStep(legacyBuild)) ||
      focusedValid
    ) ||
    !positive(frozen?.artifactId, 1e14) ||
    (Object.hasOwn(frozen, 'runId') && frozen.runId !== waiver.runId) ||
    ![
      'wholeOriginalArtifactVerifiedBeforeQualification',
      'sourceTarGitBlobTypeModeAndPaxCommitVerified',
      'allInnerZipManifestBytesVerified',
      'frozenOfflineInventoryAndBindingsVerified',
    ].every((key) => frozen[key] === true)
  )
    throw new Error(
      'Waived source qualification PR validation/deferral or frozen artifact proof is incomplete.',
    );
  const bytes = await readPolicyEvidence(
    qualification.sourceRevision,
    'publishing/test-policy.json',
  );
  if (!(bytes instanceof Uint8Array) || bytes.length !== pin.bytes || digest(bytes) !== pin.sha256)
    throw new Error('Waived source qualification policy byte pin mismatch.');
  const policy = parseJSON(bytes, 16 * 1024);
  if (
    !exact(policy, ['format', 'mode', 'authorization', 'scope', 'reason', 'restoration']) ||
    policy.format !== 'revealline-release-test-policy.v1' ||
    policy.mode !== 'waived' ||
    policy.authorization !== 'explicit-user-request-20260922' ||
    policy.scope !== 'automated-test-suites' ||
    policy.reason !== testPolicy.reason ||
    typeof policy.restoration !== 'string' ||
    !policy.restoration.trim() ||
    policy.restoration.length > 2000
  )
    throw new Error('Waived source qualification policy is invalid.');
  return qualification;
}
