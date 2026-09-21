# Stronghold, touch controls and compact soundtrack composition

This is an isolated browser composition rehearsal, not an integrated or published
release. It tests e9434d03 runtime plus three855f9981 JavaScript changes and the
previously reviewed landscape61af/music stylesheet plus855's appended caption
rules. `composition.json` records the exact inputs; `composed.css` SHA256 is
`f057930bfe1cd2e845e8c808f3eae17bc606f83ce7bbb1be372b9785d01b1df3`.
No runtime source was rebased or adopted while PR209 owns publication.

## Actual browser findings

At568×320, Relay Yard, Large/Plain text and both direction pads:

- 855-only arena: **264×132**, with full-height side clearances.
- Composed corner overlays: **363.203×181.602**, preserving the complete2:1 image.
- The HUD remains44px and the stronghold objective has its own23.398px strip.
- All visible control buttons are at least44×44; no horizontal overflow.
- Both actual pointer clicks on the direction pads independently changed the
  respective player state from safe to Line exposed.

The full bitmap fits; overlays can cover its lower corners. This does not claim
that every pixel is unobstructed beneath a player's fingers. Screenshots retain
that tradeoff explicitly. Large floating-stick controls keep the same arena size.

Additional checked geometry (Large/Plain, both pads):

| Viewport | Arena           |  HUD | Minimum button |
| -------- | --------------- | ---: | -------------: |
| 844×390  | 503.203×251.602 | 44px |           52px |
| 960×540  | 807.203×403.602 | 44px |           52px |
| 390×844  | 370×185         | 74px |           52px |

Portrait retains the objective and places both pads below the complete board;
the Large-text objective wraps to66px. Readable player state takes priority over
forcing all portrait content into44px.

Settings → Controls changed direction pad to Large floating stick. Back retained
the paused0:42 attempt and required explicit Resume. Music changed tracks without
replacing Pause. Console warnings/errors were empty. Actual iPhone multitouch,
physical rotation, browser-toolbar/safe-area changes and Steam Deck remain open.

## Focused input regression

Four complete files against exact855f9981 passed **35/35 on Node22.22.2 and
35/35 on Node20.19.5**, no skipped cases:

- `touchscreen-controller-host` exercises actual Solo host cold gamepad discovery,
  fresh A to start, controller-only Missions/Deploy/Pause/Resume, three touch
  modes, saved preference adoption, recovery and disconnect. - `couch-shared-touch` verifies independent stick/swipe/D-pad directions for two
  seats, persistent direction on release and stale-finger clearing after recovery. - `shared-touch-preferences` and `touch-steering` cover shared preference/state and
  gesture behavior.

All716 source reads across8 test processes match270 exact Git sources. Browser
source proof verifies423 latest path bindings, including the composed stylesheet;
it is distinct from the modeled input source. No production code is stubbed by
the sparse Git loader. DOM and gamepad doubles remain modeled input evidence,
not physical-controller certification.

## Still required

Compose with the accepted post-PR209 source and held Team/input corrections, run
the final source/production gates and verify the deployed result. Check long
uploaded MP3 metadata, Ukrainian typography, physical touch/controller hardware
and full player journeys separately. This proof narrows the layout integration
risk; it does not close P18 or the overall programme.
