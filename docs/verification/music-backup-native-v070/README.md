# Original-byte soundtrack backup and recovery

Source: `508a638f556b80817f4c872b9950d7de7b207b17`; tree: `38fd90ea2821e78811f2dc3b4a2510936eefd967`.

The actual Team Music library imported owned rising/falling chime MP3s, saved an ordered playlist containing falling, rising, built-in Signal Afterglow and falling again, and downloaded a saved-library `.rlsound` file. A separate browser origin initially reported zero custom tracks/playlists. Native file selection imported that downloaded file as a replacement draft; Save committed it, retaining the selection and duplicate entry.

A second actual download after recovery is byte-identical to the first: **66,840 bytes**, SHA-256 `8f8a4d17171344024744cc8f0016f98c9e3281353cae5996bf8da415f1281637`. Each embedded MP3 matches the original 32,600-byte fixture. Explicit Play displayed the restored MP3 playing; after both short MP3 entries elapsed, Pause displayed the synth track paused. Escape restored focus to Team Audio's Music library opener.

The first browser-tool download event timed out, while the file actually arrived in Downloads. The original file was inspected and used for recovery without redownloading. Product feedback correctly said “Download requested”, not “saved”. Observations are summarized in `native-observations.json`; that file is not a raw browser transcript. All 225 distinct successful source responses were reconciled against exact Git blobs in `served-source-review.json`.

Master sound remained muted. This is byte recovery and transport evidence, not audible listening, server-stopped offline use, controller/touch-only navigation, physical-device certification, public acceptance or later-source qualification. The preview tab and server were closed. No application storage was seeded through browser evaluation.

## Repeat the check

1. Use a fresh local origin with the exact candidate source and two owned MP3s; record their byte counts and hashes.
2. Import through the real file chooser, create a mixed playlist with a duplicate, Save and select it.
3. Prepare the saved-library backup, download it, and verify actual file arrival and embedded hashes. Do not treat preparation or the browser event alone as successful persistence.
4. On another origin with an empty library, import the downloaded file through the real picker, inspect the draft and Save.
5. Export again and compare the entire binary bundle, metadata, selection, entries and original audio payloads. Check playback and focus separately, reporting mute/listening status accurately.
6. Retain the original downloads, source pins and observer limitations; do not modify the simulation or inject storage to satisfy the check.
