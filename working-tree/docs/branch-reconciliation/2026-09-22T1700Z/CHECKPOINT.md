# Reconciliation checkpoint — 2026-09-22 17:00 UTC census

## Main and release coordination

The immutable census pins live GitHub main
`a870050ae2d7ac45d026243060cbd9a32e95ee49`. PR265 merged at
16:59:14 UTC while the coordinator was awaiting the publisher's hold response.
This coordinator did not merge it. Independent diff inspection against
`7a8bf9aa3ec0a8264e8a6d0f15c7e4e8dcd7e6f0` found only four documentation paths:
`docs/hosted-soundtracks.md`, `docs/music-library-upload-guide.md`,
`docs/soundtrack-studio.md`, and `docs/ua-fpv-upload-guide.md`.

Playlist confirmed the new main pin and updated its v0.83.0 publisher
qualification allowlist to those four documentation paths. The prior main pin
must not be treated as current. No runtime, version, asset or Pages selector
change occurred in this merge. Playlist remains sole publisher; PR263, PR269
and PR270 must not be independently merged or modified by this coordinator.

PR263 remains at `83f5895943510ce98e7f5c0ff3201dc20127f325`.
Source run35753052831 was still running three test shards at this checkpoint;
preflight, build, shard3 and preview35753052906 had succeeded. Running checks
are not release qualification. Actual merged-source qualification and complete
public v0.83.0 acceptance remain pending. Public v0.82.1 remains selected.

## Census and retained changes

The new raw inventory contains 512 local branches, 289 GitHub branches,
499 unique tips and 242 worktrees, 94 dirty. Its 801 ref rows have 589 ancestry
matches, 54 exact-head open-PR representations and 158 raw unclassified rows.
These raw counts do not replace the separately reviewed older snapshot's
classifications; manual proofs must be rebound and revalidated before promotion.

`retention-round2.json` accounts for the committed changes of
`codex/actor-upload-geometry-oracle`, `codex/p03d-story-focus` and
`codex/p04-stale-crop-guard`. A second independent check recomputed four source
and successor stable-patch pairs, verified successor ancestry and exact commit
censuses, checked 15 changed-path source/pinned/live blob identities, and checked
all 17 blob-and-line anchors. All checks passed. Reviewed paths have identical
blobs at the previous `7a8bf9aa` pin and the new `a870050a` pin.

The story focus fallback's later disposed/background guards are deliberately
retained; original behavior is not blindly replayed over those corrections.
Historical browser evidence remains evidence of its original source, not of the
current release. No tests, workflow runs or deployments were triggered by this
retention audit. Dirty and ignored contents remain outside these proofs.

Separately, the coordinator reran all seven ledger-rule regression tests and
the older snapshot validator successfully. That validator remains explicitly
bound to the older snapshot and reports incomplete reconciliation; it is not
validation of a fully classified new census.

## Preservation and pending work

Only local audit evidence in the isolated reconciliation worktree was written.
No commit, push, reset, force push, owner-branch edit, deletion, or release action
was performed during this checkpoint. Earlier snapshots and correction/failure
evidence are unchanged. New evidence remains local until the publisher hold
permits the next reviewed audit update.

Full reconciliation is **incomplete**: unclassified refs, unique intakes,
owner handoffs, dirty-worktree provenance and release acceptance remain open.
No branch or worktree deletion is authorized by these proofs.
