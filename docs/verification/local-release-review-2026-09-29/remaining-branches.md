# Remaining local branch reconciliation

Pinned main: `afb19ebd06db336d32dfe4660c43aa0f6711dca5`. Recorded: 2026-09-29 01:12:30 UTC.

This extends the dated worktree inventory. It is an ownership and source-content
review, not permission to merge old snapshots or proof of public acceptance.
No runtime source, media or historical checkout was changed by this audit.

## Current release inputs

- PR #783 preserves the complete remote aggregate. It is not a canonical release
  candidate and must not be merged wholesale.
- PR #782 is the latest-main native-menu/branding input; #784 is the independent
  community-directory input. Both are assigned to v0.150.0.
- PR #781 is now the bounded Demo Back keyboard correction stacked on #783.
  Its former preservation role is superseded by #783.
- PR #776 remains the v0.142.4 selector input; #779 is the v0.143.0 Audio style
  persistence input. Existing owner PRs retain their scopes.
- PR #780 records reconciliation. Milestones allocate work, not qualification.
  Source corrections, release admission and publication remain publisher-owned.

Recheck these live PR identities before integration; the JSON below is a dated
local observation, not an atomic snapshot.

## Branch inventory and interpretation

The scan observed 1,164 local branches. Of these, 303 had heads not reachable from
cached remote refs, spanning 2,503 local commit IDs. Content comparison found:

- 88 heads whose changed nondeleted blobs were all already in cached remote history;
- 43 heads with only unmatched documentation/guidance under the scan's path filter;
- 172 heads requiring semantic grouping, mostly historical host combinations,
  rewritten commits, generated data and preserved candidates.

These are not 303 missing features or 172 new release PRs. No deletions were
approved by the comparison. `remaining-branches.json` binds every scanned head
and includes explicitly limited path samples.

## Source that still requires an intake or owner decision

### Artwork and Moving Edges

The following exact local commits returned HTTP 404 from GitHub's Git-commit API
during this review; their candidate blobs were also absent from cached remote
history. The existing 2026-09-22 art-ref proof already identifies their scope.

- `art/retro-role-presentations`:
  `fbd314d7190c81e2ff67981e9006c49993d35d43`.
  Seven static body originals, prompts and provenance; no runtime adoption.
- `art/spend-role-presentations`:
  `ac6837d28317f42ffc832516d1ab1a9a6cd5754c`.
  Seven static body candidates; no animation or collision qualification.
- `art/ukraine-enemy-presentations`:
  `53d553485b8d7dc0f912959892947819a19d9803`.
  Seven original enemy-body candidates; preserve provenance and visual-review limits.
- `feat/moving-edges-art`:
  `15882073cd8329b0c117c4716694b588ac4c4d05`.
  Contains `feat/moving-edges` geometry at
  `1dc861d6bf4cc4d49c5dcc2e419075d9afd7c19e`; account once.
  A source intake must keep geometry, original art and compiler context together
  without replaying inherited Countercurrent files already accepted.
- `feat/fpv-enemy-atlas-study`:
  `2ce8d1a67baa8fe5ed23ad93f7ed617c1416cde5`.
  Historical rejected study. Preserve as reference, never auto-adopt as gameplay.

Route actor-art intake to the presentation owner and Moving Edges to the content
owner. No new runtime edition or product version is allocated here. A 404 confirms
the requested commit was not available through that endpoint; it is not proof
that no differently committed equivalent exists anywhere.

### Uncommitted Studio/HUD/Team candidates

Retain the exact donor worktrees and reconcile only surviving source:

- `p04-reference-prototype-r1`, HEAD `17e0a455f`: Studio reference
  bundle/model/session/store, format and storage integration. Creator owner must
  review current schemas and preservation semantics.
- `p05-narrow-hud-on-actor622-r5`, HEAD `17e0a455f`: HUD numeric labels and
  narrow-layout source. Reconcile native-menu/HUD ownership; exclude old FPV32 data.
- `p05-team-large-v621`, HEAD `ef1430174`: large-text cue semantics/symbols
  and Objectives source. Current Team readability and host integration are open.
- `p03-responsive-navigation-next`, HEAD `2f1074a37`: Team compact-copy
  source only; picker/focus portions are already incorporated.
- `p03-enemy-reading-next`, HEAD `2f1074a37`: Enemy Workshop action wrapping
  and shared display preferences. Check #782 coverage before creating a duplicate.
- `p03-close-focus-tests`: optional additional assertions, not evidence of a
  missing product fix.

These modules were absent from inspected main/root and existing local ref
history. Compare remote-only owner branches before declaring global absence.

### Committed Team and UX donors

- `codex/team-teaching-v1415-candidate`,
  `57bfaa567c62def3eae222c8feb69ddc4fc8039c`: pending/acknowledged cues,
  rescue-before-support-before-cut priority, and support completion only after
  actual slowing/interception. Main has earlier behavior. The donor changes
  persisted fields without a format revision: a current-owner port needs an
  explicit compatibility decision, not a whole-branch merge.
- `codex/p07-campaign-tour`,
  `74e2c9baec91462e68cee130c952550d82d611d0`: authored Classic race-tour,
  series/rematch credit and `couch-progression.mjs`. Distinct feature candidate;
  reconcile current Versus progression and preserve its evidence ZIP.
- `codex/ux4-terminal-failure-v1`,
  `ab96375aeae648763380e9210402dbe53b06c6d4`, and Team terminal donor
  `53ed4f036856424686dba4ed66971f7a8a15c4ff`: retry-ready and fresh-activation
  proposals require a design decision against current automatic recovery and
  Confirm ownership. Do not stack another old input guard.
- `codex/ux3-gameplay-hud-v1`,
  `7cdfb458b977af907f6fc2410533b845c7d03493`: consolidate only useful HUD hunks
  with the uncommitted narrow-HUD candidate, not multiple rebase copies.
- Appearance chain ending at `e57cb2dcb3fbc94ad5a7867ad40bf3999ea9377a`:
  its resolver/supporting modules are already in cached remote history; three old
  host snapshots differ. Absence of `appearance-policy.mjs` on current main is
  not proof of missing user functionality or an unpushed resolver. Current
  menu/actor owners must decide whether any host integration is still wanted.
- `team-after-music`: 121/149 dirty blobs match pushed
  `origin/codex/team-presentation-next` at `8cffb36b`.
  Only narrow FPV38/FPV50 retention equivalence remains for current-architecture
  review. Never restore provisional FPV51 bindings.

### Documentation, prototype and release tooling

- `codex/community-guide-contracts`,
  `661be3bf58c2c5504d94657775aa0e4b1f07b657`: potentially useful contract and
  retained-original documentation. Port paragraphs only while retaining current
  5 MiB/RLTHM2 rules.
- `feat/chapter-download-management`,
  `06c7f15db4afe4334d6ae5685be009612c128438`: unintegrated
  `still-residency.mjs` metadata prototype; GitHub commit lookup returned 404.
  No current manager writes the format. Preserve as prototype, not a ready fix.
- `codex/ci-balanced-shards-20260922`,
  `95fa082d3907ee012decae60bb023abb2fc8abd2`: timing reporter/shard tooling
  plus three untracked converter/proposal files. GitHub commit lookup returned 404. Requires separate release-tooling intake; no workflow activation or
  speedup claim.
- `codex/fastline-draft-discovery`,
  `8e2d03970ae3a61db57c3f5c6204a6af3acfb3e3`: bounded draft-release discovery
  helper/tests, absent from pinned main. Publisher review required.
- `codex/fastline-evidence-job-collision`,
  `3c3811a4e54b3f2892c90dd25f700ccc3cebe166`: extra duplicate-inspection-job
  regression, absent from pinned main. Test-only candidate.
- `codex/source-manifest-contract` contains older source-manifest proposal
  forms; current main already supports the v2 manifest and fresh-consumer test.
  Do not restore old workflows/publisher files because their blob hashes differ.

## Accounted and excluded groups

No duplicate runtime PR is recommended for the inspected cultural mission
branches v012–v38, Team specialist pairs v1–v5 and v117–v119, Team cultural
v27–v29 or current-rules v26. Across 526 content-path observations, every resulting
blob was in accepted main history except the older spatial-candidate module,
which was already in cached remote history.

Creator batching, generated Versus/Team qualification, rewards/gallery shells,
P03 focus/departure/restart flows, Still Media reading/reload, Versus footprint,
picture/media pins, chapter retry and replay preference restoration have accepted
equivalents. Older audio-picker module names do not indicate a gap: delivered
Audio settings/style controls are recorded through #773. Current soundtrack
sources explicitly retain prior album lineage; do not reimport old media merely
because its historical path is absent.

Cross-mode integration has 654 changed file blobs already in accepted history;
only three historical guidance/doc blobs remain unmatched. The four old Field
Kit generated ledger blobs are in accepted history. Team-picture v0.132.2 receipts
and catalog entry, private-audio producer fixes and later Couch navigation are
already represented. Old Pages v0.84–v0.87/test-exception dirt is dependency links.

The old localization checkout is damaged/partially materialized: 69 zero-byte
files including 52 PNGs, four deleted dotfiles and an 8 MiB partial pack.
Its owner confirmed exclusion. The earned-picture-resume index has 1,837 missing
tracked paths; that is not authorized deletion intent. Preserve both.

## Remaining completion boundary

This audit has mapped the concrete candidate families above. It does **not**
claim zero unclassified historical semantics across every inherited commit,
complete media/rights review, current physical-device acceptance, or permission
to delete any donor. Historical docs/evidence remain preserved even when a
runtime approach was superseded. Owners must record accepted, superseded,
deferred or rejected outcomes before closing the reconciliation milestone.
