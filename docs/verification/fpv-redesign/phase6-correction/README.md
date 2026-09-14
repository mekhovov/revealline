# v0.50 source qualification correction

This candidate descends directly from original P6 source `3d39907498cabd7491cdf643a5a7de64318f990f`. It keeps that source's gameplay, screens, content, production ledger, compiled asset bytes, immutable history and all four version fields at `0.50.0`. It does not adopt P7 artwork, runtime changes or reviewed-asset declarations, and does not replace any frozen tag or release.

The correction is limited to four host fixtures and source qualification infrastructure:

- Creator and storage-retention fixtures enter the existing Game data category through its real keyboard tab handler before addressing that panel's controls. Creator links remain excluded in practice and First Flight and when the category is hidden. Retention retains its original controller, pending request, Back, exact paused-flight and storage-write assertions.
- Exactly three featured-chapter readiness checks use a bounded 180000 ms allowance for importing and authenticating the complete original-image pack, matching other bulk-original host fixtures. Timeout diagnostics include the selected pack, picture state, status and app errors. Ordinary input waits and runtime timeouts remain unchanged.
- The Sentinel restart fixture passes its existing `INVENTORY_TIMEOUT_MS` allowance into the existing `soloPage` initial-readiness option. No global wait default changes.
- The qualification workflow retains validation, lint, all Node tests, formatting, native formatting and Motion Lab syntax. Its four deterministic test jobs record exact commit/tree, Node and source hashes, and print their file lists. The existing production reproduction check remains required. The P7 reviewed-ledger check is explicitly not applicable when its script is absent from this P6 source; that message does not establish artwork readiness.

The sharder is copied unchanged from the integrated source workflow. The original P6 test discovery has 318 files, partitioned 80/80/79/79, each appearing once. The original package files, build config, production ledger and compiled runtime manifest were compared byte for byte; `source-scope.json` records their hashes.

Focused verification receipts and final exact-source hosted qualification are recorded separately. Local host tests model DOM/events and do not constitute browser or physical-device acceptance. Publishing and freezing belong to the release process after every hosted gate passes for this candidate's exact commit and tree.

## Local focused checks

- Creator and storage-retention: **4/4 passed**, Node 20.19.5, with the real category handlers and original state assertions (`settings-fixtures.txt`).
- Complete v0.50 device-controls file: **8/8 passed**, Node 20.19.5, including all three exact-original preparation cases with the final 180000 ms allowance (`device-controls-fixtures.txt`).
- Sentinel: both complete subtests and their parent passed on Node 24.19.0, including all three downloads/wins, exact backup, new-app authentication and saved still/null-story owners. Its unchanged runtime and corrected Sentinel fixture ran in the earlier combined process while the device fixture still used the superseded 30000 ms allowance. That process failed those two device cases; its obsolete device child was stopped while Sentinel completed independently. `provisional-30s-and-sentinel.txt` preserves the full mixed output and is **not** a passing whole-run receipt. The clean final device run above supersedes only those device results.
- Changed JavaScript passed ESLint; JavaScript, workflow and correction documents passed Prettier; `git diff --check` passed. No full local build or full-suite claim is made.

`corrected-source-hashes.json` pins the final four fixture files and qualification workflow/runner. The source-gate run triggered by the subsequent commit remains authoritative for all 318 test files and all six gates.
