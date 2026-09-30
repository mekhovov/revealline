# Neon Crossfire

The tenth screenshot reconstruction in Neon Reference Pack, permanent level #332. The explicit 86 × 44 source mask preserves eight cyan crosses, twelve vertical bars, eight horizontal bars, red corner brackets, stepped fields, square patches and isolated red squares. Cyan tiles obscured by white impact flashes are restored from the visible cross/bar geometry. Moving trails, glow and translucent impact polygons do not become static obstacles.

The source is projected into the 70 × 34 interior of the supported 72 × 36 board, preserving narrow wall segments and the continuous safe outer rail. Red terrain is lethal until captured. Cyan walls block movement; they are not safe return surfaces. There are no interior foundations.

Six yellow bouncers begin at the screenshot’s upper-center, two upper-right, two lower-left and lower-right positions. Three cyan patrols begin at two top positions and the middle-left edge. The yellow player starts at bottom center. Grid reduction requires a 0.15-cell leftward adjustment to the lower-right bouncer so its collision circle remains clear of the nearby bar tip. Directions and speeds are inferred from trails using existing enemy behavior.

Goal: 75%, three lives. Custom reveal artwork, Ukrainian translation and unit tests remain deferred. No source image pixels are embedded. Regenerate with `node scripts/build-neon-crossfire.mjs` then `node scripts/build-neon-reference-pack.mjs`.

Validation: scenario and pack schemas pass. Archive and Current rules each survive 120 idle ticks and complete a compact four-cell opening capture with three lives under immediate and buffered turning. A long rightward opening is intercepted by the lower-right enemy, so the opening check uses a short cut. Full-clear balance remains unverified.
