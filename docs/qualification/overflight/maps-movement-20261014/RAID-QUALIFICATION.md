# Raid and package qualification

This is deterministic native simulation and local storage evidence, not a browser recording, rendering benchmark or player enjoyment assessment. The final report records the checkout commit and SHA-256 hashes of the tested simulation, pilot, movement, terrain and upgrade sources. Its before/after source hashes match. Uncommitted source hashes are the precise evidence boundary; the commit alone does not identify every tested change.

## Final ordinary-input matrix

Run `node docs/qualification/overflight/maps-movement-20261014/qualify-raid.mjs <label>` from the repository. The harness uses rules V4, seed 17031991, Standard difficulty, three airframes, enabled slow resume and a 300-second simulation limit. It uses ordinary steering, boosts and legal earned card choices. Baseline trials withhold drafts without changing movement, enemy, collision, damage or objective rules.

| Coverage | Result |
| --- | --- |
| Baseline kit, all 18 layouts | 18/18 complete |
| Earned Pursuer build, objective route, all 18 layouts | 18/18 complete |
| Earned Pursuer build, pack route, all 18 layouts | 18/18 complete |
| Time Attack, first layout of each world | 6/6 complete |
| Marathon, first layout of each world, carried resources | 6/6 complete |

See `raid-recovery-summary.json` and the complete `raid-recovery.json.gz`. All 66 trials complete, including all five contracts in each of the six worlds with carried hull, airframes, build and legal earned rewards. These results demonstrate a viable public-input path and target reachability for the tested seed and build. They do not establish first-player completion time, balanced human difficulty or all seeds/builds.

The preceding stable comparison (`raid-final*`) retains six Marathon losses in contracts 2–4. Those losses primarily came from protected contact after the pilot attempted a boost whose passive cooldown had finished but whose minimum start interval had not. A shared recovery query now includes both timers. The core applies the same existing 54-tick admission rule; the pilot waits for actual readiness instead of approaching without the promised boost. The native mode exposes this query for HUD and touch readiness as well. A regression uses an actual ranked cooldown, stored Rush and boosted kill/refund, then verifies refusal before tick 54 and admission at tick 54. No enemy stats, armor, damage, reward budgets, upgrade preferences or flight parameters were weakened. `raid-recovery-comparison.json` retains both sets, changed-source identities and all carried contract results.

## Review pilot correction and retained diagnostics

The original review pilot did not navigate cover. It held against the west side of Split Compound and Twin Docks cover for hundreds of seconds, with full hull and objectives beyond the wall. The pilot now requests a bounded visible-cover waypoint before submitting steering. It does not alter player position, hull, enemies, damage or objective state; it suppresses a boost while taking a cover detour. Two regression tests confirm ordinary-input baseline completion and verify that requesting an input cannot move or protect the player. Terrain-free pilot mocks retain their previous interface.

`raid-initial*`, `raid-routed*` and `raid-stable*` are retained diagnostics. Their source hashes changed during concurrent development, so they are not final qualification. `raid-final*` is the stable pre-readiness comparison; `raid-recovery*` is the stable result after correcting readiness. The pilot corrections remove cover stalls and refused boost approaches without removing obstacles or changing game balance.

## Authoring, import and lifecycle tests

`game/test/overflight-battlefield-packages.test.mjs` checks all 18 layouts in each of the three source families (54 independently exported/imported packages). It verifies global package admission, exact resource closure, fresh native-profile installation, equivalent compiled definitions and exact re-exported bytes. Single Drone and Riy simulations launch from imported data. Raid Studio adapters and native simulation launch Single Raid, Time Attack and Marathon from every imported Raid layout.

For every starting layout, the same test checks the five-contract A→B→C→B→A sequence, carried hull/shield/airframes/build/rerolls/history, fresh terrain and a reproducible original-seed retry. It deliberately supplies a completed phase to exercise settlement; this is a transaction test, not gameplay success. The earlier battlefield test covers all 90 generated contract definitions and escort route offsets.

These tests run without network access in the storage model. Browser service-worker installation, interrupted cache updates, rendered Studio preview and audible/visual review remain separate checks. No claim of full browser offline qualification is made here.

The focused Raid core, variant, package and pilot suite passes 51 tests; lint passes. External device and five-player trials remain skipped as previously agreed.

## Native preparation lifecycle audit

The host audit found and corrected an overlapping-world race: while world B was loading, a newer request for already-displayed A could skip loading; the obsolete B load could then replace the source host and dispose A's decoded images. The host now queues each world source selection through the completion of its asynchronous atlas preparation. It records actual accepted sources even for an obsolete request, restores A after B when required, retries rejected loads and drains pending work before disposal.

The new lifecycle tests execute the production `prepare()` function with controlled presentation and renderer boundaries. They verify queued A→B→A requests, decoded-image lifetime while renderer preparation awaits, initial/changed-world load failures, disposal, ten retries preserving the custom appearance, and retained Marathon state through scene replacement. That test also caught a missing `retainRun` argument when the prepared contract launched; the host now forwards it. Host, source-lifecycle and Raid Studio tests pass 35 tests, including V4 preview adapters. These are source-level integration tests with controlled dependencies, not captured browser or graphics-driver evidence.
