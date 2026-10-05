# Humanoid reaction recordings

Eight brief acted performances by Exewin, from [Death sounds](https://opengameart.org/content/death-sounds-0), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). These are acted recordings, not synthesized speech. Listening review is pending; technical checks do not establish perceived quality or comfort.

Open `audition.html` through the development server to compare each original and processed take. The UI exposes a separate **Humanoid reaction sounds** setting alongside shared gore and blood preferences, allowing visual gore with impacts only.

`sources.json` records the exact archive, source page, license and original-file hashes. Original OGG takes 1, 2, 3, 4, 7, 8, 9 and 10 remain here unchanged. `production.json` records the producer hash, ffmpeg version and per-output receipts. `source-page.html` and `CC0-1.0.txt` retain the licensing evidence.

Reproduce without network access using `python3 scripts/produce-human-reactions.py` from the repository root (requires the existing ffmpeg tool). `--intake` is only for deliberately replacing the pinned source intake; normal production verifies the retained originals and licenses first.

The production path decodes mono at 48 kHz, trims silence, bounds duration to 700 ms, removes sub-bass, applies short edge fades and normalizes with both a -20 dBFS peak ceiling and -30 dBFS maximum 50 ms RMS ceiling. Native outputs are PCM16 WAV. Existing optional-package source projections embed the same performances as compact 64 kbps MP3; no additional optional asset fetches are required.

The runtime chooses a shuffled bag independently of gameplay randomness, avoids an immediate repeated take, admits at most two simultaneous vocal voices, spaces onsets by at least 250 ms, and limits sustained playback with two tokens refilling at one per second. Only actual humanoid defeats with gore and reactions enabled qualify. Distance, shared master/SFX volume, pause, warnings and speech can suppress a vocal. There is no deferred queue. Dry enemy-specific impacts remain separate.

All eight optional Sound Studio slots can be previewed before admission and support published replacements under the same playback constraints. Older themes remain valid without the new slots. Native and optional playback both own their sources for cleanup.
