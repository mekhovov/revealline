# RevealLine effects bank v1

Implementation branch: `codex/spatial-game-audio`, based on main `321408a3cfd75ae230d760f39fb692503652601a`.

## Sources and reproduction

Recorded ingredients are from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds), [Interface Sounds](https://kenney.nl/assets/interface-sounds), [UI Audio](https://kenney.nl/assets/ui-audio), and [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), verified CC0 on 2026-09-29. Preserved source Ogg files and each package's license are in `originals/`. The runtime WAV files and lossless PCM masters contain edited derivatives and original synthesis. No soundtrack files are changed. Five CC0 Freesound movement recordings are now included as edited public HQ MP3 previews; the login-gated lossless originals were not downloaded. See `originals/freesound/sources.json` for creators, source URLs, license verification and checksums.

Run `python3 authoring/audio/revealline-v1/produce.py` with ffmpeg installed, then format `game/audio/effects/bank.mjs` with the repository's Prettier. `recipes.json` records source, trim duration and source package; `produce.py` records filtering, fades, harmonics, timing and deterministic seeds. The manifest contains the byte length and SHA-256 of every distributed asset. Original signatures have different intervals and durations for warning, start, retry, revival, loss, victory, neutralization and reactivation. Recorded material contacts have three variations. Recorded continuous loops use a 250 ms raised-cosine overlap; gesture loops leave silence between edits.

52 mono PCM runtime assets, 2,827,664 bytes in total; approximately 8.1 MiB decoded at 48 kHz (excluding separately supplied source originals). All are local/offline distribution assets. No runtime third-party requests. The existing immutable build inventory owns offline caching and exact-build hashes.

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

## Optional, softer movement layer (superseded sound design)

A second user listening pass found the louder tonal loops tiring. Replace all six continuous textures with low-pass-filtered broadband motion, roughly four seconds long with an 80 ms overlap at the seam. This removes the pitched fundamentals, bright harmonic stacks and 13 Hz modulation; filtering differentiates the bodies. Actor loops target −25 dBFS RMS, fine-grained environmental textures −29 dBFS. The separate movement bus defaults to 50%, so the actor layer is about 9–10 dB quieter than the preceding audition at otherwise identical settings.

Settings → Audio now includes Movement sounds and Movement volume (English/Ukrainian), persisted separately in `revealline.movement-audio.v1`. Disabling it cancels existing player/enemy loops immediately, rejects new movement voices, and leaves warnings, impacts, rewards, radio and environmental zones under their existing controls. It never changes simulation movement. The audition controls are session-only and do not write game preferences.

Research: [Bjørn Jacobsen on repetition/frequency fatigue](https://www.asoundeffect.com/game-audio-immersion/) and [Audiokinetic variation guidance](https://www.audiokinetic.com/en/public-library/2024.1.4_8780/?id=creating_random_container&source=Help). These informed the direction; they are not proof that a specific user will find the result comfortable. `movement-file-inspection.json` supersedes the six earlier loop measurements.

## Recorded movement revision

The broadband revision was rejected in user listening because the bodies sounded like noise. The current bank replaces all five actor movement beds with actual recorded ingredients:

| Body | CC0 recording | Edit |
| --- | --- | --- |
| FPV rotor | [DCPoke: Phantom 4 Pro hover](https://freesound.org/people/DCPoke/sounds/387985/) | Six-second steady hover; retain motor texture, filter rumble/bright top, overlap seam |
| Bird wings | [_stubb: coat wing flap](https://freesound.org/people/_stubb/sounds/389633/) | Seven light cloth gestures with spacing and modest rate/gain variation |
| Thread / paper | [keweldog: rustling paper](https://freesound.org/people/keweldog/sounds/181774/) | Five different short sections spread across 6.4 seconds with quiet gaps |
| Ground wheels | [domestophonics: toy car rolling on wood](https://freesound.org/people/domestophonics/sounds/420401/) | Rolling section with softened handling spikes and overlap seam |
| Arcade motor | [JeroenWals: slow electric toy motor](https://freesound.org/people/JeroenWals/sounds/592496/) | Short mechanical motor cycle, softened top end and overlap seam |

All five source pages explicitly identify CC0 1.0. Public HQ MP3 preview files are preserved verbatim; PCM masters are lossless **edits of those compressed recordings**, not claims of lossless source acquisition. `recorded_movement.py` and generated `movement-recipes.json` capture the exact edits. Mild soft saturation controls isolated source handling spikes before role calibration. Final RMS targets: rotor −27, motor/wheels −28, wings −30 and paper −33 dBFS. The environmental flow bed is unchanged. The movement bus still defaults to 50% with independent mute/volume.

The audition's Arcade selection now uses the arcade family instead of incorrectly falling through to FPV. Native browser check: 52/52 decode; rotor/wings/grain/wheels/motor ownership confirmed, movement mute clears both actor sources, no console errors. These checks establish integration, not subjective sound quality. Sustained human listening remains open; the previous broadband files are no longer the proposed production choice.

## Complete actor movement coverage

`game/ui/movement-profiles.mjs` owns explicit assignments for all 28 shipped player bodies and seven enemy roles across FPV, heritage, arcade and document worlds. `actor-movement-coverage.json` records the player/world/12-Journey-palette matrix. These reuse the five user-approved recorded ingredients with existing body-weight and role-rate variation; they do not add a new noisy layer or grow the bank.

Player selection follows the actual body, equipped class and FPV appearance override. Heavy lift uses rotors; fixed-wing and delta craft use motor recordings. Enemy sounds follow body recipes/skins before world defaults: tanks/wheeled patrols roll, rotor patrols hum, moths flap, paper enemies rustle and eroders use mechanical material. Company rotor/paper recipes override generic enemy-role topology. Team drifters/hunters/rovers and combat scouts have recorded mappings. Unknown uploaded/custom bodies use the role/family fallback.

Stationary bosses remain quiet until their real warning/attack/opening/defeat events; decorative glints do not generate sounds. Authoritative freeze, stun, dormant/idle and inactive states suppress locomotion. Movement controls, spatial limits, foreground warning clarity and four-layer budget remain intact. The audition now exposes every shipped player body, four worlds and all enemy/Team roles.


## Full-bank loudness calibration

User listening identified major jumps between cues. Measured previous maximum rolling 50 ms RMS: interference −7.4, deploy −8.4, impact −10.9, ESC start −18.7 and Ukrainian Armed −12.4 dBFS, against confirm −32.2 and warning −28.0. The prior producer skipped calibration entirely for action effects, radio and ESC cues; whole-file RMS and a peak ceiling also left some short variants mismatched.

`normalize_bank.py` now requires an explicit target for **every** effect family. It measures maximum rolling 50 ms RMS, applies role targets, gently shapes isolated one-shot transients, and limits sample peaks to −20 dBFS for one-shots / −16 dBFS for movement. This is a reproducible short-effect house measurement, not an EBU R128/LUFS certificate or a measurement of perceived loudness on speakers. Loops retain their recordings and receive scalar gain only; no movement timbre shaping is added.

Frequent cues target −33 to −37 dBFS; actions/results mostly −31 to −33; warnings −29. All capture tiers target −35, both radio locales −31, both ESC cues −32. Menu, radio and movement preference buses remain independent. Alternate confirm previews now use the same menu bus as the base confirm, correcting an additional audition-only volume jump. Full synthesis/processing masters are recalibrated on each build, with no third-party calls.

`loudness-report.json` records raw production input and final measurements. `docs/verification/spatial-audio/normalization-measurements.json` compares against the previous published branch bank and includes 192 kHz oversampled peak inspection. All files fall within 0.6 dB of their authored short-window target; repeated variants and matched radio/ESC/capture sets stay within 0.6 dB. Loudest oversampled one-shot peak is −19.3 dBFS. These are individual file measurements, not a guarantee about the summed mix or physical listening comfort.


## Recorded material and hardware polish — 2026-09-29

The bank now contains 56 cues. Ceramic courier, carved chest, woven basket and bell warden have distinct recorded gestures; ceramic Journey bodies and riveted workshop actors also use those material recordings. FPV/arcade eroders use a real ratchet. Existing approved wings, rotor, paper, rolling and electric motor ingredients remain intact. New loops use two to four separated gestures over 5.8–7.2 seconds, lower role targets and the existing movement opt-out, distance processing and voice limits. These are sparse movement accents, never additional stacked layers.

FPV start/retry now use the actual Orqa launch beeps in qubodup's CC0 recording 854646, traced to Sgt. Max Elliott's public-domain DVIDS video 1005552 at 1:06. The initial 640 ms and one 290 ms beep are isolated, high/low-pass filtered, faded and calibrated to −32 dBFS maximum 50 ms RMS. Preserve the source preview, checksum, attribution and `hardware-recipes.json`. This is real recorded hardware, **not a verified Betaflight/Bluejay power-on melody**. The earlier synthetic ESC sequence is superseded. The ambiguous boot/connection recording 854647 was rejected because its uploader cannot identify its sound source. Bluejay's published firmware melody was researched but not adopted; no GPL-3.0 firmware code is copied into this bank.

Sources and recipes remain reproducible from preserved bytes; licenses are presented in the shipped effect credits. New sounds still require user listening alongside music. No subjective comfort or physical hardware playback claim follows from file calibration.
