# Current v3 browser qualification — 19 October 2026

The fresh fifteen-aircraft matrix passes numerical accuracy, contacts and exact
replay agreement in every tested engine, but **does not pass overall**: Firefox
153 misses the unchanged twice-real-time capacity gate. The failure is retained;
no frequency, trajectory, aircraft tuning or acceptance threshold was changed.

The [first full report](fpv-v3-browser-qualification-20261019-attempt-1.json)
ran from 18 October 23:57:51 UTC to 19 October 00:04:20 UTC against
`4c5b445aa` (the documented canonical source over runtime `3949d2f2a`). Runtime
files are unchanged from that revision. It captures SHA-256 and sizes for the
complete 36-file literal import/worker closure; browsers received those captured
bytes, and final disk hashes matched. Qualification changes are confined to the
runner and test helper. Prior v1/v2 reports remain historical evidence.

## Measured scope and results

One Apple M4 Pro / ARM64 / macOS 25.6.0 host; isolated headless contexts; existing
installed engines only. No public tabs, user profiles, saved setups or public
site storage were accessed. The source is `civilian-quad-aircraft.v3`, fixed at
1,000 Hz with 50 Hz mission/input boundaries.

| Runtime                | Minimum response capacity | Minimum terrain-landing capacity | Minimum worker protocol capacity | Fixed 1,000 Hz gate |
| ---------------------- | ------------------------: | -------------------------------: | -------------------------------: | ------------------- |
| Node 20.19.5           |                    22.17× |                           10.20× |                     Not measured | Pass                |
| Chrome 155.0.8059.85   |                    68.97× |                           14.99× |                           13.66× | Pass                |
| Firefox 153.0          |                     6.40× |                       **0.890×** |                       **1.461×** | **Fail**            |
| Playwright WebKit 26.5 |                    45.45× |                           12.30× |                            5.86× | Pass                |

All fifteen aircraft are measured against the 2 kHz numerical reference, with
two repetitions of each 250/500/1,000 Hz candidate. At the frozen 1,000 Hz, every
engine reports the same maximum response error, **0.498568%**, and worst floor
penetration, **0.676390 mm**. Thin-wall blocking, the unchanged 3 mm floor gate,
and repeated hashes pass. Lower-frequency results remain in the report and do
not change the v3 release frequency.

All thirty aircraft/mode pairs (Acro and self-level) agree exactly with Node in
both browser direct execution and dedicated workers. Each case checks an entire
bounded 80-mission/1.6-second retained clip beginning at tick zero, verified
replay, reset/re-run, a stopped mission clock, and recovery from tick forty.
Worker recovery terminates the original worker and continues in a new owner.
Periodic hashes, final hashes, identities and consumed input cursors agree.
The recording verifier correctly labels these retained aircraft records
`checkpoint-clip`; this is not maximum-duration archive qualification.

Eight Firefox landing fixtures miss 2×: Air65 II, Meteor75, Meteor75 Pro,
Meteor85, Mobula8, Cetus X, Protos16 and Pavo20 Pro II. Four worker cases miss 2×:
Meteor75 and Protos16 in both modes. These measured failures are not replaced by
later faster diagnostic samples. The matrix host load average rose from 9.00
to 15.40 on fourteen logical processors, so it is not a quiet-device benchmark.

## Focused Firefox diagnosis

The [diagnostic report](fpv-v3-firefox-profile-20261019.json) profiles the exact
Cetus X Acro terrain drop (`44a47ba9`) and Meteor75 self-level worker fixture
(`42fc00f7`). Transparent wrappers around pinned Rapier methods forward the same
receiver, arguments, return values and exceptions. Baseline and instrumented
runs retain identical final hashes **and complete final telemetry**. Initialization
is measured separately and excluded from stepping capacity, matching the matrix.

- Cetus X remained below the gate after initialization: uninstrumented Firefox
  **1.073× and 1.121×**, with 3–19 ms initialization. Instrumented runs spent
  **1,232–1,249 ms inside `World.step` out of 1,381–1,386 ms total**. The 45,000
  tracked-contact lookups took 38 ms; 35 supplemental current-shape queries
  rounded to 0 ms; snapshots took 14–22 ms.
- Meteor75 worker initialization took 351–397 ms separately. Focused uninstrumented
  stepping varied to **2.043× and 2.151×**, while the original full matrix's
  **1.461×** failure remains authoritative. Instrumented solver calls accounted
  for about 81–82% of the measured stepping interval.
- Chrome used the same fixtures and produced the same hashes/telemetry. Its
  uninstrumented Cetus runs reached 7.61×/12.35× and worker runs 14.53×/16.74×.

These are inclusive wall-clock method timings, not an internal WASM CPU profile;
wrapper overhead, scheduling, timer precision and shared-host load remain
confounders. Mean host busy time was 76.29%. The evidence localizes the dominant
interval to the physics solver call and does **not** establish which internal
solver/WASM/engine mechanism causes it. It does rule out supplemental contact
lookups or snapshot serialization as a sufficient standalone explanation: even
removing their entire measured cost would not provide the required floor margin.

The initial diagnostic accidentally selected self-level for the Cetus floor
case. It is preserved as a separately scoped
[self-level-floor report](fpv-v3-firefox-profile-20261019-self-level-floor.json),
with its exact [helper source](fpv-v3-profile-self-level-floor-helper-20261019.txt).
The corrected Acro diagnostic above matches the full matrix's hash. Neither
profile is a replacement qualification attempt.

## Remaining gate and safe follow-up

Firefox is **performance-unqualified** on the measured source/host. There is no
measured, narrowly scoped JavaScript optimization here that can safely promise
2× while preserving exact trajectories. Further solver/WASM profiling or an
engine-specific runtime optimization needs fresh unchanged-trajectory and full
matrix checks. Do not lower the fixed frequency, relax the contact gate, or
silently treat Firefox as qualified. Any availability policy claiming qualified
performance must expose this limitation; this single headless-host result alone
is not evidence for blocking every Firefox device.

R9 remains partial: streamed Regional worker frame transitions, installed-PWA
install/update/offline/eviction, rendered full-host load, mobile/native targets,
other physical architectures, long-duration storage and physical input devices
are outside this report. WebKit here is the Playwright engine, not an installed
Safari/PWA qualification. All promotion/scoring/full-platform flags remain false.

Reproduce the bounded matrix with the existing installed Playwright module:

```sh
node scripts/qualify-fpv-aircraft.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/new-report.json
```

The diagnostic uses `scripts/profile-fpv-aircraft-browser.mjs` with the same two
arguments. Each output should be new; preserve the failed first matrix.
