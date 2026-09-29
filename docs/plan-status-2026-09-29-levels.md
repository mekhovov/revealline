# Levels, gameplay and presentation — 29 September 2026

This is the Levels lane's current implementation and acceptance checkpoint.
Preserve earlier dated plans as history. The original **Journey P00–P15** and
the broader **whole-game P00–P18** are different programmes, not interchangeable
phase numbers.

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
  source identity, validation/lint/format, build/provenance, immutable hashes,
  Pages availability and bounded public player checks remain release gates.

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
presentation correction, not a simulation-policy change. It is being handed to
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
approvals. Browser review also found a remaining narrow-screen Ukrainian DOM
HUD/ability-label wrapping defect, now owned by UX as the next small slice.

**UX, in parallel: Team Large text in the actual painter.** Respect the same
stored display preference in canvas labels while preserving actor/contact
geometry. Keep that separately owned rendering change clear of the Resume hunks.
Teaching acknowledgement/schema work is still under design review, not included
by copying an old host or silently reinterpreting v1 progress.

Prefer these reviewed small slices in the existing v0.150.0 batch, with logical
commits and focused regressions, rather than one new release per fix. Once a
batch is frozen, stop adding scope; prepare later work independently.

## Remaining priority and effort

These are focused engineering estimates excluding serialized release time,
hardware availability and human review; they are not promised delivery dates.

| Priority       | Work                                                                                     | Why it matters                                                                                                                   | Focused effort                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1              | Finish the already-prepared selector/audio/native/community batches                      | Turns completed source work into player-visible improvements and resolves navigation/recovery defects                            | Per owning queue; do not restart completed qualification                       |
| 2              | Release the integrated Team Resume/Support/More/Large batch                              | Players need accurate rescue instructions and readable two-player state                                                          | Source integration complete; production-review estimate with owner, then queue |
| 3              | Complete strategic-route evidence for the existing v37 trio                              | Current evidence proves first returns, not full clears or advertised strategic choices                                           | 1–3 engineering days for a bounded three-map evidence/repair slice             |
| 4              | Review a new default spatial edition                                                     | New geometry cannot improve normal play while remaining opt-in; require useful complete routes, not just a larger version number | Re-estimate after the v37 route review and human feedback                      |
| 5              | Team teaching acknowledgement and remaining Studio/HUD donor ports                       | Avoid consumed-before-seen teaching, false Support completion and stale historical-host imports                                  | 0.5–2 days per bounded successor, after schema/ownership review                |
| 6              | Whole-Journey pacing, actor/state readability and final reference dispositions           | Distinct fair challenges matter more than repeating easy geometry or increasing speed globally                                   | 3–7 days per polished 3–5-mission slice; broader review remains multi-week     |
| 7              | Offline/recovery, accessibility/performance and two-player/device qualification          | Finds failures that mocks, byte audits and single-player routes cannot establish                                                 | 2–5 days per bounded qualification stream plus hardware/players                |
| Separate gates | Creator/community external services, soundtrack listening/rights and original production | These require real environments, rights and human quality review                                                                 | Owner estimates; not closed by source preservation or automated passes         |

## Remaining local-source dispositions

### Content review now started: Cooling loop

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

Next: qualify a bounded successor eroder placement/heading, describe the route
as a **protected-landing loop** (earned links remain erodible), prove two complete
routes, and review whether meaningful pressure remains after hazard removal.
Keep ordinary enemies straight between physical impacts and preserve the old
edition. Six historical clear recipes failed before a closure under current
tuning; do not reuse them as current acceptance. No geometry has been changed
by this investigation, and no replay, public-host or human proof is claimed.

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
