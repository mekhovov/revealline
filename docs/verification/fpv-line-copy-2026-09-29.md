# FPV / LINE current copy and chrome verification

Date: 2026-09-29. This records the current-source name and wordmark work; packaging/icon and edition-URL verification are separate.

## Scope

- Current default game, Solo/Versus/Team support copy, website, creator tools, install instructions and EN/UK `interface`, `tools` and `website` catalog values use **FPV / LINE**. Translation keys remain stable.
- Fifteen image nodes replace actual brand headers: game boot and shell; website Launch and About header/footer; Company Studio; Design Atlas; Playground; Content Studio; Controller Lab; Creator index/player; Community index/moderation; Creator Guide. Image alt text is `FPV / LINE`; existing translated parent aria labels remain where present. Tool names remain text.
- Thirty-one current default source HTML pages link the canonical `game/ui/art/identity/fpv-line/icon-32.png`. Company entry and offline launcher metadata have their own brand-aware packaging owners. Frozen reference snapshots were not given new metadata.
- Desktop windows and macOS/iOS display names use `FPV / LINE`. Desktop executable/app bundle basenames use **FPV LINE**, avoiding a path separator. Product IDs and profile locations are unchanged.
- Newly exported backup, media, soundtrack, story, video-poster and enemy-catalog filenames use `fpv-line-*`, retaining existing extensions and byte formats.

## Preserved compatibility and historical data

The repository/deployment URL, runtime globals, local-storage and IndexedDB keys, app IDs, npm package names, environment variables, version placeholders, format/schema IDs, CSS font-family alias and the `RevealLine backup set coverage` report marker remain intact. Existing archives, prior test artifacts, original media attribution, retained content author/source fields and hashed theme/content data keep their original text. The manual verifier for already captured authoring downloads still names those original captured files.

## Checks

- `npm run i18n:build` and `npm run i18n:check` passed: EN/UK, 10,954 messages and 8,595 references.
- Final focused run: **55/55 passed** across localization, Couch locale switching, install/offline, generated/localized pages, current aliases and desktop package/security tests. The package contract asserts the safe executable name and the slash-bearing display name separately. The alias tests verify favicon dependencies at every supported alias depth.
- Export/backup/media tests: 215 of 216 passed. The isolated remaining `session-only-release-next-host` test reaches its existing save assertion at line 170, expecting `xonix-session.v5` while the current runtime produces `xonix-session.v6`; this is before the renamed download-filename assertion. No schema behavior was changed for branding. Earlier concurrent runs timed out before reaching that assertion.
- The native Info.plist passes `plutil -lint`; current text/export/native files pass Prettier.

Focused output: [55 passing checks](fpv-line-brand-2026-09-29/focused-tests.txt).

## Browser evidence

Read-only source browser checks used Chrome at `http://127.0.0.1:8768/`, with a 1593px CSS viewport. About was switched EN → UK → EN; the translated page title and home-link accessible name changed while both decoded wordmarks remained `FPV / LINE`, 192 × 33.7px. No horizontal page overflow was observed. Company Studio, Design Atlas and Creator also displayed their decoded compact wordmarks cleanly with adjacent tool/navigation text. This is representative header evidence, not an all-page responsive or packaged-native claim. The temporary tab was closed and English restored.

Screenshots:

- [About EN](fpv-line-brand-2026-09-29/about-en.jpg)
- [About UK](fpv-line-brand-2026-09-29/about-uk.jpg)
- [Company Studio](fpv-line-brand-2026-09-29/company-studio.jpg)
- [Design Atlas](fpv-line-brand-2026-09-29/design-atlas.jpg)
- [Creator](fpv-line-brand-2026-09-29/creator.jpg)

## Final Versus title lifecycle regression

A browser check found that the normal Couch shell render still replaced the mounted title image with plain text. The shared native-menu owner now exposes idempotent `showBrandTitle` / `hideBrandTitle` transitions using one replaceable image disposer and one final cleanup closure. Versus keeps the image only when ready and not preparing content. Loading, paused and finished titles keep their existing localized text producers. Repeated ready frames do not remount artwork; leaving branding removes the image and its load/error listeners.

The new actual-host regression checks repeated ready renders, EN/UK changes, unchanged match checkpoints and pause status. A second regression checks busy → ready → paused → ready transitions, stale image callbacks and final destruction. Together with existing Couch shell, locale and brand tests, **33/33 passed**, including the real finished-draw result-title check. ESLint and Prettier pass for the three changed files.

A fresh Chrome source visit to `/game/couch/` showed status `ready`, exactly one decoded wordmark, `data-logo-loaded=true` and the accessible FPV / LINE heading after normal rendering. No mission was started during the browser check; its temporary tab was closed.

- [Passing title lifecycle and Couch checks](fpv-line-brand-2026-09-29/versus-title-tests.txt)
- [Actual ready Versus landing](fpv-line-brand-2026-09-29/versus-ready-logo.jpg)
