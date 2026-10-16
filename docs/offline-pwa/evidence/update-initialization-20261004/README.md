# Installed-app update initialization — 2026-10-04

Baseline: `origin/main` at `f3764070e22f0b33b63fd0f7434690fa7455dc64`.

## Confirmed cause

The live `https://mekhovov.github.io/revealline/app/update.html` opened the
download screen, but its game status read:

> Offline preparation is available in a packaged release. The live development page keeps using fresh files.

The DOM's published offline marker was valid and contained **14 optional packs**
(build `96d9f53bcfeb93a58baa7e26c7019223ef24e01d56317414ec9f3dec59e16915`).
`configFromPage` still rejected more than twelve. The downloader therefore stopped
before assigning `catalogue`; its enabled selection controls could subsequently
call `gameplaySelection(undefined)` and produce the reported `catalogue.groups`
error. This also affects a fresh update-page visit, not only an older PWA.

The fix removes the historical slot-count cap on descriptive **published** pack
metadata. Array and entry validation, origin/scope validation, asset hashes, byte
budgets and imported-pack limits remain in place.

## Recovery behavior

- All selections and download/repair actions remain disabled until metadata and
  initial storage checks succeed. Event handlers also reject premature actions.
- Both metadata files load as a pair with a 30-second timeout, including response
  body reading. Update requests bypass the HTTP cache. The core manifest must
  match the edition advertised by the page before download consent is enabled.
- A failed initialization clears readiness/estimates, keeps actions disabled,
  and displays a localized retry panel near the top. The original error remains
  available under **Loading details**.
- **Retry loading update** reloads the current update URL, including its retained
  game return address. It does not delete downloads, checkpoints, profiles or the
  active installed edition, nor does it authorize a package download.
- Existing updater routing fetches the current downloader outside the old game
  worker. Once published, an existing installed icon can use this fix without
  reinstalling the app or clearing website data.

## Manual verification

Used the Codex in-app browser and `game/test/manual/update-loading-preview.mjs`.
The localhost preview serves the actual published launcher, metadata and module
graph, replacing only the changed downloader modules/body and localization.
It is a diagnostic preview, not a frozen release qualification.

1. Reproduced the public failure and read its 14-pack marker from the DOM.
2. Opened the corrected preview through `/revealline/app/update.html`, including
   the launcher worker handoff. The same 14-pack publication populated chapter,
   community and SIM selections and enabled **Update game · 84.3 MiB** for a
   fresh local profile's starter selection.
3. Returned one HTTP 503 for `offline-cache.json`. Recovery appeared, all game
   selections stayed disabled, and the primary button said **Download unavailable**.
4. Clicked **Retry loading update**. The update action became enabled again.
5. Delayed a manifest response for 35 seconds. The 30-second timeout displayed
   its localized explanation; the late response did not enable downloads.
6. Inspected the recovery panel and enabled update button at 393 × 852. No
   download was initiated and no arcade access gate was bypassed.

Screenshots: [recovery](recovery.png), [update ready](update-ready.png),
[timeout](timeout.png).

## Checks and remaining evidence

- PASS: ESLint, repository validation/localization, changed-file formatting,
  and full in-memory default package build. `build-summary.json` records the
  build result and identities of changed runtime files.
- Full-repository formatting reports 22 unchanged baseline files, listed in
  `format-baseline.json`; all are byte-identical to baseline HEAD.
- Added regression cases for pack-list growth, failed metadata/retry, cache
  bypass, changed-build rejection and stalled response-body timeout.
- Automated suites are **WAIVED_SKIPPED_NOT_PASSED** under
  `publishing/test-policy.json`; these cases were not executed.
- Physical iPhone/iPad standalone verification and an actual complete downloaded
  A → B upgrade remain outstanding. The preview verifies updater initialization
  and recovery, not full migration or offline-device qualification.
- Target the existing v0.150.0 release queue. No version bump, deployment or
  frozen-release modification is performed by this change.
