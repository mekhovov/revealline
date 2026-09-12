# v0.3.0 iOS staging verification

The frozen v0.3.0 web release was staged and copied successfully into the Capacitor iOS project on 12 September 2026. This verifies local files, native configuration and the JavaScript bridge. **No iOS application was compiled or run:** this host has Command Line Tools, without Xcode or `simctl`.

The machine-readable [verification record](native-ios.json) contains the complete hashes, file counts, per-page CSP checks, native metadata and remaining device checks. The frozen source revision is `7cd2046405a7d4daf6663c01c1478101bd0a632a`.

| Artifact                                                  | Files / bytes                             | SHA-256                                                            |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Frozen web manifest, `releases/v0.3.0/site/manifest.json` | 94 listed files / 8,189,687 content bytes | `30ceeac7aab37a3d91ec3b90ebc4b4acc94fa377e954df7b047ea8e05f010b1d` |
| iOS manifest, `platforms/ios/www/manifest.json`           | 99 listed files / 8,263,828 content bytes | `0a74487ac3105bb608998e81a3d6052b411518bf3fd0715a21bf6497ef768669` |
| Bundled native bridge                                     | 61,768 bytes                              | `4d94ad1701b8e8d27cd5a0091fea09ca95f6560bb178a62e2e4901fb747260bc` |
| Copied native public tree                                 | 103 regular files / 8,280,246 bytes       | `2e3f6d45e64584350d0691f569fc40913aabcb5a01e7a3444807cc3549fb73ba` |

The manifest hashes identify the manifests themselves; the content byte counts cover their listed files. The copied-tree hash uses the ordered file inventory definition in the JSON record.

## Checks performed

- Staging verified every frozen manifest entry and preserved the source release. The native copy changes only the seven source HTML pages to add an early CSP; it adds the native bridge and four diagnostic files.
- All eight staged HTML pages have a validated CSP immediately after `<head>`, before any script. Every copied page matches its staged bytes, including the existing stricter diagnostics policy.
- All 99 manifest entries, `manifest.json` and the native marker match the files in `platforms/ios/native/App/App/public/` byte for byte. Capacitor also creates two empty compatibility files, `cordova.js` and `cordova_plugins.js`; those explain the 103-file copied inventory.
- `capacitor sync ios` completed its copy and update steps with App 8.1.1, Filesystem 8.1.3 and Share 8.0.1. The isolated Capacitor core/CLI/iOS versions remain 8.5.2. Sync changed no tracked native project files.
- Copied `game/build-info.json` identifies v0.3.0 and the frozen revision. `app.mjs` registers the inactivity helper, JSON exports use the platform helper, and that helper imports the local `native/bridge.mjs`. Both export layers allow the same 84 MiB + 32 KiB maximum. The bridge includes the runtime MIT and tslib notices and passes `node --check`.
- The generated configuration starts `/game/index.html` at `capacitor://localhost`, with no remote server URL. The project retains iOS 15.4, the linked privacy manifest and the imported JavaScript type declaration for `.mjs`.
- All **22 targeted Node tests passed**: 16 iOS bridge/configuration/diagnostic tests and six native artwork tests. These test native API adapters with injected doubles; they do not certify real Share sheets or WKWebView storage.
- `plutil -lint` passed for the Xcode project, Info.plist and privacy manifest. The deterministic artwork verifier passed for the 1024 × 1024 opaque RGB app icon, three 2732 × 2732 opaque RGB launch images and the macOS ICNS. The launch storyboard retains aspect-fit artwork on `#091324`.

## Reproduce

Use Node 22 or newer; this run used Node 22.22.2. From the repository root, after building the isolated bridge:

```sh
node scripts/native-cli.mjs stage --platform ios --site releases/v0.3.0/site --out platforms/ios/www --bridge platforms/ios/bridge/dist/bridge.mjs --diagnostics platforms/ios/diagnostics --replace
node scripts/native-cli.mjs verify --site platforms/ios/www
node scripts/native-art.mjs --verify
node --check platforms/ios/bridge/dist/bridge.mjs
node --test platforms/ios/test/*.test.mjs scripts/native-art.test.mjs
```

From `platforms/ios`, run `npm run native:sync` and `npm run doctor`. Sync already includes the native copy step. The exact isolated Node executable was used to invoke Capacitor during this run. Run `plutil -lint` on the three metadata files listed above, then compare every staged manifest entry with the copied public directory.

## Remaining iOS gates

Xcode 26 or newer must compile the project and resolve its Swift packages. An actual supported iPhone/iPad must verify `.mjs` response MIME, Web Locks exclusion/recovery, IndexedDB and profile persistence across restarts, native file export/import and cancellation, large backups, storage pressure, lifecycle pause, audio interruption, touch, controllers, safe areas and rotation. Inspect the installed icon, launch screen and game rendering on those devices. The included `/diagnostics/` page reports actual capabilities and performs explicit isolated storage probes.

The scaffold identifier is `local.revealline.playtest`; no publisher signing, TestFlight upload or App Store submission was performed. See the [iOS build guide](../../../platforms/ios/README.md), [native compatibility audit](../../native-compatibility.md), [distribution guide](../../native-distribution.md) and [public-release gates](../../public-release.md). A successful file sync and automated tests do not establish native UI quality or player enjoyment.
