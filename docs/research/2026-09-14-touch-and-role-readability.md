# Touch controls and role readability — 14 September 2026

This review refines the current delivery plan. It does not change saved movement,
collision, difficulty, scores or historical XPOSED evidence.

## Current primary guidance

[Apple's game-control guidance](https://developer.apple.com/design/human-interface-guidelines/game-controls)
recommends reachable virtual controls, safe-area clearance, visible press states and
context-dependent visibility. Its [WWDC26 touch session](https://developer.apple.com/videos/play/wwdc2026/358/)
demonstrates anchored control groups, hiding unavailable actions and icons that
describe the current action. These are useful design principles for the browser
shell; the native Touch Controller framework itself is not a browser dependency.

For RevealLine, retain the single directional pad outside the arena, with
Auto/Always/Off visibility and Left/Right hand selection. Hide it in menus and
keep infrequent actions in the pause/settings flow. Retain the existing large
targets and reserved space when switching hands. Arcade remains direction-only:
level-authored pickups and progression do not become manual Scan/Supply/Boost
buttons. A future Tactical action appears only when its actual rule is available.

## Acceptance for this presentation milestone

1. At 390×844 and 844×390, inspect both hands with Standard and Large text.
   All four cardinal controls must be visible in their correct positions, outside
   the arena, with the same board size when a warning changes. Off removes the
   controls; Auto follows the current input policy.
2. Use keyboard navigation through title → Settings → nested tools → Settings →
   title, and separately from a paused flight. Closing a dialog returns to its
   real opener without a simulation step or accidental Resume.
3. Inspect every new character at actual play size on black and revealed art.
   Role recognition must use silhouette and movement cues as well as color.
   Verify heading, pause and reduced-effects behavior. Source image dimensions
   and successful decoding alone are insufficient.
4. Treat an animated surface highlight separately from animated rotors, wings,
   wheels or an ability sequence. Existing enemy bodies contain baked fittings;
   a future component rig must not double them. Record unfinished animation work.
5. Check custom image precedence and the two separate boss roles. Replacing a
   default must preserve the player's chosen artwork and exact gameplay identity.
6. In Collection, distinguish the score belonging to the displayed picture from
   the best medal for its level. Never rewrite earned records to improve labels.

Desktop iframe inspection is layout evidence, not certification of an iPhone,
controller or Steam Deck. Continue real-device and human playtests under P7.
Fair challenge and replay value require observation; more enemies or more assets
do not establish either by themselves.

## Next design experiments

- Test a small, optional held-direction cue outside the thumb target. It should
  communicate remembered flight after release without flashing continuously or
  implying that the player must keep holding the button.
- Compare thin interceptor silhouettes with broader alternatives at the smallest
  supported rendered size before generating additional variants.
- Audit short-landscape HUD space using the complete arena, warning and pause
  journey. Recover space by reducing redundant information before shrinking text,
  touch targets or the existing minimum rendered character sizes.

These experiments are proposed work. None is an undocumented XPOSED behavior or
a completed browser/device acceptance claim.

## Text and redundant cues follow-up

The [Microsoft text-display guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101)
supports a clear font alternative, scalable text and layouts that remain usable
at larger sizes. Retain the pixel treatment by default; evaluate an optional plain
sans-serif face for longer explanations. Measure rendered letter height on the
target device instead of treating CSS font-size as a device certification. The
current Standard/Large choices do not establish complete 200-percent coverage.

[Microsoft's additional-cue guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103)
supports combining color with shapes, labels and audio. Keep AIM/CHASE/REST
warnings and role-specific silhouettes readable when sound is muted. The Guide
must use the same body as the real actor and show its contact cue separately from
the enlarged illustration. These are P7 acceptance criteria and further design
work, not a claim that every effect or menu already meets the guidelines.
