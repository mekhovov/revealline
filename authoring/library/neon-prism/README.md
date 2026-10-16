# Neon Prism

The sixteenth screenshot reconstruction in Neon Reference Pack, permanent level #338. An explicit 91 × 45 source grid records the mirrored red-and-blue central tapestry, two side diamonds, long diagonal red border and small top/bottom chevrons. The unobscured upper-left quadrant supplies the repeated geometry; reflections restore tiles hidden by moving actors, trails and impact glow in the other quadrants.

Blue tiles slow the player; red tiles are lethal until captured. There are no cyan walls or interior safe foundations. The source is adapted to the supported 72 × 36 board with a continuous safe outer rail. Forward projection retains narrow motifs and gives lethal terrain precedence at compressed boundaries; all terrain rectangles are disjoint.

Five pink ring bouncers begin at the upper central notch, upper-right field, right diagonal border, lower-left diagonal border and lower-left field. Four cyan border patrols start at two top positions and opposite positions on the upper side rails. Actor centers follow the picture. Types use existing behaviors; ring artwork introduces no extra mechanics. Speeds and directions follow visible trails where possible and otherwise use authored defaults, as do three lives and a 75% goal. The player starts at bottom center.

Regenerate with `node scripts/build-neon-prism.mjs`, then `node scripts/build-neon-reference-pack.mjs`. Original reveal artwork is included. Ukrainian translation and unit tests remain deferred. Screenshot pixels are not embedded.

Validation: standalone scenario and packs pass schema checks. Archive and Current rules complete 120 idle ticks and an eight-cell opening capture under both turning policies with three lives. Browser rendering and installation checked. Full-clear balance remains unverified.
