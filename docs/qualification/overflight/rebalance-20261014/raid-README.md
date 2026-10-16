# Raid balance revision 3 qualification

This is implementation and deterministic reachability evidence. It does not establish human difficulty, enjoyment, target-device performance, or calibrated medal thresholds.

`raid-source-commit.json` verifies all recorded qualification source hashes against commit `14649912ba3f94d335b5bbc94ce6ce92d522a1a8`, with no mismatches and unchanged start/finish hashes.

## Delivered

- Explicit `OverflightHuntProjectV3` / compiled V3 and `overflight-balance.v3`; existing V1/V2 projects retain their behavior and default generator version.
- Guarding machinery exposes its rear half; recovery opens the whole body for 4 / 3.5 / 3 seconds on Relaxed / Standard / Veteran. Every armor hit needs a fresh boost and a physical exit/reentry. Several valid approaches can succeed within one opening.
- Shield/brace escorts track their authored objective. Guard Interrupt affects those guards, never machinery or fired projectiles; interrupted shields rearm after their brief opening. Objective Shield restores one charge per objective to capacity.
- Authored Time Attack medal budgets, visibly provisional by default, and separate V3 records retaining raw and adjusted times.
- Five announced Marathon tactical contracts. Builds cap at eight invested ranks; later sector rewards offer explicit equal-rank refits or useful repairs/rerolls/score. Full hull never offers repair.
- Creator editing, translated linked-escort routes, native weak-point cues, refit previews, and actual contact/lane/fan/ground damage summaries.

## Automated checks

`raid-tests.tap` records **82 passing tests**, including legacy Raid coverage and 11 new balance tests. New cases exercise rear/front geometry, multiple fresh passes during one opening, no repeated same-boost armor rewards, interrupt/rearm behavior, one-charge shield recovery, moving escorts, capped refits, authored medals, V3 record separation, and damage causes. All 45 V3 encounter/difficulty/contract combinations compile; malformed escort links and unordered medal budgets are rejected.

## Ordinary-input route matrix

Reproduce with `node docs/qualification/overflight/rebalance-20261014/raid-qualify.mjs`.

The existing review pilot reads simulation state and sends ordinary movement/boost/card inputs. It does not teleport or grant health. Baseline runs disable upgrade choices. Each trial has a 600-second simulation cap. `raid-results.json.gz` includes exact source hashes, inputs' seed/build/route identifiers, choices, completed contracts, results, and failures.

| Workload                                                                      | Result             |
| ----------------------------------------------------------------------------- | ------------------ |
| Raid: 3 seeds × 3 difficulties × 3 encounters × 2 routes × 4 build directions | 216 / 216 complete |
| Baseline kit subset, with no upgrades                                         | 54 / 54 complete   |
| Time Attack: seed 42 × 3 difficulties × 3 encounters                          | 9 / 9 complete     |
| Marathon: seed 42 × 3 difficulties × 3 encounters, all five contracts         | 8 / 9 complete     |
| Marathon invested-rank maximum                                                | 8 in every trial   |

The preserved Marathon failure is **seed 42, Relaxed, mixed encounter, objective route, Pursuer build**: two contracts completed, then all airframes were lost 34.9 seconds into contract three. This is an unsuccessful automated route, not an unreachable objective claim. No failing trial was discarded or replaced.

| Difficulty | Objective-route mean clear / damage | Pack-route mean clear / damage |
| ---------- | ----------------------------------- | ------------------------------ |
| Relaxed    | 28.5 s / 32.2 hull                  | 55.9 s / 26.8 hull             |
| Standard   | 25.2 s / 19.0 hull                  | 53.4 s / 34.7 hull             |
| Veteran    | 24.5 s / 13.4 hull                  | 45.7 s / 18.2 hull             |

These short clears demonstrate valid expert shortcuts, not normal first-run duration. This state-reading pilot exploits shorter warning windows on Veteran and can therefore finish it faster. **Do not use these times to set human medals or infer a successful difficulty gradient.** The provisional 90 / 150 / 240-second authored defaults remain unchanged. Replay reviews should examine readable approach opportunities, pressure from escorts, missed approaches, and distinct movement decisions.

The automated Pursuer Marathon pilot kept its preferred build and selected field rewards after reaching the cap. Equal-rank refit selection is covered by direct integration tests, rather than misrepresented as exercised by that pilot's chosen routes.

`raid-results-initial.json.gz` preserves the earlier full matrix before the shield-rearm correction. `raid-results-before-format.json.gz` preserves the intermediate run whose finish hashes detected shared-file formatting during its execution. The final `raid-results.json.gz` supersedes both and records identical start/finish source hashes. All three have the same 233 / 234 aggregate completion result; per-route outcomes and source hashes are retained.

## Remaining review boundaries

Native geometry, sound/readability and refit presentation need visual review alongside the shared application. Human fun and difficulty judgment remains unqualified. The previously unavailable reference laptop, physical controller/phone and five-player tests are not claimed by this automated evidence.
