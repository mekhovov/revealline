/** Pure validation for diagnostic Pages measurements; never merge admission. */
import assert from 'node:assert/strict';

export const CANDIDATE_REPOSITORY = 'mekhovov/revealline';
const shaPattern = /^[a-f0-9]{40}$/;
const selector = 'publishing/pages-controller/optional-packages.json';
const nonAdmission = () => ({
  mergeAuthorized: false,
  qualificationPerformed: false,
  productionDeploymentPerformed: false,
});
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function sha(value) {
  assert.ok(
    typeof value === 'string' && value.length === 40 && shaPattern.test(value),
    'Invalid source SHA',
  );
  return value;
}
function positiveId(value) {
  assert.ok(
    (typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value)) ||
      (Number.isSafeInteger(value) && value > 0),
    'Invalid positive identity',
  );
  assert.ok(BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER), 'Unsafe positive identity');
  if (typeof value === 'string')
    assert.equal(String(BigInt(value)), value, 'Noncanonical identity');
  return String(value);
}

export function parseCandidateInput(input) {
  assert.ok(object(input), 'Candidate inputs must be an object');
  assert.deepEqual(Object.keys(input).sort(), ['headSha', 'mainSha', 'prNumber']);
  const number = positiveId(input.prNumber);
  assert.ok(number.length <= 8, 'PR number exceeds bounded measurement scope');
  return { prNumber: Number(number), mainSha: sha(input.mainSha), headSha: sha(input.headSha) };
}

/** Accept GitHub REST PR data, returning a detached canonical snapshot. */
export function validateCandidateSnapshot(pr, rawInput, options = {}) {
  const input = parseCandidateInput(rawInput);
  const { reportedBaseSha = input.mainSha, baseIsAncestorOfMain = false } = options;
  sha(reportedBaseSha);
  assert.equal(typeof baseIsAncestorOfMain, 'boolean', 'Invalid base ancestry proof');
  assert.ok(object(pr), 'Missing PR snapshot');
  assert.equal(pr.number, input.prNumber, 'PR number differs');
  assert.ok(pr.state === 'open' || pr.state === 'OPEN', 'PR is not open');
  assert.equal(typeof pr.draft, 'boolean', 'Missing draft state');
  assert.equal(pr.base?.repo?.full_name, CANDIDATE_REPOSITORY, 'Foreign base repository');
  assert.equal(
    pr.head?.repo?.full_name,
    CANDIDATE_REPOSITORY,
    'Foreign or missing head repository',
  );
  assert.equal(pr.base.ref, 'main', 'Stacked or foreign base is unsupported');
  assert.equal(sha(pr.base.sha), reportedBaseSha, 'Stale reported base SHA');
  assert.ok(
    reportedBaseSha === input.mainSha || baseIsAncestorOfMain === true,
    'Reported base ancestry of frozen main is not verified',
  );
  assert.equal(sha(pr.head.sha), input.headSha, 'Stale head SHA');
  return {
    prNumber: input.prNumber,
    repository: CANDIDATE_REPOSITORY,
    state: 'OPEN',
    draft: pr.draft,
    baseRef: 'main',
    mainSha: input.mainSha,
    baseSha: reportedBaseSha,
    baseAncestorOfMain: true,
    headSha: input.headSha,
    headRepository: CANDIDATE_REPOSITORY,
  };
}

/** Conservative first-unit boundary. Callers must include BOTH rename endpoints. */
export function unsupportedCandidatePaths(paths) {
  assert.ok(Array.isArray(paths) && paths.length <= 10000, 'Invalid changed-path list');
  for (const name of paths)
    assert.ok(
      typeof name === 'string' &&
        name.length <= 4096 &&
        !/^[a-z]:/i.test(name) &&
        !/[\\\x00-\x1f]/.test(name) &&
        name.split('/').every((part) => part && part !== '.' && part !== '..'),
      'Unsafe changed path',
    );
  return [
    ...new Set(
      paths.filter(
        (name) =>
          ['scripts', 'publishing', '.github/workflows'].includes(name) ||
          name.startsWith('scripts/') ||
          name.startsWith('.github/workflows/') ||
          (name.startsWith('publishing/') && name !== selector) ||
          [
            'package.json',
            'package-lock.json',
            'npm-shrinkwrap.json',
            '.npmrc',
            'game/build-config.json',
            'game/optional-practice-details.mjs',
            'game/data-json.mjs',
            'optional-practice/navigation.mjs',
          ].includes(name),
      ),
    ),
  ].sort();
}

/** Run/artifact provenance binds controller SHA, NOT the unpushed synthetic SHA. */
export function validateArtifactProvenance(artifact, expected) {
  assert.ok(object(artifact) && object(expected), 'Missing artifact provenance');
  const artifactId = positiveId(expected.artifactId);
  const runId = positiveId(expected.runId);
  const controllerSha = sha(expected.controllerSha);
  assert.ok(typeof expected.name === 'string' && expected.name.length > 0, 'Missing artifact name');
  assert.equal(positiveId(artifact.id), artifactId, 'Artifact identity differs');
  assert.equal(artifact.name, expected.name, 'Artifact name differs');
  assert.equal(artifact.expired, false, 'Artifact expired or unspecified');
  assert.equal(positiveId(artifact.workflow_run?.id), runId, 'Artifact run differs');
  assert.equal(
    sha(artifact.workflow_run.head_sha),
    controllerSha,
    'Artifact controller SHA differs',
  );
  return { artifactId, runId, controllerSha, name: expected.name };
}

export function validateCandidateRun(run, expected) {
  assert.ok(object(run) && object(expected), 'Missing run provenance');
  const runId = positiveId(expected.runId);
  const controllerSha = sha(expected.controllerSha);
  assert.ok(
    typeof expected.workflowPath === 'string' &&
      !/[\x00-\x1f]/.test(expected.workflowPath) &&
      /^\.github\/workflows\/[a-z0-9-]+\.ya?ml$/.test(expected.workflowPath),
    'Invalid expected workflow path',
  );
  assert.equal(positiveId(run.id), runId, 'Run identity differs');
  assert.equal(sha(run.head_sha), controllerSha, 'Run controller SHA differs');
  assert.equal(run.head_branch, 'main', 'Run did not use main');
  assert.equal(run.event, 'workflow_dispatch', 'Run was not manual');
  assert.equal(run.path, expected.workflowPath, 'Workflow path differs');
  assert.equal(run.repository?.full_name, CANDIDATE_REPOSITORY, 'Foreign run repository');
  return { runId, controllerSha, workflowPath: expected.workflowPath };
}

/** Frozen is canonical; current is fresh REST data. Invalid data is stale, never accepted. */
export function assessCandidateFreshness(frozen, current, { expectedMainSha, currentMainSha }) {
  sha(expectedMainSha);
  sha(currentMainSha);
  assert.ok(object(frozen), 'Missing frozen snapshot');
  assert.equal(frozen.mainSha, expectedMainSha, 'Frozen main differs');
  sha(frozen.baseSha);
  assert.equal(frozen.baseAncestorOfMain, true, 'Missing frozen base ancestry proof');
  const reasons = [];
  if (currentMainSha !== expectedMainSha) reasons.push('main-changed');
  let canonical;
  try {
    canonical = validateCandidateSnapshot(
      current,
      {
        prNumber: frozen.prNumber,
        mainSha: expectedMainSha,
        headSha: current?.head?.sha,
      },
      { reportedBaseSha: frozen.baseSha, baseIsAncestorOfMain: frozen.baseAncestorOfMain },
    );
  } catch {
    reasons.push('current-snapshot-invalid-or-closed');
  }
  if (canonical)
    for (const key of [
      'prNumber',
      'repository',
      'state',
      'draft',
      'baseRef',
      'mainSha',
      'baseSha',
      'baseAncestorOfMain',
      'headSha',
      'headRepository',
    ])
      if (canonical[key] !== frozen[key]) reasons.push(`${key}-changed`);
  return {
    format: 'revealline-pages-candidate-freshness.v1',
    current: reasons.length === 0,
    stale: reasons.length !== 0,
    currentQueueEligible: reasons.length === 0,
    historicalDiagnosticOnly: reasons.length !== 0,
    reasons,
    ...nonAdmission(),
  };
}
