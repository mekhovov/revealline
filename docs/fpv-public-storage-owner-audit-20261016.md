# Public SIM storage negative — read-only owner and namespace audit

Scope: source/API/HTTP and a separate memory-only test fixture. No browser, renderer, native player database, player storage write, removal, reconnect patch, budget change or new runtime code was used. Existing per-offer public reports and all native evidence remain unchanged.

## Observations and interpretation

The public main deployment marker still identifies `b11745223861c3973ad4bf440cc536198b8e0371` (`main-b11745223861`); main-deployment.json and release.json are identical, SHA256 `bbc7f8cf91e076c977b3c064e98fa31be57104953e908a73a6244002015f0aec`.

Root's real native school sequence produced a paused HUD with the browser's “The database connection is closing” transaction error. The original caught exception, database object, database name and closer stack were not captured; the caught error is routed to the HUD and the ordinary console snapshot is empty. This is an actual failure, not explained by the separate region byte-cap refusal.

Root later reopened the public SIM, saw zero Saved/Fly regional cards, zero installed World-pack cards, and used Refresh saved regions without a visible error. The later snapshot shows all 23 offered regional downloads and all 20 World-pack offers as downloads. This reopens public retention qualification. Earlier actual reopen retention of 13 regions plus 20 packs remains historical positive evidence only. These observations do not prove deletion, eviction or a browser-profile change: the native IndexedDB database identity and contents were not observed.

## Fixed database identities

All names below are origin-wide strings in the delivered module sources; the WorldApp defaults do not derive them from URL path, release, Journey profile, company, flight mode, locale, input type or `game-return`.

| Channel | Exact database | Requested version | Owner/access |
|---|---|---:|---|
| World packs | `revealline-fpv-worlds-v1` | 2 | `openWorldStore` called once by WorldApp ready |
| Regional scenery | `revealline-fpv-regions-v1` | 2 | `openRegionalLibrary`, wrapping the same WorldStore implementation |
| World recordings and recovery session | `revealline.fpv.world-records.v1` | 1 | `openWorldRecords` called once by WorldApp ready |
| Saved regional places | `revealline-fpv-regional-locations-v1` | 1 | Regional-locations owner, separate from scenery and recordings |
| Legacy notebook / shared progression sidecars | `revealline-journey-v1` | 1 | Independent notebook/profile connections, not a World-pack namespace |

WorldStore's v2 upgrade only creates absent stores (`projects`, `assets`, `meta`, `revisions`); no drop/clear/migration into another database was found. Both active pointers and retained revisions are read by `list({includeRevisions:true})`; regional metadata mapping does not filter by current catalogue or label. Unknown retained regional revisions are still rendered as saved cards. Thus the label-consistency change does not intentionally hide old downloaded revisions.

A successful regional refresh assigns the result of that database's `list({includeRevisions:true})` to the card records; list uses native getAll on projects/revisions. A failed refresh does not silently replace existing records with an empty result: the catch presents an error and the previous records stay. This makes the later no-error zero-card state meaningful, but a UI snapshot alone cannot prove which native persistent storage context supplied the empty results.

WorldApp uses `win.indexedDB` directly. No app-selected replacement IndexedDB factory, fallback database name or memory-store fallback was found for those three primary World channels. WorldApp's settings, progress category selection and radio/input/mode changes do not set a different database name.

## Main-game entry and recovery tools

`game/fpv-entry.mjs` constructs the same-site SIM path and transfers `game-return`, language and cosmetic appearance context. The reviewed function has no database-name selection or IndexedDB factory replacement. Main game's release/company localStorage channels (`revealline.library.<channel>.v1`, corresponding packs/suspended keys) are distinct from the fixed SIM databases.

The Shared Settings “Stored profile recovery / Find profiles” reader is not a SIM IndexedDB inventory. It discovers recognized localStorage channel-key patterns through `channelFromStorageKey`; optionally it reads the separate `revealline-assets-v1` and managed-media database for a selected recognized channel. It neither enumerates nor opens the three primary SIM databases above. “No supported profile channels found” and preserved unrecognized world settings/locale/access keys therefore do not establish whether SIM IndexedDB still exists.

The shared-tools provider owns and closes only its own recovery/media/asset read handles; its close/dispose path does not receive the WorldStore or WorldRecords handles. Selecting a settings category does not replace the host's stores. This source audit found no shared-tools path that deletes or changes the fixed SIM database names.

Read-only public core samples bound to the unchanged deployment marker:

| Module | Bytes | SHA256 |
|---|---:|---|
| game/fpv-entry.mjs | 8132 | 53b594e3440257a8212c714f1df17abef80bccd3a36672c53128cc90b79136c2 |
| game/profile-channel-reader.mjs | 20754 | a43683344458cf04cfddff649cb11221b474d473d4e7027300d7a0263bc104a1 |
| game/profile-channel.mjs | 4041 | d52b6442b09268c2057628b3ded1415677e6cc9287add4814ff2674e08d576be |
| game/ui/global-settings-tools.mjs | 13969 | bc70057303430de2998debb140bb303346e2a1e439ca70bad738fa968bb039bb |

## Closing-handle owner audit

WorldApp creates the WorldStore and WorldRecords once in ready. Mode changes start a new paused flight; input changes pause and select input; pausing saves a recovery session when applicable. These operations do not explicitly close a database. WorldModel flight disposal releases collision/physics resources only.

The explicit close paths found are whole-app disposal and the databases' `onversionchange` handlers. Whole-app disposal sets `disposed=true` before final recovery/store cleanup; reportError ignores a disposed host. A normal per-flight dispose alone therefore does not explain a closing DB error being shown by a live current host. A real versionchange or native backend close remains a possible mechanism, not observed cause. No IndexedDB deleteDatabase invocation was found in the surveyed World/core production modules.

The most direct transaction candidate in the observed school flow is `recordStore.saveSession` from pause/recovery saving. WorldApp's generic reportError retains only a message, does not retain the database identity/stack and can display an asynchronous rejection after another attempt has started. The same raw message could arise from another native transaction; the candidate is not a proven original stack. A closed handle remains captured by existing methods; no native close telemetry/reopen is present. A blind reconnect would conceal the unknown owner/context and was not implemented.

## Isolated source-only sequence

A memory-only fake IndexedDB plus stub-renderer host fixture used the genuine published “Acro: the tilt stays” demo (654 input frames, display rate 0.5). It reached Demonstration complete, Try it yourself, explicit Let's fly, Pause, Self-level, Acro and Touch changes, then clicked the normal pause Resume control and sent a simulated resize. The fixture stayed disarmed after that Resume. There were no close calls or thrown native-transaction analogues before explicit host disposal. Deliberate disposal closed five isolated handles (region store, two Journey connections, World records and World packs).

This did NOT reproduce the native closing-database failure. It does not model the native storage backend, actual browser layout/resize scheduling, GPU, main-game navigation or fully mounted core shared-tools provider, and its Resume state differs from the live observation. It provides a bounded negative source experiment only, not a passing native reproduction or fix. Virtual frame stepping is not elapsed/performance evidence.

Original source-only receipt: `/Volumes/alex/CodexMigrationStaging/fpv-temp/public-school-closing-db-source-only-20261015.json`, SHA256 `ff0c164c1a058adeb178348d4f0b5fe64ad776d99a95df7685d6ec2268dfa081`.

## Minimal passive native follow-up, if an allowed surface exists

Preserve the original public context and captured negatives without reinstalling/removing/importing data or opening new writers. The first useful evidence is the same-context database name/version/object-store counts, not another unobserved calibration or flight repetition. The existing public authoring storage-continuity URL is 404, and hidden browser evaluation is not permitted. Codex/IAB app inspector access was refused; do not bypass it.

If an allowed native Chrome GUI diagnostics surface is available, use a separate explicitly labelled diagnostic profile and the same delivered modules. Install only tiny normal test packs in that separate profile, capture read-only Application/IndexedDB names and row counts, then run the sequence once with native Pause on caught exceptions and source breakpoints at the known explicit close/versionchange call sites. Stop at the first closing transaction and preserve its original call stack and owning DB name plus before/after metadata. No injected reconnect, forced GC, timing/gate changes or production code edits are required. That different browser/profile can reproduce a mechanism but cannot prove why the original IAB context became empty. If the allowed GUI cannot reveal the original context, retain that uncertainty rather than repeating for green.

No causal runtime patch is justified by the currently captured evidence. Closing-handle ownership, later native data visibility and stable public retention remain open P1/D6 gates. No data-loss, eviction, automatic scope switch, physical-device, offline/restart, full-duration or global completion claim is made.

## Native evidence retained separately

| File in public-sim-player-20261015 | Bytes | SHA256 |
|---|---:|---|
| public-school-closing-database-receipt.json | 987 | ccab20771141a70519bc97c30f21518739bb4d89a1f3624cbf79c078d4d9a760 |
| public-school-closing-database-negative.txt | 1612 | 1c86a460b588c9ab34c3cdadda9bc2e4cb47170c57028ceaa9d5b4eef3b26630 |
| public-school-closing-database-negative.png | 34639 | e5121ba4e032a835e8f09cabc37d1b1253fb27bc5e577c2c192f77596ca1db10 |
| public-school-closing-database-console.json | 2 | 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945 |
| public-library-after-main-reopen-refresh.txt | 18646 | 2fd09e6f7c9ad7556ab1fa981400a561155a78f302b583ade49773d3c234fe05 |

The early native receipt's `preservedStoredRegions:13` and `preservedWorldpacks:20` fields refer to the earlier observed state, not a fresh after-failure count. The later zero-card snapshot is a separate later negative and supersedes any claim of stable retention.
