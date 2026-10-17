# Appearance packaging envelope: retained cce failure

The exact `cce49c81d82b79aefc24898f32eeebc609e569fb` Appearance run
[39001645983](https://github.com/mekhovov/revealline/actions/runs/39001645983),
attempt 1, finished **cancelled**, with no package artifacts. The hosted annotation
states: “The job has exceeded the maximum execution time of 40m0s”. This is a
packaging envelope failure, not a failed focused test or a gameplay timing result.

## Complete retained observation

Job `117305642358` began at `2026-10-17T04:11:47Z`. All **97 full test files**
finished successfully at `04:44:16Z`: **1,352 tests passed, zero failed**, reported
elapsed `1,888,178.000358 ms` (31 minutes 28 seconds). Build started at `04:44:16Z`
and was cancelled at `04:52:01Z`, after 7 minutes 45 seconds. Checksum binding,
full package upload and compact identity upload were skipped. Terminal job time
was `04:52:03Z`; the API artifact listing contains zero entries.

The earlier successful `38992974796` package needed 6 minutes 1 second for its
build, while its focused suite took 12 minutes 52 seconds. The preceding c9
`38998342861` run failed its focused checks after 28 minutes 15 seconds and never
built. These distinct outcomes remain retained. The cce result establishes that
its 40-minute outer budget was insufficient for the expanded required suite and
build; it does not establish the unfinished build's eventual duration or result.

Bounded, authenticated, redirect-safe retention read the complete job log with a
4 MiB ceiling and 120-second deadline. Authentication was stripped on redirects;
no signed URL or token was logged. Every retained byte was read back and hashed.
Local evidence is under `.cache/solo-followup/remote-appearance-39001645983/`:

| File                                      |   Bytes | SHA-256                                                            |
| ----------------------------------------- | ------: | ------------------------------------------------------------------ |
| `terminal-job.log`                        | 583,141 | `7be8ba2d0297c3d136190454fda2fbdd5fecd33f3ec776507f7587c88cf5953e` |
| `focused-tests-from-complete-job-log.tap` | 316,995 | `d5586f4faffbcb0974f8a92337765c442ac6b998fb5a97a96ef20138cd6d8808` |
| `terminal-annotations.json`               |   1,232 | `1eba88b7199fa14cdc5783a3c39684a44a3be88025ef265bd5f8820958f77cc0` |
| `terminal-artifacts.json`                 |      42 | `f7417e1fb877d3f5934f143cc38ad9e2905476e8f5ac6776507d09441efcd6f6` |
| `run-observation-06.json`                 |  14,135 | `6a5a89c7b57d5900e1e531e36b6e8357163efa06d3ab719beed04fc49bb03c71` |

The TAP derivative removes only each hosted ISO timestamp prefix from the one
complete TAP block. The original log, all 1,352 observations, annotations, prior
in-progress snapshots and terminal receipt remain available. No distribution or
browser data was downloaded.

## Prospective bounded scheduling correction

The next source cohort has a **70-minute job limit**, a **45-minute focused-suite
step** and a **12-minute build step**. These are CI resource limits. Test-file
selection remains complete, concurrency remains one, and individual readiness,
correctness and gameplay deadlines are unchanged. The only added full test file
is `game/test/solo-performance-host.test.mjs`, which covers the current public
Direct Start, Missions and backup regression; the focused list now has **98**
unique files. Its separate seven-test full-file run passed in 110.071 seconds
under a 150-second outer host-test allowance. That run retains twenty earned Retry
cycles and the original 250 ms interruption boundary; it is not an estimate of
hosted packaging time. Raw receipt:
`.cache/solo-followup/eager-graph-cce/legacy-chooser-host-final.tap`, 1,933 bytes,
SHA-256 `1322102b3f0d612397bd72565fe41e599ae72da14283c5a28e57fc60d9f09df8`.

A timestamp is recorded in the first explicit step, before checkout. Build
admission calculates against 68 minutes from that timestamp, leaving two minutes
of the outer job for initial setup/scheduling and final runner cleanup. It fails
before launching either build if the clock is absent, reverses, or fewer than
**23 minutes** remain:

- 12 minutes for both packaging commands in their existing build step;
- 8 minutes for checksum binding (1), full artifact upload (2), compact binding
  (2) and compact upload (3);
- 2 minutes for focused-TAP failure retention, even when tests passed and a later
  packaging step failed or was cancelled;
- 1 minute for the final summary and closure.

The existing compact binding/upload limits of two and three minutes stay intact.
Setup steps are also finite. Individual step maxima are not a promise that all
can reach their maxima in one job: the remaining-time admission explicitly
rejects an over-consumed setup/test schedule. The successful cce tests used
31 minutes 28 seconds; the 45-minute whole-suite limit leaves room for the new
file and host variance without changing any test's own deadline.

The original failure-retention condition required the focused step itself to
fail, so it skipped the successful TAP when the later build was cancelled. The
prospective condition retains that TAP for failed/cancelled packaging when the
focused step ran. It remains a failed-run diagnostic artifact, never a qualified
package. Forced infrastructure termination can still prevent any cleanup step;
the bounded complete hosted log remains the fallback evidence source.

GitHub documents separate job and step timeouts and recommends status expressions
for post-failure steps. The finite retention step uses `always()` together with
failure/cancellation and completed/started focused-step outcomes; it does not
apply `always()` to checkout or packaging. [Workflow timeout syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes),
[status expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#always).

## Validation and admission status

The policy suite exercises the actual shell admission prefix with sufficient,
exactly sufficient, insufficient, expired, reversed and absent clocks. It asserts
all 98 unique full files, serial execution, step bounds, retained required-policy
checks and successful-TAP retention on later failure. The complete policy suite
passed **10/10**, with no skips or failures. Raw receipt:
`.cache/solo-followup/appearance-envelope-correction-v2.tap`, 2,604 bytes,
SHA-256 `2e5502eb3f792988a28a8993eaedd9c9db1ea877434cee417d0f41ad78896798`.
Scoped ESLint, Prettier and `git diff --check` also passed.

No cce package exists. Candidate-dependent offline, timing, recovery and overhead
consumers remain held. A future successful exact-source package must supply its
own actual API artifact identity and checksums before any consumer is released;
this correction creates no package pin or qualification credit.
