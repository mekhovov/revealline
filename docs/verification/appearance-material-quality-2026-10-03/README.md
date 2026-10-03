# Material quality pass — 2026-10-03

This follows the material-depth work in PR #971. It improves the shared interface material layer used by game pages, SIM chrome, Creator Studio and curated community descendants. It does not replace world meshes or authored mission artwork.

## Result

- Industrial keeps its riveted frames, amber hover/selection, recessed fields, panel vents, ridged slider grips and substantial cast depth. Its repeated dash pattern is replaced by irregular powdercoat clusters. Highlights are confined to fixed-size edge bands, so tall cards do not turn into glossy gradients.
- The other textured families use interlocking linen yarn, sparse ceramic fibers, interrupted metal brushing, broken timber contours or small mineral inclusions. Each material continues into selected/pressed faces. Wide diagonal plastic sheens and uniform wood/metal scanlines are removed. Classic Field Kit, Desktop 98 and DOS retain their intentional texture-free construction.
- Selected disabled actions now receive the disabled palette and lose active finish, frame and elevation. Destructive actions retain their warning foreground/background when pressed. Resolved state recipes and CSS agree on these pairs.
- Six original, deterministic SVG tiles occupy 9,045 source bytes combined. They use fixed CSS-pixel dimensions, no runtime generation or animated noise, no external image dependency, and no copied game assets. `scripts/refresh-interface-material-grain.mjs --check` verifies their exact projection into the shared stylesheet; the preview workflow runs it before checking the embedded SIM stylesheet.
- Historical theme documents, pinned nine-slice assets, Arcade art and SIM collections remain unchanged. The first-paint seed stays 72,453 bytes. The shared stylesheet is 70,118 bytes (11,236 bytes above the prior material-depth version).

## Visual evidence

The source-backed fixture exercises the runtime stylesheet, resolver, native controls and gallery cards. It now includes a composition with actual 44px player controls, 32px Studio controls, recessed fields and tall cards. It does not override production paint.

- [Industrial game settings](industrial-settings.jpg) and [audio settings](industrial-audio.jpg).
- [Actual Studio specimen](industrial-studio.jpg).
- Native-size compositions: [Industrial](industrial-workshop-close-up.jpg), [Vyshyvanka](vyshyvanka-close-up.jpg), [Dnipro](dnipro-porcelain-close-up.jpg), [Obsidian](obsidian-reliquary-close-up.jpg), [Moonlit](moonlit-grove-close-up.jpg).
- [Native-size measurements](native-size-checks.json) retain paired colors, geometry and paint hashes without duplicating inline SVG payloads.
- [Accessibility measurements](accessibility-checks.json) verify an Industrial specimen nested in DOS: large text expands Studio controls to 44px; reduced effects leaves no animation or transition; Industrial grain stays isolated to the inner scope. Decoration Off was also checked in the browser and removes every sampled control finish.

The browser provider produces JPEG screenshots. These are unretouched captures, not lossless pixel-art exports; no 1×/2× lossless certification is claimed. The later accessibility check ran at an actual 926×1316 CSS viewport, DPR 2. It does not establish touch-device acceptance.

## Checks

- 15 normal-theme captures plus four high-contrast captures cover 19 reading/state pairs each: **361 captured-pixel checks, zero failures**, with an additional 0.2 contrast margin for JPEG uncertainty. Lowest observed normal contrast: **5.00:1**; high contrast: **11.29:1**. [Detailed report](rendered-contrast.json).
- 16 independent semantic state checks per normal theme: **240 checks pass**. Both visible controls and blank twins prove disabled paint wins and pressed destructive controls retain warning colors without an amber frame. [State summary](state-checks.json).
- Focused fixture/resolver tests cover semantic regression detection, native-size composition, theme palettes and state pairs. The full 51-file presentation/Studio/Academy/World cohort passes **444 tests, zero failures**. [TAP results](integrated-tests.tap) and [source hashes](integrated-checks.json) record the completed run.
- ESLint, Prettier, `git diff --check`, deterministic grain generation, first-paint generation and exact embedded SIM stylesheet checks pass.

The first integrated run was interrupted by local disk exhaustion and is not counted as evidence. Closed incomplete Git temporary pack files were removed, leaving indexed packs and source files intact; the complete cohort was rerun afterwards. No package limit was raised.

## Scope still requiring release qualification

The reference review contains broader art-direction proposals; this pass implements the shared interface materials and two state corrections. It does not certify the full original redesign plan. Physical touch/controllers, lossless captures at more scale factors, and target-device p95 frame-time/resource measurements remain separate release gates. Very wide timber panels can still reveal a faint tile rhythm. Final distributable capacity and playable archives are established by the new PR's CI; a preceding-head success is not used as proof for this revision.

[Theme-by-theme primary-source research](design-references.md) distinguishes reference observations and proposed directions from completed validation.
