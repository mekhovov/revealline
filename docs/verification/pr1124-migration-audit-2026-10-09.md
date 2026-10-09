# PR #1124 migration audit

Reviewed 9 October 2026 against `origin/main` at `f9f01f1d2`.

## Decision

PR [#1124](https://github.com/mekhovov/revealline/pull/1124) must remain an
archive, not a merge candidate. Its two commits were made against
`6ecaced32e53db33add14d0db3138d3bc407522d`; merging them now would overwrite
newer mission identities, FPV behavior, visual overrides and delivery policy.

The archived source is retained by
`archive/pr-1124-unified-appearance-20261009`. This document records the
current-main review so a future change does not mistake that retained snapshot
for an outstanding integration.

## Product behavior retained on current main

Current main has successor implementations for the product work represented by
the legacy branch:

| Legacy area | Current-main contract |
| --- | --- |
| Shared versioned appearance and first paint | `game/presentation/theme-system.mjs`, `theme-bootstrap.mjs`, `theme-host.mjs`, and `game/test/unified-appearance.test.mjs` |
| Mission selection presentation | `game/ui/mission-library-browser.mjs` and its compatibility adapter |
| FPV world appearance | `optional-practice/civilian-fpv/renderer.mjs`, `world-themes.mjs`, `world-visuals.mjs`, and current FPV appearance tests |
| Studio, community and curated appearance controls | Current theme-family controls, Studio modules and focused tests |
| Pack-specific visual overrides | Current v1.1 pack records and retained per-level overrides |

The 598 legacy paths that still differ from current main are continuing files,
not a safe patch queue. Their current versions include later product work, so
the old blobs must not replace them.

## Paths absent from current main

Only seven paths from the legacy head are absent. None is a product behavior to
restore:

| Path | Disposition |
| --- | --- |
| `.github/workflows/deploy-main-pages.yml` | Retired release path; do not reintroduce its older publication contract. |
| `.github/workflows/publish-frozen-pages.yml` | Retired frozen-pages path; retained delivery policy supersedes it. |
| `docs/pause-menu-plan-review-2026-10-01.md` | Dated planning report; historical evidence remains with the archived PR. |
| `docs/plan-review-2026-10-01.md` | Dated whole-product plan; not current documentation. |
| `optional-practice/civilian-fpv/world-renderer.mjs` | Replaced by the current FPV renderer and World visual modules. |
| `publishing/pages-controller/workflow.test.mjs` | Tested the retired deployment workflow names and contracts. |
| `publishing/queue-throughput.test.mjs` | Tested a retired candidate workflow contract. |

## Follow-up rule

There is no safe production-code cherry-pick remaining from #1124. Any desired
idea from the archive must be reintroduced on a new branch from current main,
with its own current tests and source/provenance review. This prevents the
legacy aggregate from silently replacing later work.
