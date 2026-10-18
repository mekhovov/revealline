# Build and distribute

The implemented distribution is a **static browser application**. The CLI produces local files; it does not provision a host, publish a site, create an App Store binary or upload a Steam build. Native wrappers now live under `platforms/`; their commands and evidence are in [native distribution](native-distribution.md).

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

## GitHub Pages

Source pull requests use [Validate source for continuous main](../.github/workflows/deploy-pages.yml).
Its preflight selects the exact-source validation and focused checks required by the current policy;
`release-ready` is the aggregate result. The temporary [fast-release mode](fast-release-mode.md)
defers the full artifact build and some extended checks. Deferred checks are not recorded as passing.
Pull-request admission and public deployment are separate workflows.

[Publish GitHub Pages from main](../.github/workflows/publish-main-pages.yml) publishes the rolling
`main` channel on every push to `main`, including merged pull requests. It builds the exact triggering
commit with Node 22.22.2 and locked dependencies, using the `main-pages` publication profile. The
semantic game version comes from `game/build-config.json`; deployment metadata additionally records
the full source SHA and `main-<first 12 SHA characters>`. Publishing a merged change does not require
a version bump, release tag, or change to the historical frozen-release selector.

The publisher stages the reviewed optional practice packages, checks the exact inventory against
the 980,000,000-byte Pages capacity guard, and verifies the uploaded Pages archive before deployment.
It then deploys through the main-only `github-pages` environment and verifies the public source
identity and selected practice dependencies. The repository Pages source must be **GitHub Actions**.
The workflow uses `GITHUB_TOKEN` and the deployment job's Pages and OIDC permissions; no additional
deployment secret is required.

After merging, follow the publisher for the resulting main SHA through its `build`, `deploy`, and
`verify` jobs. Confirm that [main-deployment.json](https://mekhovov.github.io/revealline/main-deployment.json)
and [game/build-info.json](https://mekhovov.github.io/revealline/game/build-info.json) identify that SHA,
then open the [public game](https://mekhovov.github.io/revealline/game/) for device testing. A deployment
or metadata check does not establish gameplay, saved-run ownership, offline behavior, or device
performance; retain those observations separately.

Publication uses the `pages-production` concurrency group with `cancel-in-progress: false`. An active
publication finishes before the newest pending run, so a new merge may queue behind an earlier build.
If a corrected publication needs an explicit run, select **Actions → Publish GitHub Pages from main →
Run workflow** and choose `main`; no release-tag input is used. This builds the selected current main
revision again. Ordinary merges already trigger publication, so they do not need a duplicate dispatch.

### Frozen releases and historical evidence

Immutable tagged distributions remain a separate archival process. Use the [versioning instructions](versioning.md)
to retain exact source, manifests and original distribution bytes, and keep qualification and device
evidence attached to that version. The public `/releases/` page links to [GitHub releases](https://github.com/mekhovov/revealline/releases)
for immutable downloads and release notes. Publishing or selecting a GitHub release does not select
the rolling Pages game.

The earlier [frozen controller contract](../publishing/pages-controller/README.md), its
[`publication.json`](../publishing/pages-controller/publication.json), and the
[FPV delivery record](../publishing/pages-controller/delivery/README.md) preserve historical routing
and acceptance evidence. Their frozen-publisher dispatch instructions describe the former deployment
path; they are not prerequisites for publishing current main. Preserve existing release tags and
accepted artifacts rather than rebuilding or relabeling them as the rolling deployment.

## Browser installation and offline use

Serving a static game does not by itself verify offline behavior or installation. Browser installation criteria vary; manifest metadata and HTTPS or loopback are relevant, while a service worker provides separately testable caching behavior. Browser and platform installation flows also differ. [MDN installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

Only claim PWA support for the manifest, icons, registration and cache behavior actually present in `game/` and tested in the current build. Test first visit, subsequent offline start, missing media, update activation and old-version coexistence. Source and release servers should use separate ports during comparison so origin-scoped storage and any service worker cannot silently cross between versions. No native iPhone installation or offline certification is established by the Node checks.

## Native mobile packaging

The isolated Capacitor 8.5.2 project is implemented in `platforms/ios/`, with a bundled App/Filesystem/Share adapter, explicit runtime diagnostics and an iOS 15.4 feature floor. Stage the complete reviewed release with `scripts/native-cli.mjs`, preserving relative game/artwork paths; then run the documented `native:sync` command. The generated SPM project is checked in. [Native workflow](native-distribution.md), [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow)

This machine has Command Line Tools but no full Xcode or simulator. Project generation, dependency resolution, property-list parsing and adapter tests are separate from a native compilation or an iPhone installation. Device storage, module MIME, sharing, safe areas and physical controls remain explicit target checks. [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)

## Desktop and Steam packaging

The isolated Electron 44.3.0 wrapper uses `@electron/packager` directly for a small local packaging workflow. Electron's general distribution guide recommends Forge for broader build/publish orchestration; it is not a dependency of this wrapper. A local unsigned macOS ARM64 candidate is built and retains its verified content inventory. [Native distribution](native-distribution.md), [Electron application packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution)

The renderer is sandboxed with Node integration disabled. A secure custom scheme serves verified local files, denies external navigation and limits file exports. Packaged security fuses are read back after modification. These checks do not establish native UI, persistence or Save-dialog behavior: OS automation permissions prevented that observation here. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)

Steam deployment follows a packaged desktop build: configure the application's launch options and depots, upload through the documented SteamPipe workflow, and test a private branch before a public release. This repository has no Steam app ID, depot credentials or Steamworks integration. The local macOS executable has not been uploaded or tested through Steam. A static ZIP is useful for web hosting and archival comparison; it is not a verified Steam package. [Steamworks uploading documentation](https://partner.steamgames.com/doc/sdk/uploading)

Official packaging pages were checked on **12 September 2026**. Consult each platform report for the distinction between packaged artifacts, static checks and actual device execution.
