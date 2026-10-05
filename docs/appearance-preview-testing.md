# Test an appearance PR preview

Open the PR's **Appearance preview** check, then download
`appearance-preview-pr-<number>-<head SHA>` from the workflow run's Artifacts section.
GitHub artifacts require a signed-in account and expire after seven days; rerun the
workflow when necessary. This is a downloadable development build, not a live site
or production release.

The workflow tests and builds the exact PR head, including a stacked PR's complete
head tree. It does not test GitHub's synthetic merge commit. After rebasing or
updating the PR, use the new head's artifact. `preview-identity.json` records the
commit, tree, run URL, actual focused test files and both ZIP checksums. Only those
focused checks are claimed; the repository's wider release-suite waiver is unchanged.

## Open the downloads

Extract the downloaded artifact into a new local folder. From that folder:

```sh
# macOS; on Linux use: sha256sum -c SHA256SUMS
shasum -a 256 -c SHA256SUMS
unzip distribution.zip -d game-preview
unzip fpv-worlds-playtest.zip -d worlds-preview
python3 -m http.server 8768 --bind 127.0.0.1
```

Keep the server running and open:

- Game: <http://127.0.0.1:8768/game-preview/game/>
- Asset Studio: <http://127.0.0.1:8768/game-preview/authoring/asset-studio/>
- Company Studio: <http://127.0.0.1:8768/game-preview/authoring/company-studio/>
- Worlds: <http://127.0.0.1:8768/worlds-preview/optional-practice/fpv-worlds/>

Use localhost rather than opening HTML files directly. These paths share one
origin so global appearance preferences can be exercised across surfaces. A separate
browser profile keeps the preview apart from your existing localhost saves. Use
the ordinary password when a route requires it; a locked route remains an untested
boundary if that credential is unavailable. This build does not bypass access gates.

The Worlds archive is a separate development playtest. Its generic builder receipt
may say that general unit qualification is deferred; the checks actually run for
this PR are listed separately in `preview-identity.json` and `focused-tests.tap`.

## Focused review

1. **Theme and reading controls.** Preview and Apply Industrial, Dnipro and one
   other family. Check Cancel, explicit personal choice, Follow campaign/community,
   high contrast, opaque HUD, narrow layout and keyboard focus. Reload and verify
   only applied preferences persist.
2. **Game and menus.** Start, pause and retry a mission; open Music, Settings and a
   replay. Check text, selected/disabled/error states, semantic colors and focus.
   Existing authored pictures and gameplay behavior should remain intact.
3. **Creator to community.** In Asset Studio, create a named interface revision
   and hand it to Company Studio. Opening it must leave the draft unchanged until
   Apply. Assign it to a community or campaign, export and reopen the draft, and
   verify its name and exact revision. Reuse it in another unrelated community.
   An explicit player theme should still win. This path supports custom interface
   data with installed art dependencies; unsupported asset edits must be explained.
4. **SIM lifecycle.** Compare lobby thumbnails, editor, hangar and flight. Change
   appearance before arming, then after arming; the active world/model must remain
   fixed until explicit retry/reset/next. Accessibility changes remain immediate.
   Check a saved replay and a missing-theme fallback. Exercise the game's actual
   optional SIM launcher for the isolated-tab custom-theme transfer.
5. **Report identity and limits.** Include the commit from `preview-identity.json`,
   route, theme, locale, browser/device, steps, expected/actual behavior and a
   screenshot for visual defects. Record any locked, unsupported or untested path.

Physical controller/touch/screen-reader coverage, real GPU flight-distance
readability/performance, complete offline installation and bespoke production art
still require their own acceptance. A green preview check does not establish them.

## Reproduce from source

Use Node 22.13.1 and the PR head. Install `npm ci` and
`npm ci --prefix authoring/fpv-worlds --ignore-scripts`; the latter supplies the
pinned IndexedDB fixtures for SIM checks. Run the explicit test-file list in
`.github/workflows/appearance-preview.yml` with `node --test --test-concurrency=1`.

Build with `node scripts/game-cli.mjs build --revision <head SHA>` and
`npm run fpv:playtest`. The default outputs are `dist/distribution.zip` and
`dist/fpv-worlds-playtest/fpv-worlds-playtest.zip`. Keep generated builds and local
browser data outside the PR; the workflow uploads archives and receipts only.
