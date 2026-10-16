# Integrated reliability continuation — 14 October 2026

The current UX branch was reconciled with main without overwriting GitHub's concurrent native-stack updates. Recovery refs preserve the original branches. The initial four-branch atomic push was rejected by explicit leases after #1184/#1185 merged; the newer server histories were accepted instead. `rebase.json` and `range-diff.txt` record the original operation.

## Qualified baseline

All 135 existing control, radio, shell, flight and appearance checks passed after rebase. The existing Creator/content/offline baseline passed 56 checks. All three optional packages passed committed-input admission, ZIP validation and two identical builds on `6acc57d2b288abed26c745d40c1b97439440d04a`. Its full tree is identical to integration base `1189e3d9a42963c8c41ef77c1dbc9d284dbfa5ce`. These receipts retain their actual source identities; subsequent changes require their own qualification.

## Current-player observations

The new manual observer derives membership from the admitted package manifest, verifies every byte before launch, and embeds the unchanged native player. It does not replace the entry, advance physics, inject commands, arm or resume. Visibility/focus loss, menus, workload/settings changes and navigation invalidate the window. Incomplete receipts remain exportable.

Two 60-second windows were observed in the Codex in-app browser, reporting Chrome 155 on macOS, at 1075 × 988 CSS pixels and DPR 2, Balanced quality, FPV, Self-level, Touch. The drone remained stationary at launch with neutral controls; yard actors continued their ordinary simulation. This is a scheduling baseline, **not a moving-flight benchmark, GPU measurement, physical input-latency result, or device FPS qualification**.

| Scene | Callback intervals | Median | p95 | p99 | Maximum |
|---|---:|---:|---:|---:|---:|
| Container yard / The long hunt | 7,192 | 8.3 ms | 9.2 ms | 10.0 ms | 74.8 ms |
| Open meadow / Final circuit | 7,201 | 8.3 ms | 9.1 ms | 9.3 ms | 9.4 ms |

Both windows completed without a captured long-task entry. Observation runs can include other development activity on the same Mac; caches were not flushed. The raw receipt includes supported-observer flags, browser identity, exact package hashes and samples. The observer source received formatting only after these measurements; its frozen tested bytes and hash remain recorded in the fixture.

Run `node scripts/prepare-fpv-current-observation.mjs STAGED_PLAYER STAGING_RECEIPT NEW_DIST_DIRECTORY`, serve that directory, choose a workload, then Begin and deliberately focus/resume the player. A 30/60/120-second selector is available. Keep recorded flights at a fixed rate for future comparisons.

## Creator verification maintenance

The isolated source fixtures now contain 223 modules / 17,233,260 bytes. Their obsolete 192-module / 13 MiB bounds prevented execution. The reviewed fixture-only ceilings are now 256 modules / 20 MiB; the 6 MiB per-file limit and all shipped package budgets remain unchanged.

The tracking fixture now follows intended current behavior: each invalid edit must produce its own diagnostic, pack installation preserves the open draft, and opening the installed version requires an explicit Edit action. Native IndexedDB requests originate in the child player, avoiding cross-realm plain-object validation failures. Both fixtures reuse only existing origin access authorization in isolated memory and wait for the unchanged access gate to verify it; no credential is recorded. Shared menus own navigation. Initial failed receipts are retained and are not reported as successful runs.

The removal review now assigns each button its final enabled state once. Cancel stays enabled while loading/exporting, but is disabled during a committed removal. This avoids transiently disabling and blurring the safe focused action. The strict visible Cancel-focus check remains.

After the complete native UX stack #1180 merged, the continuation was rebased onto main `8cef2b9fee1e822a8681c94a0dbb5cf9dc6ad654`, preserving the newly merged Snake and shared reaction changes. Candidate `cdbe38ff4561db4a0710d7994d0ef4934b552e0a` passed another 135 existing integration checks, canonical projections, and fresh admission for all three packages with two identical builds. The World package has 126 members / 17,026,125 unpacked bytes. A subsequent focused Library fix changes these bytes and requires fresh admission before publication.

Observer review added a 250 ms boundary-coverage requirement, separate from performance. First/last callbacks and censored leading/trailing durations are recorded; a window with only an early callback followed by a long stall is incomplete. Four focused reproductions covered early-only callbacks, normal callbacks, delayed first callback and no callbacks. This is manual tool verification, not new D6 unit coverage. A separate audit of the original two receipts found trailing gaps of 7.3 ms and 3.2 ms; the original receipts are not relabelled as runs of the hardened tool.

The completed-card accessibility label now reads progress from the current Library row after a source or language refresh. A retired-row read interrupted Ukrainian rendering in the removal/restoration journey. Launch identity validation is unchanged. The canonical change and generated SIM projection passed 107 existing Library/projected-host checks.

The hardened observer also completed one 30-second stationary Castle Courtyard discovery window against the admitted `cdbe38ff` player: 3,578 callback intervals, median 8.3 ms, p95 9.2 ms, p99 9.4 ms, maximum 108.6 ms, with 6.9 ms trailing boundary coverage. The same limitations above apply.

The visible recovery journey then demonstrated a safety regression: restoring an interrupted flight reconstructed its paused command prefix, but the newer automatic-start path clicked Arm afterward. Restored flights are now excluded from automatic start and require deliberate pickup. The failed 82/83 receipt is retained; the fixed candidate passes all 90 browser checks, including exact revision restoration, transaction abort, cancellation, preserved records and deliberate recovery pickup. The existing recovery appearance assertion now expects paused; 55 focused World regressions pass. No additional D6 test suite was introduced.

## Final candidate

Rebased onto latest main `8b20276815da2684ac76872ae868fce4318dc471`, including the bottom-positioned shared menus. Final runtime `28450a208030c34098bd2e2b59f6a2237d55284e` / tree `2c6396c60cd320d4581e951021beaa7c62da8a2c` passes all three package admissions, committed-input and ZIP validation, and two identical builds. These remain non-public candidates. Final source browser runs pass Creator tracking 66/66 and pack recovery 90/90. The recovery fix was then covered by 55 existing focused checks; the preceding main rebase passed all 135 integration checks.

The final unchanged admitted World player was staged from verified package members and launched in the actual browser. Continue restored the existing Castle Courtyard discovery flight at 99.5 seconds and remained paused, showing Resume/Arm and the retained pose. No automatic arming occurred. This is a local admitted-player check, not a public deployment or offline-update qualification.

## Remaining priorities

1. Publish the verified reliability fixes independently of the merged UX stack; retain exact-head checks and normal protection.
2. Capture moving replay windows, repeated loading/unloading and measured renderer/memory behavior on the named target devices. Do not extrapolate these stationary callback observations to those budgets.
3. Finish the combined native-package/offline recovery journey. Source fixtures with isolated storage and scripted controls remain distinct from an unchanged admitted-player installation journey.
4. Continue the representative art standard and Canals, with the remaining licensed-resource candidates reviewed individually. No new scenery is included here.
5. D6 additional unit coverage and final regression qualification. Physical radio, Steam Deck, iPhone and novice acceptance remain unverified and do not block independent implementation.

Evidence is under `docs/evidence/fpv-integrated-continuation-20261014/`. Publication and deployment are separate: do not call this work live until the public marker and actual SIM launch identify the admitted merge or a verified descendant.
