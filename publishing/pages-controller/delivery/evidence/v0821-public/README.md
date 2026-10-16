# v0.82.1 public acceptance — 22 September 2026

**PASS, scoped to the evidence below.** [Play the release](https://mekhovov.github.io/revealline/releases/v0.82.1/site/game/) · [Pages run35745218885](https://github.com/mekhovov/revealline/actions/runs/35745218885).

Game source `64ec9fd2e5688f4248fe005ac6a47c0c1394ea9e` / tree `402f5f12d83cb86dbceb9d9dceec12731ea48980` remains unchanged. Publisher commit `1b16a858fdd4ab303629277b3cd1138fa2475f04` / tree `987cac851cc35188c67736270a762f845fa100d3`, deployment6594019441, selects the original frozen v0.82.1 release. This evidence-only change does not trigger a Pages redeployment.

## Public files and release identity

The [complete HTTP report](http/http-20260922T152007Z-06d3b4c8/http-report.json) verifies **3,777 files / 613,632,131 bytes** from the actual deployed artifact receipt: root aliases, catalog, canonical game and historical bridges. All lengths, hashes, MIME types, statuses and final URLs match. There are zero failures, retries or skips. The [independent final review](independent-final-http-review.json) reconciles every inventory/attempt/result row and the actual deployment authority. The 174,101-byte original receipt ZIP and raw API responses are retained; the large distribution was not downloaded again for this audit.

[Root/versioned release marker checks](public-markers/check.json) identify the exact v0.82.1 source and distribution. Both the distribution ZIP and source TAR download URLs returned HTTP200 through their public redirect chains. [Post-audit authority](post-audit-authority-check.json) confirms current main, successful deployment and all nine original release asset IDs/sizes/digests remained unchanged.

## Browser, recovery and offline play

The [native browser receipt](browser-acceptance.json) pins 31 supporting files from an isolated Chrome153 profile. The live two-tab session-only flow completed First Signal, retained results while Next prepared originals, then entered Relay Orchard. Native downloads produced two exact image originals plus game data. Workshop additive restore and re-export preserved both originals byte for byte; [checksum review](browser/roundtrip-byte-review.json) also matches them to the frozen manifest. Native game-data import restored the earned picture and saved Relay flight.

After verifying all896corefiles, the browser was closed and reopened with network disabled before canonical navigation. v0.82.1 loaded from its service worker; Continue resumed the restored flight, a native keyboard move captured50%, and Pause worked. The earned First Signal picture opened visibly from Collection while offline. Browser error logs are empty.

The [independent browser evidence review](independent-browser-evidence-review.json) verifies all 31 pins, native bundles, save identities and retained screenshots. Restart/network ordering remains attributed to the observing agent; this review did not rerun the browser.

These are desktop functional checks. They do not certify physical iPhone/controller/assistive input, a complete campaign, all offline music albums, listening quality or Ukrainian authenticity. Relay capture is not a claimed Relay victory. The retained automation attempt notes distinguish a stopped wait for incorrect text from a game failure.

## Music quick controls

[Independent public music checks](music/REPORT.md) passed in fresh isolated profiles: 90s Synth default, shuffle/repeat-all, eight advanced sections collapsed, Raspberry Jam playing, Next advancing to a different hosted song, Shuffle all, Metal style and Holizna album selection. Five sampled recordings reached a visible playing state with title/credit/source and hosted HTTP200 responses. Original loading/stalled automation attempts are retained separately from successful observations. No human listening, whole-library or offline-album claim is made. Browser profiles and caches are excluded from committed evidence.

## Preserved failures and review boundaries

PR264 preview35743815737 failed because three historical logs were ignored by Git. Exact original bytes were then committed; [independent successor review](independent-successor-git-review.json) verified all1,158 required Git-blob references. Fresh preview35744655331 passed before merge. Original log whitespace is intentional and must not be formatted.

Auditor preparation, the delayed-EOF deadline regression history, candidate/reviewed execution requests and local test evidence are retained separately. The actual network run used the corrected v2 helper and checked every expired completion. Transport operations have bounded inactivity timeouts rather than a claimed hard process deadline. Absolute paths in original receipts record their execution locations; retained bodies are unchanged.
