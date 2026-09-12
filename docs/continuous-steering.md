# Continuous arcade steering

The new source edition uses continuous flight: tap one direction, release it, and keep moving. Tap another direction to turn. Repeating the current direction never stops. Walls and board edges block travel until a different direction is selected. Pause stops the world; there is no separate Stop in Arcade.

Immediate turns change direction at the current position. Grid + buffer retains the newest requested direction until the next valid center, even after physical release. Both modes use the same persistent selection. Keyboard repeats and previously held controls cannot take back control after a newer deliberate command on another input device.

The game opens into a dark title menu. **Play → Missions → Return to briefing → Start** selects an attempt. The top game menu, Collection and Settings remain inside the browser page. Authoring, diagnostics and Replay Theater live under Studio & extras. Browser fullscreen permission is not needed. The P1 shell retains the existing mission selectors inside its menu; later phases replace these with richer pack/map cards.

## Cut completion: revised playtest contract

User feedback on 2026-09-13 replaces continuation after a cut: a new level.v4 recipe with `rules.stopOnCapture:true` stops the craft when its active cut reaches secured ground. The capture still resolves normally and enemies keep moving. Another **fresh** direction starts the next move. Merely holding the previous key/stick cannot restart. Movement along already secured ground does not trigger this stop.

The core emits `capture.stopped`, clears the buffered turn and forbids additional player movement in the closure tick. Hosts clear remembered and physical direction before another fixed substep, preserving the original recorded closure command. Saved continuation after closure is neutral; explicit Resume stays stopped. Couch clears only the player who closed the cut. Unspecified/false recipes and all frozen editions preserve their earlier semantics.

## Pause, save and recovery

Pause and saved-session v2 preserve the exact verified simulation, including an off-center queued turn, and separately store `continuation.direction`. Explicit Resume supplies that direction on the next actual simulation tick. The first resumed tick has neutral Boost, ability, pickup and class-switch commands. Physical controls must be released and freshly pressed before they can act again. Opening a dialog, returning focus or pressing a movement key while paused cannot resume.

Losing a life, shield recovery or impact redeployment clears direction. Inputs during recovery are not banked. The recovered craft waits for a fresh direction. Couch players retain independent selections; one player's recovery does not stop the other. A fresh attempt starts without direction.

Historical replay `direction:null` and release events keep their original meaning. Old session v1 uses its historical release behavior; discarded queued intent is not guessed on import. New session v2 is accepted through saved-flight and complete-backup workflows. An old frozen application may not understand a v2 session; export a compatible old session from its original edition when retaining old behavior matters.

## Maintainer contract

`attachInput({continuousSteering:()=>true})` and `attachCouchInput` resolve persistent selection at the input boundary, outside simulation and score authority. Legacy adapters default to false for explicit compatibility consumers.

- `snapshotDirection()` reads intent without polling hardware; couch requires a player index.
- `clearPhysical()` releases physical controls/action latches while retaining direction. Couch optionally scopes this to one player.
- `restoreDirection(direction)` validates and gates physical input before installing intent; couch takes player then direction.
- `clear()` resets both physical and logical input for new attempts/recovery; couch also exposes `clearPlayer(player)`.

Hosts must not call `releaseInputs(run)` when pausing the new edition. Do not mutate verified state or add fake ticks just to clear action edges. Mask the first real resumed command and record it normally. Clear recovery intent before another fixed substep, not only at the next animation frame. The separate Motion Lab uses its own small steering boundary and retains the historical motion APIs.

## Music and presentation

Hidden artwork is masked by fully opaque black, with functional actors and trails visible above it. Full-image victory presentation leaves the earned coverage value unchanged.

`new Soundscape({persistentMusic:true})` retains original synthesis through ordinary gameplay pause, menus, results and track context changes. `pause()` and `reset()` clear gameplay effects; `suspend()` is the full audio lifecycle boundary. `setTrack(track,{atBoundary:true})` queues an authored change at the 32-bar presentation boundary; explicit selections can switch immediately. `resetMusic()` is the deliberate restart operation. Browser activation and mute are respected. This is not MP3 support; uploads and file playlists are P3.

## Verification

See `game/test/continuous-input.test.mjs`, `continuous-host.test.mjs`, `sessions-continuous.test.mjs`, `couch-navigation.test.mjs`, `audio.test.mjs` and `authoring/motion-lab/test-steering.mjs`. They cover actual host save/load, both turning modes, mixed inputs, per-player recovery, queued turns and historical replay compatibility. Browser and physical-device results are recorded separately in milestone reports. The current execution status is in [the roadmap](implementation-roadmap.md).
