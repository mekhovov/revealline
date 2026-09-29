# Levels, gameplay and presentation — 29 September 2026

This is the Levels lane's current implementation and acceptance checkpoint.
Preserve earlier dated plans as history. The original **Journey P00–P15** and
the broader **whole-game P00–P18** are different programmes, not interchangeable
phase numbers.

## Latest direction: production testing deferred

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

Next source work is **alternate complete strategies for Pressure ladder and
Switchback exchange**, then broader presets/controls/seeds and targeted remaining
campaign defects. Pressure's lower-foundation mastery is still incomplete;
Switchback uses actual opened return ground but does not establish end-to-end
shortcut necessity or impact-on-relay mastery. Production testing is not a
prerequisite for this work. Exact evidence and limitations:
[Cooling loop v38](https://github.com/mekhovov/revealline/blob/de5aeaac2f601ed3703b40071c9c4e09a7ec7724/docs/cooling-loop-erosion-v38.md),
[complete triptych routes](https://github.com/mekhovov/revealline/blob/de5aeaac2f601ed3703b40071c9c4e09a7ec7724/docs/verification/pressure-corridor-complete-routes-2026-09-29.md).

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

## Release queue and parallel batches

| Order         | Batch                                 | Current state and next gate                                                                                                          |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1             | v0.142.3 publication                  | GitHub release published and public marker switched; publisher owns final audit and scoped public acceptance                         |
| 2             | v0.142.4 selector/content             | First #789 audit preservation, then #776 and refreshed #738/#747; final-candidate inventory and artwork screening still need refresh |
| 3             | v0.143.0 audio resilience             | #779 rebased/pushed at `c8a70888e9c4a226470df39cb6163a912c1ee28c`; exact integrated release/public transport checks remain           |
| 4             | Existing reserved v0.144–v0.149 train | Preserve the coordinator's allocations and dependencies; do not manufacture competing versions                                       |
| 5             | v0.150.0 unified experience           | Existing menu, Pause, actor, discovery, Team, Demo and community inputs; reconcile into one reviewed playable batch                  |
| Source intake | #786                                  | 158 unchanged actor/Moving Edges source files preserved, milestone 57/v0.150.0; draft/hold remains, runtime adoption separate        |
| Source intake | #793 Cooling loop v38                 | Reviewed/pushed opt-in encounter successor; aggregate-input/hold for publisher integration, no separate version allocated            |
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

## Remaining priority and effort

These are focused engineering estimates excluding serialized release time,
hardware availability and human review; they are not promised delivery dates.

| Priority       | Work                                                                                     | Why it matters                                                                                                                    | Focused effort                                                               |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1              | Finish the already-prepared selector/audio/native/community batches                      | Turns completed source work into player-visible improvements and resolves navigation/recovery defects                             | Per owning queue; do not restart completed qualification                     |
| 2              | Integrate Team Resume/Support/More/Large and dense-field reader                          | Players need accurate rescue instructions and readable two-player state, including impossible compact canvas packing              | Bounded source complete; publisher integration, production testing deferred  |
| 3              | Complete strategic-route evidence for the existing v37 trio and Cooling loop v38         | Four complete routes now exist; alternate Pressure/Relay strategies and broader full-route coverage remain open                   | 1–3 engineering days remaining for the bounded evidence/repair slice         |
| 4              | Review a new default spatial edition                                                     | New geometry cannot improve normal play while remaining opt-in; require useful complete routes, not just a larger version number  | Re-estimate after the v37 route review and human feedback                    |
| 5              | Team teaching acknowledgement and remaining Studio/HUD donor ports                       | Avoid consumed-before-seen teaching, false Support completion and stale historical-host imports                                   | 0.5–2 days per bounded successor, after schema/ownership review              |
| 6              | Whole-Journey pacing, actor/state readability and final reference dispositions           | Distinct fair challenges matter more than repeating easy geometry or increasing speed globally                                    | 3–7 days per polished 3–5-mission slice; broader review remains multi-week   |
| Deferred       | Production, accessibility/performance and two-player/device/human qualification          | Finds failures that mocks, byte audits and single-player routes cannot establish; does not block source work under latest request | 2–5 days per bounded qualification stream plus hardware/players when resumed |
| Separate gates | Creator/community external services, soundtrack listening/rights and original production | These require real environments, rights and human quality review                                                                  | Owner estimates; not closed by source preservation or automated passes       |

Within the unchanged **A → B → C** ordering, do not recreate the implemented
four-role Guide practice or retained-parent comparison. The next B/C source
slices are broader cross-mode encounter guidance and accepted cohort/runtime
binding preparation, estimated **0.5–2 engineering days per bounded slice**
after owner reconciliation. This is not an estimate for production-art admission
or the formal C2 human study, which remains last and deferred.

## Remaining local-source dispositions

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
