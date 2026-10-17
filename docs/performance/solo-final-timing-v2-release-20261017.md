# Final-package setup successors and lifecycle release

The original `a7e0219818842f02399317ca6d2a14bdd506da3d` timing dispatch produced **no native observations**. Its declarations and workflows remain unchanged under the shared execution witness. The versioned successors correct only the sparse tooling dependency closure and add an actual source-verifier smoke check; game package, routes, deadlines, numerical gates and diagnostic exclusion remain unchanged.

## Retained original results

| Phase                 | Run         | Diagnostic jobs            | Retained artifacts | Native observations |
| --------------------- | ----------- | -------------------------- | ------------------ | ------------------- |
| Cold first 30 seconds | 39012635535 | Six failed                 | Six                | Zero                |
| Warm first 30 seconds | 39012635503 | Six failed                 | Six                | Zero                |
| Sentry                | 39012635473 | Six failed                 | Six                | Zero                |
| Long Rail             | 39012635488 | Six failed                 | Six                | Zero                |
| 30-minute soak        | 39012635593 | One failed, five cancelled | Five               | Zero                |

All five declaration jobs passed. The 25 retained helper summaries reached candidate source verification, then failed because `soundtrack-distribution.mjs` was absent from the sparse tools checkout. Each source verifier had validated 1,072,632,920 artifact bytes before this projection/configuration dependency failure. All 50 candidate/baseline rows in those summaries are explicitly `not-run`; the baseline had not been admitted. This is a test setup failure, not a browser performance result.

All 29 API-listed artifacts passed exact run/head/workflow identity, API size/digest checks, ZIP path/CRC validation and full member readback: 2,177,024 compressed bytes and 8,785,497 member bytes. Every retained command owner was closed with no survivor, ambiguous ownership or recorded violation. Four cancelled soak artifacts contain setup-only evidence. The cancelled WebKit repetition 3 has no API-listed artifact, so its cleanup evidence is unavailable rather than assumed clean. The cancellation request raced with job starts; the table reports actual final statuses.

The complete cache receipt is `.cache/solo-followup/final-wave-a6e/terminal-timing-setup/terminal-analysis.json`, 101,239 bytes, SHA-256 `f964017577ee80853539c2551ec31c6755a8c6257584c0dc5b8f42889051e181`. Per-artifact raw API responses, archives, extracted members and inventories remain beside it.

## Reviewed prospective changes

The five `*-v2` manifests bind their exact original declaration hashes and failed/cancelled run IDs. Their optional `SoloVerifierClosureSuccessorV1` admission requires zero prior native observations, unchanged runtime/scenario/gates, no automatic retry, and the single `before: a7e0219818842f02399317ca6d2a14bdd506da3d` publication edge. Historical admission without that object is unchanged.

The sparse tools checkout now includes `soundtrack-distribution.mjs`, `optional-distribution.mjs`, `external-distribution.mjs` and `optional-artwork.mjs`, with their static dependencies. These validators are dynamically selected by `readBuildConfig()` during ordinary source verification even though no new distribution is being built. The smoke test invokes the actual complete verifier against a small synthetic artifact using all four selected configuration branches, rejects each missing validator independently, and isolates temporary Git configuration/hooks/templates. Passing copied import tests alone did not establish this dynamic boundary; the original red results are retained.

Three new declarations add the already reviewed full Next, Retry and long-recording protocols described in [the lifecycle admission note](solo-final-lifecycle-admission-20261017.md). They make no failed-predecessor claim. They retain the anchored 34.29% First Return route, all ten Next/twenty Retry actions, the original long-recording route and strict replay/byte identity. Long-recording timing/journal evidence comes from the first active document, with paused restoration separately verified. Retry's memory profiling remains excluded from timing qualification.

All eight lanes use actual candidate `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`, tree `6b13627e324f695b6ee8d9f2dee2eeeb7217c332`, runtime `32abd322afd8243e4537ce4784e2f78ee45ecbec`, and the verified normal `8b01991942dc764b8aa4726851699ce1985e53ae` baseline. Candidate producer 39008793814 / artifact 12092903788 stays fixed. Every remote job must still perform complete archive, source and CSP verification before observations.

There are 48 declared jobs and 96 arms across these eight lanes: three equivalent counterbalanced pairs per browser and phase. Existing job envelopes remain 122 minutes for the four timing phases, 192 for soak/long recording, 152 for Next and 142 for Retry. The helper/observation deadlines, 128 MiB per-arm and 512 MiB per-job evidence caps and owned cleanup remain unchanged. Full source checkouts retain three minutes each; sparse tooling retains two. Every failure stays visible; no automatic Resume, retry, numerical pooling or threshold waiver is introduced.

## Verification and limits

The final isolated tools copy contains 240 files / 4,788,116 bytes and 43 frozen runtime scripts. Thirteen complete test files passed **192 tests with four platform-specific skips**, including the actual verifier smoke, all four missing-validator negatives, original witness checks, full lifecycle admission and the eight concrete release contracts. Raw result: `.cache/solo-followup/final-wave-a6e/timing-soak-v2/copied-v3.tap`, 51,655 bytes, SHA-256 `42d36bd26a673f523955b78d9176aded0e08750a5b1a91181eb07ccbe19849f7`.

Earlier small control failures remain retained: the first copied run propagated a cache-only loader through `NODE_OPTIONS` into deliberately isolated temporary declarations, which the loader correctly rejected; the corrected invocation scopes that loader to the copied test process. Two initial successor CLI assertions mishandled macOS temporary-path resolution and the existing `matrix=` output prefix; only those test assertions changed. Neither correction altered the verifier, game readiness or observation bounds.

These checks establish declaration/ownership/serialization contracts and the exercised source-verifier setup path. They do not establish frame-rate, resource stability, browser, iPhone 17 Pro Safari or Steam Deck OLED qualification. Missing baseline ownership fields remain inconclusive; passing bounds alone do not prove a retention plateau. The historical failed first-eight gate remains false and all performance qualification remains diagnostic-only until the separate required evidence is reviewed.
