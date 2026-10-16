# World flight callback and pause qualification

World Studio now checks the actual callback execution clock before reading a
controller, radio/menu action or advancing flight. A queued animation callback
can carry an old timestamp after a stall. A gap over 250 ms pauses the drone,
actors, projectiles and mission clock before that callback consumes input.
The existing animation-timestamp check remains. Resume never catches up time.

The watchdog retains a fresh execution-time anchor when flight is armed, paused,
started or playback speed changes. In particular, controller arming inside a
callback cannot leave the first following callback unguarded. Simulation time
continues to reset separately, preserving the fixed-step integrator.

The P shortcut works while a flight HUD button has keyboard focus. Editable
fields keep their normal input, and Space on a button keeps native activation
instead of becoming a fire command. Existing radio OFF→ON/pickup and fire-release
requirements remain in force.

## Functional evidence

- `fpv-world-lifecycle-baseline-verification.json`: 12/12 checks reproduce the
  prior defect against host commit `02ac74d42`; a real callback gap over 310 ms
  combined with a queued timestamp only 20 ms later advances the old host.
- Source and prepared-player receipts each pass 69/69 checks across keyboard,
  touch, controller and calibrated-radio samples. They cover moving actors,
  live projectiles, unchanged complete dynamic state during a stall, no held-input
  restart/catch-up, deliberate resume, released fire, focused buttons and the
  first callback after controller arming.
- The actual rendered player was also opened in the Codex Chromium browser.
  Native Space activated Arm/resume, then P on the focused Menu button opened the
  paused menu. No application errors were reported. Original Touch/Self-level/
  Chase preferences were restored after the spot-check.
- Formatting and focused lint pass. The simulation model, commands and proof
  formats are unchanged. Additional unit coverage remains deferred to R7.

Prepare a fresh fixture with
`node scripts/prepare-fpv-world-lifecycle-verification.mjs --out dist/fpv-world-lifecycle-verification-NAME`.
Use `--candidate-base dist/PREPARED-PLAYER` for a packaged host. The generator
pins the baseline host, freezes unchanged copies of the candidate module closure
under unique URLs, verifies hashes before/after the run, rejects overwrites and
requires an actual browser run. A real HTTP iframe avoids synthetic location
behavior. The maintained harness lives in
`docs/evidence/fpv-world-lifecycle-browser-harness.html`.

The fixture uses production HTML, input adapters and flight/actor physics with
a renderer lifecycle stub and controlled DOM/Gamepad samples. It does not measure
GPU performance or qualify physical radios, iPhone/Steam Deck hardware, browser
background scheduling or player acceptance. Its clock is real; only animation
callback delivery is controlled. Named-device qualification remains item B work.

## Publication

This is the software lifecycle increment within B, following checkpoint-practice
PR #951. Package admission and exact GitHub publication status are recorded in
the delivery log. Local functional evidence is not a public deployment claim.
