import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { completionReport, hasExactCurrentCoverage } from './branch-reconciliation-rules.mjs';

const directory = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const read = async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const inventory = await read('inventory.json');
const reconciled = await read('reconciled.json');
const patches = await read('patch-index.json');
const coverage = await read('coverage.json');
const supersession = await read('supersession-proof.json');
const historical = await read('historical-ref-proof.json');
const recovery = await read('recovery-ref-proof.json');
const art = await read('art-ref-proof.json');
const worktreeProof = await read('worktree-commits.json');
assert.equal(historical.main, inventory.main);
for (const data of [reconciled, patches, coverage, recovery, art, worktreeProof])
  assert.equal(data.main, inventory.main);
assert.equal(supersession.liveMainSha, inventory.main);
assert.equal(
  inventory.refs.length,
  inventory.counts.localBranches + inventory.counts.githubBranches,
);
assert.equal(inventory.worktrees.length, inventory.counts.worktrees);
assert.equal(
  new Set(inventory.refs.map((ref) => `${ref.location}:${ref.name}`)).size,
  inventory.refs.length,
);
assert.equal(new Set(inventory.refs.map((ref) => ref.tip)).size, inventory.counts.uniqueTips);
assert.deepEqual(
  inventory.refs.map((ref) => [ref.location, ref.name, ref.tip]),
  reconciled.refs.map((ref) => [ref.location, ref.name, ref.tip]),
);
const counts = {};
for (const ref of reconciled.refs) {
  assert.match(ref.tip, /^[a-f0-9]{40}$/);
  counts[ref.classification] = (counts[ref.classification] || 0) + 1;
  if (ref.classification === 'already-merged') assert.equal(ref.relationship.ahead, 0);
  if (ref.classification === 'represented-by-open-pr')
    assert(ref.pullRequests.some((pr) => pr.state === 'open' && pr.head === ref.tip));
  if (ref.classification === 'patch-equivalent-to-main') {
    const proof = coverage.coverage.find((item) => item.tip === ref.tip);
    assert(hasExactCurrentCoverage(proof));
  }
  if (
    [
      'historical-release-evidence',
      'historical-rejected-proposal',
      'superseded-historical-selector',
      'unique-changes-require-intake',
    ].includes(ref.classification) &&
    ref.proof?.file === 'historical-ref-proof.json'
  ) {
    const proof = historical.refs.find((item) => item.tip === ref.tip);
    assert(proof && proof.classification === ref.classification);
    assert.equal(proof.dirtyChangesCovered, false);
    assert(proof.refs.some((item) => item.name === ref.name && item.location === ref.location));
  }
  if (ref.proof?.file === 'art-ref-proof.json') {
    const proof = art.refs.find((item) => item.tip === ref.tip && item.name === ref.name);
    assert(proof);
    if (ref.classification === 'superseded-duplicate')
      assert.deepEqual(ref.successor, proof.successor);
  }
  if (ref.proof?.file === 'recovery-ref-proof.json') {
    const proof = recovery.pairs.find(
      (item) => item.source === ref.tip && item.target === ref.successor.tip,
    );
    assert(proof && proof.committedCoverage === 'complete-at-pinned-successor');
    assert.equal(proof.unaccountedCommittedPaths.length, 0);
    assert.equal(proof.dirtyChangesCovered, false);
  }
}
assert.deepEqual(counts, reconciled.counts.classifications);
assert.equal(supersession.mapping.length, 8);
assert.equal(new Set(supersession.mapping.map((item) => item.source)).size, 8);
assert.equal(supersession.result.unmatchedSourceCommits.length, 0);
assert.equal(supersession.pr239In245.exactSectionRetained, true);
assert(
  reconciled.worktrees
    .filter((worktree) => worktree.dirty)
    .every((worktree) => worktree.statusEntries.length),
);
assert.equal(reconciled.worktreeCommitAccounting.length, inventory.worktrees.length);
for (const worktree of inventory.worktrees) {
  const record = reconciled.worktreeCommitAccounting.find((item) => item.path === worktree.path);
  assert(record && record.tip === worktree.head);
  assert.deepEqual(
    record.proof,
    worktreeProof.proofs.find((item) => item.tip === worktree.head),
  );
}
console.log(
  JSON.stringify(
    {
      valid: true,
      main: inventory.main,
      refs: inventory.refs.length,
      worktrees: inventory.worktrees.length,
      classifications: counts,
      completion: completionReport(reconciled),
    },
    null,
    2,
  ),
);
