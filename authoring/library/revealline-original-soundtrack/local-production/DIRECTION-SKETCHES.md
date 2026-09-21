> **21 September 2026: production paused by user feedback.** Both A and B sketches were rejected because the melody and instrument rhythms do not feel synchronized. Preserve these recordings and their original receipts; do not generate or publish more AI originals. Prioritize verified licensed creator recordings and the local UA-FPV import packs. See [the current decision](../../../../docs/music-production-pause.md). Historical descriptions below remain evidence of the attempts, not current approval.

# Two short palette and groove directions

Both full Idle Frequency versions were rejected. The second feedback asks for more rhythmic force and a different instrument/melody palette. These new **38.7-second and 42.4-second sketches** test two alternatives before another complete arrangement is attempted. They contribute **zero** to the planned composition count and are not eligible for runtime publication.

## Diagnosis and new evidence

This diagnosis comes from the written score and DSP, not an assistant listening assessment. Arcade-v2 remained dominated by sine-based FM tones whose brighter modulation decayed within roughly 50–75 milliseconds. Its bass returned quickly to a rounded fundamental, and the drum foundation remained a quarter-note kick with a largely fixed backbeat. A high short-note melody competed with repeated arpeggios. Increasing tempo alone did not change those characteristics. The user judged the result too soft/slow and the wrong palette.

The creator's [Synthwave Industrial Technology listing](https://audiojungle.net/item/synthwave-industrial-technolgy/26517275) specifies **105 BPM**, synths, guitar, drums and percussion. [BOOMOPERA's Synthpop Supercar release](https://boomopera.bandcamp.com/album/synthpop-supercar) identifies its producer/composer and synthwave context. These support examining timbre, rhythmic weight and layered production rather than treating a larger BPM number as the solution. That is our design inference. Third-party game-rip names led to these references but do not establish verified soundtrack credits for XPOSED RELOADED. No game rip or creator recording was downloaded, extracted or copied. These commercial recordings are research references only; no reuse permission is assumed.

## The two original directions

**A — Retro Drive: 128 BPM, 38.736 seconds.** Newly written lower-register riff and answering melody over a saw/pulse bass with separately controlled sub, short chord stabs, and a punchier electronic drum design. Two-bar harmony gives the riff room. An eighth/sixteenth bass figure, alternating kick patterns and brief arpeggio replies provide motion. A two-bar drum/bass spotlight returns to the riff.

**B — Tracker Breaks: 140 BPM, 42.384 seconds.** Different notes, sustained FM-brass operators, a clipped mid-bass layer, and an authored syncopated breakbeat. Ghost snares, short retriggers and tom descents create a distinct rhythmic identity. The lead makes short statements with space for drum and bass replies.

Both use new local patches. Additive saw/pulse sources have bounded harmonics; pitched nonlinear voices are rendered at 2× rate and downsampled. The kick and gated snare have different body/transient design from the rejected renders. A brief kick-driven attenuation of pitched parts leaves attack space. Less reverberant backing and a separate drum bus reduce continuous masking. No recorded guitar, licensed samples, hosted model or existing musical transcription is involved.

## Verification and listening

| Sketch | MP3 integrated loudness | Estimated 4× true peak | Lossless master                                     |
| ------ | ----------------------- | ---------------------- | --------------------------------------------------- |
| A      | −16.038 LUFS            | −4.622 dBTP            | 24-bit / 48 kHz stereo FLAC; exact decoded PCM hash |
| B      | −16.031 LUFS            | −5.376 dBTP            | 24-bit / 48 kHz stereo FLAC; exact decoded PCM hash |

They are matched near −16 LUFS so the comparison is not simply a louder revision. Peak estimates use SciPy polyphase resampling, not a certified true-peak meter. Technical success does not certify musical quality or suitability. Both await user listening; full listening, in-game mixing and publication reviews remain incomplete.

- [A MP3](sketches/direction-a-retro-drive/preview.mp3) · [A receipt](sketches/direction-a-retro-drive/receipt.json)
- [B MP3](sketches/direction-b-tracker-breaks/preview.mp3) · [B receipt](sketches/direction-b-tracker-breaks/receipt.json)
- [Composer](compose_directions.py) · [Renderer](render_directions.py) · [Sketch index](direction-sketches.json)

Source hashes, written event scores, seeds, audio hashes and encoding/measurement versions are pinned in each receipt. Original candidate receipts and both rejected recordings are unchanged. No additional full composition was rendered.
