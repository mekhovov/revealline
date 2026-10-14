# Bottom-anchored landing menus

Follow-up to the iPhone fixes in #1177. Spare viewport height now stays above the landing menu, preserving room for the logo and animated scene instead of placing all controls at the top.

## Changes

- Shared bottom alignment for Solo, Team, Duel, Snake, Survival and SIM in portrait and landscape.
- Intrinsic menu height and automatic top margins: expanding More or using a short screen consumes the free space first, then scrolls from a reachable top edge.
- Landscape identity and action columns align at their bottom edge. Footers remain below the menu in normal flow.
- Solo's decorative animated character is restored above the menu instead of reserving space underneath the sound controls.
- Safe-area padding, touch target sizes, focus order and existing controls are unchanged. Canonical styles are projected into both SIM stylesheets.

## Verification

- 54 existing shared-shell, landing-structure and pause-layout tests passed.
- Both generated SIM projection checks passed; formatting and diff checks passed.
- Browser-checked all six game destinations using Ukrainian labels, including collapsed and expanded mode choices.
- Checked 390×844 portrait and 844×390 landscape, 320×568 small-phone overflow, 568×320 short landscape, 768×1024 tablet and 1440×900 desktop.
- On a 320×568 Snake screen, Down moves Start → Missions → Settings → Sound and scrolls the sound control fully into view. No horizontal overflow in the tested SIM sizes.
- Verification used a local no-cache preview with a test-only password verifier; production authentication was unchanged.

Physical iPhone Safari rotation and device safe areas still need user confirmation; these are browser viewport checks. Merge/deployment is pending.

## Screenshots

- [Solo portrait](solo-portrait.png)
- [Solo expanded landscape](solo-landscape-expanded.png)
- [SIM portrait](sim-portrait.png)
- [SIM landscape](sim-landscape.png)
