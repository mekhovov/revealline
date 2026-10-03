# Flight Deck and industrial companions

Industrial Workshop is now **Flight Deck**, the game's signature theme. New profiles use **Follow campaign / community**, which falls back to Flight Deck. Explicit personal choices and authored community defaults continue to win. The original blue interface is named **Signal Blue**. Both names and descriptions are localized in English and Ukrainian.

The new current display names use revision `r3` of their existing IDs. Earlier family and interface documents remain available verbatim. Existing Arcade and SIM descriptors retain their original revisions. The shared steel renderer deliberately improves the frames of retained Industrial presentations too; historical documents are preserved, not historical UI pixels.

## Material work

- Flight Deck has machined double rims, slotted corner fasteners, irregular edge wear, directional tool marks, recessed fields, ribbed grips, vent slots and a bolted metal menu backing. Textures repeat at fixed CSS-pixel dimensions; the label face never stretches with the border.
- **Ember Foundry** combines warm cast iron, copper controls, coarser surface grain and narrow furnace-colored edge seams.
- **Polar Relay** combines blue steel, fine brushing, pale enamel, cleaner control edges and small cyan instrument marks.
- The two companions include semantic Arcade and Academy/World SIM collections: terrain/sprite recipes, surfaces, material properties and effect palettes. They reuse approved models and gameplay geometry. They are available through the same game, SIM and Studio selection/preview paths.
- Industrial buttons have a short 2-pixel press movement and collapsing contact shadow. Color pairs change atomically. Reduced Effects or the operating system's reduced-motion setting disables the movement; Decoration Off and high contrast remove material embellishment.

These are original assets and material recipes, informed by [Factorio's GUI specimen](https://factorio.com/blog/post/fff-243), its [dark-material lighting](https://factorio.com/blog/post/fff-386), and the other primary sources in [design-references.md](design-references.md). No source game's assets were copied.

## Browser evidence

- Live game settings: [Flight Deck](flight-deck-settings.jpg), [Ember Foundry](ember-foundry-settings.jpg), [Polar Relay](polar-relay-settings.jpg). Cards apply immediately and retain the selected state; [selection results](live-selections.json).
- Runtime compositions with player/Studio controls and tall cards: [Flight Deck](flight-deck-close-up.jpg), [Ember](ember-foundry-close-up.jpg), [Polar](polar-relay-close-up.jpg), plus [measurements](close-up-measurements.json). These use the production resolver and stylesheet, not a separate visual mockup.
- Six normal/high-contrast captures cover **114 reading/state pairs with zero failures**. Lowest captured normal contrast is **6.62:1**, high contrast **11.29:1**. [Captured-pixel report](rendered-contrast.json) checks every RGB value in textless reading twins, adding a 0.2 margin because browser screenshots are JPEG. This is not lossless-pixel certification.
- [48 semantic checks](state-checks.json) confirm disabled selections lose active decoration and destructive pressed controls keep their warning pair. [Motion checks](motion-checks.json) record `0px 2px` press travel normally, `none` with reduced motion, and no surface texture or frame with Decoration Off.

The browser review caught the new finish selectors losing to the common steel rule. Their specificity was corrected, then the affected captures were repeated against the final CSS. Full normal-theme screenshots are at 1280 CSS pixels; game settings use the existing 926-pixel preview viewport. Physical touch/controller hardware and device performance are not established by these captures.

## Size and release boundaries

The [59-file integrated cohort](integrated-checks.json) ran 542 tests: 540 passed. One failure was an expected-current-revision assertion left at `r2`; it was updated to `r3`, and the [final focused run](final-validation.json) passes all 46 tests, including the corrected case, first-paint consistency and historical-document checks. The remaining controller-settings failure expects no storage writes but receives an empty `RadioSetup.v1` record. It also reproduces with [unchanged HEAD JavaScript](head-runtime-baseline.json); it is recorded as an unresolved baseline failure, not counted as passing. The integrated cohort includes Studio, Academy, explicit World, determinism and curated-package checks.

English/Ukrainian localization checks, ESLint, Prettier, deterministic material generation, first-paint generation, byte-identical embedded SIM stylesheet validation and `git diff --check` pass.

The final display-only Creator name alias also passes the [editor appearance check](creator-label-validation.tap) and a fresh localization check.

Ten generated SVG material tiles total **11,086 source bytes** (the four new structural tiles add 2,041 bytes). The shared stylesheet is **75,032 bytes** and the synchronous first-paint seed is **88,504 bytes**, within the existing 100 KiB test limit. Optional SIM assets remain in the optional collection path. The embedded SIM stylesheet is regenerated from the shared source; no package limits were increased.

**PR #980 remains draft.** The initial complete optional build exposed an existing Worlds overflow (105 runtime files / 104-file cap), reproduced with [base-branch source](package-parent-baseline.json). The theme work added zero package paths. These diagnosis files describe the earlier base; they are not the current branch's packaging result.

Main's package-closure fix arrived through merge `e2950484d` during publication. It removes three unused dependencies from Worlds, with no raised quota. The [post-merge frozen build](post-merge-package-evidence.json) at `d0ab8421c` now passes for all three packages: two builds are byte-identical, committed inputs are verified, and runtime/source ZIP admission passes. Worlds uses **102/104 runtime files (14,523,229 bytes)** and **104/104 source files (14,556,664 bytes)**, below 16 MiB. Academy uses 67/69 runtime/source files; Civilian Flight uses 35/37. The Worlds source archive has no remaining file slots. Admission of newly built artifacts does not establish compatibility with every historical archive.

The merged Creator editor appearance check also passes ([raw result](post-merge-editor.tap)). Product release qualification and an explicit release slot remain outstanding; this PR is published for review and has not been promoted to a release.

Broader release qualification still includes physical touch/controller use and target-device p95 frame-time/resource measurements. This change provides the default industrial identity and two complete palette/material collections; it does not claim new photorealistic meshes or completion of every milestone in the original whole-game redesign plan.
