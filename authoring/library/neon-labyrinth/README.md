# Neon Labyrinth

Reconstruction of the fourth supplied screenshot. Regenerate with
`node scripts/build-neon-labyrinth.mjs`. The adjacent practice page loads the
standalone scenario; the main game includes it in **Neon Reference Pack**.

`reference-map.json` records the measured 91 × 45 source grid: `W` is a cyan
wall, `X` is red lethal ground and `.` is open space. Transient trails and
effects are excluded. Projection onto the supported 72 × 36 board preserves
thin wall segments, stepped dividers, corner recesses and central bays. The
runtime requires a continuous safe outer rail, so perimeter walls sit just
inside it. The result contains 37 disjoint wall rectangles and 86 lethal regions.

Six purple orbs use bouncer behavior and two cyan sparks use border patrols,
starting at the positions shown. Velocity follows visible trails where possible;
exact speed cannot be inferred from a still. The yellow player starts at bottom
center. Authored defaults are three lives, 75% coverage and no timer.

Existing retro reveal art and original procedural sprites are temporary.
Custom reveal images are deferred. No screenshot pixels are embedded.
Verification covers schema validation, reproducible output, legal opening
captures and deterministic replay in both turning modes. Full-clear balance
and device qualification remain unverified.
