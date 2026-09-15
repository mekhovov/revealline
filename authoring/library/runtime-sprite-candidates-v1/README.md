# Runtime sprite candidates v1

Fourteen **source-only** 128×128 PNG derivatives: seven current FPV enemy bodies and seven current Ukraine player bodies. The 14 files total **920,318 bytes**. They derive from the exact selected 12,396,181 bytes of original artwork at `e9928cdaad2f55d912aadd2ef25f635fb99e938c`, using compiler `386a851716363693c2bdeda903cd4160d58b1c50`.

These are smaller representations of existing artwork, not new originals, new characters, finished animation sets or adopted runtime assets. Game descriptors, presets, historical media/earned identities, originals and frozen releases remain unchanged. `bindings.json` records the proposed correspondence only; every entry has `runtimeAdopted:false`.

## Reproduce and inspect

Use the exact compiler revision and pinned `input.json`, following [the sprite tool](../../sprites/README.md). Compile into a **new** output directory; never overwrite this cohort. The producer ran the ordinary compile and complete verify commands. Verify regenerates the manifest and PNG bytes from the originals. Utility qualification is six synthetic cases on each Node runtime, separate from this real-art inspection.

`export/manifest.json` records byte and decoded-pixel SHA-256, parent identities and generator source hashes. The recipe preserves the complete square frame and all sampled RGBA channels, with no crop, palette reduction or blending. It samples the source pixel at the center of each destination pixel and uses the compiler's deterministic PNG encoding.

`inspection/inspect.py` independently decodes all 14 parents and outputs using Pillow, checks the closed output PNG chunk sequence and CRCs, verifies the original Git blobs, compares every output sample with its parent, and checks the e992 role/skin/appearance bindings. Its recorded result is `inspection/png-inspection.json`. Run it from the repository with a Python environment containing Pillow; it prints JSON and does not write or re-encode an image.

All 14 outputs pass that inspection. Each is RGBA8, 128×128, 65,737 bytes, with exact recorded file and pixel hashes. All use full-frame center pivot `[0.5,0.5]` and assumed north heading. The normalized frame remains unchanged; this does not calibrate a mechanical attachment or certify the depicted orientation.

The outputs retain 2,377–5,677 distinct RGBA values, not a limited palette. Border Patrol retains edge alpha up to 2; Claimed Rover and Eroder retain edge alpha 1. The other outputs have fully transparent outer edges. Nearest sampling can omit faint source fringes and thin details; matching hashes is not visual acceptance. Exact nonzero-alpha bounds, parent pixel hashes, existing motion/wing recipes and frame/binding hashes are recorded per image.

## Visual comparison

`inspection/index.html` and `review.mjs` use an explicitly mapped local comparison server: 14 original routes, 14 candidate routes, one retained Orchard Crossing backdrop, HTML and script. They do not fetch arbitrary files or change the game. Compare the two images at 16/20/24/32/56/128 CSS pixels, cardinal headings, and black/revealed/light backgrounds. Both figures use identical stage geometry and a shared caption height; this avoids mistaking wrapped labels for a pivot difference.

The review is a static-body comparison. Existing procedural wings, highlights, warning overlays and actual game/Guide painters are absent. Parent-operated browser screenshots remain in cache, outside this cohort. The final twelve eligible captures and observations are recorded in `provenance.json`. The first `final-ukraine16-black.jpg` capture was stale at 128px and is excluded; the settled replacement supplies that observation. An early 128px screenshot preceded the caption-alignment correction and is not evidence of an anchor change.

The parent operated the browser and reviewed the captures; an independent reviewer viewed all twelve full screenshots. At 128px, the broad silhouettes and full-frame placement are preserved, with expected sampled-detail differences. At 16–20px, both originals and candidates lose role detail: thin FPV rotor rings and Atlas chest/basket/bell shapes can blend into a revealed picture. The 24px light, 32px black and 56px picture views distinguish roles more clearly. These six combinations per group cover static North/East/West views, not every setting or live motion. This accepts the compiler outputs as source candidates only. A future runtime adapter must preserve role outlines and contrast, use suitable display sizes, and qualify actual gameplay; it must not promise 16px readability from these captures.

## Requirements for a future runtime adapter

- Add a separately reviewed, versioned derivative record with exact parent and output hashes, byte/dimension bounds, full-frame transform and decode validation. Keep the original body/presentation ID and historical source identity distinct from the transport file.
- Preserve manual/uploaded-image precedence, explicit non-FPV skins, the canonical Ukraine class-map guard and eligible appearance selection. An unrecognized or damaged derivative must use the existing honest fallback; do not silently fetch the full original and erase the expected byte saving.
- Preserve enemy active-type leases, cancellation, late-decode disposal and player image lifetimes. Use the same accepted body in the Guide and flight, with their existing display sizes.
- Keep normalized wing roots and existing motion recipes aligned to the unchanged frame. Do not overlay moving blades on baked blades or describe surface glints as mechanical animation. Qualify paused/reduced effects and actual small-size poses separately.
- Do not change collider size, movement, classes, abilities, rules, save/earned records or media SHA identities. Ordinary builds should copy approved outputs rather than generate artwork.
- Measure actual package, offline/core and Pages totals after integration. This source cohort does not claim shipped bandwidth savings, browser memory reclamation, native-device readability or complete gameplay acceptance.
