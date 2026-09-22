# Merge, release, and branch reconciliation

## Safety and completion

This ledger implements the user's approved full audit, not bulk merging. Use
merge commits and current-main isolated worktrees. Never force-push, reset,
delete refs/worktrees, modify the dirty shared `codex/fpv-redesign` checkout, or
overwrite an immutable release. Playlist is the sole publisher until handoff.

Completion requires every branch classified and every unique committed or
uncommitted change accounted for. An ancestor branch with a dirty worktree is
**not** a completed worktree reconciliation. Historical release controllers must
not be replayed into current production merely to eliminate a ref.

## Release order

1. Accept v0.82.1 at source `64ec9fd2e5688f4248fe005ac6a47c0c1394ea9e`.
   Selector PR264 merged at `1b16a858fdd4ab303629277b3cd1138fa2475f04`;
   deployment35745218885 succeeded. Preserve initial missing-log failure
   35743815737 and corrected preview35744655331. Complete the public byte graph
   and real browser/recovery/prepared-cold-offline checks before acceptance.
2. PR263 is frozen at `70836db6ac7559791ef61ecfbf31c0785604ffc0` for v0.83.0.
   Predecessor-head checks are not evidence for this head. Source35745717120
   and preview35745716824 must pass before its merge. Qualify the actual merge
   commit, inspect frozen originals, publish immutable assets, then use a
   separate selector PR preserving v0.82.1 and every archive route.
3. Close PR253/255 only after the accepted successor release and pinned-head
   supersession proof revalidation. PR239 is contained in draft245, not yet
   delivered by that proof.
4. Land infrastructure235 after the current release lane settles. Then
   252 → 256 and the compatible presentation chain
   234 → 236 → 238 → 240 → 243 → 244 → 245 → 247. Deliver241 separately after
   the compatible Team stack. Standalone257/230/231/237/258/262 retain their
   own scope and exact-head gates. Studies260/261 are not gameplay approval.
5. Merge current main into owner branches only after coordination. If an
   intermediate stack cannot pass independently, preserve all exact changes
   in a new integration PR with machine-verifiable coverage. Do not merge
   deliberately incomplete intermediates or force-push reconstructed history.

Every runtime release requires synchronized unused package/lock/build versions,
current exact-head preflight/four shards/build/review, actual-merge qualification,
immutable digest-bound assets, separate reviewed selector, controller Node/Python
tests plus verify/build/verify-artifact, complete public path/size/SHA-256 graph,
and scoped desktop/portrait/landscape/browser/offline acceptance. CI/docs-only
work does not allocate a game release unless shipped Pages bytes change.

## Snapshot and evidence

The [dated inventory](2026-09-22/README.md) pins live GitHub main, every captured
local/GitHub ref, exact-head PR links, and worktree status. `inventory.json` is
the raw census; `reconciled.json` adds conservative proven classifications.
`patch-index.json` records stable patch groups and main successors;
`coverage.json` compares final changed-path blobs and modes against main.
`supersession-proof.json` separately records PR253/255 → 263 and PR239 → 245.

The historical review in `historical-ref-proof.json` identifies 38 local/GitHub
ref rows as intentionally historical release-evidence controllers, two as a
documented rejected proposal, and one as the superseded v0.80.3 selector.
The old v0.51.1 audio branch has four post-PR commits requiring successor/behavior
review; it is **not** classified as completely delivered. Its tag endpoint
returned404, which is retained as an observation rather than a publication claim.

At this checkpoint, the 794 captured ref rows comprise587 merged,34
patch-equivalent,48 exact-head open-PR,41 historical/superseded,2 needing unique
change intake,1 active awaiting its owner's draft, and81 still unclassified.
All94 dirty worktrees remain preserved and explicitly unaccounted until owner
review. Counts are ref rows, not independent feature counts; matching local and
GitHub refs are deliberately separate.

Reproduction, from this isolated checkout:

```sh
node scripts/branch-reconciliation.mjs NEW_SNAPSHOT_DIRECTORY
node scripts/branch-patch-index.mjs NEW_SNAPSHOT_DIRECTORY
node scripts/branch-coverage.mjs NEW_SNAPSHOT_DIRECTORY
```

Manual proof files are bound to the snapshot's exact tips and main. Do not copy
them to a new snapshot without revalidation. For this reviewed snapshot, run
`node scripts/branch-reconciliation-enrich.mjs` and
`node scripts/branch-reconciliation-validate.mjs`. The validator checks census
totals, exact-tip bindings, classification evidence and retained dirty states;
it reports `complete: false` rather than disguising the remaining work.

Stable patch history is not runtime acceptance. Unmatched patches may be a
rebased/squashed successor, a historical artifact, or unique work. They require
inspection, not a presumption of safe deletion or replay. Dirty paths are
metadata only: no file contents are published by this inventory.

Regenerate to a new dated snapshot directory when refs move. The tools are
read-only toward Git/GitHub/worktrees and write only their selected output
directory. Never overwrite reviewed historical snapshots during a refresh.

## Owner coordination, 2026-09-22

- Playlist task `01a0c0d5-9336-7041-b706-4daf00829a3a`: sole publisher,
  v0.82.1 public acceptance and v0.83.0 release lane. Independent music UI
  acceptance delegated to this coordinator; do not duplicate uploads.
- UX task `01a0a0be-e184-7c03-ba2b-59dc179a9800`: frozen PR263 only in
  `codex/ux-default-journey`. It explicitly did not hand off or claim current
  mutation ownership of the older252/256/presentation drafts. Ownership for
  those remains unresolved; draft status is intentional until handoff.
- Levels task `01a0b9ef-0646-7b22-8fb4-006e734dce4a`: active
  `codex/unified-mission-library` based on70836. Owner will open a draft intake
  after its first verified checkpoint; publication waits for release A.
  Also owns held PR253/255/257/260/261. Do not alter its worktree.
- RevealLine task `01a09328-21d8-7e93-9403-7e6793a4fac2`: asked to identify
  historical draft/unique-ref ownership and safe handoff; reply pending.
- Releases task `01a0bffc-f5ed-7822-932c-55295e0a8d37`: owns this ledger and
  isolated `codex/full-branch-reconciliation-20260922` worktree.

Paused/private soundtrack work is not authorized for publication by this audit:
the 36-original plan remains paused and private UA-FPV material has no public
redistribution clearance. Preserve local provenance without sweeping assets
into an intake PR.

The existing 30-minute heartbeat was updated in place with the full audit and
release contract. It remains quiet for unchanged drafts/running CI, and reports
only actionable merges, deployment completion, failures, blockers, or needed
user input. This document is not a claim of complete delivery.
