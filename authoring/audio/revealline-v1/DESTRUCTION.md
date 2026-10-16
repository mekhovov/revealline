# Destruction sound production

The shared bank contains five material families, each with three distinct recordings:

| Family           | Files / cue IDs                                                      | Length | Material intent                              |
| ---------------- | -------------------------------------------------------------------- | ------ | -------------------------------------------- |
| Infantry         | `destroy-soft`, `destroy-soft-1`, `destroy-soft-2`                   | 220 ms | Dry punch and equipment thud                 |
| Armored infantry | `destroy-armored`, `destroy-armored-1`, `destroy-armored-2`          | 300 ms | Body impact with metal and plate fragments   |
| Light machinery  | `destroy-light`, `destroy-light-1`, `destroy-light-2`                | 450 ms | Crunchy mechanical burst                     |
| Heavy machinery  | `destroy-heavy`, `destroy-heavy-1`, `destroy-heavy-2`                | 750 ms | Deeper explosion, low-frequency body, debris |
| Electronics      | `destroy-electronic`, `destroy-electronic-1`, `destroy-electronic-2` | 300 ms | Short electrical discharge and metal snap    |

All outputs are mono 48 kHz 16-bit PCM WAV. The 15 runtime files total 582,420 bytes;
uncompressed decoded float buffers occupy approximately 1.11 MiB. Variants use different
source recordings, rather than only changing the pitch of a single recording. Family choice,
rate variation, distance, gain, voice budgets and gore preference remain runtime policies.
There are no human vocalizations or mandatory gore layers in this bank.

## Sources and rights

Exact selected originals and their embedded licenses are preserved in
`originals/kenney-destruction-v1/`. The `sources.json` ledger records source page, download
address, archive checksum, embedded license checksum and each retained file checksum.
Archives were inspected in memory and were not retained. Only 20 selected OGG files and
their small license/ledger files are retained, totaling 274,892 bytes at intake.

- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), release 1.0.
- [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), release 1.0.
- [Kenney Digital Audio](https://kenney.nl/assets/digital-audio).
- [Kenney's official usage guidance](https://kenney.nl/support) confirms CC0 and optional credit.

All three embedded licenses state Creative Commons Zero. These originals and RevealLine's
derived sound arrangements may be copied, edited and redistributed in editable Studio
packages under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Credit Kenney
as a courtesy; do not use their logo or imply endorsement.

The choice of short variants, bounded simultaneous playback and warning priority follows
established game-audio practice. See [FMOD's instance-limit explanation](https://www.fmod.com/docs/2.03/studio/advanced-topics.html#stealing-and-virtualization)
and [playlist variation explanation](https://qa.fmod.com/t/explanation-on-new-multi-instrument-playlist-behaviours/14145).
These are design references, not additional runtime dependencies or sample sources.

## Reproduce

From the repository root, with Python 3 and ffmpeg available:

```sh
python3 authoring/audio/revealline-v1/produce.py --destruction --audition docs/qualification/audio/destruction-20261005/audition.wav
```

The producer verifies every retained source and license hash before decoding, writes only
the 15 destruction WAVs and their marked section of `game/audio/effects/bank.mjs`, and
updates `destruction-production.json`. Existing effect files and existing bank entries remain
unchanged. The scoped implementation is in `produce_destruction.py`; omitting `--destruction`
runs the historical general-purpose pipeline and then appends this new bank. Its original
source and dependency requirements remain separate from the small retained destruction set.

Processing is explicit and deterministic: decode/resample to mono 48 kHz float PCM,
bounded rate change, 65 Hz high-pass, recipe-specific low-pass, remove leading silence
while retaining 1 ms of pre-roll, normalize source peaks, combine weighted layers, apply
1.5 ms attack and bounded release fades, smooth transient shaping, then calibrate a
single gain scalar to both the family's loudest 50 ms window and a -20 dBFS sample-peak
ceiling. No runtime compressor is assumed. ffmpeg's actual version is recorded; a decoder
version change can change derivative bytes and must be reviewed.

The generated production report records exact bytes/hashes, source recipe, measured
duration, RMS, maximum 50 ms RMS and sample peak for every derivative. Integer
quantization may change a target measurement by a fraction of a decibel.

Published Studio replacements are measured once after decoding. Playback applies only
attenuation, never amplification, to meet the same family 50 ms RMS target and -20 dBFS
sample-peak ceiling. Their original audio bytes and decoded samples remain unchanged.
For multichannel imports, summed channel magnitudes provide a conservative bound even
when channels have opposite polarity or are downmixed. Nonfinite audio, invalid decoded
shapes and clips longer than one second are unavailable as destruction replacements.

The procedural fallback's tone and noise layers are calibrated separately. Run
`node authoring/audio/revealline-v1/fallback-level-check.mjs` to reproduce the numerical
comparison in `destruction-fallback-levels.json`. It models the actual base WAVs and
director fades against the oscillator envelopes and deterministic bandpass noise.
Current fallback maximum 50 ms RMS is 0.6–2.2 dB quieter than the corresponding
recording, including the optional brutal emphasis. This bound catches missing-pack
volume jumps; it is a numerical regression model, not browser DSP or listening evidence.

## Review

`docs/qualification/audio/destruction-20261005/audition.wav` plays the five families in table
order, with all three variants per family and 550 ms of silence between clips. Its adjacent
JSON provides exact timestamps. It uses the authored level without extra gain, effects or
music. The existing `authoring/audio/revealline-v1/audition.html` also discovers these cues
from the shared bank and plays them through the real director after explicit Start audio.

Technical checks verify format, hashes, finite signal, headroom, fade endpoints and differing
variants. They do not certify perceived quality, hardware playback or mix readability. Listen
with the game's music and rotor loops, on speakers and headphones, before release; confirm
warnings remain clear during horde clears and distinct materials remain recognizable.
