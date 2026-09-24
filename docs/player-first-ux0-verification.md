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
its complete shards remain pending at this checkpoint. Later working-tree
corrections require their own exact-head checks before acceptance.

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
