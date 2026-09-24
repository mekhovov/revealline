# UX0: primary input and mission focus

Candidate v0.98.0; not a published-release acceptance record. See the
[execution board](player-first-ux-execution.md) for remaining UX1–UX6 work.

## Change and boundaries

- Solo cold entry focuses Start or Continue after boot releases inert content.
- One controller adapter owns Solo menu arrow keys. Native editing and Tab stay
  available; the standalone shell retains its keyboard fallback.
- Journey movement follows rendered rows: Left/Right stop at row edges and
  Up/Down select the nearest column in the adjacent row. The grid can be exited
  vertically to adjacent controls. Hidden/disabled controls are excluded.
- Solo, Versus and Team open the library at a retained or exact current mission,
  then the first available card. A pending remote selection keeps its existing
  focus lease until resolved; focus restoration cannot steal later player input.
- Rotation scrolls the same focused mission into view without refocusing it.
- Versus menu navigation includes Character reactions and its storage-retry action.
- Legacy and installed Versus menus include their visible Find/Next controls in
  the same restricted navigation root as the main panel.
- Team Pause/results include the visible header links, excluding live-board and
  hidden lobby controls. Cancelling departure restores the exact visible opener.

This does not deliver the compact UX1 gallery, completion pictures, terminal Retry,
new countdown or full player-screen qualification. Existing gameplay is unchanged.

## Baseline corrections

The nine failing tests in the original targeted Couch run were reproduced before
implementation. Corrections use the current content contract: authored speed
presets, an isolated boundary-enemy fixture, legal Sentinel win paths, the decoded
picture rather than the last actor draw call, and a real difficulty change event.
Result: the four targeted files pass 127 tests with no skips or cancellations.
The separate Couch catalogue file passes 18 tests.

The broader audit also reproduced an unavailable-picture backup import cancellation
on the baseline. Its fixture awaited an import before accepting replacement review;
it now explicitly accepts that review while asserting preserved save bytes. The
complete title-entry file passes 49 tests, including Start/Continue boot focus.

Old navigation fixtures that assumed synchronous opening of the retired mission
dialog now exercise the actual asynchronous library and neutral-input contract.
The modern nested-dialog route uses the library's Progress backup child; legacy
shell return guards remain explicitly tested at component level. Outcome-only
navigation setup uses a legal no-threat fixture, separately from production balance.
Both complete modal/nonmodal files pass 76 tests with no skips or cancellations.

The shared navigation suite passes 156 tests; its modeled three-mode host suite
passes eight. The completed chooser suite passes 62 tests, including unknown
current identities and resize ownership. Counts describe their separate runs;
they are not a complete repository suite or an aggregate release qualification.

The final visible-action audit found the Legacy Versus continuation row and Team
paused/result header links outside their menu roots. After correcting those roots
and Team departure return focus, the six-file Couch regression run passes 166
tests with no failures, skips or cancellations. Six new keyboard/controller cases
exercise both omissions, legal terminal results and cancelled Next; live controls
remain excluded. Its standalone shell fixture now includes the already-visible
difficulty/recovery actions in exact Tab order, after reproducing its old failure
on the baseline.

## Browser interaction evidence

Local source served through the ordinary queryless Solo and Couch routes:

| Evidence                                          | Result                                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo keyboard, actual 1280×720 CSS viewport       | Start focused at boot; Down reaches Missions; Confirm opens the current card; Down follows the next rendered row; Right follows that row; Back restores Missions.                                                                                                                     |
| Solo keyboard, actual 390×844                     | Retained mission focused and visible; Right stops at the single-column edge; Down moves to the next mission.                                                                                                                                                                          |
| Rotation to actual 844×390                        | Same Two bays card remains focused at y=148.9–300.6, inside the gallery y=108.8–316.4. The pre-fix card was below the viewport.                                                                                                                                                       |
| Versus keyboard Settings                          | Tab reaches Character reactions; Space toggles it while retaining checkbox focus.                                                                                                                                                                                                     |
| Legacy Versus keyboard                            | Tab reaches Find missions; Confirm announces preparation and opens Orchard Crossing; Back restores Find missions.                                                                                                                                                                     |
| Team keyboard Pause                               | Tab reaches both header links. Confirm on Race mode opens the discard dialog; Stay restores that exact header link, keeps PAUSED and clock 0:00, and does not resume.                                                                                                                 |
| Solo requested Workshop return, local browser     | `?workshop=asset-studio` opens Workshop with Asset Studio focused; Escape returns to Home with Workshop focused. No flight starts.                                                                                                                                                    |
| Solo exact Classic incoming link, actual 1280×720 | Keyboard Home → Missions announces preparation and focuses First Signal. The exact Relay Storm library identity then opens directly into play; Escape pauses with Resume focused. This checks the direct-launch outcome, while automated held-original tests exercise the write race. |

Browser viewport overrides were reset and temporary tabs closed after inspection.
These are browser keyboard/reflow checks, not touch-device or physical-controller
certification. Modeled controller tests are separately identified as automated.

## Source/build gates and pending release evidence

Lint, formatting, native formatting, validation, motion-lab syntax and the Field Kit
reproduction/readiness checks passed locally during implementation. The production
checks verify declared bindings/reproduction, not a complete art-quality review.
The ordinary local build failed with ENOSPC; its temporary staging was cleaned by
the builder. The host has under 1 GiB free. No user source or retained release was
deleted. An ordinary hosted build and full automated suites remain mandatory.

Restoring mandatory suites exposed a stale release-upload diagnostics mock that
omitted the exact-source policy lookup. Its nine tests pass after supplying that
Git response. Publishing Node tests (62), Pages Python tests (5) and artifact-policy
tests (27) pass. A full utility run also hit five failures/one error at the local
minimum-free-space guard; those guards remain unchanged and require a hosted rerun.

Before acceptance, record the final PR/source SHA, all six exact-source gates,
ordinary build and immutable artifact results, publishing revision, public URL,
deployed source/byte checks and real public input/play evidence here. A merged PR,
successful subset, or historical test waiver does not satisfy this gate.

### Mandatory-suite reconciliation

PR320's first hosted ordinary build passed on `00bc61063`; that source run was
superseded by `fa641e496`, so its cancelled test shards are not passes. The latter
source passed preflight and its Pages-controller checks; its ordinary build and
four complete shards were initially running. Its ordinary build subsequently
passed; its superseded shards were cancelled and do not count as passes. Source
`20b295488` then passed hosted preflight and the ordinary build in run35945156180;
its superseded shards were cancelled, not passed. After integrating main
`1518e15e2`, source `f43557ae0` passes hosted preflight in run35946474634; its
ordinary build and complete shards are running. Later working-tree corrections
require their own exact-head checks before acceptance.

Baseline reproduction separates these corrections from gameplay changes:

- The complete Solo continuous-input suite passes 12 tests after its queued-turn
  positions are adjusted to the actual approved v4 speed and its menu fixture
  awaits the current library. Pause, hidden/unfocused Resume and replay assertions
  remain intact.
- All 28 Team terrain/trail tests pass after their terrain-only snapshot declares
  only its prepared wall asset. Required production-image validation is unchanged;
  the fixture no longer falsely advertises decoded Team objective frames.
- The chapter-download, Studio-return and Couch-audio cohort passes 42 tests.
  Retained selector tests explicitly identify their compatibility boundary and
  keep the real selection/download/replacement machinery. A new current Solo
  catalogue regression proves visible failure, same-card Retry, selection and
  Back without replacing the previous prepared run. Its three-case targeted run
  passes; this is not a claim that all catalogue cases were rerun together.
- A genuine boot return defect prevented a requested Workshop return after native
  Home autofocus. The guard now permits only that unchanged initial focus, while
  preserving newer-focus and background-page rejection tests.
- A genuine terminal Journey defect used the generic library successor after the
  final core/optional mission, automatically selecting an optional Remix. The
  result now offers Browse missions and opens the guarded catalogue deliberately.
  The complete 15-case Journey host suite passes, including exact core tours,
  both optional endings, accepted artwork/checkpoints/receipts and Back focus.
  The continuous-library fixture that previously expected an automatic final
  Journey-to-Classic handoff is intentionally updated to the approved Browse
  contract: retain the result, allow Back, then require an explicit Classic card
  before asserting the same exact Legacy destination. Ordinary within-library
  continuation and preparation safeguards remain separately exercised.

The complete Versus encounter-cue file passes five cases after extending the
unchanged legal route by four/eight ticks for the v4 immediate/grid-centre pacing.
Both match formats still prove independent cues, paused-state retention, a real
lossless release cut, and frozen end-of-round state. The picture-only Team painter
suite passes five cases after the same truthful partial-snapshot correction as
terrain. The complete Team picture-host suite passes 19 tests after its exact
read-only preference inventory includes the already-shared difficulty/tuning keys;
the unchanged write assertion still forbids Solo/profile mutation.

Team victory/import helpers and additional host route fixtures are being renewed
against the approved current tuning using actual public direction/Support inputs.
Historical proof files remain unchanged. These are technical progression/recovery
checks, not fresh human balance reviews or physical-device certification.

The complete pending-mastery/backup file passes nine tests. Its setup now restores
a genuinely played historical untuned Homeward live cut, checks the exact saved
checkpoint, and completes it using keyboard input before holding the real replay
verifier. Fresh tuned missions intentionally do not grant historical mastery; the
fixture no longer assumes otherwise. Keep/replace, failed writes, uncertain owner,
Undo invalidation and deferred award/original assertions remain unchanged.

The Team host repair cohort has passing full-file evidence for terminal/lobby
(31), terminal HUD (8), imported Retry (3), and Next reentry/recovery (12). The
combined imported-artwork/custom-artwork/imported-Next/built-in-Next run passed its
67 unaffected checks; its two stale Retry-copy failures were corrected and that
entire three-case file rerun. This is 121 distinct checks across ten files after
correction, not a single uninterrupted aggregate run or full-suite acceptance.

Early Team difficulty was a real input-loss defect: bootstrap overwrote an actual
native choice with the stored default. The early-entry snapshot now records
input/change separately from Arena ownership and adopts a valid choice through
the shared preference authority before preparation. Opening/cancelling, untouched
markup and invalid values do not manufacture writes. A 71-case complete cohort
(entry capture, startup, arena memory and Journey difficulty) passes, including
queryless exact-art/preset selection, rejected storage and same-preset Retry.

Independent read-only review of the runtime diff against `71a0ffea` found no
actionable regression in input ownership, rendered grid/reflow, identity, focus
leases, departure cancellation, terminal browsing or early difficulty adoption.
This review complements the tests; it is not full-suite or hardware evidence.

The follow-up navigation cohort passes all 70 checks across five complete files.
Current/retained mission identity replaces obsolete first-card/Search assumptions;
Legacy return fixtures decode actual PNG headers and wait for a genuine running
cut before testing saved-flight protection. An inherited exact Classic handoff
failure reproduced on the clean baseline: boot-picture materialization raced the
requested original's media-generation write. The incoming action now joins its
captured boot operation while retaining its opening lease. Three controlled
held-original cases prove completion, newer-input retirement and an unavailable
initial picture; the requested picture still uses strict original validation.

The complete 13-case Versus Journey file passes, including 24 real mission clears
across opening/authored editions with exact tuned checkpoints, accepted artwork,
distinct mode receipts and retained final-result Browse/Back. Its earlier two tour
failures reproduced on the baseline using untuned routes. The four Solo/Versus
default core/optional ending cases also pass. The final five-case full file passes
with a real first-to-two match: 1:0 offers Next round without claiming a Journey
ending, Browse/Back retains both boards, score and artwork, and 2:0 offers the
completed-match ending and Rematch with a distinct accepted round receipt.

The six-case composite Couch input file passes after joining the actual catalogue
operation activated by keyboard/controller, rather than treating a five-second
cold inventory wait as the action contract. Focus, cancellation, retained finished
boards and exclusion of live controls remain asserted. No runtime timeout changed.

The full external-chapter host file passes 21 checks, including nested restoration
and recovery cases. Its two real-win paths use the unchanged approved authored
level under current Standard tuning, an independently stepped lossless route and
public replay verification. Exact original pins, retained earlier story bytes,
checked replacement, duplicate-award protection, cancellation, overlapping Retry
and recovery all remain asserted. Historical production routes are not rewritten.

The complete device/equipment cohort passes 22 checks with no skips. Tests now use
the visible current catalogue and required backup replacement review. The R5
Orchard Crossing capture uses legal current-speed boundary waiting and steering;
it still requires a greater-than-50% capture, three lives, stop-on-capture, HUD
updates and exact saved/replayed state. Equipment capability, roster/hangar,
held-controller, touch-modality and Undo assertions remain intact. An immediate
straight Down now loses a life under the already-shipped Standard tuning; UX3/UX6
must assess its teaching and human fairness rather than treating this route proof
as player-balance acceptance.

The complete continuous-host, modal-navigation and Studio-return cohort passes
79 checks. The Missions button returns its existing preparation operation so the
host test joins the real focused activation rather than assuming a five-second
cold-catalogue deadline. Immediate loading, retained run/checkpoint, paused state,
Home parent and exact Back focus remain asserted; no production timeout changes.

A hosted-only fixture checkpoint mismatch was reproduced in dedicated diagnostic
runs35947026034,35947207930 and35947544962 without changing game source. All twenty
Journey routes win and verify public replay within each runtime. Full-state
comparisons find tiny scalar differences in five routes. Three authored routes
vary only in twenty movement scalars (largest 4.2633e-14); Toolbench varies in one
enemy velocity. Dnipro additionally varies in a border perimeter and terminal
elapsed/result time, with maximum movement difference 7.71e-13. Discrete board,
ticks, status, lives, score and outcome flags agree. The other fifteen raw golden
checkpoints agree. Fourteen additional external, Sentinel and device routes also
match exactly across runtimes, including twelve fixed golden checkpoints.
JavaScript's relevant mathematical functions permit
[implementation approximations](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-math.cos).

The test-only correction retains the fifteen exact raw goldens. Each of the five
affected routes instead declares only its witnessed divergent scalar paths,
expected values and a fixed checksum of all remaining authoritative state. Scalar
comparison is bounded by 1e-12; path presence/shape and every unlisted field stay
exact. Only Dnipro needs the explicit terminal elapsed-time exception. This avoids
decimal-rounding boundaries without accepting an OS-specific hash list. As before,
event lists are outside the public authoritative checkpoint; this test change does
not expand that exclusion. Exact host/reference checkpoints, fresh public replay,
authored/gameplay identity and lossless outcomes remain required for every route.

Simulation, runtime checkpoint serialization and historical readers are unchanged.
This is not cross-platform replay certification: transferring an existing raw
recording between runtimes remains a separate UX5/UX6 compatibility risk. Portable
test evidence must never be used to admit runtime saves, replays or earned originals.

After correction, all 33 Solo/Versus/default-ending host tests pass. A final complete
rerun of the affected Versus/default consumers plus the helper's mutation/metadata
checks passes 46 tests with no skips; its eighteen host cases overlap the first
run. Independent review confirms only five route-specific exception sets (35
authoritative scalars), fifteen unchanged raw goldens and unchanged fixture inputs,
authored/gameplay identities and recorded timings. The final helper also compares
raw host/reference checkpoints after releasing the last key. This remains scoped
evidence, not a replacement for the final source's complete mandatory suites.

The next partial mandatory run exposed 24 additional failures across five files.
The recovery/chapter files reproduce all four failures on the unchanged baseline:
actor sprites are now drawn after the original, and the approved Standard recipe
is distinct from its authored map. Corrections verify the exact decoded original
at the background layer and compare both complete Versus runtime maps with the
approved adaptation. Both full files pass 26 checks.

The four secured-cut HUD failures also reproduce on the baseline. The approved
34-cell field crossing completes at tick 469, beyond the old 450-tick bound. All
eight HUD tests now pass with an independent pure simulation and exact checkpoint;
cue ownership, stop-on-capture, newer save notices and saved replay remain asserted.
The Journey actor file similarly reproduces its stale untuned route timing. Its
two tests now pass using the approved 469-tick lossless clear, exact host/reference
state and the retained original's SHA/object identity.

Four representative field-kit failures reproduce before UX0. The full revised
file passes 18 cases: visible Start and the actual asynchronous Missions action
exercise the current player flow, including nine saved-cut Back/input combinations.
Retired picker, guarded Deploy and craft-mount contracts remain isolated component
tests with one owner. Checkpoints, save contents, precise opener restoration and
explicit Resume stay required. A separate direct Start/Continue case was added.
One superseded CI initial-picture timeout did not reproduce locally; its existing
loading assertion was retained. These full-file runs cover 54 distinct checks and
do not claim an uninterrupted aggregate run or full mandatory-suite acceptance.

## Later host-suite reconciliation

The complete mandatory run is being allowed to finish before the next source push;
superseding it early hides later-file failures. The following corrections are to
baseline-reproduced fixtures, not changes to gameplay or a waiver of release gates.

| Complete local files                                           | Passing checks | Preserved contracts                                                                                                                               |
| -------------------------------------------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team campaign Next, Journey Next, originals and timed optional |             85 | Exact authored/current-tuned identities; real two-player input, artwork retention, reserves, progression, cancellation and timed no-pickup paths. |
| Starting setup, selection bookmark and terminal navigation     |             40 | Queued turn and saved checkpoint, explicit Resume, native editing, exact opener, legal victory and installed-library ending.                      |
| Historical Journey and title operation status                  |             15 | Historical receipts and backup authority, failed/stale preparation, decoded PNG dimensions, real Title Start/Continue and keyboard outcomes.      |
| Journey reactions                                              |              4 | Real lossless Solo/Team outcomes, reaction preferences, captions, accepted artwork and Next.                                                      |
| Whole-spatial and whole-field                                  |             18 | Exact edition/runtime identity, actual asynchronous library selection, approved speed and retained campaign-ending results.                       |

These counts describe separate complete-file runs, not one complete repository
test run. Three affected Team recovery cases were also rerun after adding an
explicit decoded-original guard; this is overlapping evidence, not three extra
distinct cases. Independent reviews found no removed ownership/outcome assertion.

The Team routes independently resolve 45 mission/preset combinations against the
approved tuning, then drive the real host through public direction inputs. All
are lossless; the nine timed variants avoid every pickup and require at least two
real returns per craft. Historical route files are retained. Team host evidence
compares the actual result, tick, coverage and reserves with the reference; it does
not claim an unavailable full hidden-state checkpoint comparison.

Tests for injected unregistered historical campaigns explicitly mount their
retained native chooser boundary after pausing the real host. They continue to
exercise original launch, profile, backup and cancellation handlers, but no longer
claim to traverse today's public catalogue. Registered current-content suites
exercise the actual visible Missions action. The title fixture now decodes real
PNG bytes rather than inventing 1×1 dimensions for a Blob URL. The disposed-page
fixture checks late storage callbacks and retained state without rendering an
already-destroyed Phaser scene.

Eight additional renewed Solo/Versus routes independently win and verify fresh
public replay on macOS and Linux. Diagnostic run35949614725 compares their complete
states: five raw checkpoints match; three differ only in fourteen witnessed scalar
fields. Sorting Yard differs in two enemy velocities; Cross-stitch Crossings and
Twin Lens Chambers each differ in player/enemy coordinates and actor time. The
largest difference is 6.04e-14. Their fixture evidence declares just these fields,
retains all other state exactly and uses the existing 1e-12 test-only bound. No
runtime validation or helper whitelist changes. Run35949941684 independently
passes all eight final Linux evidence comparisons, including lossless outcomes and
same-runtime replay. Historical untuned proofs remain separately checked.

The final complete sorting, timed and optional-variety host files plus the existing
route-evidence helper suite pass 46 checks with no failures, skips or cancellation.
Eighteen are host checks and 28 exercise evidence metadata/mutations. This includes
two four-mission optional tours per mode, safe Skip/reselection, retained endings,
failed artwork preparation, exact saved restoration and independently owned timed
bonuses. Together with the table above, this correction batch covers 180 distinct
host checks in separate full-file runs; it is still not full-source qualification.

## Current-host input, picture and edition follow-up

The next completed correction cohort passes 231 distinct checks in separate
complete-file runs. It does not replace the mandatory final-source run.

| Files                                                                  | Passing checks | Evidence retained                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Team default entry, pressure originals, timed host and timed originals |             83 | Thirty-three exact source/revision/preset routes; both pilots return, reserves and original image identity remain exact. All nine timed pickup routes collect once while the partner cuts, with at least two real returns per pilot. |
| Mode return and nonmodal header navigation                             |             90 | Actual Enter/controller activation, immediate loading feedback, opener focus, saved state, cancellation and foreground ownership. Tests join the real Missions operation instead of assuming it finishes inside five seconds.        |
| Fresh visual host                                                      |              8 | Real lossless opening clear, independent raw checkpoint/replay, retained artwork through Retry and failed Next.                                                                                                                      |
| Compact mission library                                                |             10 | Current-card initial focus and real Filters disclosure/control focus; no synthetic change to an unfocused control.                                                                                                                   |
| Host presentation size and mission selection focus                     |             11 | Actual PNG bytes and decoded approved revisions, native setup disclosure, retained selection/focus and unchanged gameplay geometry.                                                                                                  |
| Mission replacement                                                    |             25 | Legal current-speed pending turn, exact independent checkpoint, all Stay/Replace/save/cancellation guarantees.                                                                                                                       |
| Shared Versus Settings                                                 |              4 | Forward/reverse traversal includes the newly reachable reaction controls, exact opener and unchanged match state.                                                                                                                    |

Compact Filters and the Versus focus loop are expectation changes required by
UX0's corrected initial focus and newly reachable controls. Other reproduced
host failures came from older menu boundaries, image ordering or movement tuning;
they are not evidence of new gameplay defects. Team Depot's live pickup assertion
now checks the exact effect component alongside the separate incoming-pickup cue.
Its negative route remains running one tick before a real final return, then wins
on that deliberate public frame; historical pure-route proofs remain unchanged.

Mandatory run35948932471 targets pushed source a0369c021, before these corrections.
Its first completed shard reports 2,986 tests / 2,916 pass / 70 fail; the second
reports 3,018 / 2,934 / 84. These include failures already corrected in local
commits and further inherited fixtures still being reconciled. The other shards
are allowed to finish so later failures remain visible. No skipped or superseded
job, focused pass or unchanged-art inventory is counted as release acceptance.

Three more bounded groups now pass their complete files: Library launch and
Journey mode navigation (41), text size and touchscreen/controller hosts (24),
and the retained optional-chapter scenarios (30, across separate reruns). Library
queued-turn and earned-Gentle playback assertions now compare the actual current
recipe with independent exact checkpoints. PNG fixtures decode actual dimensions.
Backup text-size import explicitly accepts the real replacement preflight; it
does not bypass that safeguard. Modeled controller Missions opens the current
gallery, focuses its playable card and starts with one Confirm. The controller
suite still checks paused state, replay, neutral gates, disconnect and touch
handoff/rotation. Cold Classic picture readiness has a bounded 30-second CI
allowance before input assertions; it is not a performance acceptance claim.

The optional installer keeps download failure, checksum conflict, stale response,
storage failure, Stay, replacement and exact run/record assertions. Its historical
More chapters parent is explicitly mounted as a retained component boundary;
today's public catalogue entry is qualified separately. The current public
Missions/setup route is used where that is the scenario's purpose. No hidden old
control is described as a current player entry point.
