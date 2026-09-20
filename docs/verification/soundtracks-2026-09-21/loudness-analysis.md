# Licensed recording loudness and peak analysis — 2026-09-21

All 24 registered runtime MP3s were fully decoded and analyzed. Their original byte counts, frame counts, sample rates and SHA-256 hashes match the earlier decode receipt; every source hash was also checked again after measurement. No audio files or runtime code were changed.

Integrated loudness spans **-16.06 to -6.72 LUFS** (9.34 LU). The largest **estimated true peak is +1.18 dBTP**. 16 recordings have an oversampled estimate above 0 dBTP. These are unadjusted recording measurements, not the game's combined output after player volume, crossfades and sound effects.

## Method

- Apple CoreAudio `/usr/bin/afconvert` decoded each MP3 to one temporary 32-bit floating-point stereo WAV. Processing was sequential and the WAV was deleted after each track.
- Integrated gated loudness used [pyloudnorm](https://pypi.org/project/pyloudnorm/) 0.2.0 with its BS.1770-4 algorithm, DeMan weighting filters, 400 ms blocks, 75% overlap, −70 LUFS absolute gate and −10 LU relative gate. Input to the meter was float64 stereo at the decoded sample rate.
- The peak estimate used [SciPy resample_poly](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.resample_poly.html) 1.18.0 at 8× oversampling, default-length FIR, Kaiser beta 8.6 and zero padding at actual recording boundaries. Blocks contain 65,536 input frames with 256-frame overlap trimmed after interpolation. The maximum absolute interpolated sample across both channels was converted to dB relative to digital full scale.
- A deterministic stereo-noise check compared chunked and whole-array interpolation across two internal boundaries; their measured maximum peaks were identical within 1e-12. This checks the chunking implementation, not standards certification.
- Python 3.12.14 and bundled NumPy 2.3.5 were used in an isolated `.cache` environment. The small analysis libraries came from normal PyPI downloads; no model installation was needed. See [dependency pins and downloaded-wheel hashes](analysis-dependencies.json).

**The true-peak result is an oversampled estimate, not a formally certified ITU/EBU meter result.** Decoding and interpolation cannot recover clipping already present in a source or decoder output. These measurements do not certify musical quality, loop seams, in-game balance, cultural accuracy, or full listening acceptance. No normalization or gain adjustment was applied.

The [machine-readable receipt](loudness-receipt.json) contains the exact settings, source hashes, implementation check and per-track measurements. Reproduce from the repository root using [loudness-analysis.py](loudness-analysis.py) with the recorded dependency versions. This supplements the [earlier decode and rights verification](licensed-recordings.md).

| Recording                                                                          | Integrated loudness (LUFS) | Sample peak (dBFS) | Estimated true peak (dBTP) |
| ---------------------------------------------------------------------------------- | -------------------------: | -----------------: | -------------------------: |
| Holizna — Drama                                                                    |                     -13.25 |               0.00 |                      +0.17 |
| Holizna — Retro Soundtrack                                                         |                     -13.11 |               0.00 |                      +0.21 |
| Holizna — Cyber Anxiety                                                            |                     -13.07 |               0.00 |                      +0.10 |
| Holizna — Lost In The Jungle                                                       |                      -9.44 |               0.00 |                      +0.47 |
| Holizna — Night Life                                                               |                     -16.06 |               0.00 |                      +0.07 |
| Holizna — Day Dreams                                                               |                     -11.26 |               0.00 |                      +0.38 |
| Holizna — Fires Uptown                                                             |                     -13.78 |               0.00 |                      +0.12 |
| Holizna — Mutant Club                                                              |                      -7.88 |               0.00 |                      +0.87 |
| Holizna — We used To Dance                                                         |                     -13.35 |              -0.73 |                      -0.68 |
| Holizna — Machines With Feelings                                                   |                     -13.43 |               0.00 |                      +0.60 |
| Holizna — Retro Synths                                                             |                     -10.28 |               0.00 |                      +0.68 |
| Holizna — 50 Over The Speed Limit                                                  |                      -8.42 |               0.00 |                      +1.18 |
| Holizna — Dear Mr Super Computer                                                   |                     -10.53 |               0.00 |                      +0.39 |
| Emma_MA — Megasong                                                                 |                      -6.72 |               0.00 |                      +0.82 |
| HydroGene — Determination                                                          |                      -8.55 |              -0.27 |                      -0.27 |
| Vitalezzz — Silver Bullet                                                          |                      -8.54 |               0.00 |                      +0.61 |
| Vitalezzz — Devoted Guard                                                          |                      -6.80 |               0.00 |                      +0.38 |
| 3xBlast — A Band of Jellyfish                                                      |                     -10.96 |              -4.84 |                      -4.68 |
| 3xBlast — Babe, You Look Poggers Tonight!                                          |                     -10.95 |              -2.61 |                      -2.61 |
| 3xBlast — If You're Thinking About Giving Up, Think Again Beause I Believe In You! |                     -10.96 |              -4.01 |                      -3.91 |
| 3xBlast — Let's Go, Olive Boy!                                                     |                     -10.93 |              -2.10 |                      -2.07 |
| 3xBlast — Now This Is A Waterpark!                                                 |                     -10.95 |              -0.02 |                      +0.02 |
| 3xBlast — Thanks For Listening!                                                    |                     -10.89 |              -0.45 |                      -0.29 |
| 3xBlast — The Best Move Is To Keep Going                                           |                     -10.95 |              -2.23 |                      -2.21 |
