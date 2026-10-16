# Solo regression evidence snapshot

As of **2026-10-16 10:43 UTC**, **1,721 of the original 1,948 files** have complete
observations at their recorded source revisions; **227 remain unobserved**. This
combines the historical local 1,233-file snapshot with 488 disjoint remote files.
It is not a complete-suite pass or a single-revision result. Remote failures still
include unresolved groups. The [machine-readable ledger](solo-regression-audit.json)
binds each source, comparison and retained result to SHA-256 evidence.

The original 715-file continuation at `90f4d1a0` / runtime `49c0b6c1` has retained
423 complete files: 301 passed and 122 failed. Its separate 70-file recovery queue
at `845e2a1e` / runtime `e0252ff8` has retained 65: 39 passed and 26 failed. Two
resource-aborted recovery files remain incomplete in that attempt. The retained
sets have no overlap. All 225 referenced artifact archives passed digest, ZIP,
source and test identity checks. These figures are frozen checkpoints, not live
run totals.

Supplementary receipts classify 23 complete baseline files. Twenty-one reproduce
all 65 named candidate failure diagnostics; seven storage-write diagnostics differ
only in random writer UUIDs, with the exact raw differences retained. The
route-loader baseline also has one additional failure. The original soundtrack
and selection-bookmark files pass on baseline and required separate clock/paint
fixture review. These comparisons do not increase the unique-file progress above
or turn failed files into passes.

| Later canonical fixture evidence                               | Retained result and limit                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soundtrack host at `9768c2eb` / runtime `e0252ff8`             | 30/30 pass after an explicit neutral clock anchor and assertions against the retained hidden paint. Stream, pause/resume, checkpoint and durable-state checks remain intact.                                                                                                          |
| Team default entry at the same source                          | 8/13 pass; all five failures match the paired baseline. Bounded identity formatting prevents cyclic DOM assertion output from exhausting memory.                                                                                                                                      |
| Team picture recovery focus at the same source                 | 17/18 pass; its one focus failure matches the paired baseline. The canonical full file now completes, rather than receiving credit from its prior resource-aborted attempt.                                                                                                           |
| Selection bookmark at `050d8ea3` / runtime `e0252ff8`          | 3/3 pass, preserving 12 input ticks and exact saved checkpoint/selection assertions after a neutral clock anchor.                                                                                                                                                                     |
| Team presentation ownership at `a8af8fdc` / runtime `f7b66590` | 4/4 pass. The earlier `050d8ea3` 2/4 failure is retained. The corrected fixture distinguishes 32 pooled actor leases from 10 snapshot-owned roles, preserving the initial 42 resources, rejected-load ownership, accepted snapshots, partial cleanup and exact close-once assertions. |

All supplementary comparison and canonical-file receipt hashes are in the ledger.
Remaining remote failures are still unclassified where exact baseline or canonical
proof is absent. No new production defect is inferred from a fixture hypothesis.

The table below preserves the **earlier local snapshot**, without adding later
retests or remote results twice.

| Evidence                           | Recorded result                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Original completed-file TAP totals | 14,013 tests: 13,587 passed, 394 failed, 32 cancelled; none skipped                                            |
| Failing completed files            | 74: 73 reproduce exact baseline diagnostics; one candidate-only Canvas2D fixture gap was repaired and retested |
| Remaining original files           | 710 host/build-lane files and five unit-lane files                                                             |
| Files added after inventory launch | Three at that checkpoint; its repository inventory was 1,951 files                                             |
| Later-added archive test           | 5/5                                                                                                            |
| Later-added CPU-profile test       | Three cases within the separately recorded 37/37 qualification group                                           |
| Later-added startup-evidence test  | 4/4                                                                                                            |

The baseline is `b11745223861c3973ad4bf440cc536198b8e0371`. The local snapshot froze game runtime
`49c0b6c1f9cfbc66c2a0fbf0a262eed95cc1ac9b`; later remote recovery uses
`e0252ff8f6b7f5ac84721fd5994c74e8469fb271`. Original file results span their
recorded source revisions; later runtime-boundary retests are separate evidence.
The local snapshot's qualification-tooling proof is at
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

Four further correctness files were later committed, outside the original
inventory. Complete remote observations retain dense replay/persistence **3/3**,
pending verification across public Next/Retry **2/2**, and touch latency **4/4**
on their recorded corrected sources. The same touch test fails **0/4** on the
preceding source, preserving the regression proof. These are Node correctness
checks, not native timing or physical-device acceptance.

The first meaningful-input cadence run is **1/2**: keyboard movement, all nine
schedules and interruption recovery passed; gamepad setup attempted Start twice
after automatic controller joining. Its unchanged correctness assertions are
queued in a corrected complete-file run at `605cbd6d`, before 46 exact-baseline
comparisons in run `38888826217`. The original failed run remains retained.
These four files bring the repository count to 1,955 if there are no other
additions; the original 1,948-file partition remains unchanged. Later Demo power
changes require their own revision-specific checks.

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
finished at **06:24:49.335452 UTC**. That receipt applies to the first calibration window only. Later authorized
fixture checks and remote artifact retention have separate timestamps. The
08:31:25–08:31:33 retention overlap is preserved in its receipt; the parent excluded
that first cold pair and collected a separate replacement. No timing acceptance
is inferred from regression progress.

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

Keep both lanes paused until resource ownership is coordinated. The baseline source snapshot is now preserved externally; restore it into a new
owned directory and verify its exact source and hydration receipts before running
local comparisons. A missing input is a setup failure, not a baseline waiver.

The pending continuation set is exactly the immutable 1,948-file list minus the
1,233 unique completed file entries, including failed completed files. Its 715
entries have no overlap with completed files and retain their original indexes
and current test-byte hashes. The three later additions and eleven changed-test
retests remain explicit supplementary evidence. The remote continuation and guarded recovery now run with immutable dispatch
commits and manifests. Their retained checkpoint and supplementary baseline /
canonical fixture runs are listed in the ledger; incomplete or resource-aborted
files receive no complete-file credit.

The local two-worker successor passed 11 isolated control checks but has never
run the real inventory. It requires the five unit files to finish, a globally
paused natural boundary, verified termination of only the idle owned runner, and
validation of all prior result/log hashes. It rejects duplicates and unaccounted
pending logs. Build, copy, and CLI fixtures stay exclusive; other host files may
use at most two distinct processes. It remains unused while remote continuation
and recovery run.
