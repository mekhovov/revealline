# Optional CI timing tooling: current-main intake

Reviewed on 2026-09-29 against current-main source
`b5ab06e12542f72e33c45b973ba693a5e1509c1c`. This is a scoped tooling
candidate, not workflow activation, a measured hosted speedup, source
qualification, or a game release. The existing 2026-09-22 receipts and local
activation proposal remain unchanged historical evidence.

The source worktree remains at `95fa082d3907ee012decae60bb023abb2fc8abd2`.
Extract only the six paths below and this document onto current main; do not
merge that historical branch wholesale. The runner and its existing test file
have no intervening main changes outside this candidate's opt-in additions.
The four other code/test paths are absent at the pinned main source. No workflow,
package/version, production profile, release record, or game source is included.

| Path                                    | SHA-256 of reviewed source                                         |
| --------------------------------------- | ------------------------------------------------------------------ |
| `scripts/run-test-shard.mjs`            | `e596d2ffdb41c0e70dad64eee20f9c9705ad7a3e89c3da4da6fef30e28d840d3` |
| `scripts/test-run-test-shard.mjs`       | `0cfc6bf879b70a4e187067933afeda87155ff70bad45259d512b2f6e12e186d8` |
| `scripts/file-timing-reporter.mjs`      | `d367e36e58f3766bd9322507517faab3207c288b13c969300ed872edb6eca7ee` |
| `scripts/test-file-timing-reporter.mjs` | `d4114f80c29830551a4858259935524a4b48e143272d2b399cd902675fa5a836` |
| `scripts/convert-test-timings.mjs`      | `314610a617f0c1ef93c37ef70c5e97905068f7d344b9966bd48b28d13dea0356` |
| `scripts/test-convert-test-timings.mjs` | `dfbaa0e8ebd3c5f9d2342f222fe091de152ae83ee83279df3bde84881afadb1e` |

## Contract and review

Without `--timings`, the runner retains its current sorted round-robin selection
and child Node invocation. Explicit timing profiles only influence assignment:
the selected source supplies the inventory, every discovered test is assigned
once, removed profile entries never execute, and new tests receive a median
fallback cost. Test failures still produce a failing process exit.

The standalone reporter retains real Node file-container duration, including
module startup, rather than summing concurrent case durations. It runs alongside
ordinary TAP and rejects incomplete, failed, skipped or mismatched samples.
The converter requires four complete, disjoint streams, exact raw hashes and
successful run/job/source receipts, and checks the materialized full checkout's
test inventory and bytes against its Git tree. It never executes that checkout's
tests. Existing output files and output symlinks are refused.

Independent read-only source review found no blocker against that scheduling
contract. Operator receipts are not cryptographic authentication: a trusted
collector/reviewer must bind the actual hosted run, workflow/tool hashes and
environment. Local path checks and a one-time inventory check are not a
race-proof filesystem sandbox. Run conversion against a stable, trusted full
checkout; do not claim adversarial concurrent-directory or checkout-mutation
protection. Profile syntax validation does not authorize its workflow use.

## Fresh focused checks

The following complete cohort passed **27/27** on both installed Node
**20.19.5** and **22.22.2**, with zero failures, skips, todos or cancellations:

```sh
node --test scripts/test-run-test-shard.mjs scripts/test-file-timing-reporter.mjs scripts/test-convert-test-timings.mjs
```

Coverage includes selected-source execution, failure propagation, exact-once
partitioning with new/removed tests, actual Node reporter streams through the
converter, source/inventory mismatches, malformed and incomplete evidence,
overlapping shards, path/size refusals, and preserving existing output bytes.
Synthetic load reduction proves assignment behavior only. Test fixtures use
temporary repositories and local synthetic run/job identities; they are not
hosted acceptance receipts.

Scoped ESLint, Prettier and whitespace checks pass. No source correction was
needed during this intake review. No full test suite, game build, full-source
profiling run, hosted comparative pilot or workflow activation was performed.

## Integration boundary

Rerun this focused cohort on the eventual current-main intake commit. A separate
reviewed activation must obtain actual complete telemetry, bind its provenance,
compare baseline/weighted hosted runs, and retain the authoritative release
gates. This intake alone supplies no timing profile and enables no new workflow.
