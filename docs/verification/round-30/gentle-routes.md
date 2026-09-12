# Gentle routes: reproducible source evidence

The repository now retains **58 legal winning routes: all 29 shipped maps in both Immediate and Grid + buffer**, drawn from the earlier Gentle audit. The new [proof JSON](../../../game/replays/gentle-routes.json) contains the exact selected commands, releases, setup, expected summaries and complete checkpoints. Seven source descriptors identify the base campaign and six packs by pack/campaign ID, original campaign key and canonical Gentle key. Repeated level/roster data, ignored-cache paths and audit-only metadata are omitted.

This is source/core/replay verification during implementation. It is not a completed browser, release, hardware or human-balance acceptance claim.

## Reproduce from checked-in content

From the repository root, with the supported Node toolchain:

```sh
mise exec node@22.22.2 -- node --test game/test/gentle-routes.test.mjs
```

The [test](../../../game/test/gentle-routes.test.mjs) loads the actual shipped campaign, class recipes and indexed packs, structurally validates the packs, filters each campaign's declared roster in pack order and calls `createDifficultyContext(..., 'gentle')`. It checks exact source keys and the complete map/policy set, so a missing, duplicated or wrongly attributed route cannot silently reduce coverage.

Each route starts through `createRun` and `createRecorder`. Only `stepRun(..., FIXED_DT)`, `recordInput` and the public release APIs advance it. The test rejects commands after a terminal result, checks the real coverage target and required objectives, compares the full summary/checkpoint, then verifies the exported replay through the existing version dispatcher. It never assigns coordinates, cells, tick, status or a fabricated summary. Ordinary core-v2/replay-v3 and Sentinel core-v3/replay-v4 remain unchanged. Pack structure/header validation here does not decode pictures or install a browser pack.

The one scoped run passed **59/59 tests**: 58 route cases plus one exact coverage/ownership case. The routes contain **79,717 ticks per execution pass**; replay verification performs its own reconstruction. Every selected run finishes with five lives. The longest takes 3,751 ticks; 56 routes use Interceptor and the two Sentinel routes use Scout. This does not establish completion with every class. Scoped ESLint, Prettier and diff checks passed; no old standalone audit or broad suite was rerun for this publication.

## Provenance and preserved initial failures

The [original winner index](../../../.cache/gentle-routes/winning-routes.json) is **131,397 bytes**, SHA-256 `e20f4cefb096b256e98f25428cfed88a1e26f6a4371d7b8e428dddb91e891c53`. Extraction checked every selected replay's recorded size/hash, setup, summary and checkpoint, then checked exact command/release/expectation equality again after formatting. All **36 module/content/old-proof pins** in that index still match after the new test. Earlier Standard proof files and expectations were only read.

The preserved [initial probe](../../../.cache/gentle-routes/initial-probe/report.json) tried Standard input sequences under actual Gentle rules: **34 won and 24 remained unfinished**, even though all 58 resulting replay envelopes verified. Those 24 attempts were not winning proofs. The [ordinary search](../../../.cache/gentle-routes/ordinary-solutions/report.json) found new commands for 22 cases; [Sentinel retiming](../../../.cache/gentle-routes/sentinel-solutions/report.json) supplied the other two. Slower hazards can change which region a cut captures, and longer warnings require different waits. The original probes, search scripts and logs remain intact. The [audit narrative](../../../.cache/gentle-routes/README.md) also describes separate missed-opening/recovery routes and eight restored Sentinel prefixes; those are outside this selected 58-route fixture.

| New evidence                                                |   Bytes | SHA-256                                                            |
| ----------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| [Proof JSON](../../../game/replays/gentle-routes.json)      | 203,443 | `4debc2838b70ca9b3edf0aa2e869b8f697a500ac04f946b120956367d0c22eca` |
| [Route test](../../../game/test/gentle-routes.test.mjs)     |   5,276 | `bc24c25ad96fd4839c6323e005c99cc6e0ff3b45de9dee84ce3e8796759a94de` |
| [Scoped TAP](../../../.cache/gentle-routes-public/test.tap) |  12,353 | `e1be8ba2644ddef1c01419bf6edfe489e782f63a9146bcd23015ff300dd6acad` |

The [verification record](../../../.cache/gentle-routes-public/verification.json) and [extraction record](../../../.cache/gentle-routes-public/extraction.json) preserve the command, source pins and comparisons; [stderr](../../../.cache/gentle-routes-public/test.stderr.log) is empty. Cache links are local provenance, not dependencies of the checked-in test.

Independent read-review found no concrete authority or coverage gap. It compared all 58 original replay sizes/hashes and exact retained fields, rehashed the 36 source pins and checked the saved TAP totals. It did not rerun simulation or tests.

All selected routes are short. They do not test the separate 30-minute recorder or 7,200-second collection limits, prove library awards, exercise UI cancellation, or certify image decoding and physical controls. See [Campaign difficulty](../../campaign-difficulty.md) for those boundaries and the wider verification contract.
