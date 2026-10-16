# Actor batch 6 — foreground contact and useful loss feedback

Parent source `92fa98912eb5b5509f30f12a200e91afb48fe851`, inside draft
[PR761](https://github.com/mekhovov/revealline/pull/761). This is a bounded source
candidate. It does not publish a release or approve candidate artwork.

## What changed

- A native raster review found Team still drawing a filled centre marker after
  the prepared body and outline. Prepared pilots now get one complete contact
  outline in the final foreground pass. Fallback markers remain unchanged;
  physical radius, player identity, simulation and recovery timing stay intact.
- The explicit **Fine outline** study narrows only the dark backing from three
  to two renderer units. Solo keeps its existing scaled coordinate convention;
  Team keeps CSS-normalized strokes. Bright width, complete circle and contact
  location stay fixed. Standard remains default. This option is not added to
  player Settings or accepted appearance pins.
- The playable comparison pauses and releases input on style changes, resets
  measurement segments, applies the choice only to the comparison painter and
  retains it on Retry. Its reference stays standard.
- Loss messages reuse existing localized cause/advice. Core events replace the
  message on recovery, capture and completion; ordinary ticks do not repeatedly
  announce telemetry. One live region owns terminal narration, and deliberate
  Retry retains existing focus ownership.

No new asset PNG, mission definition, collision rule, score identity, production
record, version or retained original is introduced. The new helper is included
in source dependency declarations so adoption cannot omit it from provenance.

## Native raster study and corrections

[Contact study](../rotor-motion/contact.html) uses real BoardPainter and Team
painters with decoded approved images or the separately verified v5 candidate.
Its copied static checkpoints are clearly labelled inspection fixtures. They
are not simulation playthroughs, earned completions or approved appearance pins.

The study checks omitted-versus-explicit Standard equivalence, exact contact
position/radius/full-circle/foreground order, bright-stroke pixels that survive
the final frame, bounded pixel differences, body position and frozen-state
preservation. It covers both painters, four headings, dark/light backgrounds,
interior/edge/corner/overlap and normal/reduced presentation.

Default Solo sizing skips exactly 24px. That diagnostic uses the existing
bounded props-style/player-scale settings on a 472px board, labelled calibrated;
the natural 23px/432px case is separately included. Default sizing is not changed.
The observer tracks exact renderer transform commands because native Canvas
matrix readback can round them before comparison.

Preserved failures:

1. [Original size mismatch](raster-original-failure.txt): corrected the diagnostic
   assumption, retaining an actual default-size case.
2. [Calibrated transform mismatch](raster-calibration-failure.txt): corrected the
   observer's rounded matrix readback, retaining strict logical geometry checks.
3. [Team final-marker failure](raster-team-geometry-failure.txt): found a real
   later filled marker. Corrected the renderer instead of weakening the
   two-stroke/foreground assertion.

The older 24/24 command comparison proved unchanged drawing before the Team
correction; it did not prove visual correctness and is not a final all-mode
unchanged-default claim. Final checked counts and hashes live in evidence.json.

The final source cohort passes **202/202 tests**, zero skips or cancellations.
The separate dependency check passes both selected sharing/missing-helper cases;
four unrelated script cases were not selected. Repository/scoped lint,
formatting/native formatting, validation and Motion Lab syntax pass.
The preserved pre-correction cohort was 198/198: its passing result did not
catch the later marker. New renderer regressions reproduce that failure and pass
after the correction. Final baseline comparison proves **12 Solo defaults and
six fallback Team** cases unchanged; **six prepared Team** cases deliberately
change to remove the duplicate cover. These overlapping counts are not unique
whole-game coverage.

The final native study checks **400 comparisons / 1,200 rendered frames per
source**, with approved assets and v5 separately. Each source compares **592
contact crops**, including both Team pilots, using **1,776 crop readbacks**.
Pixel identity/bounds refer to each native 64×64 contact crop, not the whole board;
overlapping pixels count separately. Body/geometry/foreground checks run for both
pilots. The earlier pilot-0-only result is retained as an intermediate scope.
Native Canvas width readback also rounded values; its observer now retains exact
renderer assignments through save/restore while retaining native readback and
actual pixel evidence. Tolerances and essential-cue checks were not weakened.

## Real play and layouts

Using actual on-screen steering in First Return, a direction reversal caused an
ordinary self-contact loss. The paused state had two lives at tick84 / 0.70s.
Its cause and useful advice fit at verified **844×390** and **390×844** CSS pixels,
with the whole board and steering controls visible in the single-view layout.
This is browser button interaction, not physical touch certification.

Resume completed recovery and changed the message to “Recovered. 2 lives remain.”
at the later paused observation tick1370. Continuing the same run won at
**tick1784 / 14.87s**, **34.3% / 30%**, **two lives / 8,160 points**. The earlier
failure did not contaminate the victory message. Loading status was empty and
Retry owned focus. Desktop steering buttons measured **52×48 CSS pixels**.
The final win screenshot is 1280×720 after the temporary viewport was reset.

Screenshots: [landscape loss](ordinary-loss-landscape-844x390.jpg),
[portrait loss](ordinary-loss-portrait-390x844.jpg),
[real recovery-to-win](recovery-to-win-desktop-1280x720.jpg).

## Release boundaries and remaining work

The public selector observed here remains v0.142.0. Main7138e7b contains merged
PR768 for the separately publishing v0.142.1. This actor branch remains an older,
conflicting draft. The publisher must preserve newer main UX/`themeFamily`,
FPV97/audio49 and immutable production history when adopting its accepted subset.

The inherited Team production-review gap remains open. This new final-pass
correction also belongs in an explicit reviewed successor fingerprint; no
production records were regenerated here. Integrated ordinary build, source
provenance, release checks, public bytes/play and cross-product regression remain
publisher gates. Long automated suites are waived, not passed. Whole-game
performance/offline, physical controls, listening, six-player pilot and wider
roster/artwork acceptance remain unfinished. Focused counts overlap prior batches.
