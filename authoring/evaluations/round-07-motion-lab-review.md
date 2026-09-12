# Round 07 motion lab review

12 September 2026. This is an isolated browser design study in [authoring/motion-lab](../motion-lab/README.md), not a territory-game implementation. It renders one generated FPV body with independently drawn rotors, a compact center cue, speed response, visual banking and optional particles. Terrain objects are vector material diagrams with replaceable image slots. Other named character slots remain clearly labeled placeholders.

## Executed browser observations

The root reviewer opened the actual files through a local HTTP server and the in-app browser. It inspected screenshots and visible readouts while exercising real controls. The separate [viewport fixture](../../docs/concepts/round-07-device-preview.html) embeds that same page at explicit CSS sizes and reports its actual DOM dimensions. It is not a device emulator.

- The generated FPV image decoded at 1254×1254. The default character uses a 1.25-cell square source box with alpha padding, separate rotor anchors and a compact center/rim. The image is a single concept body, not a frame atlas.
- Autoplay visibly moved the craft along the orthogonal route. Body facing and the moving attachments changed between observations. This establishes working preview playback; it does not establish game capture, enemy behavior or input latency on hardware.
- The reviewer paused the preview, selected Microtile, Props and Hybrid, and inspected the resulting terrain views. The same rectangles remained in their positions. Hybrid is the configured default.
- Switching palette and terrain objects to Ukraine Atlas retained the selected FPV body. Retro and Navi palette/material selections also worked. Selecting the planned Navi avatar displayed the neutral marker with an explicit missing-image message; selecting the FPV source restored its decoded body.
- Reduced motion paused on activation, reported frozen rotor detail and removed decorative particles. Playback could resume in reduced mode. The independent Rotors checkbox hid and restored that layer.
- Arrow-key input took over from autoplay and changed the visible mode to Manual input. Escape changed the state to Paused and the transport action to Play. Reset and autoplay selection restored the demonstration route. Holding physical touch controls and gamepads were not exercised.
- Switching browser tabs caused the lab to pause as designed. Its automatic route and cosmetics do not continue consuming hidden-tab elapsed time on return.

The reviewer found and requested corrections for an arena extending below the desktop viewport, a short-landscape board occupying too little of the available space, and compact-width text/control overflow. The final measured layout table is recorded below after those corrections.

| Viewport in CSS pixels | Arena in CSS pixels | Default body source box | Observed layout |
|---|---|---|---|
| 320×640 compact portrait | 290×217.5 | 8 px | Complete arena visible; no horizontal overflow |
| 390×844 portrait | 360×270 | 9 px | Complete arena visible; no horizontal overflow |
| 844×390 landscape | 392.7×294.5 | 10 px | Complete arena visible; settings beside it; no horizontal overflow |
| 1024×768 tablet | 704×528 | 18 px | Complete arena visible; no horizontal overflow |
| 1280×720 desktop | 620×465 | 16 px | Complete arena visible; no horizontal overflow |

Dimensions are rounded visible DOM measurements, not texture resolution. The authoring page still scrolls to additional controls, and its settings panel can scroll independently. All five arenas retain a 4:3 ratio. The compact overflow was corrected through wrapping and layout changes, not by hiding horizontal overflow. The landscape measurement improved from 258×193.5 to approximately 393×295 after reducing header space and moving settings beside the preview.

## Motion and data checks

The root ran `node --test authoring/motion-lab/test-motion.mjs`: **12/12 passed**. An independent read-only reviewer ran the same suite and additional 10/20/30/60/120 fps movement probes. These confirm positions and corner traversal in the fixture, not measured rendering performance.

Covered properties include immediate cardinal movement and stop; speed-only boost/slow modifiers; equal travel at ordinary low and high update rates; carry-over distance at route corners; body turn rate/reduced motion not changing positions; pause preserving state; bounded catch-up after a true stall; rejection of malformed terrain pitch/opacity and geometry; and four palettes/three appearance modes sharing the same footprint data.

The independent review identified four concrete defects, all corrected: a decoded image did not redraw while paused; a held button could stay active after keyboard focus moved; truncating every delta above 40 ms slowed ordinary low-frame-rate travel; and an invalid prop pitch could cause an endless drawing loop. Loaded assets now redraw, blur clears holds, elapsed time is integrated in bounded substeps, and invalid pitch/opacity is rejected before rendering. The final source review reported no remaining actionable issue in that assigned scope.

## Interpretation

The lab proves that a small image body, attachment animation and several presentation parameters can be replaced independently while preserving this fixture's movement and geometry. It does not prove all-assets runtime hot swapping, image-to-game compilation, a level editor, AI generation inside the editor or animation for every actor. The lab has no enemies, collision, territory capture, score, audio, gallery or victory state.

The smallest views reduce the character source box to roughly 8–10 CSS pixels; occupied body pixels are fewer. A deliberate low-resolution production sprite and tests against revealed images remain necessary. Scene-rich terrain, live trails and dense threats may need stronger separation than this diagram fixture shows. Production clips still need frame/pivot cleanup, cancellation/loop review, full-theme art and device playback. iPhone touch, physical controller support, browser packaging and hardware performance remain unverified.

See [authoring regressions and skill checks](round-07-authoring-checks.md), [generated-art inspection](../../docs/concepts/round-07-review.md) and the [Reloaded evidence audit](../../docs/research/round-07-reloaded-ui-motion.md).
