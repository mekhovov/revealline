# Hidden-page observation — incomplete checkpoint

The [preserved checkpoint](browser-observation-hidden-checkpoint.json) ends at **2026-09-29T04:06:43.972Z**, after **2,147.0033 wall-clock seconds**, with 429 samples and 107 events. It is an exact copy of a stable DOM export, **988,624 UTF-8 bytes**, SHA-256 `9f55f436e35c9e8bdb643c25db3dade178f681fdcac162a6aa9f7f580dca1f77`. Runtime and harness source remain frozen at `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`; final source/storage comparisons are still pending. This checkpoint is separate from the earlier visible-only review and does not complete the requested two hours.

## Measured hidden execution

Both observer and game documents report `hidden` during these two visibility-event intervals. No browser steering or new observation was performed to collect this evidence.

| Elapsed interval, seconds | Duration, seconds | Hidden samples |
| ------------------------- | ----------------: | -------------: |
| 1759.2854–2045.5994       |          286.3140 |             58 |
| 2067.0066–2117.7242       |           50.7176 |             11 |
| Total                     |          337.0316 |             69 |

Of those samples, 26 show live autoplay, 42 show recorded play and one catches preparation. There are **seven scene adoptions while hidden**, six in the first interval and one in the second. The samples show:

- Courtyard Exits advancing from **37% / 16 seconds to 74% / 48 seconds**, followed by Orchard Crossing at elapsed 1796.1405 seconds.
- Orchard Crossing advancing from **0% / 0 seconds to 51% / 29 seconds**.
- Recorded Relay Orchard reaching **68% / 45 seconds**, Crosswind **66% / 46 seconds**, First Signal **47% / 30 seconds**, and Night Patrol **69% / 46 seconds** before visibility returned.

HUD values often remain at their preceding display until a transition or visible refresh; these are observed milestones, not continuous authoritative simulation ticks. The evidence does establish execution and rotation during genuinely hidden intervals. It does not establish exact replay checkpoints or complete every background acceptance case.

## Rendering and independent intent

All 69 hidden samples retain an unpaused spectator, no practice, neither document focused, and music transport `playing`. No explicit demo or music Pause was exercised during these intervals. The earlier independent Pause checks remain visible-only.

The observer skips every hidden canvas sample with `sampled:false, reason:hidden-page`. This establishes that the observer did not read hidden pixels; it cannot independently prove that the game performed no painting. After each visible return, the immediate sample still contains the preceding display. The following sample shows an advanced board:

- Courtyard Exits: **71% / 31 seconds**, checksum `25e26bc5` → `89985de3`.
- Orchard Crossing: **39% / 29 seconds**, checksum `25e26bc5` → `e8cce38a`.

Music retains its playing intent, but the constant title and transport label do not prove audible output, uninterrupted decoding, track boundaries or absence of a restart.

## Health and remaining limits

The checkpoint contains zero captured diagnostics, observer attachment failures, child navigations, long gaps, clock discontinuities or dropped observations. Maximum sample gap is **5.2217 seconds overall**, **5.0949 seconds while hidden**. No source was changed and no failing evidence was replaced during this review.

The report remains explicitly incomplete, with source/storage terminal checks pending and `releaseQualified:false`. Continue the existing run through its automatic end. Explicit Pause across hidden/visible changes, OS freeze/recovery, native behavior, physical audio/input and unfamiliar-viewer comprehension remain separate checks. The prior real-Worker watchdog failure remains preserved and unexplained.
