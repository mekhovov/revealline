# Neon Chambers

The sixth screenshot-based level in Neon Reference Pack, available in the main mission catalog as level #290 and through this directory’s practice page.
Regenerate with `node scripts/build-neon-chambers.mjs`.

The explicit 91 × 45 source mask traces the three stepped chamber outlines, nested open boxes, central vertical walls, side stubs, and asymmetric horizontal crossbars. It projects onto the engine’s 72 × 36 board while preserving one-tile walls and open doorways. The outside remains a continuous safe rail. This reference has no red hazard terrain. Blue hexagons, impact flashes and colored trails are transient effects, not obstacles.

Six yellow bouncers match the upper-left, upper-center, two central-box, lower-center and far lower-right starting positions. Four cyan border patrols start at the four positions along the top rail. The player starts at bottom center. Enemy motion follows visible trail directions using existing Classic behaviors; exact speeds cannot be measured from a still. Defaults: three lives, 75% reveal target, no timer.

Original reveal artwork is included alongside the original pixel sprites. Ukrainian translation remains deferred. No unit tests or full-clear qualification are included.
