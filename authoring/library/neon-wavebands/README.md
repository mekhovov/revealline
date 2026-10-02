# Neon Wavebands

The twelfth screenshot reconstruction in Neon Reference Pack, permanent level #334. The explicit 91 × 45 source mask preserves red zigzag waves, three blue bands across the arena, gaps between the bands and the separate red waves at the top and bottom. Moving sprites, trails and glow are excluded using unobscured repeated sections of the reference.

Red tiles are lethal until captured. Blue tiles slow the player. There are no walls or interior foundations. Slow bands are projected first and lethal cells take precedence, producing disjoint terrain regions on the supported 72 × 36 board. The source fits inside its 70 × 34 interior and retains the continuous safe outer rail.

Four pink ringed bouncers begin at the upper-right, upper-left band, middle-left band and middle-right band positions. One pink diamond eroder begins above the first band, left of center. Four cyan patrols start at the top, left side and two right-side positions. The yellow player starts at bottom center. Speeds/directions are inferred from trails using existing behaviors; rings do not introduce extra mechanics.

The detailed interleaved terrain requires 399 rectangles. The bounded Classic terrain limit increases from 256 to 512; overlap and interior-bound checks remain enforced. Goal: 75%, three lives. Original reveal artwork is included. Ukrainian translation and unit tests remain deferred. Source screenshot pixels are not embedded. Regenerate with `node scripts/build-neon-wavebands.mjs` then `node scripts/build-neon-reference-pack.mjs`.

Validation: scenario and standalone/bundled packs pass schema checks. Both Archive and Current rules initialize and complete 120 idle ticks under both turning policies with three lives. The 512-region boundary is accepted; 513 and overlapping regions are rejected. Browser launch and rendered geometry checked. Full-clear balance remains unverified.
