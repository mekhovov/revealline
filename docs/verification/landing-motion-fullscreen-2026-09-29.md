# Landing fullscreen and visible scene motion — 29 September 2026

This follow-up implements the request to expose fullscreen directly on the landing page and make the background visibly animated. It supersedes the initial motion behavior described in the earlier menu report. Existing archived releases and the prior local candidate on port 8976 are unchanged.

## Implementation

- Solo, Versus and Team now have a compact localized Fullscreen utility after the four primary landing actions. Edition landings inherit Solo's implementation. Display & Language retains a synchronized mirror.
- One document-level fullscreen owner handles pending requests, duplicate registrations, browser changes, locale changes and error feedback. In the embedded browser, Escape now exits fullscreen while retaining the landing and its focus. Gameplay and controller Back remain with their original input owners.
- All 18 scene profiles have authored environment anchors in the coordinate system of the original image. The image plane slowly moves; cloud patches move existing painted pixels; water glints, lamps, window light and occasional steam animate over appropriate features. Nine indoor profiles suppress outdoor silhouettes. Menu controls and the readability scrim stay fixed.
- Cover geometry follows image decode, viewport resize and orientation changes. Cloud crops reuse the active bitmap and add no new image downloads. No animation-frame JavaScript loop or new runtime dependency was introduced.
- Visible but unfocused panes keep moving. Hidden/suspended pages, closed landing screens and inactive hosts pause. Reduced Motion and Animation Off show the static image and disable all decorative animation.
- Existing analog receiver texture, gameplay, edition routing and unrelated work in the shared checkout are preserved.

## Why this approach

[web.dev recommends transform and opacity](https://web.dev/articles/animations-guide) for efficient animation. Those properties drive the new camera and environmental layers. This is a good fit for the existing image-based scenes and avoids introducing a video file/decoder for each theme or continuously redrawing the complete artwork on a canvas. That architectural choice is our inference from the guidance and the existing application.

[MDN's Page Visibility guidance](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) distinguishes a hidden document from one that merely lacks focus. The previous focus gate caused a visible embedded preview to look static. [Reduced Motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) remains authoritative.

[The Fullscreen standard](https://fullscreen.spec.whatwg.org/#dom-element-requestfullscreen) requires browser transient activation. The utility is keyboard/controller reachable, but a synthetic gamepad event cannot bypass browser activation policy. Rejection is reported truthfully; this report does not claim hardware fullscreen support.

## Automated verification

Command:

```sh
node --test --test-concurrency=1 game/test/menu-scenes.test.mjs game/test/fullscreen.test.mjs game/test/native-landing-fullscreen.test.mjs game/test/demo-fullscreen.test.mjs game/test/native-menu-inventory.test.mjs
```

**39 tests passed, 0 failures.** The log is `/private/tmp/landing-motion-fullscreen-tests.log`.

Coverage includes the three real host modules with modeled DOM/input, fullscreen mirrored state and failure feedback, Escape and held-key behavior, pending entry/exit, demo fullscreen integration, all 18 scene anchors and active asset checksums, cover geometry, reduced motion, hidden/visible lifecycle, preference storage denial, cleanup and edition inventory. ESLint, Prettier and `git diff --check` passed for the changed implementation/test files.

The focused standalone-edition projection check also passed: `node --test --test-name-pattern='standalone menu projection' game/test/edition-runtime.test.mjs` (1 passed, 6 intentionally filtered). It verifies that the selected profile and FPV fallback retain their catalog data without referencing unrelated scene images. Total distinct tests in these two commands: **40 passed**.

## Browser verification

The in-app browser loaded `/game/?edition=droneaid-nl-community` from the source server on port 8768:

- Enter fullscreen changed the control to Exit fullscreen. Escape returned it to Enter fullscreen, retained the open landing and retained focus on the utility. No mission was started.
- A keyboard-only pass used Down from Settings through Sound to Fullscreen, Enter to activate, and Escape to exit. The menu remained open and the fullscreen label/pressed state followed each transition.
- At 390 × 844 in English, the utility occupied y=636–680; metadata started near y=808. All normal controls fit without horizontal overflow.
- At 844 × 390, the four actions occupied y=56–250 and the utility y=262–306. English and Ukrainian both fit, with complete words and no horizontal overflow.
- The final portrait composition was visually checked after replacing an overly geometric cloud overlay with a feathered crop of the actual artwork.
- The temporary viewport override and test language change were restored after checking.

Versus (`/game/couch/`) and Team (`/game/couch/relay-rescue.html`) were then checked in the same real browser. Each landing exposed Fullscreen, entered successfully, and exited with Escape while retaining its menu and utility focus. Both reported loaded/running scenes with a nonzero camera transform. These checks did not start a multiplayer session. Temporary test tabs were closed.

The independent [motion browser report](landing-motion-browser-2026-09-29.md) contains all-theme rendered-motion observations, genuine hidden-tab pause/resume, Reduced Motion/Off checks and desktop frame intervals. Browser observations are separate from modeled tests. Physical controllers, mobile-device frame timing, memory profiling and published/native builds are not certified by this follow-up.

## Local delivery

The supported `node scripts/game-cli.mjs build --out /private/tmp/revealline-menu-motion-20260929` command completed with exit 0 and full validation. The candidate retains version 0.142.1, contains 1,860 manifest files / 750,453,406 bytes, and is served at `http://127.0.0.1:8978/game/`. All manifest bodies/hashes and the distribution ZIP checksum passed. All 11 watched menu, scene, fullscreen and navigation files stayed unchanged throughout the build and match the packaged bytes.

This is a candidate from the shared dirty working tree: concurrent changes occurred in `game/app.mjs`, `game/company-player.mjs` and `game/ui/signal-reception.mjs`; their packaged bytes match the post-build source. The whole tree was not frozen. See [packaging evidence](landing-motion-packaging-2026-09-29.md) for hashes and commands. No version bump, archive rewrite, native binary rebuild or publication was performed. The earlier port-8976 candidate remains unchanged.

The final packaged Netherlands edition was opened in the in-app browser at normal 1280 × 720 sizing. The scene loaded and ran; successive observations showed artwork translation changing from x=10.4146 to 7.58304px. Fullscreen entered successfully, Escape exited, and the landing/focus remained intact. The updated tab was kept as the deliverable. [Packaged screenshot](native-menu-2026-09-29/fullscreen-animated-packaged.png).
