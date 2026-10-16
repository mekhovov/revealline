# Actor batch 12 — complete useful C3–C6 slices together

Parent source `5253247e774a2bd5cb7a6ddc0bfed8c0311095e9`, draft PR761.
This is a compatible source batch, not a public release or whole-phase acceptance.
Current queue and estimates are in the [29 September register](../../plan-status-2026-09-29.md).
One publisher owns reconciliation, versions, approvals and publication; C2 remains last.

## C3 — recovery is relocation, not high-speed flight

The real Team core can down and revive both players within one step, without an
observed downed frame. The previous adapter turns toward spawn and derives an
incorrect speed from relocation. A first grace-only fix passed its immediate
cases, but independent review reproduced another failure across ticks 24→31:
starting a new unsafe cut clears grace before the renderer observes it.

The final adapter uses current grace and the existing durable reserve decrease /
rescue-count advance. When the seat is no longer observable, it conservatively
holds active pilots' cosmetic motion for one sample; repeated paints at the same
tick are stable, and the unaffected partner resumes on the next core tick.
Reserve pickup increases do not trigger it. No core, timing, collision, imagery,
geometry, pin or score changes. This does not reconstruct arbitrary missed histories
whose counter changes cancel each other.

[Final cohort](team-recovery-final.tap): **134/134**. [Pre-fix adapter](team-recovery-baseline-final.tap):
28 failures / 1 pass against the final new test file. [Intermediate grace-only gap](team-recovery-grace-only-gap.tap):
6 failures / 21 passes. Both failures remain evidence, not passes. Tests use both
actual arenas, difficulties, ordinary/reduced/zero motion, skipped frames,
single-seat recovery, reserve pickups and unchanged paired core checkpoints.
Independent final review found no further blocker in this bounded correction.

[Native renderer review](../rotor-motion/team-recovery.html) was checked in Chrome
at 1593×1179 CSS pixels, zoom 1: [normal/dark](team-recovery-durable-normal.png) and
[reduced/light](team-recovery-durable-reduced-light.png), both pilot crops, initial
heading retention and subsequent movement. No console errors observed. These are
finite core/renderer scenarios, not full missions or physical-device checks.

## C4 — teach the optional rules actually enabled

Compiled scout/sentry candidates lost their authoring lesson because design metadata
is not playable scenario data. Ready cards and Mission brief now derive concise
counterplay from enabled `combat-patrols.v1` roles. They distinguish removable
bracketed robots from dangerous round keepers and explain locked sentry aim,
evasion/early closure, and projectiles that survive into recovery. Full authored
prose remains intact; absent/off/empty/unsupported variants retain prior output.

[43/43 focused checks](combat-brief-final.tap) include actual EN/UK practice-host
copy, unchanged scenario/storage, both steering policies and verified replay.
Real traces lock at tick 240, fire at 360 after a direction change and keep a live
recovery shot at 380; an alternate legal return at 318 cancels before firing.
The [missing-guidance failure](combat-brief-before.tap) is preserved.
Independent source review found no blocker. Native/controller/fairness qualification,
paused Field details and dedicated optional Field Guide lessons remain open.

## C5 — corrected Poltava native derivative and exact round trip

The [revision 7 cohort](../../../authoring/library/community-art-cohort-v2/board-candidates-v1/README.md)
contains one new native Studio PNG at 1152×576 plus its full immutable candidate
manifest/provenance. All eight prior records and PNG payloads remain exact.

Root IAB imported the single r6 `.rlart`, selected the revised source and created
its whole-picture wide derivative. Export reported a prepared packet. Both automated
download-event waits timed out, but the browser had saved the actual file in Downloads.
That file was independently strict-imported/re-exported byte-for-byte and natively
reimported, with decoded 1152×576 image, exact parent/hash and revision 7. See
[prepared export](poltava-native-r7-offered.png), [native reimport](poltava-native-r7-reimport.png)
and the cohort's hash verification. The earlier worker browser/permission limitations
are separately retained; they do not establish a Studio failure.

Pixel-grid consistency, cultural details, readable gameplay contrast and production
binding remain open. No current mission, approved slot or earned original changes.

## C6 — inspect travel response independently

Motion Lab adds Follow arena / Idle / Cruise / Boost / Slow to its enlarged
inspection. Both the attachment phase and painting use that same selected ratio.
The real arena, steering, clocks, pending edits, stored profile and exported recipe
bytes remain independent. Changes redraw while paused but do not resume/rephase.
Reduced effects and hidden-page interruption retain existing ownership. Slow inspection
still caps rotor speed; lights and pulses still ignore travel.

[103/103 checks](motion-inspection-final.tap), including the actual app, pairs of
unchanged arena/export traces, lifecycle, new explicit build inclusion and EN/UK
labels. [Independent focused review](motion-inspection-independent.tap): **77/77**.
Cohorts overlap; do not add their counts as unique coverage.

Native Chrome showed visible long Boost versus short Idle exhaust with Play and
0.0 arena speed retained. Root IAB additionally checked a visible focused 44px
control in English and 46px in Ukrainian Large, with the actual paused arena and
short idle exhaust. Requested 1280×800 yielded **1280×757 actual CSS pixels** in
IAB, so this is not claimed as an exact 1280×800 check. Screenshots:
[English Boost](motion-inspection-handheld.png), [Ukrainian Large Idle](motion-inspection-uk-idle-final.png).
Shared English/Standard preferences and viewport override were restored afterward.
Earlier root captures before explicit keyboard Pause or selector commit are retained
as intermediate observations, not final paused/Idle evidence.

## Source and release limits

Lint, formatting, native formatting, validation and Motion syntax pass. The final
Team correction has fresh scoped lint/format and the 134/134 cohort; ordinary build
and all packaged bytes are checked in the accompanying build record. Raw focused
logs are retained in `raw-logs.zip` with hashes; readable copies trim trailing spaces.
An initial guard invocation named the wrong companion path and ran only the two
Team tests (1 pass / 1 fail). It is not the complete production guard. The corrected
two-file production guard remains **6 pass / 2 fail**:
changed Team sources require new reviewed successors. Preserve old evidence;
do not weaken the assertions or rewrite historical approvals.

The full long test suite remains waived under the committed temporary policy,
not passed. No publisher, tag, version or release mutation occurred in this batch.
Public player play, hardware, comprehensive offline/performance and whole-roster
acceptance remain with the integrated release and later qualification.

Maintainer prompt: “Preserve exact current actor/artwork identities. Reproduce a
same-tick Team recovery and the grace-cleared render gap; prove that relocation
cannot become flight and subsequent controls resume ordinary presentation. Verify
optional-role lessons against real locked-shot and return-cancel traces. Exercise
inspection-only travel response while paused/reduced, edit and export unchanged
recipes, and inspect the native Poltava packet round trip. Keep source candidates,
production successors, public evidence and physical-device claims distinct.”
