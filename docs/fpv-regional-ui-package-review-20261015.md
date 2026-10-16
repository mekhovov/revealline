# Regional UI: exact package review, 15 October 2026

The compact flight controls, starting-point chooser and graphics recovery passed a native browser journey using the immutable package built from `c2e18b4bb9b0efd27bae9a795a06c415fa4291f9`. This is historical package evidence. The subsequently rebased PR heads and later controller, cold-preparation and Railway changes are not covered by this receipt.

## Exact inputs

- Cloud run: [38661454390](https://github.com/mekhovov/revealline/actions/runs/38661454390), artifact `11938648679`.
- Package revision: `7348eeecdbb1f38e87ebccad3c0c22e456c04d8e3dda3900611648359f534289`, version `v0.151.1`.
- Committed inputs verified, two reproducible builds, `publicEligible: false`.
- Fifteen top-level checksums and every member of all six runtime/source archives verified. The accompanying JSON preserves exact lengths, hashes, inventory counts and import-closure counts.
- Worlds runtime: 157 files / 17,374,494 uncompressed bytes. Worlds source: 159 files / 17,417,457 bytes. Both fit the unchanged 159-file / 20 MiB envelope.

The frozen player was staged at a fresh local origin, port 9047. Its release files were unchanged. Regional content came from the normal Library's immutable remote Urban review-r1 pin, without injected source data. An external, unshipped toolbar supplied explicit graphics loss/restoration controls and observed actual canvas events.

## Native acceptance

The launcher completed Download → Ready offline → Open prepared game. Explore → regional Download → Saved → Fly opened at the authored 3 m start with zero input and disarmed. The compact Menu/View controls were present, Menu opened fully labelled Pause controls, and choosing Tower Court then Restart here returned to a ready, zero-input, disarmed flight. Deliberate Arm and keyboard input produced movement; Space paused. The stale Preparing flight announcement was absent.

For graphics recovery, deliberate Arm and one second of throttle preceded actual context-loss event 1. Flight paused, Arm became unavailable and the interruption cue appeared. Actual restoration event 1 did not arm or resume. Menu contained labelled Retry and Starting point controls. Retry retained the pause menu and restored flight/camera setup. Only deliberate Resume followed by flight input moved the drone again: the final paused snapshot showed 2.6 m height, +3.3 m/s vertical speed, 0.8 m/s drift and 64% throttle.

Local screenshots are retained as `regional-ui-package-flight.png`, `regional-ui-package-context-recovery.png` and `regional-ui-package-context-recovered-flight.png` under the external `fpv-temp` evidence directory. Separate Ukrainian source checks also passed, but this package recovery journey was English.

## Remaining limits

Ready offline is the observed launcher state, not an all-network-offline claim. A stopped-origin journey was not repeated on this exact candidate. This receipt does not qualify physical controllers, phones, handheld performance, newer automatically rebased source, later fixes, new art or public catalogue admission. The exact machine-readable evidence is in [the companion JSON](fpv-regional-ui-package-review-20261015.json).
