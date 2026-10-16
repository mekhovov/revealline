# Railway Library — exact package qualification

The immutable candidate at `8009089ed84a4067db112a24428f11f6304ee8fc`
passes archive verification and the normal prepared-player Railway flow. Source
and package changes after this candidate require their own combined qualification.

## Identity and archive checks

- [Cloud run 38667676428](https://github.com/mekhovov/revealline/actions/runs/38667676428):
  optional-practice and company candidate jobs completed successfully.
- Artifact 11943087422, `optional-flight-candidate-8009089ed84a4067db112a24428f11f6304ee8fc`.
- World revision `f383a7fa530df0ba04d851e23868f797ec6ac36a93a71717ff3ca71277330d34`,
  version `v0.151.1`; exact committed source tree is recorded in the JSON receipt.
- Fifteen declared artifact checksums, six runtime/source archive inventories and
  every member length/hash passed. Three finished-archive import closures pass
  without checkout fallback. World has 157 runtime members / 17,383,111 bytes and
  159 source members / 17,426,074 bytes, within existing 20 MiB limits.
- Official GitHub CLI artifact download was used. The outer transport ZIP was not
  retained; the contained archives and their checksums are independently verified.

## Native player observations

Codex in-app browser on macOS, 1280 × 800 viewport. Browser engine version was not
independently recorded; this is functional evidence, not a device benchmark.
Frozen player files were extracted unchanged and served on fresh local origin 9057.

1. Opened the actual launcher and chose Download for offline use. It reached
   Ready offline, then Open prepared practice opened the normal game menu.
2. Explore worlds offered the shipped Railway pin. Download saved `structure-r1`.
   First Fly reached Ready to arm at 16 m with zero commands, without Retry.
3. Explicit Arm, keyboard thrust/pitch and Pause produced actual movement:
   paused at 16.3 m, +3.0 m/s vertical, 0.7 m/s drift and 63% throttle.
4. Stopped only the owned local origin server. The cached player reloaded and
   retained the saved Railway revision. Fly again prepared disarmed at 16 m.
   Explicit input produced paused at 16.5 m, +3.2 m/s vertical, 0.7 m/s drift and 64% throttle.
   A direct origin request returned connection refused. The server was restored.

Screenshot names, lengths and hashes, complete archive identities and observations
are in [the machine-readable receipt](fpv-railway-package-qualification-20261015.json).
Evidence files are retained with the external frozen candidate; no player data was
cleared and no source package files were changed to make the journey pass.

## Remaining

This does not establish public availability, a full-network outage, browser-process
restart, physical-radio/controller compatibility, sustained FPS or two elapsed hours
of play. It predates live surface quality #1310, Urban review-r2 Library #1316,
Canyon Library #1320 and RGBA materials #1322. Their combined package and public
launch remain separate gates. Existing budgets and source ownership are unchanged.
