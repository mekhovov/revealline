# Whole-originals Journey traversal tests

The complete v3 and v4 Solo and Versus traversals each have their own test entry:

- [v3 Solo](../game/test/whole-originals-host-v3-solo.test.mjs)
- [v3 Versus](../game/test/whole-originals-host-v3-versus.test.mjs)
- [v4 Solo](../game/test/whole-originals-host-v4-solo.test.mjs)
- [v4 Versus](../game/test/whole-originals-host-v4-versus.test.mjs)

All four call the unchanged setup and scenario bodies in the same-directory
[scenario helper](../game/test/whole-originals-host-scenarios.mjs). The helper is
not a collected test entry. Each scenario creates its own in-memory storage,
database and host; host cleanup restores the process-local globals and painter
methods. Fixture URLs still resolve from the original directory. No shared disk
profile or cross-scenario result is required.

The split preserves every 71-mission traversal, 70 Next transitions, exact
picture/theme and checkpoint assertion, failed Solo preload, stopped input and
profile/save assertion. It does not change gameplay, fixture bytes, timing,
runner concurrency, workflows or release admission.

The completed PR225 run `35691421851` recorded these previously sequential
scenario durations: v3 Solo 1,620,981.165231 ms, v3 Versus 359,038.516996 ms, v4
Solo 1,385,312.459661 ms and v4 Versus 364,877.586389 ms. Their sum is about 62.17
minutes. These are historical CI measurements, not a speedup prediction or player
loading times. Separate entry files let the existing file-level runner schedule
them independently; extra setup, CPU contention and other test files still affect
wall time.

Structural qualification must compare the exact registration names, route IDs and
callback modes; prove the scenario body bytes are unchanged; and verify complete
Git-tree discovery remains exhaustive and disjoint across all four shards. At the
original `9b26f2a` base this replaces one of 887 test entries with four, yielding
890 entries while preserving every other entry. Counts must be recomputed when
other tests are added. A sparse working-tree count is not complete-source proof.

Local syntax, formatting, registration and runner tests do not run these long
traversals. Before accepting the change, require all four complete hosted
traversals and the exact-source gates, then compare measured wall time and
resource failures. Do not skip editions, reduce assertions or change timeouts to
claim a faster pass. Frozen releases and their existing qualification receipts
remain unchanged.
