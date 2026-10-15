# Remove one saved regional version

A Library card now defaults to **Remove this version**. Confirmation names the exact descriptor revision and its scenery size. **Remove all versions** remains a distinct action when several versions are saved, with its own explicit count and total-size confirmation. Saved places are retained in their separate database; a removed version must be downloaded again before starting a new flight from that version.

The regional delivery wrapper uses the existing `world-store.removeRevision` atomic transaction. Confirmation binds the exact descriptor SHA and reviewed storage generation. Concurrent installation/removal invalidates that review. Removing the active pointer does not select a different revision implicitly: retained cards continue to load their explicit SHA. There are no physics, arming, renderer, default pins, data-schema, module-count or budget changes.

An already-loaded regional configuration owns its verified source bytes in a private map. Removing its saved download does not tear down that configuration or its current flight. The menu still controls flight lifetime; this change introduces no resume/arm callback.

## Verification

- `node authoring/fpv-worlds/regions/verify-revision-removal.mjs`: production install/load/removal APIs, actual 38-file immutable Urban fixture, a separate in-memory IndexedDB instance. Covers stale generation rejection; active/inactive version removal; exact retained-version loading; saved-place preservation; an already-loaded source fetch after removal; and separately guarded all-version removal.
- Existing 12 world-content/storage regressions and progress-aware Library deadline checks pass.
- Scoped ESLint and diff checks pass.
- The manual `revision-removal-check.html` runs the same scenario against new UUID-named native IndexedDB databases only. It never opens production player databases. These tiny test databases remain closed and retained after the check.
- `library-ui-check.html` adds exact-version versus all-version confirmation, retained-card reachability, navigation dismissal and stale-review failure to the existing asynchronous launch/commit/deadline fixture. Native review is pending at publication; no browser, packaged offline or hardware-controller qualification is claimed here.
