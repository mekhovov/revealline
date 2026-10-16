# Academy demonstrations in World Studio

World Studio now gives new players a visible first-flight entry and exposes the
24 existing Academy recordings: one successful Self-level and Acro example for
each of the 12 original challenges. New-world recordings remain in production;
the catalogue makes that distinction explicit.

Players can watch from the first-flight card, from an Academy challenge row, or
from the flight controls before an attempt. A demonstration is available only
when its original v1 model, course ID, course identity, flight mode and response
identity match the current challenge. Each selected recording replays through
the original fixed-step integrator before playback begins.

Playback has its own label, 0.5×/1× controls, pause/resume, restart and a **Fly this
challenge** action. Changing the demonstration mode selects the corresponding
verified example. Speed changes affect wall-clock scheduling only; the recorded
commands and 50 Hz simulation order are unchanged. Recorded personal flights
also use the corrected replay controls; restarting one keeps it in playback.

Radio setup, pilot control selection, touch sticks and firing are unavailable
during playback. Pause, focus loss and graphics lifecycle handling remain active.
Watching or restarting does not store an attempt, grant completion or medals,
advance a playlist bookmark, or replace an interrupted-flight recovery record.
Flying the challenge returns to a disarmed practice attempt with the player's
selected controls and response profile.

## Verification

Performed against the separate `dist/fpv-academy-demo-playtest` package:

- The package builds within its existing closure and size limits: 73 files.
- All 24 embedded demonstrations replay to completion against their exact
  original course definitions. This verifies unchanged content, without adding
  unit-test coverage.
- Chromium walkthrough finds 12 Academy example links; starts Self-level;
  pauses without tick advancement under held throttle/fire keys; resumes at
  half speed (25 ticks over about one second); restarts in demonstration mode;
  switches to Acro and reaches the demonstrated completion.
- IndexedDB store counts and non-display local storage are unchanged after
  demonstration playback. **Fly this challenge** returns to disarmed practice
  with usable controls, and a keyboard attempt arms successfully.
- Ukrainian onboarding renders at an emulated 390×844 viewport with no horizontal
  overflow. The walkthrough reported no JavaScript errors.
- The generated application prepares offline, reloads with networking disabled,
  and plays, pauses, restarts and completes the first Self-level demonstration
  without JavaScript errors.
- Focused ESLint, JavaScript syntax and diff whitespace checks pass. Unit-test
  expansion remains scheduled for the final qualification phase.

This increment does not add new-world demonstrations or claim the full set of
120 production-qualified demonstrations is complete. Physical-device/controller
qualification and unfamiliar-player teaching review remain part of the broader
release plan.
