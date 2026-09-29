# RevealLine effects bank v1

Implementation branch: `codex/spatial-game-audio`, based on main `321408a3cfd75ae230d760f39fb692503652601a`.

## Sources and reproduction

Recorded ingredients are from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds), [Interface Sounds](https://kenney.nl/assets/interface-sounds), [UI Audio](https://kenney.nl/assets/ui-audio), and [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), verified CC0 on 2026-09-29. Preserved source Ogg files and each package's license are in `originals/`. The runtime WAV files and lossless PCM masters contain edited derivatives and original synthesis. No soundtrack files are changed. Freesound candidates in the design plan were research references; they are **not** represented as acquired recordings in this bank.

Run `python3 authoring/audio/revealline-v1/produce.py` with ffmpeg installed, then format `game/audio/effects/bank.mjs` with the repository's Prettier. `recipes.json` records source, trim duration and source package; `produce.py` records filtering, fades, harmonics, timing and deterministic seeds. The manifest contains the byte length and SHA-256 of every distributed asset. Original signatures have different intervals and durations for warning, start, retry, revival, loss, victory, neutralization and reactivation. Recorded material contacts have three variations. Loop lengths and harmonic periods are integral; granular noise tails meet at zero.

52 mono PCM runtime assets, 2,575,136 bytes in total; approximately 7.36 MiB decoded at 48 kHz (excluding separately supplied source originals). All are local/offline distribution assets. No runtime third-party requests. The existing immutable build inventory owns offline caching and exact-build hashes.

## Audition

Serve the repository, then open `authoring/audio/revealline-v1/audition.html`. It uses the actual Soundscape and FeedbackDirector. Start audio explicitly, compare single cues, move the source through the attenuation curve, and compare three capture sizes with capture → victory. Master mute is available. The page owns and disposes its own context and does not write player records.

This is a produced and integrated bank, **not a completed subjective listening certificate**. Native decoding, source tests and digital signal measurements do not establish speaker/headphone quality, loop comfort, or a 20-minute listening result.

## FPV radio extension

Official EdgeTX English and Ukrainian (Polina) “Armed” sources are pinned to `56f0bb41757798865254fd462ea5d177280ab12c`. These recordings are **GPL-2.0**, not CC0. Unmodified recordings, full license, hashes and processing recipe are distributed with the game through `game/audio/effects/licenses.html` and `edgetx-source.json`. All other recorded ingredients retain their previous CC0 provenance.

The ESC start/retry timbre is original synthesis with slightly detuned motor resonances and short electrical tones; it is **not an authentic hardware recording or a copied branded melody**. FPV body selection chooses it on a fresh start. One localized radio announcement is scheduled after it, with its own persisted enable/volume settings (`revealline.radio-audio.v1`, enabled at 35%). Critical warnings interrupt speech; SFX pause, mute, reset, hidden-page suspension and disposal cancel scheduled speech. No telemetry/battery callouts are mapped to unrelated game states.

## Repeated-cue comfort revision

User listening feedback identified paper, confirm, pickup and reveal gestures as tiring, with moving bodies too quiet. The replacement UI clicks use the official Kenney UI Audio CC0 pack; paper uses filtered Interface Sounds scroll gestures, pickup uses short pluck/drop variants. Preserve all used originals. Startup/radio provenance is unchanged.

Following [Bjørn Jacobsen's repetition and frequency-control guidance](https://www.asoundeffect.com/game-audio-immersion/), reduce bright transients and repeated tonal signatures as well as loudness. Captures now use a brushed seal with short low harmonics at equal RMS across the 200/400/650 ms tiers, instead of arpeggios. Routine cues coalesce, vary, and retire their overlapping predecessor. Capture no longer stacks a separate closure cue. Material contacts and secondary capture texture are restrained.

Movement assets now have audible midrange harmonics, calibrated RMS and independent near gains; a moving player and one nearby enemy receive reserved slots. Distance attenuation and urgent-warning policy remain unchanged. The audition page now actually moves its player, offers five body textures and displays the active movement sources. The earlier stationary player could not demonstrate movement sound.

File measurements and browser source ownership are verified separately from subjective comfort. `comfort-file-inspection.json` supersedes earlier bank measurements. A physical sustained-listening approval is still required.

## Optional, softer movement layer

A second user listening pass found the louder tonal loops tiring. Replace all six continuous textures with low-pass-filtered broadband motion, roughly four seconds long with an 80 ms overlap at the seam. This removes the pitched fundamentals, bright harmonic stacks and 13 Hz modulation; filtering differentiates the bodies. Actor loops target −25 dBFS RMS, fine-grained environmental textures −29 dBFS. The separate movement bus defaults to 50%, so the actor layer is about 9–10 dB quieter than the preceding audition at otherwise identical settings.

Settings → Audio now includes Movement sounds and Movement volume (English/Ukrainian), persisted separately in `revealline.movement-audio.v1`. Disabling it cancels existing player/enemy loops immediately, rejects new movement voices, and leaves warnings, impacts, rewards, radio and environmental zones under their existing controls. It never changes simulation movement. The audition controls are session-only and do not write game preferences.

Research: [Bjørn Jacobsen on repetition/frequency fatigue](https://www.asoundeffect.com/game-audio-immersion/) and [Audiokinetic variation guidance](https://www.audiokinetic.com/en/public-library/2024.1.4_8780/?id=creating_random_container&source=Help). These informed the direction; they are not proof that a specific user will find the result comfortable. `movement-file-inspection.json` supersedes the six earlier loop measurements.
