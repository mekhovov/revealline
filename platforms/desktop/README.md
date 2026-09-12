# Reveal Line desktop shell

This directory contains an Electron shell for a separately staged, self-contained web distribution. It does not run a localhost server, load remote pages, expose Node to game code, or install a renderer preload. Root native tooling stages the distribution; this package owns the window, protocol, local policies and host packaging command.

Use the pinned isolated runtime and dependencies:

```sh
mise exec node@22.22.2 -- npm install --prefix platforms/desktop
mise exec node@22.22.2 -- npm test --prefix platforms/desktop
mise exec node@22.22.2 -- npm start --prefix platforms/desktop
mise exec node@22.22.2 -- npm run package --prefix platforms/desktop
mise exec node@22.22.2 -- npm run package --prefix platforms/desktop -- --label v0.3.0-candidate-01
```

`start` requires `platforms/desktop/site/` to contain a staged native distribution. `REVEALLINE_SITE_DIR` can point to a different absolute staged directory. `REVEALLINE_USER_DATA_DIR` optionally selects a separate absolute profile for manual tests. Without that override, the profile is under the operating system's app-data directory in `RevealLine`, independent of the installation path and release version. The web game still maintains its own per-release profile keys; its portable backup remains the transfer mechanism between content releases.

`package` verifies the standard `site/` directory and requires its version to match this package. It copies only the three runtime modules, minimal package metadata and the manifest's site files into a temporary input, then invokes the pinned Electron Packager for the current host OS/architecture. The result is under `out/vVERSION/`, with a `native-package.json` report. An optional safe version label gives a candidate its own output directory without changing the app version. Existing output is never overwritten. The report retains the staged/source manifest hashes, source Git revision (or null for an uncommitted candidate), host architecture and fuse readback. The app's resources remain a regular directory so the same file-integrity loader is used in development and in the wrapper. This produces a local application without a publisher signature or notarization; macOS binary modification resets an ad-hoc signature solely for local loading. Repeatable pinned inputs do not imply byte-identical platform binaries.

Packaging uses `@electron/fuses` `2.1.3` to disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, Node inspector arguments and extra `file://` privileges in the packaged binary. Every current fuse is configured explicitly and read back before output is published. A mismatch or a newly unsupported fuse fails the build. Browser-specific V8 snapshots and normal WebAssembly trap handlers stay enabled. Because this foundation uses ordinary resource directories, ASAR-only loading and embedded ASAR integrity remain disabled; site checksums are corruption checks, not protection against someone replacing the shell and its manifest. Cookie encryption remains disabled in this unsigned, cookie-free application to avoid introducing an unverified Keychain/signing dependency. Review these choices alongside publisher signing before a public native release. [Electron fuse guidance](https://www.electronjs.org/docs/latest/tutorial/fuses), [official fuse package and Apple Silicon signature handling](https://github.com/electron/fuses).

macOS packaging requires the original game emblem at `assets/revealline.icns`. The packager checks its regular-file status, size and ICNS container boundaries, then copies those exact bytes into temporary packaging input. The package report records the icon's hash. Generate and verify the asset with the root native-art command; synthetic unit-test containers only test validation and do not establish native rendering. A Windows ICO and native Linux packaging presentation remain separate platform verification work.

## Bundle contract

The site root must be a real directory. `manifest.json` lists every served file and its exact size/SHA-256. `.revealline-native.json` contains:

```json
{
  "format": "revealline-native-site.v1",
  "platform": "desktop",
  "scheme": "revealline",
  "host": "app",
  "entry": "game/index.html",
  "version": "v0.3.0",
  "manifestSha256": "SHA256_OF_EXACT_MANIFEST_BYTES",
  "sourceManifestSha256": "OPTIONAL_SOURCE_MANIFEST_SHA256"
}
```

`sourceManifestSha256` is optional; if present it must be a SHA-256 hex string. The main digest, entry and version must match the manifest. Metadata and every asset are verified before opening the window. Resources are checked again when read, so altered files fail instead of entering the renderer. Limits are 4,096 files, 64 MiB per file and 512 MiB in total. These integrity checks detect corruption and accidental replacement; the marker is not a publisher signature.

The handler serves inventoried files at `revealline://app/`, with explicit MIME types and CSP. It supports GET, HEAD and single byte ranges. Hidden paths, traversal, encoded separators, symlinks, unknown files, writes and unexpected media types are denied. Directory URLs resolve to their local `index.html` without a redirect. Neither the marker nor the inventory itself is exposed as an ordinary served asset.

## Window and data boundaries

The scheme is registered before app readiness, with `standard`, `secure`, `supportFetchAPI` and `corsEnabled` enabled. CSP bypasses, extensions and custom-scheme service workers stay disabled. The persistent session is `persist:revealline`. Electron documents relative URL resolution and web storage support for standard schemes. [Electron protocol documentation](https://www.electronjs.org/docs/latest/api/protocol), [custom scheme privileges](https://www.electronjs.org/docs/latest/api/structures/custom-scheme).

BrowserWindow explicitly enables sandboxing and context isolation and disables Node integration, subframe/worker Node integration, webviews and renderer DevTools. The session denies permission checks, permission requests, device access and display capture. Remote network requests and navigation are blocked; no external shell opener exists. These boundaries follow Electron's recommended renderer isolation and permission practices. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [web preferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences), [session permission handling](https://www.electronjs.org/docs/latest/api/session).

Actual popups are denied. A trusted same-origin HTML popup target that exists in the manifest instead navigates the existing window, preserving the Playground's sessionStorage handoff. The single-instance lock focuses the existing window and ignores incoming file/URL arguments. On macOS, activating the app recreates a closed window with the same persistent session. No startup clears user data. [Electron navigation events](https://www.electronjs.org/docs/latest/api/web-contents#navigation-events), [app lifecycle and paths](https://www.electronjs.org/docs/latest/api/app).

Exports are limited to JSON or ZIP blobs created by this app window, with matching MIME/extension, a browser user gesture and a 128 MiB bound. Electron's normal save dialog chooses the destination; this shell never assigns a silent save path. Only one download is active at a time. Cancellation writes no replacement game state; an interrupted download displays an error. Native Edit menu commands support normal copy/paste, and View offers native fullscreen and zoom. [Electron DownloadItem API](https://www.electronjs.org/docs/latest/api/download-item).

## Verification limits

The pure tests run with Node and do not import Electron. They cover origin/path validation, persistence-path stability, export policy, marker consistency, checksums, MIME/CSP, range requests, symlink denial, candidate isolation and fuse verification failure. Dependency auditing includes the isolated development tools. These checks do not establish physical-device operation, signing, notarization, Steam integration or installability on every supported operating system.

The Web Locks specification exposes `navigator.locks` in secure contexts. Electron's public custom-scheme documentation does not explicitly guarantee Web Locks for every privileged custom origin. This design is intended to provide the required secure, non-opaque origin, but a real Electron run must demonstrate lock acquisition and IndexedDB persistence. Do not replace the game's writer-lock checks with an assumption based only on the main-process single-instance lock. [Web Locks specification](https://w3c.github.io/web-locks/).

Native review must also confirm local file imports, JSON/pack/replay exports, save cancellation, a full async backup export that may outlive transient activation, keyboard/touchpad/controller input, same-window Playground preview, restart persistence and native fullscreen. Downloads must be tested through visible controls; no `webContents.executeJavaScript`, injected storage or exposed debug globals are needed. No claim of those runtime outcomes follows from unit tests alone.
