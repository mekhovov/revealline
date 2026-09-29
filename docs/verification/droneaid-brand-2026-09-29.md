# DroneAid landing with supplied brand assets — 29 September 2026

The public `?edition=droneaid` entry resolves to `droneaid-nl-community`. Its main landing now displays the user's supplied real-drone poster and official DroneAid wordmark. The six individual campaign scenes and legacy DroneAid illustration remain unchanged.

## Sources and presentation

The [Canva brandbook](https://www.canva.com/design/DAGeyOGjAKI/HUJ_tyQ6RihkjinchUuisg/edit) was read through its viewing UI, including logo, typography, color and photography pages. The [provided logo folder](https://drive.google.com/drive/folders/1Jvf0yVzw8t3u3b9hRSMPTH1puTPE8-oH) supplied the white wordmark for dark backgrounds. The [provided main PNG](https://drive.google.com/file/d/1LMt7I1Xe1DuWs1PjW2BrUT3Mj2m3aikH/view) contains the real drone on yellow panels against blue.

- Palette follows blue `#5b81fd`, yellow `#ffd601`, black `#0a0c0e`, and white. The existing player's game text preferences remain authoritative; the logo uses its original supplied outlines.
- Background: 880,307 bytes, 2000×1545; exact PNG copy. CSS frames the right-hand drone panels, keeping the poster's Hamburg build-guide lettering outside the menu composition. The original file is retained without editing or recompression.
- Wordmark: 119,252 bytes; exact original **DroneAid dark.svg**, named `droneaid-wordmark-light.svg` at runtime for its light lettering. CSS frames the central wordmark with no color inversion or path changes. Accessible heading text remains available, and image failure or plain-text preferences show the text fallback.
- The new photograph has no river/cloud warp regions. It uses the common six-second entrance and randomized receiver dropouts; the wordmark, menu and controls remain stationary.
- Original Drive URLs, file identities and hashes are in [source provenance](../../authoring/library/droneaid-brand-kit-2026-09-29/sources.json). No temporary authenticated download URL is stored in the repository.

## Visual verification

The real `/game/?edition=droneaid` landing was inspected in the in-app browser in desktop and 390×844 portrait layouts, using the player's existing Ukrainian preferences. The viewport override was reset afterward.

- [Desktop](droneaid-brand-2026-09-29/landing-desktop.jpg): official logo loaded; distinct yellow drone panels remain prominent to the right; opaque controls and readable text shade remain on the left.
- [Portrait](droneaid-brand-2026-09-29/landing-portrait.jpg): source image reframed to the drone, logo and controls within the viewport, footer visible.
- Browser console returned no warnings or errors for the reviewed landing. No preferences, saves, rewards or remote brand documents were edited during review.

## Checks

**77 tests passed** across the focused cohorts:

- 25 menu scene tests: exact original bytes/hash/dimensions, provenance, supplied picture in both orientations, static regional mode, original-source receiver, other profiles and lifecycle behavior.
- 3 real Solo host tests: alias resolves to the intended aggregate, official wordmark load/error/retry, locale/focus, pagehide cleanup, unchanged compact/icon branding, and unchanged Workshop Lights landing.
- 28 inventory/offline/native tests: selected-edition dependencies, exact public/offline asset bytes, desktop/iOS staging and shared-resource closure.
- 21 edition compiler tests: receipt validation and edition asset projection, including retention of the shared analog atlas while pruning aggregate-only PNG/SVG from other editions.

Scoped ESLint, Prettier, Python syntax and whitespace checks passed. No production deployment or full release build was performed; device screenshots are browser emulation, not physical-device certification.
