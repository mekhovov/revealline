# Result surfaces and completion review — 16 October 2026

Base source: `6ad58d3a44c83985fd6066af61decaa3a8169118`, plus the source changes committed with this receipt. Current source hashes are recorded separately. Browser: Codex in-app Chromium, 1280 × 720 CSS px, device scale 2. Isolated localhost origins; ordinary access gate retained. No player profile was overwritten.

## Defects found and corrected

- Result fixture used the historical v2 save key after the campaign moved to its revision-specific key. It now derives the current key from the campaign contract and protects current and both legacy save slots. Tests validate the unfinished checkpoint against the actual current catalogue and finish only through its next accepted simulation move.
- Enemy counters used a missing `--fk-color-accent` variable and fell back to low-contrast gold on Dnipro. They now use the theme's readable accent ink (`--iw-link`), which the resolver checks across base, panel and raised surfaces. A preliminary amber-role fix was insufficient for Pocket LCD's raised surface and was replaced before final captures. Supporting labels use muted text without multiplying opacity. Collections, cards, fields and warning text use the same paired theme roles.
- Sticky continuous-play result actions used an undefined surface variable, creating a dark graphite band in light themes. The footer now uses the accepted panel.
- Contextual captions used separate fixed dark/white colors and a system font. They now follow the shared raised panel/text and theme/Plain font. Existing non-theme fallback colors remain available.

- Native/mobile settings categories overrode the shared painter with white text, a fixed dark surface and stripped frames. Layout and fallback paint are now separate; the theme owns default, selected, focused and textured states.
- Snake result counters and replay accessibility labels retained the old language after a live change. They now refresh with the rest of the host.
- Solo’s older result timer ignored the shared automatic-progression setting. The timer now checks that preference before arming and cancels a running countdown when it is disabled; re-enabling does not revive a cancelled timer. Manual Next remains available.
- Optional SIM receives the canonical fixes through its existing generated shell, reaction and presentation files, without adding package slots.

## Browser evidence

- `flight-deck-solo-result.png`: actual Solo completion, 800 points / 93 moves / three stars. Continue → completion → Stay here → result, with working focus on Next.
- `flight-deck-result-options.png`: expanded result actions; Home → Settings return worked.
- `dnipro-team-result.png`: before repair. Low-contrast gold counters, dark footer and caption are visible.
- `dnipro-team-result-fixed.png`: intermediate color repair. Snake Team completion, 600 points / 65 moves. Counter ink is #76500b, caption #122040 on #ffffff, footer #e8f0f7. Captured before the subsequent caption-font-only change.
- `dos-team-result-fixed.png`: corrected color bindings on terminal theme. Captured before the caption-font-only follow-up, which requires a refreshed render.

Old test-origin browser caches retained prior source modules. Post-fix color evidence therefore comes from a fresh origin; stale captures are not counted as successful verification. The supplied near-clear journal is replayed by the real host. No result, score or reward is injected.

This closes these named result checks, not every game host, language, viewport or physical input device. The completion plan retains those gates.

## Final rendered pass

- `result-*-en-final.png`: all 18 named families, actual restored Snake Duel result, 1280 × 720. All captures were visually reviewed: labels, replay controls, helper counts, actor caption and footer remain readable; family materials remain distinct. `native-result-colors.json` records resolved paint and return focus. This is one shared result host, not every result/reward implementation.
- `*-settings-categories-uk-390-final.png`: Dnipro, DOS and Flight Deck mobile category views. `native-category-colors.json` records all 18 families, eight categories each, no horizontal overflow, minimum 49.59px height and focus restored to Display & Language. Computed solid foreground/background contrast ranges from 5.21:1 upward; this does not replace textured-pixel sampling.
- `dnipro-duel-uk-390-final.png` and `dos-duel-uk-390-final.png`: final color/font bindings on narrow translated results. `flight-deck-live-locale-uk-final.png`: live English → Ukrainian refresh, including statistics and replay accessibility labels. The subsequent English captures verify the reverse change.
- `flight-deck-boot-failure.png` and `flight-deck-boot-failure-uk-390.png`: an actual controlled HTTP 503 for the application module, normal access flow retained. Keyboard focus lands on Reload game; the narrow translated view has no horizontal overflow. `flight-deck-boot-recovered-uk-390.png` records ordinary Reload returning to the game after restoring the resource.
- Community captures show the real compiled North default, personal Tryzub override carried into South, then Follow campaign/community restored to the exact candidate revision after reload.

## Earned arcade rewards and recovery

The normal First return mission was completed through directional controls. The final review run captured 34.3%, scored 8,160 points in 20 seconds and retained two lives/two stars. An earlier run earned three stars; that previous best remains in Collection. No victory or reward was injected. `flight-deck-arcade-earned-result.png` records the pre-fix unwanted countdown; `flight-deck-arcade-result-retained.png` records the fixed result with automatic progression disabled, retained beyond its former deadline.

- Flight Deck, Dnipro and DOS result captures show the same earned outcome with each family's materials and typography. `flight-deck-arcade-picture-reward.png` preserves the original picture. The DOS Collection and original-viewer captures show the earned entry and its full original. Back to collection returns focus to View earned original; closing Collection returns focus to Collection.
- `*-profile-recovery.png` and `*-flight-library.png` cover Flight Deck, Dnipro and DOS. Find profiles truthfully reports no supported stored profile channel on this isolated development origin; historical-original verification stays unavailable outside a packaged release. Closing the dialogs restores Stored profile recovery and Saves & recovery respectively. No import, restore or deletion was performed. These captures qualify those visible states, not successful historical recovery.

## Actual Academy host slice

The normal Academy Lift and land host was opened through its regular controls. After first arm, changing the SIM interface to Flight Deck applied immediately while World appearance displayed its queued-change explanation. Retry returned to Motors off with the new appearance selected. `academy-theme-queued.png` records that visible boundary.

Watch example then ran the existing recorded stick inputs through the actual host. `academy-flight-deck-example-chase.png` shows the climbing stage and `academy-flight-deck-example-ended.png` shows the completed example. The pad H/ring and target volume remain visible against the floor; functional indicators and pause/camera controls remain readable. The close chase body is small, so this does not qualify its orientation marks at distance. The in-app view also showed the FPV landing approach, but there is no retained approach screenshot. This is one real replay path and retry boundary, not a matched proof comparison, all-environment flight review or motion/shimmer certification.

## Captured-pixel component contrast

`pixel-captures.zip` retains 54 unmodified full-page browser captures and their matching reading-rectangle metadata: all 18 families with their material, decoration Off and high contrast. `pixel-contrast.json.gz` samples every RGB pixel inside 41 textless reading twins per capture, **2,214 component-state samples**, with zero failed thresholds and zero compression-margin concerns. The browser returned JPEG bytes despite the screenshot filenames; the sampler detects the encoding and requires an additional 0.2 contrast margin. It does not retouch screenshots. Normal text is checked at 4.5:1, inactive labels at 3:1 and every high-contrast sample at 7:1.

This qualifies the specified reading regions of the runtime specimen at this viewport. It is not a whole-screen audit, forced-colors test, screen-reader check, physical-device qualification or proof of every native pointer transition. Simulated states and actual native states are identified in each measurement. The runtime materials are the same retained revisions as the game; the new result/category binding fixes have separate real-host evidence above.

## Software and scoped SIM evidence

- Creator/basis/community/package admission: 35 tests passed.
- Result checkpoint/protected storage: 2 tests passed.
- Enemy statistics, continuous play/host, Snake UI and actor-voice integration: 170 tests passed. Later focused checks cover the final font, readable accent and live-language changes. Counts overlap and must not be added as unique tests.
- Final Solo continuation and earned-picture suites: **12 passed**, including full/reduced effects, held controller confirmation and boundary failure/cancellation.
- Solo preference regressions: 2 passed, testing the actual shared control before victory and during the natural result countdown; manual Next still advances.
- Final focused color/font/fixture checks: 60 passed; category/theme checks: 35 passed; subsequent Snake/UI/statistics/settings checks: 145 passed.
- Explicit World/appearance suites: 114 passed, including all `fpv-world-*.test.mjs` and appearance/family/role checks.
- `community-package.json`: real compiler, exact file hashes, two packages (1,037 files each, about 24.9 MB each), emitted runtime HTTP loading and verified cache-only Node reload. This is not a physical offline-installation result.
- `sim-browser-comparisons.json.gz` and `sim-summary.json`: immutable 55-file source snapshot, **42 complete paired comparisons covering all 14 environments × three presets**. Both paired frame gates pass in every comparison; worst ratio 1.0426 (4.3%). Repeated registered/GPU allocation counts match within every authored/theme/theme/authored sequence. One run aborted when the browser became hidden and was repeated visibly; it is excluded from completed evidence. One explicit stationary grazing-view readability judgment is recorded. No actual-flight, GPU-timestamp or physical-device certification is implied. The first four runs overlapped non-graphics Node checks; later runs used no concurrent test/build workload. Dedicated physical-device qualification still requires an idle reference workload.
- Generation checks pass for the canonical SIM shell, reaction runtime, embedded presentation and first-paint bootstrap. Refreshing the presentation projection after the shared shell is necessary; the intermediate stale-projection failure was resolved by regeneration, not suppressed.

## Open gates

The existing Theme Studio tab could not be accessed: browser URL policy rejected the request. Native import/duplicate/recovery therefore remains open; no alternate access route was used. The previous unapproved Safari access and unavailable physical touch/controller/device checks remain open. The synthetic environment/quality comparison matrix is complete for the pinned source snapshot. Actual flights, whole-screen contrast qualification, other result/reward hosts and production-art adoption are not claimed complete.
