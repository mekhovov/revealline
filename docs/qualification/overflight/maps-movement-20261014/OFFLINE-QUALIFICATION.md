# Native offline qualification — 14 October 2026

Fresh installation, interrupted-update recovery, all five FPV operations, Snake, the corrected Creator launch and the corrected launcher return passed bounded browser checks. **One imported mission was reported missing after the first successful update; that observation remains unresolved.** A later update retained the reinstalled mission, but does not erase the earlier failure.

The [native browser receipt](native-offline-browser.json) records the actual UI actions in Codex Chromium 155 on `http://127.0.0.1:8936`. The test host served unmodified production output and returned HTTP 503 for every non-control origin request during offline checks. This is browser-cache and origin-unavailable evidence, not OS-icon installation, a physical network-disconnection test or complete playthroughs.

## What passed

| Check | Observed result |
| --- | --- |
| Fresh installation | Native Settings → Content & Offline installed Solo Starter, all Overflight operations and Snake Classic. The UI showed 106.2 MiB selected, both mode packages Ready offline, 0.0 MiB remaining and setup complete. |
| Offline operations | Fresh native navigation and Start advanced Single Drone, Riy, Single Raid, Time Attack, Contract Marathon and Snake while origin requests returned 503. FPV observations ran 12–27 gameplay seconds; Snake reached its normal failure/retry screen. |
| Interrupted update | The changed mandatory `game/ui/battlefield-ground-controls.mjs` deliberately returned 503. The unchanged installer rejected the candidate with the exact resource integrity error. With the entire origin then unavailable, the previously installed custom mission still reached 17 seconds, 15 destroyed enemies and an earned upgrade. |
| Retry/update | Clearing the resource fault let the native UI report **Update verified and selected**, with both mode packages ready and no remaining download. This verifies recovery of the game installation; imported-library retention has the separate limitation below. |
| Corrected Creator flow | After explicit reimport on `4dab801d9`, the exact package validated, previewed and installed. With Contract Marathon remembered in another game tab, ordinary Install and play correctly opened the Survivor mission. Reload and Start worked under origin denial, reaching 17 seconds, 15 kills and an earned draft. |
| Launcher and second update | Before the `4dab → e914` update, Creator was closed and the custom mission was independently reopened under origin denial. After update selection, Open app launcher from the updater reached the cached launcher and main Home with the origin unavailable. The same custom package still launched and reached 17 seconds, 15 kills and an upgrade without reimport. |

The mission retained compiled identity `12c9251df37ee67e` and installed identity `784aaf99b3089951`. The [Creator routing receipt](native-creator-routing.json) preserves the earlier normal-flow failure; explicit-URL workarounds are not counted as that flow passing.

## Exact production generations

All three ran the normal `prepareBuildProject()` validators and generators. No hand-built manifest, bypassed check, expanded disk build or archive substituted for production preparation.

| Source | Build ID prefix | Mandatory cache | Receipt |
| --- | --- | --- | --- |
| `3bb1b0dc66ae77baf59d0e89ab9edf257a244d10` | `b2edbc1dc157` | 1,673 files; 66,185,808 bytes | [Initial generation](native-offline-build.json) |
| `4dab801d9ce03b42227e99388b066c378c81ca02` | `8d1da69f5f02` | 1,673 files; 66,190,965 bytes | [Routing generation](native-offline-build-upgrade.json) |
| `e914f3bdd8e36b9b78d794da4f1342dcda449e00` | `a6bc422f1a06` | 1,673 files; 66,191,296 bytes | [Launcher-fix generation](native-offline-build-launcher-fix.json) |

Full build IDs and source hashes are in the receipts. [Origin validation](native-offline-origin-check.json) confirms the stable browser scope without upstream redirects. The [first comparison](native-offline-generation-comparison.json) identifies all 33 changed mandatory resources and the actual fault URL; the [launcher comparison](native-offline-launcher-fix-comparison.json) records its 331-byte cache increase and exact committed worker template. The unrelated regional preview merged while the last build ran was temporarily restored to the tested source, then restored from its safely retained commit. Final freeze checks passed; the receipt's worktree status against the newer HEAD does not change its recorded `e914` source boundary.

## Remaining anomaly and limits

After the first successful `3bb → 4dab` update, the custom mission's exact URL reported that it was not installed. Reimport was necessary for the next Creator check. The [read-only investigation](native-package-persistence-investigation.md) and [source hashes](native-package-persistence-source.json) found no intended version migration, session-only storage or updater database-deletion path. No cause is established and no speculative storage patch was applied. The second `4dab → e914` retention check passed after closing Creator and independently reopening the installed mission before update. Further same-origin persistence reproduction is still required before claiming general preservation across updates.

These checks do not qualify every layout offline, every optional package, complete sorties, OS installation, physical airplane mode or the waived external devices. They do not establish audio quality or performance. Existing worker/closure tests supplement the native actions rather than replace them.

## Fix and harness provenance

- `4dab801d9` corrected Creator operation restoration; 32 routing/entry/package checks passed, followed by the native normal-flow check above.
- `e914f3bdd` changed only launcher navigation and its behavioral regression. Returning to the cached launcher no longer inherits the updater's network-only resource rule. Update documents, imported resources, ordinary fetches and other navigation still use fresh network responses. [Five launcher/updater checks passed](launcher-update-return-tests.txt), covering root/nested scopes, HTTP 503 and rejected network requests. The earlier [isolated worker probe](launcher-update-client-probe.json) proves the code condition; the unrelated fresh-tab `ERR_BLOCKED_BY_CLIENT` observation is not attributed to that condition.
- An initial qualification-only version label was rejected by the real installed-edition validator. The [rejected build](native-offline-build-rejected-harness-version.json) and [correction](native-offline-harness-correction.json) remain retained; the host now reads the real numeric project version. Production validation was not weakened.
- A [superseded preparation](native-offline-upgrade-b12d4a-interrupted.json) was stopped before completion so the Creator defect could be fixed. It is not a successful build or failed application test.
- The [production host](native-offline-server.mjs) and [stable-origin dispatcher](native-offline-dispatcher.mjs) remain task-owned. [Pre-restart state](native-offline-dispatcher-before-launcher-fix.json) and [final state](native-offline-dispatcher-final.json) preserve network/fault/generation history. The original `3bb` host on 8935, `4dab` host on 8937 and `e914` host on 8938 remain alive in memory; the dispatcher is restored online and idle. No publication or deployment is implied.
