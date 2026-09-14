# Combined Field Kit source: native browser review

Source `485903e261e696faf7042f687615efa6092d985e`, served directly at `http://127.0.0.1:58215/game/`. This is a source preview, not a frozen release. Runtime files stayed unchanged during these observations. The metadata in `evidence.json` binds the actual native screenshot bytes; renamed `.jpg` files were not edited or resized locally.

## Observed behavior

- Keyboard-only title → Settings → Collection → title → Workshop → Field guide → Workshop → title → Missions → Deploy. Expected focus returned to the appropriate opener. Missions were reached through Tab navigation, including disclosure summaries and the final Deploy action.
- Theme font and Plain are separate from text size. Plain plus Large was readable on the actual Settings, Collection and title screens. Native select confirmation uses Space, the intended arrow selection and Enter; moving away from an unconfirmed native popup is not a settings change.
- Actual Orchard Crossing play began with three lives and a three-minute deadline. A short direction press continued after release. An unfinished vertical cut survived Pause and explicit Resume.
- Closing that cut earned 31.1% coverage and 7,300 points. The drone remained at the closed endpoint after another explicit Resume without a new direction; enemies and the clock continued. The interface said a fresh direction was required.
- Desktop active play displayed the arena, compact HUD and pause access without a permanent direction/equipment toolbar. Unrevealed artwork was black; captured territory exposed the assigned picture.
- A 390×844 CSS iframe restored that flight paused with the same coverage, score and three lives. The real title/settings controls could select an Always-visible D-pad. Its four directions used a cross below the arena. This configuration preview used browser keyboard and pointer input, not a physical touch screen.
- An 844×390 CSS iframe also restored the saved flight paused. Active play fitted the whole board with compact overlay chrome. A pointer D-pad action was exercised, but a slow tool round trip and life loss prevent using that attempt as a latency or animation measurement. The left portion of the D-pad appears less clear where it overlaps the arena; this visual observation remains under review.
- Additional preview tabs truthfully reported that the original game tab owned saving. No attempt was made to take its writer lease or treat session-only play as a saved result.

## Follow-up from the review

Collection still showed its reading/progress toolbar and empty pagination prominently. A separate native disclosure/pagination change is under verification. The Guide illustration was smaller than its available space; a CSS-only enlargement is also being tested while retaining the logical preview geometry and gameplay contact radius.

Keep the baseline screenshots distinct from those later changes. This observation does not establish a completed campaign, every input/menu path, physical-device compatibility, 60 fps, animation quality, a victory story, custom-media backup or offline transfer. Automated source tests and their results are separate evidence, not substitutes for these missing native journeys.

## Screens

- [Title](title.jpg)
- [Active flight](active-flight.jpg)
- [Cut closed](capture-closed.jpg)
- [Still stopped after Resume](capture-stays-stopped.jpg)
- [Portrait D-pad layout](portrait-dpad.jpg)
- [Landscape D-pad review](landscape-dpad-review.jpg)

The layout screenshots include their containing browser page. Output scaling is not the size of a physical device. No screenshot crop has been used to hide an issue.
