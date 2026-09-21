# Team settings on compact screens

Source-only correction on d166a45d; independent of frozen v0.77.0 / PR211.

The previous dialog scrolled its heading and Back button offscreen. At 568×320 with Large/Plain text, focusing Text style moved Back to y=-356. Navigation tabs also extended below the dialog before scrolling. The fix retains the heading and categories, scrolls only the chosen panel, uses four tabs on short wide screens and keeps the full preference-scope explanation in Game data → Read details. Display replaces the long tab label; the panel retains its descriptive heading.

`observations.json` records native CUA keyboard journeys and measured rectangles for the original failure and corrected 568×320, 320×480 and 390×844 layouts. Native selects were operated with Space, direction and Enter. Reading exit, Settings exit and explicit Resume retained the correct focus/paused ownership. No console warnings or errors were observed. These browser results do not certify physical touch, Safari or Steam Deck input.

The three focused test files pass 46/46 under Node 20.19.5 and 22.22.2. Initial sparse-checkout failures and successful reruns are both retained. The local server served exact d166 Git objects except the two hashed working files; request receipts are retained. The original baseline log records the pre-edit run. No runtime JavaScript or simulation identity changed. The server was stopped and viewport override reset after verification.

This delivery remains held for integration, full qualification, version allocation and public deployment. It does not alter PR211 or close P18.
