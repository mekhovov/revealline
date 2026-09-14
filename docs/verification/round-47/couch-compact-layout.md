# Couch controls at compact viewport sizes

The v0.38 candidate keeps both complete wide arenas visible and places optional direction pads outside them. Auto follows the accepted input for each player; Always also permits pointer testing. Menus and results hide the pads. These settings do not change steering, hit geometry or solo progress.

Portrait layouts stack the two boards. At tablet widths, an enabled pad occupies a separate side column. Short landscape windows use the outer sides: Player 1 on the left, Player 2 on the right. Direction targets retain their 44 CSS-pixel minimum. The two wide boards necessarily become smaller on a narrow landscape phone; this is a viewport layout, not a claim of equivalent device comfort.

The parent inspected native browser screenshots at 390 × 844 and 844 × 390 through the existing Viewport Lab. Its preview is not scaled, and its surrounding scroll region can clip the embedded viewport in a screenshot. In portrait, both wide boards and pads are arranged vertically; a separate screenshot after scrolling the lab shows the match HUD. At 844 × 390, the corrected outer pads, complete arenas and shared Pause action fit the embedded page.

An ordinary pointer tap on Player 2 Down completed a cut at 1.5% / 340 points / three lives while Player 1 remained at zero / three lives. Movement stopped after capture. An earlier round in the same session reached 51.5% / 12,060 points. Those different captures reflect different encounter timing, not a fixed expected score. The raw paused-menu and unsuccessful focus/selector probes remain retained alongside the successful play observations.

Evidence is under the root repository's `.cache/round47/couch-compact-native/`: `01` and `02` show portrait; `03` retains the earlier landscape layout; `04` is a paused-menu observation; `05` and `06` show the corrected outer pads and live play. The root also retained the separate tablet evidence in `.cache/round47/couch-responsive-native/`.

This source observation does not establish physical touch, controller hardware, sustained performance, or frozen/public release qualification. Those gates remain separate. See the [installed chapter contract](../../couch-installed-chapters.md) and [shared delivery workflow](../../feature-delivery-workflow.md).
