# Final frame-path browser regression

2026-10-20, 03:28:18–03:28:29 UTC. A fresh headless Chrome 155.0.8059.85
context exercised the actual local host after `frameSnapshot` / `stepFrame`
integration. The user's browser and radio tab were not used. Chrome closed
in cleanup.

The served `world-app.mjs`, `encounter-session.mjs`, `encounter-runtime.mjs`,
and `world-reaction-runtime.mjs` matched their workspace SHA-256 values.
The hashes and compact observations are in the
[JSON report](overhaul-frame-path-browser.json).

## Results

| Check | Observed result |
| --- | --- |
| Public full snapshot | Actor path remained present; mutating a returned actor position did not change the next snapshot. |
| Start and Fire | Native `stadium-01` hunting advanced to 58 accepted ticks and 11 shots. |
| Pause | Holding Fire for another 350 ms left ticks and shots unchanged. |
| Export current recording | Valid complete tick 0–58 archive, 36,313 bytes. |
| Continued flight after export | Same run advanced to tick 80 and 16 shots. |
| Close and real IndexedDB storage | Ended archive row covered ticks 0–80. |
| Watch imported file | Production playback verified all 58 ticks and 11 shots; Settings closed and self-level mode was restored. |
| Continue imported file | From a fresh acro launch, restored the exact saved position, run, tick 58, 11 shots, and self-level mode; Settings closed. |
| Continued archive | Flight advanced to tick 81 and 16 shots; export validated as a complete tick 0–81 archive, 38,371 bytes. |

No page errors occurred. The only console error was the local server's missing
`favicon.ico` (404).

The scene used twelve enemies, invulnerable player damage, one-hit enemy
damage, and real keyboard Fire input. The harness used public launch/pause/
snapshot APIs and visible recording controls. It did not modify production
modules, clocks, or accepted tick sequences. Downloads were read into memory
and validated with the production `inspectEncounterArchive` API.

This is a short correctness regression, not a new minute capture, long-history
run, regional-browser check, radio check, human-usability result, or performance
qualification. No trace, screenshot, or downloaded package was retained.
This evidence was transcribed from the completed inline run; recording it did
not rerun the browser.

The accompanying limited source review found no actionable correctness gap
in compact presentation fields, frozen frame ownership, event delivery,
pause overlays, recovery/archive paths, or the full public snapshot fallback.
Runtime suites were handled separately.

See the [archive host checks](overhaul-archive-host-browser.md) for the earlier
actual-minute capture, playback, and continued-history evidence.
