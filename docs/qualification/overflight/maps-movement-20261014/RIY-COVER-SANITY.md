# Riy cover correction — bounded earned-run sanity check

Tested commit: `60b0c25ab2703371691d4d203df7d5067638ca14`.

This reruns exactly one previously locked case: Riy Echo, Supply Orchard Edge,
seed **303907**, **Veteran**, **one airframe**. The active pilot, earned draft
preferences, four original checkpoint/heading policies, and all combat parameters
are unchanged. The only changed file among the 33 traced runtime dependencies,
compared with the progression-parity candidate, is `game/overflight/riy-core.mjs`.
Source hashes remained stable throughout the **13.35-second** headless execution.

| Continuation | Earned checkpoint | Starting hull / choices | Result | Time after checkpoint |
|---|---:|---:|---|---:|
| Held heading 3 | 60 s | 100 / 3 | Lost at 101.52 s | 41.52 s |
| Held heading 4 | 120 s | 60 / 6 | Lost at 134.98 s | 14.98 s |
| Held heading 5 | 180 s | 40 / 8 | Lost at 188.18 s | 8.18 s |
| Held heading 6 | 240 s | 20 / 9 | Lost at 241.22 s | 1.22 s |
| Parked, supplemental | 120 s | 60 / 6 | Lost at 121.75 s | 1.75 s |

The active baseline **lost at 243.60 seconds with nine upgrades**. This is retained
as a failure to complete, not evidence of Echo viability. Its outcome, earned
cards, routes, collected salvage and damage match the prior case; only diagnostic
counts differ: five additional collision candidates and one additional hit. The
four original branches retain their previous outcomes and final times.

All **five available unattended continuations lost**, with at least 90 seconds
remaining when each began. There were no unavailable checkpoints, censored
results or draft errors. The supplemental parked branch starts from an independent
clone of the exact same earned state as the 120-second held-heading branch;
initial metrics, build and choices were checked for equality. No upgrades, health
or positions were injected. The longest damage/shield-free interval among the
unattended branches was **18.25 seconds**.

This one-airframe case cannot exercise replacement behavior. The runner retains
automatic earned-draft resolution and continuous input after replacement, but
those paths are not newly qualified by this result. The test does not replace the
larger historical matrix, establish all builds' viability, measure native frame
cadence, or demonstrate ordinary-player enjoyment. Cover interactions themselves
are additionally covered by the focused Riy/terrain regression tests.

## Reproduction and evidence

```sh
node docs/qualification/overflight/maps-movement-20261014/riy-cover-matrix.mjs --run --cases=1 --wall-budget=540 --output=<fresh-path>.json.gz
```

The task-specific runner preserves the previous matrix implementation, selecting
case 1 only, allowing the labeled supplemental checkpoint, and cloning each branch
snapshot because two continuations share checkpoint 120. The config retains the
historical twelve-case definitions for validation; **only case 1 was executed**.

- [Config](riy-cover-config.json), [source provenance](riy-cover-provenance.json), [execution plan](riy-cover-plan.json).
- [Raw compressed evidence](riy-cover-final.json.gz), [summary](riy-cover-summary.json), [worker output](riy-cover-output.txt).
- Raw JSON SHA-256: `a10f6bf924c63f37aa45ec32fb826cca50d1802e71a48c9719509b588b5d5a7a`.

All earlier matrices and source identities remain unchanged.
