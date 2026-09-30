# Levels, gameplay and presentation — 29 September 2026

Historical snapshot retained with the source donor. For current integration,
verification and release status, use [the 30 September checkpoint](plan-status-2026-09-30-levels.md).
Later 29 September reconciliation is preserved at
[PR780 head 5d942540](https://github.com/mekhovov/revealline/blob/5d942540e5720d739568d8580ae35d5551253481/docs/plan-status-2026-09-29-levels.md).
Do not treat the dated queue or pending holds below as current release state.

This is the Levels lane's current implementation and acceptance checkpoint.
Preserve earlier dated plans as history. The original **Journey P00–P15** and
the broader **whole-game P00–P18** are different programmes, not interchangeable
phase numbers.

## Local-to-GitHub reconciliation — 29 September, 15:10 UTC

The user now requests all local changes reviewed, pushed or explicitly
reconciled, and assigned to an existing/new release PR. This section supersedes
the older queue snapshots below; their source and test receipts remain history.
**Pushed, integrated, release-targeted and publicly delivered are separate states.**

### Completed source handoff

- Cooling loop's [PR #793](https://github.com/mekhovov/revealline/pull/793) is
  **closed by consolidation, not merged/published separately**. Its exact
  `de5aeaac2f601ed3703b40071c9c4e09a7ec7724` tip is an ancestor of the native
  aggregate [PR #795](https://github.com/mekhovov/revealline/pull/795), observed
  at `81df80dda259ba8e1cef5378af1cec91260eb51e`.
- The complete five-path alternate-route follow-on `b3b3b06dee2d69489635cc243c9a41bbe9ec4e17`
  is already byte-identical in #795 and the combined
  [PR #796](https://github.com/mekhovov/revealline/pull/796). Adoption uses
  `c2dcc28dac06ed08f54f9c6cb1f7b70e216fb0f3` plus file-ending normalization
  `5a5d4458b19d49a33904f8e4295c1aa67bfcf285`; direct donor ancestry is not
  required for this proved five-file match. Do not reapply or open a duplicate PR.
- #795 and #796 target the existing **v0.150.0 — Unified native experience**
  milestone. #796 preserves #795's selected base while adding the spatial-audio
  source from [PR #794](https://github.com/mekhovov/revealline/pull/794), whose
  exact `337ded7926168c465229253242c4c93c8be3955b` head is retained as an
  ancestor. #794 now has the same release-input milestone and retains its hold.
- The primary checkout was observed clean in the 15:06 UTC scan at pushed #783 head
  `0cc7337a8e490d73ad9d7718fb5b208aaf7da924`. This is preservation/reference
  source, not permission to merge every overlapping historical snapshot.
- The Levels source branch was observed clean and exactly matching its advertised remote
  `b3b3b06de` head. Its sole untracked plan mirror was already stored byte-for-byte
  in [PR #780](https://github.com/mekhovov/revealline/pull/780); this checkpoint
  continues through that same evidence PR, not a gameplay or version change.

### Remaining source reconciliation

- **Actor continuation #761:** batch23 is now pushed at
  `ff42765772555fe91b6b8c24d002ee7283b2e448`, following batch22. The post-push
  checkout has no modified source; only the previously retained untracked
  `proportions-solo.png` remains for evidence classification. The latest owner
  continuations are not blanket-adopted by #796. Keep the existing PR and
  v0.150.0 target for integration; this push does not certify a release.
- **Native menu/Company continuation #782:** `82f9e6ff20941e0b2837438e73eecdd79fad61d6`
  remains pushed and targeted, with current qualification/harness additions not
  present in the sampled aggregate. Reconcile these in the existing owner lane.
- **Radio/controller family:** fresh advertised refs at 15:08:39 UTC confirm
  `radio-integration` at `6d19567cc0440ce6e052a89ffecdf0c7f6fcddb9`,
  `discovery-rewards` at `cd1ceff06` and `two-controller-support` at `600fe30d`
  are now pushed. Earlier local-only findings are superseded. The integrated
  family is now in draft [PR #797](https://github.com/mekhovov/revealline/pull/797)
  at the exact `6d19567c` head, targeted to the existing v0.150.0 milestone.
  Source integration and qualification remain separate from this completed
  push/PR assignment; do not create three duplicate PRs.
- **Steam Deck Confirm continuation:** source is now pushed in held draft
  [PR #800](https://github.com/mekhovov/revealline/pull/800), exact head
  `bf3b6b1b76870ad9a6ba1d6629365f3c011912f8`, also a v0.150.0 aggregate input.
  This historical-base router refinement must be ported or deduplicated against
  the current controller aggregate. Its owner records 208 passing focused
  checks separately from a reproduced parent-fixture mismatch and unavailable
  local lint dependencies; neither is relabeled as a complete passing release gate.
- **Historical residue:** the 15:06:07–15:06:21 UTC scan covered 267 registered
  worktrees: 155 clean, 111 dirty, one missing/prunable and no status errors.
  Of the dirty checkouts, 58 contain only untracked dependencies and five only
  local helper/deploy reports. The remaining 48 include source, evidence,
  conflicts and staged deletion states; they are not 48 unreleased features.
  A subsequent bounded index check of the three conflicted/staged integration
  checkouts examined 759 distinct staged blobs: 728 are reachable in cached
  remote history, and the remaining 31 exactly match their working files. All
  six conflict base/ours/theirs blobs are reachable. No additional index-only
  payload was found; the 31 working-file blobs still need the coordinator's
  preservation-manifest cross-check. This is not a claim that those 31 are
  pushed, nor proof covering later concurrent edits. Do not claim everything
  pushed until these inventories and active-owner receipts are reconciled.
- The localization owner confirms **no valid unpublished localization batch**.
  The old `english-ukrainian-localization` checkout contains zero-byte/truncated
  files and missing controls, not intended feature edits; the six artifacts in
  `v0131-localization-finish` are stale and their intended source work is already
  on main. Preserve these checkouts; do not publish their corruption/deletions.
- **Ukrainian ornament study:** all 23 dirty/untracked files exactly match
  [PR #332](https://github.com/mekhovov/revealline/pull/332) head
  `48b42b610856e54e8df58c40943b5fd0e3c208fa`. The older local checkout was
  intentionally retained during documented disk-full remote recovery. No
  unpublished file or hunk remains in this study; do not create a duplicate
  source/preservation PR or mistake its retained local dirt for a new edition.
  PR #332's closing receipt identifies superseding integrations #524, #525,
  #527, #528, #529 and #531. Sampled accepted main still registers/lazy-loads
  `whole-ornament-v2` and retains its four atlas modules and documentation.
  Classification is **historical pushed preimage / superseded integration**,
  not a new public-play acceptance or permission to overwrite current hosts.

### Release blockers and honest delivery boundary

The sampled #796 head `c99fbbac348691bb91bd16a7e1e281f5a9e2b69b` records a
**failed production build**, not a successful release: its offline payload is
1,296 files / **94,521,304 bytes**, above the existing **64 MiB** cap. The owning
integration lane must resolve that budget without silently raising the limit,
then satisfy exact-source delivery-integrity gates. This audit does not rerun
production tests, approve artwork, change workflows or allocate a new version.

Only the deployed-community maintenance PRs #736/#745 lacked milestones in
the 14-open-PR snapshot. They depend on a selected host and explicit
administrator actions, and must not be folded into routine Pages publication.
Earlier #738/#747/#779 labels and milestone reservations need coordinator-led
scope reconciliation; historical targets do not justify duplicate releases.
The soundtrack owner now records #779's move into the cumulative v0.150.0
train. Its follow-up docs [PR #799](https://github.com/mekhovov/revealline/pull/799)
was also assigned that existing milestone; no source or release selector was
changed by the assignment. Earlier docs #798 is merged, not another game release.

Latest observed GitHub release metadata remains **v0.142.3**. This source audit
is not renewed public acceptance of that release or evidence that v0.150.0 has
shipped. Production/device/human testing remains deferred, not passed. One
publisher owns merge, immutable release, archive and Pages mutations.

## Earlier implementation checkpoint: production testing deferred

The user's subsequent instruction is: **defer production testing and proceed
with the remaining implementation**. Extended production/public play,
production-visual qualification, hardware, frame-time and human sessions are
now **deferred, not passed**, and must not block preparation of the next bounded
features. Historical sections below retain what was checked and what was open;
this direction supersedes their use of those tests as implementation blockers.

Keep proportionate local correctness regressions, source review, lint/format,
and required delivery-integrity checks (build/provenance, immutable hashes,
archive preservation and basic availability). Do not manufacture approval
records, reinterpret untested production assets as approved, weaken runtime
validators, or call a test build fully qualified. Any build-integrity dependency
remains a concrete technical issue, not an excuse to resume deferred testing.

Levels has implemented and pushed the copy-on-write Cooling loop erosion
successor in **[PR #793](https://github.com/mekhovov/revealline/pull/793)**,
head `de5aeaac2f601ed3703b40071c9c4e09a7ec7724`, on accepted main
`321408a3cfd75ae230d760f39fb692503652601a`. Actual edition `whole-spatial-v38`
makes the existing eroder engage earned routes through authored placement/heading,
while preserving straight-between-impact movement, protected foundations,
original editions and other authored actors. No blanket speed increase or global
physics change. This is a source input for the consolidated queue, **not a release**.

The final supplemented candidate/route cohort passes **36/36**, zero skipped. Selected
loader/archive/Studio checks pass **11**, with **96 explicit name-filter skips**.
Changed-file lint/format, content and presentation metadata validation pass;
independent source review found no remaining blocker. Two legal Standard/immediate/
seed-1 Cooling loop routes clear in 45.85 and 68.24 simulated seconds with zero
lost lives. Northern-first neutralizes both banks; bank-first deliberately leaves
40 eastern lethal cells, a valid ordinary clear but not optional mastery.
Unchanged v37 Pressure ladder and Switchback exchange now have complete 37.75-
and 50.89-second lossless routes with active signature threats. All four complete
routes have deterministic replay and actual equal Versus winning-board evidence.
The wider preset/control/seed matrix still proves first returns, not full clears.

The alternate strategies are now also source-complete in pushed follow-on
**`b3b3b06dee2d69489635cc243c9a41bbe9ec4e17`** on
`codex/pressure-route-alternates`, based on the unchanged PR #793 head. The final
five-file focused cohort passes **41/41**, zero skips, in 4.68 seconds, including
the prior 36 cases and five new route/negative controls. Six complete strategies
now exist across the three missions, still bounded to Standard/immediate/seed 1.
This test/documentation-only follow-on is offered for the publisher's existing
cumulative intake; it does not allocate another version or change PR #793.

Next source work is broader complete-route presets/controls/seeds and targeted
remaining campaign defects. Current-edition optional gap goals, cleanup and
useful repair decisions remain unqualified. Historical helper results must not
be presented as current v37 mastery awards: the authored prose changed, and the
legacy helpers do not implement those newer goals. Production testing is not a
prerequisite for source progress. Exact earlier evidence and limitations:
[Cooling loop v38](https://github.com/mekhovov/revealline/blob/de5aeaac2f601ed3703b40071c9c4e09a7ec7724/docs/cooling-loop-erosion-v38.md),
[complete triptych routes](https://github.com/mekhovov/revealline/blob/de5aeaac2f601ed3703b40071c9c4e09a7ec7724/docs/verification/pressure-corridor-complete-routes-2026-09-29.md).
The [alternate-route follow-on](https://github.com/mekhovov/revealline/blob/b3b3b06dee2d69489635cc243c9a41bbe9ec4e17/docs/verification/pressure-corridor-alternate-routes-2026-09-29.md)
records both new approaches and corrects the historical-helper qualification.

PR #793 is a consolidated source input, draft/held pending publisher allocation.
Its initial preflight passed, but `release-ready` explicitly failed for
`ADMISSION=hold` / no immutable release slot; focused/full/build jobs were skipped.
That is not a source-test failure or a passed hosted build. Do not bypass the gate
or allocate a competing release. Source development continues independently.

Related native-experience inputs also advanced without production testing:
**PR #757** adds the readable dense-Team Field details fallback, while **PR #761**
adds actual-mission encounter practice and exact-parent artwork comparison.
Both are pushed/open drafts, not merged or released. The exact source receipts,
remaining caveats and non-overlapping test counts are recorded below; no Levels
runtime files were modified to adopt or duplicate those owners' work.

The subsequent bounded source work fixes **Start for accepted imported Team
v6/v7 missions with Hunters**, and extends Team/Versus Help and retained-artwork
file access. Exact receipts and integration limits appear in the latest follow-up
below. These are source-complete slices, not another released version; production
testing remains deferred and is not the reason they are awaiting integration.

## Delivery boundary

- GitHub lists **v0.142.3** as published, from the main continuation based on
  `b5ab06e12542f72e33c45b973ba693a5e1509c1c`.
- The public `release.json` switched from **v0.142.2** to **v0.142.3** during
  this checkpoint, with that exact source revision. Selector PR #788 is merged
  at `6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8`. Marker availability is now
  verified; remaining release-audit findings and final public acceptance belong
  to the release coordinator, not this source inspection.
- v0.142.2 includes the reviewed Journey/audio/recovery batch, including the
  cumulative spatial input formerly tracked by PR #735. Source registration is
  distinct from playtesting all its missions.
- Current main registers spatial editions through **`whole-spatial-v37`**.
  Normal Solo/Versus still selects **v25**; Team selects
  `team-cultural-specialist-originals-2`. Newer candidate geometry is not silently
  promoted to default.
- Full suites remain explicitly waived/skipped, not passed. Focused checks,
  source identity, validation/lint/format, build/provenance, immutable hashes and
  basic availability remain delivery-integrity gates. Public player qualification
  is deferred under the latest user instruction, not represented as passed.

Sources: [current public marker](https://mekhovov.github.io/revealline/release.json),
[v0.142.3 release](https://github.com/mekhovov/revealline/releases/tag/v0.142.3),
`game/content-design/default-entry.mjs`, and
`game/content-design/route-definition.mjs`. Newer exact publisher receipts
supersede this dated observation.

## Completed implementation foundations

The following are implemented in the cumulative source; their broad human/device
acceptance is not implied:

- One capture contract, authored foundations, walls, player-only terrain,
  permanent relays, directional zones and timed bonuses.
- Stop-on-capture, fair straight-between-impact ordinary movement, warned
  pursuit/interception, travelling trail impacts and erosion roles.
- Explicit difficulty presets and admin tuning; FPV defaults, actor/appearance
  choices and preserved Original-rule editions.
- Unified Journey/Classic/Custom mission browsing, progress, Next across
  campaigns, Skip and retained historical editions.
- Studio map/campaign authoring, manual image workflow and copy-on-write source.
- Shared pixel-art presentation foundations, typography, directional actor and
  trail effects, plus pictured Team missions and specialist roles.
- Reviewed Ukrainian spatial successors through v37, including contested walls,
  timed opportunities and the pressure-corridor triptych. These are candidate
  editions, not evidence that every route is balanced or enjoyable.

## Original Journey phase completion

| Phase   | Implemented                                                                                 | Still required for completion                                                                                |
| ------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| P00     | Reference inventory/crosswalks, direct flow, stable progress and capture teaching           | Final dispositions for all 48 numbered references; current-edition rationale and human capture understanding |
| P01–P03 | Foundations, Horizon/Border/Signal, terrain/catalogs and Studio CRUD/manual image authoring | Distinct route quality, useful bonuses, pacing, authoring recovery and device qualification                  |
| P04–P07 | Neon/Rover/Fracture/Phaseworks, frontier pressure, erosion and cultural successors          | Complete current-speed routes, useful escape/repair choices, shortcut and cleanup review                     |
| P08–P12 | Livewire/Relay/Crosswind/Sentinel/Apex mechanics and editions                               | Actual signature-threat use, objective order, warning overlap, mastery and quota-tail review                 |
| P13     | 71 core missions, 12 Remixes, eight optional studies and continuous progression             | Whole-Journey pacing/cuts, adjacent-mission distinction, multi-seed routes and reviewed default promotion    |
| P14     | Twelve pictured Team missions, owned impacts and cultural/specialist successors             | Complementary complete routes, clear Support/rescue, two-player balance and device checks                    |
| P15     | Compatibility, evidence, release and rollback infrastructure                                | Human sessions, cumulative accessibility/performance/offline, Legacy transition and exercised rollback       |

The six FPV increments also have implementation foundations, but remain open for
physical held-input validation, Original/current continuity, Team front and
disconnect ownership, playing-size role readability, full-shell accessibility
and human cooperation. Static source art is not runtime animation acceptance.

## Release queue and parallel batches — earlier snapshot

| Order         | Batch                                 | Current state and next gate                                                                                                          |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1             | v0.142.3 publication                  | GitHub release published and public marker switched; publisher owns final audit and scoped public acceptance                         |
| 2             | v0.142.4 selector/content             | First #789 audit preservation, then #776 and refreshed #738/#747; final-candidate inventory and artwork screening still need refresh |
| 3             | v0.143.0 audio resilience             | #779 rebased/pushed at `c8a70888e9c4a226470df39cb6163a912c1ee28c`; exact integrated release/public transport checks remain           |
| 4             | Existing reserved v0.144–v0.149 train | Preserve the coordinator's allocations and dependencies; do not manufacture competing versions                                       |
| 5             | v0.150.0 unified experience           | Existing menu, Pause, actor, discovery, Team, Demo and community inputs; reconcile into one reviewed playable batch                  |
| Source intake | #786                                  | 158 unchanged actor/Moving Edges source files preserved, milestone 57/v0.150.0; draft/hold remains, runtime adoption separate        |
| Source intake | #793 Cooling loop v38                 | Reviewed/pushed opt-in encounter successor; aggregate-input/hold for publisher integration, no separate version allocated            |
| Follow-on     | Alternate Pressure/Relay routes       | `b3b3b06de` pushed as a five-path test/documentation-only successor to #793; offered to existing cumulative intake, adoption pending |
| Maintenance   | #787                                  | CI timing/shard tools preserved under Branch reconciliation, milestone 13; no workflow activation or speedup claim                   |

The newer community #784 head is
`6fff90eeb8e2da40371e008afd4bc0d3277c2fae`: grouped DroneAid entries and the
scoped Workshop-context correction are pushed. Its owner reports 50 focused
checks, locale/lint/format checks and bounded EN/UK browser layouts. These are
not a new public release or full integrated-source proof. #783 is a preservation
and reconciliation source, not permission to merge overlapping snapshots.

Final queue reconciliation adds **#789** at
`7d7d25a276e0edf32a6c60fdda8c87a03d8a0c6a`: preserve the exact historical audio
audit in future evidence packages before any v0.142.4 assembly. Do not rewrite
the already frozen v0.142.3. #783 is now pushed at
`0cc7337a8e490d73ad9d7718fb5b208aaf7da924`; it remains preservation-only, with
#781 requiring restacking. #771/#782/#784/#786/#780 remain inputs to the reserved
v0.150.0 batch, alongside the separately owned Team/Pause/discovery work. #787
stays maintenance-held rather than being advertised as a product release.

The reconciliation owner reports 264 registered worktrees and 113 dirty entries
in a newer inventory. These counts include historical/active owner checkouts and
dependency-only residue; they are not 113 missing game features and do not
justify bulk PRs or deletion. Inspect semantic changes and preserve ownership.

The detailed local-source inventory, superseded donors, remaining owner pushes
and release holds remain in [PR #780](https://github.com/mekhovov/revealline/pull/780).
No original editions, media, historical releases or unpushed owner work may be
deleted to accelerate this queue.

## Active next implementation batch

**Levels: Team rescue advice on Resume is implemented and reviewed.** The
reproduced host defect replaced a still-downed player's cause/rescue instruction
with generic fresh-direction advice. The correction reconstructs the localized
message from current player state and retained knockdown cause. Ordinary Resume,
fresh-input requirements, cancelled rescue channels, travelling impacts,
specialist roles and teaching progress remain unchanged. Eight new public-input
regressions and 31 adjacent Team checks pass, with no skips. This is a host
presentation correction, not a simulation-policy change. It is adopted in
the existing PR #757 batch, not claimed as released. The source commit
`42710c2b2340ad7d6a02078b98cf6e569537d47f` is pushed; see its
[focused evidence](https://github.com/mekhovov/revealline/blob/42710c2b2340ad7d6a02078b98cf6e569537d47f/docs/verification/team-resume-rescue-guidance-2026-09-29.md).

**Levels: empty Support pulses no longer count as learned.** A second narrow
correction, `8a143fe951b28ea36c18b4138650c9187032d9f2`, requires an actual slowed
enemy or intercepted impact. The pre-fix unit cohort had nine passes and two
expected failures; the corrected teaching/host/Resume cohort passes all 21 with
no skips. Independent review found no actionable defect. Stored v1 fields,
acknowledgement, capability APIs and existing saved completion flags are
unchanged. Both commits are now adopted into existing **PR #757**, verified at
`0c89c1c3b88e7eb8ae0f91e2dd42f2e393cb606e` on main base `6a67d6db`; logical
adopted commits are `0e13057b7` and `552d5faa0`. The combined batch includes
More-collapse and Large-text rendering. It is integrated, **not released**.

The owner's pushed evidence records 112 combined Team checks, nine complete
display-preference checks and two selected source-dependency checks passing,
plus changed-file lint/format and bounded local EN/UK browser layouts. Levels
verified the PR head and read that evidence; it did not independently repeat
those combined runs. The changed Team renderer fingerprint requires a new
Team/equipment production review before release. Do not rewrite historical
approvals. Browser review also found a narrow-screen Ukrainian DOM
HUD/ability-label wrapping defect; the subsequent source correction is described
below rather than remaining incorrectly marked as unimplemented.

**UX: Team Large text and the compact HUD follow-up are source-complete.**
The same stored display preference now reaches canvas labels without changing
actor/contact geometry. PR #757 is verified at the newer head
`1a406a2c0a33b1ba75cc61318ee91f8bcf3504a0`, with narrow HUD/control wrapping,
compact Ukrainian labels and locale-live departure captions. Pushed
[follow-up evidence](https://github.com/mekhovov/revealline/blob/1a406a2c0a33b1ba75cc61318ee91f8bcf3504a0/docs/verification/team-hud-wrap-20260929/README.md)
records 99 layout/host checks before the isolated caption fix, then six locale
checks and 20 existing guards afterward. These overlap and are **not** 125 unique
final-source tests. Native local EN/UK evidence includes actual downing,
recovery, Settings/Resume and four viewports; physical hardware, frozen public
source and 200% zoom remain unqualified. At 568×320 the full board is small and
long messages scroll inside the retained message band; not all sentences are
simultaneously visible.

PR #761, verified at `d22a6d0795ac095bbf9c988665060913a789ff07`, tracks the
minimal 17-path A1 renderer preservation input and its separate production
admission work. The owner reports 152 and 31 focused checks; the 59-slot admission
is still pending. Source preservation and passing tests are not production-art
approval. Keep priorities A (characters/reliable play), B (encounter variety), C
(a finished Ukrainian/FPV cohort), with formal C2 human game-feel study last.

The subsequent PR #761 head
`626cafc7d252375a8cc928e094aff74bb0c5456a` is also verified. It adds the exact
Effects20 predecessor reader, with 32 focused checks reported by its owner.
This does not admit the 59-slot production successor or close A1 renderer review.

Teaching acknowledgement/schema work is still under design review, not included
by copying an old host or silently reinterpreting v1 progress.

### A2: bounded compact cue correction implemented; broader acceptance open

The earlier 568×320 Ukrainian/Large screenshot had overlapping Hunter labels
on its complete 212×106 CSS board; the shield remained visible. It was not
evidence of an active LOCK warning failure. The sparse greedy placement could
miss usable space, while a null placement could omit a cue.

PR #757 is now verified at
`f067823fe8e2f76d061bd45d17b11787fe376a23`. Below 320 CSS board pixels, its
bounded group packing retains clear placements and excludes actual player/enemy
contacts and locked targets without shrinking type. Atomic fallback and explicit
unplaced diagnostics expose impossible packing instead of claiming success.
The compact information contract consolidates redundant idle Hunter text into
the full translated Slowed caption; active danger captions retain their wording
plus the Help-labelled slowdown arrow and existing dashed ring. Wider captions
are unchanged. Simulation and authored maps are unchanged.

The pushed [cue-layout evidence](https://github.com/mekhovov/revealline/blob/f067823fe8e2f76d061bd45d17b11787fe376a23/docs/verification/team-cue-layout-20260929/README.md)
records a final complete 157/157 renderer/host cohort, including actual-painter
text multiplicity, envelope separation, contacts/locked targets, minimum sizes,
state combinations and cache behavior. Recorder widths are deterministic, not
native font measurements. Native local Start/loss/downed/Pause/Help/rotation/Resume
at 568×320 and 390×844 verifies observed Ukrainian presentation frames, not continuous
all-state packing or physical devices. Levels verified the head and read the
evidence; it did not repeat those runs. Retained raw-log whitespace remains an
explicit evidence exception, not a clean all-file whitespace claim.

At this earlier head, a readable external cue rail or equivalent overflow policy
for saturated custom maps remained open. The follow-up below now implements a
paused Field details recovery; do not continue listing that bounded source slice
as unimplemented. **Do not close all A2:** moving-frame cost, full native-state/
locale coverage, 200% zoom, physical controllers/touch and production/public
qualification remain deferred, not passed. Keep A3 outer HUD acceptance distinct
and preserve historical approvals.

### A2 follow-up: dense-Team Field details implemented

PR #757 is now verified at
`fa442656da2d9d5827a2f12209d5f19eb49b94b1`, still an open draft. When the bounded
compact-canvas planner reports unplaced cues, a **Field details** action appears
outside the complete board and stays available for the attempt. One activation
pauses and opens the existing Help reader with every player, active enemy and
core. It retains identities, phase, lock, slowdown and anchor state. Back returns
to the action while paused; Resume is deliberate. Resizing inside the reader
preserves its exact rows and focus. Critical loss/rescue messages are not replaced.

The pushed [overflow evidence](https://github.com/mekhovov/revealline/blob/fa442656da2d9d5827a2f12209d5f19eb49b94b1/docs/verification/team-cue-overflow-20260929/README.md)
and terminal TAP summary record **163/163** complete adjacent renderer/host tests,
zero skips or failures. The 55-case focused cohort overlaps that total and must
not be added again. Scoped lint/format/syntax and independent review are reported
passing. Local ordinary-import browser evidence uses a dense test arena, not a
new campaign: 26 reader entries remain intact through **568×320 → 390×844**
rotation; Back retains paused focus. Levels verified the current head and read
the receipts, but did not rerun the tests or browser session. The read-only audit
also matched all 20 overflow-manifest entries to their current-head byte counts
and hashes; screenshot bytes were checked, not a new visual review.

Dense canvas labels can still overlap in impossible packing cases. The complete
paused reader is the implemented fallback, **not** proof that every live caption
fits on a 212-pixel board. No core rules, contacts, clocks, pictures or production
approvals change. Full-mission, physical-device, zoom/performance/offline and
production/public acceptance remain deferred.

### B / C6 follow-up: mission practice and exact artwork-parent inspection

PR #761 is now verified at
`e8fcaa365380d1b64a4aab17f83862c3c69793fd`, still an open draft. Field Guide adds
Optional scout, Optional sentry, Trail pursuit and Heading interception lessons.
Validated effective mission rules control Practice availability. Practice starts
an isolated run from the mission's exact effective rules, spawn, recipes, seed
and steering policy; it does not continue a paused cut, enable extra encounters,
award progress or replace a parent on a failed/cancelled/stale handoff. Existing
Controller Practice retains seed 1. Live language changes preserve the actual
selector instead of replacing it with translated label text.

The separate `.rlart` workflow now resolves the declared immediate parent in a
verified packet and displays exact identities, dimensions and hashes at **Fit
whole image** or **Native pixels**. Native mode uses one image pixel per CSS
pixel in a bounded scroll area, without resampling saved bytes. Only the selected
asset and optional parent are decoded. Stale work and image URLs are retired;
exports, original bytes and gameplay bindings remain unchanged.

The pushed [actor-batch-16 evidence](https://github.com/mekhovov/revealline/blob/e8fcaa365380d1b64a4aab17f83862c3c69793fd/docs/verification/actor-batch-16/README.md)
records **69/69 encounter/host checks** and a separate **28/28 artwork checks**,
zero skips. Earlier fixture failures and their unchanged-HEAD reproductions are
retained, not erased; they are not a new production-gameplay failure claim.
Local Studio import of the retained Ukrainian artwork packet verifies selected
and immediate-parent identities, measured Native sizes, Fit and EN/UK controls.
Levels verified the head and read these receipts, not an independent new run.
The inspected README, result logs and retained fixture-failure/correction logs
also match their manifest byte counts and hashes.

This implements inspection/practice workflows, **not** artwork adoption, cultural
or pixel-art quality approval, a 59-slot production admission, version allocation,
merge or release. Remaining source work includes full cross-mode encounter
guidance and cohort/runtime binding preparation; Team teaching acknowledgement/
stored-schema design remains a separate item. Priorities remain **A → B → C**,
with formal C2 human game-feel study last and production qualification deferred.

Prefer these reviewed small slices in the existing v0.150.0 batch, with logical
commits and focused regressions, rather than one new release per fix. Once a
batch is frozen, stop adding scope; prepare later work independently.

### Latest follow-up: imported Team Start, cross-mode Help and artwork files

Levels has pushed the independently reviewed Team preparation repair in
commit **`b25b29edf4a9ec8628b9d52333d8c683155ae0ec`** on
`codex/team-import-hunter-tuning`, based on main `321408a3`. It is handed to the
UX owner for adoption into **existing PR #757**, not a separate queued feature PR.
That adoption is now complete as `b5d8bddd2eb6b49b66bc2b4847dfc289e196eea5`,
without runtime edits. PR #757 is freshly verified at
**`29f899e23ac556dd623a02df401adbea151fc087`**, still an open draft and not released.

Valid Team v6/v7 Hunter imports were accepted but could not Start because the
current gp4 adapter added an `encounter` override forbidden by those editions.
The narrow repair uses the existing edition capability and retains their native
committed attack speed **8**, without weakening validation, removing Hunters or
changing frozen adapters. Previously successful v1–v4 output goldens remain
unchanged. Tuning the v6/v7 committed attack speed would require a separate,
explicitly versioned extension; this compatibility fix does not claim that work.

The two new files pass **25/25 focused cases**, zero skips, with exact importer
Start and warned attacks across both editions/all presets, frozen byte/behavior
guards and real installed-attempt reconstruction after 210 engine ticks. Scoped
lint/format and independent review pass. This is not IndexedDB/browser Resume
acceptance. The [repair record](https://github.com/mekhovov/revealline/blob/b25b29edf4a9ec8628b9d52333d8c683155ae0ec/docs/verification/team-import-hunter-tuning-2026-09-29.md)
preserves the six original failures and subsequent Expert witness-fixture
corrections. The PR #757 target adapter/foundations and eight dependencies match
the patch baseline exactly; broader PR/main conflicts still require reconciliation.

The earlier PR #757 head **`04b49041ac06fcc073782751ea56acd5fa8c8030`**
contains a Team trail-impact Help slice recording **25/25** checks: six new
guidance/host cases, eight existing briefing-host and eleven impact-core cases.
This is a different cohort from the 25 tuning checks and overlaps older Team
coverage; do not add it to the earlier 163-case total. The nine Help-manifest
entries match exact-head bytes/hashes. Local Help observations use keeper-only
accepted imports and preserve the separate Hunter-Start failure diagnosis; they
do not pre-accept the new tuning fix or a composed release. Core/schema/tuning
and gameplay timing were unchanged by that Help commit.

The subsequent [composed-source receipt](https://github.com/mekhovov/revealline/blob/29f899e23ac556dd623a02df401adbea151fc087/docs/verification/team-hunter-composition-20260929/README.md)
passes **54/54**, zero failures, skips or cancellations, in 3.63 seconds. Four
additional actual application-host cases cover EN/UK × v6/v7 with original
Hunters retained: ordinary import → prepared Start → playing → Pause → Help →
reader → Back. Time remains paused and Resume is deliberate. The total includes
25 tuning/compatibility, ten guidance/host, eight existing briefing-host and
eleven impact-core cases; do not add overlapping earlier totals. The imported
Hunter source blocker is **resolved**, including the composed host path. This is
not a native browser, physical-device, full-import or public acceptance claim.
PR #757's broader accepted-main conflicts remain separate integration work.

PR #761 is now verified at **`9fa28512476bcef326113b8f73adf2ec40be272c`**, also an
open draft. Current-board Versus Help reads the actual two admitted runs,
including seat-specific optional roles, and preserves live-locale focus/lifecycle.
Its retained-artwork handoff re-verifies the selected exact image and provides
its original bytes, MIME and safe filename without modifying `.rlart` provenance.
Recorded cohorts pass **17/17 Versus** and **38/38 artwork** with zero skips.
The local Studio receipt records a saved Poltava PNG of 1,756,938 bytes and
SHA-256 `aaafaaca7ad1ee916ceeb04338690178a10314d6b735fcbe63fd565ec672ac30`.
Both browser download-event waits timed out despite the saved file and visible
fallback; this is not broad browser download certification. Levels inspected
the source/receipts, not a new native session or external saved-file rehash.

Two adjacent input diagnostics remain recorded rather than hidden: mirrored-keyup
in `couch-shell` (24/25), and the ID-only Help harness observing race-start instead
of race-help-reading on both candidate and pinned-parent diagnostic. A stopped
25-second process is not a passing run. Owners must resolve or isolate these
integration concerns. Neither PR is merged/released; skipped stage jobs and a
successful title check are not product verification. Remaining required delivery
work is accepted-main reconciliation, composed-source correctness, build/provenance,
immutable freeze/archive and basic availability. Extended production, artwork,
device, performance and human qualification remain deferred, not passed.

### Subsequent A/B source continuation: slowdown cues and Guide completion

Fresh source heads are now **PR #757 `f09146837cfcc5191c89e54d7f9afea56b2ef8e9`**
and **PR #761 `fb26b059798d7e15169d3ff9c7e4653d13384970`**. Both remain open,
conflicted drafts. Their title checks pass, but stage jobs are skipped; this is
not integration or release acceptance.

- Team timed enemy-slow pickups now use the existing ordinary/compact-Hunter
  Slowed cue consistently with Support, tick-based expiry and freeze exclusions.
  Recorded **70/70** checks pass. Pre-fix missing-cue failures remain preserved;
  the sparse checkout's static edition collector and integrated build are not
  newly verified by this receipt.
- Guide batch 18 prevents custom-edition missing-palette crashes and unsupported
  catalogue-practice launches while preserving admitted exact-mission practice
  and hidden-page image readiness: recorded **73/73**. Original failures and the
  intermediate readiness regression are retained.
- Batch 19 adds two complete modeled Solo Sentry practice routes through warning
  Pause, clear, verified replay and retained Retry, with no awards/profile writes:
  recorded **2/2**. It changes tests/evidence, not content or gameplay. The held-key
  fixture correction is distinguished from a product failure.
- Batch 20 completes Ukrainian Sentinel, row-prefix and practice guidance while
  preserving live language/focus/lesson/child/paused-state continuity: recorded
  **45/45**. Scenario identities are unchanged; mixed-language failures and a
  corrected test-ID mistake remain documented.

Levels checked fresh heads, receipt scope and stored TAP summaries without
rerunning those suites or production/native sessions. Counts overlap and are
not summed. These bounded items are **implemented**, not still-unstarted work;
accepted-main integration and required delivery-integrity checks remain pending.
Production/art/device/human qualification remains deferred, with C2 human study
last. Do not relabel these source receipts as approval or public delivery.

## Remaining priority and effort

These are focused engineering estimates excluding serialized release time,
hardware availability and human review; they are not promised delivery dates.

| Priority       | Work                                                                                     | Why it matters                                                                                                                        | Focused effort                                                                           |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1              | Finish the already-prepared selector/audio/native/community batches                      | Turns completed source work into player-visible improvements and resolves navigation/recovery defects                                 | Per owning queue; do not restart completed qualification                                 |
| 2              | Integrate Team Resume/Support/More/Large, dense-field reader and imported-Hunter Start   | Players need working accepted imports, accurate rescue instructions and readable state even when compact canvas packing is impossible | Bounded source complete; composed checks/reconciliation and publisher integration remain |
| 3              | Broaden complete-route coverage for the existing v37 trio and Cooling loop v38           | Six complete strategies now exist; additional presets/steering/seeds, current optional goals and cleanup/repair quality remain open   | 1–3 engineering days for the next bounded evidence/repair slice                          |
| 4              | Review a new default spatial edition                                                     | New geometry cannot improve normal play while remaining opt-in; require useful complete routes, not just a larger version number      | Re-estimate after the v37 route review and human feedback                                |
| 5              | Team teaching acknowledgement and remaining Studio/HUD donor ports                       | Avoid consumed-before-seen teaching, false Support completion and stale historical-host imports                                       | 0.5–2 days per bounded successor, after schema/ownership review                          |
| 6              | Whole-Journey pacing, actor/state readability and final reference dispositions           | Distinct fair challenges matter more than repeating easy geometry or increasing speed globally                                        | 3–7 days per polished 3–5-mission slice; broader review remains multi-week               |
| Deferred       | Production, accessibility/performance and two-player/device/human qualification          | Finds failures that mocks, byte audits and single-player routes cannot establish; does not block source work under latest request     | 2–5 days per bounded qualification stream plus hardware/players when resumed             |
| Separate gates | Creator/community external services, soundtrack listening/rights and original production | These require real environments, rights and human quality review                                                                      | Owner estimates; not closed by source preservation or automated passes                   |

Within the unchanged **A → B → C** ordering, do not recreate the implemented
four-role Guide practice, Team trail Help, current-board Versus Help, retained-parent
comparison or exact artwork-file handoff. The next B/C source slices are remaining
cross-mode guidance gaps and accepted cohort/runtime binding preparation,
estimated **0.5–2 engineering days per bounded slice**
after owner reconciliation. This is not an estimate for production-art admission
or the formal C2 human study, which remains last and deferred.

## Remaining local-source dispositions

### Pressure corridor alternate strategies: complete and pushed

The lower-first Pressure ladder route uses the slow-field approach, actually
launches from its lower landing, later links all foundations and clears at tick
3,263 (~27.19 seconds), with six cuts and zero losses/pickups. It experiences
warned fixed-target interceptions and active trail impacts. Its legal final
enclosure secures both field keepers' occupied trail cells and fills the remainder,
reaching 100%; no actor or fill rule was edited. Checkpoint `c28892f0a872a209`.
The fast skilled clear is pacing-review evidence, not proof of a dominant easy
solution, human fairness or justification for raising quota.

The east-first Switchback route opens its east relay at 183, crosses the entire
connector to the outer landing, launches there before opening west at 1,353,
and traverses both connectors again after the roamer activates. It clears at
5,417 (~45.1 seconds), 1,705/2,002 cells, eleven cuts and zero losses/pickups;
checkpoint `b1e9dccc51cfe04f`. Both objectives are complete at 15.58% coverage,
leaving seven cuts and 4,064 ticks: cleanup quality remains a review question.
The successful route avoids impacts; three retained legal negative variants show
emitter/keeper timing consequences without claiming a unique solution.

Both routes verify recorded replay and actual equal Versus winning boards. The
combined **41/41** cohort, changed-file lint/format and independent review pass.
All new code is test-only, source pushed at `b3b3b06de`; aggregate adoption and
release remain pending. Original expectations/checkpoints remain exact. Corrected
test/doc labels distinguish old Phaseworks/Relay helper predicates from current
v37 gap-specific prose; no runtime medal is awarded by either fixture.

### Cooling loop: investigation complete, scoped successor pushed

A bounded legal-input review of v37/current tuning found two viable opening
strategies on Standard, immediate steering, seed 1. One makes five closures,
links all four islands and neutralizes both 40-cell lethal banks without a loss
by tick 1,650. It earns only 331 of 2,098 claimable cells (15.777%); the mission
still requires 81%. The alternate bank-first opening also succeeds, but neither
is a full-clear proof or proof that the remaining quota is tedious.

The erosion interaction needs repair or a narrower design claim. Following the
five-closure route with 2,400 neutral ticks produced no erosion through tick
4,050: the eroder stayed at y=9.5 and x=1.2504–25.7448, away from the banks.
Its authored horizontal heading and northwest wall explain that ordinary motion.
Capture-induced domain repair can relocate an embedded actor, so this is not a
claim of universal unreachability. The intended strategic choice should not
depend on that exceptional relocation.

That investigation is now followed by PR #793: actual v38 moves only the existing
eroder from `(14.5, 9.5)` / `[1, 0]` to `(14.5, 24.5)` / `[1, 1]`. The corrected
design describes protected landings connected by **erodible earned links**.
The same map, banks, foundations, objectives, quota, media, policy and speeds stay
intact. Expert's existing maximum-clearance algorithm consequently moves its
generated extra keeper from `(44.5, 2.5)` to `(41.5, 2.5)`; role/count/speed stay
unchanged and the preparation consequence is tested explicitly.

Both opening strategies now experience warned erosion of ordinary earned return
cells; neither is falsely described as proven lethal-bank reopening. A northern
continuation reaches 1,708/2,098 cells (81.410867%) at tick 5,503 with 13 closures,
six warnings/erasures and all three lives retained. Both banks are neutralized,
all foundations remain linked, the denominator is stable, and no bonus is
collected. Replay checkpoint `21a461387f53c722` and actual equal Versus winning
boards agree. This is **one** Standard/immediate/seed-1 full route, not two complete
strategies or a human balance verdict. Older v37 snapshots are unchanged.

The second bank-first approach is now also complete: 1,713/2,098 cells at tick
8,189 (68.24 seconds), 15 closures, eight warned erosions, zero losses and no
pickups. All foundations connect; the 40 eastern-bank lethal cells remain.
Checkpoint `b8aab03a29e67318` and actual equal Versus boards agree. This is an
ordinary win without both-bank mastery, not a contradictory mastery award.

Still remaining: broader full-route presets/controls/seeds,
useful repair/escape decisions and post-bank pressure/cleanup review. Six old
recipes and several candidate placements failed and remain documented, not
relabelled as passing evidence. No public-host, physical-device or human proof is
claimed. Default Solo/Versus remains v25; v38 is deliberately opt-in through exact
links/Studio and its own selector, not silently promoted.

### Source preservation and selective adoption

The bounded donor review distinguishes unapplied work from already-delivered
behavior. Preserve exact original commits; do not merge their historical hosts.

| Source                                                                                                 | Disposition and next action                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team teaching `57bfaa567c62def3eae222c8feb69ddc4fc8039c`                                               | The narrow actual-effect Support completion guard is implemented in `8a143fe95` for #757. The larger acknowledgement donor changes stored v1 fields and guidance/localization contracts; it still needs the UX owner's compatibility design before adoption.                      |
| Campaign Tour `74e2c9baec91462e68cee130c952550d82d611d0`                                               | A distinct larger Classic race-session feature, not integrated single-race behavior. Preserve the donor and evidence archive; new integration must retain current media/installed-owner transactions, controller guards and namespaced identities. No new version allocation yet. |
| Terminal Retry `ab96375aeae648763380e9210402dbe53b06c6d4` / `d103953f08edbb81331dc4171fc24f88f45d422d` | Principal deliberate-Retry behavior is already integrated. Do not add a competing historical activation guard. The old 600-ms Solo cue is a separate proposal, not a missing recovery fix.                                                                                        |
| Narrow HUD and Enemy Workshop                                                                          | Route labels, numeric formatting, reduced effects and shared typography through existing native-menu ownership/#782. Existing #780 preservation patches must be checked rather than duplicated; exclude old generated actor/production changes.                                   |
| Studio reference-bundle prototype                                                                      | Preserve and qualify separately: this adds storage/compiler/provenance behavior, not merely styling. Creator ownership must review v1 compatibility, immutable anchors, backup/import and atomic storage before adoption.                                                         |

This review used main `b5ab06e` and explicitly inspected queued source snapshots.
It is not a claim that all subsequently changing PR heads were freshly verified.

## Queue and safety constraints

One publisher owns protected-main integration, immutable versions/assets, Pages
and public acceptance. Other lanes prepare isolated source in parallel. Never
reset or change a shared checkout underneath another active owner; use an owned
worktree or exact private overlay and coordinate reintegration.

Disk space remains limited: reuse a clean owned checkout, avoid duplicate heavy
builds and preserve other lanes' caches. No new heavy archive is required for a
small host regression. The recently interrupted community edits were recovered
and privately hash-verified before their same-PR update; recovery is not a reason
to repeat that unsafe shared-checkout pattern.

Completion still requires reviewed source, focused checks, final release gates,
actual public delivery and scope-appropriate player evidence. Human enjoyment,
cultural interpretation and physical-device behavior are not inferred from
deterministic clears or automatically restarting a mission.
