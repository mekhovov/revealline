# Restored Studio capture: native digital verification

Open [the restored Studio check](studio.html) from the source server, choose a normally exported `.rltheme` file with an uploaded `audio.capture`, then choose **Run restored cue check**. Keep the page visible until completion (roughly seven seconds after the recorded bank loads). **Cancel check**, hiding the page or navigating away cancels owned work. The report is visible and has a separate **Download report** link. The owned AudioContext must close before the run passes.

The reader is production `importThemeBundle`: strict document validation, bounded payload checks and original hashes precede the capture adapter. This page reads the selected file without writing Studio databases or audio preferences. The read-only adapter exposes only the already verified `audio.capture`; it is not a substitute for exercising the native Studio import/save/reload flow or compiled presentation host.

The native run uses `Soundscape`, `FeedbackDirector` and `createPublishedCues`, with the ordinary recorded capture bank ready. It checks the exact decoded replacement buffer, separate Team/Duel owners, absence of a duplicated main recorded capture, digital output, mono downmix presence, sampled headroom, active-cue retirement under master mute/zero/gameplay pause, no replay on restoration, and fresh-event recovery. The independent material-contact accent remains enabled.

The decode scenarios hold delivery of a **real native decoder result**. A cold capture uses its already ready native fallback immediately. Delivering its custom decode later may populate the current cache but cannot replay the expired event. Canceling pending work or closing its owner must reject the late cache adoption as well. The gate never substitutes modeled PCM in the browser; it only controls completion timing and restores the original method during cleanup.

The report pins the chosen bundle hash, original capture asset/hash, selected theme revision, exact runtime/import/probe source hashes, browser identity, native decoded frame/channel/rate facts, checks, sampled readings and final context state. Sampling uses overlapping analyser windows: no unique PCM count, true-peak, LUFS, perceived quality, acoustic speaker result or audible mono judgment is claimed. A successful run is not a public-edition or Studio persistence certificate.

## Probe regression checks

`node --test docs/verification/team-duel-desktop-audio/studio-probe-model.test.mjs`

Six bounded Node tests pass with the production bundle reader and actual published-cue dispatch against a finite audio adapter: retained original bytes/theme, rejected unbacked capture, cancellation-aware reads, delayed readiness with fresh-only playback, canceled/closed cache ownership, both Duel owners, exact buffer identity, and restoring a held decoder without overwriting a newer owner. The sixth test proves the observer retains completed short starts and excludes rejected starts. These are modeled scheduling checks, separate from running the browser page.

Native receipt history and the revised-run status follow below. Do not infer native results from the modeled tests.

## Native Studio transfer observed on 15 October 2026

On source `90616ad4453a2c31d29ea29e532e6ecefbf459a0`, the native Studio UI at `http://127.0.0.1:8791` uploaded the existing project `confirm.wav` into the capture slot, staged it, exercised Undo/Redo, saved, exported revision 105, reloaded, imported its own export, explicitly saved revision 106/local save 3, and reloaded. The native HTML audio element reached `readyState: 4`, reported duration `0.090938` seconds, progressed while unmuted to `0.029644`, and ended at `0.090938` without a codec error. This records browser transport/decoding; it is not a listening assessment.

An independently stored origin, `http://127.0.0.1:8792`, began at revision 104/local save 1. Its normal file chooser staged the exported revision 105 without saving; explicit Save followed by a full page reload reported revision 105/local save 2. The subsequent native export retained all **133 incoming originals byte for byte**. Import deliberately namespaced the capture asset from `audio.capture.custom` to `import-105-2686`; its other record fields, original hash and provenance were retained. Unchanged asset IDs are not claimed.

The original export was 8,745,057 bytes, SHA-256 `9bed2b093e745e9268b9b4760d2f5ab652b5b5f357618a4db7493d7dec211787`. The independent restored export was 8,779,210 bytes, SHA-256 `55c4bd86994d26d5494f805733144c6f5795531496ddad1484b22ad59bcb88b5`. Both retain the same 5,864-byte capture WAV, SHA-256 `52f084b9648ccd970891996c7ccdabb796dcd33c0a6d4a420bb70e51daef9bf1`. The artifact comparison checks exact bytes and metadata with the production reader; its Node image decoder was explicitly disabled. The native import flow and this page use the production browser image decoder.

## Probe review and native receipt history

The first native probe run at `2026-10-15T18:56:17.052Z` passed its original 29 checks, decoded 2,182 mono frames at 24,000 Hz (`0.0909166667` seconds), and closed its owned context. Its twelve pinned files matched local source on independent comparison before any probe revision. That receipt remains historical: it used the first export, and its no-replay sampling began after a 160 ms settling gap. The mute/pause rejected-event attempt also fell within the prior routine cooldown.

The revised probe closes both observation gaps. It counts successful native `AudioBufferSourceNode.start()` calls continuously across the full restore/decode observation windows, so even a short completed replay fails the check. It attempts blocked fresh events after 200 ms, beyond the 160 ms capture cooldown, while retaining the immediate active-cue retirement assertion. It separately measures the published capture with no other voice, so an ordinary contact accent cannot by itself establish custom-cue digital output. Context and source methods are restored during owned cleanup.

The final [native receipt](../team-duel-public/studio-restored-native-audio.json) and [report screenshot](../team-duel-public/studio-restored-native-audio.png) record **35/35 passing checks** at `2026-10-15T19:05:08.256Z` on the canonical verification page. This run selected the independent restored export, `revealline-fpv-r105 (2).rltheme`, with the exact 8,779,210-byte digest above. Its owned context closed. Native Web Audio decoded **4,365 mono frames at 48,000 Hz**, duration **0.0909375 seconds**. Keep this final 48 kHz run distinct from the initial 24 kHz receipt.

| Final measured fixture                         |            RMS |       Mono RMS |   Sampled peak | Overlapping windows |
| ---------------------------------------------- | -------------: | -------------: | -------------: | ------------------: |
| Isolated restored capture                      | 0.004932491802 | 0.004906660573 | 0.044646758586 |                  27 |
| Team capture with ordinary contact accent      | 0.002640767444 | 0.002632676280 | 0.025636775419 |                  27 |
| Both Duel owners with ordinary contact accents | 0.005348951235 | 0.005345195573 | 0.053087774664 |                  28 |

The isolated fixture scheduled exactly one voice using the decoded restored buffer. Team scheduled that buffer for owner `team`; Duel retained one custom capture per owner `0` and `1`, with no recorded main-capture duplicate. Each master-mute, zero-master and gameplay-pause case retired its active cue, rejected a fresh attempt after the cooldown, and scheduled zero buffer sources during restoration. Late, canceled and closed-owner decode delivery also produced **zero buffer starts** across the complete observation windows and zero sampled output. A late current decode populated only its current cache; canceled and closed owners remained uncached. Fresh events after restoration/readiness still selected the custom buffer.

Independent comparison found **all twelve final receipt pins match** the canonical local files: nine named production/import sources and three native probe sources. The check is scoped as described below. Six modeled probe checks also pass, including the completed-short-source counter and failed-start handling; these remain separate from the final native measurement.

Only the report's named runtime/import/probe files are pinned. This is not a hash of every transitive dependency, browser binary, recorded effect or full immutable edition. Keep the receipt's source hashes unchanged when moving these dev-only files to `docs/verification/team-duel-desktop-audio/`; the relative imports have the same depth.

Durable transfer evidence: [exact artifact comparison](../team-duel-public/studio-native-transfer.json), [same-origin saved import](../team-duel-public/studio-capture-import-saved.png), and [independent-origin restored save](../team-duel-public/studio-independent-restored.png). The final native receipt and screenshot are linked above. Initial 29-check artifacts remain local historical files under `.cache/multiplayer-desktop/studio-restored-native-audio-initial-29.*`; the initial and final scoped hash-comparison records are retained locally as `studio-restored-native-audio-initial-pin-check.json` and `studio-restored-native-audio-final-pin-check.json`. The durable receipt itself contains the exact final hashes.

The remaining limits are subjective listening, physical speaker/headphone quality, perceived mono quality, acoustic clipping/true peak/loudness, every other imported cue/codec, full natural gameplay progression with this custom asset, cross-version readers and public immutable-edition adoption. The native probe dispatches controlled capture events into real game audio owners; it does not simulate a completed two-person play session. The user waived paired human playtesting.
