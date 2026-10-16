# Company capacity and FPV history recovery — 30 September 2026

This follow-up is based on refreshed main `451b82dc13dc8a8545ff964ffb724d3d756ac62a`, including the merged Ready-handoff repair (#816). The rebase completed without conflicts. It does not replay the superseded aggregate release branches or change release versions, deployment policy, simulation, scoring, or size limits.

## Changes

- A compiled standalone edition uses its own unchanged menu scene as its fallback. The default game and multi-edition builds retain their neutral FPV fallback. This removes two unrelated FPV menu images from the DroneAid Netherlands artifact while keeping its scene, original source assets, selected campaigns, and pinned presentation history.
- Persisted `pagehide` suspends FPV rendering and releases live input without disposing the cached page. Persisted `pageshow` restarts one render loop and preserves the paused attempt. Resuming still requires explicit action; radios require a fresh arm edge and matching airborne control pickup. Ordinary unload still disposes permanently.

## Evidence

- All 34 tests in `game/test/fpv-flight-ui.test.mjs` and `game/test/fpv-radio.test.mjs` pass on Node 20.19.5, including keyboard and radio Back/forward-cache recovery and permanent unload.
- The standalone menu projection test covers every registered edition; the multi-edition fallback test passes. The exact DroneAid original/derivative test also passes after restoring its sparse fixtures from Git. An independent code review found no actionable regressions.
- Scoped ESLint, Prettier and `git diff --check` pass.
- Two in-memory compilations of `droneaid-nl-community` used exact input blobs from the main revision above and this batch's compiler, with version `v0.142.4` and offline base `/revealline/`. Each produced **792 files / 66,795,192 bytes**, leaving **313,672 bytes** below the unchanged 64 MiB guard. Every output path and byte hash matched between compilations; `edition-build.json` SHA-256 was `a868599d47b9340ba734cd54239f320ba904b1f9e8265a0baf4c0c9a8a8f4968`.
- Both unrelated FPV menu rasters are absent. Compiler code-closure and public source-eligibility validation passed (791 pre-build-manifest files, 97 assets). Source/player provider parity passed for the current presentation and all four retained presentation revisions.
- This compilation check did not write ZIPs or claim archive reproducibility, frozen-source admission, deployment verification, or installed-browser qualification.

The broader edition-runtime suite was attempted but is **not green** in this sparse checkout: the first run passed 10 tests and lacked three tracked media/resource fixtures. A retry during disk exhaustion passed nine and failed four due to missing fixtures and `ENOSPC` creating a temporary directory. Test fixtures were read from exact Git blobs; no source was altered to bypass these failures. Only the temporary fixtures created for the retry were removed afterward.

## Delivery and remaining work

Combine these two repairs in one follow-up PR targeting the existing v0.150.0 milestone. Keep cumulative qualification and promotion with the release coordinator. The full edition has only about 306 KiB of headroom; additions from other inputs must pass the same complete-output guard again.

1. Qualify the combined candidate after the open Creator Guide (#815), spatial audio (#817), optional-download readiness (#818), settings verification (#819), and level routes (#820) inputs are resolved. These PRs have their own owners; this batch does not overwrite them.
2. Rerun the full edition suite with its committed fixtures and sufficient storage; produce and verify frozen archives and installed/offline behavior through the existing pipeline.
3. Verify actual browser Back/Forward behavior with WebGL and the deferred physical radio/device and human evidence. Synthetic lifecycle tests do not establish those results.

## Local-work audit

The primary checkout was clean. A read-only audit examined 266 worktrees and all 821 current remote branch references. Historical integration tips `1c70bc3a92cc6e36247badb80d17e9371b40c46d` and `26e64d3d81e24597fab4cdf2d53efa5e9d4217c3` are now preserved on GitHub as `codex/preserved-native-integration-20260930` and `codex/preserved-radio-release-input-20260930`. They are recovery references, not release inputs: many changes were adopted under different commits and the branches contain obsolete release state.

Repository-wide cleanliness is not claimed. At the audit snapshot, 49 other worktrees contained meaningful edits, including actively changing levels/menu work, historical integration residues, and an old conflicted checkout. One historical tree contained 1,838 staged deletions. These were preserved in place and were not swept into this PR. This follow-up commits and pushes only its reviewed changes.
