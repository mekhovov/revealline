# v0.8.0-rc1 packaged browser check

Built from the tested working source on 12 September 2026 with `node scripts/game-cli.mjs build --out .cache/round-18/candidate --version v0.8.0-rc1`. The build contains **116 manifest assets**, distribution ZIP SHA-256 `4fe76fa257a0729627d047ea2d04c65b8189789363b9fd3bf9095fd02de1d877`. Its source revision is explicitly null: this is a working-tree candidate, preceding the separately frozen release.

An owned CLI server served the build on port 8809. A header probe returned HTTP 200, correct HTML MIME type, no-cache, nosniff, no-referrer, the generated permissions policy and the production CSP. The game and new equipment module loaded with no sampled warning/error logs.

The normal UI installed Homeward Skies and loaded the existing Round 14 saved-flight prefixes. Together with the [source browser checks](source-browser.md), these continuations exercise both turning modes for each new seal:

| Candidate attempt           | Observed result                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supply Line / Grid + buffer | Restored both pickups, both banked regions and the carrier switch. Tap steering, Resume and Move up completed 71.1%, three lives, 11,910 points and gold. Supply Line earned and saved. |
| Safe Return / Immediate     | Restored a completed qualifying recovery. Resume and Move right completed 73.1%, three lives, 11,740 points and gold. Safe Return earned and saved.                                     |

Export player library retained two pictures, two scores and two seals with their distinct equipment/steering identities. The [profile report](profile-checks.json) records the export hash. These are manual final cuts after verified legal prefixes, not full manually flown attempts.

One picker attempt used a mistyped local QA path. The UI reported that the file could not be found and preserved the existing picture/seal. Reopening the picker with the correct path succeeded. This was a fixture-path error, not a missing distribution asset.

Offline preparation, a stopped-server continuation and byte-exact archive rebuilding belong to the subsequent frozen release check. No public host, native binary or physical device is claimed tested here.
