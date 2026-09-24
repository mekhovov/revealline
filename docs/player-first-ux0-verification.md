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

## Browser interaction evidence

Local source served through the ordinary queryless Solo and Couch routes:

| Evidence | Result |
| --- | --- |
| Solo keyboard, actual 1280×720 CSS viewport | Start focused at boot; Down reaches Missions; Confirm opens the current card; Down follows the next rendered row; Right follows that row; Back restores Missions. |
| Solo keyboard, actual 390×844 | Retained mission focused and visible; Right stops at the single-column edge; Down moves to the next mission. |
| Rotation to actual 844×390 | Same Two bays card remains focused at y=148.9–300.6, inside the gallery y=108.8–316.4. The pre-fix card was below the viewport. |
| Versus keyboard Settings | Tab reaches Character reactions; Space toggles it while retaining checkbox focus. |

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
