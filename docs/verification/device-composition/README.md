# Shared handheld controls and compact arena composition

Status: locally verified source candidate. No public-release or physical-device acceptance.

## Source

Base `1a941f05919d7293164751e2ea7918f63dc03363` contains the compact
music/Pause HUD and authored Solo warning-space selection. Its accepted music
ancestor `e9434d03` has the same tree as merged main `7c0519b5`.

This successor combines the reviewed Team landscape stylesheet (`83b09ef2`,
`3b579b7b`) with `33091473` reconnect regression tests, `9ec6d7cb` ignored-finger
cancellation, `433171fe` fullscreen ownership and `96a8512b` resize interruption.
Only related runtime/test hunks are admitted. The Team artwork fork and pack,
Studio and campaign candidates remain separate. `composition.json` pins every
selected source/test postimage and donor patch. The full stylesheet equals the
previously inspected `solo-caption-compaction/composed-preview.css` byte for byte.

The first combined run passed 71/76. Five new tests needed an
`authoritativeCheckpoint` import already present in their donor ancestry.
The explicit import is restored here. `initial-failure.json` preserves the failed
TAP; it is not counted as acceptance. No runtime change was made to satisfy it.

## Automated checks

All eight complete files pass **76/76 on Node 20.19.5 and 76/76 on Node 22.22.2**:
compact arena, caption capability, actual Solo touch/controller host, couch shared
touch, shared preferences, steering ownership, fullscreen and device-controls
host. The files include both turn modes, a cold Steam Deck-style A-start,
reconnect during a cut, mixed input, all three touch styles, cancelled extra
fingers, interrupted resize, shared preference backup/Undo and authored action
visibility. These are modeled controllers, not physical Steam Deck tests.

The exact TAP text and SHA-256 plus every unique source read are retained in the
runtime JSON receipts. The loader uses this candidate for selected paths and the
pinned base for all other files. Formatting, ESLint and whitespace checks pass.

## Native browser journey on the composed source

An isolated **568×320 iframe** was used inside the existing browser viewport;
the shared viewport was not changed. Fullscreen was never requested.

1. Keyboard Tab/Enter from the title starts First Signal. One Down press completes
   the cut: **50%, three lives, 7,820 points**. Results focus Next.
2. Keyboard Retry → Pause → Main menu → Settings → Controls reaches the native
   touch choices. Arrow keys choose Always and D-pad. Escape restores Settings
   focus. Explicit Continue retains the paused **0:06** clock.
3. The visible D-pad Down action completes another cut with the same result.
   The 0:19/0:17 completion times include inspection delays, not tuning evidence.
4. Keyboard Main menu → Team → Start together enters First Connection. Its
   settings show the inherited **Direction pad / Regular** choice. Pad visibility
   remains a per-visit seat choice, as the UI explicitly explains.
5. Keyboard Show both → Back preserves paused **0:17**; only explicit Resume
   starts the clock. Pointer activation of P1 Right and P2 Left exposes two
   independent lines. Subsequent damage uses one reserve; Escape pauses both.
   This is input/lifecycle evidence, not a Team win or multi-touch device test.
6. Browser warnings/errors were empty. Owned tab and server were closed.

| Measurement | Result |
| --- | --- |
| Solo complete canvas | 292.797 × 219.594 |
| Solo Pause | 88 × 44 |
| Solo four visible D-pad targets | 44 × 44 each |
| Team telemetry row | 44 high |
| Team complete canvas, pads hidden or both shown | 438 × 219 |
| Team Pause | 88 × 44 |
| Team D-pad targets | at least 45.664 × 45.664 |
| Team Boost/Support | at least 63 × 51.398 |

The transparent pads overlap portions of the board; complete-bitmap fitting is
not a promise of an unobscured board. Prior Large/Plain and stronghold breakpoint
screenshots remain in `compact-track-hud/stronghold` and `solo-caption-compaction`.
The new browser source bindings establish what this particular run served.

## Remaining gates

- Full six source gates, ordinary build, production reproduction/readiness and
  final-source qualification after version integration.
- Source PR, immutable release, publication-selector PR, Pages deployment and
  complete public inventory verification.
- Real iPhone Safari browser bars, safe areas, orientation, Home Screen lifecycle
  and simultaneous touch; real Steam Deck/DualSense A-start, menu, reconnect.
- Full Versus/Team end-to-end completion and the broader P18 device matrix.

Research: [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/),
[MDN controller discovery](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API),
[MDN fullscreen handling](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide).
The game retains usable browser-page layout without requiring fullscreen.
