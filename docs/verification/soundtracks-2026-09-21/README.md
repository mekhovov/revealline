# Soundtrack candidate verification — 2026-09-21

This is a local source candidate, not a published release or a completed original soundtrack. **0 of the 36 original recordings are finished.** Approved access to the hosted generation endpoint, pilot production, finishing and musical review remain prerequisites. The 24 licensed bonus recordings are separately credited third-party works.

## Final candidate with licensed-album offload

Runtime commit **`6664dae9091fc515109271d7ac8a627e3c8abbde`** adds reference-preserving removal and explicit re-download for the four licensed bonus albums. It preserves edited metadata and playlist order, protects originals shared with personal uploads, skips offloaded songs without implicit downloads, and refuses incomplete backup/share exports. It also handles partial creator-album restores. Targeted core/storage tests passed 112/112; the final combined panel/player/offload check passed 89/89. The complete exact-source suite passed **3,528/3,528 tests**, with zero failures, cancellations, skips or todo tests. Lint, formatting, native formatting, content validation and motion-lab syntax also passed. Packaged browser and cold-offline checks are recorded below.

Its source archive is `.cache/soundtrack-implementation/frozen-offload/source.tar`, SHA-256 `16ce763cf011b3cc664d918ba95463d3b5b700bd075561703555daa9aad47795`. The isolated branch remains `codex/soundtrack-expansion-36`. No public release is implied.

The full suite used all **297 test files** discovered by the unmodified source launcher, with concurrency limited to four to avoid machine contention. It was an equivalent complete-suite invocation, not a literal `npm test` run; there were no exclusions or name filters. It completed in 1,216,035 ms. All **2,048 archived source files** were independently checked against Git and reverified unchanged after the six gates. See [commands, exact test list, exit codes and log hashes](gates-6664dae9.json). Full logs remain in `.cache/soundtrack-implementation/frozen-offload/gates/`. The receipt SHA-256 is `b152e54b64019c7e4c081f155a5db7874bbbc97ef5e84f45fd7abc1793be2068`; source-manifest SHA-256 is `4a2997aba21eccc36efee965099af04a44f144b8dfa6441058d6cd7898903716`.

Independent package verification matched **all 367 manifest files and 368 ZIP entries**. The ZIP is 444,193,100 bytes, SHA-256 `9a87f962a60bf04e28c1a2f26e04222582ec67b2db515264ee6e56b1ea772e3f`. Its manifest SHA-256 is `b775df492ba0406673f6956026461acffe6d5238bd2bc0d2cafa31161f5bc2fa`. The automatic core remains **318 files / 53,653,364 bytes**, below 64 MiB. All four album hashes are unchanged and excluded from core precaching. See [final artifact receipt](artifact-receipt.json).

### Final packaged browser checks

The exact final package runs at `http://127.0.0.1:18808/game/` in the in-app browser, on a fresh origin separate from the earlier candidate.

- Restored the actual downloaded backup through the native file chooser and saved five tracks/two playlists at generation 1, with 23.0 MiB of original audio.
- Removed Rock & Metal from the draft: **20.3 MiB freed**, **2.6 MiB protected** because an independently uploaded track references the same MP3. All four album playlist entries and both custom playlists remained present.
- Undo restored the complete saved library. Repeated removal and Save committed generation 2 with all five track identities and both playlists retained, but only the protected 2.6 MiB present.
- Preparing a complete backup failed with the explicit instruction to Download again and Save. No incomplete file was prepared. Selecting Rock & Metal skipped missing songs and played the still-owned Determination recording.
- Download again validated the shipped album and restored all bytes without changing the playlist entries. Save committed generation 4 at 23.0 MiB. At the next track boundary, Silver Bullet played and the unavailable-album notice cleared. Library changes deliberately apply queues at a song boundary.
- Preparing a selected-playlist creator album succeeded and exposed its download link. Browser/native-link/keyboard activation reported a download request, but **no new file was observed on disk**. Computer-use safety rules rejected inspection of the Codex native app UI. A Safari fallback was also unavailable because native computer-use permissions were not granted. Native save-dialog completion therefore remains unverified; this is not represented as a completed file download. The older real backup download and its final-build import remain separately verified.
- Offline preparation verified all 318 core files / 53,653,364 bytes, with no missing or corrupt files. The final server was stopped and a direct connection attempt failed. A fresh tab cold-started successfully; its first Settings gesture resumed Megasong from the installed library. Generation 4, all five track identities, both playlists and 23.0 MiB of exact originals survived the restart.
- Completed First Signal by keyboard while still offline: **52.2% revealed, 8,160 points, three lives, 0:03, Gold**. Determination continued through the result screen and opening Settings/Studio, then naturally advanced to Silver Bullet without a Next action. No captured console errors were returned. This verifies progression, not a subjective assessment of transition sound quality.
- Music was left intentionally paused and the final server was restarted for local review. The superseded preview server was stopped.
- Direct MP3 import also passed in the final build: selecting the owned Determination fixture through the file chooser produced a verified six-track draft. Audition started, Finish audition preserved the previous song's intentional pause, and Undo restored the saved five-track library. See the [browser receipt](browser-receipt.json).

## Earlier qualified source and artifact

The earlier candidate consisted of commits `456ba31e652bc341115be70a9b580795cee61120` and **`45b14a403cdb663b5b8d3c5db94269e32e09b55d`**. The final runtime commit is `6664dae9091fc515109271d7ac8a627e3c8abbde`, qualified above; subsequent evidence-only commits do not change that runtime.

That earlier source was extracted from a Git archive, independently checked against all 2,047 committed files, and built into `.cache/soundtrack-implementation/frozen-final/site`. The package's existing `0.44.2` label identifies the source base; this work does not publish or overwrite a public version under that label.

| Item | SHA-256 |
| --- | --- |
| Exact source archive | `4b97901865b88d61a6b49b319a7761967eae1f121e6d6c6e1f414b8ab6deb441` |
| Source file manifest | `94ea19dda9bc0a2cdf1c59006dec19b2246b3585e820eb71e6dd1ad1f1d0a664` |
| Distribution manifest | `753f6e8491c3b77ca3d1dd0274c226196c5ef65b1dd49c9f8217dd8927812a40` |
| Distribution ZIP | `7b98e4ffe7999afab88e74026ec04144bdb62b995a2156c0f6a9db310af4ecba` |

All 367 manifest files and all 368 ZIP entries passed byte-count and hash comparison. The distribution contains 444,064,468 manifest bytes; its ZIP is 444,179,532 bytes. The automatic core has 318 files and 53,639,799 bytes, below 64 MiB. All four optional soundtrack binaries stay outside core precaching. Each optional album is below 64 MiB; together they are 145,251,852 bytes. See [earlier artifact receipt](artifact-45b14a40.json).

All six source gates passed for `45b14a40`: **3,514/3,514 tests**, lint, formatting, native formatting, content validation and motion-lab syntax. There were zero failed, cancelled, skipped or todo tests. The full suite took 893,337 ms. All 2,047 source files were independently reverified unchanged after the gates. See [commands, exit codes and log hashes](gates-45b14a40.json). Full logs remain in `.cache/soundtrack-implementation/frozen-final/gates/`.

The `45b14a40` results do not cover the later licensed-album offload change.

## Earlier actual browser journeys (`45b14a40`)

The earlier artifact was served at `http://127.0.0.1:18807/game/` and exercised through the desktop app's real in-app browser. This is browser evidence, not physical iPhone, native desktop-wrapper or human listening certification.

1. Imported the actual browser-downloaded `.rlsound` backup described below. The native file chooser restored five track entries, two custom playlists and four unique original MP3 blobs. Saved the replacement draft successfully.
2. Played the installed Metal selection. Paused music deliberately, started First Signal and completed a real keyboard capture: 52.2% revealed, 8,160 points, three lives and a Gold result. Reopening the studio showed the same music still intentionally paused at 0:57.
3. Prepared offline mode and verified all **318** core files. Stopped the server, confirmed connection refusal, closed the existing tab and opened a fresh tab at the same URL.
4. The cold offline title loaded. The first eligible menu gesture resumed installed music. Completed another First Signal win offline with the same 52.2% / 8,160 / three-life result.
5. Continued to Relay Orchard offline, secured its relay and reached 52.2%, 8,660 points and three lives. Pausing the game and opening Settings/Music Studio retained the active song and elapsed playback.
6. Selected Ukrainian, for which no reviewed recordings exist: playback remained silent and the studio reported the unavailable selection. Switching to Metal and pressing Play started Devoted Guard and cleared the stale notice.
7. No captured console errors were returned during these final browser checks. Music was left intentionally paused, and the same frozen server was restarted for local review after the offline check.
8. After restarting the server, browsed the four optional albums and downloaded 3xBlast — Pop-Punk Chiptune. Its seven songs were verified, added and saved alongside the existing five tracks: generation 7, twelve custom tracks, three custom playlists and 48.8 MiB. The Metal choice and Devoted Guard's intentional pause at 2:34 were preserved. No captured console errors were returned.

An earlier working-tree preview also exercised the real four-song optional-album download, additive draft/save, an MP3 file upload, metadata editing, a custom mixed procedural/MP3 playlist, shuffle/repeat-all, natural progression between its entries, and export to disk. Those actions are supporting evidence from the working-tree preview; they are not mislabelled as runs of the final frozen artifact.

### Downloaded backup

The real browser download is `~/Downloads/RevealLine-soundtrack (17).rlsound`: **24,069,432 bytes**, SHA-256 `79c53d47c5a3a8c1d407b863951c028c6e8a56aa1432821041d0ea1ad99aafda`. A structural/frame/hash check and re-export produced byte-identical output. The final frozen browser then imported and played that file. See [backup receipt](browser-backup-receipt.json). The Node re-export check is not an additional audio decode or listening claim.

## Recording and production evidence

All 24 licensed runtime MP3s passed complete CoreAudio decoding and exact source-hash comparison. They total 64 minutes 50.066 seconds and 145,235,057 bytes. Their six creator pages were rechecked against the retained CC0 credits. See [recording and rights verification](licensed-recordings.md).

Measured integrated loudness ranges from −16.06 to −6.72 LUFS, and the highest oversampled true-peak estimate is +1.18 dBTP. These files have **not** passed the original soundtrack's mix target or listening acceptance. No audio was modified by this verification. See [method, per-track results and limitations](loudness-analysis.md).

The original-production register contains 36 distinct briefs, six fusion compositions and four initial pilots. Its runtime approved catalogue remains empty. Prompts, receipts, catalogue schema and successful transport tests do not count as finished music.

## Remaining acceptance and delivery

- Obtain approved hosted inference access; produce and compare pilot candidates, finish masters and MP3s, review in menus/gameplay, then expand to 36 reviewed compositions.
- Complete full-track and repeated-session listening, transitions and warning-audibility checks; obtain Ukrainian musical review. Normalize/finish licensed bonus material if it is to meet the same game-mix target.
- Qualify physical iPhone and native desktop lifecycle, audio, storage and offline behavior separately. Simulated host tests and an in-app desktop browser do not close those gates.
- Automatic matching uses scene eligibility and existing world tags. Energy is saved for curation; there is no authored level energy/mood target in the current host.
- No PR, merge, release tag, public upload or Pages deployment was performed. Hosting projection, CI, public artifact checks and public play remain release gates. The 444 MB local distribution must be included in the hosting calculation before publication.

## Preserved attempts and working changes

Superseded expanded preview copies were removed after qualification to reclaim disk space. Their exact source archives, distribution ZIPs, manifests, receipts and logs remain available; the final `frozen-offload` source and served package are intact.

The first mixed-working-tree full test run exposed outdated host fixtures (HTML body parsing, database-version observations and gesture assumptions). These were repaired in the scoped branch. That failed run is retained as failed evidence. The first frozen archive at `456ba31e` was superseded after additional review; its unfinished test run was stopped, not counted as passed. Its five other source gates passed.

The user's main checkout stays on its original branch with unrelated edits intact. Its pre-existing staged diff was preserved byte-for-byte, SHA-256 `feb6af47884cde294d7a18b262034ed7881265caa603e3b6bdf73ba4426dbeeb`. Scoped commits were made only in the isolated worktree.
