# Native course verification acceptance — 19 October 2026

These are actual rendered keyboard flights through the normal application UI,
using the exact release-bound packages from source
`1dfb180f2c699692afe2fc121a845f5e5f7ef727`. The available in-app desktop browser
used fresh local origins: World at `127.0.0.1:9237`, Academy at
`127.0.0.1:9238`. No application state, input schedule, worker or storage was
injected. Public browser state and protected archives were untouched.

## World-host Flight School: saved Nazgul

- Selected **Meet your drone** from the normal mission library, explicitly
  restarted the teaching lesson in Self-level, then chose **Practice with
  iFlight Nazgul ECO XL5**. The reference demonstration was not used as a
  completion or recording.
- Ordinary W/S and fine-control keyboard input completed ready-on-pad, lift
  and landing. Explicit pauses retained the physical pose; resuming was
  deliberate. The aircraft finished upright at 0.0 m, with zero reported
  vertical speed and drift. The rendered HUD reported **Route complete**.
- The pause panel reported objective durations **0.80 s, 6.36 s, 7.18 s**,
  measured at the existing 50 Hz mission steps. The flight stayed unscored.
- **Finish current archive** saved the session labelled
  `World · 2026-10-19T04:17:18.397Z · 0:00–0:20 · finished`.
  The recent-clip range was 0:00.00–0:20.04, with a durable checkpoint at
  0:20.00. Finishing did not resume the flight.
- **Verify course completion** used the normal native World worker and
  reported **Recorded course completion verified: 14.34 s. Unscored. The
  current flight is unchanged.** Both **Use as split reference** and **Show
  reference aircraft** became enabled.
- Selecting those controls produced **Clear split reference** and **Hide
  reference aircraft**. Each observed objective matched its reference with
  a displayed 0.00 s difference. Those enabled controls exercise the private
  owned-proof eligibility boundary, not just successful report text.

## Academy: saved Meteor75

- Used the saved **BETAFPV Meteor75**, SIM starter rates, reference battery and
  Self-level mode on **Lift and land**. The workbench reported zero changes
  and **Used by this flight**; its calculated hover estimate was 49.7%.
- **Apply & restart** retained the saved setup and waited for explicit Arm
  after scene preparation. An initial low-lift sequence did not complete the
  hold. Further ordinary keyboard input in that same attempt reached the
  1.2–2.4 m band, held the required conditions, and descended onto the pad.
  No reset, injected completion or changed lesson predicate was used to pass.
- The rendered HUD reported **Route complete**, upright ground contact,
  zero vertical speed and drift. The pause panel reported **12.96 s** for
  the height objective and **4.24 s** for landing.
- Finishing saved the session labelled
  `Academy · 2026-10-19T04:21:30.754Z · 0:00–0:21 · finished`.
  The recent range was 0:00.00–0:21.18 and the durable checkpoint was 0:20.00.
- Normal native-worker course verification reported **17.20 s**, unscored,
  with the current flight unchanged. Both reference controls became enabled;
  explicit selection produced zero split differences and their clear/hide
  actions. The flight remained paused.

## Scope, negative attempts and retained evidence

Neither tab returned warning/error console entries during these checks. This
does not establish that every optional request succeeded. Earlier overshooting
and low-throttle attempts remain separate observations, not completed flights.
No local test archives were deleted. These recordings are local test data;
their existence says nothing about recovery of the protected public records.

The World result covers the World-host **Flight School** course, not every
plain World-catalog course, Regional streaming or dynamic objectives. The
runtime already installed the correct native World adapter and worker; this
acceptance closes a browser-evidence gap, not a missing runtime implementation.
The source-only named-catalog audit remains a separate optional tool. Local
record admission, competition policy and platform qualification remain open.

The results establish playable saved aircraft and native replay/course
verification on this source and browser. They do not establish measured
whole-aircraft fidelity, physical-radio response, all-map completion, a
performance gate or acceptance of a later public deployment.

Screenshots are retained in the task evidence directory:

- `world-nazgul-lesson-complete-1dfb180f2.jpg`
- `world-native-course-verified-1dfb180f2.jpg`
- `academy-meteor75-lesson-complete-1dfb180f2.jpg`
- `academy-native-course-verified-1dfb180f2.jpg`

Directory:
`/Users/oleksandr.mekhovov/.codex/visualizations/2026/10/15/01a14160-c3f4-7f50-a9a8-4d14c06417bf/sustained-flight`.
