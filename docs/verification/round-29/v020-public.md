# v0.20.0 public deployment acceptance

**The publisher reported successful deployment and the focused public browser journey on 12 September 2026.** This record is attributed to the completed **Deploy RevealLine to GitHub Pages** task, `01a0961b-8c02-70c0-a4d3-0917cc9fe22c`, turn `01a09703-5666-73b3-a153-5b12ba3868ff`. The [preserved handoff and final response](../../../.cache/round-29/v020-doc-handoff/publisher-handoff.json) contain the source observations. Writing this report did not repeat the browser session, run gates or modify the release.

## Published identity

[GitHub Actions run 34713258835](https://github.com/mekhovov/revealline/actions/runs/34713258835) succeeded in **5 minutes 49 seconds**. The atomic push set remote `main` to **`a9578e0aecacf8d78fbc097406f5f603f5de41cc`** and annotated tag `v0.20.0` to object **`3adac423d22a47598997098145001f1ee3e3ea41`**, peeled to that commit. The publisher confirmed all **26 annotated tags** remained present, the isolated release worktree stayed clean and no untracked reports were staged.

The public build metadata returned version **`0.20.0`** and that exact source revision. The [landing page](https://mekhovov.github.io/revealline/), [solo game](https://mekhovov.github.io/revealline/game/), [couch race](https://mekhovov.github.io/revealline/game/couch/), catalog and archived v0.19 entry returned **HTTP 200**. The published label omits the frozen build's `v` prefix: this is source-revision agreement, **not a public/frozen metadata or cache byte-equality check**.

## Actual public journey

The publisher used the visible controls in a fresh public browser session:

1. The landing page showed v0.20.0. Installing **Night Shift** through its landing route made **Midnight Channel**, **Voltage Garden** and **Afterglow Sentinel** available in the couch Map selector.
2. Setup selected **Midnight Channel / 1994 Forever / Fiber relay / Grid + buffer / 30 seconds / reduced effects**. Escape at Ready retained **Start**. Native Start ran both players; Pause stopped both and exposed Resume; Resume restarted both.
3. Separate **Player 1 Down** and **Player 2 Right** on-screen inputs were accepted. The real round clock reached **0:00**, producing **Draw / time** with both players finished.
4. **Next round** started both players. **Show setup** paused both. **New match** reset to **Ready**, series **0:0**, clock **0:30**.
5. **Solo campaign** returned to the normal game with Night Shift still marked installed. The landing page's compact archive picker opened preserved **v0.19**.

The publisher reported empty console/page-error logs for this journey and no game-state writes. Inputs were software keyboard and native on-screen buttons; no physical controller was attached. The checks establish neither full-profile byte equality nor physical touch comfort, controller behavior or native-store readiness.

## Separate evidence and remaining limits

The [source gates](v020-source-gates.md) record **1,683 tests and six passing checks** on **354 unchanged inputs**. The [archive audit](v020-integrity.md) independently reproduces all **146 packaged files**, including equality with the local candidate. Its [offline and responsive browser report](v020-browser.md) covers local candidate behavior and retains the separate QA-frame exceptions and scrolling limits. These results are not additional runs of the public journey.

The publisher also retained nonblocking notices about a GitHub Action Node 20 runtime deprecation, with its runner forced to Node 24, and an existing moderate Dependabot alert. This handoff does not claim either notice was resolved. Public hosting and the observed native-control path are established for this deployment; future deployments, physical devices and sustained storage retention require their own evidence.
