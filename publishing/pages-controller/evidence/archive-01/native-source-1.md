# Archive publication and migration rehearsal

Recorded 2026-09-13. **Canonical archive bytes pass public verification; the local v0.26.0 migration rehearsal passes the exercised save, collection and offline journeys. Production forwarding from the old main-site URLs remains pending.** Browser actions and deployment observations below belong to the release owner; this report independently reads their retained records. It adds no browser run, release or storage mutation.

## Public archive and preserved failures

Archive infrastructure is pinned to source `b2e1ff3e99da1731429f50a306e756593f296cba`. The owner reports archive-repository revision `5eb3d3c` and successful [deployment 34731824490](https://github.com/mekhovov/revealline-archive-01/actions/runs/34731824490), using `actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9` (v5.0.0) with `include-hidden-files: true`.

The completed [public audit 3](../../../.cache/round37/archive-hosting/public-archive-01-attempt-3/report.json) is **PASS**: all **3,888 files / 754,925,608 bytes** at `https://mekhovov.github.io/revealline-archive-01/` returned matching decoded lengths and SHA256 values, with the required runtime MIME types. There were zero failures, retries, skipped files or changed local inputs. Its [inventory](../../../.cache/round37/archive-hosting/public-archive-01-attempt-3/inventory.json) and [per-file results](../../../.cache/round37/archive-hosting/public-archive-01-attempt-3/results.jsonl) include the empty `.nojekyll` and 31 historical `.xonix-build.json` files. This covers 31 canonical versions through v0.26.0; it does not mean every version was played in the browser.

Two earlier attempts remain failures:

- [Attempt 1](../../../.cache/round37/archive-hosting/public-archive-01-attempt-1/fatal.json) stopped locally on an unexpected hidden metadata file before HTTP requests. The auditor was corrected to include the finite hidden-file allowlist.
- Adding `include-hidden-files` to v4 was ineffective: [deployment 34731608651](https://github.com/mekhovov/revealline-archive-01/actions/runs/34731608651) succeeded with an unsupported-input warning. [Audit 2](../../../.cache/round37/archive-hosting/public-archive-01-attempt-2/report.json) found exactly 32 hidden-file HTTP 404 failures; all other 3,856 files / 754,923,965 bytes matched. The pinned v5 deployment corrected transport without removing files from the audit.

The earlier [local artifact verification](../../../.cache/round37/archive-hosting/verification.json) separately records exact canonical copies and preservation of 4,153 frozen local files plus 33 tag refs. Public byte verification does not replace those preservation checks or browser migration checks. See the [archive hosting contract](../../archive-hosting-design.md) for exact canonical files, old HTML/worker forwarding exceptions and original GitHub Release ZIP downloads.

## Local browser rehearsal

The owner started and later stopped the isolated server on `127.0.0.1:8882`. It served frozen v0.26.0, source `dfde7383440aafc292b5c83f4e471367075f71e4`, under separate `/old/` and `/archive/` prefixes. The [192 frozen / 12 migration-file pins](../../../.cache/round37/migration/inputs.json) and [fixture instructions](../../../.cache/round37/migration/README.md) define the boundary: original runtime and worker bytes stay exact; generated forwarding HTML and retirement worker substitute only the production canonical base with the loopback base. HTTP headers are local fixture headers. This is a browser rehearsal of the transition, not production URL-byte equivalence.

The owner prepared the old scope's 184 offline files and kept its game running while enabling the route switch. A real First Signal win followed: **52.2%, 8,160 points, three lives, Gold**. The [result DOM](../../../.cache/round37/browser/migration-live-win.txt) shows `0:03`; the owner observed 3.46 seconds. The [earlier paused view](../../../.cache/round37/browser/migration-before.txt) and [saved second mission](../../../.cache/round37/browser/migration-saved-second.txt) bracket that journey. Next selected Relay Orchard, which was paused and saved. No injected gameplay state or fixture session was used for this win.

With another old tab still open, a cached old navigation continued to display the historical game and its [writer-contention warning](../../../.cache/round37/browser/migration-waiting.txt). The [request log](../../../.cache/round37/migration/journey-1.jsonl) records the retirement worker fetched at 02:00:55 UTC. After the owner closed both controlled tabs, opening the old link with `?migration-check=1#saved` reached the canonical game. The log records the old forwarding HTML and canonical request with the query at 02:01:16; fragment retention is the owner's browser observation because fragments are not sent in HTTP requests. No forced navigation of the running attempt was observed.

Continue verified the saved **Relay Orchard** and restored it paused, still requiring Resume, as the [restored DOM](../../../.cache/round37/browser/migration-restored.txt) shows. [Collection](../../../.cache/round37/browser/migration-collection.txt) retained First Signal, 8,160 points, Gold, First light, Clear skies and Golden line, plus the first-clear appearance unlock. The [unaltered screenshot](../../../.cache/round37/browser/migration-earned-picture.jpg) visibly shows the earned First Signal collection card; it is not a separate full-screen picture-dialog capture.

The canonical prefix needed its own normal Prepare offline, which the owner observed verifying 184 files. The log records its original frozen worker and asset fetches. The owner then stopped this server (exit 0; the log ends with `server-stop` at 02:03:14 UTC). A canonical offline reload and Continue again produced [verified paused Relay Orchard](../../../.cache/round37/browser/migration-offline-restored.txt). The log contains one unrelated `/favicon.ico` 404; it is retained. Asset precaching of secondary HTML is not evidence that every secondary tool was opened interactively.

## Public storage observation and remaining cutover

On the still-existing public v0.26.0 old path, the owner reported an initial offline-preparation timeout followed by a successful retry. The [retained success snapshot](../../../.cache/round37/browser/old-public-offline.json), despite its `.json` extension, is DOM text: **184 / 184 files, 56,284,432 bytes**, build `fef70c4d837ebd19c9bfdece2899e68209fe8745645df6e1c5f12575de1f0a87`. It does not preserve a structured record of the initial timeout.

Opening the new public archive on the same HTTPS origin exposed the existing saved flight. [Public restore](../../../.cache/round37/browser/archive-public-restored.txt) verified Orchard Window paused with three lives and 2:29 remaining. Both that capture and the [contention capture](../../../.cache/round37/browser/archive-writer-contention.txt) say another tab owns saving. This demonstrates preserved same-version storage and writer isolation; it does not claim the second tab could persist changes while that warning was active. The owner deliberately retained old public tab 201 for the future main-site transition.

Actual production old-HTML forwarding after main cutover, its cached-worker transition, and current-root acceptance are still open. No physical-controller/device, all-version playthrough, universal offline-retention or completed v0.28 delivery claim follows from this report.

## Evidence pins

| Retained record               | SHA256                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| Public audit 3 report         | `7a4bf8021bbbae69dc2e8596473ee73bde4faaf10bc35925c5eadc7eb4543439` |
| Public audit 2 failure report | `2c44a51709e57e99dac2d5b8b195e9b317d3c16d89ef1b3ecba11e99b007d903` |
| Local fixture inputs          | `064ded1544bd80ad29e9dea759c89e2296814ea3ce539430f90afb4996fadbfb` |
| Local browser request log     | `bccf4c59ec86d73560352290673cc11c8e8e010d7e4a403585fad5103bd10e3d` |
