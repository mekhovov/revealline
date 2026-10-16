# Neon Conduit

The thirteenth screenshot reconstruction in Neon Reference Pack, permanent level #335. An explicit 92 × 46 source grid preserves three cyan chambers, twelve red hazard rectangles, the full-width horizontal blue lane, and three vertical blue branches. Tiles obscured by moving actors and effects are restored from the repeated chamber geometry.

Cyan tiles are walls, blue tiles slow the player, and red tiles are lethal until captured. The chambers retain openings through each side at the horizontal lane and through their upper and lower edges at the vertical branches. Open space above and below the chambers remains clear. There are no interior foundations or border patrols.

Three yellow ring bouncers start at the two center-right lane positions and in the lower-right corner of the left chamber. Three pink diamond eroders start above the middle chamber, inside the upper-left section of the right chamber, and inside the lower-right section of the left chamber. Types use existing behaviors; ring artwork adds no new mechanics. Positions are measured from the reference; movement directions follow visible trails, while speeds, lives and the 75% goal are authored defaults.

The source is adapted to the engine's 72 × 36 board with a continuous safe perimeter. One-cell walls are retained when compressing to the 70 × 34 interior; wall cells take precedence over terrain at compressed boundaries. The player starts at bottom center.

Regenerate with `node scripts/build-neon-conduit.mjs`, then `node scripts/build-neon-reference-pack.mjs`. Original reveal artwork is included. Ukrainian translation and unit tests remain deferred. Screenshot pixels are not embedded.

Validation: standalone scenario and packs pass schema checks. Archive and Current rules complete 120 idle ticks and a 21-cell opening capture under both turning policies with three lives. Browser rendering and installation checked. Full-clear balance remains unverified.
