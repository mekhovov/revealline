# Browser acceptance follow-up — 14 October 2026

The current source starts from merged PR #1191 (`460169d79`). Physical-device qualification and waiting for player feedback are explicitly deferred by the user. This pass completes the remaining bounded desktop visual review and fixes concrete source findings; it is not a player study.

## Actual browser coverage

- Inspected all 40 six-mission pages: all 240 official Lively FPV starting boards, using the production renderer at a 1200×1350 desktop viewport with titles hidden. Each board was approximately 366 pixels wide. Patrol Frontiers was revisited separately with a correctly sized screenshot after its taller cells exceeded the initial capture rectangle.
- Compared six Toybox chapters (36 starting boards): First Coils, Moving Quarry, Burst Timing, Island Circuits, the first six Signal Tactics missions, and Final Weave. These cover all six worlds. Moving Quarry was additionally inspected in Atmospheric Ruins and Night Arcade, including grayscale and collision outlines.
- Inspected the six Loaded Routes Toybox boards at a 320×568 browser viewport. Document width remained exactly 320 pixels, with no horizontal overflow. The board, chapter/look controls and pagination remain reachable in the scrolling review page.
- Opened production Courier Overpass at 320×568 and verified direct entry and the shared pause menu. The courier appears only after four catches: the actual older-courier ordering and localized guidance are covered by the host tests, not falsely claimed as a fresh browser playthrough.

## Findings and decisions

The first Freight inspection exposed repeated tiny dispatch cabins inside long components. The corrected production path now draws a connected facade, with one receiver equipment bank. Toybox's broader family cues distinguish greenhouse glazing, planted troughs, loading decks, pressure seams and floodgate slats rather than reducing each world to generic painted blocks. The source/render-command suite additionally checks family geometry without using color identity.

Open Loop remains obstacle-free. Long walls, elbows, islands, broken dividers and wrapping seams remain legible. Floor motifs stay behind actors and objectives; cargo, plates, switches and closed-gate crosses retain their existing shapes. No new false openings or decoration extending the occupied footprint were found in these inspected states. Quiet palettes and repeated chapter motifs remain an intentional family resemblance, not proof that all missions are visually unique or equally enjoyable.

The 240-board pass examines starting compositions, not all evolving cable configurations, animation phases or 960 individual board/look combinations. Existing representative motion/jamming and collision tests remain relevant; this cosmetic revision changes no collision rules, replay recipes, atlas allocation or retained-surface limit.

## Retained evidence

- `acceptance-toybox-freight.png`: connected dispatch facade and the chapter's six boards, with review controls visible.
- `acceptance-night-geometry.png`: grayscale and collision overlay comparison.
- `acceptance-gallery-mobile.png`: full 320px Loaded Routes page.
- Local `.cache/remaster/visual-acceptance/` contains the 40 page captures and additional Toybox samples. These redundant diagnostic captures are not bundled into the production site.

Physical thumb reach, controller hardware, thermal behavior and player preference remain untested by design. No enjoyment or physical-device performance claim follows from these screenshots.

The six-board Moving Quarry Toybox sample measured 72 synchronous redraws per path: uncached median 0.50 ms / p95 0.80 ms; cached median 0.10 ms / p95 0.20 ms. Terrain surfaces occupied 3.88 of 4 MiB with three retained boards. This is a bounded desktop rendering observation, not a frame-rate comparison against a matching earlier build, sustained gameplay measurement or physical-phone qualification.
