# Snake Studio native board preview

The geometry editor now has a **Play preview** disclosure. It accepts a fresh, validated native match from the current mission and uses the same `drawClassicBoard`, authenticated presentation provider, FPV flight sampler and destruction service as Snake play. It does not simulate actors in a second renderer or rewrite a live match to illustrate a pose.

- Choose Solo, paired-board Versus or shared-board Team. Every preview starts paused at seed 17. Start, Pause, One step and Restart operate on the native match controller.
- Queue turns with WASD (P1), arrows (P2 in multiplayer), or the separate touch pads. In Solo either key set controls P1. Keyboard steering is scoped to the preview boards so the geometry editor and form fields keep their own controls.
- Game-theme/Cable, Game-theme/Signal and Retro Field use the real drone, body, wall, prey, shutter, pickup and failure-cell artwork. The mission's actual wrap rule and turns determine seam and corner rendering; the preview never changes its geometry to manufacture a specimen.
- Changing the mission restarts a paused preview. Invalid geometry removes the previous board and explains why it cannot run. Changing artwork or the specimen phase does not reset or change gameplay; the board always shows authoritative actor phases.
- Display, Reduced effects, remains and destruction settings are read through the shared preference owners. This authoring preview is silent and writes no player records or installed content. The existing **Play Solo/Versus/Team** actions still open the complete native play flow.
- Closing the disclosure releases its artwork lease, effect leases and canvas bitmaps. Hiding the page pauses; restoring a cached page prepares a fresh paused preview. No abandoned preview catches up with elapsed background time.

`game/test/snake-studio-preview.test.mjs` adds authored regressions for native mode equivalence, immutable draft ownership, target movement, real corners/wrap, visual independence, bounded clocks and invalid/disposed replacement. Automated suites remain unrun under the repository waiver. Browser/device observations and artistic approval must be reported separately; this integration does not approve new assets or qualify campaign completion routes.
