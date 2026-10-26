# Repository history transition

The repository retained its branches and tags while moving historical content to its owning application. Commit identities changed. Existing release evidence describes the original commits and must not be treated as verification of a rewritten tag.

## Existing clones and worktrees

Keep dirty worktrees and uncommitted files intact. Do not reset them to the rewritten remote. Save committed work, binary patches, and untracked files before starting a migration; the repository owner retains the original backup and old-to-new commit map.

For new work, use a fresh clone. To continue pending work, find the mapped base commit, apply only the intended changes in a new branch, and review the resulting diff against current main. Run the normal verification checks before publishing. Avoid merging the old repository history into the rewritten graph.

Existing pull request branches retain their names. Refresh their remote state before continuing, and check that local work uses the mapped history. A rejected push is a reason to inspect the migration state, not to force the old history over the remote.

## Release evidence

Historical files retain their original checksums only in the preservation records. Newly generated packages must have new manifests and qualification evidence. Use the current published release for testing and distribution.
