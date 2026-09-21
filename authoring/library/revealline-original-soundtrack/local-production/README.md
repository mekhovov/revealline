> **21 September 2026: production paused by user feedback.** Both A and B sketches were rejected because the melody and instrument rhythms do not feel synchronized. Preserve these recordings and their original receipts; do not generate or publish more AI originals. Prioritize verified licensed creator recordings and the local UA-FPV import packs. See [the current decision](../../../../docs/music-production-pause.md). Historical descriptions below remain evidence of the attempts, not current approval.

# Local original recording candidates

## Short direction review

After both Idle Frequency versions were rejected, two new **38.7s / 42.4s** original sketches test a different palette and groove. They count as **zero** full compositions and remain unpublished. [Compare A and B](DIRECTION-SKETCHES.md). Further full rendering is on hold.

## Arcade menu revision after user feedback

The original **Idle Frequency was rejected by the user as too slow and unsuitable**. Its bytes and receipt are preserved. A new **144 BPM / 2:35** composition is available as [Idle Frequency — Arcade Revision](candidates/idle-frequency-arcade-v2/preview.mp3), with new melodies, immediate drums, syncopated bass and pulse-preserving breaks. The user also rejected this revision as too soft/slow and the wrong sound palette. It remains unpublished. See [second feedback](idle-frequency-arcade-v2-feedback.json). Further full rendering is on hold. See [reference research, score and exact changes](RETRO-REVISION.md) and [recorded feedback](idle-frequency-feedback.json). The initial seven-recording measurements below describe the original batch; the revision adds a separate 31.8 MB FLAC and 5.0 MB MP3.

These are actual, complete, locally rendered original compositions, separate from
the 36 retained production briefs. Six pilots provide one menu and one gameplay
recording for each primary family. **Steel Kolomyika** is an additional Ukrainian
and metal fusion candidate. `../ready.json` remains empty: a measured recording is
not a listening, cultural, gameplay-mix or publication approval.

Open [the local audition page](audition.html), or play each `preview.mp3` with a
normal audio player. Nothing autoplays. These files are candidates, not an approved
game soundtrack or a claim of studio-quality instrumental realism.

| Recording                           | Primary family             | Role     | Written direction                                                                                        |
| ----------------------------------- | -------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| Idle Frequency                      | 90s synth                  | Menu     | FM keys, rounded bass, held melodic answers and a sparse pedal bridge                                    |
| Glass Highway                       | 90s synth                  | Gameplay | Syncopated FM hook, octave bass, contrasting high-register B theme, counterline returns                  |
| Embers at Rest                      | Metal                      | Menu     | Clean synthesized low strings, open voicings, sparse toms and a percussion-free bridge                   |
| Furnace Heart                       | Metal                      | Gameplay | Double-voiced muted/open string riffs, kick accents, answering lead, clean break and half-time section   |
| First Light / Перше світло          | Ukrainian-inspired         | Menu     | Original plucked-string sentence and synthetic wind replies over changing inner voices                   |
| Spring Circuit / Весняне коло       | Ukrainian-inspired         | Gameplay | New call-and-response material, widening melodic register, hand-percussion synthesis and electronic bass |
| Steel Kolomyika / Сталева коломийка | Ukrainian-inspired + metal | Finale   | Compact duple dance cells, riff answers, open-string break and developed final return                    |

All melodic material, note placement and arrangement are GPT-authored for this
project. No commercial melody, MIDI transcription, recording, sample library,
model weights or hosted music generator is used. The entire sound palette is
local DSP: FM, additive/modal string models, subtractive tone shaping, synthesized
percussion and stereo reflection sends. Guitar drive runs at 4x sample rate with
filtering before downsampling; left/right string voices have separate timing and
small tuning offsets. This does not make them recorded or authentic guitars.

The Ukrainian candidates draw structural direction from the companion research
and briefs: original call/answer phrasing, plucked/wind contrasts, and brisk duple
dance organization for Steel Kolomyika. They do **not** contain recorded bandura,
sopilka, tsymbaly or fiddle; they are not folk-song transcriptions, representative
of all Ukrainian regions, or culturally approved. Practitioner/regional review
and human full-track listening are pending.

## Reproduction

`compose.py` writes the inspectable event scores in `scores/`. Each event fixes
its onset, MIDI pitch, duration, gain, pan and articulation. Seeds and source
hashes are recorded alongside the audio. `render.py` refuses to replace an
existing candidate receipt and refuses source changes during a render.

Use an existing Python 3.12 environment containing NumPy, SciPy and pyloudnorm,
the existing local lameenc package, and macOS `/usr/bin/afconvert`. No packages
are installed by these scripts. The receipts identify exact library versions.

```sh
python compose.py
python test_production.py
python render.py scores/idle-frequency.json \
  --scratch /absolute/path/to/empty-production-scratch \
  --encoder-path /absolute/path/to/existing/lameenc/packages
```

Render one score at a time. To make a revised recording, preserve the old receipt
and move that candidate directory aside first. Do not replace reviewed assets
in place. The first local pass was followed by a source-pinned pass; its hash
comparison is retained in `revision-history.json`. Embers' final revision changes
its melody from an FM lead to the clean-string voice.

Every candidate directory contains:

- `master.flac`: native 48 kHz, stereo, 24-bit lossless master.
- `preview.mp3`: 48 kHz stereo, 256 kbps, generated from the master with seeded
  triangular dither for the encoder's 16-bit PCM input.
- `receipt.json`: source/audio hashes, actual duration, measured levels, exact
  FLAC-to-PCM round-trip result and explicit pending reviews.

The master is synthesized in half-second output blocks, then mastered from one
bounded disk-backed float render. The current sound engine retains at most 24 MiB
of reusable voices plus active note tails. It does not decode the whole album.
Temporary PCM is deleted only after its dependent output is checked. FLAC is
decoded back to 24-bit PCM and compared by SHA-256 before the temporary master
is removed. The delivered MP3 is fully decoded independently for measurement.

Disk guards preserve at least 1 GiB free, restrict scratch to 256 MiB and total
active local production to 650 MiB. The expected allocation is checked before
large temporary files are created; processing is sequential. The guard may stop
if another process consumes the remaining space. Never delete user files or
downloads to make a failed budget check pass.

## What the measurements establish

`pyloudnorm` measures BS.1770 integrated loudness. The target for the decoded MP3
is −16 LUFS, accepted from −17 to −15. A 4x `scipy.signal.resample_poly` peak
estimate uses overlapping blocks and must stay at or below −1 dBTP. This is an
oversampling estimate, **not certified true-peak metering**. Native codec decode,
finite PCM and an exact FLAC round trip are checked. These do not establish
musical quality, absence of every audible artifact, authenticity or listener
preference. Full listening, headphones/small-speaker/mono checks, in-game warning
clarity, long-repeat fatigue and inter-track transitions still need review.

The compiler accepts WAV or native-resolution FLAC and emits catalogue v2 only
after all pre-existing approval gates pass, exact file pins match, and an explicit
track/hash-bound rights policy permits web playback. Offline caching, sharing,
modification, gameplay video and Content ID states are separate policy fields.
No candidate is promoted automatically from these measurements.
