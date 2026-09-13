# Soundtrack Studio local milestone — v0.24.0

Frozen source: `45a0241e75cd6fe6cddf71671fd9fd3735a9032c`; annotated tag object `7a84f22481a6ac5f835cbde6777ad08260260bcf`. Public v0.21 remains unchanged.

Play: http://127.0.0.1:8767/releases/v0.24.0/site/game/ → Settings → Music library & playlists.

All six exact-archive gates passed, including **2,012/2,012 tests**. All 1,187 source files remained unchanged. A fresh git TAR matched the verified archive; its independent build matched all frozen files. All 162 ZIP entries and CRC/payload checks passed. Offline artifact: 158 precache files / 43,985,065 bytes, below64MiB. Previous28 release trees (3,398 files) and29 tags remained exact. [Source gates](source-gates.json), [artifact integrity](integrity.json), [local HTTP delivery](http-delivery.json).

The first candidate `51b309b` failed version preflight before gates because its build config still named0.23.0. Commit45a0241 corrected that mismatch; no snapshot was created from the rejected candidate.

Source browser evidence on the isolated test origin127.0.0.1:8874:

- Native game Settings opens the local studio and returns to paused gameplay. Built-in playlist selection persisted after reload; transport Previous/Next and synth progression worked.
- Supported file-chooser upload accepted the owned4,170-byte coded-silence MP3; actual browser decoder probe passed. A second417,000-byte26-second fixture passed and was saved transactionally.
- The uploaded26-second MP3 reported playing from0:00 through0:24. After adding a synth entry, natural file completion advanced to Signal Afterglow. These fixtures test transport, not composition quality.
- A real-browser finding corrected new-playlist creation to use the visibly selected library track. The earlier attempted mixed-queue check contained only synth because of that bug and is not counted as MP3 evidence.
- Complete backup preparation succeeded, but the supported download event timed out and no resulting soundtrack file was observed in Downloads. Browser download delivery/restore remains unverified.

Source and finite adapter checks do not prove frozen offline playback, mobile/controller hardware or music quality. Server-stopped MP3 playback, browser complete-backup round trip, physical input devices and the planned24 finished recordings remain separate gates. This is a playable development milestone, not completed public/native-store qualification.


### Follow-up: frozen offline MP3 playback passed

With v0.24 served on isolated port 8875, the real browser verified 158 cached files, imported an owned 26-second MPEG transport fixture and saved a custom playlist. The test server was then stopped (TCP connection refused). Reloading the same URL restored the cached game; the saved playlist was selected and its actual MP3 progressed to 0:17 (seek position 17.8 seconds) of 0:26. [Recorded observations](offline-mp3-browser.json). The silent fixture verifies preserved bytes, decoder and transport, not musical quality. Actual browser download/reimport remains unobserved; this does not establish physical-device support.
