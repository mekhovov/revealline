/** Pure bounded stack identity/freshness validation. Never merge admission. */
import assert from 'node:assert/strict';
import { CANDIDATE_REPOSITORY } from './pages-candidate-contract.mjs';

const flags = () => ({
  mergeAuthorized: false,
  qualificationPerformed: false,
  productionDeploymentPerformed: false,
});
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function exactKeys(value, keys) {
  assert.ok(object(value), 'Expected object');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Unexpected object keys');
}
function sha(value) {
  assert.ok(
    typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value) && value.length === 40,
    'Invalid exact SHA',
  );
  return value;
}
function id(value, maximum = Number.MAX_SAFE_INTEGER) {
  assert.ok(
    Number.isSafeInteger(value) && value > 0 && value <= maximum,
    'Invalid positive identity',
  );
  return value;
}
function ref(value) {
  assert.ok(
    typeof value === 'string' &&
      value.length <= 255 &&
      /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(value),
    'Invalid branch ref',
  );
  assert.ok(
    !value.includes('..') &&
      value
        .split('/')
        .every(
          (part) => part && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'),
        ),
    'Unsafe branch ref',
  );
  return value;
}
function entries(value) {
  assert.ok(
    Array.isArray(value) && value.length >= 2 && value.length <= 3,
    'Expected two or three ordered entries',
  );
  const result = value.map((row) => {
    exactKeys(row, ['prNumber', 'headSha']);
    return { prNumber: id(row.prNumber, 99999999), headSha: sha(row.headSha) };
  });
  assert.equal(new Set(result.map((row) => row.prNumber)).size, result.length, 'Duplicate PR');
  assert.equal(new Set(result.map((row) => row.headSha)).size, result.length, 'Duplicate head');
  return result;
}
export function parseStackInput(mainSha, text) {
  sha(mainSha);
  assert.ok(
    typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= 4096,
    'Oversized or missing stack input',
  );
  const parsed = JSON.parse(text);
  const canonical = entries(parsed);
  // Input fields admit only literal keys, integers and SHA strings: after the
  // semantic checks above, whitespace is insignificant. This rejects duplicate
  // keys and noncanonical/escaped numeric/string spellings lost by JSON.parse.
  assert.equal(text.replace(/\s/gu, ''), JSON.stringify(parsed), 'Ambiguous JSON input');
  assert.ok(!canonical.some((row) => row.headSha === mainSha), 'Main is not a candidate head');
  return { mainSha, entries: canonical };
}
function ancestry(proof, ancestor, descendant) {
  exactKeys(proof, ['ancestor', 'descendant', 'verified']);
  assert.equal(proof.ancestor, ancestor, 'Ancestry source differs');
  assert.equal(proof.descendant, descendant, 'Ancestry destination differs');
  assert.equal(proof.verified, true, 'Missing trusted Git ancestry proof');
}
function nullableText(value) {
  assert.ok(
    value === null || (typeof value === 'string' && value.length <= 4096),
    'Invalid check metadata',
  );
  return value;
}
function statusInventory(values) {
  assert.ok(
    Array.isArray(values) && values.length <= 1000,
    'Missing or oversized commit-status inventory',
  );
  const result = values
    .map((row) => {
      assert.ok(
        object(row) &&
          typeof row.context === 'string' &&
          row.context.length > 0 &&
          row.context.length <= 1024,
        'Invalid commit status context',
      );
      assert.ok(
        ['error', 'failure', 'pending', 'success'].includes(row.state),
        'Invalid commit status state',
      );
      return {
        id: id(row.id),
        context: row.context,
        state: row.state,
        targetUrl: nullableText(row.target_url),
        description: nullableText(row.description),
        createdAt: nullableText(row.created_at),
        updatedAt: nullableText(row.updated_at),
      };
    })
    .sort((a, b) => a.id - b.id);
  assert.equal(
    new Set(result.map((row) => row.id)).size,
    result.length,
    'Duplicate commit status identity',
  );
  return result;
}
function checkInventory(value, headSha) {
  assert.ok(object(value) && Array.isArray(value.check_runs), 'Missing exact-head check inventory');
  assert.ok(
    Number.isSafeInteger(value.total_count) && value.total_count >= 0 && value.total_count <= 1000,
    'Invalid check inventory count',
  );
  assert.equal(value.total_count, value.check_runs.length, 'Incomplete check inventory');
  const checks = value.check_runs
    .map((row) => {
      assert.ok(object(row), 'Invalid check');
      assert.equal(sha(row.head_sha), headSha, 'Foreign check head');
      assert.ok(
        typeof row.name === 'string' && row.name.length > 0 && row.name.length <= 1024,
        'Invalid check name',
      );
      assert.ok(
        ['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending'].includes(
          row.status,
        ),
        'Invalid check status',
      );
      return {
        id: id(row.id),
        name: row.name,
        headSha,
        appId: id(row.app?.id),
        suiteId: id(row.check_suite?.id),
        status: row.status,
        conclusion: nullableText(row.conclusion),
        detailsUrl: nullableText(row.details_url),
        startedAt: nullableText(row.started_at),
        completedAt: nullableText(row.completed_at),
      };
    })
    .sort((a, b) => a.id - b.id);
  assert.equal(
    new Set(checks.map((row) => row.id)).size,
    checks.length,
    'Duplicate check identity',
  );
  return checks;
}

/** Proofs and branch tips are supplied only by the trusted Git/API caller. */
export function freezeStackSnapshot(input, observations) {
  exactKeys(input, ['mainSha', 'entries']);
  const mainSha = sha(input.mainSha);
  const ordered = entries(input.entries);
  assert.ok(!ordered.some((row) => row.headSha === mainSha), 'Main is not a candidate head');
  assert.ok(
    Array.isArray(observations) && observations.length === ordered.length,
    'Incomplete chain observations',
  );
  const members = [];
  for (const [index, expected] of ordered.entries()) {
    const observation = observations[index];
    assert.ok(object(observation) && object(observation.pull), 'Missing PR observation');
    const pull = observation.pull;
    assert.equal(pull.number, expected.prNumber, 'PR number differs');
    assert.equal(pull.state, 'open', 'PR is not open');
    assert.equal(typeof pull.draft, 'boolean', 'Missing draft state');
    assert.equal(pull.head?.repo?.full_name, CANDIDATE_REPOSITORY, 'Foreign head repository');
    assert.equal(pull.base?.repo?.full_name, CANDIDATE_REPOSITORY, 'Foreign base repository');
    assert.equal(sha(pull.head.sha), expected.headSha, 'Head moved');
    const headRef = ref(pull.head.ref);
    assert.notEqual(headRef, 'main', 'Main is not a PR head branch');
    assert.ok(!members.some((row) => row.headRef === headRef), 'Duplicate head ref');
    const baseRef = ref(pull.base.ref);
    const baseSha = sha(pull.base.sha);
    const baseTipSha = index ? ordered[index - 1].headSha : mainSha;
    assert.equal(baseRef, index ? members[index - 1].headRef : 'main', 'Dependency ref differs');
    assert.equal(sha(observation.baseTipSha), baseTipSha, 'Dependency tip moved');
    ancestry(observation.baseProof, baseSha, baseTipSha);
    if (index) ancestry(observation.parentProof, ordered[index - 1].headSha, expected.headSha);
    else assert.equal(observation.parentProof, null, 'Root cannot have a chain parent');
    assert.ok(
      pull.mergeable === null || typeof pull.mergeable === 'boolean',
      'Missing mergeability observation',
    );
    assert.ok(
      typeof pull.mergeable_state === 'string' && pull.mergeable_state.length <= 64,
      'Missing mergeability context',
    );
    members.push({
      prNumber: expected.prNumber,
      repository: CANDIDATE_REPOSITORY,
      state: 'OPEN',
      draft: pull.draft,
      headSha: expected.headSha,
      headRef,
      baseRef,
      baseSha,
      baseTipSha,
      mergeable: pull.mergeable,
      mergeableState: pull.mergeable_state,
      checks: checkInventory(observation.checks, expected.headSha),
      statuses: statusInventory(observation.statuses),
    });
  }
  return { format: 'revealline-pages-stack-snapshot.v1', mainSha, members, ...flags() };
}

export function assessStackFreshness(frozen, observations, currentMainSha) {
  assert.ok(
    object(frozen) && frozen.format === 'revealline-pages-stack-snapshot.v1',
    'Invalid frozen snapshot',
  );
  // Revalidate the supposedly trusted packet before accepting it as a baseline.
  assert.ok(Array.isArray(frozen.members), 'Missing frozen members');
  const input = {
    mainSha: sha(frozen.mainSha),
    entries: entries(
      frozen.members.map((row) => ({ prNumber: row.prNumber, headSha: row.headSha })),
    ),
  };
  for (const [key, value] of Object.entries(flags()))
    assert.equal(frozen[key], value, 'Invalid admission flag');
  const reasons = [];
  let status = 'verified';
  try {
    if (sha(currentMainSha) !== frozen.mainSha) reasons.push('main-changed');
  } catch {
    reasons.push('main-unverifiable');
    status = 'unverifiable';
  }
  if (observations === null) {
    reasons.push('chain-unverifiable');
    status = 'unverifiable';
  } else {
    try {
      const current = freezeStackSnapshot(input, observations);
      if (JSON.stringify(current) !== JSON.stringify(frozen)) reasons.push('chain-context-changed');
    } catch {
      reasons.push('chain-invalid-or-changed');
    }
  }
  return {
    current: reasons.length === 0,
    stale: reasons.length !== 0,
    currentQueueEligible: reasons.length === 0,
    historicalDiagnosticOnly: reasons.length !== 0,
    externalInputStatus: status,
    reasons,
    ...flags(),
  };
}
