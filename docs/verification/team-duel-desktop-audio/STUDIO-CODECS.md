# Studio cue and codec extension

This is a separate development check. It does not replace or change the completed [capture probe and receipt](STUDIO.md). The completed native continuation is recorded below.

## Normal Studio setup

In Asset Studio, upload each retained file into the indicated sound slot, preserve its rights/source details, stage the changes, then explicitly Save. Export the saved `.rltheme` using the ordinary Studio action. For recovery evidence, import that downloaded file into a separate origin, explicitly Save, reload, and export again; keep the transfer evidence separate from this read-only probe.

| Studio slot     | Existing file from repository root                                | Original bytes | Rights/source                                                                                                                |
| --------------- | ----------------------------------------------------------------- | -------------: | ---------------------------------------------------------------------------------------------------------------------------- |
| `audio.failure` | `game/audio/effects/loss.wav`                                     |         38,444 | Existing RevealLine procedural effect bank; retained [bank credits](../../../game/audio/effects/licenses.html)               |
| `audio.pickup`  | `authoring/audio/revealline-v1/originals/interface/pluck_002.ogg` |          6,941 | Kenney Interface Sounds 1.0, CC0; [retained license](../../../authoring/audio/revealline-v1/originals/interface/License.txt) |
| `audio.victory` | `docs/verification/cross-mode/p02-a/fixtures/rising-chime.mp3`    |         32,600 | Original CC0 digital test signal; [fixture rights and encoder facts](../cross-mode/p02-a/fixtures/README.md)                 |

The MP3 is a retained test signal, not a finished soundtrack or a recommended production victory cue. The test does not generate or transcode audio. SHA-256 pins in `studio-codecs-model.mjs` enforce these exact originals; imported namespace IDs may change normally. Source-container inspection found PCM WAV (32 kHz, mono, 0.6 s), Vorbis OGG (44.1 kHz, stereo, 0.164558 s) and MP3 (44.1 kHz, mono, 2.0375 s container duration). Native Web Audio may resample and trim codec padding; the receipt records its actual frames, duration, channels and sample rate. File inspection is not native decoding evidence.

## Run and evidence

Serve the repository normally and open [Studio WAV / OGG / MP3 check](studio-codecs.html). Choose the actual exported `.rltheme`, then **Run codec checks**. Audio activation remains on that explicit click. Keep the page visible until completion, roughly 25 seconds after the effect bank finishes loading. Use the separate **Download report** action to retain the report. Cancel, hiding or leaving the page retires owned work; the owned AudioContext must close.

The production bundle reader verifies the document, inventory and original hashes before a read-only adapter exposes the three selected slots. The page does not write Studio storage or preferences and does not generate bundles. Runtime decoding and playback use actual `Soundscape`, `FeedbackDirector` and `PublishedCues`. Existing failure/pickup recordings are fully ready before testing replacement precedence. The success result follows the actual host result path, whose native fallback is procedural.

The matrix checks:

- Each imported original decodes natively, caches, and produces isolated digital output and a nonzero mono downmix with sampled headroom.
- Team failure, pickup, powerup and terminal victory/defeat events use the exact imported buffers. Both Duel owners remain independent for failure/pickup/powerup; per-board terminal events are silent and one separate `duel-result` owner produces victory/defeat.
- Master mute, master zero and gameplay pause retire active cues, reject a fresh event after cooldown, do not replay on restoration, and allow a later fresh event.
- Cold dispatch uses the ordinary fallback. A held **real native decoder result** may populate only its live owner. Late readiness never schedules an expired event; canceled or closed owners cannot adopt it.
- A deliberately faulted read adapter supplies only the first nine bytes of each verified original. The actual native decoder must reject it without a custom start, and a later event retains its ordinary fallback. This is controlled decoder/read-boundary failure, **not** a corrupt export accepted by the bundle importer; the selected bundle and original blobs remain unchanged.

Exact-buffer identities, board owners and continuous native `AudioBufferSourceNode.start()` counts exclude ordinary fallbacks and already-ended short replays from successful replacement/no-replay claims. Sampled silence plus zero live voices also checks procedural tails. The report includes the bundle hash, selected asset records, theme revision, browser, decoder facts, named source hashes, per-check results, sampled readings and context cleanup state. Pins are scoped to the named files, not every dependency or an immutable public edition.

## Scoped helper checks

Run `node --test docs/verification/team-duel-desktop-audio/studio-codecs-model.test.mjs`.

The final focused cohort passed **20/20** tests, with zero failures, skips or cancellations. Syntax, scoped lint and formatting checks passed. The Node tests construct an in-memory test document with the exact retained originals and use the production export/import reader, without writing a bundle for browser use. They exercise slot verification, abort handling, wrong-buffer rejection, actual runtime event/result routing, late/canceled/closed cache ownership, natural fallback completion without lifecycle mutation, stalled-clock/interruption bounds and controlled failed-read fallback. Their finite audio adapter is modeled; passing them does not supply native codec or audible evidence.

Remaining boundaries include subjective listening, physical speakers/headphones, perceived distinguishability/mono quality, true peak/LUFS/acoustic clipping, every codec variant or browser, all menu/destruction/reaction/music slots, full natural gameplay with custom audio, long/oversized/hostile media decoding, public adoption and cross-version reader compatibility. Overlapping analyser windows measure sampled digital presence/headroom, not complete unique PCM samples or true peak. The user waived paired human playtesting; this check does not invent that evidence.

## Native Mac result, 15 October 2026

The normal Asset Studio UI at `http://127.0.0.1:8791/authoring/asset-studio/` began at document r104/local save 1. Each of the three retained originals above was selected through its ordinary file picker, entered with actual source/rights metadata, and explicitly staged. Explicit Save completed atomically at document **r107/local save 2**. The ordinary export produced `revealline-fpv-r107.rltheme`, **8,818,841 bytes**, SHA-256 `4f7e20a0b7936d81b8160002addfddddbc08f5ee87ab3fecd19f85a3bbd563d0`. A full Studio reload retained r107/save 2 and all three produced bindings; the [saved-reload screenshot](../team-duel-public/studio-codecs-saved-reload.png) records that state. This extension did not repeat independent-origin restoration; the earlier capture transfer receipt remains scoped to its own bundle.

The [native receipt](../team-duel-public/studio-native-codecs.json), started at `2026-10-15T21:20:49.697Z`, passes **102/102** checks with its owned context **closed**. The probe's normal chooser read that actual exported file through production `importThemeBundle`. An independent file comparison matched all **15 named source pins** and the export bytes/hash. The runtime source base was `23f1b7a64a8f9897c88b7295095033ff1ef561ab`; new development probe sources were present but not yet committed. The receipt's exact file hashes are the authority for the measured implementation, not a claim about every transitive dependency or a public edition.

| Selected cue | Native channels | Native rate | Native frames | Native duration |
| ------------ | --------------: | ----------: | ------------: | --------------: |
| Failure WAV  |               1 |   48,000 Hz |        28,800 |      0.600000 s |
| Pickup OGG   |               2 |   48,000 Hz |         7,759 |      0.161646 s |
| Victory MP3  |               1 |   48,000 Hz |        97,802 |      2.037542 s |

The isolated failure/pickup/victory measurements had sampled peaks of **0.03231 / 0.64955 / 0.11316**, with nonzero digital and mono output. These are overlapping analyser measurements, not acoustic loudness or a true-peak certificate. The exact replacement buffers reached Team failure/pickup/powerup/result events and both Duel failure/pickup/powerup owners. Per-board terminal events remained silent; one `duel-result` owner emitted the appropriate victory/defeat cue. Master mute/zero and gameplay pause retired active voices, blocked fresh events after cooldown, and produced no restoration replay. Ordinary late delivery followed natural fallback completion without reset, generation change or owner replacement: failure/pickup/victory waited 260.4/156.4/2,302.2 ms, respectively, while continuously observing buffer starts. All late/canceled/closed-owner deliveries retained the expected cache ownership and no expired event starts; cancellation/closure cases intentionally retire their old event before delivery. The real decoder rejected each controlled nine-byte input and ordinary fallback remained available.

The final receipt was saved directly from the displayed JSON without altering its values. An earlier run passed 98 checks, but review found that resetting before delayed delivery weakened its claimed ordinary-readiness evidence. Its exact receipt, screenshot and matching probe sources remain historical in task-owned `.cache/multiplayer-desktop/studio-codecs-initial-98/`. The final 102-check run above closes that observation gap and adds explicit Team powerup coverage; it does not relabel the first run. The report-download event was unavailable during the first run. The [completed-check screenshot](../team-duel-public/studio-native-codecs.png) shows the passing status. No physical listening, natural full-game progression, arbitrary codec support, independent-origin transfer of this bundle, or public adoption is inferred.
