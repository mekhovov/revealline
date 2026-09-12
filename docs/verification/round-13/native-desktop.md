# Frozen v0.3.0 desktop package verification

The frozen release was staged and packaged for macOS ARM64 on 12 September 2026 using Node 22.22.2, Electron 44.3.0, Electron Packager 20.3.0 and Electron Fuses 2.1.3. The result is a local application with an ad-hoc signature, without publisher signing or notarization. It has not been verified through native gameplay controls.

The complete machine-readable record is [native-desktop.json](native-desktop.json).

## Artifacts and source identity

| Item                                             | Location or identity                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Frozen source commit                             | `7cd2046405a7d4daf6663c01c1478101bd0a632a`                              |
| Application                                      | `platforms/desktop/out/v0.3.0/Reveal Line-darwin-arm64/Reveal Line.app` |
| ZIP                                              | `platforms/desktop/out/v0.3.0/RevealLine-v0.3.0-macos-arm64.zip`        |
| ZIP size                                         | 134,615,485 bytes (128.38 MiB)                                          |
| ZIP SHA-256                                      | `60fd5f2593f9292c0481af426b944187957c3670ac99e1094b4c9f25f4f05509`      |
| Source, stage and packaged site manifest SHA-256 | `30ceeac7aab37a3d91ec3b90ebc4b4acc94fa377e954df7b047ea8e05f010b1d`      |
| Frozen source archive SHA-256                    | `6e45ac6777d0b504f536791f1c2c86efc710ae6886e387cb5402c9e410e76012`      |

`native-package.json` and `SHA256SUMS.txt` sit beside the ZIP. The ZIP contains the application folder together with Electron's license and Chromium notices. The original Phaser license remains in the packaged site. The application folder contains 367 regular files and 14 symbolic links, totaling 327,208,715 regular-file bytes. The earlier `v0.3.0-candidate-01` remains separate and retains its original manifest and Electron default icon.

## Checks performed

All 24 desktop tests passed. Staging verification, the packaged resource loader and a second check of the extracted ZIP each validated the 94-file site inventory. The local entry handler returned status 200 in Node; that check reads the entry and does not execute its renderer.

The application contains the exact original Reveal Line icon: 13,603 bytes, SHA-256 `2a1fff311a06a1f7fbc8a1d171dabe5f213fe4c32c46584c8a0fd30e22197373`. `CFBundleIconFile` points to `electron.icns`, whose bytes equal the source `assets/revealline.icns`. Packager also looked for the optional newer `.icon` Composer format and reported its absence. The supplied ICNS was successfully copied and independently checked.

All nine configured fuse values were independently read from the application and again from its extracted ZIP. Run-as-Node, Node environment options, Node inspector arguments and extra `file://` privileges are disabled. Browser-specific V8 snapshots and WebAssembly trap handlers are enabled. The documented directory-resource design leaves ASAR-only loading, embedded ASAR integrity and cookie encryption disabled.

The ZIP was produced with macOS `ditto` using resource-fork/metadata preservation. It was extracted to a new temporary directory with `ditto`; every regular file's SHA-256 and size, directory/file permission mode, and symbolic-link target matched the original tree. The extracted site inventory, icon and security fuses were then verified again. Temporary extraction files were removed. No source files or existing candidate artifacts were changed.

## Commands

The output already exists and packaging deliberately refuses to overwrite it. These are the commands used to produce it; use a new validated `--label` for a later candidate.

```sh
mise exec node@22.22.2 -- node scripts/native-cli.mjs stage --platform desktop --site releases/v0.3.0/site --out platforms/desktop/site --replace
mise exec node@22.22.2 -- node scripts/native-cli.mjs verify --site platforms/desktop/site
mise exec node@22.22.2 -- npm test --prefix platforms/desktop
mise exec node@22.22.2 -- npm run package --prefix platforms/desktop
/usr/bin/ditto -c -k --sequesterRsrc --keepParent 'platforms/desktop/out/v0.3.0/Reveal Line-darwin-arm64' 'platforms/desktop/out/v0.3.0/RevealLine-v0.3.0-macos-arm64.zip'
shasum -a 256 'platforms/desktop/out/v0.3.0/RevealLine-v0.3.0-macos-arm64.zip'
```

## Remaining native verification

The final packaged application was not launched. Earlier authorized attempts to observe the development Electron UI returned pending macOS Accessibility/Screen Recording permissions twice. No renderer injection, storage changes or operating-system permission bypass was used to substitute for visible-control testing.

Native gameplay, IndexedDB persistence, Web Locks acquisition, imports, exports, long-running backup export gesture handling, fullscreen and restart persistence therefore remain pending. Packaging and unit-test success do not establish these outcomes. Publisher signing, notarization, other desktop architectures/operating systems and public native distribution remain separate release gates.
