# Local worktree intake — 30 September 2026

The compressed `inventory.json.gz` is a read-only path/status snapshot of all 268
registered worktrees. It completed at **05:02:59 UTC** against observed main
`451b82dc13dc8a8545ff964ffb724d3d756ac62a`.

- Compressed bytes: **37,821**.
- SHA-256: `caac779350093cc3c6098dd426520cc5b21cdd1d5d48ffd0927e5862f628d376`.
- Existing: **266**; missing registered directories: **2**.
- Clean: **153**; dirty: **113**; status-command failures: **0**.
- Conflict/operation roots: **1** (the historical continuation cherry-pick).

The intake records branch/head, tracked and untracked path status, and operation
markers. It copies no file bodies or private media. Git status uses optional locks
disabled, lazy fetch disabled and at most two concurrent Git commands. Owners can
advance while the scan runs, so it is an observation, not a filesystem lock or
permission to mutate another owner's checkout.

## Preservation boundaries

Root and the actor branch were successfully rebased to observed main. Their old
heads were already contained in main, so no old feature commit required a replay.
This branch's new source recovery and plan work are accounted separately.

A modified file may already have a newer implementation on main. A remote branch
may preserve an old version without integrating its intended behavior. Matching
path lists do not prove matching bytes. This inventory therefore does not certify
all dirty work as pushed, local caches as expendable, or old PRs as complete.

The broad recovery reference was withdrawn after a private-soundtrack concern.
It must not be used as blanket proof that every local path is backed up. PR802's
reviewed Studio/Team preservation packet is narrower than the full inventory.
This intake uploads no historical aggregate or private media.

Active owners are reconciling Levels, Pause, Demo, offline preparation, audio,
Playlist, company packaging and Creator Guide work. Preserve their refs/indexes
and update the existing PR when one owns the feature. Historical residuals need
byte and behavior comparison before an existing successor, bounded recovery patch
or explicit deferral can close them.

See the [current register](../../plan-status-2026-09-30.md) for priorities and the
temporary test waiver. The inventory itself runs no tests, build, art-admission
or public-play check.

## Reviewed source-only proposals

- The pending UX manifest authenticates two exact patches for Still Media close/focus assertions and Enemy Catalog action wrapping. All four original dirty postimages reconstruct from their recorded historical bases. Adaptation to current hosts is required.
- The pending Team retention packet preserves five historical source/test/script variants and five verification text files (91,444 original bytes). Its archive and patch reconstruct exact postimages. No old production assets or release identity are adopted; current-runtime necessity remains unproved.
- [Issue824](https://github.com/mekhovov/revealline/issues/824) schedules these decisions in the existing v0.150.0 milestone. Preservation is distinct from integration and publication.

The actual runtime change in this batch is limited to Team Resume. Existing localized knockdown advice is reused for a currently downed player; ordinary Resume, input, simulation and Retry retain current behavior. Syntax, scoped formatting/whitespace and independent source review pass. Four regressions are added but not executed under the temporary waiver. No browser/device or full-suite qualification is claimed.
