# Detailed organic destruction follow-up — 20 October 2026

Local preview changes in `go_test_radio_fix`; no commit, push or publication.

## Changes

- Current characters retain twelve persistent body regions, with shaped torso and limbs, hands/fingers, boots, helmet, straps, clothing and military equipment. Cut faces have layered tissue, recesses, folds and paired forearm/shin bones.
- Realistic r2 retains its immutable source artwork, textures and wound caps. Attached raised tissue, bone and torn-edge details add depth. Ultra includes more wound layers.
- Directional jets, heavier drops and delayed fine spray replace uniform bead bursts. Pools have darker centers and irregular edges, spread over time, and form at actual settled body-part contacts as well as the original hit.
- Blood, Brutal and Remains remain independent. Extra cosmetic detail uses existing shared pools; whole body regions take priority when the budget fills.
- Auto reduces visible density under sustained pressure while retaining the selected detailed character artwork. Explicit Performance graphics still uses its simpler overall graphics tier.
- Local attachment rotations now render correctly. Root support bounds include those rotations and are recomputed when optional detail is omitted.
- Detail variants consult shared settled poses rather than stale variant-specific moving counts. Blood support caching uses world coordinates and avoids new checks while paused. Individual validated footprints remain visible while the bounded support queue checks other pieces; changed contacts require new validation.

## Observed local configuration

The user's newer SIM tab had Quality graphics, Ultra destruction detail and all three gore settings enabled. Realistic was selected, but the optional pack was missing, so Current art was active.

The existing verified r2 pack was downloaded through the SIM's normal control. After refresh, Realistic remained selected and the missing-pack/download prompt was gone. Radio calibration and saved attempts were not changed.

## Browser inspection

The isolated preview uses production presentation code and the actual r2 GLB. It does not run aircraft physics or change the player's saved radio/SIM profile.

- All 36 r2 family/cast identities passed complete-cluster and draw-budget checks at High and Ultra, inspected after three seconds of cosmetic settling.
- A representative Ultra courier produced twelve visible regions, 80 settled instances, twelve blood marks, eighteen effect draw calls and no pending fragments.
- Eight Blood/Brutal/Remains combinations retained the logical defeat record. Rebuilding and restoring produced no renewed burst and retained twelve authored regions.
- Close Current and Realistic views were inspected. [Realistic settled detail](overhaul-organic-detail-realistic.png) is an actual browser capture.

The images remain stylized character art. This follow-up does not introduce a newly sculpted photorealistic asset pack. Earlier long performance receipts predate these visual additions; sustained performance and the deferred human/radio qualification remain separate.

## Final verification

- **60/60 automated presentation checks passed**, covering recipes, batching, settings, contact-bound pools, recentering, recovery and Auto pressure. The contact comparison allows 0.15 mm because archived coordinates are quantized to 0.1 mm.
- Changed production/test sources pass lint and formatting. `git diff --check` passes.
- The generated application runtime matches regeneration byte for byte: 42 modules, 24 recordings, 1,338,830 bytes. The local SIM was refreshed with this build.
- [Final package measurements](overhaul-organic-detail-packages.json): Worlds runtime is 208 files / 19,123,324 bytes; source is 210 files / 19,173,550 bytes. Source-input headroom is 656,057 bytes. Academy remains within its independent policy.
- [Validation receipt](overhaul-organic-detail-validation.json) binds these checks to the final sources and distinguishes browser observations from performance qualification.
