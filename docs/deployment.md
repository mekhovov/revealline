# Build and distribute

The implemented distribution is a **static browser application**. The CLI produces local files; it does not provision a host, publish a site, create an App Store binary or upload a Steam build. Native wrappers are separately scoped work.

## Static website

```sh
npm run validate
npm run lint
npm test
npm run build
node scripts/game-cli.mjs serve --root dist --port 8769
```

Open [the built game](http://127.0.0.1:8769/game/). The generated root page links to the game, the included couch race, Replay Theater and playground, privacy information and credits. [Replay Theater](replay-theater.md) is also included at `/game/replay-theater/`, with its verified example recordings. Preserve the entire output hierarchy when copying to a static host: `game/` and the selected `authoring/motion-lab/` presentation dependencies must remain alongside each other. Publishing only `game/` breaks those relative imports and image paths.

The exact allowlist is [build-config.json](../game/build-config.json). It copies the game, the required animation/character modules, presentation presets and local body assets; source-only `game/test/` files are omitted. Tests and their CLI helpers remain in the source archive. Research documents, third-party reference pictures, local profiles and the full historical lab are not part of that allowlist. The vendored Phaser runtime and its license stay with the game.

Build output also includes generated offline/PWA files and public entry/privacy/credits pages. The generated `_headers` is a static-host policy template; a CLI-owned build preview enforces that policy. See [public release instructions](public-release.md) and [offline release instructions](offline-release.md).

Build output contains:

- `manifest.json`: version, optional source revision, entry page, byte lengths and SHA-256 for every playable file, including generated build information.
- `distribution.zip`: those same playable files plus the manifest, using deterministic uncompressed ZIP entries. It omits itself, its sidecar and the private build-ownership marker.
- `distribution.zip.sha256`: the archive digest in standard checksum-file form.
- `game/build-info.json`: the version and full saved source revision when supplied by a release snapshot.

The ZIP has fixed timestamps, stable lexical file ordering and no current-clock metadata. Identical input bytes, version and source revision produce identical archive bytes with this tool. A normal working-tree build records `sourceRevision: null`; it must not be described as a clean committed release. A [release snapshot](versioning.md) records the exact commit.

Use HTTPS for a public site. Configure the host to serve `.mjs`/`.js` as JavaScript, `.json` as JSON and any `.webmanifest` as a web app manifest; do not rewrite missing assets to an HTML application page. Retain relative paths when hosting under a prefix such as `/versions/v0.1.0/`. No SPA fallback is needed for the current file-based entry. Uploading or changing a live site is a separate external action; finish the local build and review it before that action when approval is still needed.

## Browser installation and offline use

Serving a static game does not by itself verify offline behavior or installation. Browser installation criteria vary; manifest metadata and HTTPS or loopback are relevant, while a service worker provides separately testable caching behavior. Browser and platform installation flows also differ. [MDN installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

Only claim PWA support for the manifest, icons, registration and cache behavior actually present in `game/` and tested in the current build. Test first visit, subsequent offline start, missing media, update activation and old-version coexistence. Source and release servers should use separate ports during comparison so origin-scoped storage and any service worker cannot silently cross between versions. No native iPhone installation or offline certification is established by the Node checks.

## Planned mobile packaging

**Recommended next path: Capacitor**, once the browser game and touch controls are stable. It keeps the HTML/JavaScript UI and connects it to native projects. The official workflow builds the web application, copies the chosen web directory through `npx cap sync`, then tests and compiles native targets. A future wrapper should point `webDir` at the complete `dist/`, retaining the relative game/dependency hierarchy. Capacitor configuration and platform folders are not implemented here. [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow)

The iOS target requires a supported Xcode toolchain, native project configuration and signing. Check the current requirements when adding it; a web-only contributor does not need Xcode for ordinary development. No IPA, App Store submission or physical-device result is produced by `npm run build`. [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)

## Planned desktop and Steam packaging

**Recommended desktop candidate: Electron with Forge.** The official Electron distribution guide recommends Forge for packaging. A wrapper can load the existing web game, but needs its own application entry, packaging configuration, platform builds and signing decisions; none is implied by a ZIP of website files. Test memory, startup, resizing and controller input on target hardware before selecting the wrapper definitively. [Electron application packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution)

A future Electron shell should keep the game renderer isolated from Node and expose only deliberately designed native operations. Follow the maintained Electron security recommendations when creating the shell, especially for any imported content or external navigation. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)

Steam deployment follows a packaged desktop build: configure the application's launch options and depots, upload through the documented SteamPipe workflow, and test a private branch before a public release. This repository has no Steam app ID, depot credentials, executable or Steamworks integration. A static ZIP is useful for web hosting and archival comparison; it is not a verified Steam package. [Steamworks uploading documentation](https://partner.steamgames.com/doc/sdk/uploading)

Official packaging pages were checked on **12 September 2026**. These are implementation recommendations, not claims that the native targets have been built or tested.
