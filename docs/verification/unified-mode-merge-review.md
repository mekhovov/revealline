# Unified mode UX merge review

> Historical checkpoint. The [Company capacity follow-up](company-capacity-followup.md) resolves the
> capacity and optional actor-voice gaps below and records a completed full game ZIP.
> The original measurements remain unchanged for provenance.

## Reviewed source and fixes

Runtime commit `613ab6dce7ba57e0167927af63c7e5f2ed0d39fd` (tree `6bae8fddd9193dcc808f1c00ed2ea0297dad371f`) includes main through `24ce4caa7aba32199749254402affb7d5badb4d0`. This review completes the locally verifiable unified-menu implementation items. Later workflow/documentation commits retain this exact runtime; they do not constitute a new runtime build receipt.

- Worlds keyboard/controller Pause and Escape open the common paused menu. Worlds and Academy use shared menu icons and map terminal attempts to Results/Retry.
- Worlds Retry retains preview, replay, playlist, checkpoint and demonstration context, including the newly merged two-stick keyboard controls.
- Academy recording playback follows its paused playback clock, so Continue resumes the retained recording directly.
- Assisted flight reuses shared keyboard/controller navigation, one hardware poll per frame, neutral activation and held-key cleanup. Mission selection has one Review mission action.
- Completed-run menus expose Results, including after opening Menu during Snake's final-moves replay. Back/Escape does not resume gameplay or playback.
- Main's new level sharing and Sky Watch reward changes are retained. Localization conflicts were regenerated from merged source.
- Home navigation retires higher preparation dialogs even when the title is already open underneath. Flight Results returns to each retained native result scene, preserving completion actions and proofs without restarting or arming.
- The Military Field first-paint theme bootstrap is regenerated from the accepted theme catalogue.
- Main PR #987's new drone/container artwork is integrated. Its unrelated rollback to pre-#985/#986 copies is not propagated: two-stick controls, level sharing, Neon catalogue entries and their source evidence remain present.
- The main merge exceeded the existing core budget. The [bounded distribution projection](default-ui-host-capacity.md) restores admission without changing gameplay, authored assets, canonical source or package limits.

## Verification

Automated suites remain **waived and unrun** under `publishing/test-policy.json`. New regressions cover pause/menu ownership, playback continuation, retry context, controller/key release, Results return, the bounded code projection and explicit CI policy guards.

The first merge-review push exposed two older workflows that bypassed the waiver. Appearance preview run `37117814000` and MinIO recovery run `37117814003` were canceled during checkout, before any automated suite started. Both workflows now read the accepted policy before running suites; preview artifacts distinguish waiver evidence from passing tests. Mandatory source validation, production builds and artifact checksums remain required.

Full configured ESLint and changed-file formatting checks passed. The generated aggregate SIM stylesheet is checked through its source projection. Historical unrelated full-format baseline failures remain separate. EN/UK localization, distribution validation, presentation metadata, all four shared projections, first-paint/theme-grain generation and public-source eligibility passed. The seven existing links to release-generated destinations remain warnings.

[Raw source identity](unified-mode-merge-raw-source.json) and [immutable Git-blob verification](unified-mode-merge-source.json) verify **25,021 files / 2,357,645,544 original bytes**. Source eligibility also covers 378 declared assets.

Manual browser review confirmed Worlds P/Escape → shared Continue menu, gym keyboard mission navigation → briefing → Start → Escape/Continue, removal of duplicate preparation, Snake replay → Menu → Results, and the newly merged two-stick selector in flight Settings. A completed Worlds demonstration also returned through Menu → Results with its original 26.6-second outcome, Fly this challenge and Watch again actions intact. Those reviewed tabs reported no console errors. This supplements the prior [320/360/390px and landscape observations](unified-mode-ux.md); no physical gamepad/radio or simultaneous-touch qualification is claimed.

## Production preparation

[Clean committed-source preparation](unified-mode-merge-build.json) for candidate `v0.150.0` passed with **2,982 files / 999,428,116 payload bytes**. Core: **1,349 files / 66,910,244 bytes**, leaving **198,620 bytes** under the unchanged 64 MiB cap.

A complete release archive could not be written locally: ZIP alone requires 999,935,566 bytes; expanded output plus ZIP requires 1,999,363,682, versus 406,253,568 available at preparation. No unrelated files were removed. This is successful exact-source preparation, not a completed archive or public-release qualification.

All three [production optional-package builds and independent admissions](unified-mode-merge-packages.json) passed within unchanged limits:

| Package         | Runtime files / bytes | Complete source files / bytes | Limit files / bytes |
| --------------- | --------------------: | ----------------------------: | ------------------: |
| fpv-worlds      |      102 / 15,538,455 |              104 / 15,571,865 |    104 / 16,777,216 |
| civilian-fpv    |        69 / 4,346,686 |                71 / 4,375,132 |      72 / 8,388,608 |
| civilian-flight |          48 / 679,266 |                  50 / 704,449 |      64 / 8,388,608 |

## Remaining plan gates

The code review does not mark the entire long-term plan complete. All 84 Living Routes layouts retain their explicit preview qualification status. Human completion routes, physical devices/controllers, listening, Studio/account round-trips, offline installation and real-network review remain pending. The optional Company actor-voice package and Company's separately documented capacity blocker remain outstanding. Hosted/public matchmaking, online challenges and networked SIM remain later roadmap work. See the [implementation status](../expressive-enemies-implementation.md) and [layout inventory](../qualification/expressive-content-inventory.md).

[Final Company compilation](unified-mode-merge-company.json) passes source eligibility and committed-input validation, then reaches the unchanged capacity guard at **942 files / 67,659,546 bytes**, exceeding 64 MiB by **550,682 bytes**. This inherited blocker remains a failing Company-candidate check. The shared code projection is already applied; even all safely eligible JSON whitespace would not close the gap. No cap, artwork or pinned asset was changed to bypass it.

PR #984 is prepared for review against the active v0.150.0 milestone. This work does not merge the PR into main, enable auto-merge or authorize public promotion.
