# Round 17 — v0.7.0 working-source gates

All six once-only source gates passed. The root test run passed **902/902 tests**, with zero failed, cancelled, skipped or TODO cases. That root run already includes the motion-lab, controller and practice tests. None of those suites was run again as a separate gate or added again to the reported total.

The run used **Node v22.22.2**, beginning **2026-09-12T09:52:21.971Z** and recording completion at **2026-09-12T09:52:33.249Z**. Package version was **0.7.0**, with a working tree based on **cd44b343d29fc51c20e9cef191f4dd83dacc7471**. This identifies tested source, not a frozen release or an unchanged checkout of that commit.

## Results

| Gate                                       | Observed result                             |
| ------------------------------------------ | ------------------------------------------- |
| `npm test`                                 | 902 passed; minimum guard 899               |
| `npm run lint`                             | Exit 0; zero-warning policy                 |
| `npm run format:check`                     | Exit 0                                      |
| `npm run format:native:check`              | Exit 0                                      |
| `npm run validate`                         | Exit 0; 103 files; literal references valid |
| `node --check authoring/motion-lab/app.js` | Exit 0                                      |

Each command ran through `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates.json) retains exact commands, durations, exit statuses and raw-log hashes. The test guard also required the pass count to equal the total and every failure/skip/cancellation/TODO count to be zero. The minimum detects an unexpectedly small run; it is not a product-completeness target.

The content validator reported the base `first-signal` campaign's **12 levels, four themes and seven classes**. Its four navigation warnings point to the separate motion lab, Round 9 reference atlas, release browser and native diagnostics. They are not missing literal runtime resources. The base-level count is not the total including expansion maps.

## Stable inputs and report inspection

All **247 source inputs** matched before and after the gates. There were no changes during the run. Both aggregate SHA-256 values are:

```text
f08a9677150f99307920f9802898a9a6e9254db494ac34b3ae2d38c5ff48d51b
```

[source-inputs.json](source-inputs.json) records each path, byte count and hash. The inventory includes tracked and non-ignored untracked files under `game/`, `scripts/`, `platforms/`, the motion lab and authored Homeward source library, plus package/lock and ESLint configuration files. Other documentation and this evidence note are outside that tested-input scope.

After the run, a separate inspection rehashed all six raw logs, the runner, both input indexes, every recorded source input and every recorded prior evidence file. Test totals were parsed again from the saved TAP log. The two reports here are byte-for-byte copies, created without replacing earlier files:

| Report               |  Bytes | SHA-256                                                            |
| -------------------- | -----: | ------------------------------------------------------------------ |
| `source-gates.json`  |  5,110 | `6b12648f2126f7d747b4ba712591657fb0e99f4b66b1e69187860956c77062a2` |
| `source-inputs.json` | 41,732 | `abd85099d74869b998dfd6504a897b3ea615b5b85bd184f3cc9fb2e70c81c097` |

The [local gate directory](../../../.cache/round-17/source-gates/) retains the runner, raw logs and before/after indexes. Its cache files are local evidence, not promised contents of the distributed game. No source formatting, runtime changes or gate reruns occurred while producing this report.

## Previous evidence and limits

All **888 prior evidence files** under `docs/verification/round-16` and `.cache/round-16` were unchanged. Their before/after inventory aggregate is:

```text
b30eaf3513bbb7b4dfdee2ae70e4e8fb2afe748d04411c0149d18283476f3e65
```

The compact report references complete before/after evidence indexes with their own hashes. This preserves Round 16 screenshots, logs and integrity artifacts; it does not replace verification of a new release archive.

These results establish source tests, static validation, formatting and syntax. They do not certify frozen artifacts, browser accessibility trees, physical controllers or touch hardware, iOS/WKWebView behavior, native compilation, store distribution, multiplayer networking or player enjoyment. [Source-browser observations](source-browser.md) are recorded separately; frozen releases and actual target devices require their own evidence.
