# Unified mode UX merge review

## Reviewed source and fixes

Runtime commit `aa2e46e9140e348091cf337f458dc49481422b51` (tree `4c7c7e74a004e449aabcb353a9212f6dd2e82c26`) includes main through `1aef4d70fa37c8911dbb47b4b128c253178c8b60`. This review completes the locally verifiable unified-menu implementation items. Later documentation-only commits retain this exact runtime; they do not constitute a new runtime build receipt.

- Worlds keyboard/controller Pause and Escape open the common paused menu. Worlds and Academy use shared menu icons and map terminal attempts to Results/Retry.
- Worlds Retry retains preview, replay, playlist, checkpoint and demonstration context, including the newly merged two-stick keyboard controls.
- Academy recording playback follows its paused playback clock, so Continue resumes the retained recording directly.
- Assisted flight reuses shared keyboard/controller navigation, one hardware poll per frame, neutral activation and held-key cleanup. Mission selection has one Review mission action.
- Completed-run menus expose Results, including after opening Menu during Snake's final-moves replay. Back/Escape does not resume gameplay or playback.
- Main's new level sharing and Sky Watch reward changes are retained. Localization conflicts were regenerated from merged source.
- The main merge exceeded the existing core budget. The [bounded distribution projection](default-ui-host-capacity.md) restores admission without changing gameplay, authored assets, canonical source or package limits.

## Verification

Automated suites remain **waived and unrun** under `publishing/test-policy.json`. New regressions cover pause/menu ownership, playback continuation, retry context, controller/key release, Results return and the bounded code projection.

Full configured ESLint and changed-file formatting checks passed. The generated aggregate SIM stylesheet is checked through its source projection. Historical unrelated full-format baseline failures remain separate. EN/UK localization, distribution validation, presentation metadata, all four shared projections and public-source eligibility passed. The seven existing links to release-generated destinations remain warnings.

[Raw source identity](unified-mode-merge-raw-source.json) and [immutable Git-blob verification](unified-mode-merge-source.json) verify **25,006 files / 2,357,145,388 original bytes**. Source eligibility also covers 378 declared assets.

Manual browser review confirmed Worlds P/Escape → shared Continue menu, gym keyboard mission navigation → briefing → Start → Escape/Continue, removal of duplicate preparation, Snake replay → Menu → Results, and the newly merged two-stick selector in flight Settings. Those reviewed tabs reported no console errors. This supplements the prior [320/360/390px and landscape observations](unified-mode-ux.md); no physical gamepad/radio or simultaneous-touch qualification is claimed.

## Production preparation

[Clean committed-source preparation](unified-mode-merge-build.json) for candidate `v0.150.0` passed with **2,982 files / 999,402,642 payload bytes**. Core: **1,349 files / 66,900,645 bytes**, leaving **208,219 bytes** under the unchanged 64 MiB cap.

A complete release archive could not be written locally: ZIP alone requires 999,910,092 bytes; expanded output plus ZIP requires 1,999,312,734, versus 298,885,120 available at preparation. No unrelated files were removed. This is successful exact-source preparation, not a completed archive or public-release qualification.

All three [production optional-package builds and independent admissions](unified-mode-merge-packages.json) passed within unchanged limits:

| Package         | Runtime files / bytes | Complete source files / bytes | Limit files / bytes |
| --------------- | --------------------: | ----------------------------: | ------------------: |
| fpv-worlds      |      102 / 15,522,945 |              104 / 15,556,354 |    104 / 16,777,216 |
| civilian-fpv    |        69 / 4,331,195 |                71 / 4,359,640 |      72 / 8,388,608 |
| civilian-flight |          48 / 678,826 |                  50 / 704,009 |      64 / 8,388,608 |

## Remaining plan gates

The code review does not mark the entire long-term plan complete. All 84 Living Routes layouts retain their explicit preview qualification status. Human completion routes, physical devices/controllers, listening, Studio/account round-trips, offline installation and real-network review remain pending. The optional Company actor-voice package and Company's separately documented capacity blocker remain outstanding. Hosted/public matchmaking, online challenges and networked SIM remain later roadmap work. See the [implementation status](../expressive-enemies-implementation.md) and [layout inventory](../qualification/expressive-content-inventory.md).

PR #984 is prepared for review against the active v0.150.0 milestone. This work does not merge the PR into main, enable auto-merge or authorize public promotion.
