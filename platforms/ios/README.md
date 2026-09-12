# Reveal Line iOS scaffold

This directory wraps the **same web distribution** in Capacitor. The official Swift Package Manager project is generated at `native/App/App.xcodeproj`. Game rules, maps, packs, controls and animations remain JavaScript/data maintained in the shared source. No development server, account backend or runtime CDN is configured.

This is a locally generated scaffold, **not a compiled or device-certified iOS release**. The host used here has Command Line Tools but no full Xcode or simulator. Current status and remaining acceptance checks are below. See the [native compatibility review](../../docs/native-compatibility.md), [native distribution workflow](../../docs/native-distribution.md) and [browser release guide](../../docs/public-release.md).

## Pinned dependencies and prerequisites

Verified against the official npm registry on 2026-09-12:

| Dependency                                            | Exact version | Purpose                                              |
| ----------------------------------------------------- | ------------- | ---------------------------------------------------- |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` | 8.5.2         | Web runtime, local tooling, WKWebView container      |
| `@capacitor/app`                                      | 8.1.1         | Native inactivity event                              |
| `@capacitor/filesystem`                               | 8.1.3         | Temporary UTF-8 JSON cache exports                   |
| `@capacitor/share`                                    | 8.0.1         | Player-requested native share sheet                  |
| `esbuild`                                             | 0.28.2        | Bundle the narrow native bridge without bare imports |

The package and lockfile are isolated from the browser game's dependencies. Registry records: [core](https://registry.npmjs.org/@capacitor/core/8.5.2), [CLI](https://registry.npmjs.org/@capacitor/cli/8.5.2), [iOS](https://registry.npmjs.org/@capacitor/ios/8.5.2), [App](https://registry.npmjs.org/@capacitor/app/8.1.1), [Filesystem](https://registry.npmjs.org/@capacitor/filesystem/8.1.3), [Share](https://registry.npmjs.org/@capacitor/share/8.0.1), [esbuild](https://registry.npmjs.org/esbuild/0.28.2).

Use **Node 22+ and Xcode 26+ on macOS** for native builds. Node 22.22.2 was already installed on the scaffold host and was used without replacing its default Node 20. SPM avoids a CocoaPods/Ruby setup. [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup)

The app deployment target is **iOS 15.4**, above Capacitor's iOS 15 minimum. WebKit 15.4 introduced several APIs used by this game, including Web Locks and `structuredClone`; this floor is a prerequisite, not a promise that every API works on the packaged scheme. [Capacitor iOS support](https://capacitorjs.com/docs/ios), [WebKit 15.4](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/)

## Build, stage and sync

Run these from the repository root, with Node 22+ selected:

```sh
npm --prefix platforms/ios ci --ignore-scripts
npm --prefix platforms/ios test
npm --prefix platforms/ios run bridge:build
```

Stage an actual built web distribution. `PATH_TO_SITE` is its directory containing `manifest.json`, `index.html` and `game/`. A `.cache/` candidate is appropriate for development; a frozen release should be selected deliberately for distribution.

```sh
node scripts/native-cli.mjs stage --platform ios --site PATH_TO_SITE --out platforms/ios/www --bridge platforms/ios/bridge/dist/bridge.mjs --diagnostics platforms/ios/diagnostics
npm --prefix platforms/ios run native:sync
npm --prefix platforms/ios run doctor
```

Add `--replace` to the stage command to replace a previously owned stage. It verifies source bytes and writes the native inventory; `cap copy` itself is not an inventory verifier. Rebuild the bridge whenever its source/dependencies change, restage the complete site, then sync. Native-only dependency changes require sync so SPM references update.

The committed `native/` project already exists. **Do not run `native:add` on it again.** The one-time generation command was `npm --prefix platforms/ios run native:add`. If intentionally regenerating from a clean source checkout, restore the app's iOS 15.4 target and resource-linked `PrivacyInfo.xcprivacy`, then review the diff. Capacitor owns `native/App/CapApp-SPM/Package.swift`; sync can regenerate it. [SPM workflow](https://capacitorjs.com/docs/ios/spm)

On a Mac with full Xcode:

```sh
npm --prefix platforms/ios run native:open
```

Select the App target and a simulator, resolve Swift packages, then Run. For a device, configure a real signing team and a bundle identifier you own in Xcode. `local.revealline.playtest` is a scaffold identifier, not a provisioned store identity. Keep the app identifier and `capacitor://localhost` stable once real player data exists. Preserve Xcode's resolved Swift dependency file after resolution: the npm lockfile alone does not freeze all native transitive packages. No signing account, certificate or provisioning profile is supplied here.

The generated marketing version is 0.3.0 and build number starts at 1. Increment the build number for each store upload. The app icon and all three splash slots now use the game's original pixel emblem: an opaque 1024px RGB icon and 2732px RGB splash images. The launch storyboard uses the matching `#091324` background and fits the whole emblem without cropping. Native launch appearance still needs an actual iOS check.

The same deterministic renderer creates the desktop ICNS. From the repository root, verify or deliberately regenerate the five designated native image files:

```sh
node scripts/native-art.mjs --verify
node scripts/native-art.mjs --write --replace
node --test scripts/native-art.test.mjs
```

Verification is read-only and is also the command's default. `--write` alone creates missing files but refuses to overwrite differing artwork; `--write --replace` explicitly replaces only these fixed destinations. The script preflights every path, rejects symlinks, and does not accept arbitrary output paths. It regenerates the existing 32px geometry without editing source images. PNG dimensions, RGB data, checksums and ICNS entries are tested; Apple `iconutil` decoded the resulting ICNS on this Mac. These checks do not establish the final appearance inside a running iOS app.

## Files and platform boundary

`capacitor.config.json` keeps `webDir: "www"`, native project path `native`, startup `/game/index.html` and `capacitor://localhost`. The stage preserves `game/` and sibling `authoring/motion-lab/` assets. No production `server.url`, cleartext traffic or broad navigation allowlist is enabled. Do not switch iOS to HTTP/HTTPS: WKWebView already owns those schemes. [Configuration reference](https://capacitorjs.com/docs/config)

The app imports a UTI declaration for `.mjs` as `text/javascript`, using Apple's documented `com.netscape.javascript-source` identifier. It does not add a document-opening handler. Capacitor 8.5.2 first asks `UTType` for MIME types; its older-iOS fallback table omits `.mjs`. The declaration therefore needs an actual-device header check, particularly on iOS 15.4: a system-exported declaration can take precedence. The diagnostic bootstrap uses `.js` so it can report a failed `.mjs` fetch/import. Current macOS resolved `.mjs` correctly in a standalone UTI check; that is not iOS evidence. [Apple UTI declarations](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/understanding_utis/understand_utis_declare/understand_utis_declare.html), [system identifier table](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/UTIRef/Articles/System-DeclaredUniformTypeIdentifiers.html)

`bridge/bridge-entry.mjs` is bundled to ignored `bridge/dist/bridge.mjs`. Staging places it at `native/bridge.mjs` inside the web tree. The game's platform adapter dynamically imports that ESM file only in the native iOS context. Plugin modules load when a bridge method is called; the module does not start a share sheet or subscribe to lifecycle events at import.

| Bridge method             | Behavior                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exportJSON({text,name})` | Validates a safe `.json` name, JSON syntax and UTF-8 bytes; writes a unique file in app cache; opens Share; returns a status of `shared` or `cancelled` with a message; throws on failure. |
| `onInactive(callback)`    | Subscribes to native `appStateChange`, calls back only for inactivity, returns an asynchronous idempotent removal function. It never resumes gameplay.                                     |

Exports are capped at 84 MiB + 32 KiB at this boundary; the shared game's platform adapter may impose a smaller limit before calling it. JSON stays UTF-8 text rather than base64. Files are named uniquely in a dedicated cache directory and have `.json` extensions, allowing the native share receiver to identify the file type. A share outcome does **not** prove the player chose Save to Files. Empty destinations and the pinned iOS plugin's cancellation result are reported as cancelled. [Share API](https://capacitorjs.com/docs/apis/share)

After the sheet completes, fails or cancels, cleanup attempts to remove the current cache file. A failed cleanup is reported on a returned outcome. On a later export, at most 32 matching cache files older than 24 hours are removed; fresh files and unrelated names are retained. This cache is neither the player's durable collection nor a backup destination. `PrivacyInfo.xcprivacy` includes the Filesystem plugin's documented file-timestamp purpose, C617.1, and is linked into the app resources. [Filesystem API and privacy manifest](https://capacitorjs.com/docs/apis/filesystem)

Native inactivity must reach the existing pause, input-release and audio-stop path through the shared adapter. Returning to the app requires an explicit Resume gesture. An app can terminate without a final callback, so periodically saving supported unfinished attempts remains necessary. [App lifecycle API](https://capacitorjs.com/docs/apis/app)

## Device verification and remaining gaps

The diagnostics source is in `diagnostics/`. Include it in a native development stage at `/diagnostics/` when running native capability checks. It reports the actual URL, secure-context flag, exposed APIs and response MIME type of `game/core/index.mjs`. Its explicit probe checks a real lock's exclusion/release, tiny localStorage read/write, and IndexedDB write/close/reopen/read using its own scratch namespace. It also provides a harmless Blob-download/Files-upload fixture. It does not inspect game data or certify exports because an anchor was clicked.

Keep the following outcomes separate:

| Area                   | Required result / remaining boundary                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Locks              | Check `isSecureContext`, actual acquisition, exclusion and release on `capacitor://localhost`. Without usable locks, current game saves remain session-only and coordinated backup import is unavailable. Do not bypass the writer guard. [Web Locks requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)                                                                                                                                   |
| IndexedDB/localStorage | Confirm reads, writes, app relaunch and app-update identity. They remain evictable web storage; successful tiny probes do not establish long-term native durability. A durable native store needs an acknowledged migration/recovery adapter. [Capacitor storage guidance](https://capacitorjs.com/docs/guides/storage)                                                                                                                                              |
| JSON import/export     | Exercise native Share success and cancel; import profile, pack and full backup from Files through the existing size/schema/decode validators. Browser Blob-anchor downloads have an open upstream compatibility issue; the new share bridge requires actual-device verification. [Capacitor issue 5478](https://github.com/ionic-team/capacitor/issues/5478), [file input behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file) |
| Offline                | Cold-launch with networking disabled and no development server. Packaged files provide native offline content; the browser service-worker installer is not the native offline mechanism. Worker registration requires HTTP(S) URLs. [Service worker registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)                                                                                                                  |
| Gameplay               | Complete both steering modes, pause during a live trail, switch roles, test reveal/gallery, large image imports and backup recovery. Test rotation, notches, text entry, audio interruption and physical controllers on actual hardware.                                                                                                                                                                                                                             |
| Packaging              | Verify native CSP, icons, privacy manifest, Swift package resolution, signing, versioning and release archive on Xcode. A generated project or browser viewport fixture does not satisfy these checks.                                                                                                                                                                                                                                                               |

## Observed scaffold checks

On this host, isolated dependency installation, bridge bundling, native stage creation, official SPM project generation, Capacitor sync, Node tests and `plutil` parsing succeeded. `doctor` reports the Command Line Tools path and no full Xcode/simulator. No iOS compilation, native launch, share-sheet/Files roundtrip, storage durability check, physical controller test, store upload or public distribution was performed here.
