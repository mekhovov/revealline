# v039 earned-picture storage investigation

The exported receipt resolves successfully against the exact frozen Fracture original's metadata. No identity alias or changed owner is needed. The root's later visible UI observations show absent installed pack records and an empty managed media library. The cause of the missing durable records is not yet proved.

## Observed evidence

- The native player-library export retains the earned Split Ring record and still pin with the same base owner `fracture-lines-fpv/1/8f79476cc9cf6221`, level `fracture-lines-split-ring`, revision `1`, theme `fpv`.
- The bounded local check uses only the frozen `.rlmedia` JSON header and actual visible player-library export. The unchanged exact23b strict resolver returns that identity and resolves the archived picture. It did not decode or inspect image bodies, browser state, or storage.
- Root's UI game-data export refused with `Current and persisted installed packs differ.` The unchanged textarea after that refusal is a player-library export, not a game-data backup.
- Root's later UI installed-pack export is empty. The still workshop reports release-v0.39.0, zero retained image records, zero immutable revisions and saved generation zero. This is a UI observation of absent retained metadata, not a raw database or blob inspection.

## Source constraints

The Collection still path builds its identity catalog from freshly read retained owner metadata. An absent `mediaRecords/library` row becomes generation zero and empty owners; the existing owner-difference error can therefore report missing owner metadata as well as a mismatched owner. Completion uses the previously captured installed catalog, so a correct earned receipt can be recorded while later Collection resolution cannot find its retained owner.

The examined manager/pointer/installer paths use IndexedDB without a memory fallback. Their close methods only close/disable access; the installer verifies the committed media before publishing pointers and clears only its completed journal. It does not roll back committed media. The examined schema-upgrade paths create absent stores and do not delete databases or clear stores. This is a bounded source read, not a proof that no browser, other app path, or external process could remove data.

Successful title reload and explicit Continue also constrain chronology. `app.mjs` boot adopts `checkedChapters()` before it resolves a saved attempt. `findCampaignEntry()` searches adopted execution entries; its only synthetic fallback is dated challenges. A saved Fracture replay does not synthesize the installed chapter. The successful cold Continue therefore required the chapter to have been adopted at that boot; later emptiness does not demonstrate that the initial install was never retained.

## Primary browser references

The following sources were read on 2026-09-14. They describe browser behavior; they do not identify the native browser's exact revision, flags, private-mode state or eviction history.

- [Google: Persistent storage](https://web.dev/articles/persistent-storage) describes pressure eviction of IndexedDB and Cache API data, and an explicit persistence request whose grant is browser-controlled. The existing game does not request persistent storage.
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) describes best-effort defaults, pressure eviction, and persistent storage. Its normal origin-wide policy includes localStorage and can exempt active pages; it should not be used as proof of this observed partial survival.
- [Chromium quota defaults](https://raw.githubusercontent.com/chromium/chromium/main/storage/browser/quota/quota_features.cc) set the desired free reserve to 2 GiB/10% and the stricter reserve to 1 GiB/1%, with embedder-customizable parameters. [Settings calculation](https://raw.githubusercontent.com/chromium/chromium/main/storage/browser/quota/quota_settings.cc) takes the smaller fixed/ratio value for each reserve.
- [Chromium evictor](https://raw.githubusercontent.com/chromium/chromium/main/storage/browser/quota/quota_temporary_storage_evictor.cc) derives a shortage from desired reserve minus free space. It suppresses that shortage if total temporary usage is less than half the shortage; a low `df` reading alone does not prove eviction.
- [Chromium quota manager](https://raw.githubusercontent.com/chromium/chromium/main/storage/browser/quota/quota_manager_impl.cc) invokes all quota clients during bucket eviction. [Client types](https://raw.githubusercontent.com/chromium/chromium/main/storage/browser/quota/quota_client_type.h) include IndexedDB, service-worker caches and service workers, without a localStorage entry. That path is consistent with IndexedDB/cache loss while a localStorage receipt survives, but does not establish that it ran here.
- The same current quota-manager implementation can report storage quota as usage plus 10 GiB through its static reporting path. `navigator.storage.estimate()` must not be represented as actual host free space or a guarantee against pressure eviction.

## Held boundary

No runtime, validator, media metadata, frozen artifact or release tag was edited. Moving Edges remains paused. Root owns disk recovery and a native exact-chapter redownload/reload/Collection recovery experiment. A later missing-original recovery message or explicit persistent-storage preference would be a separately reviewed UX change, not proof of the cause or permission to accept a foreign receipt. Keep v039 native qualification on hold until the retention/recovery evidence is reviewed.
