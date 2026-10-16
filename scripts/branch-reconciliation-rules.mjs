const resolvedKinds = new Set([
  'already-merged',
  'patch-equivalent-to-main',
  'historical-release-evidence',
  'historical-rejected-proposal',
  'superseded-historical-selector',
]);

export function hasExactCurrentCoverage(proof) {
  return !!(
    proof?.allChangedPathsExact &&
    proof.changes?.length &&
    proof.changes.every((item) => item.exact)
  );
}

export function refIsAccounted(ref) {
  if (resolvedKinds.has(ref.classification)) return !!ref.proof;
  return (
    ['represented-by-open-pr', 'superseded-duplicate'].includes(ref.classification) &&
    ref.retentionApproved === true &&
    !!ref.proof
  );
}

export function completionReport(ledger) {
  const pendingRefs = ledger.refs.filter((ref) => !refIsAccounted(ref));
  const accounting = ledger.worktreeCommitAccounting || [];
  const pendingCommittedWorktrees = ledger.worktrees.filter((worktree) => {
    const entry = accounting.find(
      (item) => item.path === worktree.path && item.tip === worktree.head,
    );
    if (!entry) return true;
    if (entry.proof.kind === 'already-merged') return false;
    if (entry.proof.kind !== 'recorded-branch-tip') return true;
    return !ledger.refs.some((ref) => ref.tip === worktree.head && refIsAccounted(ref));
  });
  const pendingDirtyWorktrees = ledger.worktrees.filter((worktree) => {
    if (worktree.statusError || worktree.dirty === null) return true;
    if (!worktree.dirty) return false;
    return !ledger.dirtyWorktreeAccounting?.some(
      (item) =>
        item.path === worktree.path &&
        item.head === worktree.head &&
        /^[a-f0-9]{64}$/.test(worktree.dirtySnapshotDigest || '') &&
        item.dirtySnapshotDigest === worktree.dirtySnapshotDigest &&
        !!item.ownerEvidence &&
        item.classification === 'owner-approved-retention',
    );
  });
  const explicitlyHeld = ledger.completion?.complete === false;
  return {
    pendingRefs: pendingRefs.length,
    pendingCommittedWorktrees: pendingCommittedWorktrees.length,
    pendingDirtyWorktrees: pendingDirtyWorktrees.length,
    explicitlyHeld,
    complete:
      !explicitlyHeld &&
      pendingRefs.length === 0 &&
      pendingCommittedWorktrees.length === 0 &&
      pendingDirtyWorktrees.length === 0,
  };
}
