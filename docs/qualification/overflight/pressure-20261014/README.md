# Survivor crowd build-up — 14 October 2026

The built-in V2 encounter generator now builds its crowd from the first formation starting at or after 180 seconds. Gathering fronts use 36 arrivals/s and 90 hull, progressing to 40/s and 120 hull from 240 seconds. Late flankers move at 38 units/s, crossing packs at 34 and other fronts at 32. Earlier encounters, seeded formation order, family composition, all authored and earned relief, specialist/heavy caps and final goals retain their existing rules. V1 generation and imported/authored schedules are not migrated or rewritten.

This is a measured improvement in crowd build-up. It is **not evidence that the game is harder or more enjoyable**. Damage actually decreased in the paired Standard routes; readable movement and audiovisual review remain necessary.

## Paired experiment

Base: `d37b2371920288462f3a0ceff40c8f6a1fa79e3b`. Same seed 17031991, Standard difficulty, three airframes, ordinary `tight` pilot inputs and earned Fan/Echo/Systems cards across front/crossing/mixed. Nine runs per variant. Every attempt is retained in `comparison.json.gz`, including exact project data and identity. No fixture state, invulnerability or forced upgrades were used.

| Variant                   | Completed | Mean peak visible | Mean visible in 180–300s samples | Runs reaching 600 | Mean damage |
| ------------------------- | --------: | ----------------: | -------------------------------: | ----------------: | ----------: |
| Prior generator           |       9/9 |               489 |                              121 |               0/9 |         109 |
| Rejected faster ramp      |       9/9 |               489 |                              175 |               1/9 |          84 |
| Selected gathering fronts |       9/9 |               574 |                              215 |               3/9 |          73 |

The middle-period measure uses the qualifier's existing five-second samples, not a continuous occupancy measurement. Selected peaks range 439–701. The three 600+ exposures lasted 7.67, 2.30 and 2.37 seconds. This does not meet a claim of sustained 600–800 crowds in every run, nor should clearing trigger automatic replacements to enforce one. The faster candidate increased middle-period activity but did not improve average peak density; it is retained as a rejected experiment rather than hidden.

## Reachability and passive strategies

`verification.json.gz` adds seed 42, both difficulties, all three encounter sets, and Fan/Shield, Echo/Scanner and Systems builds, each with three airframes. All **18 groups have a completion**, from **20 attempts**. The two retained failures are Veteran Systems / front / tight (329.25s) and Veteran Systems / mixed / tight (274.43s). Both groups complete with the ordinary orbit route. Alternate routes demonstrate reachability, not that every route succeeds.

All **eight passive rank-two-pulse probes lose**: parked, tiny-circle, wall-held and edge-loop inputs, in Standard and Veteran, with three airframes. Loss times range 57.87–116.03 seconds. The changed generator begins after those deaths; it does not mask or weaken the existing passive-play protection.

`tests.tap`: **23/23** project, variety-core and balance tests pass, including earned clearing relief, readable attack escape, guard/armor handling, no-pulse completion and passive probes. Scoped ESLint, repository-format Prettier and diff checks pass.

The qualifier source bindings are included. Only repository formatting of `project.mjs` changed after the verification process loaded its modules; every recorded run's project identity was checked against final generation and matches. Other measured source bindings stayed unchanged.

## Reproduce

From the repository root:

```sh
node docs/qualification/overflight/pressure-20261014/verify.mjs
node --test game/test/overflight-project.test.mjs game/test/overflight-variety-core.test.mjs game/test/overflight-balance.test.mjs
```

The first command replaces only this packet's generated verification receipt. Exact project inputs for all three paired variants remain in `comparison.json.gz` and can be passed to `qualifyOverflight({project, direction, route:'tight', airframes:3})`.

## Evidence boundary

These are deterministic headless play outcomes, not human sessions, browser readability evidence or GPU measurements. No target-hardware or player tests are claimed; those were explicitly skipped by the user. The preserved mass-clear relief tests establish that clears still buy space. This change leaves all renderer capacity and quality rules intact.
