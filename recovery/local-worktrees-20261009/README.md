# Local worktree recovery — 2026-10-09

This directory preserves non-disposable source changes found in attached local worktrees. Each subdirectory contains the exact staged/unstaged delta against its recorded `HEAD`, an archive of untracked source files, and, when applicable, commits not reachable from `origin/main`.

These are recovery artifacts, not a product change set. Do not merge this branch into `main`. Port each worktree deliberately after its code and provenance have been reviewed against current `main`. Conflict-stage blobs retain all sides of unresolved conflicts.

## Retained ownership excerpts

Some catalogs embedded in these recovery records have been projected to remove retired presentation content. Those files are derived excerpts, not byte-identical originals or directly verified restore instructions. The original manifest continues to describe the originals preserved outside this repository. See `docs/migrations/retained-packed-catalogs.json` for current paths and byte identities. Unrelated source changes are retained; review and port them against the current source instead of applying these patches blindly.
