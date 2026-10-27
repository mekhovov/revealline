# R7 material and enlarged-control continuation — 15 October 2026

Orchard Workshop now separates planed light timber on panels from paper in reading wells and input fields. Its new deterministic 384 × 256 grain uses sparse, irregular growth lines instead of repeated curved knots. Moonlit Grove keeps its original waxed timber and inset recipe. Flight Deck and the other material recipes are retained.

## Evidence

- 94 focused theme tests and 61 SIM/World appearance tests passed (155 total).
- Grain, bootstrap and embedded SIM presentation generation checks passed; changed JavaScript lint and formatting checks passed.
- [Native Safari runtime checks](runtime-checks.json): all 18 existing families passed action semantics, field semantics and close-up geometry checks with Large text at a 677 CSS-pixel viewport. Orchard also passed high contrast, reduced motion and decoration Off, for 21 checks total.
- The close-up fixture now reports horizontal overflow, content clipping and targets below the resolved player/Studio size. Native scrolling field values are excluded from label-clipping checks. A regression test exercises the failure cases.
- [Before](orchard-before.jpg) and [after](orchard-after.jpg) native-window captures show Orchard's material treatment. These are resized review images, not pixel-contrast evidence. Browser zoom was restored after testing.

## Limits and remaining qualification

677 CSS pixels came from desktop Safari zoom, not a physical mobile device. The checks cover the shared specimen controls, not complete player or Studio journeys, translated copy, keyboard/controller navigation, sightlines, frame time or worst-region texture contrast. The full local game remains password-gated. No complete R7 or release acceptance is claimed. Native capture/control briefly failed during review; only successfully observed results are recorded.

Tryzub, Neon and Moonlit were reviewed visually with their existing material identities retained. The other families passed the new layout/state diagnostics; this does not replace their remaining full-screen visual review.
