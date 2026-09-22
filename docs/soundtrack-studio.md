# Soundtrack Studio

Open **Settings → Audio → Music library & playlists** to play music and edit the versioned soundtrack library. It does not publish files to a server or change the simulation, scores or earned pictures.

## Player controls

Previous, Play music, Pause music, Next, seeking and the music fader call the public player API. Fresh libraries default to **90s Synth**; saved choices are retained. Under **Pick the music**, **Shuffle all music**, **Music style → Play this style**, and **Playback playlist → Play this playlist** save the full current draft and start the chosen music. Master mute remains independent; expand **Sound controls** to unmute it.

**Filters & custom mix → Save listening preferences** and **Offline album downloads → Save & use album** save and apply a selection while preserving intentional Pause. Automatic follows exact map, campaign, theme and global assignments. Metadata-only saves keep the current song and apply queue/assignment changes at a song boundary. The editing, offline, assignment and backup sections are collapsed until opened.

This edition includes **70 licensed recordings in 15 built-in albums**, alongside five procedural synth recipes and personal MP3 uploads. The separate 36-original production plan has **zero approved recordings**, and AI music production remains paused. Catalogue availability and technical decoding do not establish musical listening approval; see the [hosted music guide](hosted-soundtracks.md).

## Import, edit and audition

1. Expand **Add & edit music**, choose one or more MP3 files and select **Import selected MP3s**. Every file passes structural byte inspection and a real browser media probe before the batch enters the draft. A rejected file cancels the whole batch without removing an earlier draft.
2. Choose a track. Edit title, artist, source declaration, credit, license and provenance; select **Apply track details to draft**. Newly imported files begin as personal local uploads. These fields are authored declarations, not an automatic rights determination.
3. **Audition MP3** plays the verified original through an audio element with native controls. It temporarily pauses session music without touching game effects. Finish audition, natural completion, playback failure and closing the studio release its object URL and restore the prior intended music state. A new explicit session transport command ends the audition. Hiding the page stops the audition and restores only the preceding listening intent through `player.setIntent`; it never starts hidden-page audio. The host retains lifecycle authority.
4. **Save all changes** verifies the draft and required stored originals and performs one generation-checked storage transaction. Undo unsaved changes returns to the last loaded/saved library. Reload latest saved deliberately discards the draft and reads a competing writer's saved version.

Browser codec/probe failures, playback activation denial and unavailable IndexedDB are visible errors. An unavailable store leaves built-in player controls available. A stale generation keeps the draft and asks for reload; it cannot overwrite another operation. A cancellation accepted before native commit preserves the saved library. If cancellation arrives after native commit, the UI reports the completed save rather than claiming a rollback.

Limits come from the shared model: **32 MiB/12 minutes per MP3**, **123 uploaded tracks**, **26 custom playlists**, **128 entries per custom playlist**, and a **256 MiB** shared media/staging budget. Up to **256 catalogue entries** and their built-in albums are separate from the custom slots. The v3 asset/reference envelope supports **512 entries** without raising the byte budget. The legacy 128-track/32-playlist totals include the five synth recipes and six synth playlists; they are not the total capacity of the modern catalogue library. The host supplies other managed media usage to the store. A logical storage budget does not certify available browser disk or persistent offline operation.

## Playlists and assignments

Expand **Create playlists** to edit your playlists. Built-in playlists are immutable. Clone one to create an editable version, or create a new playlist using the track selected under **Add & edit music**. Custom playlists support title, ordered/shuffled playback, repeat all/one/off, adding duplicate entries, moving entries up/down and removing entries. A playlist must retain at least one track.

The assignment editor receives edition keys from the game; it does not invent them from display titles. Whole game uses a null key. Theme uses `themeId`, campaign uses `campaignKey`, and map uses `mapKey`. Removing a track checks custom playlist references. Removing a playlist checks assignments and explicit selection. Remove those references deliberately first.

Every ordinary editor action changes only the draft. Form fields use explicit **Apply … to draft** buttons. Save commits the draft; unapplied form text is not part of that saved state.

## Complete audio transfer

1. Expand **Backups & album files** and choose **Prepare saved-library backup (.rlsound)**. The tool verifies saved metadata and the permitted personal, installed and explicitly referenced original MP3s, then exposes **Download prepared backup** with its size and loaded/saved generation. Preparation never starts a download, changes the draft or writes the library. Unapplied form text and unsaved draft edits are excluded. A missing/corrupt required original fails preparation. Unused trusted online catalogue entries are omitted without downloading their audio; restricted recordings remain explicit references with an online-restoration notice.
2. Choose **Download prepared backup** and confirm the destination in the browser or host. The browser path is a visible native download link; keyboard Enter and touch use its default behavior, while controller Confirm requests the same action through the existing focus system. If no file appears, the action remains available to retry. The page reports a request, never a completed disk write.
3. Keep the resulting `.rlsound` file, then validate it through **Review backup as replacement draft** in the intended destination. A normal game JSON backup does not contain these audio bytes.

Only one prepared bundle and, for browser downloads, one Blob URL are retained. The soundtrack v3 binary format and 256 MiB bundle limit apply; older v1/v2 bundles remain readable by this edition. Retry reuses that handle; ordinary Close/reopen retains it for delayed browser consumers. **Discard prepared copy**, a new preparation, accepted draft edits/imports, Undo, save, reload and disposal remove the previous handle. A cancelled preparation cannot install a late link. Discarding the prepared copy does not delete music or cancel a download already accepted by the browser.

The export represents the last snapshot loaded or saved by this studio, not an unseen competing tab's newer generation. **Reload latest saved** deliberately discards the local draft and any prepared copy before reading that version. Selecting tracks for viewing or typing unapplied form text does not change the snapshot.

**Review backup as replacement draft** verifies the entire binary file, hashes, frame facts and media probes before replacing the draft. It does not change stored music until Save. Undo before Save keeps the earlier library. The existing game JSON backup and platform-native transfer adapters remain independent; native soundtrack packaging is a separate integration task.

The dialog reports whether a track's original is present locally. Presence is not a claim of service-worker caching, browser eviction protection or offline qualification. Export files before removing local storage.

The earlier in-app download timeout remains unexplained. The former flow awaited binary preparation and programmatically clicked a removed hidden link; this change gives the player an explicit, retryable action. The `download` attribute cannot establish whether a transfer actually occurred. [MDN download behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download).

Fresh keyboard/pointer activation can matter for gated browser APIs; a polled gamepad's synthetic click does not create trusted activation. This implementation does not add a file-system picker or claim that a missing gesture caused the earlier timeout. A future picker adapter must invoke its picker before asynchronous work. [MDN user activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation), [Chrome file-system guidance](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#write-the-file-to-the-local-file-system).

Retaining one URL avoids removing access immediately after a request, while explicit invalidation bounds retained memory. [MDN Blob URL lifecycle](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob#memory_management).

## Host integration

Import `attachSoundtrackPanel` from `game/ui/soundtrack-panel.mjs`. It creates `#soundtrack-dialog`, attaches its own stylesheet and returns `{ open, close, update, dispose }`.

```js
const panel = attachSoundtrackPanel({
  document,
  store,
  player,
  onOpen: () => pauseGameplay(),
  onClose: () => restoreGameMenuFocus(),
  getContext: () => ({ themeId, campaignKey, mapKey }),
  otherManagedBytes: () => mediaManagerUsage(),
  onLibrary: (library, snapshot) => adoptSoundtrackSnapshot(snapshot),
  onError: (error) => showError(error.message),
  onVolume: (value) => saveMusicVolume(value),
  onPlayback: ({ playing, desired }) => rememberMusicIntent(desired),
  onAudioEnabled: () => rememberSuccessfulAudioStart(),
  beforeAudio: () => leaveAudioSuspensionAfterExplicitAction(),
});
```

`onLibrary(library, { generation, library, assets })` runs after initial/reloaded storage and after an authoritative save; assets contain native Blob originals. The panel calls `player.setLibrary()` without transport restart. The host should refresh its binary lookup from the supplied snapshot, including deletion/replacement. If that callback fails after a commit, the dialog says the library was saved but refresh failed.

`onVolume(value)`, `onPlayback({ playing, desired })`, and `onAudioEnabled()` run after the corresponding explicit user actions, never periodic `update()`. Successful MP3 audition also calls `onAudioEnabled`. Keep general audio enablement distinct from pausing music if effects should continue. Optional `beforeAudio()` runs only during explicit playback, audition and selection actions, so the host can clear its lifecycle suspension without resuming gameplay. It never runs during periodic rendering.

An optional `download(blob, filename, { signal })` adapter replaces the native link with a button. Its invocation is synchronous within the explicit button action, before any await; old two-argument adapters remain compatible. It receives the already verified original-byte bundle and may return a Promise. Refusal leaves that bundle available for retry. Cancellation is cooperative through the optional signal; accepting a request alone is not treated as proof of a disk write. No wrapper adapter is installed automatically.

Call `panel.update(snapshot)` from the player change callback, or `panel.update()` to read its current snapshot. Opening the panel does not itself enable audio. The host owns game pause, controller focus scope, full-page lifecycle, persistent settings and SFX. Dispose removes listeners, dialog/stylesheet, audition and download handles; it does not close the shared store or dispose the shared player.

Optional adapters are `probeMedia`, `URLImpl`, `makeId` and `download(blob, filename, { signal })`. The download adapter can also be supplied by a native host; the ordinary browser path uses the prepared native link. Production uses `probeMP3Media`; do not substitute the structural probe used by Node tests into the application.

## Verification

```sh
node --test game/test/soundtrack-panel.test.mjs
```

The panel suite executes real model validation, MP3 byte inspection, complete binary transfers and the transactional store against a finite DOM/media/IndexedDB harness. Its cases cover batch atomicity, metadata without restart, mixed playlists, exact assignments, reference-safe deletion, export/import/Undo, stale writers, cancellation, shared-budget refusal, audition restoration and the new prepared-copy lifecycle. Native-link defaults are modeled; no test infers disk completion from a click.

The counts below are historical results for the earlier prepared-download implementation, retained with [round 41](verification/round-41/v031-media.md). They are not the current suite totals. The later [player UX review](verification/soundtrack-player-ux-2026-09-21/review.json) separately records the simplified controls and its source-bound checks.

| Stage                                         | Recorded result                                                                 | Boundary                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panel                                         | **22/22 pass**                                                                  | Real validation, original bytes and store; finite DOM/media adapters                                                                                                           |
| Actual game host                              | **8/8 pass**                                                                    | Real app/player/panel/store and controller navigation; modeled devices and native defaults                                                                                     |
| Combined audio regression                     | **105/105 pass**, including the panel and host cases                            | Audio, model, store, player, panel and host tests; no skips                                                                                                                    |
| Earlier browser MP3 work                      | Selection, import, decoder probing, playback and saved playlist reload observed | Predates this prepared-download flow; coded silence, not finished music                                                                                                        |
| Prepared-link browser qualification           | **Local browser pass**                                                          | Actual native download, different-origin import/save/re-export, byte equality and packaged cold offline startup/playback; see [round 41](verification/round-41/v031-media.md). |
| Physical devices, native adapter and delivery | **Pending**                                                                     | Modeled controller/adapter access is not hardware or packaged-platform certification; isolated source change is not a public release                                           |

## Current game integration

Settings → Audio → Music library & playlists opens the studio while preserving the paused flight. The studio is the authority for persisted playlist choices; the old single-genre selector appears only when file audio is unavailable. Map assignment keys combine the original campaign edition, authored map ID/revision and theme, so Gentle mode and cosmetic changes do not create a different soundtrack authority. Libraries and original audio use a separate IndexedDB store shared by the local game origin.

The current edition uses the shared IndexedDB **version 5** boundary for audio and other managed media in ordinary play, Playground practice and First Flight. Practice and training retain authored artwork without managed picture pins or profile/session/award writes. Upgrade retains existing domain rows and original bytes; converted soundtrack metadata is written only by a successful atomic Save. Older immutable editions using a lower database version cannot reopen the upgraded store: their recovery message is a compatibility boundary, not a reason to delete data or attempt a downgrade. Use the current edition to access or export the shared library. Soundtrack library/bundle **v3** is a separate format version, described in the [library guide](soundtrack-library.md).

The player uses at most two MP3 decks for crossfades, with sequential playback when gain routing is unavailable. The host calls the session player once per render update, forwards semantic effects separately, and retains music-only Pause through ordinary game Resume. A visible/focused return may restore previous listening intent, but gameplay requires explicit Resume. The browser can still reject playback: [MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). Local original presence does not prevent browser eviction; complete backups remain useful: [MDN storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). The [hosted music guide](hosted-soundtracks.md) covers this edition's built-in albums, offline downloads and selective backup contents.

Actual-host tests exercise the real app/player/panel/store with finite media and storage boundaries. The prepared-download case reaches Prepare with the actual controller navigation, verifies held-Confirm isolation, preserves native Enter handling and touch activation, checks exact original bytes, and keeps flight paused without changing its checkpoint. DOM default activation and browser transfers remain modeled boundaries. Separate earlier source-browser checks passed file-chooser selection, actual decoder probing, MP3 import and atomic save, built-in track advance, and persisted playlist selection after reload. The fixtures are coded silence, not finished music or listening-quality evidence. The visible download flow has now passed actual-browser native download, different-origin import/save/re-export with exact bytes, and development-packaged cold offline startup/playback. The complete evidence and its limits are in [round 41](verification/round-41/v031-media.md). Exact frozen/public delivery and physical devices remain separate.

The desktop studio footer stays in normal document flow so its status and actions cannot obscure playlist editing controls. Creating a playlist uses the selected music-library track; adding subsequent entries uses the separate Track to add picker.
