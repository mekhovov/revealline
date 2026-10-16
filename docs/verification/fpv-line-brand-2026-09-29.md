# FPV / LINE branding verification

Date: 2026-09-29. Scope: current source and local generated artifacts. Nothing was published, version-bumped or committed by this work. Existing historical snapshots and other work in the shared checkout were preserved.

## Implemented

- Current game identity is **FPV / LINE** across the three player hosts, website, creator chrome, browser/install metadata, new exports and native display metadata. Executable basenames use **FPV LINE**.
- All 14 edition display names use `/ LINE`. The aggregate Dutch edition is **DroneAid / LINE**, with canonical public selector `droneaid`. Old direct query links still work; their address bar is not forcibly rewritten. Generated links and the legacy company entry redirect use the canonical selector.
- DroneAid uses its existing propeller asset. Landing rotation is a ten-second loop; compact in-game logos stay still. The landing image is square: 88px normally and 64px in short landscape. This corrects a discovered cascade conflict with the previous wide logo rules.
- The new original wordmark and matching app icon were created with the built-in image generator. A final contrast refinement makes the drone's ivory arms visible on the dark menu. The exact prompts and untouched originals are recorded in [the identity documentation](../fpv-line-branding.md).
- Stable storage, content, manifest and bundle identities remain compatible. Official Solo theme labels use current brand metadata without rewriting serialized themes or custom labels.

## Automated evidence

| Area                                                                    | Result     | Evidence / boundary                                                                  |
| ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Title ownership, image errors, locale changes, focus and disposal       | 4/4        | `game/test/brand-identity.test.mjs`; repeated after final artwork                    |
| Title, fullscreen and inventory focused run                             | 9/9        | `brand-identity`, `native-landing-fullscreen`, `native-menu-inventory`               |
| Current copy, localization, Couch locale, install and desktop contracts | 55/55      | [Copy report](fpv-line-copy-2026-09-29.md)                                           |
| Locale extraction and validation                                        | Pass       | EN/UK build/check; final catalogue totals can change with concurrent feature work    |
| Edition aliases and provider identity                                   | 28/28      | [Identity behavior](../edition-public-identity.md)                                   |
| Migration and launcher behavior                                         | 40/40      | Stable installed identity, exact same-edition roots and alias behavior               |
| Publication / rollback and compile fixtures                             | 21/21 each | Frozen release bytes and old/canonical launcher compatibility                        |
| Theme display labels                                                    | 3/3        | All seven official DroneAid themes, suffixes and source immutability                 |
| Actual current edition host behavior                                    | 15/15      | All 14 editions boot/start; selector labels and stable values                        |
| Icon/native derivation and packaging                                    | 36/36      | [Icon report](fpv-line-icons-2026-09-29.md); real ICNS decoded with Apple `iconutil` |

The final combined root run passed **12/12** title, fullscreen, inventory and theme-label checks after all title ownership changes.

The final Versus lifecycle run passed **33/33** checks, including ready refreshes, locale changes, loading/paused/results headings, stale image callbacks and cleanup. It includes two new regressions against the real host and the shared menu adapter.

Export/backup/media checks passed 215/216. The remaining existing session-only test expects `xonix-session.v5`, while the current runtime emits `xonix-session.v6`. It fails before its renamed filename assertion. Branding does not change that schema; this is recorded as unresolved rather than a passing regression suite.

## Browser evidence

The final source runs at `http://127.0.0.1:8768/`. During testing, a concurrent scene change briefly referenced a file that had not yet been written; the source boot recovered after that module arrived. No placeholder or rollback was introduced.

- All 14 edition landings were checked in Chrome at **390 × 844**, then rerun after the propeller CSS correction. Every title, text fragment and visible control fits; no horizontal overflow. All seven Dutch DroneAid propellers decode and rotate with different sampled transforms. [Complete matrix and measurements](fpv-line-edition-browser-2026-09-29.md).
- DroneAid was visually checked at **1280 × 720** and **844 × 390** in the in-app browser. The short layout keeps the logo beside Solo, clear of the title and actions. Disabling Animated backgrounds produced `animation-name: none` and `transform: none`; re-enabling restored motion.
- Default FPV / LINE was checked in English desktop and Ukrainian portrait. Plain text shows the real title and hides the image. Restoring Theme font restores the image. Fullscreen changed its action to Exit; Escape exited fullscreen while retaining the landing and focus.
- Team retains its decoded wordmark at 390 × 844 in Ukrainian, with no horizontal overflow and its lowest action ending at 618.9px. Versus initially replaced the logo during host rendering; the corrected host keeps one image through ready-state refreshes and restores localized loading/pause/results text when needed. The final Versus landing was browser-checked at 1280 × 720 with its decoded wordmark and no horizontal overflow.
- Representative website, Company Studio, Design Atlas and Creator headers were checked separately, including EN → UK → EN on About. [Copy/header report](fpv-line-copy-2026-09-29.md).

Screenshots: [FPV desktop](fpv-line-brand-2026-09-29/fpv-desktop-final.jpg), [DroneAid desktop](fpv-line-brand-2026-09-29/droneaid-desktop-final.jpg), [FPV Ukrainian portrait](fpv-line-brand-2026-09-29/fpv-uk-390-final.jpg), [Plain text](fpv-line-brand-2026-09-29/fpv-plain-desktop.jpg). The final wordmark's crop is CSS only, centered at 42% vertically to retain all rotor edges.

Additional mode evidence: [Team Ukrainian portrait](fpv-line-brand-2026-09-29/team-uk-390-final.jpg), [Versus desktop](fpv-line-brand-2026-09-29/versus-desktop-final.jpg). Test language, palette and motion preferences were restored; temporary mode tabs and viewport overrides were cleaned up.

## Standalone preview packaging

The bounded DroneAid package is served locally at [the canonical launcher](http://127.0.0.1:8796/editions/droneaid/app/). Its launcher retains the stable installed-app identity and enters the canonical `?edition=droneaid` route. Browser checks confirm 88px square propeller artwork on desktop and 64px in short landscape, with advancing rotation transforms and all landing actions visible.

Final candidate: **692 compiled files**, **689 offline entries**, **66,665,376 bytes** (443,488 bytes below the 64 MiB cap). All 689 inventory hashes verified. A clean browser boot served 486 requests with no 404/500 responses and no default example-pack index request. [Build record](fpv-line-brand-2026-09-29/standalone-build.json), [standalone landing](fpv-line-brand-2026-09-29/droneaid-standalone-final.jpg).

The packaging check found three dynamically loaded menu stylesheets absent from the reviewed resource map. Soundtrack, offline-install and controller-editor styles were added explicitly; the real-source resource closure check passed 8/8. It also found an unconditional request for default example packs inside an edition whose provider rejects those packs. The host now disables that request only for edition content. Two real-host checks verify that editions do not request the index and the default game still loads and offers its example packs. Private imports, installed packs and selected edition content remain unchanged.

## Delivery boundaries

This work does not claim a newly published web release, a rebuilt full distribution, an installed macOS/iOS application, physical-controller qualification, or real installed-PWA scope migration. Native icon files and packaging contracts were verified; browser and OS update behavior still belongs to release qualification. Direct legacy aliases remain supported for compatibility, and historical brand references in archived artifacts and original attribution are intentionally retained.
