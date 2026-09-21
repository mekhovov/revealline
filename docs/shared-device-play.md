# Shared handheld play — implementation checkpoint

The September 21 device feedback is the immediate priority. This candidate is based
on source `17bd1965`, outside the frozen v0.76.1 correction. It is not a public release
or physical-device qualification. The prior side-HUD prototype is not the final design.

| Requirement                               | Current evidence                                                                                           | Remaining gate                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Same touch steering in Solo, Versus, Team | Shared stick/swipe/D-pad engine; independent seat fingers; common persisted preferences                    | Final native input journeys, exact visual/size parity, seat placement                          |
| Compact OSD                               | One 44px row in Solo portrait/landscape and Team landscape candidate                                       | Large text, all modes/maps and narrow Team/Versus; required warnings never lost                |
| Maximize complete arena                   | Visible-viewport fitting without fullscreen requirement; native 320×480 and 844×390 prototype measurements | Final source remeasure; wide authored maps, portrait Team, real browser bars                   |
| iPhone fullscreen                         | Existing capability gate, standalone recognition, rejection fallback covered                               | Physical Safari and installed Home Screen app; no claim that unavailable APIs can be enabled   |
| Steam Deck A launches                     | Actual mounted Solo host now starts through modeled A instead of button.click; passes                      | Reported physical failure remains unreproduced; cold discovery, mapping and device transitions |
| Production-ready input                    | Neutral gates, focus return, replay/pause preserved in tested host cohort                                  | Whole input journey matrix and real controllers/touch hardware                                 |

The HUD keeps a compact numeric life count. Very narrow Solo hides the score during
flight; full counters return on Pause/results. Team stronghold instructions are an
explicit additional row when needed. No UI reduction may change collision, simulation,
progress or replay identity. Font sizes still respond to Large text; this needs native
stress checks before acceptance.

Touch preference changes use `revealline.touch.v1`. Existing valid Solo preferences
are a fallback, not an automatic shared write. Explicit changes are shared across
modes. Unknown/invalid stored bytes survive reads; denied writes retain the visit's
valid choice. Campaign saves are not modified by this preference record. Each couch
seat has its own captured steering pointer; neither can release the other's pointer.
Browser-interrupted gestures pause, while ordinary finger release preserves movement.

## Next verification sequence

1. Finish visual and target-size parity; preserve separate seat ownership and abilities.
2. Native Solo/Versus/Team: Start → all three touch modes → cut → release → capture stop
   → fresh turn → Pause → Settings → Back → Resume. Include simultaneous fingers,
   held rescue, pointer cancellation, rotation and controller handoff.
3. Controller-only title/mission selection/Start/Retry/Next and every dialog. Keep the
   neutral-after-scope-change gate; do not remove it just to make a held A start.
4. Actual 320×480, 390×844, 568×320, 844×390, 1280×800 and desktop measurements with
   regular/Large text, phone safe areas, maximum counters and active warnings. Record
   actual viewport/DPR rather than requested override dimensions.
5. Real iPhone Safari and Steam Deck/controller checks; distinguish these from modeled
   APIs and desktop browser layout evidence.
6. Source gates, related hunk review, next unused version, source PR, frozen release,
   publication PR/Pages, public file inventory and affected journeys. Only then close.

## Research rationale

Apple's [game controls guidance](https://developer.apple.com/design/human-interface-guidelines/game-controls)
supports familiar input, reachable touch targets and safe-area-aware placement.
Steam's [device recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations)
call out mixed mouse/gamepad input problems. Test input handoff as a real journey,
not just individual button mapping. WebKit's [Home Screen app guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
describes standalone display; installing is optional, and ordinary browser play must
fit the visible viewport independently of Fullscreen API availability.

See `docs/verification/shared-device-play/status.json` for scope and retained failures.

## Second iteration: rendered layouts and compatibility

The couch surfaces now match Solo's 156px Regular / 192px Large targets, compass,
instruction and floating-ring feedback. Each seat still owns a separate finger.
Landscape Team uses floating corner controls and a full-height complete arena.
Tall portrait Versus docks each control below its own board; short layouts use
translucent overlays. Standard Team counters occupy a 44px strip; Large portrait
uses 74px so rescue and Support remain readable. Stronghold instructions retain
an additional authored-objective row. These are presentation sizes, not hitboxes.

Native checks caught and corrected a collapsed Versus arena row, an obsolete
first-player side column, overlapping Team badges, duplicate short-portrait top
padding, and Journey Missions/Skip buttons obscuring flight counters. Missions
and Skip remain available after Pause. The compact Solo coverage value retains
its target percentage. The result/header layout still needs its own narrow-screen
review; an active-flight pass does not establish every menu state.

The preference regression cohort also caught practice writing the shared record
and legacy restore/reconciliation failing to apply its steering hand. Practice
changes now stay in the visit. Before a shared choice exists, legacy profile
reconciliation and backup Undo remain valid fallbacks. Once a shared choice exists,
ordinary legacy imports do not override the choice made in another mode. An
explicit Solo change mirrors the complete current shared choice into its legacy
profile, without silently reverting the other fields. Denied shared writes show
session-only feedback. BFCache return resamples a newer stored choice without
writing or automatically resuming; unsaved/practice choices stay local.

Retained checks: 60 shared-input/fullscreen checks, 115 couch checks and 15 legacy
input/backup host checks on each of Node 20 and Node 22. An additional 60-test Node22 cohort passed after the target-label DOM annotation,
and ten shared checks passed after the callback error-boundary cleanup. Whole-source
qualification remains separate. Original failing
logs remain in `docs/verification/shared-device-play/iteration-2/`. The cold-title
A test initially assumed the default action was Missions; inspection confirmed it
is Start. The corrected test verifies actual Start, neutral discovery and no input
leak into flight; it is not evidence of a fixed physical Steam Deck defect.

Open production gates include narrow Large-control pairing, authored objectives
and encounters, all controller menu journeys, First Flight, embedded Studio and
real iPhone/Steam Deck hardware. The preview browser dimensions and test counts
must not be described as device certification. This remains an unversioned
candidate, not an accepted or deployed release.

The final short-landscape pass at 568×320 found desktop labels and catalogue
icons overlapping the numeric HUD, plus a more-specific legacy rule pinning the
status message above the arena. The compact rules now explicitly own these
properties. Native recheck retained a 512×256 complete board, 44px top strip,
156px control, and a bottom status message without document overflow. At 320×480,
Large current/target values share one 44px HUD cell; the complete board measured
296×148. Maximum counter values and long hazard messages still need stress checks.

The release controller separately accepted public v0.76.1 (source17bd1965,
source PR208, publication PR210, Pages35551436420). These new device changes are
not included in that public release. Plan reconciliation is owned separately.

## Third iteration: two-seat limits and launch journey

Team's shared Regular/Large sizes are preferred sizes. Below 400px in portrait,
they fit each seat's available width instead of stacking two control rows over
the entire arena. At 320×480, Large resolves to 154px per pad and D-pad buttons
measure 51.33px; the complete board remains 220.20×110.10 with Large text. At 568×320,
both Large pads remain 192px. Shared gestures, stored preference and seat ownership
are unchanged. Compact Team state labels now apply in landscape too. A native
D-pad check caught duplicate catalogue/text arrows; only the replaceable catalogue
arrow now renders when its presentation binding exists.

The expanded shared-input cohort passes 61/61 on both Node 20 and Node 22, including
controller-only Missions → Deploy → Pause → explicit Resume. This extends the
modeled input evidence; it does not reproduce or certify the physical Steam Deck
report. Short Versus, training, maximum counters, central hazard-caption clearance
with two Large pads, real devices and exact-source release gates remain open.

A broader Team picture-host check reproduced one stale storage-read inventory
(18/19 passed): the mounted shared-touch owner now also reads its preference key.
The correction adds only that key; display/menu-style write restrictions and all
picture/HUD continuity checks are unchanged. The complete affected picture and
shared-touch cohorts pass29/29 on both Node20 and Node22. Original failure retained.

## Fourth iteration: short Versus and First Flight

At 568×320, the older Versus width breakpoint stacked both arenas and authored
Journey navigation took a second top row. Active handheld Journey now hides Skip
and Find until Pause, preserves an optional save warning row, and keeps landscape
boards side by side. The untimed clock shows infinity while its accessible text
remains “No countdown”. Timed clocks retain their exact countdown text.

Native desktop-browser checks (DPR1, not physical touch certification):

- Versus 568×320: 44px HUD; two complete 270×135 arenas.
- Versus 320×480: 44px HUD; two complete 302×151 arenas; Large-preference
  pads fit each seat at 170×170, with 56.66px D-pad targets. They no longer cover
  the global Pause button. Empty equipment groups no longer reserve a gap.
- First Flight initially collapsed to a 30px-wide board at 320×480 because the
  course was excluded from handheld fitting while inheriting a touch-height
  reservation. Active training now shares the compact HUD and viewport; its
  current task stays visible and course selection returns on Pause.
- First Flight 320×480 with Large text/192px controls: 44px HUD, full 131.20×98.40
  board, readable two-line task and status, no document overflow. This smallest
  layout still needs a physical comfort review. At 568×320 the complete board
  measures 277.33×207.99 with the task above it. The first lesson cleared 52.2%
  with three lives after the direction control; lesson choices returned.

The affected 113-test cohort passes on both Node 20 and Node 22. Retained failures
include a stale test pressing a hidden D-pad (corrected to the visible stick), an
invalid untimed Legacy fixture (untimed assertions belong to the authored Journey
host), and missing sparse-worktree image dependencies (exact HEAD bytes restored).
Original failing outputs and final logs are retained with hashes. These checks
also preserve replay/checkpoint, pause, course progress and picture ownership;
they do not establish hardware certification or complete source qualification.

Final ordinary Solo recheck after sharing the course rules: at 568×320 with Large
text and 192px D-pad, the complete arena remains 512×256 below the 44px HUD;
at 320×480 it remains 296×148. Both documents fit the viewport. This catches the
old D-pad side reservation and high-specificity hidden field-condition width
rule; the handheld layout explicitly owns those dimensions. Rotation stayed
paused until explicit Resume. Further device/encounter stress checks remain.

## Fifth iteration: Team caption clearance and title readability

At 568×320 with Large text and two Large touch preferences, Team's old central
caption occupied the same space as both Support buttons. The caption now has a
full-width bottom strip; the complete board fits above it and controls fit their
remaining height. At this shortest layout, preferred Large pads resolve to 132px
with 44px direction targets. The shared preference itself remains Large. Boost
and Support stay distinct, labeled actions; Support receives enough column width
to avoid clipping. Long captions retain bounded scrolling and complete accessible
text. This is a readability tradeoff: one 44px counter strip plus a 53px caption
strip at Large text, rather than obscuring either controls or the board border.

The 844×390 Large-text title previously confined three mode cards to half of a
460px content column, producing roughly 66px cards and broken words. The title now
uses available width, keeps mode choices together before the menu actions, and
preserves scrolling. Cards measure 262.66×75.30px; keyboard Tab through the menu
reveals Workshop without activation. Very narrow mode cards use smaller side
padding without reducing text or target size.

A release review also found the handheld stylesheet bypassed Solo's guarded
startup. It now uses `data-boot-href`, joining the existing load/error ownership.
The build test uses its real CSS bytes, verifies reproducibility and checks its
exact offline inventory hash. Three build/boot checks pass on both runtimes;
the full boot, Team host, paused resize and shared touch cohort passes 107/107 on
Node 20 and Node 22. Final CSS finishing received another 3/3 boot-build run.
Missing sparse test dependencies were restored from exact HEAD, not replaced
with placeholder assets. Native startup still reaches the real title and play.

Research recheck: [Apple's game guidance](https://developer.apple.com/design/human-interface-guidelines/designing-for-games)
emphasizes platform-appropriate control sizing and menu behavior.
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens/)
recommends large, separated touch controls. This candidate preserves 44px minimum
direction targets in the tested short landscape. Hardware safe areas, browser
bars, actual fingers and controller comfort still require separate qualification.

Final geometry with Large text: First Connection has a 418×209 complete board at
568×320, and 558×279 at 844×390. Relay Yard keeps its mandatory objective visible;
at 568×320 the objective ends at 71.40px, controls begin at 75px and its complete
board measures 363.20×181.60. Boost/Support remain 44px tall; their labels fit 58px
and 70px-wide buttons after omitting only decorative icons in this short stronghold.
All measurements are desktop-browser overrides, not hardware certification.

At 320×480 with Large text, title mode labels remain single-line in 85.33px cards
and do not overflow; descriptions wrap naturally. The full portrait title still
scrolls, and its long online-artwork explanation remains a later entry-flow
polish item. This observation does not close the complete native-menu gate.

## Sixth iteration: reachable phone entry and authored controller launch

At 320×480 with Large text, the title's long online-artwork note placed Play at
722px, below the first screen. That note now follows the menu in the document;
its complete wording and availability logic remain. Narrow titles use a compact
single-line logo, retain chosen text sizes for controls, and omit decorative
slogans. Operation feedback and Cancel stay beside their existing owner.

Native browser overrides (not hardware): Continue is fully visible at y278–329
on 320×480, y245–296 on 568×320, and y154–205 on 844×390. On320×480, four Tab presses
from Continue reveal Workshop at y413–464; Enter opens it. Vertical scrolling
remains available for secondary actions and the original offline explanation.

47 title/continuation/candidate/input/boot tests passed on each supported Node
runtime. The expanded complete Journey-entry file then passed 9/9 each, including
two new opening/authored controller cases: held-A discovery cannot launch or grant
progress; fresh A after neutral starts First return; Confirm cannot move the craft;
Pause retains the tick and fresh A explicitly resumes. These cohorts overlap.
They extend modeled coverage, not a reproduction of the physical Steam Deck issue.

The actual Playground terrain preview was also checked at 1010×720 and 710×620.
Its complete running arenas measured 592×296 and 392×196 respectively; all seven
measured controls stayed inside the frame with a minimum 44×44 target. Explicit
Pause worked; Return to Workshop restored the Playground opener. These taller
layouts still reserve more HUD/control space than the phone landscape treatment;
this is not a claim of optimal tablet layout, physical touch, or all Studio flows.

New research reaffirms safe-area placement independent of browser fullscreen:
[WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
The [Steam Deck recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations)
also explicitly identify mixed controller/mouse lockout and changing prompts as
problems to test. Keep the hybrid input and physical-device gate open.

## Seventh iteration: hybrid input and readable encounter bands

The actual installed host now has three additional stick/swipe/D-pad cases:
a new touch direction supersedes a held controller stick; releasing touch does
not restore stale input; a fresh controller movement may take over. Interrupted
fingers pause, cannot resume through stale movement, and explicit A Resume
preserves a verified replay. These are modeled input tests, not physical Deck tests.

Native browser inspection reproduced a real warning-layout overflow: at1010×720
with Large text and hidden controls, the run notice ended at748.68px. Fine-pointer
warning-capable layouts now reserve space for instructions and notices before
fitting the board. At710×620, the complete arena is342.66×256.99, the instruction
ends at567px and the notice ends at616px. Plain/Large text and shown/hidden controls
retain the same arena geometry. At1010×720 the arena is476×357. A preliminary
prototype that also subtracted a full touch-pad height was rejected because it
made the board unnecessarily small.

Short landscape reserves one additional full-width instruction band only for
warning-capable missions. At568×320 Large, the staged Sentinel Relay arena is
239.99×179.99; the caption is544×56.80 and ends at316px. Its actual text lines end
before310px. The132px D-pad retains44px direction targets. At844×390 Large the
initial long shield instruction is fully visible below the complete field.
Ordinary compact Arcade boards keep their existing larger layout.

An old selector hid every phase named `open`; it now applies only to an idle
classic field, not the staged core-open instruction. Encounter phase notices carry
an explicit presentation cue: when the live encounter card already presents the
same phase information, short landscape suppresses the duplicate run notice.
Other notices retain their own presentation above the instruction band. Full
instructions remain in Field details. Native shield/warning/active cycles were
observed; actual core-open completion, long recovery notices, coarse-pointer
variants and hardware/browser-fullscreen variants remain separate checks.

The final four-file cohort passes29/29 on both Node20 and Node22 (hybrid host,
Field details host, boot/build and authored arena capability). Earlier overlapping
cohorts and one incorrectly broadened test assertion are retained in iteration-7
receipts; counts are not additive. No physics, scoring, campaign identity or old
replay branch changed. The full phase and public release are still pending.

The fresh primary-source review reinforces using dynamic viewport dimensions and
safe-area insets instead of depending on a fullscreen grant: [MDN lengths](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)
and [MDN environment insets](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env).
[Steamworks recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations)
explicitly call out hybrid-input lockout; that motivates the new handoff cases.

## Eighth iteration: portrait encounter space and real exposed-phase presentation

A real attempt on the unchanged Sentinel Relay lost a life to a lane attack;
there is no claim that its difficulty or complete win was qualified. A repeatable
layout probe was then authored through Playground: only spawn became (12.5, 0.5)
and moveSpeed became 16. A single Down command completed a legal 26.1% capture,
kept three lives and 4,580 points, captured the shield and reached stage 2. No
simulation state was injected and no campaign awards were granted. This is phase
presentation evidence, not acceptance of the original map's challenge.

The actual CORE OPEN instruction remained visible, but rotating the captured
probe into 320×480 exposed a separate portrait defect: touch-pad space and long
captions left an approximately 82×61 arena. Warning-capable portrait play now
uses floating controls and a stable authored instruction reservation. The full
arena measures 296×222 at 320×480 and 366×274.5 at 390×844. The selected Large text
remains; the top HUD is 44px and its current/target cell is 40px. Below400px the
current number and percent unit share one explicit grid row, with the target below;
this prevents 26.1% from wrapping into a third row while retaining both units. Short portrait bounds a
preferred Large pad to132px, retaining44px direction targets; tall portrait
retains192px. Preference bytes and the simulation are unchanged.

At568×320 the longer exposed-phase warning formerly touched the canvas border.
An additional8px reservation now leaves7.81px between the complete229.33×171.99
arena and its544×80.20 caption. The full four-line instruction stays in view;
phase duplicates are suppressed in portrait as well as landscape. Rotation
retains explicit Pause/Resume; visible captured coverage/lives/score were retained.

Six initial boot/build and authored-capability tests passed on each Node20/22 runtime.
The final cohort, including actual Journey entry and accessible capture progress,
passes16/16 on both runtimes.
The CSS bytes are covered by the reproducible build test; layout evidence comes
from actual browser screenshots and DOM/text bounds, not those unit assertions.
See iteration-8/native-observations.json for exact scope and source fingerprints.
Physical Safari/Deck, real safe-area/browser-bar behavior, long independent event
notices and full production/publication gates remain open.

The percentage also has an explicit accessible progress role, a label, range and
current/target percent text, updated after each real capture. The final visible
26.1% /75% pair fits79.20×40px; the current percent glyph remains visible at22px.
The [W3C pattern guidance](https://www.w3.org/WAI/ARIA/apg/patterns/meter/) distinguishes
bounded measurements from task progress; picture-reveal progress uses `progressbar`.
The actual opening Journey host verifies zero and a real capture, not only static
markup. The initial test incorrectly read an unsupported DOM-harness HTML getter;
its corrected assertion reads the visible text that the harness actually exposes.
