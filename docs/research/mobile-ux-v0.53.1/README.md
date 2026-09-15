# Mobile gameplay and fullscreen — v0.53.1

## Candidate identity

This work is isolated on `codex/mobile-ux-latest`. The earlier mobile changes were rebased onto `origin/main` **5595b63243cdb7ec64f5d97c0e5e485b6c1fda0a** (v0.53.0) before implementation and testing. The source version is **0.53.1**.

The candidate is **v0.53.1** (unpublished), frozen from code commit **8a4fae452cdc40c6aaf67dcb108576b2e6001a71**. Use [this exact local preview](http://127.0.0.1:8989/mobile-ux-8a4fae452cdc/site/game/). This production build comes from the archived commit; it includes the final portrait control clearance, warning/training placement and restored Pause statistics. Navigation-test correction **277d97c** and this report follow the frozen code without changing its application bytes.

The immutable candidate lives in `releases/mobile-ux-8a4fae452cdc/`, with `source.tar`, `release.json`, and the built `site/`. Runtime version remains the supported numeric `v0.53.1`; the folder identifies the exact candidate without changing save/profile interfaces. [Release identity](release.json) records source, distribution and manifest hashes. [Artifact check](artifact-check.json) verified all **648 packaged files**, with no hash mismatches. Distribution SHA-256: `26d6a4048ce49249a23ab1732c1ea28f318b99ed5f9e72464d7c5e2491a853f2`.

The published v0.52.0 archive is unchanged. No release was uploaded, promoted or published. A public URL for this candidate does not exist yet. To restart the local preview, run `node scripts/game-cli.mjs serve --root releases --port 8989` from this worktree.

## Behavior and research

- Compare a side HUD rail with a horizontal strip and select the arrangement giving the largest complete board; prefer the rail on ties. The rail sits opposite the steering hand. Fixed D-pad and manual ability controls reserve their own columns; floating steering retains its translucent interaction.
- Portrait has a 44-pixel navigation row and one essentials row directly above the board. Revealed/target, lives and time remain visible. Score and the routine status message are available in Pause. Pause statistics come from the current run, including after restoring a save before the first HUD paint.
- Warning space is allocated from the authored mission, so warning phase changes do not make the board jump. Training instructions have their own bounded, scrollable area outside the board.
- A single sizing adapter observes the CSS dynamic viewport, safe insets, text size, steering preferences, fullscreen and rotation. It changes presentation without restarting the simulation. Conflicting fixed-height rules were removed or restricted to fallback layouts.
- Small menus use compact headings, scrollable content and reachable Back/Close/Deploy actions. The earlier menu fixes were adapted to the current tabbed settings and illustrated mission picker.
- The screen-expansion button remains visible. Supported browsers receive a fullscreen request directly from the press. Unsupported/rejected requests open accessible help. Settings also exposes this help. Help pauses a live run; closing it requires an explicit Resume. Standalone launches omit installation guidance.

The viewport approach follows [WebKit's dynamic viewport guidance](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/). Safe placement and adapting to available space/text size follow [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout). Optional Safari instructions follow [Apple's Home Screen web app steps](https://support.apple.com/en-euro/guide/iphone/iphea86e5236/ios): Share → Add to Home Screen → Open as Web App → Add. CSS cannot remove Safari's toolbar. Browser play remains available without installation. The existing manifest, icons, service worker and backup/import interfaces are reused; storage transfer between browser and Home Screen is not promised.

## Verification scope

Browser evidence uses the Codex in-app Chromium browser, real UI actions and read-only DOM measurements. Dimensions are representative CSS viewport ranges, **not physical-device certification**. Physical iPhone Safari, actual toolbar transitions, native Home Screen installation and physical controller hardware were unavailable. Fullscreen refusal/unsupported/standalone branches, safe-area values and controller actions are covered by automated modeled-boundary tests; those are reported separately from browser observations.

| Representative range | Portrait | Landscape |
| --- | --- | --- |
| iPhone 17 Pro Max / large iPhone | 440 × 956 | 956 × 440 |
| Recent iPhone Pro | 402 × 874 | 874 × 402 |
| Recent standard iPhone | 393 × 852 | 852 × 393 |
| Large Android phone | 412 × 915 | 915 × 412 |
| Medium Android phone | 384 × 854 | 854 × 384 |
| Compact Android phone | 360 × 800 | 800 × 360 |
| Smaller iPhone | 375 × 667 | 667 × 375 |
| Narrow phone | 320 × 568 | 568 × 320 |
| iPad mini size | 744 × 1133 | 1133 × 744 |
| iPad Air size | 820 × 1180 | 1180 × 820 |
| Steam Deck size | — | 1280 × 800 |
| Reduced height with browser bars | — | 956 × 330; 667 × 280; 568 × 256 |

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Full repository suite (`node scripts/game-cli.mjs test`) | 4,101 tests: 4,087 passed, 13 failed, 1 skipped on the original run; all affected files pass in fresh reruns below | [Original TAP, gzip](full-suite.tap.gz) |
| Device controls, difficulty and Countercurrent host files | 29 passed, zero failures or skips | [Fresh host rerun](retried-host-tests.tap) |
| Terminal navigation, keyboard and controller | 10 passed, zero failures or skips after adding the visible fullscreen button to the expected actions | [Navigation rerun](navigation-tests.tap) |
| Final layout, compact arena, fullscreen, app host and packaged boot checks | 64 passed, zero failures or skips | [Focused suite](focused-tests.tap) |
| Complete repository ESLint | Passed, no warnings | [Lint log](lint.log) |
| Complete repository formatting check | Passed | [Formatting log](format.log) |
| Game CLI validation | Passed | [Validation](validation.json) |
| Frozen production build and inventory | Passed; 648 file hashes match | [Artifact check](artifact-check.json) |

The initial run overlapped edits: ten host failures (plus the failed parent of one nested test) reported a stale module export; one dependent fixture test skipped. Fresh runs of all three affected files passed, including that skipped fixture. The other two failures were outdated terminal-navigation expectations for the newly visible fullscreen button; the whole navigation file passes after that correction. This is **not presented as one uninterrupted green full-suite run**. No known failure remains unresolved.

The focused suite covers maximum fit, five board proportions, notch/home-indicator inset models, zero HUD overlap, portrait controls, large text, stable warning reservations, training, both hands and manual actions. Fullscreen tests cover supported, unsupported, rejected, externally exited and standalone states. App-host tests cover controller Back, focus, explicit Resume and preserved saved replay. Build checks verify the actual mobile stylesheet and layout/fullscreen modules, including stylesheet ordering after the presentation theme.

## Built-artifact observations

All final browser records and screenshots in this folder use the immutable **8a4fae4** candidate above. [Measurement summary](browser-summary.json), [gameplay bounds](browser-gameplay.json), [menu bounds](browser-menus.json) and [interaction records](browser-transitions.json) retain the evidence.

- **91 gameplay measurements:** all complete boards inside the viewport, with zero intersections against navigation, telemetry, warning/training regions or fixed touch buttons. Maximum aspect-rounding error was **0.006 CSS pixels**.
- **240 menu measurements across 22 surfaces:** no dialog bounds outside the viewport, no horizontal overflow, and no measured active form/button target below 43 pixels high. Checkbox visuals and collapsed details are excluded from that target check. Home, controls settings, collection and missions use all 24 viewport configurations; the other surfaces use eight representative portrait/landscape and short-height configurations.
- The 2:1 arcade board at **956 × 330** measures **644 × 322**, using the full available safe height with the essentials in a side rail. At **440 × 956**, it measures **432 × 216**, directly below the compact navigation and essentials rows.
- With large text, large D-pad and manual abilities at **320 × 568**, the 4:3 board measures **288 × 216**; the controls stay below it. Both steering hands were exercised. In short landscape, fixed controls reserve side columns; floating/swipe steering retains the existing translucent overlay interaction.
- At **568 × 256**, encounter warnings and training instructions use the clear column between the 192-pixel D-pad and ability controls, outside the board. Long lesson text has its own scroll area.
- Real UI actions covered chapter selection/deployment, setup/briefing, settings tabs, help, field guide, course entry/return, pause/resume, collection, saves, expansions, challenges, records and music return. A real keyboard-driven cut reached victory; View picture → Results → next mission worked. Rotating during play preserved the run. Scan and Boost remained actionable. Keyboard focus in short Pause remained within the viewport.
- Native fullscreen entry/exit changed the visible control between Enter/Exit fullscreen and synchronized `aria-pressed`. Help remained reachable from settings; returning restored focus and left the game paused for explicit Resume. Unsupported/rejected/standalone and gamepad boundary behavior are automated host/model checks, not claims about a physical Safari session.
- Offline preparation verified **602 core files (55,073,041 bytes)**. The local candidate server was then stopped; a separate connection check confirmed refusal. The browser successfully reloaded the candidate, restored the saved flight in Pause, and resumed only after Resume. The server was restarted. See [network refusal log](offline-network.log) and the interaction records. Browser retention remains browser-controlled; no claim of automatic Home Screen storage transfer is made.

### Screenshots

[Full-height arcade landscape](arcade-landscape.png) · [Compact portrait](gameplay-portrait.png) · [Large D-pad at 320 pixels](manual-large-left-dpad.png) · [Warnings at 256 pixels high](warning-small-landscape.png) · [Training at 256 pixels high](training-small-landscape.png) · [Mission picker](missions-short-landscape.png) · [Settings](settings-short-landscape.png) · [Fullscreen help](fullscreen-help-landscape.png) · [Music](music-short-landscape.png) · [Results](victory-landscape.png) · [Offline restored Pause](offline-restored-pause.png).

### Remaining physical-device verification

A physical iPhone 17 Pro Max with Safari, expanded/collapsed browser bars, notch insets, real text scaling and Home Screen launch still needs a hardware check. Actual PS/Xbox/Steam Deck controllers were unavailable; the existing controller suite and modeled host flows passed in the checks above. No emulated viewport is described as physical-device proof. Publishing or promoting this candidate is a separate action.
