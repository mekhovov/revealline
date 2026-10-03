# Material chooser and Theme Studio

The player theme chooser now embeds a compact, independently resolved material specimen in every card, including Follow campaign/community and curated themes. Clicking the card applies the complete theme immediately. Each card remains one keyboard/controller target; sample controls are inert, hidden from accessibility naming and rendered as spans, without nested native controls. Selection/focus stays on the outer card while the inner sample retains its own palette.

Creator tools → Workshop tools → **Theme Studio** opens the existing theme authoring engine at `authoring/asset-studio/?studio=themes`. The dedicated view opens independent workspace management and the runtime specimen automatically. It offers the existing create/duplicate/import/export, compact-runtime export, community defaults, asset editing and inspection operations. The optional built-in gallery uses the same component as the player cards, with real native controls for experimentation. Preview interaction does not change the active workspace or game theme.

The shared editor keeps its own storage and return-navigation contract. Theme Studio returns to its exact Workshop opener, preserving the bounded campaign/edition hints. No test fixture is used as a production page.

## Verification

- `tests.tap`: **73/73 pass** across material chooser, controller activation, unified appearance, authoring basis/workspaces, preview, editor loading, theme framework and compiled community packaging.
- `bootstrap-tests.tap`: **8/8 pass**; generated first-paint seed remains current. Localization verification passes for English and Ukrainian (12,755 messages / 8,978 references), as do ESLint, formatting, whitespace and byte-identical embedded SIM checks.
- `navigation-tests.tap`: **49/50 pass**. All Theme Studio routing, independent workspace and shared-preview assertions pass. The existing controller-lab return assertion fails: it expects `shell-controller-lab` but receives `shell-guide`.
- `controller-baseline.tap`: the same failure reproduces independently at unchanged base `4186a320c`. Existing native menus relocate the controller link to Settings; Workshop return falls back to its guide. This update does not change that controller behavior.
- Browser: 18 main-game cards; distinct runtime scopes for all 17 built-ins plus Follow; immediate Dnipro selection and restoration of the pre-existing Obsidian choice; zero overflowing preview containers at the observed desktop size.
- Browser: Theme Studio reached through the real Workshop destination; saved workspaces loaded; all 17 gallery scopes created on opening the gallery. Changing its detail selector and telemetry checkbox left the global Obsidian theme and active `field-kit` workspace unchanged.
- Both game and Theme Studio report zero browser console errors. English and Ukrainian preview/entry copy is localized. Generated SIM CSS was refreshed from the shared stylesheet.
- `package-evidence.json`: two reproducible builds from runtime commit `5a529f5aa` verify committed inputs and ZIP inventories for all three optional packages. No new package files; Academy and Worlds each grow by 3,786 bytes. All existing limits pass; Worlds source remains at 104/104 files.
- Screenshots: `game-theme-cards.jpg`, `workshop-entry.jpg`, `theme-studio-workspaces.jpg`, `studio-material-gallery.jpg`.

This is a focused UI/authoring change. It adds no simulation or recording behavior. Target-device performance, physical-controller qualification and complete screen-by-screen release acceptance remain separate from these checks.
