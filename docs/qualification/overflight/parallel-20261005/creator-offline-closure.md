# Overflight offline closure correction — 2026-10-05

The previously built distribution classified `game/overflight/play.html`, its runtime and Studio as `tooling:workshop`; normal player installation and “Select all games” omit that optional group. The dynamic launch URL was not a literal dependency edge. This was a packaging defect, not evidence of working offline gameplay.

The source fix adds native `game/overflight/play.html` to the mandatory player entry points. Its actual imports pull the simulation, renderer, local Phaser, shared actor/artwork/motion, shell and audio code into player core. An explicit boundary keeps the linked `game/studio/overflight.html` optional. Studio, source PNGs and Motion Lab stay in the existing authoring package.

`creator-offline-closure.tap`: 7/7 tests pass, including a source-backed native dependency regression. ESLint and diff checks pass. `creator-offline-related-baseline.tap` preserves the broader 10/11 result: the untouched destination suite fails its pre-existing 12,000-character navigation metadata ceiling after the authored route catalogue grew. No destination behavior or bound was changed here. `creator-offline-baseline.json` verifies the exact-main comparison at `2d447bc790bdf3951251c99041c8a918363ece0a`: the route module, builder and test are byte-identical; both main and candidate produce 50 routes / 99 rows / 12,065 bytes against the 12,000-byte ceiling. This compares the exact pure function and route IDs, not an entire baseline suite run.

## Small browser test

Use a fresh dedicated localhost origin serving the final generated distribution, not the source checkout. Open `/game/downloads.html`, leave Solo Starter selected, click `#download-game`, and wait for the verified selection-ready status. No PWA icon installation is required. Then stop only that dedicated HTTP server and first-visit `/game/overflight/play.html` on the same origin; start, move, pause/resume and reach an earned upgrade. Do not prewarm the Overflight page online: the first offline navigation must come from installed storage. Reload and retry once while the server remains stopped. This verifies native mode readiness independent of the large optional authoring download.

For Creator offline review, while online expand `#chapter-choices`, select `input[data-group="tooling:workshop"]` (“Authoring tools and reference material”), click `#download-game`, and wait for verification. The previous build's authoring group was 154,031,591 bytes (819 files), so it must be explicit. Stop the dedicated server, first-visit `/game/studio/overflight.html`, edit/validate a sortie, use the native iframe preview, then Save and Install & Play to verify shared IndexedDB operation offline. Source PNG/Motion Lab views require this authoring selection. Keep other origins and their existing workers/storage intact.

Final build inventory and actual browser offline operation remain pending root verification.
