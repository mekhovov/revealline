# Team presentation fixture integration

Status: source correction, not a completed phase or release. Runtime base `8cffb36b29a38013eb9213845efd675c4864c9d8`; test correction `efd340d4` on `codex/team-presentation-test-fixtures`.

The complete 689-file Node20 run against the unchanged runtime base exposed incomplete older Team fixtures. That original run remains retained and must finish before its results are summarized. It also found sparse-worktree inputs absent from disk; those are distinct from assertion failures.

## Corrections and preserved oracles

- Current identity assertions name reviewed FPV revision41; retained revision38 records and their independent ownership tests are unchanged.
- Actor/current terrain/victory fixtures prepare required Team frames. The shared finite frame reader verifies the actual original PNG SHA256, bytes and dimensions.
- Event-specific overrides delegate all unrelated frames to the prepared source.
- The historical no-reader terrain scenario explicitly loads the SHA-pinned retained primitive manifest. Current frame preparation is not weakened.
- Arena observations select the full-arena draw geometry; raw image logs still include every decoration. Exact decoded picture identity, no pre-Start paint, ownership and stale-image assertions remain.
- Wall replacement/rejection checks count every wall cell and reject stale/rejected objects while allowing unrelated Team decorations. Trail geometry, collision/state invariance and pause checks remain.
- The audio host’s finite Canvas returns assigned style properties instead of functions, so actual contrast code sees the assigned color. Production validation remains unchanged.

## Verification boundaries

The focused run loads exact committed corrected test/helper bytes through a SHA-checking Node loader over the unchanged runtime base. This avoids mutating dependencies underneath the separate full-suite process. It uses actual runtime/core/lease logic and source art, with finite DOM/Canvas observations. It is not browser rasterization, audible listening, a complete source gate or physical-device qualification.

The initial candidate cohort passed118 cases on Node20 and the separate terrain cohort passed28. Final commit `efd340d4aefef70023d6e55d464cd0b8f05777eb` passed **167/167 on Node20.19.5 and 167/167 on Node22.22.2**, with no skipped/cancelled cases. This includes all ten corrected test files plus retained presentation ownership tests. Every loaded tracked module was compared with its exact Git source blob; see `source-proof.json` and the per-runtime inventories. Raw TAP is retained as deterministic gzip. `initial-failure-excerpts.txt.gz` preserves58 original failing cases, selected from the still-running baseline with its observed-prefix hash. The retained loader/launcher files document that measured isolated run; after normal checkout/hydration these are ordinary Node test files and need no loader. The original complete-suite run remains separate and in progress.

No version is allocated. PR209 and its public acceptance precede the held landscape work; the controller must reconcile the overlapping handheld CSS before any new release. The original full source run, all remaining source gates, final browser journeys and public inventory verification remain required.

## Device research retained

[Apple’s viewport guidance](https://developer.apple.com/videos/play/wwdc2022/10048/) distinguishes small, large and dynamic viewport heights. Test actual Safari browser-bar expansion/collapse and rotation instead of treating fullscreen permission as a prerequisite for a usable arena.

[Valve’s compatibility requirements](https://partner.steamgames.com/doc/steamhardware/compat?language=english) require the default controller configuration to reach the game’s content. A modeled fresh-A launch does not qualify a physical Steam Deck, reconnect or every menu journey. These remain explicit rows in `docs/shared-device-play.md`.


## Full-run interruption —2026-09-21

The release coordinator explicitly stopped the unchanged689-file Node20 run when shared free disk reached approximately1.2GiB. Session54995 terminated with exit143; its process group was confirmed empty. Its last observed top-level case was3615. This is **incomplete qualification**, not a successful source gate. The exact1,834,913-byte partial TAP remains at the absolute path in `interrupted-full-run/full-node20-status.json`, with SHA256. Earlier statements that the run was active describe the focused checks' observation time.

After every owned worker stopped, only the78 measured temporary hydration inputs were removed. Each original was checked against its exact Git blob before restoring its absent sparse-checkout state. The detailed cleanup receipt records all paths and hashes:122,693,557 logical bytes removed,119,824,384-byte observed shared-volume free-space increase. Source8cff remains clean; Git objects, commits, focused proofs and all controller/release/browser caches were preserved. The observed additional26 missing test inputs are inventoried, not downloaded. That inventory is partial and does not establish a complete future test environment.

Do not restart the full run until capacity and the complete intended test inputs are available. Adopt the reviewed test corrections in the final intended source, then rerun required source/browser/public gates. Do not overwrite the earlier raw failure evidence or promote partial counts to acceptance. The original167-case focused results and later9-case display results remain bounded passes on their recorded commits.
