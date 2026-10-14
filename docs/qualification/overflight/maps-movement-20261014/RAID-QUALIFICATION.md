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
| Marathon, first layout of each world, carried resources | 0/6 complete |

See `raid-final-summary.json` and the complete `raid-final.json.gz`. All 66 trials are retained, including the six failures. The single-sortie results demonstrate target reachability with both direct and pack-hunting routes. They do not establish first-player completion time, balanced human difficulty, all seeds/builds or five-contract Marathon completion.

The Marathon pilot loses in contracts 2–4. Damage predominantly comes from protected contact; it repeatedly attempts approaches around guarded bodies and spends carried airframes. These are losses, not terrain stalls. Do not relabel successful transaction tests as campaign completions or weaken enemy rules merely to make this pilot win. The next meaningful check is a more deliberate guarded-approach/earned defensive-build comparison or native gameplay review.

## Review pilot correction and retained diagnostics

The original review pilot did not navigate cover. It held against the west side of Split Compound and Twin Docks cover for hundreds of seconds, with full hull and objectives beyond the wall. The pilot now requests a bounded visible-cover waypoint before submitting steering. It does not alter player position, hull, enemies, damage or objective state; it suppresses a boost while taking a cover detour. Two regression tests confirm ordinary-input baseline completion and verify that requesting an input cannot move or protect the player. Terrain-free pilot mocks retain their previous interface.

`raid-initial*`, `raid-routed*` and `raid-stable*` are retained diagnostics. Their source hashes changed during concurrent development, so they are not final qualification. `raid-final*` is the stable source comparison. The pilot correction removes the cover stalls without removing obstacles or changing game balance.

## Authoring, import and lifecycle tests

`game/test/overflight-battlefield-packages.test.mjs` checks all 18 layouts in each of the three source families (54 independently exported/imported packages). It verifies global package admission, exact resource closure, fresh native-profile installation, equivalent compiled definitions and exact re-exported bytes. Single Drone and Riy simulations launch from imported data. Raid Studio adapters and native simulation launch Single Raid, Time Attack and Marathon from every imported Raid layout.

For every starting layout, the same test checks the five-contract A→B→C→B→A sequence, carried hull/shield/airframes/build/rerolls/history, fresh terrain and a reproducible original-seed retry. It deliberately supplies a completed phase to exercise settlement; this is a transaction test, not gameplay success. The earlier battlefield test covers all 90 generated contract definitions and escort route offsets.

These tests run without network access in the storage model. Browser service-worker installation, interrupted cache updates, rendered Studio preview and audible/visual review remain separate checks. No claim of full browser offline qualification is made here.

Focused tests and lint pass. External device and five-player trials remain skipped as previously agreed.
