# Company player accessibility review

This is an engineering review of the company player and workbench, not an accessibility
certification or a human comprehension result. Scope: `game/company.html`,
`game/company.css`, `game/company-player.mjs`, and the existing learning workbench.

| File                      | Component                   | Issue                                                                                                                    | WCAG Guideline                           | Severity | Recommendation                                                                                                        |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `game/company-player.mjs` | Campaign entry buttons      | Repeated “Enter journey” names did not identify the chosen campaign independently.                                       | 2.4.6 Headings and Labels                | Moderate | Fixed: accessible names include the campaign title and retain the visible label.                                      |
| `game/company-player.mjs` | Error feedback in dialogs   | The page-wide live region becomes inert while a modal is open; backup/import errors could be inaccessible in that modal. | 4.1.3 Status Messages                    | Moderate | Fixed: mirror asynchronous status into the open dialog, without closing it or resuming play.                          |
| `game/company.css`        | Narrow-screen pause/results | The absolute overlay could exceed the short canvas and clip its controls.                                                | 1.4.10 Reflow; 2.4.11 Focus Not Obscured | Moderate | Fixed: below 650 px, the panel flows below the canvas. Canvas geometry and simulation remain unchanged.               |
| `game/company.css`        | Touch controls and reading  | Compact navigation and close controls offered small targets; several secondary instructions were unnecessarily small.    | 2.5.8 Target Size (Minimum)              | Moderate | Fixed: buttons have at least 44 px height, close buttons at least 44 px width; labels and practice text are enlarged. |

The native dialogs retain modal focus behavior. Keyboard Enter opens Settings; Escape closes
it and returns focus to Settings. The mission stays paused and requires an explicit Start /
Return to play. The reduced-motion checkbox sets the existing shared preference and stops
logo motion; its original value was restored after the check. Workbench evidence and decisions
use real buttons, labels, selects, fieldsets and an untimed feedback region.

Browser observations on the local candidate, 2026-09-26:

- At a real 320 × 800 iframe viewport, the home and paused-game document width stayed at
  320 px and no visible controls exceeded the viewport or arena bounds.
- The checks above cover keyboard focus return and reduced-motion wiring. They do not
  replace screen-reader testing, controller/device testing or a human low-vision review.
- Missing presentation bytes produce a visible error and disabled Start; a second healthy
  tab can subsequently reserve saving. A simultaneous second healthy tab reports that it
  is session-only, keeping export available.

Static palette contrast against the brand ink is 16.24:1 (Coupa white), 9.70:1 (Coupa accent),
11.33:1 (Coupa safe), 7.91:1 (Coupa danger); DroneAid equivalents are 15.46:1, 9.39:1, 9.42:1,
and 8.44:1. These token checks do not establish contrast over every generated image or
gradient. Image-backed copy, focus at browser zoom, nonvisual gameplay access and assistive
technology behavior remain part of the release accessibility review.

Use `docs/verification/company-review.html` to repeat viewport, layout and timing
observations against a selected same-origin company player. The helper is excluded from
standalone edition runtime dependencies and cannot approve a release.
