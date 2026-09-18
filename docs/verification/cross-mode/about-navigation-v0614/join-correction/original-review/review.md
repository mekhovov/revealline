# About v0.61.4 independent review

**Changes required: one P2 controller focus defect.** Source `61cf9c14e8f4a97eae81e7c30d0191029adc817a` was reviewed against parent `58ff1b1da3c5487412e168ce34539866ac2f4970`.

At `site/about-navigation.mjs:82`, joining with a controller leaves BODY focused. After release, a fresh Confirm focuses and activates Return in the same sample. A player receives no visible selection before the page exits. The retained actual-module modeled probe reproduces this. Engage the navigation owner on a fresh join, preserving meaningful existing focus, and cover join/release/held Confirm in the About host tests. Root has assigned a successor correction; this source is not unconditionally approved.

The bounded audit passed all **162 path/mode/body pins** (14 feature, 3 version, 145 evidence) and **287 tested input bodies**. Original eight-file cohorts each show **199/199 on Node 20 and Node 22**. The **103 historical originals** remain separate from those cohorts; all 142 copied originals match their committed copies. Source and index were clean at both audit boundaries.

Routing, explicit navigation, SELECT Escape, repeated input, async departure and lifecycle boundaries were inspected. Shared navigation/router and production output boundaries are unchanged. No other actionable blocker was found within this scope.

This is source/evidence review plus a finite modeled regression probe. No new full suite, browser, physical-controller, hosted CI, release, source edit or remote action was performed. The forthcoming corrected commit still needs its targeted re-review and final-source qualification.

Machine-readable details and hashes: [review.json](review.json), [path pins](path-pins.json), [evidence audit](evidence-audit.json).
