# Shared display preferences — P05-A candidate

This isolated candidate extends the existing Theme font/Plain, Standard/Large and
Reduced effects controls across Solo, Versus and Team. It is based on P02-A source
`f805300f8b9b3ca7fc7e106ea1398e8643477f5b`; P03 navigation work is separate. This is
source preparation, not a public release or completion of P05.

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

## Verification and remaining acceptance

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
No browser, device or visual acceptance is claimed by this candidate.

A final integrated source must receive its normal exact-source tests, static and
production-readiness checks before release qualification. This slice does not
regenerate producer output, amend recipe approval hashes, allocate a version or
change the publication controller.

## Reusable bounded journey

“Pause an unfinished cut, select Plain and Large, then enable Reduced effects.
Close Options without resuming and compare the exact saved attempt. Open Team and
Versus and reach each display control with keyboard and controller navigation.
Change one preference, return to Solo and confirm the shared result. Turn the
system reduced-motion preference on with the saved box off; explain the effective
state without rewriting storage. Deny a save and retain the visible session-only
choice. Finally resume explicitly and verify the retained attempt.”
