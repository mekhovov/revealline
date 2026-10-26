# Local work reconciliation — 26 October 2026

Owner-selected policy: retain PR #1615 at source conflicts and add only distinct local work. No force-push, history replacement, duplicate PR, or changes to the live working files.

Baseline: PR head `1eb563f05ce2fe77cab7899909a36666bfade574`; current main observed at `4c47c05662c3505672f60dc5c1e2a81e122e9811`.

## Accounting

- All 2,927 changed local paths were snapshotted and verified before composition.
- 2,848 paths exactly match the existing PR head and are not re-added.
- 76 paths differ from the PR head. Keep the PR versions, including its later code, tests, generated recordings and canonical qualification results. Exact older contents of 27 of these paths were found in its first-parent history.
- Three paths are absent from the PR: personal CLI configuration, a machine-migration guide, and an older full-size rotation screenshot. The two personal files remain private and backed up; the screenshot is retained below.

## Source decisions

Mechanical three-way composition suggested four residual files. Review rejects applying these outputs as new source:

- `game/snake/classic-app.mjs`: the later PR already declares `demoHost` beside writer ownership; the old local declaration would duplicate the binding.
- `game/ui/demo-host.mjs`: the PR already has unified `prepareScene`, the retirement deadline, stage reporting and native cleanup. Transplanting fragments of the older split preparation introduces an undefined `prepareSoloScene` call and duplicate native setup.
- `game/test/fpv-regional-preparation-clock.test.mjs`: the alternative removes existing assertions and targets an older frame implementation. Do not append it as an independent test change.
- `optional-practice/civilian-fpv/world-app.mjs`: fragments target an old inline step loop. Current main already has `pumpFlightSteps`, a frame error boundary, and a stale-clock guard that discards waiting time while retaining an armed flight. Preserve both current main and demo ownership during the later main integration instead of replacing the app with this stale local file.

## Distinct historical evidence

Retained under `retained-local-20261018-0436/`:

- Full and narrow screenshots from the incomplete rotation started at 2026-10-18 04:36:28 UTC. Its original JSON is already byte-identical to `rotation-before-engine-preference.json` in the PR, so it is referenced rather than duplicated. That attempt failed the available-modes rotation assertion at 04:41:58 UTC.
- `survival-fresh-chromium.json`: an earlier complete attempt from 04:47:38 to 04:47:46 UTC, separate from the canonical later PR attempt.

The 47 open PR heads were checked for this qualification directory. Only #1615 contains it; no other head returned the directory. All proposed retained bodies were also compared with the entire current #1615 tree by Git blob identity to avoid another copy under a different name. No gameplay source is re-applied.

These historical artifacts do not qualify current source. This evidence-only reconciliation runs no game tests, claims no new browser/radio/device validation, and leaves the PR draft. Its existing conflict with main remains a separate source-integration task.

## Differing-path decisions

| Path | Decision |
|---|---|
| `.specstory/cli/config.toml` | Keep private; retained in verified local backup |
| `authoring/solo-demo-generated/solo-qualified-67de5079eb3bf92d.json` | Keep PR version; local original retained in verified backup |
| `docs/codex-migration-guide.md` | Keep private; retained in verified local backup |
| `docs/fpv-current-completion-plan.md` | Keep PR version; local original retained in verified backup |
| `docs/qualification/shared-demos/README.md` | Keep PR version; local original retained in verified backup |
| `docs/qualification/shared-demos/rotation-chromium-two-hour-narrow.png` | Retain immutable earlier artifact; keep canonical PR path |
| `docs/qualification/shared-demos/rotation-chromium-two-hour.json` | Already byte-identical at `docs/qualification/shared-demos/rotation-before-engine-preference.json`; do not duplicate |
| `docs/qualification/shared-demos/rotation-chromium-two-hour.png` | Retain immutable earlier artifact; keep canonical PR path |
| `docs/qualification/shared-demos/survival-fresh-chromium.json` | Retain immutable earlier artifact; keep canonical PR path |
| `docs/qualification/solo-demo-coverage.json` | Keep PR version; local original retained in verified backup |
| `docs/qualification/solo-demo-scope.json` | Keep PR version; local original retained in verified backup |
| `docs/shared-game-demos.md` | Keep PR version; local original retained in verified backup |
| `game/app.mjs` | Keep PR version; local original retained in verified backup |
| `game/build-config.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/catalog.journey-archive.json` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `game/demo-data/catalog.journey-current.json` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `game/demo-data/catalog.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-28e4ea0f6087b260.chromium.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-28e4ea0f6087b260.firefox.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-28e4ea0f6087b260.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-28e4ea0f6087b260.webkit.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-67de5079eb3bf92d.chromium.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-67de5079eb3bf92d.firefox.performance.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-67de5079eb3bf92d.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-data/solo-qualified-67de5079eb3bf92d.webkit.replay.json` | Keep PR version; local original retained in verified backup |
| `game/demo-director.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b49d61e0e7b8` |
| `game/demo-experience.mjs` | Keep PR version; local original retained in verified backup |
| `game/demo-modes/snake-recording.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `24100e17d2ba` |
| `game/demo-modes/solo-builtins.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `94ac144cbab8` |
| `game/demo-modes/solo-catalog.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `94ac144cbab8` |
| `game/demo-modes/solo-view.mjs` | Keep PR version; local original retained in verified backup |
| `game/demo-modes/solo.mjs` | Keep PR version; local original retained in verified backup |
| `game/demo-modes/survival-replay.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `24100e17d2ba` |
| `game/demo-modes/survival-runtime-variants.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `game/demo-modes/survival.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `24100e17d2ba` |
| `game/demo-sources.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `94ac144cbab8` |
| `game/i18n/catalogs.mjs` | Keep PR version; local original retained in verified backup |
| `game/index.html` | Keep PR version; local original retained in verified backup |
| `game/overflight/app.mjs` | Keep PR version; local original retained in verified backup |
| `game/overflight/controller.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `a1f34c3569fb` |
| `game/snake/classic-app.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/classic-snake-ui.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/demo-controller.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `a1f34c3569fb` |
| `game/test/demo-fresh-handoff.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `bc98dda943df` |
| `game/test/demo-native-host.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/demo-recordings.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `game/test/demo-retention-host.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/demo-sim-input.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `a1f34c3569fb` |
| `game/test/demo-solo-catalog.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `94ac144cbab8` |
| `game/test/demo-solo-coverage.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `game/test/demo-sources.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/demo-survival-fresh.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/demo-survival.test.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `24100e17d2ba` |
| `game/test/edition-runtime.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/edition-solo-host.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/fpv-regional-preparation-clock.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/fpv-world-appearance-ui.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/test/helpers/demo-host-fixture.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `bc98dda943df` |
| `game/test/mode-play-shell.test.mjs` | Keep PR version; local original retained in verified backup |
| `game/ui/controller-router.mjs` | Keep PR version; local original retained in verified backup |
| `game/ui/demo-controller.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `a1f34c3569fb` |
| `game/ui/demo-entry.mjs` | Keep PR version; local original retained in verified backup |
| `game/ui/demo-host.mjs` | Keep PR version; local original retained in verified backup |
| `game/ui/demo.css` | Keep PR version; local original retained in verified backup |
| `game/ui/mode-play-shell.mjs` | Keep PR version; local original retained in verified backup |
| `game/ui/native-menus.mjs` | Keep PR version; local original retained in verified backup |
| `optional-practice/civilian-fpv/demo-data/coverage.json` | Keep PR version; local original retained in verified backup |
| `optional-practice/civilian-fpv/demo-input.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `a1f34c3569fb` |
| `optional-practice/civilian-fpv/flight-fullscreen.mjs` | Keep PR version; local original retained in verified backup |
| `optional-practice/civilian-fpv/world-app.mjs` | Keep PR version; local original retained in verified backup |
| `publishing/optional-package-policy.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `0c671eb8f8ed` |
| `scripts/edition-runtime.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `0c671eb8f8ed` |
| `scripts/game-cli.mjs` | Keep PR version; local original retained in verified backup |
| `scripts/generate-survival-browser-demos.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `scripts/generate-survival-demos.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `scripts/qualify-shared-demo-browser.mjs` | Keep PR version; local original retained in verified backup |
| `scripts/qualify-solo-browser.mjs` | Keep PR version; local original retained in verified backup |
| `scripts/qualify-solo-demos.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `b032e96797e1` |
| `scripts/qualify-survival-fresh-browser.mjs` | Keep PR version; local original retained in verified backup; exact local body already in PR history at `22ad3cebaffc` |
