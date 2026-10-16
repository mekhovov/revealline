# Whole-artwork landing animation — 29 September 2026

The landing background now renders the complete active image as one animated texture. A slow camera pan and dolly move the image itself; feathered source-coordinate regions move painted clouds, ripple existing water reflections, gently sway FPV orchard foliage and vary existing light. Moving overlay silhouettes, particles, haze and gradient light patches were removed. The restrained analog receiver texture and brief committed-navigation retune remain separate existing treatments beneath stationary menu content.

The renderer draws at most 30 frames per second, caps both surface and texture to 1600 pixels on the longest edge and 1.44 million pixels, and uses no extra image download or video. GPU phases stay bounded for long sessions. Hidden/inactive landings cancel their animation callback; resuming retains phase without elapsed-time catch-up. Reduced effects, reduced motion and the background-animation preference show the original still image. WebGL failure or context loss uses camera movement of the original image through CSS, without running both camera implementations. Disposal releases GPU objects, the drawing buffer and listeners.

## Verification

- Renderer and landing lifecycle: **26/26 passed** (`game/test/menu-scene-motion.test.mjs`, `game/test/menu-scenes.test.mjs`). Includes original asset integrity, all 18 profile lookups, exact image/canvas ownership, no overlay-sticker DOM, readiness, source changes, bounded motion, focus stability, hidden/reduced/settings pause, context loss/restoration, upload failures and disposal.
- Host/retune/fullscreen/chooser regression cohort: **98/98 passed**. Log: `.cache/living-artwork-hosts.log`.
- Edition/offline/native inventory cohort: **26/26 passed**. Log: `.cache/artwork-motion-inventory-tests.log`. The module follows its literal import into the existing graph, and exact-byte desktop/iOS staging assertions pass. No new asset inventory entry or packaging script was required.
- Scoped ESLint, Prettier and diff whitespace checks passed.
- Real Codex in-app browser: actual Ukrainian home screen at 1280 × 720 used the whole-image WebGL renderer with no CSS camera transform. The original image was hidden only after a successful frame. No shader/console error was observed in the isolated renderer preview.
- Portrait check at 390 × 844 selected the authored 540 × 960 FPV portrait, kept the controls within the viewport and had no horizontal overflow. The temporary viewport override was reset.
- Preview controls switched to the static original with reduced motion. Pause retained the frame. Moving-frame comparison recorded mean RGB difference 12.215 in the artwork region; paused-frame comparison was exactly zero across both the artwork and controls. The small moving control-region difference (0.437) comes from the translucent panel over the moving image; its DOM rectangle stayed exactly fixed at x24/y591/w1232/h105. These sample pairs were captured during visual iteration before the final long-session phase refinement; the final desktop and portrait host images use the completed implementation.

Screenshots and pixel comparison are in [living-artwork-2026-09-29](living-artwork-2026-09-29/): `home-desktop.jpg`, `home-portrait.jpg`, moving/paused frame pairs and `frame-comparison.json`. The screenshots are original JPEG bytes returned by the browser, without image editing.

[Live artwork preview](http://127.0.0.1:8779/game/test/manual/living-artwork.html) uses the production renderer and CSS, offers all 18 scenes, pause and a still-image comparison, and never changes shared preferences, gameplay or saves. The preview selection changed during review, so its current scene was preserved and the tab retained. The separate home-screen verification tab was closed.

Limits: browser viewport emulation and modeled native packaging checks are not physical-phone GPU/performance certification. This is animation of existing still artwork, not newly generated video footage. No two-hour rendering soak was performed for this focused visual correction.
