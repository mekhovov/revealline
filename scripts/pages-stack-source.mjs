/** Trusted adapters only: freeze exact source before any candidate execution. */
import assert from 'node:assert/strict';
import { parseStackInput, freezeStackSnapshot } from './pages-stack-contract.mjs';
import { unsupportedCandidatePaths, CANDIDATE_REPOSITORY } from './pages-candidate-contract.mjs';

const flags = () => ({
  mergeAuthorized: false,
  qualificationPerformed: false,
  productionDeploymentPerformed: false,
});
function sha(value) {
  assert.ok(
    typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/u.test(value),
    'Invalid exact SHA',
  );
  return value;
}
function canonicalInput(input) {
  assert.deepEqual(Object.keys(input).sort(), ['entries', 'mainSha']);
  return parseStackInput(input.mainSha, JSON.stringify(input.entries));
}
async function completeChecks(api, headSha) {
  const runs = [];
  let total;
  for (let page = 1; page <= 10; page++) {
    const value = await api(`commits/${headSha}/check-runs?filter=all&per_page=100&page=${page}`);
    assert.ok(
      Number.isSafeInteger(value?.total_count) &&
        value.total_count >= 0 &&
        value.total_count <= 1000,
      'Invalid check count',
    );
    assert.ok(
      Array.isArray(value.check_runs) && value.check_runs.length <= 100,
      'Invalid check page',
    );
    total ??= value.total_count;
    assert.equal(value.total_count, total, 'Check count changed during pagination');
    runs.push(...value.check_runs);
    assert.equal(
      new Set(runs.map((row) => row.id)).size,
      runs.length,
      'Duplicate check IDs across pages',
    );
    assert.ok(runs.length <= total, 'Check page exceeds declared count');
    if (runs.length === total) return { total_count: total, check_runs: runs };
    assert.equal(value.check_runs.length, 100, 'Incomplete check pagination');
  }
  assert.fail('Incomplete check inventory');
}
function branchTip(value) {
  assert.equal(value?.object?.type, 'commit', 'Branch ref has no commit');
  return sha(value.object.sha);
}
async function completeStatuses(api, headSha) {
  const statuses = [];
  for (let page = 1; page <= 11; page++) {
    const values = await api(`commits/${headSha}/statuses?per_page=100&page=${page}`);
    assert.ok(Array.isArray(values) && values.length <= 100, 'Invalid commit status page');
    statuses.push(...values);
    assert.ok(statuses.length <= 1000, 'Oversized commit status inventory');
    assert.equal(
      new Set(statuses.map((value) => value.id)).size,
      statuses.length,
      'Duplicate status identities across pages',
    );
    if (values.length < 100) return statuses;
  }
  assert.fail('Incomplete commit status inventory');
}

/** fetchObjects/prove must use the trusted caller's isolated Git object store.
 * Freshness reads may omit fetching: the original exact objects already exist.
 */
export async function readStackObservations(rawInput, { api, fetchObjects, prove }) {
  const input = canonicalInput(rawInput);
  assert.equal(typeof api, 'function');
  assert.equal(typeof prove, 'function');
  const pulls = [];
  for (const entry of input.entries) {
    const pull = await api(`pulls/${entry.prNumber}`);
    assert.equal(pull?.number, entry.prNumber, 'PR number differs');
    assert.equal(pull?.state, 'open', 'PR is not open');
    assert.equal(pull?.head?.repo?.full_name, CANDIDATE_REPOSITORY, 'Foreign head repository');
    assert.equal(pull?.base?.repo?.full_name, CANDIDATE_REPOSITORY, 'Foreign base repository');
    assert.equal(sha(pull.head.sha), entry.headSha, 'Head moved');
    sha(pull.base.sha);
    assert.ok(typeof pull.base.ref === 'string' && pull.base.ref.length <= 255, 'Missing base ref');
    pulls.push(pull);
  }
  if (fetchObjects)
    await fetchObjects([
      ...new Set([
        input.mainSha,
        ...input.entries.map((row) => row.headSha),
        ...pulls.map((pull) => pull.base.sha),
      ]),
    ]);
  const observations = [];
  for (const [index, pull] of pulls.entries()) {
    const baseTipSha = branchTip(await api(`git/ref/heads/${encodeURIComponent(pull.base.ref)}`));
    const baseProof = {
      ancestor: pull.base.sha,
      descendant: baseTipSha,
      verified: await prove(pull.base.sha, baseTipSha),
    };
    const parentProof = index
      ? {
          ancestor: input.entries[index - 1].headSha,
          descendant: pull.head.sha,
          verified: await prove(input.entries[index - 1].headSha, pull.head.sha),
        }
      : null;
    observations.push({
      pull,
      baseTipSha,
      baseProof,
      parentProof,
      checks: await completeChecks(api, pull.head.sha),
      statuses: await completeStatuses(api, pull.head.sha),
    });
  }
  // Reject malformed identity/proof/check inventories before returning anything.
  freezeStackSnapshot(input, observations);
  return observations;
}

export async function freezeStackSources(rawInput, options) {
  const input = canonicalInput(rawInput);
  const { api, compose, changedPaths, closurePaths } = options;
  assert.equal(
    branchTip(await api('git/ref/heads/main')),
    input.mainSha,
    'Main moved before preflight',
  );
  assert.ok(
    Array.isArray(closurePaths) && new Set(closurePaths).size === closurePaths.length,
    'Invalid trusted renderer closure',
  );
  const observations = await readStackObservations(input, options);
  const snapshot = freezeStackSnapshot(input, observations);
  const composition = await compose({
    mainSha: input.mainSha,
    headShas: input.entries.map((row) => row.headSha),
  });
  assert.equal(composition?.format, 'revealline-pages-stack-object-composition.v1');
  assert.equal(composition.mainSha, input.mainSha);
  assert.deepEqual(
    composition.headShas,
    input.entries.map((row) => row.headSha),
  );
  assert.ok(Array.isArray(composition.steps) && composition.steps.length === input.entries.length);
  for (const [key, value] of Object.entries(flags()))
    assert.equal(composition[key], value, 'Composition grants forbidden authority');
  const diffs = [];
  let previous = input.mainSha;
  for (const [index, step] of composition.steps.entries()) {
    assert.equal(step.headSha, input.entries[index].headSha, 'Composition head differs');
    sha(step.tree);
    sha(step.commit);
    assert.notEqual(step.commit, previous, 'Composition did not advance');
    diffs.push([previous, step.commit]);
    previous = step.commit;
  }
  assert.equal(composition.commit, previous);
  assert.equal(composition.tree, composition.steps.at(-1).tree);
  diffs.push([input.mainSha, composition.commit]);
  const pathEvidence = [];
  for (const [baseSha, sourceSha] of diffs) {
    const paths = await changedPaths(baseSha, sourceSha);
    assert.deepEqual(
      unsupportedCandidatePaths(paths),
      [],
      'Unsupported publication contract change',
    );
    assert.deepEqual(
      paths.filter((name) => closurePaths.includes(name)),
      [],
      'Changed trusted renderer closure',
    );
    pathEvidence.push({ baseSha, sourceSha, paths: [...paths].sort() });
  }
  assert.equal(
    branchTip(await api('git/ref/heads/main')),
    input.mainSha,
    'Main moved during preflight',
  );
  return { input, snapshot, composition, pathEvidence, ...flags() };
}
