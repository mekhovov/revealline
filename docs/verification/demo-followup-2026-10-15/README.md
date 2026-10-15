> Retained historical excerpt after an ownership migration. Exact originals are preserved separately. This excerpt is not the original complete record or a release qualification.

# Demo implementation follow-up — 15 October 2026

This is implementation and automated evidence, **not release qualification**. Physical iPhone acceptance and three unfamiliar viewers are explicitly deferred by the user. See the [updated plan](../../demo-plan-status-2026-10-15.md).

## Source and scope

The task was rebased without conflicts onto main `da0b0108206a0270b4b870e747f2d1bc0e6695cb`, on `codex/demo-acceptance-followup-20261015`. These reports were collected on that base plus this follow-up's changes. Each availability report records the resolved content fingerprint and the sampled implementation/asset hashes; it is not a hash of every repository dependency. The final rebase onto `2f5e3ee978eeecaad823e1b2d0ac914f1bc8b1c6` also completed without conflicts. Implementation commit `1fb21f01fe3ac6b1345a8c7475c604e684faedf8` retains all 95 sampled files unchanged: see [post-rebase comparison](post-rebase-source-comparison.json). That comparison does not qualify unrelated integrated changes.

No game rules, planner budgets, one-second Worker watchdog, saves, rewards or unlock rules were changed. The four new recordings are authored inputs, not human performances. Their viewing quality and device compatibility remain pending.

## Automated findings

| Evidence                                                           | Outcome and scope                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Initial availability](availability-before.json)                   | 42 source/policy cases: 26 verified, 16 failed; usable sources for 11 of 15 distinct base + Pressure Lines maps. All 12 live cases hit the production watchdog. Last Light and Supply Circuit had no complete source.                                                                                                                                                      |
| [Updated availability](availability-final.json)                    | 46 source/policy cases: 40 verified, six failed; all 15 maps have a complete verified source under both selection policies. All 14 recordings verified under both selections. Recording inputs retain their authored policy. No sampled source changed; zero Worker owners/listeners remained before defensive cleanup. 72.59 seconds wall time, not two-hour observation. |
| [Uncached assets, no Worker](availability-uncached-no-worker.json) | Deliberately return 404 for every recording, with Worker unavailable: three generated sources verify; 14 recording sources fail. This is an unavailable-assets test, not a claim that every installed level works without its optional recordings. It does not install/fetch a pack to conceal the failure.                                                                |
| [Current Journey inventory](journey-inventory.json)                | 103 map entries / 105 sources registered. Enumeration only: none played, all marked not exercised.                                                                                                                                                                                                                                                                         |
| [DroneAid inventory](droneaid-inventory.json)                      | 42 map entries / sources inside the edition's own bootstrap. Enumeration only; no cross-company content.                                                                                                                                                                                                                                                                   |
| [Recording/source tests](recording-source-complete-tests.log)      | 27 passed: complete exact replay endpoints, catalogue/installed identity, frozen alternatives, missing-primary fallback, unavailable Worker fallback, owners, packaging inventory and cancellation.                                                                                                                                                                        |
| [Initial host suite](host-tests.log)                               | 160 passed, two failed. One assertion read the old flat suspended-session shape after main adopted a presentation envelope. One fixture exceeded its unchanged five-second initial-picture readiness bound.                                                                                                                                                                |
| [Targeted host follow-up](host-followup-tests.log)                 | Both previously failing cases passed; 19 unrelated tests skipped. The save assertion now unwraps through the production accessor and retains exact checkpoint verification. No product/fixture deadline was increased. The timing-sensitive original failure is retained, not erased.                                                                                      |
| [Focused behavior tests](focused-tests.log)                        | 29 passed before recording expansion, including reaction priority, cooldown, cap, stale-event expiry and preference disable.                                                                                                                                                                                                                                               |
| [Offline closure](offline-closure-tests.log)                       | 15 passed. This checks module/asset closure, not a complete native build or disconnected physical device.                                                                                                                                                                                                                                                                  |
| [Localization](localization.log)                                   | English/Ukrainian keys, interpolation, plurals and generated bundle match.                                                                                                                                                                                                                                                                                                 |
| [Lint](lint.log)                                                   | Focused changed-module ESLint completed successfully; empty log means no diagnostics.                                                                                                                                                                                                                                                                                      |

The updated audit's six failed live cases are Orchard seeds 1 and 3 and Courtyard seed 3 under immediate steering (no complete result), and Courtyard seeds 1–3 under grid-center steering (planning deadlines). Successful live cases on the same host do not erase these failures. Recorded fallback covers these levels, but **the live fixed-seed suite is not requalified**.

## Accelerated endurance outcome

The requested 7,200 simulation-second check was run **once** after the final rebase:

```sh
node --expose-gc scripts/soak-demo.mjs --simulation-seconds 7200 --report docs/verification/demo-followup-2026-10-15/soak-final.json
```

[Report](soak-final.json) and [log](soak-final.log): **failed**, after 2.31 wall seconds and 75.075 advanced simulation seconds. Only one completed recording was independently verified before the assertion stopped the run. Courtyard Exits seed 3 could not prepare a complete live result; the director skipped it, then the existing no-failed-sources assertion rejected the qualification. Two explicit pause checks ran. Both created players were disposed; Worker owners, running threads and adapter listeners all returned to zero. No sampled source changed. This is neither two hours of evidence nor a passing fallback/endurance qualification. The failure was not retried, the assertion was not removed, and the watchdog was not increased.

## Recording authoring and preserved attempts

- Orchard Crossing circuit: about 31.41 simulation seconds, four captures, five bends, win with three lives. Orchard seeds 1 and 3 stopped safely without a complete result and were excluded.
- Courtyard Exits circuit: about 31.97 simulation seconds, six captures, five bends, win with three lives.
- Last Light recovery: about 30.07 simulation seconds, three captures, six bends, three real hazard losses and terminal defeat. Boss-lane/trail contacts occur after sustained exposed movement.
- Supply Circuit recovery: about 52.97 simulation seconds, five captures, six bends and terminal defeat. One trail interception and two actual patrol contacts during sustained safe-ground relocation. These are not all exposed-cut losses.

The builder reconstructs ordinary inputs, rejects exposed reversals and unfinished outcomes, and verifies final checkpoints. It never writes damage or a fabricated win/loss. Frozen existing recordings and browser variants remain intact. New variants have not been claimed as browser-qualified.

All bounded search logs are retained: `authored-route-search*.log`, `pressure-authoring*.log`, `recovery-authoring.log`, `supply-*-authoring.log`. Rejected short/unfinished attempts were not padded or published as performances. `recording-source-final-tests.log` preserves the test that still expected the old nonterminal loss excerpt; the assertion was corrected to require a genuine terminal defeat before the complete-suite pass.

## Performance diagnostics, not qualification

[Worker startup diagnostic](worker-startup-diagnostic.json) deliberately measured outside the watchdog to separate cold startup (about 1.19 seconds) and first planning (about 5.13 seconds). Production limits were untouched. [Main-thread profile summary](profile-summary.json) measured about 1.50 seconds for a plan under different conditions; its startup/GC samples are investigation leads, not an apples-to-apples speedup or an iPhone result. The later audit ran under different host load. Do not infer stable mobile capacity from either.

## Browser and human limits

The task-owned observer is at `http://127.0.0.1:8832/game/test/browser/demo-watch.html`. The embedded game remains at its existing **Password required** screen. No observation was started and no password gate was bypassed. Browser tab 1 in browser 2 is marked for handoff; the task's port8832 server remains available for unlocking. No user's port8779/8820 session was changed.

No hidden-tab execution, actual sound output, Safari touch behavior, physical controller reconnection, pixel-level visual acceptance or human engagement is claimed. The older interrupted/stalled September observations remain historical evidence, not a pass for this source. A clean two-hour browser observation requires an unlocked page and a frozen candidate.

## Reproduction

Run from the repository root, separately from other CPU-heavy checks:


Use new report paths to preserve these outcomes. Inventory-only success exits do not mean admission: their reports explicitly say `passed: false` and `not-exercised`. A release owner must review the remaining holds; this task allocates no version and performs no merge or publication.
