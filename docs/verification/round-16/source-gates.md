# Round 16 — v0.6.0 working-source gates

All ten automated gates passed. The root test run passed **784/784 tests**, with no failures, skips, cancellations or TODOs. The separately repeated motion-lab and focused controller suites are **subsets of those 784**, not additional unique tests: the tested CLI includes `authoring/motion-lab` in its normal test discovery.

This record summarizes the existing run; the independent review did not rerun it or change its tested inputs. The gate ran with Node **v22.22.2**, starting **2026-09-12T09:12:12.363Z** and recording completion at **2026-09-12T09:12:22.198Z**. Package version was **0.6.0**, on a working tree based on **ee11338195050e92f32cb1cf281a924cc368f765**. That baseline commit is not a claim that these uncommitted source changes were already frozen in a release.

## Results and recorded minimum guards

| Gate                          | Observed result                                   | Runner's minimum test guard |
| ----------------------------- | ------------------------------------------------- | --------------------------- |
| `npm test`                    | 784 passed                                        | At least 760                |
| `npm run lint`                | Exit 0; zero-warning policy                       | —                           |
| `npm run format:check`        | Exit 0; all matched files formatted               | —                           |
| `npm run format:native:check` | Exit 0; all matched files formatted               | —                           |
| `npm run validate`            | Exit 0; 98 source files; literal references valid | —                           |
| Explicit motion-lab tests     | 70 passed                                         | At least 70                 |
| Motion-lab `app.js` syntax    | Exit 0                                            | —                           |
| Controller navigation         | 31 passed                                         | At least 31                 |
| Controller preview and lab    | 40 passed                                         | At least 25                 |
| Practice navigation guard     | 8 passed                                          | At least 8                  |

Every command used `mise exec node@22.22.2 -- …`; the exact commands, duration, exit status and raw-log digests are retained in [source-gates.json](source-gates.json). Minimum guards detect an unexpectedly small run; they do not define product completeness. All test gates also required pass count equal to total and zero failed, skipped, cancelled or TODO cases.

The content validator reported the base `first-signal` campaign's **12 levels, four themes and seven classes**. Its four navigation warnings are links from the game to the separate motion lab, Round 9 reference atlas, release browser and native diagnostics. These warnings do not indicate missing literal runtime resources, and the 12-level result is not a count of all expansion maps.

## Exact inputs and independent inspection

The before/after source snapshot contains **234 files** with no changes during the run. Both aggregate SHA-256 values are:

```text
b9ddbeaeafb26d80a14e20c994d9b95aca898c801645f12a9f711f97147f83df
```

[source-inputs.json](source-inputs.json) records each path, byte count and SHA-256. The runner inventories tracked and untracked non-ignored files under `game/`, `scripts/`, `platforms/`, the motion lab and authored Homeward source library, plus package/lock and ESLint configuration files. General documentation is outside this source-input scope.

The independent inspection checked all ten raw-log byte counts/hashes, parsed test totals against their recorded results, verified the runner hash, recomputed the input-index aggregate and rehashed all 234 current input files. Each matched. The JSON files here are byte-for-byte copies of the original reports, written without replacing an existing report:

| Copied report        | Bytes   | SHA-256                                                            |
| -------------------- | ------- | ------------------------------------------------------------------ |
| `source-gates.json`  | 313,868 | `3a5f887147492da762f76bb9a42c1a957eda0f481622cc2837102b2ae9430f6a` |
| `source-inputs.json` | 39,580  | `9849454bc3ebf1ee74d6c79cf34b4ee403d3048310508485dd0007d794b33464` |

Original raw logs and the gate runner remain in [the local gate directory](../../../.cache/round-16/source-gates/). Their exact paths and hashes are in the copied JSON; these cache files are local evidence, not promised contents of a distributed archive.

## Preserved evidence and limits

The runner compared **850 prior evidence files** under `docs/verification/round-15` and `.cache/round-15` against its before-run snapshot and found all unchanged. The independent inspection rehashed every recorded file and confirmed the same bytes. This preserves the earlier screenshots, logs and integrity-workflow artifacts; it does not substitute for a new release-archive integrity check.

These are source tests, static validation, formatting and syntax checks. They do not certify a frozen v0.6.0 archive, live browser accessibility trees, physical controllers, Bluetooth, touch hardware, WKWebView execution, native compilation, store distribution or player enjoyment. Actual browser results belong in [the separate source-browser record](source-browser.md); frozen artifacts and target hosts require their own evidence.
