# Single Drone and Riy compact Settings

The operation description and the Settings category/panel layout shared a horizontal
flex container. On a 320 × 720 browser viewport, the description occupied roughly
120 pixels beside the controls. After opening Gameplay, its panel was only 154.77
pixels wide and 542.60 pixels tall. Controls worked, but labels wrapped into a narrow
column.

The host now places the description above the existing Settings layout. The
description retains its natural height; the existing flexible layout, minimum
height and panel overflow continue to own the remaining space and scrolling.
Direct non-checkbox field labels also retain the original grid layout and
six-pixel label/control gap after being moved out of the old Settings grid. This
keeps Operation difficulty on its own row below Choose your drone. Nested labels
and checkbox layouts remain under their existing rules.

This changes only the Overflight host's presentation. It preserves the existing
Settings nodes, preference handlers, category selection, compact category-to-panel
navigation, two-stage Back behavior and focus restoration. In particular, the
existing Gameplay auto-next control and Extras expert control remain in their
categories as established by [PR 1707](https://github.com/mekhovov/revealline/pull/1707).

## Evidence and scope

The baseline was reviewed on source
`e7465da3e4b1146b492f401fbb165a5e5a4a6202`, rather than a claim about the latest
main branch. At 320 × 720 with Standard text, opening Gameplay displayed its controls
and focused auto-next. Escape returned to categories with Gameplay focused; a second
Escape returned Home with Settings focused. A zero-sized panel in the initial
categories view is intentional and is not evidence of inaccessible controls.

The same context placement was observed in Single Drone and Riy. The selectors
exclude the shared Raid, Time Attack and Marathon hosts through their existing
`overflight-raid` class. The patch does not add Extra large text support, change
text-size preferences, or alter gameplay, input, upgrade offers or records.

The four existing complete Settings and Overflight test files passed 57/57 with
zero skipped or cancelled cases before the CSS-only host scope and direct-label
refinements:
`mode-settings-view` (6), `settings-panels` (11), `overflight-host` (31) and
`native-global-settings` (9). These exercise control ownership and navigation;
they do not measure CSS geometry. Fresh serial Node 22 processes used a 1,536 MiB
heap limit and external 2,048 MiB process-group RSS / 180-second guards. No guard
triggered, and no test assertion or logical timeout changed.

At the intermediate `b510d5142ca1c7c15288047292ff6950d54bed2e` stylesheet, the
drilled Gameplay panel measured 276 pixels wide at 320 × 720, compared with 154.77
pixels before the change. Category-to-panel activation still worked; Escape
returned to categories, and a second Escape returned Home with the Settings
opener focused.

Final browser review used stylesheet blob
`42e249023d30144a1766e817d5e66807442b272c` with the direct-label refinement:

| Host and viewport       | Presentation                  | Observed result                                                                                                                                                                                |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single Drone, 320 × 720 | English, Standard, Theme font | Gameplay panel 276 px wide and 507.69 px high; difficulty label/control rows readable. Keyboard navigation through Airframes reached scrollTop 200 px (707 px scroll height) and exposed Back. |
| Single Drone, 320 × 720 | Ukrainian, Large, Plain font  | Gameplay panel 276 px wide; select 268 px wide with 18 px text.                                                                                                                                |
| Riy, 844 × 390          | English, Large, Plain font    | Panel 529.31 × 117.21 px with 662 px scroll height; keyboard navigation through Airframes scrolled to visible Back.                                                                            |
| Riy, 390 × 844          | Ukrainian, Large, Plain font  | Panel 346 px wide; Escape returned to the Gameplay tab, then Home with the Settings opener focused.                                                                                            |

Retained screenshots are named
`overflight-42e-320-standard-drilled-settings.png`,
`overflight-42e-320-large-plain-uk-settings.png`,
`riy-42e-844-large-plain-settings.png` and
`riy-42e-390-large-plain-uk-settings.png` in the delivery tracker's
2026-10-19 evidence directory.

These are sampled browser viewport checks, not the full combination of hosts,
languages, fonts and sizes. No physical iPhone, Steam Deck, offline PWA, Extra
large/200% or broader game-family qualification is implied. Full source validation
and packaging remain pending.
