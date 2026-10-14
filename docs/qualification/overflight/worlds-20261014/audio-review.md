# Native sound review — 14 October 2026

These four 20-second recordings were exported through the native Diagnostics recorder in an automated Riy run. They contain the actual shared effects/voices bus, with stereo Opus audio at 48 kHz. Recording overhead excludes this run from performance qualification.

| File | Approximate gameplay interval | Raw mean / peak level |
| --- | --- | --- |
| `riy-field-opening-audio.webm` | 00:10–00:30 | −51.2 / −31.2 dBFS |
| `riy-field-developing-audio.webm` | 00:48–01:08 | −50.7 / −31.2 dBFS |
| `riy-field-approach-audio.webm` | 01:30–01:50 | −50.1 / −30.9 dBFS |
| `riy-field-elite-audio.webm` | 02:08–02:28 | −50.0 / −29.4 dBFS |

Intervals include any automatically resolved upgrade pauses. The recorder captures battlefield pixels, so HUD and upgrade cards are absent. The last slice covers the elite encounter period; it is not a final-tank recording.

`riy-opening-elite-listening-plus24db.mp3` joins the opening and elite audio, adding **24 dB for listening only**. It does not represent a change to engine gains. The original WebM files preserve the unaltered mix. Both real audio presence and unclipped sample peaks were checked using FFmpeg; these checks do not establish subjective sound quality.

The run uses Field Crossing, Standard difficulty, three airframes, seed 17031991, Interceptor handling, and the `fan-shield` review pilot. Master volume is 65%, effects 70%, movement 50%, Humanoid reactions enabled, spoken commentator disabled. The captured sound is quiet at those settings and needs listening review. Existing soundtrack music played through its native media owner and is deliberately outside the effects recorder tap; warning audibility against music therefore remains unqualified by these files.

All footage was captured from the working implementation before its final commit. `audio-evidence.json` records the base commit, settings, original file sizes and hashes. The later armor-break reaction suppression fix is covered by automated tests; this Riy capture does not exercise Raid armor breaks. No microphone, system-audio capture, external sound download or second AudioContext was used.

## Implemented and checked

- Three quiet procedural world ambiences use the existing effects owner, with bounded voices and cleanup on pause, retry and disposal.
- Hostile charge accents follow actual remaining warning time. Cancelled warnings do not play deferred cues.
- Riy escorts use distinct short accents with a shared cadence cap and no backlog after suppressed cues.
- Damage, hostile warnings and armor changes take priority over repeated reactions and ambience. Classic/Reactions remains independent of visual gore.
- The shared mixer rejects inaudible sources before reserving a cooldown, benefiting Solo, Team, Snake, Overflight and SIM callers using that mixer.

Automated tests verify scheduling, ownership, preferences and interruption. Native captures demonstrate real output. Human judgments about appeal, repetition and complete music-mix readability remain review items.

## Final Raid capture

`raid-armor-audio.webm` was recorded from revision `c90a4a663b7d2355195ca7515ea2a54edd0e76ac` through the same native recorder. It covers approximately 00:06–00:26 of Field Crossing’s objective-route review (Standard, three airframes, seed 17031991, Scout/standard handling), including machinery approaches and command-tank combat. The sortie subsequently completed at 00:28 with seven armor breaks and no hull damage. Audio is stereo Opus, 48 kHz, approximately 20.01 seconds; raw mean −53.1 dBFS / peak −31.7 dBFS. `raid-armor-listening-plus24db.mp3` adds 24 dB solely for convenient review. No runtime gain was changed. The separately playing native soundtrack is excluded from the capture, so warning audibility against music is still a human review gate.

The final audit found a cross-frame priority gap: an ordinary impact could reserve the shared cooldown just before hull damage. Revision `941246ed2` separates the two bounded channels. The adapter-to-mixer regression verifies immediate damage admission and reaction interruption while repeated ordinary impacts remain capped. Forty-two relevant tests passed. Earlier native clips precede this scheduling-only correction.

## Complete-build effects comparison

Final source `a539ccde4d2390ee74a717a076f43926f46952b2` was captured in a fresh Field Crossing/Standard/three-airframe/Scout run, seed 17031991, with the earned `fan-shield` pilot. `fan-normal-effects-audio.webm` begins around 03:20 and `fan-reduced-effects-audio.webm` around 04:12. Each records about 20 seconds of native 960×540 battlefield pixels and stereo effects audio. The later build contains Fan 4, Slow Field 3, Side Burst 3 and Shield 1. Reduced effects was changed through the shared Accessibility setting and restored afterward. These are different moments in one run, not identical-state comparisons or a three-world coverage claim. The reduced-effects clip contains 600 changing frames; the diagnostic screenshot is from 05:06. Recording and concurrent build work exclude these runs from performance qualification.
