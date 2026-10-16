# FPV radio across simulator views

World Studio did not restore an already verified USB radio mapping when entering
a flight. Its stick controls were also hidden unless Touch was selected, making
it difficult to distinguish detection, arming and actual flight input.

World Studio and the original FPV simulator now share verified-profile discovery.
They match the full device identity, support reconnecting at a different browser
index and reuse the tested TX15 default when appropriate. Unknown devices and
ambiguous matches still require Setup. Discovery never arms the drone or replaces
unsaved calibration edits.

World Studio shows live calibrated radio sticks while ready, paused and flying.
The display follows the configured stick mode. Compact, expanded and setup-only
display preferences persist; touch interaction is available only with Touch
selected. Playback displays the recorded commands and cannot acquire radio input.
The original simulator also shows live calibrated sticks and clears unavailable
input. Flight handling and recording formats are unchanged.

A new attempt clears old pickup positions. A paused or recovered attempt retains
its expected controls, and reconnecting with an already-on arm switch cannot
resume it automatically. A bound switch must actually be on before arming.
Setup preserves existing verified mappings and keeps edited fields during device
refresh. Both optional package closures include the shared discovery module.

## Functional verification

The owner confirmed that the physical TX15 now controls flight on the source
World Studio page. Controlled Gamepad checks additionally verify behavior that
cannot be reliably reproduced by passively observing a physical controller.
The checked browser matrices and final portable-build identity are recorded in
`fpv-radio-worlds-verification.json`.

Verification covers real model movement, command values, all 60 catalogue
challenges in Self-level and Acro, lifecycle and input ownership, original FPV,
Setup and display behavior. These are development acceptance observations;
they do not certify every radio, browser or physical device. Additional unit
coverage remains assigned to final qualification, per the owner's instruction.
