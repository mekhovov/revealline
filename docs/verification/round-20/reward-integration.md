# Chapter reward integration checks

Verified **12 September 2026** against the current post-v0.9 source. The independent [chapter integration suite](../../../game/test/chapter-reward-integration.test.mjs) passes **13/13 tests** in about 1.2 seconds. ESLint and Prettier pass for that test file. This count is a focused subset of the project's tests, not an additional full-suite total.

The reviewer owns only the new test and this note. The milestone projection and replayability correction were implemented separately in `progress.mjs`; the app's collection/result presentation is separate work.

## Real routes and unchanged expectations

The suite steps normal public core inputs and records replays for all three Homeward specialty routes and all three Workshop ordinary routes, under both immediate and grid-center steering. It uses public `recordLibraryCompletion`, which calls the ordinary completion validator; it does not inject clear counters, alter run state or create a synthetic won result.

Homeward's complete summaries and authoritative checkpoints match the existing proof. Workshop summaries match its existing expansion proof, and its board/player/trail/enemy/objective/supply/ability/clock/continuation checkpoint sections match the original equivalent Homeward ordinary routes. Workshop has intentionally different map/display identities, so identity/configuration/result hashes are not incorrectly equated with Homeward. Each recorded replay is also verified through the existing replay verifier.

Both input files are pinned without regenerating their expectations:

- Homeward routes SHA-256: `63a77908b1ce98b480f9fd0431894e4f1d58ad56e4266ae0860206de564d8c1a`.
- Expansion routes SHA-256: `22886cf439f716db31333b3b6d9fae0478f8007aff734632badc7c2f38dc53c8`.

A complete three-map Homeward profile was independently produced once using frozen v0.9 site core/library modules, source commit `315a4782a159f2274f7200e3470ec20c3859707b`. Its export is **3,830 bytes**, SHA-256 `046288ac3e835b01d295b65b6a6c612f9ae0b9de916c45d0cebb0a229e240658`. The new test must reproduce those exact profile bytes with current code. Normal execution uses only the embedded oracle and current modules, with no Git or archived runtime dependency. No existing fixture or release was edited.

## Covered player behavior

- Both chapters reach the final cosmetic tier after their third distinct map clear. The first tier appears after one clear; the second clear creates no new tier delta. Pathfinder agrees with the contextual target.
- Duplicate delivery of the same run is idempotent. Repeating one map with the other steering policy adds its setup variant but not another distinct clear or unlock delta. Eligibility remains local to the selected campaign.
- A complete compatible profile derives the newly reachable tier without adding a field, rewriting progress or inferring an equipment seal. The retained one-argument unlock API still has the old four-clear behavior.
- Ordinary Workshop routes receive chapter cosmetics but independently fail their equipment-goal verification. A separately verified Steady Signal record survives mixed v1/v2 full-backup export/import and Homeward removal/reinstallation, with all six pictures and scores retained.
- Real out-of-order Workshop map-2 wins remain replayable with map 1 uncleared, before and after portable-library/full-backup import, under both policies. A map-3-only clear likewise remains replayable but does not unlock uncleared map 2. This checks the narrow own-clear exception rather than broad sequence bypass.
- Practice completions do not update the library or unlock tiers. A refused profile write keeps prior stored bytes while the completed chapter and its cosmetic eligibility remain exportable for the current session.

The `newAppearanceBodies` helper is a pure before/after comparison, **not a live-event authority**. Equal adopted snapshots yield no delta, and projections do not mutate a profile. The app must still invoke the delta only around eligible live completions; avoiding toasts during import/adoption requires separate app/browser review. These tests do not claim that this UI lifetime decision follows automatically from a pure helper.

## Commands and limits

```sh
node --test game/test/chapter-reward-integration.test.mjs
node node_modules/eslint/bin/eslint.js game/test/chapter-reward-integration.test.mjs
node node_modules/prettier/bin/prettier.cjs --check game/test/chapter-reward-integration.test.mjs
```

Temporary TAP output: `/tmp/round20-reward-integration.log`. Dedicated Homeward artwork is omitted only from these test inputs; map and recipe data are retained. The procedural Workshop needs no embedded images. An injected decoder throws if image allocation is unexpectedly requested. The storage-refusal check uses an in-memory adapter. No browser, physical controller, rendered-body comparison, audio, native device, real storage quota or enjoyment claim is made by this suite.
