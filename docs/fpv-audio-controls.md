# FPV simulator audio mix

World Studio settings now expose three independent levels: **Interface & feedback**
(shared menu sounds, gates, impacts and combat cues), **Drone motors**, and
**Environment & wind** (wind and environmental hum). Academy exposes its existing
menu audio through the same Interface level. Academy does not load World Studio's
motor or ambience engine, so it does not show controls for absent sound paths.

The sliders share the versioned `revealline.fpv.audio-mix.v1` preference across
simulator views on the same origin. Other open views refresh on storage changes
and focus. English and Ukrainian labels identify each native keyboard-accessible
slider, including its current percentage. If browser storage fails, changes remain
usable for the current visit.

Existing master mute choices are preserved. A fresh profile is muted; changing a
volume never enables sound, creates an audio context or resumes a paused context.
The master controls retain selected levels while muted. Menu cues keep the
existing explicit-activation and focus/visibility gating. World sound retains the
existing deliberate flight resume and pause lifecycle.

Each world audio family routes through its own gain bus before the existing
master gain. Interface volume also controls existing menu samples; their identity
and bytes remain unchanged. Changes ramp over 25 ms to reduce discontinuities.
Setting interface volume to zero also stops existing short cues and prevents new
cue voices. All added gain buses disconnect on disposal. No runtime dependency,
asset, package limit or flight-model value was added or changed.

Run `node scripts/qualify-fpv-audio-mix.mjs --output docs/evidence/fpv-audio-mix-20261001.json`
for the functional graph qualification. It exercises production sound modules,
rendered slider callbacks, source-to-bus routing, parameter changes, persistence,
mute, pause, focus loss and disposal through an instrumented Web Audio boundary.
The [evidence receipt](evidence/fpv-audio-mix-20261001.json) binds the exact source
hashes and observed outcomes. This is not an acoustic listening assessment or
actual browser autoplay qualification. Browser checks, package admission and
physical sound-quality assessment are separate; additional unit coverage remains
deferred to the final phase.
