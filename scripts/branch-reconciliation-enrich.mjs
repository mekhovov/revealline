import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const read = async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const ledger = await read('reconciled.json');
const historical = await read('historical-ref-proof.json');
assert.equal(historical.main, ledger.main);
for (const item of historical.refs) {
  for (const binding of item.refs) {
    const ref = ledger.refs.find(
      (entry) => entry.location === binding.location && entry.name === binding.name,
    );
    assert(ref && ref.tip === item.tip, `Stale historical proof: ${binding.name}`);
    if (ref.classification !== 'unclassified') continue;
    ref.classification = item.classification;
    ref.proof = {
      kind: item.proof.kind,
      file: 'historical-ref-proof.json',
      tip: item.tip,
      main: ledger.main,
    };
    ref.disposition = item.disposition;
    ref.dirtyChangesCovered = false;
    if (item.classification === 'unique-changes-require-intake') {
      ref.requiredAction =
        'Owner-coordinated provenance-preserving current-main intake; original branch remains unchanged.';
    } else delete ref.requiredAction;
  }
}
const owners = [
  {
    task: '01a0a0be-e184-7c03-ba2b-59dc179a9800',
    title: '🔥UX',
    branches: ['codex/ux-default-journey'],
    note: 'Owner confirmed frozen PR263 only; no handoff of older draft stack.',
  },
  {
    task: '01a0b9ef-0646-7b22-8fb4-006e734dce4a',
    title: '🔥 Levels',
    branches: [
      'codex/unified-mission-library',
      'codex/p15-journey-warning-visibility',
      'codex/p15-couch-journey-warning',
      'codex/p15-journey-backup-focus',
      'codex/p00-current-adaptation-audit',
      'codex/p11-inner-receiver-study',
    ],
    note: 'Owner confirmed held PR253/255/257/260/261 and active B. B draft intake follows first verified checkpoint; promotion waits for A.',
  },
  {
    task: '01a0bffc-f5ed-7822-932c-55295e0a8d37',
    title: '🔥 Releases',
    branches: ['codex/full-branch-reconciliation-20260922'],
    note: 'This isolated reconciliation ledger; not release publisher.',
  },
];
for (const ref of ledger.refs) {
  const owner = owners.find((entry) => entry.branches.includes(ref.name));
  if (owner) ref.ownerTask = { task: owner.task, title: owner.title, note: owner.note };
  if (ref.name === 'codex/unified-mission-library') {
    ref.classification = 'active-awaiting-owner-draft';
    ref.requiredAction =
      'Owner will create draft after first verified checkpoint. Do not mutate active worktree or count as completed intake.';
  }
}
ledger.dirtyWorktreeAccounting = ledger.worktrees
  .filter((worktree) => worktree.dirty || worktree.statusError)
  .map((worktree) => ({
    path: worktree.path,
    head: worktree.head,
    branch: worktree.branch || null,
    ownerTask:
      ledger.refs.find(
        (ref) => ref.location === 'local' && `refs/heads/${ref.name}` === worktree.branch,
      )?.ownerTask || null,
    classification: 'preserved-pending-owner-review',
    statusEntryCount: worktree.statusEntries?.length || 0,
    contentsInspected: false,
    requiredAction:
      'Coordinate owner, compare exact staged/unstaged/untracked changes and account for them in a draft or approved retention. Do not sweep into commits.',
  }));
ledger.counts.classifications = {};
for (const ref of ledger.refs)
  ledger.counts.classifications[ref.classification] =
    (ledger.counts.classifications[ref.classification] || 0) + 1;
ledger.enrichedAt = new Date().toISOString();
ledger.completion = {
  complete: false,
  reason:
    'Unclassified refs, required intakes, active owner work and dirty worktrees remain. Release acceptance is tracked separately.',
};
await writeFile(path.join(directory, 'reconciled.json'), `${JSON.stringify(ledger, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      classifications: ledger.counts.classifications,
      dirtyWorktreesAwaitingReview: ledger.dirtyWorktreeAccounting.length,
      complete: false,
    },
    null,
    2,
  ),
);
