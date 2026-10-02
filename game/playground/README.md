# Text and symbol levels

Open **Content Studio → Create a level from text or a symbol image**, or go to
`game/playground/#symbol-generator`. The picture campaign creator links here too.

1. Enter one to three lines (up to 16 characters each), or choose a tightly cropped
   PNG/JPEG/WebP symbol, up to 4 MB. High-contrast silhouettes work best. Processing
   stays in the browser; image headers and dimensions are checked before decoding.
2. For images, adjust the threshold and invert light-on-dark artwork if needed.
3. Choose lethal or slowing terrain, a surrounding layout, a title and a seed.
4. Preview the generated arena. Apply adopts it as a normal editable Foundation
   scenario; Undo restores the previous map. An input or draft change invalidates
   the preview, so a late image decode cannot replace a newer edit.
5. Use the existing map tools, game Preview and scenario download to refine,
   play and save/share the result. The current reveal picture is preserved.

The main motif occupies a 60 × 24 grid inside a 72 × 36 arena, with open margins,
three enemies and optional safe islands or staggered walls. The source image is
traced into terrain rectangles; it is not automatically used as the reveal image.
Use the existing artwork controls to choose that picture separately.

New symbol levels use reachable-route coverage. The editor shows the number of
cells counted toward the goal and the bonus territory excluded from it. Existing
Classic/Foundation maps can opt in with **Use reachable-route coverage**. Layouts
with no valid return route are rejected before replacing the working draft.
