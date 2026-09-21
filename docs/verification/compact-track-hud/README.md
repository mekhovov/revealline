# Compact soundtrack HUD — scoped candidate

This candidate is based on e9434d03, outside PR209/v0.78. It does not close P03,
P05, P08 or physical-device acceptance, and has not been published.

## Change

Solo, Versus and Team reuse one passive credit presenter. Compact running views
show a stable 88×44 Pause target with an ellipsized current-track caption, rather
than an extra soundtrack row. Full track/artist/original filename/safe source
website are in Audio settings. Transport, focus, Pause handlers and gameplay
resume stay host-owned. No simulation, score, pack or replay identity changes.

Fullscreen retains its own landscape target; portrait hides it during play so
telemetry remains clear. Menus keep their usual Fullscreen access. Complete arena
aspect ratios are preserved. This candidate does not include the independently
held landscape/pad-gutter patch or alter touch ownership.

## Verification

- 26/26 tests on Node22.22.2 and Node20.19.5, no skips, across all three complete
  music-credit, couch-menu-music and soundtrack-host files. Exact source proof:
  349 reads / 268 unique sources per runtime. ESLint/Prettier pass.
- Native browser keyboard Start succeeded in Team, Versus and Solo. Explicit
  Pause/Resume remained intact. Team Audio Next preserved focus; Back returned
  to the paused owner before explicit Resume. Synth metadata and mute/playing
  captions were observed. Actual uploaded MP3 details were not retested here.
- Team portrait Standard and Large/Plain; Team and Versus568×320 Large/Plain;
  Solo568×320 and390×844 Large/Plain were inspected. Full arenas, zero horizontal
  overflow. Landscape Team HUD44px; portrait Large74px for readable player states.
- Browser inspection caught and corrected Team's44px portrait width override,
  Versus decorative-icon caption clipping, and Solo Fullscreen/Pause overlap.
  Final Solo portrait selector overrides the generated icon display rule.
- Screenshots and measurements retain intermediate observations too: the first
  portrait Team44px-width sample predates its fix. team-390-corrected.png and
  later samples show88px. Final portrait Solo screenshot shows Fullscreen absent.
  Later CSS changes only concern Solo and shared line height/icon suppression;
  Team/Versus screenshots are scoped to their respective corrected stages.

The initial loader symlink setup failed before qualification; real candidate
files corrected resolution. Failed setup receipts remain in the local trial.
CSS-only browser fixes followed the passing JS cohort; tested JS hashes match
the candidate. No full build or six-source-gate/public qualification is claimed.

## Remaining before admission

Compose after accepted v0.78 with the held Team/input/landscape source. Repeat
all three modes with both touch pads, stronghold objectives, wide chapter boards,
long uploaded MP3 metadata, EN/UA, safe-area changes, controller focus and all
required viewport boundaries. Run final source/production gates and release
through the existing owner. Actual iPhone browser/installed mode and Steam Deck
A/Start/Back/disconnect/reconnect journeys remain required.

## Research

[WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
requires reserving device inset space; browser chrome changes are a separate
[Safari layout concern](https://developer.apple.com/videos/play/wwdc2021/10029/).
[Steamworks compatibility](https://partner.steamgames.com/doc/steamhardware/compat?language=english)
requires the complete controller journey and appropriate prompts. Resized
desktop browser screenshots do not establish either physical device gate.
