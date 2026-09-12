# Native distribution maintainer guide

This workflow wraps a reviewed web release. It does not publish the game, sign an app, upload a build, or grant a native build access to an existing browser profile. See [native compatibility](native-compatibility.md) for the code-level integration boundaries and official platform references.

The staging command and isolated platform packages are implemented for v0.3.0. The evidence table separates tested staging behavior from native application execution; a generated app directory alone does not establish that the game has launched successfully.

## Release matrix

| Target        | Reviewed inputs/toolchain                                                                                     | Local output                                                            | Remaining distribution gate                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser       | `releases/v0.3.0/site`, its manifest, release metadata and saved source revision                              | Existing versioned static site and distribution ZIP                     | Hosting/publication is a separate action.                                                                                                             |
| macOS desktop | Complete staged site, Electron `44.3.0`, `@electron/packager` `20.3.0`, isolated Node `22.22.2`               | Unsigned local macOS application, built by the isolated desktop package | Native launch/file-transfer/storage checks; Developer ID signing and notarization if distributing outside a local test environment.                   |
| iOS           | Complete staged site, Capacitor core/CLI/iOS `8.5.2`, isolated Node `22.22.2`; Xcode `26+` on a supported Mac | Generated Capacitor native project; Xcode is required to build/run it   | No Xcode is available in the current environment. Simulator/device execution, chosen bundle identity, signing and provisioning remain external gates. |

The iOS plugins currently pinned by the isolated package are App `8.1.1`, Filesystem `8.1.3` and Share `8.0.1`, with esbuild `0.28.2` for the local bridge bundle. These do not imply that every native feature has passed a device test. The game uses WebKit features introduced in iOS 15.4; the native project sets that deployment floor. Verify packaged-origin diagnostics rather than assuming Capacitor's minimum OS guarantees game compatibility.

## Preserve the release and stage a complete tree

Run commands from the repository root. Choose the versioned release you intend to wrap; do not silently substitute current working-tree game files for that site's assets.

First install the isolated iOS dependencies and build its bridge using the commands below. Then stage:

```sh
node scripts/native-cli.mjs stage --platform desktop --site releases/v0.3.0/site --out platforms/desktop/site
node scripts/native-cli.mjs stage --platform ios --site releases/v0.3.0/site --out platforms/ios/www --bridge platforms/ios/bridge/dist/bridge.mjs --diagnostics platforms/ios/diagnostics
node scripts/native-cli.mjs verify --site platforms/desktop/site
node scripts/native-cli.mjs verify --site platforms/ios/www
```

These release paths apply once the v0.3.0 release is frozen. During this change, the separately generated candidate is `.cache/native-web-v0.3.0`; explicitly substitute that path for `--site` when validating the candidate. Historical v0.2.1 does not contain the native export/lifecycle adapter and must not be presented as the current native-aware build.

The first stage requires a new output directory. Add `--replace` only when updating an unchanged, previously verified stage for the same platform. Unknown, modified or augmented output is refused; preserve it and choose a new directory instead of deleting it to force the command through.

The staged root must retain both `game/` and `authoring/motion-lab/`, plus the release's public pages and notices. The app starts at `/game/index.html`; relative JSON, modules, body artwork, nested pages and the Playground iframe depend on this layout. Do not stage just `site/game` or flatten its files.

The staging trust boundary is a reviewed first-party generated site. Its manifest hashes detect changed or missing bytes; they do not authenticate an unknown publisher who supplies both files and hashes. Staging verifies every declared asset, rejects traversal, symbolic links and unowned destinations, and checks size bounds before reading asset data. Limits are 1,024 inventory entries, 64 MiB per asset and 128 MiB total, with a 1 MiB manifest. Unlisted source files are not copied. Existing native stages must contain exactly their declared inventory plus the manifest and native marker.

Desktop staging preserves source asset and manifest bytes. iOS additionally inventories the locally bundled `native/bridge.mjs` (at most 1 MiB) and exactly four diagnostic files: `diagnostics/index.html`, `page.js`, `probe.mjs`, and `style.css` (each at most 128 KiB). The plain `.js` bootstrap can report a failed `.mjs` import instead of failing before its status UI starts. These files are first-party native additions, not downloaded application code.

Each iOS HTML page also receives an early Content Security Policy meta element, including the game, Playground, couch mode, replay theater, public pages and diagnostics. The policy comes from the web host's `PUBLIC_SECURITY_HEADERS`, excluding `frame-ancestors` because browsers do not enforce that directive in a meta element. It permits local scripts and connections, embedded image data/blob URLs, existing inline styles and same-origin frames; it does not permit `unsafe-eval`. The policy is placed immediately after the explicit `<head>`, before scripts. A compatible stricter existing policy is preserved and moved to that position once; duplicate, incompatible or structurally ambiguous policies fail staging. This transformation is idempotent and changes only copied iOS HTML, whose new hashes enter the native manifest. WKWebView does not obtain this protection from the web distribution's `_headers` file.

`.revealline-native.json` records both the original manifest hash and resulting native manifest hash, version, entry and fixed platform origin. The output is assembled and verified in a temporary directory before an owned output is replaced. Keep the original release directory and source archive untouched; the iOS manifest has a distinct identity because it includes additional files and transformed HTML.

## Use the isolated native toolchain

The root game's Node and npm dependencies are independent of native wrappers. With mise installed, run a pinned Node version per command instead of changing a global default:

```sh
mise exec node@22.22.2 -- node --version
mise exec node@22.22.2 -- npm --prefix platforms/desktop ci
mise exec node@22.22.2 -- npm --prefix platforms/ios ci --ignore-scripts
```

Each platform owns its `package.json` and lockfile. `npm ci` installs those reviewed locks; do not run `npm install` at the repository root to repair a native tool mismatch. If using another version manager, select the same Node version and confirm `node --version` before running the equivalent platform commands.

The desktop package exposes these commands:

```sh
mise exec node@22.22.2 -- npm --prefix platforms/desktop test
mise exec node@22.22.2 -- npm --prefix platforms/desktop start
mise exec node@22.22.2 -- npm --prefix platforms/desktop run package
```

`start` opens the staged local site. `package` verifies the stage and matching package version, then builds for the current host OS/architecture with pinned Electron Packager. It writes a new versioned output under `platforms/desktop/out/` and a package report; it refuses an existing version output. See the [desktop package guide](../platforms/desktop/README.md) for the exact artifact layout. For isolated manual testing, set `REVEALLINE_USER_DATA_DIR` to a chosen absolute temporary directory; omit it for the normal stable `RevealLine` app-data location.

The desktop origin is `revealline://app` with persistent session `persist:revealline`. Do not improvise a remote development server to make it load. Main-process navigation and file handling must retain the reviewed scheme/host restrictions and renderer isolation.

For iOS, build the local bridge before the staging step above, then copy/sync the staged result:

```sh
mise exec node@22.22.2 -- npm --prefix platforms/ios run bridge:build
mise exec node@22.22.2 -- npm --prefix platforms/ios test
# Run the iOS staging command above before native:sync.
mise exec node@22.22.2 -- npm --prefix platforms/ios run native:sync
mise exec node@22.22.2 -- npm --prefix platforms/ios run doctor
mise exec node@22.22.2 -- npm --prefix platforms/ios run native:open
```

The generated project already exists at `platforms/ios/native/App/App.xcodeproj`; do not run `native:add` again. That command is only for creating a missing scaffold. After staging later web changes, use `native:copy` for web assets or `native:sync` when native dependencies/configuration also changed. `doctor` reports configuration, dependency, staged-file and Xcode availability separately. Do not interpret a valid JSON config as a successful simulator build. The current app ID is a local playtest identity; choose an identifier belonging to the eventual publisher before provisioning or store submission.

Keep `capacitor://localhost` stable. `webDir` remains `www`, the native project lives under `platforms/ios/native`, and the start path remains `/game/index.html`. A production `server.url` pointing at localhost on the development computer would defeat the bundled-offline build and must not replace this setup.

## Move a collection between browser and native builds

Each browser origin and native wrapper has its own storage. A browser's development profile, a hosted release profile, the Electron origin and the Capacitor origin do not merge automatically. Development uses the `dev` channel. Generated releases use `release-${buildVersion}`, including `release-v0.3.0`; native stages keep that same release channel within their separate origins. There is no automatic cross-version migration and no special shared native profile channel. Updating from v0.2.1 to v0.3.0 therefore leaves the older release's records intact and uses a full backup to transfer the desired collection forward.

1. In the source game, pause an unfinished mission if it should be included. Open **Library & saves** and export a **complete backup**, containing the player library, installed packs and the recoverable suspended attempt.
2. Keep that original file. For native Save/Share, distinguish the OS operation from the game merely preparing JSON. Cancelled or failed export is not a backup; retain the JSON text fallback where available.
3. In the destination, install/start the intended build and open its import UI. Import the full backup and wait for validation and the coordinated storage operation to finish. It checks image data, campaign identities and replay recoverability before adoption.
4. Verify a known completed picture, score and installed campaign. Load the saved flight explicitly and confirm that it remains paused until Resume. Export a new destination backup after successful migration.

A profile-only file does not carry image packs or the unfinished flight. If a picture's pack is absent, its record can remain in the collection while the image is unavailable. Use the complete backup for device/origin transfer whenever its contents fit the documented budgets.

Import is an explicit replacement, not a merge of two devices' independent play histories. The UI may offer Undo only when it formed a verified snapshot of the prior adopted state. If prior stored data was corrupt/unreadable, a valid incoming backup can repair it, but the empty fallback must not be advertised as the old collection. Keep external backups even when Undo is available.

## Update and rollback without losing player data

Before changing a native package, export the current collection. Record the source release version/revision, native dependency lock and staged build identity together. Update the existing app with the same origin, persistent session and bundle identity; do not clear its data directory. A rebuild of the same release keeps its channel. A newer content release selects a new versioned channel; import the retained full backup there explicitly.

For rollback, reinstall or restage the previously retained app/release without deleting its storage. An older runtime may reject newer profile, pack or replay formats; do not force-load or edit version tags to bypass validation. Keep the pre-update backup for the old runtime and retain the newer backup for returning to the newer build. If local storage recovery is incomplete, leave the journal/raw data in place, free storage if required, and follow the game's recovery message before another import.

Removing an app, clearing its website data or changing its native origin is not a safe rollback mechanism. Browser cache preparation and native application packaging also do not create a backup of player records.

## Signing and distribution are separate gates

An unsigned local macOS `.app` is a development artifact. It is not notarized, an App Store build or a Steam release. Signing/notarization requires the publisher's chosen identity and Apple credentials; a successful packager command does not satisfy that gate. Keep signing secrets out of the repository and renderer. Do not remove operating-system protections as a substitute for a correctly signed distribution.

Compiling the generated iOS project and running a simulator require Xcode. Device installation adds a valid signing/provisioning choice; TestFlight/App Store distribution adds the publisher's account, app record and submission requirements. None of those account or publication actions are performed by the staging command. The current environment lacks Xcode, so this iteration can prepare and check the scaffold but cannot honestly claim an iPhone installation.

Use only the capabilities the wrapper implements: bundled local code, chosen file import/export and interruption handling. If plugins access APIs covered by Apple privacy-manifest requirements, maintain the entries for those installed APIs. Revisit the generated web privacy text when a wrapper introduces native persistence or sharing; do not claim server sync, analytics or authenticated scores that the game does not implement.

## Evidence to record per native build

| Check                                                                       | Current evidence                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input-site integrity and staging refusal cases                              | 16 Node tests pass: exact desktop bytes, source preservation, iOS bridge/diagnostics/CSP identity, early/idempotent policy, conflicting-policy preservation, bounded reads, traversal/symlinks, corruption, owned replacement and CLI errors. An actual candidate stage verified 99 files and early CSP in all eight HTML pages.               |
| Shared host adapter                                                         | 7 Node tests pass for exact native origins, awaited export cancellation/failure, compact transfer bounds, filename rejection, inactivity routing and bundled-offline behavior. These are injected-host tests, not native execution.                                                                                                            |
| Electron protocol/path/navigation policy                                    | Desktop agent reports 21 Node tests passing across policy, resource, packaging and fuse checks; its isolated dependency audit reported zero vulnerabilities. These checks do not establish visible UI operation.                                                                                                                               |
| macOS app launch and complete asset load                                    | Desktop agent built the unsigned/ad-hoc-only macOS arm64 candidate at `platforms/desktop/out/v0.3.0-candidate-01/Reveal Line-darwin-arm64/Reveal Line.app` and revalidated its 94-file site. The Electron process launched; visible UI and storage/file-transfer verification remain pending because OS screen/control access was unavailable. |
| Save/cancel/import, collection persistence, pause/audio/controller behavior | Pending native UI/device checks.                                                                                                                                                                                                                                                                                                               |
| Capacitor configuration and isolated diagnostics                            | Native project generation and SPM sync completed; iOS agent reports 16 Node tests and plist checks passing. `.mjs` MIME, Web Locks, IndexedDB, sharing and lifecycle still require WKWebView execution.                                                                                                                                        |
| Xcode build, simulator and physical iPhone                                  | Not performed; Xcode is unavailable here.                                                                                                                                                                                                                                                                                                      |
| Signing, notarization, TestFlight, App Store or Steam publication           | Not performed.                                                                                                                                                                                                                                                                                                                                 |

Replace only the relevant pending rows with measured results and artifact paths when they exist. Keep the distinction between unit tests, a packaged directory, a launched application and a signed/public distribution.
