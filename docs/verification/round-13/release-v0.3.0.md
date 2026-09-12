# Frozen v0.3.0 and native artifacts

Source: `7cd2046405a7d4daf6663c01c1478101bd0a632a`, tag `v0.3.0`. The application source was committed before freezing. This report records later artifact checks; no archived site or source archive was edited.

## Retained outputs

| Output                    | Location / evidence                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Play the browser release  | [v0.3.0](http://127.0.0.1:8767/releases/v0.3.0/site/game/)                           |
| Browser ZIP               | `releases/v0.3.0/site/distribution.zip` — 8,216,996 bytes                            |
| Frozen source archive     | `releases/v0.3.0/source.tar` — 86,261,760 bytes                                      |
| macOS ARM64 ZIP           | `platforms/desktop/out/v0.3.0/RevealLine-v0.3.0-macos-arm64.zip` — 134,615,485 bytes |
| iOS project               | `platforms/ios/native/App/App.xcodeproj` — generated/synced project, no compiled IPA |
| Previous native candidate | `platforms/desktop/out/v0.3.0-candidate-01/` retained separately                     |
| Earlier web releases      | All five older ZIPs and source records still match prior verification hashes         |

Browser ZIP SHA256: `a5378bc01ff54bb3a17ac4f3b5778db6d7d2d0b8d478d496e332cc56fd387207`.

Web manifest SHA256: `30ceeac7aab37a3d91ec3b90ebc4b4acc94fa377e954df7b047ea8e05f010b1d`.

Source archive SHA256: `6e45ac6777d0b504f536791f1c2c86efc710ae6886e387cb5402c9e410e76012`.

macOS ZIP SHA256: `60fd5f2593f9292c0481af426b944187957c3670ac99e1094b4c9f25f4f05509`.

## Exact browser artifact

The extracted archive contains 504 regular source files. Building with its own frozen CLI, the same version and the recorded source revision produced a byte-identical ZIP and manifest. All 94 manifest files matched, and the ZIP's 95 entries passed CRC and exact-inventory checks. Fingerprints confirm the prior release trees were not changed. See [machine-readable integrity evidence](release-integrity.json).

A temporary server on port 8795 served the exact frozen site with the production CSP, MIME and other headers. `game/app.mjs` returned JavaScript MIME and 200; an absent file returned 404. The existing source/version server on 8767 remained available.

Through the actual frozen game UI:

- A new profile showed zero pictures/campaigns. Importing the source game's valid 29,501-byte complete backup restored five pictures, two progress campaigns, all three installed packs and its saved flight.
- Undo returned to the empty collection. Re-import succeeded and explicitly loading the suspended attempt restored it paused, with a Resume control and its retained cooldown.
- Couch mode exposed all 22 maps, including the ten maps from the restored expansions. The packaged workshop loaded its configuration and real preview.
- Grid-buffered First Signal completed at 52.2%, 8,160 points, three lives and approximately three seconds.
- Explicit offline preparation verified all 91 cache entries (8,157,092 bytes), with no missing/corrupt files. The generated cache build ID is `829932c1de824c2d14db8e9c22c0da628955c1c4d384cc3258fdc85dedcf08e8`.
- The owned 8795 server was then stopped. Reopening the game still loaded the frozen version and retained imported progress/preferences. Immediate-steering First Signal also completed offline at 52.2%, 8,160 points and three lives.
- Replay Theater opened from the offline bundle, verified Copper Crossing and played all 1,305 ticks. It completed at 74.1% coverage, three lives and 12,590 recorded points; final checkpoint `861a6de2ffd7e119` matched.

These are browser/cache/fixture observations. They do not establish physical Safari, native WebView or controller behavior.

## Native outputs

The final macOS app contains the same 94-file web inventory and source manifest. Its exact original ICNS bytes are installed in the bundle. Every configured fuse was read back. `ditto` ZIP extraction preserved all 367 regular file hashes/modes and 14 symlinks, after which the extracted site, icon and fuses were verified again. See [desktop report](native-desktop.md) and [desktop JSON](native-desktop.json).

The iOS native stage contains 99 manifest files and preserves the source manifest identity. All 99 files plus manifest/marker match the copied Xcode public resources; sync added only two empty Cordova compatibility scripts. All eight staged/copied HTML pages have early CSP. The 61,768-byte bridge includes the full runtime notices and matches staged/copied bytes. No tracked native project file changed during final sync. See [iOS report](native-ios.md) and [iOS JSON](native-ios.json).

The earlier desktop development process was stopped without clearing its data. The final native package was not observed through the UI: macOS automation permissions remained pending. The iOS project was not compiled: full Xcode and simulator tools are absent. Signing/notarization, physical native play/save/share/storage checks, Steam integration and public hosting remain outstanding target-specific work. Neither an unsigned app ZIP nor a generated iOS project is advertised as a public store release.

The [final earned-picture screenshot](screenshots/frozen-offline-picture.png) was captured from the offline frozen release after its immediate-steering clear.
