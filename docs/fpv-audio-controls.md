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

Run `node scripts/qualify-fpv-audio-mix.mjs --output /tmp/fpv-audio-mix-candidate.json`
for the functional graph qualification. It exercises production sound modules,
rendered slider callbacks, source-to-bus routing, parameter changes, persistence,
mute, pause, focus loss and disposal through an instrumented Web Audio boundary.
The [evidence receipt](evidence/fpv-audio-mix-20261001.json) binds the exact source
hashes and observed outcomes. This is not an acoustic listening assessment or
actual browser autoplay qualification. Browser checks, package admission and
physical sound-quality assessment are separate; additional unit coverage remains
deferred to the final phase.

The graph qualification was repeated after integrating the final graphics and
Acro teaching branches; the receipt's source hashes bind that combined candidate.
The integrated root browser also verified three settings sliders, one master
mute, motor zero surviving reload, restoration to 100%, and successful shader
preparation and start of the first Acro demonstration. Regenerate graph receipts
separately from the committed human-readable browser observations.

Browser verification of final feature head `34da5274f` on the local source page
(1 October 2026, parent-agent verification) confirmed:

- Settings contains exactly one master sound control and three accessible sliders
  in both English and Ukrainian. The mixer fits within the scrolling panel.
- Interface 99%, motors 0% and ambience 99% survived reload while master sound
  remained off.
- Setting World Studio's interface slider to 0% with Home appeared as 0% in
  Academy Flight options. Setting Academy's interface slider to 100% with End
  appeared as 100% in World Studio. Master sound stayed muted throughout.
- All sliders were restored to 100% after verification. Browser logs contained no
  errors or warnings.

The Ukrainian screenshot is retained locally at `/tmp/fpv-audio-controls-uk.jpg`.
These checks demonstrate UI behavior and persistent cross-view preferences; they
do not establish audible perception, acoustic quality or physical hardware
performance. No listening or hardware acceptance is claimed.
