# Local recovery propagation audit — 9 October 2026

## Decision

The recovery archive in PR [#1145](https://github.com/mekhovov/revealline/pull/1145) remains the immutable source record for local worktrees found on 9 October. This audit records which recovered work is already represented by current product code and which artifacts must remain archival rather than be copied into `main`.

No historical branch below is merged wholesale. Each was created from an older, divergent product state. Copying it would replace later integrations, content identities, generated release records, or current accessibility and input behavior.

## Product reconciliation

| Recovered source | Current-main successor | Disposition |
| --- | --- | --- |
| `codex/fpv-art-combined-verification` | `optional-practice/civilian-fpv/world-visuals.mjs` already contains the current woodland canopy maps, clustered crown geometry, branch batching, and current world-surface work. | Keep its evidence and planning checkpoints in the archive. Do not restore stale renderer code or old publication receipts. |
| `codex/unified-game-menus` worktree | Current shared navigation and presentation modules, including the native-menu and mission-browser integrations. The historical three-way port conflicts with 38 files because current mode contracts have changed. | Keep the exact worktree delta in #1145. Reintroduce a specific future menu behavior only as a new current-main feature. |
| Team picture and release worktrees | Current Team presentation and `coop-picture-*` modules. Historical release catalogues and compiled artifacts are version-specific output. | Preserve source snapshots; regenerate release artifacts from current sources when needed. |
| `codex/v1418-failure-continuation` | Current Team terminal flow carries an equivalent deliberate-retry change; `git cherry` identifies the historical commit as patch-equivalent to `main`. | No port required. Its unresolved historical conflict remains recoverable in #1145. |
| `codex/v135-replay-audit` | The current shared mission browser replaces the former compact-gallery path and retains current Team/mission entry behavior. | Do not restore the older gallery or release metadata. Keep its historical evidence in #1145. |
| `codex/ukrainian-ornament-study` | Current `whole-ornament-v1` route and the later `whole-ornament-v2` atlas retain and extend the ornament route family. | Keep the superseded study commits and fixtures in #1145; no parallel older route loader is introduced. |
| Cached/generated field-kit and localization output | Current build outputs and source-owned templates. | Never merge generated snapshots by hand; regenerate only from accepted current sources. |
| PR #1124 | PR [#1146](https://github.com/mekhovov/revealline/pull/1146) records the same current-main successor analysis for the legacy appearance-system bundle. | Preserve its tag and migration record. Do not merge #1124. |

## What is complete

- Every inspected local worktree, untracked source file, local-only commit series, and unresolved conflict stage has a GitHub-backed recovery record in #1145.
- The legacy #1124 branch is retained by tag `archive/pr-1124-unified-appearance-20261009`; #1146 describes its successor implementation on `main`.
- The current source tree contains the reconciled product successors listed above.

## What remains deliberately separate

A recovery archive is not a release candidate and does not certify browser, device, performance, package, or player acceptance. If a specific archived idea is requested later, its implementation must begin from current `main`, preserve current data identities, and arrive through a focused PR with current verification.
