# Shared display preferences — P05-A candidate

This integration composes the existing Theme font/Plain, Standard/Large and
Reduced effects controls onto final P03 source
`3acce1941116d18f9e86dcfa26dea463433cd3b2`. It applies only P05 commits
`4700120`, `f047a46`, `6e1040b`, `0283677` and `5d3560e`; the older audio parent
is not imported. The original P05 candidate began at P02-A source
`f805300f8b9b3ca7fc7e106ea1398e8643477f5b`, and its evidence below remains
historical. The scoped combined-source tests and desktop keyboard observations below are complete; this is not a public release or completion of P05.

## Current P03 integration

The current Title Start/Continue and three-mode row, Missions v1/v2 returns,
Library launch decisions, checked departure/restart/replacement owners, Couch
initial focus and common mode rows remain intact. Each host adds one display
authority to its existing lifetime. Team retains its immutable retry recipe,
discard decision and `suspend()` path on pagehide; nonpersisted pagehide also
releases display alongside audio. The sole textual host conflict was resolved by
combining these responsibilities, not replacing the newer Team host.

The pure display module, its unit tests, painter/font changes, compact
confirmation rules, unavailable-action styles and historical evidence come from
the five named commits. Combined host assertions also cover the first visible
Options control: Text style now receives initial focus, while Back retains the
actual Options opener and a paused round. No P08 picture/import/Start-intent changes,
compiled assets, recipe approvals, version or publication changes are included.
The [combined verification record](verification/cross-mode/p05-p03-integration/README.md)
keeps new results separate from prior P05 and P03 evidence. Fourteen complete files
passed on Node 20; Node 22 uses the unchanged-file passes and affected-file reruns
listed there. Root observed 17 desktop keyboard events across two explicitly
pinned preview sources, including shared preferences and the corrected Options
focus. Later P03 operation-focus work is absent from this baseline. P05-B menu palettes and static ornaments remain separate implementation work.
Standard/Large presets alone do not prove 200% scaling or menu reflow. Measure actual text, focus and controls at the
required viewports; keep the two-dimensional arena separate from surrounding menus.

## One display record

`game/display-preferences.mjs` owns the origin-local `revealline.display.v1`
localStorage record. It accepts exactly `textFace` (`pixel` or `plain`), `textSize`
(`standard` or `large`) and boolean `reducedEffects`. The compatible `pixel` value
still means Theme font. There is no new profile schema, theme asset or simulation
setting.

A valid shared record takes precedence. Without one, Solo adopts only these three
validated legacy profile fields in memory; older profiles retain their omitted-field
defaults. Versus and Team use defaults until a shared record exists. Startup,
legacy adoption and system changes never create or rewrite a saved record.
Delayed legacy adoption cannot supersede explicit display intent or a shared
record. Invalid or unavailable shared storage falls back without overwriting its
raw contents.

An explicit control change applies immediately, then attempts to save the three
fields. A storage or writer failure leaves the page usable and announces a
session-only result beside its controls. Solo retains its existing practice,
recovery and profile-writer guards and mirrors explicit changes through its legacy
profile writer; those two storage writes can fail independently. Versus and Team
never write the Solo profile, checkpoint, scores or pack preferences. A valid
storage event is accepted only from the current storage object and current record;
an unsaved local choice is protected from a later event until a new explicit save
succeeds. Terminal page disposal removes its subscriptions.

## Effective reduction and rendering

The effective Reduced effects value is the saved choice **OR** the current system
`prefers-reduced-motion: reduce` preference. The checkbox shows the raw player
choice. When system reduction remains active with an unchecked box, nearby text
explains why. System changes update rendering and DOM transitions without changing
the raw record or its intent revision. This candidate offers no override of a
system request for less motion.

All three hosts apply the same body attributes and use effective reduction for
their existing painter paths. Solo also passes it to Field Guide, celebration and
story presentation. Reduction preserves essential Team target, Support, slow and
recovery cues. It does not change simulation timing, scoring, collision, queued
turns, capture behavior or enemy difficulty.

Plain overrides the existing Field Kit display/interface/numeric font roles,
including release inline tokens. Theme font restores those roles. Team's painter
uses the existing interface/numeric font selector; its continuing frame redraws
allow locally loaded fonts to replace fallback text. Team HUD labels and counters
use the existing semantic size tokens. Standard/Large affects interface text;
it does not scale the arena, actors or collision geometry. This is not the full
Team art/palette adapter planned for P08.

## Historical candidate verification and remaining acceptance

The new adapter cases exercise strict fields, legacy and explicit authority,
storage identity/failure, late events, system changes, reentrancy and disposal.
The actual-host cases exercise both Solo turn policies during a paused unfinished
cut, exact checkpoint/session retention and valid continued replay; cross-page
restoration; keyboard/controller access to real Options controls; effective system
reduction; and a denied save. Team uses its real host/core/painter with a finite
Canvas boundary. These cases do not replace native browser inspection.

Local focused verification on Node **20.19.5** and **22.22.2** passed **113/113**
cases on each runtime across these ten complete files:

```sh
node --test game/test/display-preferences.test.mjs game/test/display-preferences-host.test.mjs game/test/text-face-library.test.mjs game/test/text-size-library.test.mjs game/test/text-face-host.test.mjs game/test/text-size-host.test.mjs game/test/presentation-renderer.test.mjs game/test/coop-host.test.mjs game/test/couch-navigation.test.mjs game/test/couch-audio-master.test.mjs
```

The six Settings/surface cases also passed on both runtimes:

```sh
node --test --test-name-pattern='^(settings categories|leaving Controls|settings tabs|data and collection|supporting page|surface copy)' game/test/field-kit-surfaces.test.mjs
```

The remaining surface case enumerates the complete packaging namespace. The
initial whole-file run stopped that case at an absent sparse-checkout pack; it is
not counted as passed. The separate earlier host bootstrap stopped at a missing
4,170-byte existing MP3 fixture, which was restored exactly from the base commit.
Both initial diagnostics are retained locally. No asset bundle or build was made
for these checks. Lint, formatting and whitespace checks passed for this slice;
these focused results are not the full release gate.

Before accepting this subphase, inspect all three modes in both text faces and
sizes at desktop, narrow portrait and short landscape. Confirm locally loaded
fonts, complete text, visible focus, scrolling, pause actions and 44px touch
targets after reflow. Verify the real system preference and a second page's
storage event, including a denied save. Resume must remain explicit. Keep
physical controller, touch-device and assistive-technology evidence separate.
The [scoped native preference journey](verification/cross-mode/p05-a/README.md)
records keyboard selection and Solo→Team→Versus→Solo restoration at the desktop
preview. Team only started and paused at 0:00. It does not close the remaining
viewport, system-toggle, storage-event, failure or physical-device checks.

A P08 delayed-picture observation found Versus Start correctly disabled but still
bright yellow like an enabled primary action. The [disabled-control correction](verification/cross-mode/p05-a/disabled-controls/README.md)
now gives unavailable Couch actions the shared muted/panel colours and dashed
border. Native loading and ready observations retain the same 48.5px target:
Start returns to its accent style only when enabled and remains keyboard usable.
This is a scoped visual correction, not an input change or complete P05
acceptance. Those observations predate the current P03 common mode rows. Broader
primary-action hierarchy and physical/compact-device checks remain open.

A final integrated source must receive its normal exact-source tests, static and
production-readiness checks before release qualification. This slice does not
regenerate producer output, amend recipe approval hashes, allocate a version or
change the publication controller.

## Compact confirmation layout

Short confirmation dialogs opt in with `restart-dialog`, independently of their
element ID. They use content height, a 460px width cap, safe-area viewport limits
and scrolling when their copy or Large text exceeds that height. Actions remain
stacked with the existing 50px minimum target. Title, Missions, Collection and
other full-screen panels retain their layouts. For a new confirmation, inspect
actual Standard/Large text in desktop, narrow portrait and short landscape;
reach both actions by keyboard and scroll, and check the visible safe focus and
return to the opener. CSS source checks do not establish native layout or touch
device acceptance.

The first combined native preview confirmed compact mission replacement and
unchanged Missions sizing, Tab wrapping and Escape return. It also found that a
later Field Kit rule reduced the confirmation actions to 44px. The narrower
action selector now outranks that rule. The [scoped desktop successor check](verification/cross-mode/p05-a/confirmations/README.md)
measured 50px actions in Standard/Large mission replacement and Restart, with
Tab wrapping, Escape opener restoration and the flight still paused. The
original 44px observation is retained. Portrait, short landscape, zoom and
physical-input checks remain open; this does not complete P05.

## Reusable bounded journey

“Pause an unfinished cut, select Plain and Large, then enable Reduced effects.
Close Options without resuming and compare the exact saved attempt. Open Team and
Versus and reach each display control with keyboard and controller navigation.
Change one preference, return to Solo and confirm the shared result. Turn the
system reduced-motion preference on with the saved box off; explain the effective
state without rewriting storage. Deny a save and retain the visible session-only
choice. Finally resume explicitly and verify the retained attempt.”
