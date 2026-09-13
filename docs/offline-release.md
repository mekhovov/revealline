# Installable browser release and offline play

A packaged release can save its complete game files for offline play. Preparation is an explicit player action. The development page never registers a worker or caches its changing source files.

Build with `npm run build`, serve `dist` over HTTPS or localhost, and use the game's **Prepare offline play** control. Preparation downloads and verifies every shipped runtime file before the worker can activate. The control reports the saved file count and bytes. **Check offline files** verifies cached bytes without a network request. If storage was evicted or a file is corrupt, reconnect and prepare again to repair that same version.

A browser may offer its own install command or Add to Home Screen action after reading the generated manifest. The install prompt, storage retention, standalone window behavior and audio/input permissions belong to the browser. A manifest and automated checks do not establish physical iPhone, Safari or every Android device compatibility. The game remains usable in a normal browser tab.

## Build outputs and scope

The CLI adds these files to a distribution:

- `manifest.webmanifest`: local app identity, `./game/` start URL, `./` scope, standalone display and original icons.
- `icons/icon.svg` plus 180, 192 and 512 px PNG icons. A small original territory/cut emblem is drawn using fixed integer geometry; no source artwork or third-party photograph is modified.
- `service-worker.js`: generated worker with an embedded, SHA256-checked inventory.
- `offline-cache.json`: inspectable inventory containing the version, content-derived build identity, paths, byte lengths and hashes.
- Manifest, Apple touch icon and offline configuration tags inserted into the copied game HTML, including the playground. Source HTML is not edited by the build.

The scope is the **distribution directory**. For `/releases/v0.2.0/site/game/`, the worker lives at `/releases/v0.2.0/site/service-worker.js` and controls only `/releases/v0.2.0/site/`. This includes the sibling `authoring/motion-lab` runtime modules and assets that the game ships. It does not intercept another release, the source game, a remote origin or an unknown URL. Only GET requests for inventory entries use its cache. The query string does not alter static-file identity; nested directory navigations map to their included `index.html`.

The ZIP, source archive, distribution checksum manifest, hosting `_headers`, offline inventory and worker script itself are not precached game dependencies. Browsers retain the registered worker through their own service-worker mechanism. The full game resource set, vendored engine, content, images, audio code, HTML and manifests are in the precache. Player-imported packs and saves remain owned by the separate library storage; the worker does not upload, delete or back them up.

The builder caps the offline resource inventory at 2,000 files and 64 MiB. Bigger optional libraries belong in separately installed packs. This limit is a distribution budget, not a guarantee that every browser grants that much persistent storage.

## Public root and immutable editions

The [P7.7 entry correction](boot-launch.md#immutable-public-entry--p77) makes public root HTML an alias into a complete immutable edition. Prepare offline play at that canonical versioned address, not an assumed mutable-root runtime. The standalone ZIP still has its own distribution-scoped worker and offline inventory.

**Current blocker — v0.29.2 / P7.7.** Frozen v0.29.1 passed 2,364 tests and independent artifact checks, but an ordinary first Down cut in First Light R4 threw `Classic event horizon bound exceeded` after capture, before the HUD/paint update. The failure reproduced in a separate stopped-server browser. Startup and saved-flight restoration succeeded; the complete offline play journey did **not** pass. Preserve v0.29.1 and its failure evidence. The bounded simulation correction and new candidate/browser/public gates are [in progress](verification/round-39/v0292-capture.md); no later roadmap phase advances.

A successful Node fetch/hash audit does not prove which bytes a browser worker serves, and a complete offline inventory does not prove the simulation can finish an ordinary capture.

The mutable-root retirement worker is a delivery exception, not a new game cache. It handles only its finite root HTML entries, excludes `/releases/`, and unregisters itself on normal activation. It neither accesses/deletes caches or profile/IDB nor calls `skipWaiting`, takes over clients or navigates active games. Existing root tabs may need a normal close/reopen before retirement; the explicit immutable permalink remains available. Fresh preparation at the canonical scope is a separate player action. Do not clear site data or discard a saved run as an update strategy.

## Integrity and update policy

The worker fetches and checks all resource bytes before writing a new content-addressed cache. A completed marker is written last. A failed download, redirect, mismatched hash or failed cache write prevents that worker from activating. A failed new version does not delete the old version's cache. The app also exposes a worker message that recomputes all saved hashes, so a successful registration is not mistaken for a successful complete download.

No worker calls `skipWaiting`. A new worker waits while existing pages still use the previous worker. The UI reports a saved waiting update and tells the player to close that version's tabs; it does not reload an active game or replace its code. Once activation is allowed, cleanup only removes caches belonging to this exact distribution scope. Other release caches and other applications remain untouched.

Resources use cache-first delivery after successful preparation. If a saved file is absent, a network response may repair it only if it matches the expected bytes. A changed server file is rejected with 503 instead of mixing a different release's code with a running game. Publish immutable release directories and retain their files. For an update, prefer a new version directory and link to it from the release index.

Offline preparation does not request persistent-storage permission, install a native binary or promise permanent retention. Browsers and users can clear cached files. Keep portable save backups for progress that matters.

## Shell integration

`game/offline.mjs` has no automatic registration side effects:

```js
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';

const availability = offlineAvailability();
prepareButton.disabled = !availability.available;
prepareButton.onclick = async () => {
  await prepareOffline({ onStatus: showOfflineStatus });
};
checkButton.onclick = async () => {
  await checkOffline({ onStatus: showOfflineStatus });
};
```

Handle rejected promises visibly and pause gameplay before opening settings. `onStatus` receives an object with `status` and, where appropriate, `message`, `version`, `buildId`, `count`, `verified`, `bytes`, `missing` and `corrupt`. Preparation returns `ready` or `waiting`; verification can return `ready`, `not-ready` or `error`. Availability provides an explanation for a source page or unsupported/insecure browser. Never invoke preparation merely because the module loaded.

The checker talks to the exact scope's active/waiting worker through a MessageChannel. The worker accepts only the two known messages from a client within its scope. Checking does not install or fetch; explicit preparation may download or repair missing files.

## Release verification

Run `node --test game/test/offline.test.mjs scripts/test-game-cli.mjs`, then `npm run build`. The tests cover nested paths, inclusion of sibling runtime assets, full hash verification, failed installs, scope-limited cleanup, cache eviction and repair, changed-file rejection, explicit user preparation, source opt-out and reproducible ZIPs. The build tests inspect actual generated PNG dimensions and every inventory checksum.

A real browser release check should:

1. On public hosting, verify fresh and previously cached root entries reach the immutable graph with query/fragment and saved data retained. Do not force worker activation or purge caches. Then open that built release online and prepare offline play through its visible control.
2. Run the visible file checker and record a complete verified inventory.
3. Close and reopen the release without connectivity. Confirm entry page, campaign, images, a completed ordinary cut with refreshed HUD/paint and continued flight, gallery and local packs/saves; retain console failures.
4. Check the built playground at its nested path as well as the main game.
5. Open a second release and confirm each scope retains its own inventory. A pending update must not replace the current active game.
6. Repeat installation and launch on physical target devices before claiming those devices are certified.

Primary design references: [MDN service-worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [MDN install waitUntil](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil), and [Google's web app manifest guide](https://web.dev/learn/pwa/web-app-manifest). The explicit preparation control, immutable version directories and byte-verifying self-check are this project's implementation choices.
