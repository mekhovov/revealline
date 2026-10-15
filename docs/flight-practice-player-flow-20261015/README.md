# Localized player-flow evidence

See the [continuation report](../flight-practice-player-flow-2026-10-15.md) for
source identities, procedures, failures, corrections and remaining acceptance.
The candidate remains development-only and unselected; hosting is deferred.

| Evidence                                                                         | Result and scope                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `optional-packages.json`, `candidate-verification.json`                          | Original frozen three-app envelope, two reproducible builds and independent admission            |
| `modes-incomplete-settings.json` and matching archive                            | Original ten-case run: six Gym/Academy passes, four Worlds test-navigation failures              |
| `modes-completed.json` and matching archive                                      | Unchanged-candidate retry: all ten EN/UK motion/pause/retry cases pass                           |
| `gym-incomplete-export.json` and matching archive                                | Both native exercises complete, but observer omitted Home before Settings; no export/replay pass |
| `gym-incomplete-replay.json` and matching archive                                | Both normal exports succeed; verifier rejects intentionally projected package locales            |
| `gym-completed.json` and matching archive                                        | Both native exercises, actual UI exports and isolated frozen-byte replay pass                    |
| `practice-tests-interrupted.log`                                                 | Deliberately interrupted under disk pressure after 69 passing cases; no full-suite pass          |
| `practice-tests-completed.log`                                                   | Fresh complete rerun: 352 tests pass, zero failures/skips                                        |
| `observer-tests.log`, `observer-corrected-tests.log`, `observer-final-tests.log` | Successive 59/60/61-case observer suites, kept separately                                        |
| `admission-pointer-tests.log`                                                    | Separate 17-case artifact/pointer suite; overlaps some full-suite coverage                       |
| `gym-route-integration-tests.log`                                                | Thirty observer/helper tests after results-Home route correction                                 |
| `final-input-check.json`                                                         | All 87/94/155 original inputs unchanged after observer/documentation work                        |

Each archive is the complete original output directory, including plan, authority
snapshots, per-case JSON, screenshots and exported transcripts where available.
No failed report is rewritten as a pass. Screenshots are captured only after
normal authorized access; credentials are not stored in plans or artifacts.

`artifact-inventory.json` pins the exact bytes of this evidence set. It excludes
itself and this explanatory README. Automated success is not physical-device,
human-learning, full-directory, migration or publication approval. All browser
receipts keep `qualified: false`.
