# Neon Spirals

The ninth screenshot reconstruction in Neon Reference Pack, permanent level #331. The explicit 92 × 46 source mask preserves nested angular spiral corridors, broken outer red bands, two separated central spines and their entrances. The denser glow at bottom-left and the particles between the paired right enemies are visual effects, not additional static obstacles or safe islands.

All red tiles are lethal terrain until captured. There are no cyan walls or interior foundations. The source mask is projected into the 70 × 34 interior of the supported 72 × 36 board, retaining the continuous safe perimeter and narrow open passages.

Four pink ringed bouncers start at upper-left, lower-center and the two close right-inner positions. Two cyan patrols start opposite each other on the lower side rails. The yellow player starts at bottom center. Motion is inferred from visible trails; ring sprites use existing bouncer behavior because a still image does not establish extra mechanics.

Goal: 75%, three lives. Source pixels are not embedded. Original reveal artwork is included. Ukrainian translation and unit tests remain deferred. Regenerate with `node scripts/build-neon-spirals.mjs` then `node scripts/build-neon-reference-pack.mjs`.

Validation: scenario and pack schemas pass. Archive and Current rules each survive 120 idle ticks and complete a 70-cell opening capture with three lives under immediate and buffered turning. Browser rendering is reviewed against the reference. Full-clear balance remains unverified.
