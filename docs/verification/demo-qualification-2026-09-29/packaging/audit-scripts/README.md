# Archived qualification audit helpers

These are the small custom helpers used alongside the repository packaging commands. They are retained so reviewers can inspect the assertions behind the receipts. **No checks were rerun while making this archive.** Runtime, browser harness, original receipts, and compressed inventories were not changed.

`manifest.json` records the retained script bytes, SHA-256, original temporary path, execution scope, and provenance. Ordinary copies preserve their original bytes and formatting. The one reconstructed helper variant and the transcribed Python stdin are explicitly identified below.

## Executed checks and receipt mapping

| Archive | Execution and corresponding packaging evidence |
| --- | --- |
| `initial/snapshot.mjs` | Initial 1,068-input before/after snapshots, `../source-{before,after}.json.gz`. |
| `initial/audit-partial.py` | Seven completed editions, 252 source/output/offline-inventory readbacks, and no captured source changes, `../edition-audit-partial.json`. The normal eighth edition failed its 64 MiB cap; this was a partial result. |
| `initial/diagnose.mjs` | Initial Dutch budget diagnosis, `../dutch-budget-failure.json.gz`. A loader hook added the already-computed inventory to the thrown Error in memory. It neither removed the throw nor changed the cap or repository source. |
| `before-confirm/snapshot-final.mjs` | Lossless-repair 1,071-input snapshots, `../final/source-{before,after}.json.gz`. |
| `before-confirm/audit-final.py` | Pre-Confirm 14-edition/506-readback audit and source comparison, `../final/edition-audit.json.gz`. |
| `before-confirm/audit-native.mjs` | Pre-Confirm web/desktop/iOS static audit, `../final/web-native-static-audit.json`. This is earlier evidence, not proof of the integrated candidate. |
| `integrated/snapshot-integrated.mjs` | Integrated c5e3419ee 1,985-input snapshots, `../integrated-c5e3419ee/source-{before,after}.json.gz`. |
| `integrated/audit-integrated.py` | Integrated 14-edition/506-readback audit, `../integrated-c5e3419ee/edition-audit.json.gz`. Its first statement compares the complete captured before/after file records and asserts no differences; no separate comparison executable is needed. |
| `integrated/audit-integrated-desktop.mjs` | Production desktop resource loader accepts the complete staged inventory, then verifies 38 exact response bodies, external-navigation denial, and an out-of-inventory 404; `../integrated-c5e3419ee/desktop-protocol-audit.json`. |
| `integrated/assert-desktop-mime.py` | Exact transcription of Python stdin executed after the desktop audit: all 38 recorded MIME values passed extension-specific assertions. This named file did not exist during execution. |
| `integrated/audit-integrated-native.mjs` | Integrated web/desktop/iOS comparison, 34 exact HTML-policy results, unchanged non-HTML web inventory, five permitted iOS additions, and 38 required source paths; `../integrated-c5e3419ee/web-native-static-audit.json`. One cosmetic scope-label ambiguity is documented next. |

The unused initial `audit.py` template was deliberately excluded. The reused official iOS bridge is a production build input, not an audit helper; its origin, size, and digest are recorded in `../integrated-c5e3419ee/ios-bridge-reuse.json`.

## One native-helper metadata correction

The integrated helper inherited the earlier report literal `newerConfirmIntegrationQualified:false`. It was changed to `scopeIsIntegratedSource:true` around the successful process completion. The exact ordering of that one edit and the process reading the file was not captured, so **we cannot establish which label variant was executed**. The complete assertion code, imported production functions, input paths, and checked payloads are identical in both variants.

Both variants are retained:

- `integrated/audit-integrated-native.mjs` is a byte-for-byte copy of the final temporary helper.
- `integrated/audit-integrated-native.before-label-fix.mjs` reconstructs the preceding variant by restoring exactly that one known literal. It is not claimed to be an independently preserved execution-time copy.
- `integrated/native-helper-label.diff` shows the exact textual difference.
- `native-label-history.json` records the change, current receipt digest, and independently retained manifest/snapshot hashes.

Only `../integrated-c5e3419ee/web-native-static-audit.json` was explicitly normalized after execution: remove `limits.newerConfirmIntegrationQualified` if present and set `limits.scopeIsIntegratedSource` to `true`. Its pre-normalization bytes were not separately retained. The helper may already have emitted the corrected label; no original-receipt hash is claimed. No assertion result was edited, and no earlier pre-Confirm receipt was relabeled. This archive does not replace any receipt.

The separate canonical stage/verify commands and their exit codes remain in `../integrated-c5e3419ee/native-command-results.json`, with their individual output receipts. They were unaffected by the custom helper label. Independently retained raw manifest hashes are:

| Payload | SHA-256 of manifest JSON before lossless gzip |
| --- | --- |
| Integrated web and desktop | `cc9a329986242fc136d3a68efe283f3a645625df6e90192e93e5650ee782a515` |
| Integrated iOS | `45f89abcff078a12bdb0c38ecd46b4e8a66019b90d06a8c0de486627d4a930f3` |

These hashes describe static payload qualification. No native executable launch, signing, physical-device qualification, publication, or release admission is implied.

## Historical paths and reproduction

The helpers assume the repository checkout is the working directory. They import production code from that checkout and contain historical evidence subdirectories. Snapshot helpers take an output JSON path as their first argument; audit helpers read the historical `locations.json` / `native-locations.json` files to locate generated bodies. The original helper locations were:

- `/private/tmp/revealline-demo-editions-qualification-20260929-3vaq5o0d`
- `/private/tmp/revealline-demo-native-qualification-20260929-ktn679r_`

The original checkout was `/Users/oleksandr.mekhovov/.codex/worktrees/community-admission/go_test`; Node was `/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node`. Temporary edition/native bodies were subsequently removed under the recorded cleanup receipts. These archived scripts are therefore assertion evidence, not turnkey commands to run against the remaining temporary files.

For fresh reproduction, the maintained repository commands remain canonical: `scripts/game-cli.mjs build`, `scripts/native-cli.mjs stage` and `verify`, and `scripts/check-menu-editions.mjs`. Follow their documented options using new task-owned output paths and the intended source revision. The integrated command receipts and README record the actual invocation details. Adapt copies of custom helpers to fresh locations if their extra comparisons are needed; retain this archive unchanged.

Large inventories now live in deterministic `.json.gz` archives. `../compressed-evidence.json` records original and archive hashes. The archived helpers preserve their historical `.json` paths and were not rewritten to accommodate later compression. Inspect compressed JSON in memory or in a separate review directory; do not restore raw copies into this evidence tree or rerun archival writers over existing receipts.
