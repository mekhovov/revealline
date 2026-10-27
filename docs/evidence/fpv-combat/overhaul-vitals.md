# Pilot health and ammunition indicators

Date: 2026-10-20

## Delivered

- Separate, persistent pilot instruments for health and ammunition, with large current/maximum numbers, labeled bars, weapon name, reserves and payload count.
- Explicit low/critical health, low/empty ammunition, reload and Arcade recharge states. Color is reinforced with text and icons.
- Progress follows accepted simulation state, including pause, terminal results and saved attempts.
- Health visibility respects Off / When damaged / Always. The new display can be hidden independently through Settings → Accessibility → Health & ammo indicators.
- The underlying payload controls and ammunition display now read the loaded attempt's immutable rules, rather than unrelated current menu selections.
- English and Ukrainian labels, stable DOM nodes and bounded status announcements.
- Responsive placement leaves the aim area and flight controls available.

## Research applied

- [Housemarque: Returnal's gameplay-first HUD](https://blog.playstation.com/2021/05/11/unpacking-returnals-ux-design-gameplay-first-ui-retro-futuristic-tech-and-accessibility/) informed the separation of urgent pilot information from long objective and score text.
- [Betaflight OSD](https://betaflight.com/docs/wiki/app/osd-tab) informed persistent flight instruments and configurable visibility.
- [Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) informed redundant icons, words and numeric values rather than color-only warnings.
- [Xbox Accessibility Guideline 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) informed the dark instrument backing against variable terrain and sky.

These are design references, not claims of accessibility certification or adoption of another game's assets.

## Verification

- 49/49 focused regression tests passed on Node 20.19.5, including 15 new vitals cases. See `overhaul-vitals-tests.log`.
- Formatting, focused lint and whitespace checks passed.
- Generated reaction runtime verified byte-identical: 42 modules, 24 recordings, 1,349,448 bytes.
- In the actual local Railway Valley application, firing reduced magazine ammunition from 30 to 17 and then, in a separate run, to 6. The latter displayed LOW AMMO.
- Pause retained the ammunition count and reload progress. Resuming advanced reload and restored the 30-round magazine.
- Component review covered critical health and empty ammunition at a 390 × 844 layout, and Ukrainian reload status at 844 × 390. This was a controlled component review, not a full application mobile-device qualification.
- The final local scene was left paused, with USB radio restored and health visibility set to Always. No browser console errors were reported in the final review.
- A new physical-radio pass was not performed for this display-only change.

Screenshots: `overhaul-vitals-ready.png`, `overhaul-vitals-low-ammo.png`.

## Package admission

The complete working-tree package checks remained inside existing policies:

| Package | Runtime files / bytes | Source files / bytes |
| --- | ---: | ---: |
| Flight gym | 95 / 3,751,549 | 97 / 3,786,409 |
| Academy | 145 / 11,982,517 | 147 / 12,024,467 |
| Worlds | 208 / 19,174,225 | 210 / 19,224,452 |

Academy input headroom is 106,726 bytes; Worlds input headroom is 605,158 bytes. Worlds source file count is at its 210-file ceiling.

See `overhaul-vitals-packages.json`. This uses a working-tree candidate and synthetic identity binding; it is package admission evidence, not release or publication qualification.
