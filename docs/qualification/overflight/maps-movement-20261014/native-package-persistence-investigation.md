# Imported mission missing after an offline update — unresolved

14 October 2026. This is a read-only source diagnosis, not a persistence pass. No browser storage was inspected or changed, and no runtime fix is proposed without a reproducible cause.

## Observed failure

On `http://127.0.0.1:8936`, installed Survivor package `784aaf99b3089951` launched at its explicit community URL before the authentic `3bb1b0dc6 → 4dab801d9` update. With origin resources returning 503 it reached 17 gameplay seconds and an earned draft. After the updater reported **Update verified and selected**, the same explicit URL reported that the package was not installed in the profile. This remains an unresolved observed failure.

Reimporting the same exported package after the update produces the same compiled identity `12c9251df37ee67e` and installed identity `784aaf99b3089951`; Install and play now reaches the correct Survivor briefing. This confirms the separate operation-routing fix and content identity compatibility. It does **not** establish that the original installation survived.

## What the source establishes

- **Persistent storage, no session fallback.** [`profile-storage.mjs`](../../../../game/profile-storage.mjs) opens IndexedDB database `revealline-journey-v1`, version 1, object store `profiles`. Survivor's exact key is `revealline-overflight-library.v1` in [`community.mjs`](../../../../game/overflight/community.mjs). It does not incorporate build ID, release version, URL path or selected operation. Riy and Raid deliberately have separate library keys, but an explicit Survivor URL selects Survivor's library.
- **Installation commits before navigation.** [`native-project-library.mjs`](../../../../game/community/native-project-library.mjs) awaits a read/write transaction; `profile-storage.mjs` resolves it on `tx.oncomplete`. Studio awaits installation before assigning the destination URL. Closing the Studio calls `library.dispose()` and `drafts.close()`, which only close database connections. It does not remove the package.
- **The error is specific.** Library `load()` first reads and validates the library, then emits the missing-package message when that valid library lacks the requested identity. An invalid schema, changed package identity or failed database operation would produce a different error. A missing record is represented by an empty library on read, without implicitly writing that empty state back.
- **A default Studio draft is not evidence of package loss.** Import, Apply source and Install and play do not persist the separate draft record. Only **Save draft** writes it. Without that action, reopening Studio with the default project is expected.
- **No updater database deletion path found.** [`installed-app.mjs`](../../../../game/installed-app.mjs) changes the installed-selection localStorage record after its migration/ownership checks. [`service-worker.template.js`](../../../../game/offline/service-worker.template.js) and [`app-worker.template.js`](../../../../game/offline/app-worker.template.js) remove only their own named Cache Storage generations. They do not delete IndexedDB. The qualification dispatcher keeps the browser origin fixed and does not inject a profile shim or redirect to the upstream port.

All ten audited persistence/update source files are byte-identical between the two tested commits. The [source hash inventory](native-package-persistence-source.json) records previous, candidate and current hashes separately. The current launcher-worker template has a later, separate edit; it is not silently treated as the previously tested generation.

| Key file | SHA-256 at both tested commits |
| --- | --- |
| `game/profile-database.mjs` | `6a843fc68c3d639ca6d3bac8c77228eccf21cd72a525872245bd5cbbd9d68a1c` |
| `game/profile-storage.mjs` | `7f0e6cc3a957ddc00a032d41e8bea782907b901f714708de5385667fe5fbbaec` |
| `game/community/native-project-library.mjs` | `c454eb37c5be2139f48b1d6d7a59f59b1910ec769838dbbab74d95109a335dc3` |
| `game/overflight/community.mjs` | `feb70c8fb50b64cd26eff23ee5b19eb120960c3cf4e79b7379bb39f5c44e625a` |

## Limits and next verification

Source inspection rules out an intended version migration, an in-memory installation fallback and deletion on ordinary tab closure. It does not distinguish an external browser/profile storage boundary, eviction, an explicit removal elsewhere, or another unobserved event. None is claimed as the cause. The code's “profile” wording does not itself establish which browser storage context was used.

Retain this failure and test the reinstalled package through the next authentic update:

1. On the same browser surface and exact `127.0.0.1:8936` origin, verify the installed mission through normal mission selection and a fresh explicit community navigation before updating. Record the full URL and selected operation.
2. Perform the ordinary production update, then repeat both paths without importing or installing the package again.
3. Repeat the explicit launch with origin resources unavailable. Keep the same package identity and source-generation evidence.
4. If the missing installation reproduces, preserve the state and narrow the storage-context/transaction cause before proposing a fix. If it does not reproduce, report that later update as passing its bounded check while keeping this earlier observation unresolved.

The later routing pass and a future successful update must not be used to relabel this original persistence failure as passed.
