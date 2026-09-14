# Archive-06 v0.44.0 browser acceptance

The canonical v0.44.0 release passed the bounded play/save/restore/offline/Collection journey in an isolated Chromium profile. The first offline preparation exceeded the UI's60-second wait; the worker finished afterwards and a normal retry verified all312 files. That failure remains in the evidence rather than being reported as a first-attempt success.

Canonical URL: https://mekhovov.github.io/revealline-archive-06/releases/v0.44.0/site/game/

Expected immutable game source: `fc789c71aa21a240c9966d874dd76e9daeb9f44b`. The separate server audit verified archive-06's700 files /596,830,969bytes before this journey (Actions run34887930586, deployment6444985593). That audit's publishing controller is not the controller-input merge branch. This browser check does not relabel the immutable edition as current P7 source.

Observed journey:

1. Fresh canonical visit showed VERSION V0.44.0 and the baseline title at1280×800 CSS pixels, DPR1.
2. Selected Base game /First Signal through Missions, returned to briefing, and started normally. Paused a running attempt. Changed Settings text size from Standard to Large through its native select.
3. Reloaded normally. Continue flight restored a verified paused attempt; Large persisted. Resume changed actual flight state to running. Frozen v0.44 still showed its old 'Press Resume' caption until the next gameplay message; this known copy defect is corrected separately in the P7 source and was not changed here.
4. A normal Down direction completed a cut and natural victory:52.2%,8,160points,Gold,11.91seconds; the result and unlocked picture appeared.
5. Settings → Prepare offline play first showed a timeout. Its registration subsequently became activated at `/revealline-archive-06/releases/v0.44.0/site/`, with the expected content-addressed cache. Pressing Prepare again returned ready. Pressing the resulting Verify offline files control reported312/312 verified,53,535,086bytes, no missing/corrupt files, build `ccd077d67de9f2a7ab386879d2b7420abdeebdba741841cafa7d20f230fad5ff`.
6. Used Next uncleared mission to select Relay Orchard, started and paused it. Enabled the documented browser offline emulation and reloaded the canonical address. `navigator.onLine` was false; the exact immutable worker controlled the new document. Large and Continue flight remained available.
7. Continue → Resume → Down produced an ordinary offline cut with refreshed board and HUD:52.2%,8,660points,0:10, target58%, flight still running, message 'Line secured. 52.2% revealed.' Paused afterwards.
8. Opened Collection and the earned First Signal full viewer while offline. The picture, Gold record, score and11.91s time remained available. Restored networking; final `navigator.onLine` is true. The test profile's saved flight and preference remain intact.

The `*-before-successful-click` images are retained intermediate observations where a text-based tool selector did not activate its target; they do not prove a successful Resume/viewer transition. Explicit visible ID/class targets after scrolling produced the separately recorded successful states. An early offscreen Missions interaction selected Night Shift in this isolated test profile before Base game was explicitly reselected; it is not used as an optional-pack offline acceptance claim.

The browser's page-error collector was empty after the successful offline cut. Screenshots of title, victory, offline flight, Collection, and the full viewer were inspected. No save/profile/cache bytes were rewritten, no worker was force-activated, and no unrelated profile was used. Worker scope/cache names were read only.

Scope: actual Chromium153 headless browser interaction using the authorized standalone agent-browser fallback. Offline means its documented network emulation, and reopen means a new page load via reload; this is not a physical network disconnect, browser-process restart, OS installation test, Safari test, or long-term storage-retention guarantee. Root-entry redirect/migration and second-version scope coexistence are separate checks. `receipt.json` binds all evidence files by SHA256.
