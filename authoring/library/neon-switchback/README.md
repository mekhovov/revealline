# Neon Switchback

The eighth screenshot reconstruction in Neon Reference Pack, permanent level #330. The explicit 92 × 46 source mask preserves the angular red hazard maze, isolated red squares, cyan stepped divider, and six-by-two-tile revealed bridge at its center. Moving sprites and particle trails are excluded from the tile mask.

The source is projected into the 70 × 34 interior of the supported 72 × 36 board. Forward mapping preserves narrow features and keeps the engine’s continuous safe outer rail. Cyan walls block movement. The central opening is a safe foundation where cuts can close; it is not an impassable wall. Red terrain is lethal until captured.

Six pink ringed bouncers begin at the screenshot’s upper-left, two left-middle, lower-left and two upper-right positions. Four cyan patrols begin at the top of the divider, middle-left, middle-right and lower-right perimeter. The player starts at bottom center. Speeds and directions are approximated from trails. Rings use an original pink sprite and existing bouncer behavior; a still screenshot cannot establish a separate armor or ability mechanic.

Goal: 75%, three lives. Custom reveal artwork and Ukrainian translation remain deferred. Source screenshot pixels are not embedded. Regenerate with `node scripts/build-neon-switchback.mjs`, then `node scripts/build-neon-reference-pack.mjs`.

Validation: scenario and pack schemas pass. Archive and Current rules each initialize and survive 120 idle ticks in immediate and buffered turning. An opening route from bottom center to the safe bridge closes a 192-cell capture with all three lives in both turn policies. Browser geometry and enemy placements were reviewed. Unit tests and full-clear balancing remain deferred.
