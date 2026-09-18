# v0.61.20 — verified deployment, phone layout correction remains

[Play v0.61.20](https://mekhovov.github.io/revealline/releases/v0.61.20/site/game/). [Current phased plan](progress-and-next.md).

The Enemy Workshop startup-close correction is deployed through [publication PR145](https://github.com/mekhovov/revealline/pull/145), controller `cb5699291108958ebf773ceecbf807a0078eada4`, [run 35380080948](https://github.com/mekhovov/revealline/actions/runs/35380080948). The immutable game source is `d51acab59232edc4e7f77ab5df491f2c403de709`; publishing and game source are separate identities.

All **3,178 deployed files / 642,414,414 bytes** matched their recorded inventory, with zero failed requests, retries or skips. The subsequent authority check confirmed the same release, selector, controller and deployment. All 91 catalog records remain present. This does not repeat full HTTP qualification of all historical archive bodies.

Actual public keyboard testing passed startup Role → Presentation → Escape, restoration to Open workshop, repeated Back without stealing focus, forward navigation and Return to the exact game edition. Desktop, 390px portrait and short landscape were exercised.

**Native presentation remains partial.** At 390×844 the wrapped Return to game button starts exactly at Open workshop’s bottom and obscures the bottom of its focus outline. The focus-restoration fix works, but the required full-ring phone check fails. A separate 16px flex-wrap spacing correction has passed local Standard checks at 320/390/844px; it is not yet deployed. Large/Plain consumption in Enemy Workshop is a separate unfinished issue. The earlier media-picker border-clearance failure also remains until the independently qualified correction is published.

[Root review](review.json) preserves these limits. [Originals index](originals-index.json) pins every unchanged original in [the evidence archive](originals.zip), including requests, response rows, live authority checks, helper sources and native observations. Screenshots from the root browser were displayed inline only; no exported image is claimed. Viewport keyboard tests are not physical touch/controller certification. No full win, offline, audio, BFCache, screen-reader or whole-phase acceptance is claimed here.

Earlier preparation-time reports remain unchanged. This receipt records the actual deployment as checked on 18 September 2026, rather than qualifying later controller changes.
