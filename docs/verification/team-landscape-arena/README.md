# Team landscape arena follow-up

Status: source candidate, outside the frozen presentation integration cutoff. No version or public acceptance is claimed.

At 568×320, the inherited layout reserved a full-height side column for each floating control. This made Relay Yard only 254×127 in the retained final-source review. The candidate removes those two reservations. The complete 2:1 canvas uses available height, while the same shared controls overlay its lower corners. No bitmap is cropped, stretched or transformed; no input, collision, rules, saves or content identity changes.

The deliberate tradeoff is some thumb/control overlap with the lower corners. The existing translucent steering surface and shared opacity preference remain. HUD, Pause, required stronghold instruction and bottom event caption stay outside the pads. Larger text retains its space. Showing/hiding controls no longer resizes the arena.

## Native evidence

`native-summary.json` records ten measurements from actual mounted Team sessions on exact e69f4eca source with the one hash-pinned CSS override. `served-files.jsonl` records 258 distinct served files, independently compared with Git bytes or the candidate CSS. No browser state injection or viewport CSS overrides were used.

| Scene / text                      | Viewport | Complete board |
| --------------------------------- | -------- | -------------- |
| First Connection / Theme Standard | 568×320  | 438×219        |
| First Connection / Plain Large    | 568×320  | 418×209        |
| First Connection / Plain Large    | 844×390  | 558×279        |
| First Connection / Plain Large    | 390×844  | 370×185        |
| Relay Yard / Plain Large          | 568×320  | 363.20×181.60  |
| Relay Yard / Plain Large          | 844×390  | 503.20×251.60  |

All measured direction/action targets are at least 44px in each dimension and inside the viewport. No horizontal overflow or console warnings/errors. Both preferred control sizes were inspected; short landscape bounds Large to the same 132px pad when necessary. D-pad, stick and swipe layouts retain their shared settings. The native check activated Player 1 Right, exposed a cut, paused, changed settings, explicitly resumed, rotated through portrait and observed an actual Hunter rescue warning. It did not complete a rescue or victory. Hide controls kept the exact Relay Yard board dimensions.

An early native Control size End-key interaction did not change the setting; it is not credited as Large-control evidence. Large was subsequently selected through the real combobox and inspected in stick, swipe and D-pad layouts. Some AX-name select queries did not resolve; role/visible ID selectors were used after checking current page state.

## Remaining gates

Physical iPhone Safari, Home Screen lifecycle, safe-area notches, simultaneous fingers, Steam Deck A and one-seat controller handoff remain required. No resized desktop window certifies those devices. The separate presentation delivery is frozen; this follow-up needs its own production fingerprint review, source gates, version, PR and Pages verification after the release controller supplies an accepted base.

[Apple game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls) informs familiar contextual controls. [Steam compatibility requirements](https://partner.steamgames.com/doc/steamhardware/compat) require the full controller journey; a successful launch unit test alone is insufficient. Preserve native interaction evidence separately from device certification.

## Breakpoint correction after 47dde74e

Further native testing found a separate inherited desktop fallback at 501–600px
landscape height. At 960×540, First Connection used a 236×118 board because the
compact stylesheet declared grid rows without establishing a grid; its wrapper
retained the desktop 240px cap. The shared handheld query now owns grid/slot/bitmap
fitting across its complete range, including consistent stronghold text sizing.

On the final stylesheet, First Connection at 960×540 with Plain Large text uses
862×431. Relay Yard uses 807.20×403.60 at 960×540 and 927.20×463.60 at 1024×600.
Native 500/501px boundary checks preserve smooth fitting. The earlier 568×320
Relay result 363.20×181.60 and portrait 370×185 remain unchanged. All measured
targets remain in view and at least 44px. See `breakpoint-summary.json` and its
independently verified served-byte log. This is a further candidate correction,
not public acceptance; original evidence above remains scoped to its original CSS.
