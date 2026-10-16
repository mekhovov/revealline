# Settings native-key evidence — 28 September 2026

Base `bb9b3640270dc26633d37cfdf4a306aecda277b6`; source-only follow-up with no allocated release. [Receipt](receipt.json) binds runtime/tests and raw compressed evidence by SHA-256.

## Results

- Original component: **8 pass / 4 fail** out of 12, all failures under cold Ukrainian startup. They reproduce rejected literal Home/End, wrong translated-label ownership, hidden/disabled endpoint navigation and shared controller-adapter handoff. See `original-component-red.tap.gz`.
- Corrected settings, shared controller and modal navigation cohort: **235/235 pass**, zero skip/fail. See `navigation-green.tap.gz`.
- Actual Solo app mounted-DOM journey: **1/1 pass**, cold Ukrainian, legal off-center grid cut, Settings Home/End and UK/EN/UK, exact paused checkpoint and stored bytes, close remaining paused and explicit Resume. See `solo-host-green.tap.gz`. This injected historical campaign is not public-content or pixel/layout evidence.
- Scoped ESLint and formatting pass; no generated catalog or new translated text. Read-only peer review found no issue with runtime ownership or the cold-locale host test. Stored-byte preservation does not claim zero storage-write calls.

Commands:

```sh
node --test --test-concurrency=1 game/test/settings-panels-locale.test.mjs game/test/settings-panels.test.mjs game/test/controller-navigation.test.mjs game/test/modal-navigation.test.mjs
node --test game/test/settings-panels-locale-host.test.mjs
```

## Browser evidence

The isolated [fixture](browser-fixture.html) loads the actual shared module after setting Ukrainian, then uses native browser Home/End actions. [Observed states](browser-observations.json) show the original rejection and corrected first/last selection with matching focus; Home continues to work after switching to English. A screenshot was inspected. The temporary tab and loopback server were closed.

Ordinary browser reload retained the old dynamic module once; the fixture used a new import query followed by reload to verify the changed source. The harness query does not alter the module bytes. This is local component-browser evidence, not the actual full game, public release, phone, gamepad or screen-reader acceptance.

## Initial failures and boundaries

The first wider runs lacked sparse metadata, the silent MP3 fixture and compiled artwork, so affected host routes failed before reaching Settings. `incomplete-fixture-attempt.tap.gz` retains the last such 12-failure attempt as diagnostic evidence only. Missing inputs were restored from existing local HEAD objects: 127 JSON/metadata files (11,247,325 bytes), 132 compiled assets (4,009,342 bytes) and the existing silent MP3 fixture. No install, external media download or test timeout relaxation. The final full selected cohort above runs after restoration.

Full suite/build remain not run under the existing waiver; no public, offline or physical-device claim. Protected merge/version/freeze/Pages acceptance remains with the release coordinator. [Current plan](../../plan-status-2026-09-28-native-keys.md) separates delivered, queued and remaining work.
