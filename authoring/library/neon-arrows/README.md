# Neon Arrows

The fifth screenshot-based level in Neon Reference Pack. Open the adjacent practice
page or choose **Neon Arrows** in the main mission catalog (level #289).
Regenerate with `node scripts/build-neon-arrows.mjs`.

The explicit 91 × 45 source mask preserves 45 red arrow/cross motifs and 14 cyan
wall segments. It projects onto the engine’s 72 × 36 board as 186 disjoint lethal
rectangles and 14 walls. The border remains the engine’s continuous safe rail;
edge arrows are clipped to its interior. Cyan hexagons and red moving trails are
visual effects, not additional obstacles.

Four yellow bouncers start near the top, left-center, lower-left and lower-right
positions shown. Four cyan border patrols start on the two upper positions and
opposite side midpoints. The upper bouncer is nudged inward to fit its radius
inside the playable field. The player starts at bottom center. Speeds follow
visible trail directions using existing behaviors; they cannot be measured from
a still. Defaults: three lives, 75% reveal target, no timer.

Original reveal artwork is included alongside the original pixel sprites. Ukrainian translation remains deferred. Schema/import and browser checks
are performed during creation; no unit tests or full-clear qualification are added.
