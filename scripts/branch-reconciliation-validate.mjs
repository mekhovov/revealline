import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const read = async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const inventory = await read('inventory.json');
const reconciled = await read('reconciled.json');
const patches = await read('patch-index.json');
const coverage = await read('coverage.json');
const supersession = await read('supersession-proof.json');
const historical = await read('historical-ref-proof.json');
assert.equal(historical.main, inventory.main);
for (const data of [reconciled, patches, coverage]) assert.equal(data.main, inventory.main);
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
    assert(proof && (proof.allChangedPathsExact || proof.allNonMergePatchesMatchMain));
    if (proof.allChangedPathsExact) assert(proof.changes.every((item) => item.exact));
    if (proof.allNonMergePatchesMatchMain)
      assert(patches.refs.find((item) => item.tip === ref.tip)?.allNonMergePatchesMatchMain);
  }
  if (
    [
      'historical-release-evidence',
      'historical-rejected-proposal',
      'superseded-historical-selector',
      'unique-changes-require-intake',
    ].includes(ref.classification)
  ) {
    const proof = historical.refs.find((item) => item.tip === ref.tip);
    assert(proof && proof.classification === ref.classification);
    assert.equal(proof.dirtyChangesCovered, false);
    assert(proof.refs.some((item) => item.name === ref.name && item.location === ref.location));
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
console.log(
  JSON.stringify(
    {
      valid: true,
      main: inventory.main,
      refs: inventory.refs.length,
      worktrees: inventory.worktrees.length,
      classifications: counts,
      complete: counts.unclassified === 0 && inventory.counts.dirtyWorktrees === 0,
    },
    null,
    2,
  ),
);
