# Demo picture signal treatment — 2026-09-28

This replaces the earlier [palette-only mosaic](demo-picture-2026-09-28.md), which concealed the picture but removed too much recognizable atmosphere. The revised target is a faint impression of the real scene behind analog FPV interference. Broad composition may be recognizable; the full original remains an earned reward.

## References and design choice

- [Orqa rapidFIRE](https://shop.orqafpv.com/products/rapidfire-5-8ghz-video-receiver) describes tearing, rolling, noise and multipath interference. The treatment borrows fixed horizontal displacement and small dropout regions.
- [TBS Fusion manual](https://www.team-blacksheep.com/media/files/tbs-fusion-manual.pdf) describes breakup, color deterioration and desynchronization at reception limits. Muted color and a displaced echo provide those visual cues.
- [Analog Devices: Video Basics](https://www.analog.com/en/resources/technical-articles/basics-of-analog-video.html) explains line scanning, synchronization and luma/chroma. This informs the subtle scan-line texture and color misalignment.
- [Xbox accessibility guideline 118](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118) cautions against flashing and high-contrast repeated bands. Our interference is static, with restrained scan-line contrast; it adds no moving noise, rolling screen, flicker or clean-frame flashes.

These sources inform the aesthetic, not a physical RF model or a guarantee that a familiar picture cannot be recognized. Blur alone was too revealing, while palette-only scrambling was too abstract. The chosen composition retains softened scene information and uses interference to obscure the detailed reward image.

## Implementation

`game/ui/demo-picture.mjs` keeps the existing `clear | blurred` renderer interface and exact earned-picture policy. For an unearned source, a private canvas is capped at 512 pixels on its longest side. Alpha is flattened before filtering. All displayed samples come from two softened versions, never raw image fragments: 36% broad scene, 48% displaced soft bands, and 16% broad delayed echo. Band displacement is 5–20% of image width, with small chroma separation, muted saturation, partial dropouts, fine grain and a restrained vignette.

The pattern is deterministic per image, cached once, and unchanged during playback, pause, takeover and victory. Missing/unreadable images retain neutral fallback. Ordinary earned art remains clear; gameplay geometry, actors, hazards, trails and UI bypass the filter. English and Ukrainian text describe a scrambled preview and earning the original through normal play.

The separable box filter now uses sliding sums instead of a per-pixel radius loop. Analytic tests preserve its previous clamped-edge integer averaging, including oversized kernels and repeated passes. A one-off local Node preparation observation for a 512×256 synthetic source dropped from about 218 ms to 102 ms after this optimization; this is not a browser/mobile performance guarantee. Subsequent frames reuse the bitmap.

## Verification

- Picture suite: **16/16 passed**, including reduced-but-positive broad scene contrast, attenuation of source checker detail, composition-sensitive output, source immutability, deterministic output, distinct palettes, opacity, tiny/nondivisible/512-pixel bounds, exact analytic blur averages, cached canvas integration, exact earned identities, loading/victory/gallery protection, sharp actors and disposal.
- Renderer/readability/earned-picture/flight-picture cohort: **67/67 passed**.
- Scoped ESLint, Prettier and `git diff --check`: passed.
- Localization build passed. The generated catalogue exactly matches `catalogBundle(readCatalogs())`, and both decoded English/Ukrainian preview strings match their source JSON.

Commands:

```sh
node --test game/test/demo-picture.test.mjs
node --test game/test/renderer-readability.test.mjs game/test/presentation-renderer.test.mjs game/test/earned-picture.test.mjs game/test/flight-pictures.test.mjs
```

A temporary browser comparison rendered the actual Orchard Crossing, Courtyard Exits and Night Crossfire pictures through the production filter. [Comparison screenshot](demo-mode-2026-09-28/signal-picture-comparison.png). Night Crossfire is only an artwork check, not new bot qualification. The temporary page was removed after inspection.

The actual game host was also reviewed on Crosswind at 25% capture and 29 seconds, including a live bent cut. The picture showed fixed signal bands and grain, while the craft, cut and enemies stayed sharp. Taking over into practice retained the same displayed position and protected image, and Return to demo resumed the recording. English explanatory copy appeared correctly. [Playback screenshot](demo-mode-2026-09-28/signal-demo-gameplay.png) · [Practice screenshot](demo-mode-2026-09-28/signal-demo-practice.png).

The temporary viewport override was reset, the comparison tab closed, and the existing game tab was left playing the updated demo.

The existing full-feature human-viewer, physical-device and packaging release gates remain separate from this picture-only follow-up.
