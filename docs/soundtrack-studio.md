# Soundtrack Studio

The local Sound / Studio dialog edits the versioned soundtrack library and uses the persistent music player. It is an admin tool inside the dark game shell. It does not publish files to a server or change the simulation, scores or earned pictures.

## Player controls

Previous, Play music, Pause music, Next, seeking and the music fader call the public player API. Playback playlist offers Automatic, built-in collections and custom playlists. **Save & use playlist** saves the full current draft, persists the explicit selection and applies it immediately; a previously paused player remains paused until Play music. Automatic follows exact map, campaign, theme and global assignments. Metadata-only saves keep the current song and apply queue/assignment changes at a song boundary.

Built-in recipes are labelled as procedural synthesis. This tool does not turn the five existing recipes into the separately planned 24 finished recordings. Uploaded music is actual preserved MP3 data.

## Import, edit and audition

1. Choose one or more MP3 files and select **Import selected MP3s**. Every file passes structural byte inspection and a real browser media probe before the batch enters the draft. A rejected file cancels the whole batch without removing an earlier draft.
2. Choose a track. Edit title, artist, source declaration, credit, license and provenance; select **Apply track details to draft**. Newly imported files begin as personal local uploads. These fields are authored declarations, not an automatic rights determination.
3. **Audition MP3** streams the selected original through an audio element with native controls. It temporarily pauses session music without touching game effects. Finish audition, natural completion, playback failure and closing the studio release its object URL and restore the prior intended music state. A new explicit session transport command ends the audition. Hiding the page stops the audition and restores only the preceding listening intent through `player.setIntent`; it never starts hidden-page audio. The host retains lifecycle authority.
4. **Save all changes** prepares every referenced original and performs one generation-checked storage transaction. Undo unsaved changes returns to the last loaded/saved library. Reload latest saved deliberately discards the draft and reads a competing writer's saved version.

Browser codec/probe failures, playback activation denial and unavailable IndexedDB are visible errors. An unavailable store leaves built-in player controls available. A stale generation keeps the draft and asks for reload; it cannot overwrite another operation. A cancellation accepted before native commit preserves the saved library. If cancellation arrives after native commit, the UI reports the completed save rather than claiming a rollback.

Limits come from the shared model: 32 MiB/12 minutes per MP3, 128 total tracks, 32 total playlists, 128 entries per playlist, and a 256 MiB managed media/staging budget. Built-in records count toward the track and playlist limits. The host supplies other managed media usage to the store. A logical storage budget does not certify available browser disk or persistent offline operation.

## Playlists and assignments

Built-in playlists are immutable. Clone one to create an editable version, or create a new playlist using the selected track. Custom playlists support title, ordered/shuffled playback, repeat all/one/off, adding duplicate entries, moving entries up/down and removing entries. A playlist must retain at least one track.

The assignment editor receives edition keys from the game; it does not invent them from display titles. Whole game uses a null key. Theme uses `themeId`, campaign uses `campaignKey`, and map uses `mapKey`. Removing a track checks custom playlist references. Removing a playlist checks assignments and explicit selection. Remove those references deliberately first.

Every ordinary editor action changes only the draft. Form fields use explicit **Apply … to draft** buttons. Save commits the draft; unapplied form text is not part of that saved state.

## Complete audio transfer

**Download saved library (.rlsound)** creates a binary soundtrack bundle with saved metadata and every referenced original MP3. It excludes unsaved draft edits. A missing/corrupt original fails complete export; the tool never calls a JSON-only file a complete audio backup. The browser controls download location and final download completion.

**Review backup as replacement draft** verifies the entire binary file, hashes, frame facts and media probes before replacing the draft. It does not change stored music until Save. Undo before Save keeps the earlier library. The existing game JSON backup and platform-native transfer adapters remain independent; native soundtrack packaging is a separate integration task.

The dialog reports whether a track's original is present locally. Presence is not a claim of service-worker caching, browser eviction protection or offline qualification. Export files before removing local storage.

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

`onVolume(value)`, `onPlayback({ playing, desired })`, and `onAudioEnabled()` run after the corresponding explicit user actions, never periodic `update()`. Successful MP3 audition also calls `onAudioEnabled`. Keep general audio enablement distinct from pausing music if effects should continue. Optional `beforeAudio()` runs only before explicit Play, audition and Save & use, so the host can clear its lifecycle suspension without resuming gameplay. It never runs during periodic rendering.

Call `panel.update(snapshot)` from the player change callback, or `panel.update()` to read its current snapshot. Opening the panel does not itself enable audio. The host owns game pause, controller focus scope, full-page lifecycle, persistent settings and SFX. Dispose removes listeners, dialog/stylesheet, audition and download handles; it does not close the shared store or dispose the shared player.

Optional test adapters are `probeMedia`, `URLImpl`, `makeId` and `download(blob, filename)`. Production uses `probeMP3Media` and normal binary browser download; do not substitute the structural probe used by Node tests into the application.

## Verification

```sh
node --test game/test/soundtrack-panel.test.mjs
```

Sixteen focused panel tests execute real model validation, MP3 byte inspection, complete binary transfers and the actual transactional store against a finite DOM/media/IndexedDB harness. They cover batch atomicity, metadata without restart, mixed playlist edits, new playlists using the visibly selected library track, and exact assignments, reference-safe deletion, export/import/Undo, stale writers, cancellation before and after commit, shared-budget failure, audition restoration including hidden-page intent, explicit activation and user persistence callbacks and unavailable storage. They do not certify actual audio decoding, browser download completion, real controller navigation or offline device behavior. Those are host/browser acceptance work.

## Current game integration

Settings → Music library & playlists opens the studio while preserving the paused flight. The studio is the authority for persisted playlist choices; the old single-genre selector appears only when file audio is unavailable. Map assignment keys combine the original campaign edition, authored map ID/revision and theme, so Gentle mode and cosmetic changes do not create a different soundtrack authority. Libraries and original audio use a separate IndexedDB store shared by the local game origin.

An MP3 runs through one media element. The host calls the session player once per render update, forwards semantic effects separately, and retains music-only Pause through ordinary game Resume. A visible/focused return may restore previous listening intent, but gameplay requires explicit Resume. The browser can still reject playback: [MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). Local original presence does not prevent browser eviction; complete backups remain useful: [MDN storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Seven actual-host tests exercise the real app/player/panel/store with finite media and storage boundaries. Separate source-browser checks have passed file-chooser selection, actual decoder probing, MP3 import and atomic save, built-in track advance, and persisted playlist selection after reload. The fixtures are explicitly coded silence, not finished music or listening-quality evidence. Public deployment, exact frozen offline operation, device/controller qualification and finished albums are tracked independently.

The desktop studio footer stays in normal document flow so its status and actions cannot obscure playlist editing controls. Creating a playlist uses the selected music-library track; adding subsequent entries uses the separate Track to add picker.
