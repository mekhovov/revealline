# Demo picture concealment — 2026-09-28

**Historical treatment:** this palette-only mosaic was subsequently replaced at the user's request by the more recognizable [analog-signal teaser](demo-picture-signal-2026-09-28.md). The checks and screenshots below describe the earlier mosaic, not the current output.

This follow-up replaces the recognizable light blur in the earlier [demo verification](demo-mode-2026-09-28.md). It uses the existing `clear | blurred` renderer policy; `blurred` now selects a palette-only frosted mosaic. Exact earned-picture access, reward isolation and original image assets are unchanged.

## Decision and implementation

Blur and pixelation preserve scene layout. [MIT's Tiny images report](https://people.csail.mit.edu/torralba/publications/TR_tiny_images.pdf) demonstrates strong scene recognition at very low resolution. [Wolt's BlurHash](https://github.com/woltapp/blurhash) demonstrates colorful image placeholders; [Discord's spoiler tags](https://support.discord.com/hc/en-us/articles/360022320632-Spoiler-Tags) keep concealment separate from deliberate revelation. The mosaic is our design adaptation, not a parameter set prescribed by those sources.

The cached picture filter downsamples privately to at most 256 pixels on its longest side, flattens transparency, then discards all coordinates into an aggregate RGB palette. It distributes representative colors among approximately 96 deterministic irregular cells with a small dark veil and softened edges. Neither source fragments nor silhouettes reach the displayed bitmap. Warm, cool and multicolored pictures remain different. A repeat visit uses the same pattern rather than accumulating changing glimpses. Missing or unreadable images return the existing neutral fallback.

Only the picture layer changes. Territory, actors, hazards, trails and interface remain sharp. The same filter applies before the first frame, during practice and through victory. Verified earned originals still display clearly. English and Ukrainian text now explains that the colors are a hint and normal play earns the hidden picture.

## Automated checks

- `node --test game/test/demo-picture.test.mjs`: **15/15 passed**. Large landmark correlation removed; exact invariance to source pixel permutations; distinct palettes; immutable input; deterministic output; opaque alpha; tiny/nondivisible and invalid bounds; actual cached filter integration; clear originals; earned/replacement identity; delayed loading; victory/gallery; sharp actors; disposal.
- `node --test game/test/renderer-readability.test.mjs game/test/presentation-renderer.test.mjs game/test/earned-picture.test.mjs game/test/flight-pictures.test.mjs`: **67/67 passed**. Existing renderer, earned-picture and media lifetime behavior.
- `node --test --test-concurrency=1 game/test/demo-host.test.mjs game/test/demo-fresh-handoff.test.mjs`: **18/18 passed**, 87.545 seconds. Actual-host takeover, ordinary state/save preservation, locked practice, fresh Ready, replacement review and cross-host handoff. The initial run failed two assertions (plus their parent) because the fixture attributed the demo's latest painted frame to the ordinary canvas while ordinary painting was correctly suspended. A deterministic isolated reproduction confirmed the fixture issue. The fixture now tracks the canvases separately; all existing assertions pass unchanged. No routing or reward behavior was changed to resolve it.
- Scoped ESLint, Prettier and `git diff --check`: passed.
- `node scripts/localization.mjs build`: passed. The generated bundle also exactly matches `catalogBundle(readCatalogs())`; decoded English and Ukrainian strings match their source catalogues.

## Browser observations

In the existing Chromium in-app preview, Orchard Crossing was observed at 56% captured, taken over at the same position in isolated practice, then resumed as a demo and completed at 85%. Its colored mosaic stayed stable throughout; the flowering tree and buildings visible under the previous blur were absent, while walls, pickups, actors and line cues remained sharp. The new explanatory text was visible in the actual host.

Courtyard Exits was also reviewed at 46% captured. It retained a distinct dark blue, amber and pink palette without the original street or building layout. Both captures used a temporary desktop viewport override, reset after inspection; the existing preview was left paused on Courtyard for review.

- [Orchard during playback](demo-mode-2026-09-28/orchard-mosaic.png)
- [The same scene in practice](demo-mode-2026-09-28/orchard-mosaic-practice.png)
- [Full-picture victory remains concealed](demo-mode-2026-09-28/orchard-mosaic-victory.png)
- [Courtyard during playback](demo-mode-2026-09-28/courtyard-mosaic.png)

This is visual spoiler concealment, not encryption. Color associations can still remind someone of art they already know. The earlier full feature release gates remain separate; this change does not claim new physical-device or human-viewer qualification.
