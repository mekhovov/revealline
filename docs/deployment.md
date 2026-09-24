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

Source pull requests use `.github/workflows/deploy-pages.yml`. While the temporary
[fast-release mode](fast-release-mode.md) is active, one exact-source path performs release-critical
validation and the ordinary static build. Full tests, lint, formatting, native formatting, and
extended production checks are deferred from the pull-request workflow and do not block merge.
Manual source qualification still requires the bounded lint, formatting, syntax, production
reproduction/readiness, identity, validation, build and provenance gates before a release can be
frozen. Full suites remain waived and are not represented as passing. An already qualified
immutable release is published from its original ZIP; publication does not rerun today's test
sharder inside an older tag.

`release-ready` is the stable aggregate PR result. In fast mode it requires successful policy preflight
and the build. In restored full mode it also requires every test shard. Avoid configuring individual
matrix job names as required checks; the aggregate avoids stale required contexts when the matrix
changes.

The sole Pages publisher is `.github/workflows/publish-frozen-pages.yml`, running from `main`
through the existing main-only `github-pages` environment. Its reviewed
[`publication.json`](../publishing/pages-controller/publication.json) selects one exact frozen
version and its six-gate source qualification. It must be enabled and match the highest published,
non-draft, non-prerelease semantic version. Publishing a newer release never edits the selector or
moves an old tag. Commit the reviewed selection after freezing the release and verifying its
archive routes. The selector commit triggers publication; it preserves original file hashes and
keeps every immutable semantic release tag in `/releases/`. The root game and `/game/` always
point only to the newest published stable release; the explorer links historical tags to their
own archive sites so a tester can compare them without replacing the player default. Tags that
are still being prepared use explicitly reviewed `testingRoutes` and are never chosen as the
default game. See the [controller contract](../publishing/pages-controller/README.md) for byte
checks, capacity limits, and the distinction between the controller commit and the frozen game
source.

When publishing the newest intended stable release, explicitly set `make_latest: "true"`.
After publication, read `GET /repos/mekhovov/revealline/releases/latest` and confirm the
exact release ID and tag. GitHub's Latest pointer and the reviewed Pages selector are
separate: a correct Pages deployment does not prove the release badge is current. If
Latest is stale, reverify the existing release, immutable tag and all nine uploaded
asset descriptors, update only that release's `make_latest` field, and repeat the
readback. Preserve the initial attempt and original payloads. Drafts and prereleases
cannot be Latest. See [GitHub release updates](https://docs.github.com/en/rest/releases/releases#update-a-release).

Set the repository Pages source to **GitHub Actions** once. Both workflows use `GITHUB_TOKEN`; no
additional secret is required. Source checks and publication have separate concurrency groups,
and neither cancels a healthy deployment. The publisher rechecks the latest stable release before
assembly, artifact admission, and deployment, so an older request cannot roll Pages backward.

For a retry, select **Actions → Publish selected frozen game → Run workflow**, choose `main`, and
provide the exact selected tag as `release_tag`. The legacy **Build and deploy GitHub Pages** manual
entry on `main` accepts the same tag and dispatches that publisher after reading the current main
selector. Future release tags containing this routing workflow can request publication on the
`release.published` event. Historical tags keep their original workflow files: use the main dispatch
for them, rather than assuming a new controller exists inside an old release. GitHub resolves event
workflows from their associated commit or ref. [GitHub workflow events](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows)

Pull requests that change only the controller or its deployment instructions build a non-publishable
preview. Focused controller test suites are deferred in fast mode, while selector validation,
bounded extraction, artifact assembly, and an independent reread of every prepared byte remain
mandatory. Pull requests cannot upload a Pages artifact or enter deployment. A successful build is
not public acceptance: after deployment, verify the published bytes and test play, saved-run
ownership, historical entries, and offline coexistence in the actual browser.

Source test jobs keep the selected checkout in `source/` and obtain the shard utility from a
separate `automation/` checkout pinned to `github.workflow_sha`. The utility accepts `--root .`
from the source working directory, so discovery, imports, child processes and dependencies belong
to that selected source. Generated `.cache` state is initialized before tests; no immutable test
file is patched or replaced. Frozen publication continues to use accepted qualification and
original distribution bytes rather than scheduling historical source checks.

The [FPV redesign delivery record](../publishing/pages-controller/delivery/README.md) records final
public byte, play, offline and retained-entry evidence separately from immutable source qualification.
Changes confined to `publishing/pages-controller/delivery/**` retain pull-request preview checks but
do not republish Pages when merged. A commit that also changes the selector or another publishing
input still triggers the normal publisher.

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
