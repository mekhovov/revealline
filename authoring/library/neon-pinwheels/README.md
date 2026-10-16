# Neon Pinwheels

The eleventh screenshot reconstruction in Neon Reference Pack, permanent level #333. The explicit 91 × 45 source mask preserves thirty red pinwheel motifs (including eight partial motifs along the top and bottom) and seven open angular rings with single-tile center dots. Occluded rings are restored using the identical unobscured upper-right motif. Moving trails and impact glow are excluded.

All red tiles are lethal until captured. There are no interior walls or safe foundations. The source is projected into the 70 × 34 interior of the supported 72 × 36 board, preserving the continuous safe perimeter and gaps between motifs.

Four pink bouncers start at the upper-left ring, middle-right ring, lower-left field and lower-right ring. Two cyan patrols start opposite each other on the upper side rails. The yellow player starts at bottom center. Enemy motion is approximated from visible trails with existing behaviors.

Goal: 75%, three lives. Source pixels are not embedded. Original reveal artwork is included. Ukrainian translation and unit tests remain deferred. Regenerate with `node scripts/build-neon-pinwheels.mjs` then `node scripts/build-neon-reference-pack.mjs`.

Validation: scenario and pack schemas pass. Archive and Current rules each survive 120 idle ticks and complete a compact four-cell opening capture with three lives under immediate and buffered turning. Browser geometry and enemy placement were reviewed. Full-clear balancing remains unverified.
