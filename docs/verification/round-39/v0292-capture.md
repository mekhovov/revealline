# v0.29.2 ordinary-capture correction — frozen and locally verified

Frozen source **`d611f1429272ce402db6c38dde763bd3e15498cb`** passes all six exact-source gates and **2,374 tests**. Independent artifact verification and the actual local frozen entry/migration/capture/offline journeys below pass. **P7.7 remains in Verification** until PR CI, Pages deployment and actual public-byte/browser checks pass. This committed handoff is not a public-delivery receipt; final status belongs to the [v0.29.2 GitHub Release receipt](https://github.com/mekhovov/revealline/releases/tag/v0.29.2). No later phase starts.

## Preserved v0.29.1 failure

Frozen v0.29.1 source `90b974bfd733ccb11d74383e154467bd172b31d0` passed six exact-source gates and **2,364 tests**. Its independent rebuild/ZIP/offline inventory also passed. The distribution ZIP SHA-256 is `0f90b09e61cd769eaeac4c57b2a843a0f0650c3f7f74807958e4c95907af3385`; the original source, tag and artifact remain unchanged.

The actual frozen browser's ordinary initial **Down** route in First Light R4 reached its first capture (about 51.4% in the owner's state inspection), then threw **Classic event horizon bound exceeded** from `classic-step.mjs:397`, before the next HUD/paint update. A separate browser with its frozen server stopped reproduced the same exception. Successful title startup and saved-flight restoration remain valid observations; they do not make the full offline flight a pass.

Retained console evidence:

- `.cache/round39/browser/capture-hud-console.json`: local frozen route, error at `2026-09-13T04:39:37.510Z`.
- `.cache/round39/browser/offline-capture-console.json`: independent stopped-server route, error at `2026-09-13T04:41:23.252Z`.

The earlier v0.29 mutable-entry failure is a separate issue. Public network bytes matched, but a previously visited browser did not finish startup. Older cached completion remains an inference because resource/cache provenance was not inspected. The controlled stale-app HTTP fixture separately proved visible missing-readiness recovery. The immutable-entry implementation remains the delivery approach; it cannot substitute for successful simulation/flight checks.

## Passed bounded source checks

The actual source browser completed the initial Down cut in First Light R4 and kept the simulation running for about 20 seconds. After Pause, the HUD/paint showed **51.4% revealed, 12,240 points, three lives and 2:10 remaining**, with **Paused** and the focused Resume action. The owner's browser error/warning query returned `[]`. Evidence: `.cache/round39/browser/source-capture-repaired.txt` and `.png`. This is source-browser evidence for the reported route, not a frozen or stopped-server v0.29.2 pass.

Both actual-host regression cases pass: **Immediate** and **Grid + buffer** run the first Down cut through modeled 60 Hz/batched fixed steps, continue another 60 frames, then pause and verify the saved replay. The host exercises the actual app/core/recorder; browser/frame/input boundaries are modeled. Evidence: `.cache/round39/capture-host-regression-attempt-2.log` (**2/2 passed**).

The separate immediate-pause presentation check now passes with the affected suite (**6/6**): Pause refreshes its label and hides touch controls before another animation frame, while the authoritative checkpoint stays unchanged. The same regression against the prior source failed with `running` instead of `paused`; that failure is retained in `.cache/round39/pause-regression-before-fix.log`, with current success in `.cache/round39/pause-presentation-test.log`.

The final repair defers recovery until a repeated zero-time penetration in unchanged geometry, preserving historical simultaneous capture, erosion and failure processing first. It places the actor in the nearest legal domain footprint with deterministic ties and continues the complete remaining tick. It adds no saved state, changes no authored recipe and does not raise the event guard or skip simulation time. Pause also refreshes its presentation synchronously.

The final three-file core change passed **116 affected tests, including seven new regressions**, and the separate 18-route Classic Lab verification. Existing R2/R3/R4 suites preserve 36 exact wins and four R3 impact demonstrations: **54 historical winning routes** in total. The prior frozen core still reproduces both expected first-cut crashes; its due-erosion control passes in historical order. Final host regressions also pass **2/2** after this timing hardening (`.cache/round39/capture-host-deferred-recovery.log`). The source-browser screenshot above predates the final timing hardening; the final frozen-browser confirmation is recorded below.

The bounded source checks remain separate from the completed final local gates below and the still-pending public delivery. The earlier v0.29.1 failures remain part of the record.

## Final frozen artifact and local browser checks

The independent audit matched **221 loose files, 217 manifest assets and 218 ZIP entries**, including exact fresh-Git/tested/frozen source identity and ZIP payload/CRC checks. Offline inventory: **211 files / 44,868,447 bytes**, build `3b992fb3bf3a698b376566ecbee0d3b6ab08b6e25213d15a7ed3d932d7ebf360`. All 35 earlier release trees and 36 prior tags remained unchanged. Evidence: `.cache/releases/verification-d611f1429272/source-gates.json` and `.cache/round39/revision-audit-d611f1429272-attempt-1/integrity.json`.

- Annotated tag object: `6211817554fc82bfc65b8c15bf825beb82301859`, pointing to the exact source above.
- Source TAR SHA-256: `bc51b40531ce011340fae8c82a193de98de4cee2cec9445c3c38f982f9e28cc9`.
- Distribution ZIP SHA-256: `deaec14a53aa2a0730b1e3a31e555efdc29e42cbfdf23cf9dbe8197b83ee6986`.
- Manifest SHA-256: `200666542c68b8101cda686a4adc88b7a0582c08232cc03f0ee9a8c7fc94b3ca`.

Actual browser observations used the prepared frozen Pages artifact on localhost port 8889:

1. Established an older v0.28 offline baseline (201 files), Large text and an R3 saved flight at 2:29. Opening the new canonical edition reached Ready while the old tab remained unchanged.
2. After normal closure of the old root tab, mutable `/game/` entered the v0.29.2 canonical edition with query/fragment preserved. **Review/Copy earlier progress** explicitly transferred the earlier flight/preferences. R3 restored at 2:29, then explicit Resume produced a live cut and ordinary life loss to two lives. Large text transferred. Reopening v0.28 confirmed its original save remained at 2:29 and three lives.
3. The final frozen R4 first Down capture completed online at **51.4%, 12,240 points and three lives**, with continued simulation to **2:05** and correct paused HUD. The captured console error/warning result was empty.
4. Prepared and verified all **211** v0.29.2 offline files. The owner stopped the 8889 server and confirmed no listener. A new offline tab restored the saved capture at **51.4% / 12,240 / three lives / 2:05**. A fresh offline R4 Down attempt independently completed its first capture at **51.4% / 12,240 / three lives / 2:07**, with an empty console result.

The local migration used normal lifecycle and explicit progress copying; it did not clear caches/profile data or force takeover. Browser evidence remains under `.cache/round39/browser/v0292-*`: old offline/saved baseline, root upgrade, copied/restored/resumed flight, original old save, transferred preferences, frozen first-capture and offline saved/fresh-capture snapshots, screenshots and console JSON.

## Prepublication gate status

| Gate                                            | Status   | Evidence / remaining work                                                                                                                 |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Exact source and historical/core regressions    | Complete | d611f1429272ce402db6c38dde763bd3e15498cb; six gates, 2,374 tests; historical results retained                                             |
| Immutable freeze and independent rebuild        | Complete | Exact source/manifest/ZIP/offline identities above; prior releases/tags unchanged                                                         |
| Local frozen entry and saved-progress migration | Complete | Actual old-worker lifecycle, explicit progress copy, original old save unchanged; Large text and explicit Resume verified                 |
| Local frozen online and stopped-server capture  | Complete | Ordinary first Down capture, continuing simulation, HUD/pause and independent saved/fresh offline checks passed                           |
| Public delivery                                 | Pending  | Reviewed/merged PR with passing CI, successful Pages workflow, all public bytes and actual public fresh/previously visited migration/play |

The prepared main Pages output contains **1,650 files / 457,600,452 bytes**. Those local totals are not a public network result. Final CI/run identifiers, public inventory and actual live-site acceptance will be attached to the [GitHub Release receipt](https://github.com/mekhovov/revealline/releases/tag/v0.29.2); a locally frozen version alone does not establish delivery.

No old release is overwritten. No cache/profile deletion, forced takeover, changed proof oracle or hidden error is an acceptable shortcut. Player controls remain authored by their edition; R4 still has no manual Scan, Supply or Boost. Root aliases must continue to select one complete immutable graph.

Physical-device support, direct-file browser behavior, human enjoyment, P3 binary-media restoration, Tactical demonstrations, P5 authoring and full P6 production remain separate unfinished work. See the [v0.29.1 evidence](../round-38/v0291-entry.md), [roadmap](../../implementation-roadmap.md) and [delivery workflow](../../feature-delivery-workflow.md).
