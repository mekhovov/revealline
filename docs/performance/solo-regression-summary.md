# Solo regression evidence snapshot

The original repository inventory has completed **1,233 of 1,948 files**. It is
paused with **715 files remaining**. This is not a complete-suite pass. The
[machine-readable ledger](solo-regression-audit.json) binds the inventory,
individual comparisons, later retests, and raw logs to their SHA-256 hashes.

| Evidence                           | Recorded result                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Original completed-file TAP totals | 14,013 tests: 13,587 passed, 394 failed, 32 cancelled; none skipped                                            |
| Failing completed files            | 74: 73 reproduce exact baseline diagnostics; one candidate-only Canvas2D fixture gap was repaired and retested |
| Remaining original files           | 710 host/build-lane files and five unit-lane files                                                             |
| Files added after inventory launch | Three; current repository inventory is 1,951 files                                                             |
| Later-added archive test           | 5/5                                                                                                            |
| Later-added CPU-profile test       | Three cases within the separately recorded 37/37 qualification group                                           |
| Later-added startup-evidence test  | 4/4                                                                                                            |

The baseline is `b11745223861c3973ad4bf440cc536198b8e0371`. The frozen game runtime
is `49c0b6c1f9cfbc66c2a0fbf0a262eed95cc1ac9b`. Original file results span their
recorded source revisions; later runtime-boundary retests are separate evidence.
The latest qualification-tooling proof is at
`4f9db963b0966f98a707f130363247a222c9e861` and does not change the game runtime.

Baseline reproduction applies to the named diagnostics and executed assertions.
It does not turn failures into passes or grant coverage to cancelled tests and
assertions after an earlier failure. Existing Team goldens, registry assumptions,
access-page expectations, and decoder fixtures remain visible. Production
validation, expected goldens, and test deadlines were not relaxed.

Eleven completed test files later received faithful fixture repairs. Their current
test bytes match retained complete-file or complete-group retests. Those results
are not added twice to the original totals. The repaired Solo actor-appearance
file remains **15/16**, with a separately paired selector timeout. The complete
candidate-Solo file remains **16/18** on both revisions because two old assertions
read nested capture-envelope fields from the outer object. The remaining
assertions in those two cases have no coverage credit.

The added audio-fixture test was already present in the original launch inventory,
although it was then uncommitted. It is not a fourth post-launch addition. The
existing qualification test also remains in that original inventory; its combined
37-case proof must not be counted again as 37 additional repository tests.

## Timing isolation

The final inventory child exited at **2026-10-16 06:09:42.887615 UTC**. The runner
records this timestamp after waiting for child exit and reading the complete TAP.
The later **06:12:40** message was a manual confirmation, not the pause transition.
The child had exited 60.112385 seconds before calibration began and 116.112385
seconds before the first timing pair. This establishes the owned test boundary;
it does not establish absence of unrelated system load.

After the interrupted timing batch, the five authorized baseline comparisons
finished at **06:24:49.335452 UTC**. All local test lanes remained paused afterward.
No test, build, bulk archive, or continuation run is authorized during the current
timing window.

## Reproduction and continuation

Use Node **22.22.2**, `CI=1`, and complete files without test-name filters or deadline
overrides. Each original admission used:

```sh
CI=1 /Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node \
  --test --test-concurrency=1 path/to/the-complete-test-file.mjs
```

The ignored task helpers and their exact hashes are listed in the ledger. The
existing `reproduction-tools-v4.tar.gz` archive has SHA-256
`7704c17e6687efa975a2b04359c86796e0351860fdca3b45c8c9958ea24ee17f`.
It preserves the original runner, comparison helpers, controls, and inventory;
it predates the optional continuation helper and latest receipts. Raw TAP,
comparison proofs, and the expanded historical ledger remain at their referenced
ignored evidence paths. No new bulk archive was made during timing.

For an independent fresh inventory after a quiet-window clearance, extract the
task helpers into `.cache/solo-followup/regression-audit/`, verify their hashes,
and give the original runner a **new, nonexistent output directory**:

```sh
python3 .cache/solo-followup/regression-audit/solo-complete-suite.py \
  --root "$PWD" \
  --out "$PWD/.cache/solo-followup/regression-independent" \
  --node /Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node \
  --pause-lane host --pause-lane unit
```

Keep both lanes paused until resource ownership is coordinated. The retained
baseline tree must match the exact baseline source and hydration receipts before
running comparisons. A missing input is a setup failure, not a baseline waiver.

The pending continuation set is exactly the immutable 1,948-file list minus the
1,233 unique completed file entries, including failed completed files. Its 715
entries have no overlap with completed files and retain their original indexes
and current test-byte hashes. The three later additions and eleven changed-test
retests remain explicit supplementary evidence. A separate remote continuation is
being prepared for review; no remote result is claimed here.

The local two-worker successor passed 11 isolated control checks but has never
run the real inventory. It requires the five unit files to finish, a globally
paused natural boundary, verified termination of only the idle owned runner, and
validation of all prior result/log hashes. It rejects duplicates and unaccounted
pending logs. Build, copy, and CLI fixtures stay exclusive; other host files may
use at most two distinct processes. It remains unused while remote continuation
is considered.
