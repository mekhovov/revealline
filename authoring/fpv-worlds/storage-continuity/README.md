# Real offline and browser-restart qualification

This authoring-only observer helps establish whether exact retained content survives
an independently observed offline/restart journey. It does not implement or simulate
that journey. It imports no simulator modules, creates no renderer and never creates,
upgrades, repairs, activates, deletes or writes a player database. Its shared appearance
bootstrap is a read-only first-paint seed; this observer does not acquire a theme-host
lease. Use a dedicated
review origin/profile, leaving the player's normal storage untouched.

## What the snapshot proves

Explicitly open `index.html` on the **same origin** as the qualified player. Pause
flight, close other tabs that can write its storage and choose **Read existing
review-origin storage**. Export the resulting JSON. The four fixed database names
cover regional active/retained revisions and actual Blob bytes, exact-revision saved
places, World packs and flight records/session data. A single readonly transaction
captures all stores within each existing database. Hashing follows transaction
completion. Database creation/upgrades are refused, including an enumeration/open
race. The receipt contains row-key hashes and value hashes, not raw saved content.

This is not a global transaction across databases. Do not run it while a flight,
installer, editor or another tab is saving. It hashes actual bytes and may be slow
on a large library; never run it during elapsed endurance or performance measurement.
It does not inspect CacheStorage, localStorage preferences, cookies, browser profile
files or other games. If database enumeration is unavailable, it fails explicitly
instead of trying names and creating empty databases.

Snapshots from different origins are refused. A matching empty origin is explicitly
reported as `anyExistingDatabase=false`, never as installed-content acceptance.
The comparator reports removed, changed and added rows separately. An intended new
recording or changed session can alter a receipt without data loss; inspect each
change. Any missing or changed retained source/Blob or saved place needs investigation.
All snapshot `qualification` fields remain `not-measured` even after equality.

## Native journey, after the active elapsed review ends

1. **Freeze the candidate.** Record the exact source, admitted package revision,
   archive/inventory hashes, immutable regional descriptors, review origin, operating
   system, browser version and profile. Serve the unchanged admitted package. Stage
   these four observer files alongside it without changing any package member, worker,
   cache manifest or launcher. Bind their separate hashes in the evidence receipt.
2. **Create data through the normal player.** Install two offered revisions of one
   region. Fly each deliberately, save a clearly named place and keep any genuine
   recording. Export the player's existing project/recording backups normally. Do not
   seed, corrupt, clear, delete or replace the review database to create a pass.
3. **Prepare offline through the normal UI.** Choose **Prepare simulator offline**
   or the packaged launcher's download-for-offline action; wait for its actual ready
   confirmation. Record the stable launcher URL and downloaded regional revision
   labels. An installed region alone does not include the simulator runtime.
4. **Capture baseline A.** Pause/exit flight, close other writers and export a
   read-only snapshot. Confirm that the expected region, retained revision and places
   stores are present and nonempty. Keep this file outside browser storage.
5. **Observe actual network isolation.** Use a supported native browser/context or
   dedicated device network control whose scope is independently known. Record its
   scope, time and a fresh uncached failed request outside the service-worker scope.
   Keep cache enabled. A stopped local server proves only that local origin failed;
   a mocked fetch, `navigator.onLine=false`, an intercepted URL or one target's offline
   toggle does not prove every browser context and worker is offline. If only a narrower
   scope is available, report exactly that scope and leave the broader gate open.
6. **Cold-launch the saved player while isolated.** Close the player tab, reopen the
   saved stable launcher and select each installed revision from its normal Library.
   Confirm disarmed preparation, deliberate Arm, actual movement for at least a minute,
   Pause, alternate start, view/mode change and a saved place. Attempt one uninstalled
   region: it must give usable unavailable/retry guidance while keeping both installed
   versions and recordings. Never clear data as recovery. Preserve native screenshots,
   text and the network-control observation; a source harness is not a substitute.
7. **Perform a genuine application restart.** End flight safely and fully quit the
   dedicated browser/application/profile, then reopen the same saved launcher with
   isolation still active. Capture the actual native quit/reopen observations and
   process/app identity. A tab reload, database connection reopen or a new tab is not
   application restart. Do not quit the coordinator's active test browser or disrupt
   an elapsed segment. Repeat cached preparation, deliberate Arm/Pause, saved place
   and both exact revision selections. Do not substitute copied profile data.
8. **Capture B and C, preserving evidence.** The authoring observer is deliberately
   absent from the package offline manifest. If it cannot load offline, keep all
   native offline observations first, restore networking without updating the frozen
   player and then take the readonly snapshot. Explain this timing limitation. Compare
   it with A, reviewing each added/changed session or recording rather than deleting
   it to force equality. An optional second snapshot after safe exit should match
   when no writer ran. Keep every failure as a separate receipt.
9. **Reconnection and repair.** Restore networking; retry the refused download and
   confirm explicit repair/retry retains existing revisions, dates and saved places.
   That is a separate transition from the offline pass. Do not deliberately damage
   normal records; isolated repair scenarios already cover modelled missing bytes.

Use normal controls and CUA for native browser actions. Keep one active renderer.
Neither this procedure nor the observer closes physical radio/controller, iPhone,
handheld, real quota exhaustion, cache eviction or two-hour endurance gates.

## Comparing exported receipts

Select the baseline file in the page after reading current storage, or run:

```text
node authoring/fpv-worlds/storage-continuity/compare.mjs BEFORE.json AFTER.json NEW_COMPARISON.json
```

The output must be new; existing evidence is never overwritten. A content hash binds the format, origin and database fingerprints against accidental
edits; observation timestamps and scope text are not part of that content hash. It
does not validate provenance or provide a trusted signature. An operator can manufacture JSON; bind actual native actions and
file hashes separately. Never infer real restart or offline acceptance from the tool.

The functional verifier uses isolated fake IndexedDB only:

```text
node authoring/fpv-worlds/storage-continuity/verify.mjs
```

Its seven groups cover non-creation, byte identity, same-size Blob corruption,
retained-row/place loss, wrong-origin/altered-receipt refusal, creation-race abort and
structured-clone type distinctions. They are not native persistence or offline evidence.
