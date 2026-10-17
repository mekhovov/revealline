/** Diagnostic provenance/schema only; no API calls or admission authority. */
import assert from 'node:assert/strict';
import { parseStackInput, freezeStackSnapshot } from './pages-stack-contract.mjs';
import { validateCandidateRun, unsupportedCandidatePaths } from './pages-candidate-contract.mjs';

export const stackFlags = () => ({
  mergeAuthorized: false,
  qualificationPerformed: false,
  productionDeploymentPerformed: false,
});
const keys = (value, expected) =>
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), 'Unexpected packet keys');
const sha = (value) =>
  assert.ok(
    typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/u.test(value),
    'Invalid source SHA',
  );
const hash = (value) =>
  assert.ok(
    typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/u.test(value),
    'Invalid SHA-256',
  );
function positive(value) {
  assert.ok(
    (typeof value === 'string' && /^[1-9][0-9]{0,15}$/u.exec(value)?.[0] === value) ||
      (Number.isSafeInteger(value) && value > 0),
    'Invalid positive identity',
  );
  assert.ok(BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER));
  return String(value);
}
export function stackArtifactName(kind, expected) {
  assert.ok(
    ['preflight', 'pages', 'receipts', 'measurement'].includes(kind),
    'Not a stack diagnostic artifact',
  );
  return `stack-${kind}-${positive(expected.runId)}-${positive(expected.runAttempt)}`;
}
export function validateStackRun(run, expected) {
  const result = validateCandidateRun(run, {
    ...expected,
    workflowPath: '.github/workflows/measure-pages-stack.yml',
  });
  assert.equal(positive(run.run_attempt), positive(expected.runAttempt), 'Run attempt differs');
  return { ...result, runAttempt: positive(expected.runAttempt) };
}
export function stackFailure(reason) {
  assert.ok(['build-incomplete', 'independent-verification-failed'].includes(reason));
  return {
    format: 'revealline-pages-stack-measurement.v1',
    measurementComplete: false,
    currentQueueEligible: false,
    historicalDiagnosticOnly: true,
    reason,
    ...stackFlags(),
  };
}
function falseFlags(value) {
  for (const [key, expected] of Object.entries(stackFlags()))
    assert.equal(value[key], expected, 'Forbidden admission flag');
}
function validateSnapshot(input, snapshot) {
  keys(snapshot, ['format', 'mainSha', 'members', ...Object.keys(stackFlags())]);
  assert.equal(snapshot.format, 'revealline-pages-stack-snapshot.v1');
  assert.equal(snapshot.mainSha, input.mainSha);
  assert.ok(Array.isArray(snapshot.members) && snapshot.members.length === input.entries.length);
  const observations = snapshot.members.map((member, index) => {
    keys(member, [
      'prNumber',
      'repository',
      'state',
      'draft',
      'headSha',
      'headRef',
      'baseRef',
      'baseSha',
      'baseTipSha',
      'mergeable',
      'mergeableState',
      'checks',
      'statuses',
    ]);
    assert.equal(member.state, 'OPEN');
    assert.ok(Array.isArray(member.checks));
    const checks = member.checks.map((check) => {
      keys(check, [
        'id',
        'name',
        'headSha',
        'appId',
        'suiteId',
        'status',
        'conclusion',
        'detailsUrl',
        'startedAt',
        'completedAt',
      ]);
      return {
        id: check.id,
        name: check.name,
        head_sha: check.headSha,
        app: { id: check.appId },
        check_suite: { id: check.suiteId },
        status: check.status,
        conclusion: check.conclusion,
        details_url: check.detailsUrl,
        started_at: check.startedAt,
        completed_at: check.completedAt,
      };
    });
    return {
      pull: {
        number: member.prNumber,
        state: 'open',
        draft: member.draft,
        mergeable: member.mergeable,
        mergeable_state: member.mergeableState,
        head: { sha: member.headSha, ref: member.headRef, repo: { full_name: member.repository } },
        base: { sha: member.baseSha, ref: member.baseRef, repo: { full_name: member.repository } },
      },
      baseTipSha: member.baseTipSha,
      baseProof: { ancestor: member.baseSha, descendant: member.baseTipSha, verified: true },
      parentProof: index
        ? { ancestor: input.entries[index - 1].headSha, descendant: member.headSha, verified: true }
        : null,
      checks: { total_count: checks.length, check_runs: checks },
      statuses: member.statuses.map((status) => {
        keys(status, [
          'id',
          'context',
          'state',
          'targetUrl',
          'description',
          'createdAt',
          'updatedAt',
        ]);
        return {
          id: status.id,
          context: status.context,
          state: status.state,
          target_url: status.targetUrl,
          description: status.description,
          created_at: status.createdAt,
          updated_at: status.updatedAt,
        };
      }),
    };
  });
  assert.deepEqual(
    freezeStackSnapshot(input, observations),
    snapshot,
    'Noncanonical frozen snapshot',
  );
}

export function validateStackPacket(packet, expected) {
  assert.ok(packet && typeof packet === 'object' && !Array.isArray(packet));
  keys(packet, [
    'format',
    'controllerSha',
    'runId',
    'runAttempt',
    'input',
    'snapshot',
    'composition',
    'pathEvidence',
    'syntheticSha',
    'syntheticTree',
    'sourceCommittedAt',
    'buildVersion',
    'overlay',
    'controllerClosure',
    ...Object.keys(stackFlags()),
  ]);
  assert.equal(packet.format, 'revealline-pages-stack-preflight.v1');
  sha(packet.controllerSha);
  assert.equal(packet.controllerSha, expected.controllerSha);
  assert.equal(positive(packet.runId), positive(expected.runId));
  assert.equal(positive(packet.runAttempt), positive(expected.runAttempt));
  keys(packet.input, ['mainSha', 'entries']);
  const input = parseStackInput(packet.input.mainSha, JSON.stringify(packet.input.entries));
  assert.deepEqual(packet.input, input);
  assert.equal(input.mainSha, packet.controllerSha);
  validateSnapshot(input, packet.snapshot);
  const composition = packet.composition;
  keys(composition, [
    'format',
    'mainSha',
    'headShas',
    'steps',
    'tree',
    'commit',
    ...Object.keys(stackFlags()),
  ]);
  assert.equal(composition.format, 'revealline-pages-stack-object-composition.v1');
  assert.equal(composition.mainSha, input.mainSha);
  assert.deepEqual(
    composition.headShas,
    input.entries.map((row) => row.headSha),
  );
  assert.ok(Array.isArray(composition.steps) && composition.steps.length === input.entries.length);
  let previous = input.mainSha;
  const pairs = [];
  const commits = new Set([previous, ...composition.headShas]);
  for (const [index, step] of composition.steps.entries()) {
    keys(step, ['headSha', 'tree', 'commit']);
    assert.equal(step.headSha, input.entries[index].headSha);
    sha(step.tree);
    sha(step.commit);
    assert.ok(!commits.has(step.commit), 'Duplicate synthetic commit');
    commits.add(step.commit);
    pairs.push([previous, step.commit]);
    previous = step.commit;
  }
  assert.equal(composition.commit, previous);
  assert.equal(composition.tree, composition.steps.at(-1).tree);
  assert.equal(packet.syntheticSha, composition.commit);
  assert.equal(packet.syntheticTree, composition.tree);
  assert.equal(packet.buildVersion, `main-${packet.syntheticSha.slice(0, 12)}`);
  assert.ok(
    typeof packet.sourceCommittedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u.exec(
        packet.sourceCommittedAt,
      )?.[0] === packet.sourceCommittedAt &&
      Number.isFinite(Date.parse(packet.sourceCommittedAt)),
    'Invalid frozen source timestamp',
  );
  const closure = packet.controllerClosure;
  keys(closure, ['entry', 'paths', 'packages', 'files']);
  assert.equal(closure.entry, 'publishing/optional-package-promotion.mjs');
  assert.ok(
    Array.isArray(closure.paths) && closure.paths.length > 0 && closure.paths.length <= 2000,
  );
  assert.equal(new Set(closure.paths).size, closure.paths.length);
  assert.ok(closure.paths.includes(closure.entry));
  assert.ok(
    Array.isArray(closure.packages) &&
      closure.packages.length <= 1000 &&
      closure.packages.every((name) => typeof name === 'string' && name.length <= 500),
  );
  assert.ok(Array.isArray(closure.files) && closure.files.length === closure.paths.length);
  for (const [index, file] of closure.files.entries()) {
    keys(file, ['path', 'sha256']);
    assert.equal(file.path, closure.paths[index]);
    assert.ok(
      typeof file.path === 'string' &&
        /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*\.(?:mjs|js|json)$/u.test(
          file.path,
        ),
    );
    hash(file.sha256);
  }
  pairs.push([input.mainSha, composition.commit]);
  assert.ok(Array.isArray(packet.pathEvidence) && packet.pathEvidence.length === pairs.length);
  for (const [index, evidence] of packet.pathEvidence.entries()) {
    keys(evidence, ['baseSha', 'sourceSha', 'paths']);
    assert.deepEqual([evidence.baseSha, evidence.sourceSha], pairs[index]);
    assert.deepEqual(unsupportedCandidatePaths(evidence.paths), []);
    assert.equal(new Set(evidence.paths).size, evidence.paths.length);
    assert.deepEqual(
      evidence.paths.filter((name) => closure.paths.includes(name)),
      [],
    );
  }
  // The trusted preflight checksum authenticates the entire overlay identity;
  // final acceptance additionally rerenders/redownloads it with trusted code.
  const overlay = packet.overlay;
  keys(overlay, ['format', 'repository', 'basePath', 'selectorSha256', 'releases', 'files']);
  assert.equal(overlay.format, 'revealline-pages-candidate-overlay.v1');
  assert.equal(overlay.repository, 'mekhovov/revealline');
  assert.equal(overlay.basePath, '/revealline/');
  hash(overlay.selectorSha256);
  assert.ok(Array.isArray(overlay.releases) && overlay.releases.length <= 1000);
  assert.ok(
    Array.isArray(overlay.files) && overlay.files.length > 0 && overlay.files.length <= 20000,
  );
  assert.equal(new Set(overlay.files.map((file) => file.path)).size, overlay.files.length);
  let bytes = 0;
  for (const file of overlay.files) {
    keys(file, ['path', 'bytes', 'sha256']);
    assert.ok(
      typeof file.path === 'string' &&
        file.path.length <= 500 &&
        /^practice\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u.test(
          file.path,
        ),
    );
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
    hash(file.sha256);
    bytes += file.bytes;
    assert.ok(bytes <= 950000000);
  }
  falseFlags(packet);
  falseFlags(packet.snapshot);
  falseFlags(composition);
  return packet;
}
