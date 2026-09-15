# P01 asynchronous fixture readiness

Five affected fixture files now wait for their exact observable readiness through the existing `waitFor` helper and its unchanged five-second default. Runtime deadlines, simulation ticks, cancellation, artwork ownership and state assertions remain intact. The separate installed-original restoration allowance is documented in [the earlier correction](hosted-restoration-deadline.md).

On source `a03f62169b3ef8e3e24b3a36a578cb58d9ddbdc1`, [hosted shard 1](https://github.com/mekhovov/revealline/actions/runs/34954620765/job/104333928034) exhausted Replay Theater's 100-immediate-callback fixture loop before real replay verification reached artwork decoding. The test failed after 33 milliseconds. Real verification deliberately yields through timers; callback counts give those timers no reliable elapsed-time allowance.

An isolated, source-preserving preloader delayed one existing candidate-verification timer by 20 milliseconds. It reproduced the same failure before the correction and passed afterward. This proves the scheduling flaw without claiming that the precise hosted scheduler was reproduced. The [Replay receipt](reports/replay-readiness-correction.json) retains the controlling preloader, both outcomes, original failure and exact byte hashes.

The [audit receipt](reports/async-readiness-fixture-audit.json) covers 51 P01-changed test/helper/script paths. It identifies matching real-work waits in Studio Blob/WebCrypto preparation, offline response/hash verification, native module import failure and recovery catalogue bootstrap. Their predicates now use the shared helper. Known post-resolution microtask drains, controlled stubs and gameplay tick loops retain their semantics.

| Corrected full test files                        | Result       |
| ------------------------------------------------ | ------------ |
| Replay Theater navigation                        | 7/7 passed   |
| Studio host loading, offline, direct-tool launch | 40/40 passed |
| Profile recovery view                            | 9/9 passed   |

These are 56 passing tests across five disjoint files, with no failures or skips. The additional controlled Replay comparison is a focused run with six unrelated tests filtered; it is separate evidence. Formatting and lint checks pass for the changed files.

The local full run of the blocked `a03f621` candidate was deliberately interrupted after the hosted failure. Its partial log and matching before/after source identity are retained at `.cache/cross-mode/p01/exact-source-final/`; it has no completed aggregate result and is not a passing qualification. Hosted failures remain failures. The successor commit still requires fresh full qualification, an immutable freeze and public acceptance.
