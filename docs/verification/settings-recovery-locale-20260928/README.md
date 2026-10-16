# Settings and recovery localization — scoped evidence

Base: `c5885a15561a88331c5566c5312392c4e5d8daf5`. Source-only follow-up. No new version, frozen artifact, deployed page, browser/device acceptance or whole-phase completion is claimed.

## Reproduced and corrected

- [Original keyboard runtime](key-baseline-red.tap): new component + mounted-host tests reproduce **14 failures**, with one teardown case passing. Original runtime was read from HEAD and substituted only for this serial run, then restored in `finally` before candidate checks. The candidate locale catalog was retained; keyboard uses only existing keys.
- [Original transfer runtime](transfer-baseline-red.tap): **three failures**, one unknown-error preservation case passing; 11 unrelated cases filtered. This was captured before its runtime edit. The failures cover both reviewed-source types and busy/cancel status.
- [Final combined cohort](focused-green.tap): **78/78 pass, zero skipped/failed** across six files. Includes existing binding/transfer compatibility and safety cases, 14 new remapping cases, one actual Solo app mounted-DOM journey and four transfer cases.

The Solo journey starts from legal inputs in an injected historical fixture, pauses an off-center grid turn, keeps active remapping and saved bytes through EN/UA/EN, applies one key and advances only after explicit Resume. It does not establish current public campaign artwork, layout, controller or phone behavior. Transfer tests preserve reviewed selection, no repeated I/O/copy on translation, exact external diagnostics and accepted Undo facts; existing transaction tests remain in the cohort.

## Reproduce

```sh
node --test --test-concurrency=1 game/test/key-settings.test.mjs game/test/key-bindings.test.mjs game/test/key-settings-locale.test.mjs game/test/key-settings-locale-host.test.mjs game/test/profile-transfer.test.mjs game/test/profile-transfer-suspended.test.mjs
```

Scoped ESLint passed for the two changed runtime files and three changed/new test files. Prettier passed for those files, the two interface JSON catalogs, plan note and runtime-maintainer skill. `git diff --check` passed. Importing `game/i18n/catalogs.mjs` and deep-comparing `globalThis.RevealLineTranslations` with every sorted EN/UK source namespace passed.

The generated catalog was rebuilt using the repository's actual `catalogBundle` function and pinned lz-string implementation, as an in-memory bounded substitute for the unavailable bare package. No new dependency was installed. At integration, merge source keys from concurrent localization PRs and regenerate once.

[Receipt](receipt.json) records exact source hashes and raw/retained log hashes. Retained TAP removes trailing line whitespace only. Sparse fixture failures and host-test assertion corrections preceded the final cohort; they were development failures, not product acceptance. Missing inputs were materialized from existing local Git objects, without downloading media: 10,572,036 bytes for mounted-host dependencies and 23,078,955 bytes for transfer pack fixtures.

Full tests/build, audible listening, public/offline replay, real browser rendering and physical iPhone/Steam Deck/controller qualification were **not run**. Existing full-suite/build waivers do not convert them to passes. The release coordinator still owns exact integrated-source and public acceptance.

See [completed and remaining plan](../../plan-status-2026-09-28-settings.md) and the appended runtime-maintainer prompt for integration boundaries.
