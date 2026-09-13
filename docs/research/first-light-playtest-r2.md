# First Light: response to the first human playtest

The v0.23 review reported eight issues: continuation after closing a cut; weak enemies; small, static-looking enemies; inconsistent character scale/animation; weak trail/reveal effects; unreliable keyboard/controller menus; remaining website-like screens; and inconsistent pixel styling. These are observed product deficiencies, not acceptance of the first chapter.

## Reference comparison and resulting decisions

We reopened the locally inspected [Reloaded Pack 1 frame](evidence/round-05/reloaded-pack1-0433.png) and [Pack 6 Level 7 frame](evidence/round-06/reloaded-pack6-l7-114.png). Their readable bright bodies, short directional tails, thin secured contours, compact blue/pink HUD, opaque black field and patterned terrain guide this pass. Approximate enemy body size in the inspected wide frames is about 24 pixels on a roughly 1220-pixel board. This is a visual estimate, not an exact collision radius. Screenshots do not prove animation cadence, intelligence or release-to-stop behavior.

The [official Reloaded listing](https://store.playstation.com/en-us/product/UP2538-CUSA28099_00-XPOSEDRELOADED01) remains the identity source. The new cut-completion stop follows the user's explicit correction; it is not relabelled as independently verified source-game input behavior.

The [Steam Input developer guidance](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs) supports separating menu and gameplay actions, matching prompts to the active device and keeping primary journeys controller accessible. We apply that to explicit modal order and input handoff, with bounded reader/listbox/range interactions. Native file pickers and free text still require platform facilities; simulated controller tests do not certify actual hardware.

[Dead Cells update 29](https://dead-cells.com/patchnotes/29) documents adjustable input, readability and assistance options. The design implication here is to keep stronger Standard pressure alongside Gentle, separate contact footprints from large decorative bodies, and preserve static hazard cues when animation is reduced. Difficulty should not depend on obscured trails or unreadable effects.

The shared UI uses [Tiny5 from Google Fonts](https://github.com/google/fonts/tree/main/ofl/tiny5), by Stefan Schmidt, with its SIL Open Font License. Font, license, hashes and source metadata are bundled locally. The palette, silhouettes and motion effects are original; reference artwork/music is not copied into this revision.

## What changes and what is still open

- The new R2 campaign opts into stopping on cut completion. Old campaigns and replay fixtures keep their semantics.
- Higher pressure combines faster field actors with contour pursuit, claimed-ground threats, erosion and clearly announced lane hazards. Legal routes prove solvability, not enjoyment or general artificial intelligence.
- Four visual families gain facing-aware bodies and bounded animation; classic visual slots remain individually replaceable.
- Active cuts have a contrast outline and bright center. A brief capture sweep is limited to newly secured cells. Contact geometry and score authority remain unchanged.
- The pixel UI pass includes all five game entry points, screen-sized dialogs and sharp focus states. Resized browser checks and a manual keyboard journey are required before freezing a new version.

The working status and order are tracked as P1.6–P1.7 and P2.5–P2.8 in [the implementation roadmap](../implementation-roadmap.md). The next human assessment must revisit route pressure, stopping comfort, menu discoverability, character clarity and reward appeal. This pass does not complete the large content, video, device or public-release phases.
