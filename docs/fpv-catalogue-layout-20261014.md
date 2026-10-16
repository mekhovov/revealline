# Catalogue scroll area and menu action dock

The downloadable-world section was inserted as an unassigned child of the mission
chooser's named CSS grid. The browser placed it in an implicit row below the fixed
action row. Its content extended under the dock, obscuring the catalogue heading
and reducing access to maps.

Both the downloadable catalogue and existing mission cards now live in the
chooser's allocated `cards` row, inside one scrolling container. The action dock
retains its own row. Flight School hides the downloadable section as before.
Library keeps its original layout; download, focus ownership, physics, recordings
and package budgets are unchanged.

## Verification

- 25 existing entry, mission-library projection and compact chooser checks pass.
- Syntax, scoped ESLint and whitespace checks pass.
- Actual in-app browser source verification at 390×844, 844×390 and 1280×800:
  catalogue scroll region ends at or above the action dock, with equal client and
  scroll widths (no horizontal overflow). Keyboard focus reaches the next mission
  after the downloaded-world cards; Back and Flight School remain usable.
- Ukrainian 390×844 verification after rebasing onto main `2abfd20bd` passed:
  scroll region bottom 672.66 px, dock top 678.25 px, width/scroll width 372 px.
- The live v2 feed lists 20 worlds. On a fresh local origin, Ukrainian Play on
  Coaster Practice Park downloads the published exact pack and prepares FPV flight:
  motors off, throttle zero, health 100, elapsed time 0.0, no console errors/warnings.
- Earlier browser reload on port 9001 retained exact Coaster pack
  `a0483ee22fabdc190fc65858c458ed4730297a0179f8ede793383775a7568025`
  and Library Fly resolved its scene, paused and disarmed.

These are desktop browser viewport observations, not physical phone/controller
acceptance or device FPS. Source verification uses the canonical request worker
without an offline package; full packaged offline/public launch qualification is
separate. An initial viewport override did not take effect; only subsequently
confirmed actual viewport dimensions above count as responsive evidence.

Temporary worktrees disappeared between turns. Committed/published work and
external content survived. This small unpublished layout patch was reconstructed
from the exact prior patch into a durable workspace and committed before further
verification. The primary checkout's unrelated changes were not modified.
