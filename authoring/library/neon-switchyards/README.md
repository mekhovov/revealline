# Neon Switchyards

The fourteenth screenshot reconstruction in Neon Reference Pack, permanent level #336. An explicit 92 × 46 source grid records three two-tile vertical cyan partitions, the two-tile horizontal midline wall, interrupted outer walls and eight red/blue terrain lanes. Slow-lane widths and alternating lethal crossbars follow the source, including its wider outer columns. Moving actors, trails and impact flashes are excluded; obscured cells are restored from the repeated motifs.

Cyan tiles are walls, blue tiles slow the player, and red tiles are lethal until captured. There are no interior foundations. The source is adapted to the supported 72 × 36 board, retaining the continuous safe outer rail and the openings between the pictured wall segments. Wall cells take precedence at compressed boundaries.

Four yellow bouncers start beside the upper-left and lower-left terrain lanes, and just above and below the midline wall inside the rightmost lane. Two cyan border patrols start near the lower ends of the left and right vertical partitions. Enemy types use existing behaviors. Positions are measured from the image; directions follow visible trails, while speeds, three lives and the 75% goal are authored defaults. The player starts at bottom center and must first move sideways to a wall opening.

Regenerate with `node scripts/build-neon-switchyards.mjs`, then `node scripts/build-neon-reference-pack.mjs`. Original reveal artwork is included. Ukrainian translation and unit tests remain deferred. Screenshot pixels are not embedded.

Validation: standalone scenario and packs pass schema checks. Archive and Current rules complete 120 idle ticks and a 970-cell opening capture under both turning policies with three lives. The route follows the bottom rail left to the two-cell opening beside the left partition, enters three cells, shifts one cell left, and returns south. Unoccupied compartments are captured by the existing flood-fill rules. Browser rendering and installation checked. Full-clear balance remains unverified.
