# Dutch campaign portrait motion — 29 September 2026

This follow-up is based on merged `10f9bf21e` plus the portrait profile changes in this batch. It covers a concrete crop bug, not qualification of every remaining Phase 5 requirement.

The Workshop Lights, Parts in Motion, Makers Together, Signals of Support and Shared Horizon portraits previously cropped out all their landscape animation regions. At 390×844, their 640×320 source images display only about 23% of the image width. Region-count and bounds checks passed even though the picture features being animated were entirely outside the viewport.

The five profiles now have measured portrait-only regions: the rear pendant and sunlit bench; the actual bench lamp and window light; the trailing plant and lit floor; and visible wall light in the last two scenes. Parts in Motion is reframed from 61% to 10% horizontally so its lamp, window and assembled drone appear instead of mostly empty blue mat. The source images, other focal positions, desktop regions, supplied aggregate DroneAid poster and receipt identities are unchanged. Lighting modifies source-pixel brightness; it does not move or bend drone geometry. Makers Together also moves the existing plant through the same bounded foliage shader as FPV.

## Automated evidence

- The new real-dimension crop regression reproduced **19 failing portrait combinations** before the profile fix. It now passes **102 animated profile/viewport combinations**: 17 profiles at 320×568, 390×844, 430×932, 768×1024, 844×390 and 1280×800. The supplied DroneAid aggregate is explicitly exempt because its photographic geometry intentionally remains still.
- The regression uses committed image dimensions and the actual host's image-plane placement. It requires an 8×8-pixel visible intersection with a region's fully weighted inner 60%, after both fixed WebGL overscan and the completed CSS entrance. Off-screen anchors and barely visible feather edges cannot satisfy it.
- Scene, renderer and receiver checks: **46/46 passed** (`menu-scenes.test.mjs`, `menu-scene-motion.test.mjs`, `menu-signal-loss.test.mjs`). These include reduced motion, local preferences, hidden/gameplay/Settings pause, context loss/fallback, one renderer, focus stability and disposal.
- Edition projection/runtime checks: **9/9 passed** (`edition-runtime.test.mjs`), including preservation of selected profile data in standalone catalogs. No import or runtime asset inventory changed.
- Scoped ESLint, Prettier and diff whitespace checks passed.

## Browser method

`game/test/manual/portrait-motion-check.html` is an isolated five-scene browser fixture. Its button opens one 390×844 iframe at a time, using the production scene host, shader and artwork. Test-owned instrumentation reads the WebGL framebuffer immediately after two actual draws about 2.1 seconds apart. It compares only the fully weighted source regions inside the final portrait crop. CSS entrance scaling, text shade, receiver noise and dropouts are outside that framebuffer, so they cannot produce a false positive. It then checks that the host's inactive state stops drawing and reduced motion stops drawing while CSS hides the canvas. It does not write player preferences or saves; iframe navigation disposes the previous owner.

The parent thread ran the fixture in the Codex in-app browser against the final source on local port 8983: **5/5 passed**. Every iframe reported 390×844, every production canvas was 640×320, and frame pairs were 2.111–2.141 seconds apart. All five inactive and reduced-motion checks passed. The verified scene catalog SHA-256 is `bf7a94af2ed0f595949853b46c568c0c8f2685b0f3c288cebf105cbb69d56b52`; the fixture module hash is `90b6d47ded436fdaf6d1b2b72195de854e87fe1be5648743284d8bd7c8960910`.

| Portrait           | Visible source region | Changed / sampled pixels | Mean absolute RGB difference (0–255) |
| ------------------ | --------------------- | ------------------------ | ------------------------------------ |
| Workshop Lights    | Rear pendant          | 180 / 180                | 7.563                                |
| Workshop Lights    | Sunlit bench          | 1,318 / 1,404            | 4.443                                |
| Parts in Motion    | Bench lamp            | 374 / 374                | 12.740                               |
| Parts in Motion    | Window light          | 2,409 / 2,409            | 7.264                                |
| Makers Together    | Trailing plant        | 1,494 / 1,500            | 19.186                               |
| Makers Together    | Lit floor             | 1,524 / 1,540            | 1.152                                |
| Signals of Support | Wall light            | 2,730 / 2,730            | 1.781                                |
| Shared Horizon     | Wall light            | 1,782 / 1,782            | 1.493                                |

An initial Parts in Motion attempt animated central wood but changed only 673 of 1,694 sampled pixels by a mean 0.182 RGB units. Although nonzero, that was too close to quantization-level variation to support a visible-motion claim. The final lamp/window framing above replaced that attempt before qualification. The measurements establish real changing source pixels within each portrait crop, independently of entrance and receiver effects. They do not alone establish perceptual quality, animation comfort or visibility behind every menu arrangement; the wall-light changes remain intentionally subtle.

This subagent's computer-use context exposed neither an in-app browser nor a usable initialized Chrome profile, so the parent thread performed this browser run. No browser defaults were changed.

## Remaining Phase 5 work

Mode-specific authored composition remains a separate asset batch for the **four base worlds × three supported modes** (FPV, Ukraine, Retro and Coupa; Solo, Versus and Team). Current mode IDs do not independently arrange the subjects baked into flattened images. Separate object motion needs measured cutouts and repaired backgrounds or new authored compositions; arbitrary zoom, tint changes and unrelated particle overlays would not fulfill that request. The fourteen company editions remain Solo-only.

This batch adds no physical-phone performance, GPU-memory, long-session comfort or final-package claim. The broader exact-revision browser/package and physical-device acceptance matrix remains a Phase 7 gate.
