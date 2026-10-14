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

The tracking fixture is being reconciled with intended current behavior: each invalid edit must produce its own diagnostic, pack installation preserves the open draft, and opening the installed version requires an explicit Edit action. Initial failed receipts are retained. They are not reported as successful runs.

## Remaining priorities

1. Complete current Creator reimport, exact restoration and interrupted-transaction browser checks; publish any demonstrated runtime fix independently of the prior UX queue.
2. Capture moving replay windows, repeated loading/unloading and measured renderer/memory behavior on the named target devices. Do not extrapolate these stationary callback observations to those budgets.
3. Finish the combined native-package/offline recovery journey. Source fixtures with isolated storage and scripted controls remain distinct from an unchanged admitted-player installation journey.
4. Continue the representative art standard and Canals, with the remaining licensed-resource candidates reviewed individually. No new scenery is included here.
5. D6 additional unit coverage and final regression qualification. Physical radio, Steam Deck, iPhone and novice acceptance remain unverified and do not block independent implementation.

Evidence is under `docs/evidence/fpv-integrated-continuation-20261014/`. Publication and deployment are separate: do not call this work live until the public marker and actual SIM launch identify the admitted merge or a verified descendant.
