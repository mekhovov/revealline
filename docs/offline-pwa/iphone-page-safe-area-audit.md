# iPhone safe-area audit across player pages

Follow-up to [the Settings defect](iphone-menu-safe-area.md), 2026-10-02.
Scope: reachable player pages, shared dialogs, community editions and SIM.
This is a layout correction, not a claim that every gameplay journey has been
qualified on physical iOS devices.

## Layout ownership

The shared tokens expose usable dialog width and height after subtracting the
four device-reported safe insets. Modal frames use that rectangle because body
padding does not constrain the browser's top layer. Existing pixel/rem size caps,
scroll containers and responsive breakpoints remain in force. Zero insets produce
the original viewport dimensions; no device model or fixed status-bar height is
used in production.

Native Settings keeps its own compact gaps and fixed header. The mission library
now uses the safe frame once, instead of also adding device padding inside that
frame. Fullscreen Demo and immersive SIM retain their explicit full-screen frame
and internal safe padding. The download iframe uses ordinary reading margins
because its enclosing dialog already accounts for the phone's edges. Its compact
header now wins over the general full-screen dialog theme.

Normal pages keep their own safe padding. Sticky page controls also need a safe
top offset after scrolling; SIM's studio header, controller status and authoring
reference rail now have that offset. Fixed SIM landscape options, status messages
and its keyboard skip link also respect the device edges.

## Page and surface inventory

| Page family                                                                                                               | Audit result and action                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo, Versus, Team home and Settings                                                                                      | Native menu fix; modal headers and independently scrolling settings categories remain reachable.                                                                                |
| Solo Help, Collection, picture viewer, Hangar, Library, replay, workshop and flight information                           | Shared full-height frame and more specific width overrides now use the safe viewport.                                                                                           |
| Mission selection, briefing, Journey pictures and backup                                                                  | Safe frame sizes; mission library removes duplicate internal device padding and retains its scrollable cards/footer.                                                            |
| Chapter/practice selection, enemy guide/catalogue, control lab, soundtrack, lessons, rewards, media and authoring dialogs | Owner size limits now use the safe viewport; existing smaller size caps remain.                                                                                                 |
| Team arena discovery and Versus chapter replacement                                                                       | Safe width/height limits. Team earned pictures, discard confirmation and pause overlay already have explicit safe bounds.                                                       |
| Install/offline dialog                                                                                                    | Safe bounded frame, compact header and independently scrolling iframe. No second phone inset inside the iframe.                                                                 |
| Downloads and stable installed launcher (`game/offline/app.html`)                                                         | Full-page downloads CSS already uses safe padding; the launcher is generated using that CSS. No blanket extra page padding added.                                               |
| Update bootstrap and bridge                                                                                               | Generated inline styles now use `max(32px, env(...))` on each side. The fallback Back link remains inside the safe area.                                                        |
| Community directory and edition aliases                                                                                   | Directory already has safe body padding. Aliases route to the common game hosts; community branding shares the corrected menu/dialog layout.                                    |
| Company entry                                                                                                             | Redirect fallback page now has safe padding around its heading and Open Solo link.                                                                                              |
| Standalone profile recovery                                                                                               | Existing safe main padding retained; in-game recovery dialog now uses the shared frame.                                                                                         |
| Controller Lab and Playground                                                                                             | Controller Lab now has safe body padding; Playground already inherits it from the game stylesheet. Shared authoring dialogs/rail are covered.                                   |
| Replay Theater                                                                                                            | Existing safe body padding and sticky status offset retained.                                                                                                                   |
| SIM Academy and Worlds                                                                                                    | Nonimmersive dialogs use safe bounds. Sticky/fixed controls corrected. Immersive flight continues to own its existing safe padding. No renderer, input or flight logic changed. |
| Civilian Flight                                                                                                           | Existing page safe padding retained; modal dialogs now have matching safe bounds.                                                                                               |
| Root launch/access screens                                                                                                | Compact launch breakpoint no longer discards safe padding; access screen uses safe padding and safe centering for short screens.                                                |
| Creator, creator players, Studio, community store/moderation, About and static credits                                    | These pages do not opt into `viewport-fit=cover`; browser-contained viewport behavior is retained. No forced cutout padding or cover mode added.                                |

The cover-mode inventory includes all 15 checked-in player entry HTML files in
`game`, `site` and `optional-practice`, plus the generated update documents.
Test fixtures, artwork-review exports and frozen releases are outside the player
entry inventory. Frozen release files are unchanged.

## Manual evidence

The fixture loads real host markup and production stylesheet order. `surface`
selects a static dialog ID. `mode=sim` and `mode=worlds` use the corresponding SIM
hosts. `surface=journey-chooser` constructs the real library UI with an empty,
in-memory fixture library; no mission or profile is attached.
`surface=install-offline-dialog` opens the real panel with the development
downloads page; no download or activation was requested.

The portrait preset uses 59/0/34/0 and landscape uses 0/59/21/59. These are fixture
inputs, not device detection or production constants. Recorded observations:

- Portrait Help: frame starts at y=59, Back at y=69. With zero insets on the same
  393 × 852 viewport, frame starts at y=0 and Back at y=10: no phantom top gap.
- Landscape Collection: x=75, width=702 within the 59-pixel side insets; lower
  controls remain scrollable. Desktop 1280 × 720: original 1040-pixel frame,
  y=0, with no added top/bottom space.
- Landscape briefing: 734 × 372 frame at x=59/y=0; Back remains inside it.
- Landscape Team discovery: x=71, width=710; Back is at y=49.2.
- Landscape mission library: frame 734 × 372, footer Back at y=254 with a
  44-pixel target; search and collapsed filters remain visible.
- Landscape SIM Worlds settings: frame x=59/y=11, 734 × 350; Back at y=63.75.
- Portrait SIM Help: frame y=142.95, height=591.09; its existing smaller content
  size is retained instead of stretching every dialog to fill the screen.
- Portrait recovery: frame y=59/height=727; Back at y=75; long content scrolls.
- Offline dialog: portrait 369 × 735 frame at x=12/y=59; landscape 710 × 348 at
  x=71/y=0, with Back at y=13 and scrollable content below the compact header.
- Community directory was opened in both orientations; its Back link and edition
  links are exposed. Controller Lab and standalone recovery were also opened.

Screenshots and measured fixture observations are stored alongside the initial
Settings evidence in `evidence/iphone-menu-safe-area-20261002/`. The earlier
Settings checks cover category drill-in/back, long-panel scrolling and rotation
for Solo, Team and Versus. Layout checks do not prove gameplay, completed offline
downloads or a physical Safari Home Screen installation.

## Validation and release gate

Final ESLint, repository validation, changed-file formatting, whitespace checking
and in-memory build inspection passed after rebasing onto `main` at `3f097ad2b`.
The [build summary](evidence/iphone-menu-safe-area-20261002/all-pages-build-summary.json)
records 2,719 output files and 958,771,488 bytes including the manifest. This is
the full distribution inventory, not the rolling Pages size or a release
publication assessment. Automated suites remain
**WAIVED_SKIPPED_NOT_PASSED** under the existing owner-authorized policy.

Schedule this correction independently from SIM/community download PR #933 in
the existing v0.150.0 aggregate. SIM branches must retain these CSS constraints
when combining later changes. Publication still requires the normal release
guards; scheduling a PR does not update an already installed icon.

Physical iPhone/iPad qualification remains outstanding: verify the published
edition in Home Screen mode and ordinary Safari, rotate with a dialog open,
scroll each category/page to its last action, open the keyboard, return with Back,
and check immersive flight. Record device and iOS versions. Also retain the
Android/desktop checks required by the broader PWA plan. Do not describe browser
emulation as completion of those device gates.
