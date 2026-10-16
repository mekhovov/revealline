# Public native-menu check — September 30, 2026

A fresh in-app browser check of the [default game](https://mekhovov.github.io/revealline/game/) and [DroneAid](https://mekhovov.github.io/revealline/game/?edition=droneaid) reached the branded landing screens. Default exposes Solo/Versus/Team; DroneAid exposes Solo only. Unindexed native keyboard input opened Settings and Back restored `shell-options` on both routes. No Start/Continue, player gameplay, saved-content operation, settings change, cache clearing or service-worker removal was performed.

The prior retained-client missing-export error was not retested. These newly opened clients booted successfully. Default's idle Demo opened while the other route was inspected, so an initial bounded Tab traversal remained in the Demo. Escape returned to the landing, after which Settings/Back passed. This is not a complete Demo qualification.

## Observed landing regression

Both public routes visibly expose **Play music, Next song, Collection, How to play, FPV flight simulator and Flight practice** on the landing. This violates the approved landing list. Preserve these actions inside the relevant Settings sections; only title, Start/Continue, Select Mission, Settings, Sound, supported mode names/icons, passive song/version information and the subsequently authorized Fullscreen action belong on the normal landing.

The default screenshot confirms the visible extra music, Collection and Help actions; accessibility and DOM observations also identify both practice shortcuts. The same action list was observed on DroneAid. This is a current browser finding, not a conclusion drawn from historical test expectations. Releases received the finding and the request to prioritize it during menu reconciliation. No corrective runtime patch is included in the Ukraine gallery batch.

## Publication provenance and scope

At **14:32:34 UTC**, HTTP `release.json` reports continuous-main source `1e0fa85b048ce7ebbf8732632e001b83e5a90ac4`, build identity `main-1e0fa85b048c`; `game/build-info.json` reports the same source and version **0.142.4**. This independently supports the publisher's current-main deployment observation. It is not formal v0.150.0 publication and does not prove the identity of every module consumed by a cached browser. The Ukraine gallery runtime `09a3c21a1` is a later unmerged change and receives no published acceptance from this check.

This check qualifies only current boot/branding/mode availability and the observed Settings/Back path. It fails the landing action whitelist. Full native navigation, animated-scene performance, installed offline, physical controllers and the rest of the plan remain open. All four agent-created local/public tabs (24–27) were closed; earlier user clients and saved state were left in place.

## Receipts

- `/tmp/native-menu-public-metadata-20260930.json`: 628 bytes, SHA-256 `c8eb9b695042a8351d75072127fb072af45e40f01e1fcc5bf8a0242d2f4563e8`.
- `/tmp/native-menu-public-browser-20260930.json`: 3,509 bytes, SHA-256 `733def37e5727ccc386f708bf5cbae648843c185f4d13cc14e535d4d00154c3e`.
- `/tmp/fpv-line-public-main-20260930.png`: 127,135 bytes, SHA-256 `a72d1d5221510cc36b92c21eece0d963cabda76bb40e13754584205b7775dcc0`.
- `/tmp/fpv-line-public-droneaid-20260930.png`: 89,315 bytes, SHA-256 `a80e953699045ba8d17126f7fbc2cf09bfa747da076284706603d3272b2023f1`.
