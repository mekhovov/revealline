# Maintaining Flight practice

Flight practice is a directory of independently packaged applications, not an unlock system. The existing **FPV flight simulator** shortcut remains separate. **`.rlpack` files are content imported inside World Studio, not executable applications for this directory.**

The SIM workstream owns mechanics, controls, lessons, demonstrations and rendering. This directory owns descriptions, launchers, offline preparation, publishing integration and guides. Do not fork training instructions: point players to the app’s maintained Flight guide / first-flight demonstration.

## Inspect and preview

From the repository root, after `npm ci`:

```sh
node scripts/bundle-optional-practice.mjs --list
node scripts/bundle-optional-practice.mjs --preflight
node scripts/bundle-optional-practice.mjs --preview .cache/practice-preview
node scripts/game-cli.mjs serve --root .cache/practice-preview --port 8877
```

Open `http://127.0.0.1:8877/practice/`. Use a new output directory each time: preview outputs are not overwritten. The preview contains practice applications, not a second copy of the main game; the main-game shortcut requires the complete site. It is deliberately **not publication-qualified**, even if local preflight passes.

Preflight reports missing runtime files, missing/empty license inventory, invalid descriptions or translations, missing/oversized previews, exact dependencies, file/byte limits and local readiness to bundle. The bundle command then reproduces artifacts twice and runs independent admission. Neither command invents human review evidence.

## Register an application

1. Create `optional-practice/<id>/index.html`, a manifest, application modules and `README.md`. Use a stable lowercase hyphenated ID; do not rename an installed app to ship an update. Add instructions, asset sources, copyright/license inventory and support information. Offline preparation must pass that ID to the shared installation service.
2. Add an explicit entry to `publishing/optional-package-policy.mjs`. Declare every runtime file in `localFiles` or `sharedFiles`, the existing worker/launcher templates, locale inputs, licenses and any vendor hashes. Choose justified file and byte limits. No remote imports, arbitrary app fetches or archive-declared expansions of executable dependencies are allowed. Reuse `optional-practice/worker-template.mjs` for new packages. Add dependencies to the core build only if the application is also intentionally bundled there. Apps reusing `sim-presentation.mjs` must explicitly opt into its reviewed `coreOnlyImports` entry for the literal shared settings-tools link; those tools stay in the core game and are not added to the optional archive.
3. Add `package-info.json`, `preview.png` and `guide.html`. The policy adds these discovery files, shared guide/navigation helpers and generated launcher files to each registered app. Account for **both runtime and source archives, including generated manifests**. Current complete limits: Gym 64 files/8 MiB; Flight Studio 72/8 MiB; World Studio 104/16 MiB. File allowances include the new guide and navigation, not extra simulator mechanics.
4. Capture a real gameplay PNG, at most 300,000 bytes; avoid menus alone, synthetic artwork and private imported content. Record provenance/license information in the package README. Copy the bilingual package guide pattern, keeping current app-specific first-flight instructions accurate.
5. Supply this exact bounded descriptor shape, with every copy field in both languages:

```json
{
  "format": "revealline-practice-description.v1",
  "id": "sample-flight",
  "support": "https://github.com/OWNER/REPOSITORY/issues",
  "changelog": { "en": "What changed.", "uk": "Що змінилося." },
  "copy": {
    "en": {
      "name": "Sample Flight",
      "description": "What you can do.",
      "purpose": "What you learn.",
      "inputs": "Supported controls.",
      "requirements": "Graphics and device requirements.",
      "firstFlight": "Where to find the maintained first-flight walkthrough."
    },
    "uk": {
      "name": "Зразок польоту",
      "description": "Що можна робити.",
      "purpose": "Чого навчає.",
      "inputs": "Підтримуване керування.",
      "requirements": "Вимоги до графіки та пристрою.",
      "firstFlight": "Де знайти актуальний посібник першого польоту."
    }
  }
}
```

Each localized string is required, nonempty and at most 900 characters. Support is a HTTPS GitHub repository issue tracker. The descriptor is at most 12 KiB. The generated details document is bounded to 96 KiB/eight apps and binds descriptions to the catalogue’s package ID and revision. Download/offline sizes come from output bytes, not manually estimated text. The renderer does not have a package-ID switch.

6. Run preflight and preview, inspect English/Ukrainian, focus order and narrow screens, then test launch and offline behavior. Update README/changelog and commit the source before creating a release candidate.

## Freeze, review and publish

```sh
node scripts/bundle-optional-practice.mjs --out .cache/practice-candidate \
  --base-path /revealline/ --packages civilian-flight,civilian-fpv,fpv-worlds
```

The source checkout must be clean and committed. The output includes distribution/source ZIPs, exact inventories, `optional-packages.json`, a verification report and a **pending** review template. CI repeats this for all three real apps, including World Studio. Run the focused tests even when repository CI policy explicitly waives broader suites; waived tests are not passed tests.

Complete every existing review gate with real, source-bound evidence: automated validation; content accuracy; assets/licenses; keyboard/controller accessibility; installed isolation; update/rollback; same-device performance; human learning/pacing. Record browser/device, source SHA, package hashes, steps, screenshots, results and limitations. A synthetic fixture’s review is never release evidence.

```sh
node scripts/publish-optional-packages.mjs verify \
  --bundle .cache/practice-candidate --review REVIEW.json
node scripts/publish-optional-packages.mjs upload-draft \
  --bundle .cache/practice-candidate --review REVIEW.json \
  --repository mekhovov/revealline --release-id EXISTING_DRAFT_ID
```

Use the normal release owner to allocate/version/publish the release. Optional tooling does not create releases, move tags, overwrite original assets or bypass review. An existing version tag must identify the candidate’s exact source commit/tree; a candidate built later cannot be attached to an older same-numbered release. Upload verifies downloaded originals and is resumable; do not invent a draft ID.

After the normal release is published:

```sh
node scripts/publish-optional-packages.mjs sync-selector \
  --bundle .cache/practice-candidate --review REVIEW.json \
  --repository mekhovov/revealline --base-path /revealline/ \
  --selector publishing/pages-controller/optional-packages.json
```

Review and commit the selector through the normal main-branch process. `deploy-main-pages.yml` now calls the **existing** optional publisher’s `stage-pages` command after building main and before checking the complete 950,000,000-byte hosted budget. Frozen Pages assembly uses the same overlay. No selected releases produces an explicit empty `practice/index.json`, not a missing file. The post-deployment job reads the selected catalogue, pointers, manifests and every hashed dependency, including stable launcher copies:

```sh
node scripts/bundle-optional-practice.mjs --verify-site https://mekhovov.github.io/revealline/
```

A missing catalogue, missing details, mismatched selector or changed asset fails this check. A successful byte check still does not prove device controls or a human learning outcome.

## Update, retirement and rollback

- Ship changes under a new immutable release URL; retain the prior reviewed release in the selector. Never replace bytes under an existing version.
- Launchers use only `action=play` and `lang=en|uk`. They validate same-origin package/version/entry paths; other parameters cannot choose executable destinations or arm a flight.
- Players prepare a new version explicitly. Previous installations remain separately owned. No `skipWaiting` or forced reload replaces an active flight; close launcher tabs to activate a waiting launcher update.
- Retire an app by removing its ID from `activePackageIds` in every selected release, after review. Keep `packageIds` and retained releases while old URLs must stay available. New site assembly removes its stable entry but retains immutable release files. Retiring is not remotely deleting a player’s cache or records.
- Roll back an active pointer using existing tooling, then review/commit the selector:

```sh
node scripts/publish-optional-packages.mjs select-retained \
  --repository mekhovov/revealline --base-path /revealline/ \
  --selector publishing/pages-controller/optional-packages.json \
  --version vX.Y.Z --packages civilian-fpv
```

Keep the policy’s historical dependencies while releases using them are retained; policy changes must not silently invalidate already reviewed archives. Validate retained overlays before changing dependency policies.

## Recipe verification and remaining qualification

`node --test scripts/test-bundle-optional-practice.mjs` creates a temporary fourth app with real files and a new registry entry, previews all four cards, verifies its launcher route, admits test-only reviewed artifacts, updates, rolls back and retires it. The fixture is cleaned up and never uploaded or added to the real selector.

See [verification report](flight-practice-verification.md), [English player guide](flight-practice-player.md) and [український посібник](flight-practice-player.uk.md). Phase 1 is **not complete** until the reviewed apps are actually selected on GitHub Pages and required device/human qualification is recorded.
