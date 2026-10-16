# Keep disarmed regional preparation alive through a cold frame

On a fresh Railway installation, the first Fly could report Area unavailable while a subsequent Retry succeeded. A separate diagnostic host captured the production frame-stall guard immediately before it called Pause and cancelled regional preparation. The guard treated a delayed callback during already-disarmed source/graphics preparation as if the player had lost control of an active flight.

The same guard now discards accumulated time and returns when a regional preparation is pending and the flight is already paused or disarmed. It does not poll flight actions, advance physics or mark the area ready. The verified preparation still owns completion and its existing timeout. Active flight, ordinary flight preparation, and paused flight without pending regional preparation retain the original stall behavior. Explicit Pause, blur, visibility loss and graphics-context loss retain their existing cancellation paths. There is no automatic retry or automatic arming.

## Verification

Five focused checks execute the actual production advanceFrame and pauseFlight callbacks with controlled timing and host dependencies. Two reproduced cancellation before the correction and all five pass afterward. They cover a cold paused/disarmed preparation, active flight including an inconsistent active/preparing state, unchanged ordinary-host policy, queued stale rAF timestamps/long gaps, and explicit cancellation with cleared input/radio ownership. Scoped JavaScript lint and whitespace checks pass.

Native review used a fresh separate origin with the coherent Railway renderer/source snapshot plus only this minimal host patch. Normal Download → Saved → first Fly reached Ready to arm at the authored 16 m start with zero input, without Retry. The earlier source failed on that journey and its external diagnostic logged the stall then preparation cancellation. Screenshot: railway-first-launch-fixed.png. This is a source composition review, not a replacement for an immutable package qualification; the frozen c2e18 UI package remains unchanged. No physical-device performance claim is made.
