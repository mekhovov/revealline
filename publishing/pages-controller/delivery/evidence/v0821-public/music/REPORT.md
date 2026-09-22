# v0.82.1 public music quick-controls acceptance

Date: 2026-09-22. Scope: bounded ordinary-UI music acceptance; no repository, branch, release, or publisher changes.

Public root redirected to `https://mekhovov.github.io/revealline/releases/v0.82.1/site/game/`; visible game version V0.82.1. Parent supplied source binding 64ec9fd2; this subtask does not independently prove full public-byte identity.

## Passed

- Fresh isolated profile: 90s Synth, shuffle, repeat all; no custom tracks/playlists and generation 0. Initial Settings audio is muted. All eight advanced groups were collapsed: sound controls, filters/custom mix, offline downloads, add/edit, create playlists, world mappings, backups, community downloads.
- Hosted playback: Raspberry Jam / congusbongus, `raspberry_jam.mp3`, reached playing at 0:03 / 2:54. Source https://opengameart.org/content/raspberry-jam, CC0.
- Next advanced from Raspberry Jam to Tower of the Vampire (Sega-style FM synth remix) / Ragnar Random, playing 0:14 / 2:08. Source https://opengameart.org/node/133854, CC0. Hosted MP3 requests returned 200.
- Second fresh profile, explicitly unmuted via Settings: Shuffle all music saved generation 1, displayed All styles / shuffle / repeat all, Drama / Holizna playing 0:10 / 3:30.
- Metal -> Play this style saved generation 2, displayed Metal / shuffle / repeat all, Last Stand Lets Go / Noah Cedeno (Peachtea) playing 0:05 / 1:32.
- Holizna — Retro Wave 1 -> Play this playlist saved generation 3, displayed selected playlist and Playlist selected and playing, Lost In The Jungle / Holizna playing 0:08 / 2:42; source https://opengameart.org/content/retro-wave-collection.
- Advanced groups remained collapsed after all quick actions. `console` and `errors` returned empty output in the successful retry session. Six tracked hosted MP3 fetches in retry returned 200.

## Evidence

- 02-fresh-library.png: first fresh library, initial default (quick controls below fold; full snapshot was in tool transcript).
- 05-playing.png: Raspberry Jam confirmed playing.
- 07-next-confirmed.png and 07-next-snapshot.txt: distinct Next result, default selection, collapsed groups, source link.
- 10-retry-fresh.png: second fresh profile default at 1600x1200.
- 11-allshuffle.png / 11-allshuffle.txt: all-styles action and playing result.
- 12-metal-playing.png / 12-metal.txt: Metal action and playing result.
- 13-playlist-playing.png / 13-playlist.txt: playlist result, console and error commands (empty).
- 14-network-cleanup.txt: hosted fetch 200s, source URL, both named sessions closed.

## Limits and retained unsuccessful attempts

First profile at default 1280x720 had quick actions below the fold. Commands stalled; no application-defect claim is made because the automation did not reliably bring these controls into view. Escape closed the music dialog; a later stale Shuffle locator failed. Pending commands and only that isolated Chrome process were terminated, then the test was repeated with a new isolated profile at 1600x1200. The successful profile used normal `select` and `click` commands, with fresh snapshots between UI transitions.

Do not mistake 03-hosted-playing.png or 04-hosted-playing-confirmed.png filenames for proof: those captures still showed loading. 06-next-distinct.png captured the old track while the next original was loading; 07 is the confirmed Next proof. Failed-attempt files are retained, not rewritten.

No fake audio, internal application state injection, eval, or human listening-quality assertion. This is a sampled desktop playback/control check, not whole-library playback, mobile acceptance, offline music, or long-duration shuffle/no-repeat proof. Two fresh profiles used, neither a user profile. Both named sessions closed; profile/evidence files retained.
