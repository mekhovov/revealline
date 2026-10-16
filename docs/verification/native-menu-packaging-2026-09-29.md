# Native menu packaging verification — 2026-09-29

These are local working-tree verification artifacts for version **0.142.1**. They are not release-admitted, signed or published builds. Existing retained releases and version numbers were not changed. The final artifacts below supersede earlier packages made during this task.

## Full web and desktop

The normal command `node scripts/game-cli.mjs build --out /private/tmp/revealline-menu-build-complete-20260929-r2` completed with all standard validation enabled. There is no validation bypass or manual inventory modification.

- Web output: `/private/tmp/revealline-menu-build-complete-20260929-r2`.
- Files: **1,856**; manifest body: **750,257,549 bytes**.
- Manifest SHA-256: `ee85ef57479b6c8c5c7c21bfc0d9e3f479ff86cfaa678ef776790e3369db4549`.
- Distribution ZIP SHA-256: `8d0a59ae71f4d5f160b550c6bf525658660e526cc763879ef29dbe7020c7db64`.
- Desktop stage: `/private/tmp/revealline-menu-desktop-complete-20260929-r2`. Both `native-cli stage --platform desktop` and `native-cli verify` passed; 1,856 files and 750,257,549 bytes retain the same manifest SHA-256.
- Main Solo, Versus and Team HTML bind `data-build-version="v0.142.1"`; no version placeholders remain in those entry pages.

Desktop staging verifies the packaged web payload; it does not establish that an Electron executable or physical controller was run.

## Source and launcher agreement

All 1,708 packaged files that have an original at the same source path were compared. 1,687 match byte-for-byte. The remaining 21 are expected build outputs: 20 HTML files receive release labels and/or offline installation metadata, and one authored route loader is replaced with pinned navigation descriptors. Normalizing the known HTML insertions reproduces current source exactly; every generated route descriptor's file length and SHA-256 matches its packaged body. All 23 explicitly checked current menu, font, scene, controller, creator, reference-gallery and gameplay-return modules match source.

The stable default launcher contains 33 files totaling 251,619 bytes. Its largest file is 43,702 bytes, below the unchanged **128 KiB per-file cap**. 23 launcher files match their current source/generated projection exactly. Its shared controller/router, confirm guard/lifecycle and field editor stylesheet travel with a projected EN/UK catalog and an empty authored-content registry; no complete gameplay registry is duplicated. The default and company launchers use existing handlers, visible focus and 44px targets. Back focuses Play, Prepare or Check without starting them.

Launcher/navigation/offline/publication focused tests: **19 passed**. Browser evidence for the compiled company launcher covers Confirm-release → Check → Prepare, Back focus and the exact versioned destination. Both aggregate overview posters decoded at 1536×1024. Those browser checks used the preceding candidate with identical menu/launcher JavaScript and artwork; the final r2 delta is the dormant field-editor stylesheet and explicit head/body markup in the sprite reference gallery.

## All 14 standalone editions

Final edition output: `/private/tmp/revealline-menu-editions-complete-20260929-r2`. The local compiler verifies each complete module graph, required fonts/icons/scenes, offline manifest, version label, scene mapping and stable launcher pointer. The local route layout is `/editions/<id>/app/` pointing to `/editions/<id>/releases/v0.142.1/site/game/company.html`. This harness does not invoke or bypass public release admission.

All **14 editions passed**. All **549 engine source hashes** still agree with the checkout, and 588 comparisons verify the shared launcher closure in both the stable and versioned directories. The largest offline body is `droneaid-nl-community`: **65,745,219 bytes**, below the unchanged **67,108,864-byte (64 MiB) cap**. Each edition includes only its own home scene plus FPV fallback art; its genuinely selectable gameplay assets remain included.

Scene inventory: 18 profiles, 18 distinct landscape image hashes and 19 delivered WebP files including FPV portrait. Largest active compressed image: **700,570 bytes**, below 2 MiB. The Coupa and Dutch aggregate editions have separate original overview compositions. FPV has a separate portrait original; the other 17 scenes use explicitly authored focal crops, not separate original portrait paintings.

## Evidence and scope

Machine-readable proofs: [package report](menu-scenes/final-packaging.json), [source/package hashes](menu-scenes/final-source-fingerprints.json), [all 14 edition results](menu-scenes/edition-compilation.json). Art provenance and byte ledger: [scene provenance](../../game/ui/art/menu-scenes/provenance.json). Local animation timing and memory estimates: [measurement report](menu-scenes/performance.md).

The first iOS static stage correctly rejected a generated sprite gallery without an explicit head. The generator and gallery were repaired; the official strict HTML/CSP preflight then accepted all **33** packaged HTML documents. The final package was rebuilt normally after that correction. iOS stage results follow below.

## iOS static package

The final r2 web distribution was staged with the official bundled Capacitor bridge and all four diagnostic files. Both the official stage command and its independent inventory verification passed:

```sh
node scripts/native-cli.mjs stage --platform ios \
  --site /private/tmp/revealline-menu-build-complete-20260929-r2 \
  --out /private/tmp/revealline-menu-ios-stage-20260929-r2-audit-navigation \
  --bridge platforms/ios/bridge/dist/bridge.mjs \
  --diagnostics platforms/ios/diagnostics
node scripts/native-cli.mjs verify \
  --site /private/tmp/revealline-menu-ios-stage-20260929-r2-audit-navigation
```

- Version: **0.142.1**; **1,861 files**, **750,340,878 bytes**.
- Origin and entry: `capacitor://localhost/game/index.html`.
- Source manifest SHA-256: `ee85ef57479b6c8c5c7c21bfc0d9e3f479ff86cfaa678ef776790e3369db4549`.
- Native manifest SHA-256: `cf6124daa86adac86b93f239021ec509f0517180c23f47389be1e988cc7806b3`.
- Official bridge: **62,090 bytes**, SHA-256 `aea5880c04f915d7424e4f309de546c6ef65a99691fd731c83bc908a5f928fb4`. The bridge build checks for external imports and includes the pinned runtime license notices.
- Stage and verification reports: `/private/tmp/revealline-menu-ios-stage-20260929-r2.json` and `/private/tmp/revealline-menu-ios-verify-20260929-r2.json`.

These checks used the existing Node **22.22.2** executable at `/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node`. The isolated `npm --prefix platforms/ios ci --ignore-scripts` installed 104 packages from the committed lockfile; npm reported zero vulnerabilities. No global runtime or lockfile was changed.

```sh
node --test platforms/ios/test/*.test.mjs
node --test scripts/native-cli.test.mjs
node platforms/ios/scripts/build-bridge.mjs
node platforms/ios/scripts/doctor.mjs
```

The iOS Node suite passed **16/16** tests; the shared native staging suite passed **17/17**. The locked Xcode project parser also read and serialized the committed project in memory and generated 1,000 unique native IDs without writing the project. Logs are `/private/tmp/revealline-menu-ios-tests-20260929.log` and `/private/tmp/revealline-menu-native-cli-tests-20260929.log`; the doctor report is `/private/tmp/revealline-menu-ios-doctor-20260929.json`.

Doctor confirms valid pinned configuration, installed dependencies, the existing native project, iOS **15.4** deployment targets, and the linked privacy manifest. The developer directory is `/Library/Developer/CommandLineTools`; full Xcode and `simctl` are absent. Its `stagedEntry` and `stagedManifest` fields remain false because it checks `platforms/ios/www`, while this verification deliberately stages to the separate temporary directory above. The final stage's own verifier passes.

This is a verified **static iOS web payload**, not an IPA or evidence of native execution. No `native:add`, `native:sync`, signing, Xcode compilation, simulator/device launch, native Share/Files roundtrip, storage durability test, or physical-controller test ran. The package manifest, lockfile and committed Xcode project retain their original hashes. Actual WKWebView/controller behavior and the native acceptance checks in [the iOS README](../../platforms/ios/README.md#device-verification-and-remaining-gaps) remain unverified.
