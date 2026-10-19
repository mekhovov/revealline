# Current-main rendered flight checks — 19 October 2026

Source `1dfb180f2c699692afe2fc121a845f5e5f7ef727`, exact committed extraction,
separate release-bound Academy and World packages. The in-app desktop browser
used fresh local origins `127.0.0.1:9237` and `127.0.0.1:9238`. Both password
forms were exercised through normal UI. Public browser storage was untouched.

## Observed World behavior

- Settings → Controls → Aircraft, rates & throttle opens the shared workbench.
  All fifteen civilian catalog options are present. Basic starts selected.
- Choosing Meteor75 only previews it until Use in draft. Applying it creates a
  14-change temporary draft with its Actual starter rates, 37.68 g installed
  mass, 40 mm props, reference battery and disabled depletion.
- Test draft loads unscored practice and waits for explicit Arm. Keyboard input
  lifts the aircraft in Self-level: an observed frame reports 10.8 m,
  +6.7 m/s vertical and 0.7 m/s drift after throttle/roll/yaw input.
- Cutting throttle produces descent; subsequent rendered state reports 0.0 m,
  zero vertical speed/drift and upright ground contact. This is a contact
  observation, not proof of a gentle landing or real-aircraft fidelity.
- Pause → Acro resets the attempt while remaining paused. Explicit Resume and
  throttle/yaw input produce lift: observed 0.8 m, +2.6 m/s vertical. Returning
  to tuning preserves the same section and all fourteen draft changes.
- A Nazgul ECO XL5 draft saved for next flight reports zero changes and the
  saved starter profile, 652 g and 129.54 mm props. Closing setup retains the
  paused original flight. Choosing Three aisles / Pixel warehouse from the
  mission library starts a normal new attempt with the saved Nazgul.
- Keyboard throttle/pitch responds; near 36% throttle the aircraft begins to
  climb. Its paused workbench explicitly says **Used by this flight** with the
  Nazgul setup and profile. Expert shows its SI PID values, filters and
  anti-windup; changing Basic/Expert preserves zero configuration changes.

## Observed Academy behavior

- The same Settings entry and full aircraft catalog work in the separate
  Academy package. Meteor75 → Use in draft → Apply & restart leaves motors
  off, height/speed zero and Arm available only after scene preparation.
- Lift and land retains its original 1.2–2.4 m band, 0.8-second consecutive
  hold, ≤2.2 m/s speed and ≤45° tilt requirements. Opening objective help
  pauses explicitly; closing it does not automatically resume.
- After explicit Arm, manual keyboard throttle produces lift and descent.
  The manual flight overshoots the target band; **lesson completion is not
  claimed**. Throttle cut returns to 0.0 m, zero vertical speed/drift and an
  upright pose. The test ends paused.

No warning/error console entries were returned for either local tab during
these interactions. This is not a claim that all optional network requests
succeeded. No files were uploaded or public archives modified/deleted. Local
practice automatically created its own recovery/archive data; it was not
cleaned up or used to infer anything about the protected public records.

## Scope and evidence

These are representative keyboard flights in one available desktop browser,
not all-aircraft/all-map completion or physical-device/performance qualification.
The separate [627-check source-bound cohort](fpv-current-main-release-20261019.json)
includes all-aircraft adapter cases, workbench/ownership integration and the
reviewed generation/tooling boundaries. Tests and rendered observations are not
summed into one flight count.

Screenshots remain in the task's local evidence directory:

- `workbench-current-flight-1dfb180f2.jpg`: normal World attempt's active Nazgul
  configuration, Expert PID controls and zero draft changes.
- `academy-meteor75-ground-1dfb180f2.jpg`: Academy ground contact after the
  keyboard throttle-cut check.

The directory is
`/Users/oleksandr.mekhovov/.codex/visualizations/2026/10/15/01a14160-c3f4-7f50-a9a8-4d14c06417bf/sustained-flight`.
The final deployed source remains a separate acceptance gate.

Later same-source checks complete and natively verify both an Academy Meteor75
lesson and a World-host Flight School Nazgul lesson. The earlier unsuccessful
attempt above is retained as observed; see the separate
[native-course acceptance receipt](fpv-native-course-acceptance-20261019.md)
for the successful attempts, exact timings, owned reference controls and limits.
