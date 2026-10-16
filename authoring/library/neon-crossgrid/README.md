# Neon Crossgrid

Reconstruction of the user-supplied screenshot: eighteen red crosses in six columns and three rows, staggered cyan partition walls, and the exact visible gaps in the tiled perimeter. The explicit 91 × 46 source mask is projected to the supported 72 × 36 board; forward mapping preserves every one-cell divider. The projection fits the source inside the 70 × 34 interior so border-adjacent crosses retain clearance. The engine's continuous safe outer rail sits outside the inset screenshot walls.

Six yellow ring-shaped field enemies start in two three-enemy groups: upper-right and lower-left. The two close lower-left enemies remain separate. Four cyan perimeter patrols start at the three top positions and the bottom-left position. The yellow player starts at bottom center.

Yellow enemies use existing reflecting bouncer behavior with an original ring-and-core sprite. A still image cannot establish whether the source rings represent a separate ability, armor or an effect, so no undocumented ability is invented. Speeds/directions are authored approximations based on visible trails. Collision radius remains within the engine's supported range, so the large source halos are represented as sprite rings rather than expanded collision circles.

Cyan walls block movement and do not close cuts. Red cross terrain is lethal until captured. Goal: 75%, three lives. Source imagery is not embedded; original reveal artwork is included. Ukrainian translation remains deferred.

Run `node scripts/build-neon-crossgrid.mjs`, then `node scripts/build-neon-reference-pack.mjs`. The standalone practice launcher supports immediate and buffered turning. Bundled in **Neon Reference Pack** as its seventh map, permanent level #329; **Neon Words & Symbols** remains separate.

Validation: standalone scenario and pack schemas pass; the bundled reference pack has seven levels. Archive and Current rules, each with immediate and buffered turning, initialize and survive 120 idle ticks. Browser launch and rendered geometry were reviewed. Unit tests and full-clear balancing were not performed.
