# Navigation and lifecycle follow-up — 17 September 2026

The refreshed [Xbox UI navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports retaining one predictable navigation pattern across the game: keyboard/controller access, focus following visible layout after reflow, a clear Back route and readable scaling without two-direction scrolling. Our application of this guidance is to finish Settings and remaining player journeys before campaign expansion. This is an implementation recommendation, not a certification claim.

[MDN’s persisted property documentation](https://developer.mozilla.org/en-US/docs/Web/API/PageTransitionEvent/persisted) distinguishes cached page transitions. Keep modeled persisted-event tests, ordinary browser Back observations and actual BFCache admission as separate evidence. A successful return through history alone does not prove the browser used BFCache.

No new mechanics or XPOSED behavior are inferred from these references.
