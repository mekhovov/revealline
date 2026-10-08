# Snake shared music integration

## Change and ownership

Date: 5 October 2026. Source base: `cfa30a228eb25d2bc7e4dd6d76e417c0d76a6873`.

Classic Snake previously configured `music: 0` and had no soundtrack transport or library.
It now mounts the existing shared music host in **Settings → Sound & reactions** and lends
that host its existing `Soundscape`, with persistent music enabled. It does not create a
second soundscape/audio context, copy recordings, or alter game/replay rules.

Master mute/volume retain `revealline.audio-master.v1`; the shared library retains its
existing storage and rights/offline rules. Music volume remains a session setting, as in
Versus and Team. Explicit music Pause survives Start, retry and foreground restoration.
Ordinary gameplay pause leaves music transport alone. Blur/hidden/pagehide suspends music
and gameplay; foreground restoration cannot resume gameplay. Non-BFCache departure disposes
the borrowed music host before the page-owned audio resources.

The nested music library owns keyboard/controller navigation while open. Its Back/Close
returns to Settings without starting the match. Spoken reactions use the existing shared
music gain lease so they do not compete at full volume.

Changed player files and SHA-256 at this checkpoint:

| File                         | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `game/snake/classic-app.mjs` | `cfe8e525e761c49a829f6a272ff2847951b92548f0ec99ebfc547d716a1c0429` |
| `game/snake/play.html`       | `acd1a374003ded7163669d79ad0584ac128c283c9beb2a79538f396bd3514e0a` |

## Verification completed

- Scoped Node syntax, ESLint, Prettier and `git diff --check` passed.
- Existing `couch-menu-music`, `couch-music-session`, `couch-audio-master` and
  `mode-play-shell` checks passed: **69 tests**, including nested library ownership,
  explicit Pause, delayed readiness, blocked browser playback, master preference sharing,
  session-only music volume, disposal and foreground restoration.
- Existing `classic-catch-audio` checks passed: **12 tests**, covering native catch sound,
  mute, zero volume, paused/inactive state and late decoding.
- No new unit coverage or package build was performed. These checks exercise existing
  shared components; they do not substitute for the new Snake host's browser acceptance.

## Browser verification workflow

The actual localhost Snake host was exercised in the Codex Chromium browser. The observed
results are recorded below. Audible device output, physical controllers, background
lifecycle and packaged/offline delivery remain unclaimed.

Stable UI targets from source:

| Purpose                                    | Selector                                                            |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Open Settings                              | `#snake-action-settings`                                            |
| Sound disclosure                           | `#snake-settings summary[data-word="soundSettings"]`                |
| Master mute / volume                       | `#muted`, `#volume`                                                 |
| Music transport / status                   | `#snake-music-play`, `#snake-music-pause`, `#snake-music-status`    |
| Previous / next / session volume           | `#snake-music-previous`, `#snake-music-next`, `#snake-music-volume` |
| Open music library                         | `#snake-music-library`                                              |
| Nested library / Close                     | `#soundtrack-dialog`, `#soundtrack-close`                           |
| Library title / playback status / position | `#soundtrack-now`, `#soundtrack-loading`, `#soundtrack-seek`        |
| Nested Play / Pause                        | `#soundtrack-play`, `#soundtrack-pause`                             |
| Back from Settings                         | `#snake-action-settings-back`                                       |
| Home Start/Continue / briefing Start       | `#snake-action-primary`, `#snake-action-start`                      |
| Pause/Resume / retry                       | `#snake-action-pause`, `#snake-action-home-retry`                   |
| Match phase                                | `[data-mode-play-shell="snake"][data-phase]`                        |

Acceptance sequence:

1. Record existing mute/volume choices. Open Settings and Sound & reactions. Unmute
   deliberately, choose Play music and observe the actual transport status. Open Music
   library and confirm its track-position control advances. Status/position prove transport,
   not human listening; claim audible output only with actual audio evidence.
2. Pause music, close the library, Back to the home menu, Start, then pause gameplay.
   Confirm music remains paused. Retry and return to Settings: music must still be paused.
3. Choose Play music explicitly. Start gameplay, then pause/open Settings: the same music
   should keep advancing without a new playback request or an additional context.
4. While paused, open Music library with keyboard, activate Close, and check focus returns
   to its opener in Settings. Repeat controller Back if a controller is available; do not
   infer physical controller acceptance from modeled checks.
5. Hide the tab or switch browser focus. Return and confirm the match stays paused. Prior
   music listening intent may resume subject to browser permission; explicit music Pause
   must remain paused. Reload and verify master preferences/library are retained.
6. Exercise EN/UK labels and a narrow viewport. Restore pre-check master preferences and
   leave the verification match paused. Do not delete an existing library/profile.

## Remaining integration boundaries

- SIM soundtrack integration is separate: its world audio context and gameplay suspension
  need a shared output owner before borrowing the same music host. This change touches no SIM
  runtime, package policy or soundtrack assets.
- Shared settings category redesign and SIM random missions are separate work.
- Audio-device, iOS, offline reopening and full published-package verification remain
  unclaimed until their own recorded checks run.

## Root browser evidence — 5 October

In the actual localhost Snake page, Settings → Sound & reactions exposed the shared transport and full Music library. Explicit Unmute/Play changed status to playing and the library seek position advanced to 0:14 of 4:30. Escape from the library returned to Settings without starting Snake. Explicit Pause music remained paused through Start, actual gameplay and Retry. After Play music, immediate gameplay Pause retained playing status. Original master mute was restored and music deliberately paused at the end. This confirms observed transport/playback progress, not independently heard output or physical-controller acceptance. Background/tab lifecycle and packaged/offline delivery remain pending.
