# Independent review and retained corrections

PR266 first checkpoint `2b70f61a3` received **NEEDS_WORK**. This is retained
evidence, not a claim that the initial ledger was complete or merge-ready.

1. The branch census did not evaluate clean detached worktree HEADs. Two unique
   commits bypassed branch and dirty accounting. Corrected by evaluating every
   captured worktree HEAD and storing `worktree-commits.json`; historical patch
   matches for both commits remain pending present-day retention review.
2. Historical patch equality incorrectly promoted27 tips despite possible later
   reversals/replacements. Corrected by requiring exact current changed-path
   blobs/modes for automatic promotion. Other matches are review candidates,
   not proof of current retention. The later count97 unclassified supersedes
   the optimistic81 count in the initial draft body.
3. Completion arithmetic neither handled an absent zero-count category nor all
   intake/error/dirty states. Corrected with a conservative whitelist, explicit
   worktree accounting, owner retention and manual hold. Completion remainsfalse.
4. Census output could overwrite an existing dated snapshot. It now requires an
   explicit new directory and refuses existing paths before API/Git operations.

The independent rereview found all four fixes addressed and no blocker to
pushing this **incomplete draft checkpoint**. Syntax checks, the evidence
validator and initial six regression tests passed. A seventh regression test
explicitly rejects historical-only current-coverage promotion. Follow-up
hardening requires dirty-retention approvals to carry matching content SHA-256
and actual owner evidence, addressing the rereview's stale-approval warning.

This review does not approve gameplay, author art, merge owner branches, or
certify production. It concerns the audit machinery and its conservative
accounting. All unique intake/owner/CI/release gates remain intact.

## Moving queue after the fixed snapshot

- PR265 is the release owner's independently reviewed music-documentation
  successor; its owner is handling its CI and merge. Do not duplicate that work.
- Levels confirmed active B now has draft PR268 at
  `068708ad2594eb0d8942deb259f6593371fc25cd`, stacked on PR263. Keep A's branch
  until B is retargeted. B is model/UI foundation, not host-enabled or release-ready.
- PR266 itself creates a new remote ref after this initial snapshot. A future
  census must include these changes in a new snapshot, without overwriting the
  captured794-ref/240-worktree inventory.
