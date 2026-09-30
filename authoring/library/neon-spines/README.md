# Neon Spines

The fifteenth screenshot reconstruction in Neon Reference Pack, permanent level #337. An explicit 92 × 46 source grid records five vertical six-tile blue lanes with two-tile red spines, a six-tile horizontal crossing, two red horizontal bars, and interrupted cyan perimeter walls. The central four-by-four black pocket is open field, not a safe foundation. Moving actors, trails and impact glow are excluded using unobscured repeated rows.

Cyan tiles are walls, blue tiles slow the player, and red tiles are lethal until captured. There are no interior foundations. The source is adapted to the supported 72 × 36 board, retaining the continuous safe outer rail and the pictured wall openings. Wall cells take precedence at compressed boundaries.

Four pink bouncers start on the upper-left vertical lane, in the lower-left field, and at two lower-right positions. Two cyan border patrols begin left of center on the top rail and high on the right rail. Positions are measured from the reference; speeds and directions use existing behavior and visible trails. Three lives and a 75% goal are authored defaults. Start at bottom center and move sideways before entering the field to avoid the central lethal spine.

Regenerate with `node scripts/build-neon-spines.mjs`, then `node scripts/build-neon-reference-pack.mjs`. Custom reveal artwork, Ukrainian translation and unit tests are deferred. Existing procedural reveal artwork is used; screenshot pixels are not embedded.

Validation: standalone scenario and packs pass schema checks. Archive and Current rules complete 120 idle ticks and a six-cell opening capture through slow terrain under both turning policies with three lives. Browser rendering and installation checked. Full-clear balance remains unverified.
