# C3 seven-class native roster review

The source-only `reference-v6` cohort contains fourteen native PNGs (6,240 encoded bytes; 143,360 bytes of decoded RGBA as a lower bound). Five equipment constructions are new: light carrier, interceptor, fiber relay, impact craft and trapper. Scout retains v5 and heavy carrier retains v3. Production registrations, compiled assets and all v2–v5 outputs remain unchanged.

`../rotor-motion/roster.html` loads the exact pinned v6 manifest, verifies five transitive construction-source fingerprints and checks all PNG hashes and decoded dimensions. It renders actual `BoardPainter` and `createCoopPainter` paths, including contact outlines, over isolated synthetic checkpoints. Team uses an explicit review-only pilot-image adapter; no Team class mechanics or approved release authority are added. Each native crop is copied 1:1 into a 64px tile, with occupied-size targets 20/24/32 CSS pixels and four headings.

The source and loader/painter cohort passes 56 tests across six complete files, recorded in `c3-roster-focused.tap`. Tests include all seven class identities, native silhouettes, unchanged rigs and previous bytes, equipment/rotor-disk clearance, source reproduction, exact image drawing, malformed dependencies, cancellation, late image disposal and reduced Team pose identity. Scoped lint and formatting pass.

## Initial raster finding

The first complete browser check used a default Canvas2D context. All 672 normal rotor frame comparisons changed and all 672 repeated-pose comparisons held, but 286 reduced Team comparisons had unequal pixel bytes. The exact live report is preserved in `c3-roster-initial-raster-failure.json` (SHA-256 `bc6f4712898cb162b20a5c9712a003ff73c7aa3be4c698c39092049669024ad2`).

A separate command observer compared the first failing Scout/compact/Team/20px/north case: the final 3,039 drawing operations and assigned state were identical. The sampled actor frames also matched, including `reduced: true`, `rotorPhase: 0`, heading, bank and body offset. The new complete-painter test additionally checks reduced actor-frame equality across all roles, treatments, sizes and headings.

Selecting `getContext('2d', { willReadFrequently: true })` for the study's native backing canvas, matching the earlier contact review, removed those byte discrepancies. The final-source browser run reported 672 changed rotor frames and 1,344 retained/reduced poses, with zero failures; its exact report is preserved in `c3-roster-final-raster.json`, with source fingerprints in `c3-roster-final-source.json`. No simulation clock, rotor rule, production renderer or candidate art was changed to obtain this result. This establishes stable CPU-readback source-study evidence; it does not establish GPU-backend or physical-display equivalence. The underlying accelerated-raster byte discrepancy remains a qualification concern, not a diagnosed gameplay motion defect.

## Visual and acceptance limits

Manual Solo/compact/dark and Team/detailed/light/reduced views at 1593×1179 CSS pixels, DPR 2, show attached, correctly centred large rotors and different equipment silhouettes. The Team review retains its normal player-number cue; these are actor-centred crops, not a layout review of that cue. At 20 CSS pixels the standard contact outline still dominates several central details; this source cohort is not production art approval. Full-board contrast, edge/overlap situations, public play, physical hardware and broader performance remain separate acceptance work. The human C2 comparison is not a dependency for this source implementation.

Earlier evidence and assets are retained. The first interrupted check stopped on page visibility loss and is not counted as a failure or pass.

## Next bounded adoption path

Reconcile into the publisher's current Field Kit97 production ledger and retained
output, not this branch's older93 ledger. Intake the fourteen exact v6 player
body/geometry records through the production theme producer, append new reviewed
asset/theme revisions, and retain every historical source and compiled asset.
Existing sprite producers and earlier v2–v6 candidates should remain immutable.

Default Team pilot recipes already inherit Scout; they need no invented Team
class mechanic or replacement of all48 state slots. Explicit custom Team images
retain their own bindings. The six-rotor Carrier adapter in this review is not a
production Team slot: current Team pilot validation requires four anchors.

Before approving those bindings, compare the already implemented Standard and
Fine outline options on all seven classes over actual boards, keeping the
complete contact circle, radius and draw order. This is necessary C3 art/state
review, not a new C2 human-retention experiment. Include edges/overlaps and
20px visibility, current main consumers, retained Retry/Continue and custom
Team artwork. The source/rig checks alone cannot decide visual acceptance.
