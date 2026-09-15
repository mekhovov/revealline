# P00 browser baseline — cross-mode smoke and geometry

Date: 2026-09-15. Local test origin: `http://127.0.0.1:8943/`.

This is a **scoped browser baseline**, not full-game qualification. The owned browser sessions were `p00-baseline-20260915` and `p00-final-9a9fc8f`; both are closed. The parent-owned local server was left running. No personal profile, saved account, attached user browser, or physical controller was used.

## Tested source and method

The first session began at integrated source `3f8930e965132a2edb8b30c0ecd2a25294f210a8`. During the audit, the parent committed v0.55.0 source `9a9fc8f7a3c129a8e2c4fbfd2caef27056a25554` with the reviewed production-ledger integration. The source difference under `game/` was build configuration, compiled presentation metadata, and tests. The resolved theme moved from FPV revision 15 to 17; the resolved URL table was unchanged. **Earlier screenshots are retained as baseline observations, not passed off as an exact final-source run.**

A second fresh browser session loaded all three routes after commit `9a9fc8f7a3c129a8e2c4fbfd2caef27056a25554` and repeated the launch/pause/resume/fullscreen and Team retry smoke. Screenshots prefixed `final-` belong to that exact committed source. There was no tracked dirty diff at the final source check; only browser evidence was untracked.

Browser: Headless Chrome 153.0.0.0 on macOS; reported user agent was `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`.

Viewport dimensions: desktop 1280×800, portrait 390×844, short landscape 844×390. These were CSS viewport changes, not a physical mobile device or mobile Safari test. Team touch controls were enabled through the actual **Show touch controls** checkbox. Input used ordinary browser clicks/selects/checks and keypresses; read-only DOM queries measured state and geometry. No simulation, storage, progress, display-mode, or fullscreen API was faked or mutated through evaluation.

## Completed checks

| Journey                  | Observed result                                                                                                                                                                                         | Evidence scope                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Fresh Solo entry         | Title loaded; Deploy prepared Pressure Lines and opened Missions; Deploy opened the mission/start surface; Start mission entered `running`.                                                             | Ordinary startup path, including its existing extra steps.                           |
| Solo keyboard navigation | Tab/Enter opened Missions; Escape returned to the title. During flight, Escape produced `paused`.                                                                                                       | A small route sample, not every focus order.                                         |
| Solo explicit Resume     | Resume changed `paused` to `running`.                                                                                                                                                                   | Repeated after final source commit.                                                  |
| Fullscreen entry/exit    | Clicking the actual button set `document.fullscreenElement`, label **Exit fullscreen**; clicking again cleared it and restored **Enter fullscreen**. Flight remained running.                           | Repeated on final source; actual browser Fullscreen API, not mocked state.           |
| Versus entry/start       | Couch lobby loaded Pressure Lines / Orchard Crossing. Start round entered both-board play.                                                                                                              | Final-source launch repeated.                                                        |
| Versus pause/resume      | Escape displayed **Both boards paused** and **Resume round**. Explicit Resume returned to play.                                                                                                         | Final-source repetition passed.                                                      |
| Versus restart/setup     | New match opened an explicit replacement confirmation; confirm opened setup; Done returned to lobby; Start began a fresh round.                                                                         | Existing reset journey, not a completed series or result screen.                     |
| First Connection         | Selected through the arena control; Start together entered its 65% shared-coverage arena. Escape paused both players. Retry same arena returned to a fresh running arena at 0.0%, three reserves, 0:00. | Existing Team arena and reset path.                                                  |
| Relay Yard               | Change setup → Relay Yard → Start together loaded its anchor/core objective. Escape/Resume worked.                                                                                                      | Final-source fresh session also started default Relay Yard and successfully retried. |
| Viewport changes         | All three routes rendered at the requested sizes; measurements below capture known layout gaps.                                                                                                         | Responsive browser observations, not device certification.                           |

No mission completion, capture, death, rescue, stronghold completion, saved-flight restoration, installed pack download, offline cold start, audio output, gamepad behavior, or simultaneous two-player touch play was tested in this bounded pass. PWA standalone/iOS installed-app modes require their own evidence; the fullscreen check does not prove them.

## Measured layout findings

Measurements are CSS pixels from `getBoundingClientRect()` at scroll position zero.

| Surface / viewport           | Measured geometry                                                                                                                   | Interpretation / owning phase                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Solo paused, 390×844         | Main canvas x13/y207.28, 364×181; four pause actions 156×67.19, last bottom532.19                                                   | Sampled board and actions visible. No touch steering was enabled or qualified in this Solo observation.                 |
| Versus running, 390×844      | Canvas boxes 364×313.61; first y97.19, second y484.39; document height844                                                           | Containers are considerably taller than the selected 2:1 board geometry. P08-A owns sizing/parity review.               |
| Versus running, 844×390      | Canvas boxes 400×234.81 at y103.19; both bottoms338; document height390                                                             | Both boxes fit, but retain extra vertical space for the 2:1 content. P08-A.                                             |
| Team with touch, 390×844     | Canvas356×178 at x17/y180; direction buttons **40×44**; first row y561.86, next row y610.86; Support ends764.86; document height859 | Direction buttons fail the agreed 44px minimum width; Pause is only36px high. P03/P08-A.                                |
| Team with touch, 844×390     | Canvas358×179 at x243/y170; Pause y365–401; both direction rows begin **y510.84**; Support y564.84–608.84; document height678       | Touch controls are entirely below the viewport and Pause is partly clipped. P03/P08-A blocking acceptance remains open. |
| Relay Yard desktop, 1280×800 | Canvas688×344 at x296/y170                                                                                                          | Correct 2:1 canvas geometry; map presentation still uses the independent Team painter.                                  |

Visual inspection of the captured Solo running screen and Team short-landscape screen confirms the presentation split: Solo uses detailed drone/sprite assets, terrain patterns, pixel HUD and reveal-art edges; Team shows the separate small geometric actors, patterned rim, rounded panel treatment and its own typography. This is the planned P04/P05/P08-A work, not a new P00 regression or a declaration that hidden art is missing.

The title Deploy action visibly became disabled before its work completed, with no new phase label; this reproduces the existing feedback gap for P01. The current start path still passes through mission selection and the explicit Start mission surface; simplifying it remains P03/P07.

## Automation limitation

An accessibility snapshot/wait command on the Versus route stalled while the live page remained responsive to direct DOM queries and ordinary controls. The initial wait also targeted the setup select while the lobby was active. The pending owned CLI requests were stopped; subsequent checks used actual control selectors discovered from the page and screenshots. This is **not recorded as a game load failure**. The report does not claim that the stalled snapshot proves accessible navigation. Both owned browser sessions were closed successfully.

## Screenshot manifest

`final-` images are exact source `9a9fc8f7a3c129a8e2c4fbfd2caef27056a25554`. Other images document the first session spanning the integrated baseline and the metadata adoption; runtime host/painter code was unchanged between those sources. The `solo-launch-briefing` image is an initial start surface, not a running-flight proof; `solo-running` is the actual running sample.

| File                                                                               |   Bytes | SHA-256                                                            |
| ---------------------------------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| [final-solo-fullscreen-desktop.png](screenshots/final-solo-fullscreen-desktop.png) |  53,134 | `a87bff231dcb50a9938f0068f5b7fdc6f32d8009baf1c766e8283fb80bfa48bf` |
| [final-team-retry-desktop.png](screenshots/final-team-retry-desktop.png)           | 146,856 | `a9889a07cac2fcf3d1b6476fa69a6870f5653c3ffdc686465cab475eb209ded6` |
| [final-versus-running-desktop.png](screenshots/final-versus-running-desktop.png)   |  82,883 | `98255997121cc128fd5b47efd274c05c793c89609f2e743ed95bbbdcdd234d8d` |
| [solo-landscape.png](screenshots/solo-landscape.png)                               |  66,361 | `d8b561121c61bd37d8328fa6e4094532e7ea71407bbf615cc8adc5931dbc1e51` |
| [solo-launch-briefing-desktop.png](screenshots/solo-launch-briefing-desktop.png)   |  60,653 | `a525ecd503abd41d3d6f9c67c80eea74321ef519d9be4520e8a07deacefa2715` |
| [solo-missions-desktop.png](screenshots/solo-missions-desktop.png)                 | 100,461 | `fda3dd500f05de2fbeed6058b1a3302c375a8568538f47f1628d53beafba434b` |
| [solo-pause-desktop.png](screenshots/solo-pause-desktop.png)                       | 282,420 | `e4f19dc2c5047dfb70ad035b5d3e46f5d01f28a59b06679d91a7daa86886ffaf` |
| [solo-portrait.png](screenshots/solo-portrait.png)                                 |  74,448 | `0066c5cb521653582d4c15f8ec1d9ed74575bf70e9da0f30c0b6920881471f56` |
| [solo-running-desktop.png](screenshots/solo-running-desktop.png)                   |  48,712 | `bf315e6e427d9b9744da7256247af0e47329147d8cdec4c9f0b523a7a858591c` |
| [solo-title-desktop.png](screenshots/solo-title-desktop.png)                       | 211,651 | `f0ac0e9042dacca235228a83b556ed48d90ccbc22c1cad25c6ff175d30cb0d87` |
| [team-first-connection-desktop.png](screenshots/team-first-connection-desktop.png) | 143,184 | `337397b1d74f27bb48284e0878bb8aa7334266facf4b2c52bdb0c9642eb702e5` |
| [team-lobby-desktop.png](screenshots/team-lobby-desktop.png)                       | 385,110 | `7f0028f52f2f3717022043dab7028c72c2d7500e8f14cad51ab541e9bfd5bd44` |
| [team-relay-yard-desktop.png](screenshots/team-relay-yard-desktop.png)             | 165,022 | `300c46c86323725c20fa9729b5997f81a81ae60f42c1b7bc4794c7d435724555` |
| [team-touch-landscape.png](screenshots/team-touch-landscape.png)                   | 102,155 | `29702637ae0b74a63febfb9be97085eb5fc12004bffd5a2faf305c22647c1636` |
| [team-touch-portrait.png](screenshots/team-touch-portrait.png)                     | 108,843 | `93380900cead46bcb35d841476d1dbb77f8f756df92def4650cb82ae150b4949` |
| [versus-landscape.png](screenshots/versus-landscape.png)                           |  44,161 | `8ab274becbfd2e4e60170d54dfb7fae5bb15d492e55504a3d25896ab29075bd1` |
| [versus-lobby-desktop.png](screenshots/versus-lobby-desktop.png)                   |  59,993 | `a03a40a2568c2002c648cdd068cff622cc614835750adb5d96beb4b0e0726723` |
| [versus-paused-desktop.png](screenshots/versus-paused-desktop.png)                 |  59,342 | `97fdd129f1d905d6d7aac19ecc0734a16dba51b6ea8ccfb22523a6d6b3e9211b` |
| [versus-portrait.png](screenshots/versus-portrait.png)                             |  56,677 | `53e7fb1f1d7154fd3e93acc8fea85f242c50029ba79b3a8993a0d717538814cc` |
| [versus-running-desktop.png](screenshots/versus-running-desktop.png)               |  82,923 | `bac9d7c1f48aecdb8a7028362d7aecca35970fd5e5cdc815277cf7bd0beb5d19` |

Total: 20 screenshots, 2,334,989 bytes.

P00 can use this as baseline smoke evidence. It does not close later phase requirements or replace exact-commit source gates, frozen/public byte verification, physical-device checks, or P08-A map-state qualification.
