# Couch music: session intent policy

P02-B's next isolated milestone after the shared library/context foundation. The Team/Versus pages and Music library panel are **not wired yet**. This module supplies policy around borrowed owners, not a second audio player, context, media element, scheduler, profile store or game controller.

## Integration contract

Create one persistent Soundscape and one existing soundtrack player, then its `createCouchMusicLibrary` owner. Pass those three owners to `createCouchMusicSession`. Route Start/Retry music activation and explicit Play/Pause through this policy. The initial music fader is 0.55 unless the host supplies a validated session value; `setVolume` changes only player music gain. Origin-wide master mute/volume remains authoritative, library audition gain remains separate, and no profile persistence is added.

`loadLibrary` and `saveLibrary` call the library owner and silently prepare an adopted selection. They expose underlying library loading/saving/error state and a `preparing` flag through `snapshot`. They never request playback after waiting for storage. A failed initial library read stays visible while allowing deliberate built-in playback. A failed refresh retains the already accepted library and its player state.

Call `start()` in the accepted Start action. It resolves false immediately while initial library/MP3 preparation is incomplete, leaving gameplay free to start; `needsPlayGesture` tells the host to offer Play music when ready. It never schedules a delayed autoplay. Explicit `pause()` takes precedence even before first Start and remains authoritative on Retry/Next/Resume. Explicit `play()` may replace that choice. Repeated Start/Play while browser permission is pending shares one in-flight request. The policy waits for the actual player promise before reporting success or an actionable failure.

`pauseGameplay` and `resetGameplay` use the persistent Soundscape's gameplay-only semantics. Neither changes music intent, node, URL or queue. `setAcceptedContext` forwards only an already prepared/accepted context; the host still owns stale preparation and attempt acceptance. A compatible context change remains subject to the existing player's next-boundary selection rules.

`update(active, theme, state)` must run from the host's single frame pump in lobby, paused menus and results as well as gameplay. No extra scheduler is created. Team must place this call before its game-only early returns. `suspend` holds transport; `resume` restores only prior listening and coalesces duplicate foreground notifications. Accepted audio can resume during a slow library refresh. Neither method knows how to resume gameplay: existing explicit gameplay Resume and input ownership remain mandatory.

`dispose` stops intent and fences late preparation/play policy. It deliberately does not close borrowed owners. The host then disposes library-panel auditions and published bindings/player, closes the library owner, and closes its Soundscape/master in the established order. Do not leave those owners alive after navigating away. A live borrowed library may still finish a read after policy disposal; it cannot trigger preparation or autoplay through this policy.

## Remaining integration and release work

- Add the panel's supported adoption hook before its current `player.setLibrary` calls. Route panel Play/Pause and Save & use intent through the session; do not bypass it with direct transport calls that erase the policy's knowledge of a prior Pause.
- Compose Team and Versus Settings → Audio, library modal ownership, exact opener restoration and controller routing. The native Solo keyboard baseline is Settings → Audio → Music library → Escape to Audio opener → Escape to Settings opener.
- Keep permanent music-capability text separate from transient errors. Team gameplay effects remain visual until separately qualified.
- Bind verified presentation music without replacing an explicit playlist, and feed exact accepted contexts for built-in/imported/installed content.
- Verify actual browser gesture permission, hidden/foreground restoration, keyboard/touch/controller navigation, listening and public/offline journeys on the final composed source.

The model tests use the existing real player/library/master modules and reused coded-silence MP3 bytes, with finite media/AudioContext/IndexedDB boundaries. They prove intent and operation ordering, not audibility, browser permission policy or physical-device behavior.
