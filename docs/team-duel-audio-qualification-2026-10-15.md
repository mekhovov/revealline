# Team and Duel audio qualification — 15 October 2026

Scope: R11 of the Team/Duel follow-up, desktop browser on this Mac first. This
record covers implemented source corrections and native digital-output
qualification. It does not close subjective listening, physical speaker/headphone
quality, imported music mixing, or the separately waived paired human study.

## Demonstrated defects and correction

The new regression file initially failed five of six cases on the rebased source.

1. **Partially decoded sound bank silenced unrelated cues.** The old event director
   chose fallback only when its entire bank was empty. Loading a menu sound first
   therefore disabled fallback for an unavailable gameplay recording. Readiness is
   now checked per cue, with a ready variation used while another variation loads.
   A cue denied by its recorded cooldown does not receive a duplicate fallback.
2. **Native Team events lacked fallback recipes.** Emitter warnings, downed-player
   warnings, support, rescue completion, relay/stage objectives and erosion now
   retain immediate procedural feedback when their recordings are absent. Urgent
   fallback warnings use the existing warning channel, priority and interruption
   rules, including retiring incidental movement and dialogue.
3. **Duel fallback lost board ownership.** Simultaneous captures now retain separate
   board identities and placement. They no longer suppress the other board through
   a shared fallback cooldown. Terminal note layers also retain their owner's
   identity for cleanup.
4. **Paired rescue events could duplicate the recovery phrase.** Native
   `player.revived` and `rescue.completed` share the semantic fallback cooldown,
   matching recorded-cue coalescing. Each rescue produces one recovery phrase.

5. **Dense fallback phrases exceeded recorded-cue headroom.** Independent review
   reproduced 22 simultaneous feedback voices from eight native event shapes.
   Every procedural feedback layer now shares the recorded path's 16-voice and
   64-total ceilings. Higher-priority warnings may retire lower-priority effects;
   optional feedback cannot steal a music voice to make room.
6. **Recorded cues could remain pending at zero master volume.** A new regression
   reproduced a decoded warning allocated while volume was zero. Recorded
   playback now rejects that request, as fallback already did, so raising master
   volume cannot expose the expired one-shot.

These changes live in `game/ui/audio.mjs` and `game/ui/feedback-director.mjs`.
They do not change simulation, scores, routes, difficulty, saved content, audio
asset bytes or Studio slot schemas. Existing presentation replacements and shared
master/music/effects authorities remain in their existing paths.

## Event audit

| Native event                                          | Recorded cue / fallback behavior                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `emitter.warning`, `player.downed`, `rescue.started`  | Warning; centered priority-five fallback through the existing warning channel                            |
| `support.pulse`, `impact.intercepted`                 | Deploy; short support phrase                                                                             |
| `player.revived`, `rescue.completed`, `team.recovery` | Respawn; one rising recovery phrase                                                                      |
| `objective.captured` with `kind: relay` or `stage`    | Pickup; objective confirmation                                                                           |
| `shield.disabled`, `relay.opened`                     | Gate; rising gate-opening phrase                                                                         |
| `environment.eroded`, `cells.eroded`                  | Erosion; descending phrase                                                                               |
| `cells.claimed`                                       | Size-specific reveal recording or per-board capture phrase                                               |
| `run.completed`                                       | One host-owned result; board terminal cues remain suppressed in Duel, whose match result owns the ending |

Distinct recipes, retained event identities and numerical mono output are evidence
of differing signals, not proof that players can distinguish every cue in a busy
mix. Existing visual feedback remains available independently of audio.

## Source verification

Ten new focused regressions cover empty and partial recording banks, all listed
Team categories, simultaneous Duel captures, repeated-event/late-decode silence,
warning priority, master mute/zero, gameplay pause versus music-only pause,
recorded cooldowns, rescue coalescing and partially decoded variations, dense overlapping phrases/music preservation and
recorded zero-master expiration. They use
the real event director, note construction and authorities with a finite modeled
Web Audio boundary.

The new focused file passes 10/10. The initial combined core audio/director check
passed 68/68 before the final two edge cases were added. The broader first run
reported 106 passes and nine failures (including nested failures): all were
Couch keyboard master-volume assertions expecting Arrow alone to commit a value.
The latest main intentionally requires Enter → Arrow → Enter in native Settings.
A targeted repeat using original HEAD audio modules reproduced five failed test
nodes in the same cases. The tests now use the current explicit edit/confirm
journey and additionally verify that moving the draft does not commit a volume.
No navigation runtime was changed. The final five-file core cohort passes **93/93**. The complete Couch host run then passed 21/24 with three failures:
old paused-title copy, the obsolete Team Help path outside Settings, and an
unchanged Team picture-preparation timeout. The title now follows current
`PAUSED` copy and Help follows Settings → Extras → Help → Audio. Each of those
three cases passed its targeted recheck (one pass and 20 excluded cases per
invocation). A subsequent complete run of `couch-audio-master.test.mjs` and
`team-discovery-host.test.mjs` at rebased source `697d59fdd3e452a5e5b385028cface32fdc952fc`
passes all **37 test nodes**, with no failures, exclusions or cancellations.
After the landing-recovery change, the final combined host cohort at
`2a29a9dcfe7c61333c68dd80676205e67809e56c` passes **39/39**, including both
new recovery tests, with no failures, exclusions or cancellations. Integrated CI
remains its own gate. Changed runtime/tests pass targeted lint and format checks.
Model checks are not native decoding or listening evidence.

## Native digital-output probe

Serve this source and open
[Team and Duel sound check](verification/team-duel-desktop-audio/index.html).
Choose **Run cue check**, keep the page visible, then choose **Download report**.
The report is named `revealline-team-duel-audio-check.json`. Cancel or hiding the
page retires the check and closes only its owned audio context.

The probe uses actual `Soundscape` and `FeedbackDirector` dispatch, native WAV
decoding, oscillator fallback, the shared master, actual music/effects buses and
the compressor. It observes left/right channel samples after the compressor,
calculates `(left + right) / 2` for numerical mono, and records the module hashes,
user agent and sample rate. It does not replace the normal destination route.

The 28 observation scenarios comprise nine Team cue/overlap/result transactions
in recorded and deliberately partial-bank conditions, both Duel boards and zero-master/volume-restoration expiration in each
condition, then music alone, music plus warning, music-only Pause plus warning,
master muted, master zero and gameplay paused. Local default mixer gains remain;
the probe explicitly sets the shared master to 65%. It checks signal presence,
both Duel owners, scheduled warning ownership, mono presence, silence and sampled
headroom below 0.98. Preparation has a 20-second timeout and cancellation owns
late completion. It reads no game saves and writes no preferences. Soundscape may read its existing
menu/movement/radio preferences during construction; the probe does not adopt
player progress or music-library data.

Overlapping analyser windows are not unique PCM sample counts. These measurements
are neither true-peak/LUFS nor an acoustic latency or perceived loudness test.
They also do not establish headroom at every possible volume or imported-media
combination. The finite fixtures use actual native event shapes rather than
claiming a recorded human gameplay session.

Final native desktop-browser run on 15 October 2026 at 04:33 UTC:
[retained raw report](research/multiplayer-audio-native-2026-10-15.json).
The browser identified Chromium 155 on Mac, used a 48 kHz audio context, decoded
79 recordings and passed **60/60 checks across 28 observations**. Its four
runtime-module hashes match the final source. Its owned context ended `closed`.

| Measured case                                          | Peak / result                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Dense recorded Team overlap                            | 9 feedback voices, peak 0.082083                                           |
| Dense procedural Team overlap                          | 16 feedback voices, peak 0.222989                                          |
| Largest sampled peak across this run                   | 0.222989, below the probe's 0.98 threshold                                 |
| Both Duel boards                                       | Both owners retained with recorded and fallback cues                       |
| Recorded and fallback zero-master → volume restoration | Zero scheduled voices and exactly zero measured peak/RMS after restoration |
| Master muted / master zero / gameplay paused           | Peak and RMS exactly zero in each measured window                          |
| Music plus warning / music-only Pause plus warning     | Warning remained scheduled; output present                                 |
| Mono downmix                                           | Nonzero signal for all expected-output observations                        |

These results establish native decoding and digital cue/mixer behavior for the
stated fixture, source and volume. They do not establish perceptual equivalence
between recorded and fallback sounds; differing RMS measurements alone did not
justify a gain adjustment. Cancellation is implemented but was not exercised by
this successful receipt.

The [04:24 UTC precursor report](research/multiplayer-audio-native-before-headroom-2026-10-15.json)
retains its 50/50 checks across 24 observations before independent review added
the dense-headroom and recorded-zero-master regressions. It is historical evidence,
not the final-source qualification. Its earlier maximum peak of 0.104993 came
from the smaller fixture set and must not replace the expanded result above.

## Remaining boundary

A person listening on the intended speakers/headphones still needs to assess
warning masking, discomfort, cue recognition, mono listening and music/SFX fit.
Imported Sound Studio replacements and MP3 libraries need their own listening
review. The implemented fallback and measured digital probe cannot substitute
for that evidence. No human-playtesting gate has been reopened.
