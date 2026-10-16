# Combined main regional qualification — 2026-10-15

This receipt separates three exact evidence sets: the frozen combined-main package, actual graphics-context recovery in the preceding package, and collision ownership in a later source workload. It does not merge their revisions or evidence boundaries.

## Frozen combined-main package

Source `c3368bb60da7002f157fc7e9cae2688a53fb546c`, tree `982823a6d4078f07ffa531e7a56657eeda4b3d1c`, includes the combined Library/texture work from #1287, strict paired-manifest admission from #1291, and independent archive import validation from #1297. GitHub ancestry checks returned zero commits behind each of those feature heads.

[Run 38658148642](https://github.com/mekhovov/revealline/actions/runs/38658148642) uses a preserved qualification branch at that exact source so subsequent main merges cannot cancel or silently replace it. The earlier duplicate main-scoped run was explicitly cancelled; other development was not held for qualification.

- Optional artifact: [11938251159](https://github.com/mekhovov/revealline/actions/runs/38658148642/artifacts/11938251159).
- Worlds version `v0.151.1`, revision `adccf16a6a972e03f38d7395788928f1a7cd2f6f5f06fc8802a4f4baeef3bba9`.
- Committed inputs and two reproducible builds verified. `publicEligible` remains false.
- All 15 top-level checksums and all runtime/source members of the three optional archives independently verified.
- Worlds has 156 manifest dependencies, 157 runtime archive members (17,368,690 uncompressed bytes), and 159 source archive members (17,411,653 bytes), within its unchanged 159-file / 20 MiB ceiling.
- Independent archive import graphs pass: Flight 68 modules / 96 imports; Academy 81 / 152; Worlds 129 / 319. The checker parses archive bytes without executing them or resolving missing files from a checkout.
- All 157 staged immutable members were compared with their archive bytes and matched. No external regional fixture is injected into the package.

The fresh isolated player origin is `http://127.0.0.1:9045`, with canonical launcher `/revealline/practice/fpv-worlds/app/` and immutable runtime `/revealline/practice/fpv-worlds/releases/v0.151.1/site/`. Both the optional-practice job and the broader company candidate job completed successfully in the exact-source run. The broader candidate was built and admitted by its cloud workflow; this receipt independently inspects the optional archives and the native Worlds journey. This is not a public publication receipt.

Native CUA verification on that fresh origin passed on the first preparation attempt: **Ready offline → Open prepared practice → Home → Explore → Download Urban → Saved review-r1 → Fly**. The normal shipped pin delivered all 38 files (1,455,090 bytes). Fly entered FPV ready at 3.0 m with zero input and disarmed. Explicit Arm and keyboard input produced flight; Space paused at 2.5 m with +3.2 m/s vertical speed, 0.7 m/s drift and 64% throttle.

Only the owned 9045 server was stopped, and the immutable URL was independently confirmed unavailable (curl exit 7 / HTTP 000). Reloading the same player URL restored cached Home; Explore retained Saved review-r1. Fly again entered ready at 3.0 m and zero input. Explicit Arm and flight then Space produced a paused 2.4 m pose, +3.1 m/s vertical speed, 0.7 m/s drift and 63% throttle. The server was restored and the exact entry returned HTTP 200. No player storage was removed or edited. This proves the tested origin-unavailable journey, not an all-network outage or browser-process restart.

The [companion receipt](fpv-regional-main-package-review-20261015.json) binds archive checks, screenshot hashes and both native journeys to the exact source and package revision.

## Actual graphics-context recovery: preceding frozen package

This separate native observation used the unchanged `9e43fc7f` / `b2613678…` package on 9043, already qualified in [the previous receipt](fpv-regional-library-package-review-20261015.md). An external page embeds the ordinary packaged player and exposes explicit **Lose graphics context** and **Restore graphics context** controls. It uses `WEBGL_lose_context` on that canvas and reports the actual context events. It does not restart the browser, alter the package, clear storage, or automatically arm flight.

One actual loss event and one restoration event were observed. Flight remained paused through both; Arm was disabled and there was no automatic arming. In that baseline, the existing menu required Home → Continue → Pause → Restart to rebuild the scene. Restart returned ready at the retained ground pose. Deliberate Arm, W and Shift+Up then produced a paused flight at 2.3 m height, +3.0 m/s vertical, 0.7 m/s drift and 63% throttle.

This confirms recovery and arming safety in the tested path, while exposing a usability gap: a renderer first created for a region lacks the ordinary localized recovery explanation, and Restart is not directly reachable from the compact flight menu. The separate shared-handler/menu correction is not attributed to either frozen package here.

## Later source collision workload

Diagnostic source `43ffb5a13f55eaf90dd5897a19571ef0e9b160b2` (#1300) adds explicit read-only ownership counts without changing physics or per-frame snapshots. A fresh run of the controlled shared-flight workload accepted 48,000 fixed steps at 50 Hz: **960 simulated seconds**, seven direction reversals and 37 origin recentres. Counts were sampled after steps and during detached frame preparation.

The peak was four owned query worlds, 18 live Rapier colliders and zero rigid bodies; awaited disposal returned all three counts to zero. Static query worlds do not contain the drone as a Rapier body. The [raw final result](fpv-regional-collision-sustained-20261015.json) records source/script identity and full final/disposed snapshots. The preceding 40-swap/40-rejection functional case and its evidence boundaries are documented in [collision ownership](fpv-regional-collision-ownership.md).

A second, longer run of the same diagnostic source accepted **360,000 fixed steps at 50 Hz: 7,200 simulated seconds**, 53 direction reversals and 269 origin recentres. Actual live counts were checked after every accepted step and during detached preparation. The peak remained four worlds / 18 colliders / zero rigid bodies; awaited disposal again returned all counts to zero. Final geometry/source bytes and all reserved geometry/source counts returned to zero on disposal. The [full final and disposed snapshots](fpv-regional-collision-360000-20261015.json) preserve resource peaks, exact inputs/script identity and raw-output hash. This is a deterministic Node workload, not two hours of elapsed native play.

Neither workload measures process heap, WASM allocator capacity, GPU memory, elapsed two-hour play, physical device/controller performance or browser-restart survival. The later diagnostic source is not retroactively part of package `c3368bb`.
