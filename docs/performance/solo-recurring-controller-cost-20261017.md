# Recurring controller work

The retained a6 Long Rail CPU profile samples repeated status translation and saved-radio restoration within the ordinary application update path. This change removes two unnecessary operations without reducing native gamepad polling, changing input edges or inferring a device timing improvement.

`controller-router.mjs` now retains one status message for the current translation key and accepted locale. Literal lazy `t()` calls remain visible to the localization extractor; all 15 referenced keys are identical before and after. Different statuses and locale changes translate immediately. No translation table or generated catalog content changes.

`controller-session.mjs` now reads/clones saved profiles only when an unrestored physical device could consume them. The full physical device set still participates in duplicate-identity rejection. New connection, reconnection, neutral-release gates, continuation seats and saved setup behavior remain covered.

A fresh real i18next/router control observes 120 hardware polls in both versions: unchanged waiting status translates 120 times before and once after. A source-bound session control observes 120 empty-device samples with identical frames: saved-profile clones fall from 120 to zero. These are operation counts, not browser timings. Regression controls also cover English/Ukrainian/English changes, ordinary joins, movement, disconnects, reconnection and restored duplicate radios.

The complete 12-file group passed **169/169**, including router, bindings, restoration, shared session, Solo radio, boost/recovery, localized copy, Team radio host, Versus start/localization hosts and package policy. The full raw receipt `.cache/solo-followup/recurring-controller-cost/combined-v2.tap` is 40,255 bytes, SHA-256 `4ea2377fe3094a311abf161a5c281afb8fb326291aa736bf05f486c711843164`. Scoped lint, formatting and diff checks passed. The package gate now includes both changed complete test files and both runtime source paths, for 112 files.

The initial 161/162 result remains retained in `combined-v1.tap` (39,343 bytes, SHA-256 `22f7d80ffad5c9642450e46d2e4a10d80b659292161203a358a81d0d4c797c6a`); its only failure was the old package count of 110 after adding two files. No runtime behavior or performance threshold was changed to resolve it.

Operation-count receipts in the same cache directory are `translations-before.json` (144 bytes, SHA-256 `31f18a1926802cde38146fd4ae28308d0054a1f6350c154a9b7253e53bd19545`), `translations-after.json` (142 bytes, SHA-256 `ee62ee8f8646a3e884168c33ae57f0bdc324aa8c613e63115ccbce4bb569b1c3`) and `restore-before-after.json` (620 bytes, SHA-256 `e05f06b8417093edd08a6e780a99b84e97307e7b170d19789c0b533d45f1792b`). Actual extractor equality is recorded in `localization-references.json` (1,081 bytes, SHA-256 `8d513ebeb076a752d715232f1b6b8689de947bd237367999a705f9c814c4c172`).

The previous native observations remain failed or excluded as originally recorded. Phaser's final canvas submission dominates sampled rendering stacks, but that native call does not separate raster, upload or driver costs. No canvas configuration change, renderer rewrite or recurring p95 improvement is claimed here.
