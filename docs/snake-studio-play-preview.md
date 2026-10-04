# Snake Studio native board preview

The geometry editor now has a **Play preview** disclosure. It accepts a fresh, validated native match from the current mission and uses the same `drawClassicBoard`, authenticated presentation provider, FPV flight sampler and destruction service as Snake play. It does not simulate actors in a second renderer or rewrite a live match to illustrate a pose.

- Choose Solo, paired-board Versus or shared-board Team. Every preview starts paused at seed 17. Start, Pause, One step and Restart operate on the native match controller.
- Queue turns with WASD (P1), arrows (P2 in multiplayer), or the separate touch pads. In Solo either key set controls P1. Keyboard steering is scoped to the preview boards so the geometry editor and form fields keep their own controls.
- Game-theme/Cable, Game-theme/Signal and Retro Field use the real drone, body, wall, prey, shutter, pickup and failure-cell artwork. The mission's actual wrap rule and turns determine seam and corner rendering; the preview never changes its geometry to manufacture a specimen.
- Changing the mission restarts a paused preview. Invalid geometry removes the previous board and explains why it cannot run. Changing artwork or the specimen phase does not reset or change gameplay; the board always shows authoritative actor phases.
- Display, Reduced effects, remains and destruction settings are read through the shared preference owners. This authoring preview is silent and writes no player records or installed content. The existing **Play Solo/Versus/Team** actions still open the complete native play flow.
- Closing the disclosure releases its artwork lease, effect leases and canvas bitmaps. Hiding the page pauses; restoring a cached page prepares a fresh paused preview. No abandoned preview catches up with elapsed background time.

`game/test/snake-studio-preview.test.mjs` adds authored regressions for native mode equivalence, immutable draft ownership, target movement, real corners/wrap, visual independence, bounded clocks and invalid/disposed replacement. Automated checks, browser/device observations and artistic approval must be reported separately; this integration does not approve new assets or qualify campaign completion routes.

## Opening the complete game

Play Solo/Versus/Team pins the validated package and selected mission before its
transactional installation begins. The launch uses that exact installed entry;
it never reads a later mission selection to choose from an older package.
Editing or importing a draft, selecting another mission, newer input, focus loss,
page hiding or another Play action retires pending navigation. A finished
installation may retain its immutable Studio-owned copy, but cannot launch a
retired selection or remove another owner's content.

A browser Back/Forward cache visit or page freeze retires pending actions and
closes the Studio's database connections. A cached return or resume creates one
fresh set of lazy storage owners; Save, Restore and Play can reopen their original
records. Old asynchronous saves, imports, restores and Play requests cannot
update or navigate the restored page. Final page exit disposes lifecycle
listeners and cannot reopen storage. The native in-page preview independently
releases its presentation resources and returns paused. Closing connections
improves cache eligibility, but a modeled lifecycle is not evidence that a
particular browser used its Back/Forward cache.

`game/test/snake-studio-launch.test.mjs` verifies exact native
package export/import across all three modes, selected-entry pinning during a
delayed install, stale success/failure, foreground cancellation, real profile/library connection closure and recovery,
and stale installation retirement after a cached return. These targeted
regressions pass under Node 22; physical browser/device recovery remains a
separate qualification step.
