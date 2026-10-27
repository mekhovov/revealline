# Local Gecko sampled contact profile — 19 October 2026

R9 remains performance-unqualified. A Gecko sampled profile now identifies repeatable hot **WASM function indices inside physics stepping**, beyond the earlier Rapier stage counters. It does not identify a compiler defect or provide a safe production fix.

## Capture and unchanged replay

The [capture receipt](fpv-gecko-contact-profile-20261019.json) binds source `7571ecc909d04f78dfded8ff17639095a53c2b52`, the original compressed force tape, unchanged replay helper and pinned Rapier module. The source-only runner uses the documented `MOZ_PROFILER_STARTUP` and `MOZ_PROFILER_SHUTDOWN` environment variables. The installed executable's own `MOZ_PROFILER_HELP=1` output confirmed native stack walking and supported settings before capture. [Mozilla profiler lifecycle](https://firefox-source-docs.mozilla.org/tools/profiler/code-overview.html), [startup and shutdown capture](https://firefox-source-docs.mozilla.org/networking/http/logging.html#capturing-a-profile-with-logs-at-startup)

Capture ran at **05:44:56–05:45:03 CEST** on 19 October, Apple M4 Pro ARM64, Firefox 153.0. Settings request 1 ms samples, the minimum advertised 16,777,216-entry buffer (128 MiB per process), a 15-second maximum entry age, `GeckoMain`/`DOM Worker` threads, and only `js,stackwalk,cpu,processcpu` features. The resulting profile metadata confirms these settings. No screenshot/allocation/source capture, privileged remote API, security/JIT preference change, user profile or public browser state was used.

Each of three fresh-world repetitions checks **all 1,000 post-step SHA-256 world digests and unrounded body observations** against the retained tape. All pass, retaining final world hash `d0fb6c91f8bf6ca8b5243c3814ee79fcad8a464469fc2779ae415b6b1a64b279`. The preceding Node check also passes. The sampled sums of `World.step` intervals are 1,248 / 1,158 / 1,138 ms; these instrumented timings do not replace the original qualification result or establish JIT warmup. The controller, aircraft physics and mission hosts are absent from this pure replay.

The first attempt is retained in a [startup-failure receipt](fpv-gecko-contact-profile-20261019-startup-failure.json). The available Playwright module expected a newer missing executable. The corrected runner explicitly selects the already-installed Firefox 153.0 binary; it downloads nothing. The failed attempt did not launch a browser. Both attempts preserve their source identities.

## Samples and interpretation

The [bounded summary](fpv-gecko-contact-samples-20261019.json) selects the single content process that loaded the local tape page, its `GeckoMain` thread, and three disjoint `contact-replay-*` User Timing intervals. It counts a sample as physics stepping only when the stack contains the pinned module's `step` wrapper. Initialization, hashing, snapshot serialization, asynchronous waits and other processes are not assigned to stepping merely because they contain WASM.

| Repetition | Samples in replay interval | Samples with a physics-step stack | Samples whose leaf is pinned WASM |
| ---------- | -------------------------: | --------------------------------: | --------------------------------: |
| 0          |                      1,518 |                             1,236 |                             1,210 |
| 1          |                      1,364 |                             1,167 |                             1,156 |
| 2          |                      1,303 |                             1,148 |                             1,137 |
| Total      |                      4,185 |                             3,551 |                             3,503 |

The four leading leaf locations are `wasm-function[30]@83077` (1,417 samples), `[552]@1762278` (845), `[93]@697442` (424) and `[83]@637868` (343). Together these account for 3,029 of 3,551 physics-step samples, approximately 85.3%. This is a **sample fraction**, not a measured exclusive CPU-time percentage. Inclusive counts overlap and must not be added. The observed stacks link these functions through `[2664]@2617602` and `[297]@1324612` to the raw/JS physics `step` wrappers.

The shipped binary reports anonymous WASM indices/offsets, not Rust function names. Native machine addresses remain unsymbolicated. The next useful boundary is mapping these exact byte locations to the source/generated instructions, or comparing the same artifact on another approved Firefox version. The evidence does not justify modifying collision geometry, solver iterations, CCD, simulation frequency or browser protections under the existing backend identity.

## Retention, checks and reproduction

The raw profile remains local at `/Users/oleksandr.mekhovov/work/my_projects/fpv-firefox-profile-20261019-results-2/gecko-profile.json`: **12,110,507 bytes**, SHA-256 `a7d160e76c076697e8dae8bbdd162169120200405c5d52c1ccdb1c231b463a0a`. It is not committed or uploaded. Analysis refuses files over 64 MiB and bounds process, table and stack traversal. The sampled profile's ring buffer is bounded independently; the post-capture file-size check does not claim to constrain the browser's serializer before writing.

The runner and analyzer create new outputs and retain failures. All owned browser processes and the local server closed. No captured source changed during the successful run. `scripts/test-fpv-gecko-contact.mjs` passes **7/7** meaningful cases: interval/stage selection, ambiguous/foreign process rejection, malformed windows, cyclic/invalid stacks, unrelated WASM exclusion, retained baseline errors and independent cleanup after browser-close failure. Scoped lint, formatting and whitespace checks pass. Initial lint setup failures identified a missing local dependency link and a tracked helper omitted by sparse checkout; both were restored without changing lint rules or production code. These tests do not qualify flight performance.

Independent review reproduced the saved sample summary from the untouched raw profile and approved its attribution. It also identified two reusable-runner failure paths: baseline exceptions could escape without a final receipt, and a rejected browser close could skip server cleanup. The successor records baseline failures, attempts both resource closures independently and reports any unconfirmed closure. Those changes are covered by the additional tests; they do not change the successful captured observations, and no native rerun was needed.

Run the committed runner with an existing Playwright module, existing Firefox executable and a new output directory, then analyze the locally retained profile:

```sh
node scripts/profile-fpv-gecko-contact.mjs INSTALLED_PLAYWRIGHT INSTALLED_FIREFOX NEW_OUTPUT_DIRECTORY
node scripts/analyze-fpv-gecko-contact.mjs LOCAL_PROFILE_JSON NEW_SUMMARY_JSON
node --test scripts/test-fpv-gecko-contact.mjs
```

No output is automatically submitted upstream. The [package-feature review](fpv-rapier-build-contract-20261019.md) separately corrects how upstream determinism claims apply to the current pinned flavor.
