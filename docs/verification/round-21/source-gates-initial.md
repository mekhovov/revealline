# Round 21 initial source gates — preserved failure

The first actual six-gate run used Node **22.22.2** against source version **0.11.0**. It completed on 12 September 2026 with **1,262 of 1,263 tests passing**. Lint, source formatting, native formatting, content validation and motion-lab syntax all passed. The test failure is retained; this is not a passing release gate.

The failed test is `expansion proof covers every supplied map and rejects altered geometry` in `game/test/expansion-playthrough.test.mjs`. `scripts/verify-packs.mjs` reported `Incomplete expansion proof`: the index now includes 17 maps, requiring 34 map/turn-policy routes, while the generic expansion proof still contains 32. Sentinel's separately verified routes were not yet included in that generic coverage count. No production edit or proof regeneration occurred during this run.

All **292 source inputs** remained unchanged:

`5f8a20c8029c528803aaa5bd917428520b1defb88b9b30de12efb98b815bf20d`

All **14 frozen releases**, their **1,384 files**, and **15 exact Git tag identities** matched the prepared baseline. All **2,569 prior evidence/frozen files** covered by this runner also remained unchanged. The preserved baseline is `.cache/round-21/integrity/frozen-releases-before-v0110.json`, SHA-256 `09a10e89db4e4f9c9f94c13f8907da9641bbd6b8c56367252f2e88815bd76b5b`.

- [Exact initial JSON result](source-gates-initial.json): 6,377 bytes; SHA-256 `e6cdbd977be4a944bc5cdf363762734a087cd9863ff93e5d1ac239f2e10a0f1b`.
- [Exact initial source inventory](source-inputs-initial.json): 49,716 bytes; SHA-256 `3c3df69a776e0ca5e1b26e41f4cd326fce2b688372ad43237057f771acc12bdf`.
- Runner, six raw logs, before/after source inventories and prior-evidence inventories: `.cache/round-21/source-gates-attempt-2/`.

Before this run, a runner-only preflight stopped on an incorrectly listed nonexistent `docs/verification/round-20.md`; no gate command had launched. That original runner and error remain under `.cache/round-21/source-gates/`. The corrected runner preserves the actual Round 20 directory and cache, releases, and the failed preflight itself. The root test command already includes the discovered motion/controller/practice suites; no extra focused run contributes to the 1,263 count.

A later repaired run must use separate cache paths and preserve these files. These checks do not certify frozen artifacts, browser interaction, physical hardware, native execution or player enjoyment.
