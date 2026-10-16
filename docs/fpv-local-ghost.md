# Optional personal-best ghost

A player with a compatible verified practice recording can select **Show personal best** to see a translucent cyan quad marked **PB**. It follows the same frozen reference used by sector timing. FPV shows the quad; chase and overview also show its route. The control starts off in each new app session and remembers the player's choice between scored attempts. **Hide personal best** removes the quad and route immediately.

Enabling the ghost pauses the current flight while the reference is sampled. Loading can be cancelled, and the player resumes deliberately after loading. The ghost has no collision body, attack actions, perception role or scoring effect. It does not change the selected drone's handling, recorded commands or rewards.

The reference is the proof selected by the existing sector verifier, including its invalid-candidate fallback and exact course, pack, runtime, mode, response, rules and conditions checks. The renderer never trusts a saved path or independently chooses another recording. Lazy sampling replays that frozen proof again and requires the same completed tick count. The no-record, incompatible-record and unscored states explain why no personal best is available. Demonstrations and recorded playback do not offer the ghost.

## Timing and lifecycle

- Sampling occurs every five simulation ticks, with explicit spawn and terminal poses. At most 7,202 poses are accepted for the 36,000-tick flight limit. Only pose data is retained by the renderer.
- Position interpolation and normalized shortest-arc quaternion interpolation use the current flight tick. No wall clock or independent animation clock advances the ghost. Rotors follow the same clamped tick.
- The ghost freezes during pause, focus loss or a main-thread stall. Retry resets it to the spawn. It holds its terminal pose after the reference finishes, with an explicit status message.
- Interrupted v2 attempts preserve the opt-in choice alongside the existing frozen reference ID. Recovery replays the same reference and places the ghost at the recovered tick. Missing references remain unavailable.
- The mesh is hidden within 0.65 m of the FPV camera to avoid obstructing the view when both flights overlap. Normal depth testing preserves occlusion by the environment.
- Course/mode/response changes, close and disposal abort pending sampling and clear both the quad and the static route. Hiding, replacing or disposing the ghost releases its geometry, materials, texture and samples.

## Verification

[The verification receipt](fpv-local-ghost-browser-verification.json) records the source hashes, exact development-package hash and focused checks against the built package in Chrome. Actual replayed proofs cover the legacy Academy runtime and the v2 world runtime. A practice fixture based on the frozen Woodland orientation demonstration supplies a 1,184-tick reference; a second genuine recording with a 100-tick launch delay supplies a recovered attempt at tick 700.

The checks verify matching sector/ghost reference IDs, invalid-fastest fallback, exact interpolated position and quaternion, start/retry/pause/recovery alignment, finished-reference behavior, cancellation and stale-result rejection, mode/response isolation, unscored/demo record isolation, offline recovery, EN/UK mobile layout and repeated resource cleanup. No unit coverage was added or run. Device performance, physical controller operation and release qualification remain outside this focused browser receipt.
