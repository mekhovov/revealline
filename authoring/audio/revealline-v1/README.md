# RevealLine effects bank v1

Implementation branch: `codex/spatial-game-audio`, based on main `321408a3cfd75ae230d760f39fb692503652601a`.

## Sources and reproduction

Recorded ingredients are from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds), [Interface Sounds](https://kenney.nl/assets/interface-sounds), and [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), verified CC0 on 2026-09-29. Preserved source Ogg files and each package's license are in `originals/`. The runtime WAV files and lossless PCM masters contain edited derivatives and original synthesis. No soundtrack files are changed. Freesound candidates in the design plan were research references; they are **not** represented as acquired recordings in this bank.

Run `python3 authoring/audio/revealline-v1/produce.py` with ffmpeg installed, then format `game/audio/effects/bank.mjs` with the repository's Prettier. `recipes.json` records source, trim duration and source package; `produce.py` records filtering, fades, harmonics, timing and deterministic seeds. The manifest contains the byte length and SHA-256 of every distributed asset. Original signatures have different intervals and durations for warning, start, retry, revival, loss, victory, neutralization and reactivation. Recorded material contacts have three variations. Loop lengths and harmonic periods are integral; granular noise tails meet at zero.

42 mono PCM assets, 1,125,140 bytes in total; approximately 3.22 MiB decoded at 48 kHz. All are local/offline distribution assets. No runtime third-party requests. The existing immutable build inventory owns offline caching and exact-build hashes.

## Audition

Serve the repository, then open `authoring/audio/revealline-v1/audition.html`. It uses the actual Soundscape and FeedbackDirector. Start audio explicitly, compare single cues, move the source through the attenuation curve, and compare three capture sizes with capture → victory. Master mute is available. The page owns and disposes its own context and does not write player records.

This is a produced and integrated bank, **not a completed subjective listening certificate**. Native decoding, source tests and digital signal measurements do not establish speaker/headphone quality, loop comfort, or a 20-minute listening result.
