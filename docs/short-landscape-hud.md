# Short-landscape HUD sizing

Status: isolated correction prepared for integration; unpublished.

At 568×320 with Large/Plain text, the title/briefing state constrained its arena
panel to about 153px to fit board height. Four HUD columns retained their intrinsic
text widths and pushed the score to x616.7, wider than the 568px viewport. An open
Library dialog independently fit at 552px, masking the underlying page defect.

The correction gives non-running telemetry a centered viewport width inside the
existing safe-area gutters at the affected 521–680px landscape breakpoint. It does
not shrink text, clip overflowing content, change score formatting or resize the
running board. The title, Settings and Library share that underlying HUD.

## Native evidence

The exact source preview served 6c51b7e9 plus one SHA-pinned CSS override. At 568×320,
the title HUD now occupies x12–556 and document width is 568. Library client/scroll
widths both remain 552. Pause/resize checks at 521, 568, 680, 681, 320 portrait and 1280 desktop
kept document width within the viewport and retained focus on Resume. Explicit
Continue/Resume, Pause and keyboard menu navigation were exercised.

The running legacy 4:3 board remains fully visible at 148.4×111.3 in this extreme
Large-text landscape case. That is not a claim of satisfactory gameplay readability;
the broader compact HUD arrangement remains a separate P05 improvement. Do not
close the full responsive phase from this scoped overflow correction.

See [measurements](verification/short-landscape-hud/result.json). No generated
screenshot file or physical-device evidence is claimed. Repeat on the final merged
build, including high score/time values and wider campaign boards.

## Maintenance prompt

“Check active dialog and underlying document widths separately. Fix the container
that constrains readable HUD values without hiding overflow, reducing the selected
text size or changing the arena whenever a score changes. Verify every changed
breakpoint edge, paused focus ownership and explicit Resume.”
