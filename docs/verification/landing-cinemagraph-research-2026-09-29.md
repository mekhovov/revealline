# Landing cinemagraph research — 29 September 2026

The requested result is movement within the landing artwork: clouds drifting, foliage responding to wind and small changes in existing lights. Repeated camera zoom is not the animation itself. This record separates the current lightweight shader treatment from scene assets that would be needed for more substantial object animation.

## Primary references

- [Wallpaper Engine: Water Flow](https://docs.wallpaperengine.io/en/scene/effects/effect/waterflow.html) describes continuous local image flow for water and clouds. Painted direction masks choose the affected pixels, and time offsets keep separate regions from moving in perfect synchronization. This supports directional, phase-offset motion rather than moving the entire photograph back and forth.
- [Wallpaper Engine: Water Waves](https://docs.wallpaperengine.io/en/scene/effects/effect/waterwaves.html) uses opacity and timing masks to constrain small distortions and stagger their phases. It illustrates why the material and region matter: water, cloth and foliage need different treatment.
- [Spine: Windmill example](https://esotericsoftware.com/spine-examples-windmill) leaves tree trunks fixed and animates separate leaf bundles. Offset keys provide variation; perspective-aware component geometry supports the rotating blades. It is an example of authored scene animation, not evidence that a flattened image already contains those parts.
- [Wallpaper Engine: Puppet Warp](https://docs.wallpaperengine.io/en/scene/puppet-warp/introduction.html) requires a separate cutout and a repaired background, then mesh geometry, bones, weights and animation. Moving an object exposes pixels that must exist behind it.
- [Sucker Punch: How visual effects bring Ghost of Tsushima to life](https://blog.playstation.com/?p=345372) describes coordinated wind across trees, grass, cloth, ropes and effects. The relevant art-direction principle is coherent environmental movement. This developer account concerns its game world; it does not establish a menu implementation or justify adding a simulation here.

These sources inform the approach. They do not prescribe this implementation's timing, crop, frame budget or visual acceptance criteria.

## Current implementation boundary

The selected implementation reuses the existing image and inline WebGL shaders. Supported regional animation has a fixed `1.025` crop with zero pan. Clouds and steam blend two phases of directional sampling from the actual source image, avoiding a visible reset of a single scrolling sample. Water and foliage have small localized motion; lamp and beam regions have restrained lighting variation. Feathered region boundaries protect surrounding composition, but these are approximate regions rather than detailed per-object segmentation masks.

The original artwork remains the only texture source. This is a cinemagraph approximation, not a layered model, skeletal animation, new video or reconstruction of hidden detail. A shader cannot produce an independently turning propeller or expose a correct background behind moving scenery simply by increasing UV displacement. Large displacement also risks bending rigid details or making the image look rubbery. The stable hangar, table and drone are useful visual anchors in the FPV scene.

Profiles without supported regions receive a single four-second push from `1.01` to `1.035`, then hold. Their WebGL path stops requesting frames once settled. The CSS fallback when WebGL is unavailable also runs once and holds; it does not alternate or endlessly zoom. Reduced motion and animation off show the original static picture. Hidden/inactive landings stop animation. The active regional renderer retains its maximum 30 draws per second and bounded canvas/texture allocation; it runs no gameplay simulation.

## Local asset inspection

The FPV hangar landscape and separate portrait are flattened stills. Their unchanged authoring originals are under `authoring/library/fpv-field-kit/originals/`; the menu uses the prepared artwork represented by `game/ui/art/menu-scenes/fpv.webp` and `fpv-portrait.webp`. Inspection found no matching FPV menu video loop, separated scene layers, painted flow/depth map or rigged asset.

The existing `game/ui/fpv-body-recipes.mjs` and pixel-art drawings provide gameplay-oriented craft/rotor presentation. Their geometry and perspective do not match the drone baked into the hangar image, so they are not a ready animation layer for that composition.

`authoring/library/dawn-signal-story/candidate-v1/dawn-signal.mp4` is a different coastal story candidate: silent H.264, 640 × 360, 12 fps, eight seconds and 713,732 bytes. Its [authoring record](../../authoring/library/dawn-signal-story/README.md) describes a procedural craft arriving and settling; it explicitly is not a loop and has no runtime binding. It is not a substitute for the FPV hangar animation. The other discovered video/GIF files are test fixtures or a copy of that sample, not production landing loops.

## Future asset production

For a more convincing FPV cinemagraph, preserve the approved composition and produce separate landscape/portrait masks for cloud flow, individual foliage groups and existing lights. Use consistent wind direction with staggered local timing; keep architecture and bench geometry fixed. This improves isolation without turning the background into a camera effect.

If independently moving props are wanted, author their cutouts and the background that those motions reveal, then animate perspective-correct geometry or render a seamless clip from that scene. Review the join, portrait composition, pixel-art treatment and reduced-motion still. This is additional asset production: no such layered scene or generated video is claimed in the current implementation, and no new animation-tool dependency was introduced by this research.

## Evidence and limits

This record is based on the linked official documentation, local source/provenance inspection and visual inspection of the FPV still. It is not a browser-motion, phone-performance or viewer-comfort acceptance report. The isolated review page is `game/test/manual/living-artwork.html`; it leaves player preferences untouched. Runtime tests and browser observations are recorded separately by their owners. This correction introduces no new imports or external assets, so the packaging graph is unchanged; no full packaging build was rerun for this documentation update.

## Implementation verification follow-up

- Renderer + scene lifecycle: 28/28 passed (`.cache/landing-fixed-camera-final.log`), including a two-minute fixed-camera run, directional-flow reset continuity, one-time fallback settlement, pause/resume and GPU disposal.
- Scene/retune/edition regression cohort: 41/41 passed (`.cache/landing-fixed-camera-host.log`); 18 scene tests overlap the first cohort, for 51 unique focused cases.
- Scoped lint, formatting and diff whitespace checks passed.
- In-app browser preview compiled the final flow shader without console warnings/errors. The image is drawn on its 960 × 540 WebGL canvas, the artwork plane has no CSS transform, and control geometry is stationary.
- The preview's static-fallback comparison uses the actual production CSS. Two observations after settlement both reported `matrix(1.035, 0, 0, 1.035, 0, 0)`, a four-second duration, one iteration and retained final state. The comparison does not modify shared preferences or real WebGL availability.
- Screenshot and computed-style evidence: [landing-cinemagraph-2026-09-29](landing-cinemagraph-2026-09-29/). Still screenshots cannot demonstrate the local animation; use the [live preview](http://127.0.0.1:8779/game/test/manual/living-artwork.html) for that.
