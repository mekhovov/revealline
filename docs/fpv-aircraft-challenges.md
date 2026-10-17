# Optional aircraft practice challenges

Physical aircraft practice remains unlimited by default. Preflight and pause offer
two optional challenges through **Restart with selected rules**. Selecting a rule
does not alter a running attempt. Restart returns to the same course launch with
the same aircraft, mode and frozen conditions, a fresh battery, and deliberate
arming. A normal course launch starts ordinary practice again.

- **Timed practice:** choose 30–3600 whole seconds. The challenge clock advances
  only on accepted 50 Hz mission intervals. At the chosen duration, its result and
  clock freeze while physical flight continues.
- **Battery endurance:** depletion is enabled for that attempt without changing
  the saved setup. Airborne time begins after 25 consecutive intervals with no
  grounded contact, including those qualifying intervals. The result freezes when
  the actual simulated charge is exhausted or 50 consecutive grounded intervals
  follow takeoff. Grounded intervals do not count as airborne time. Ground contact
  comes from complete aircraft geometry, not a fixed altitude threshold.

Pauses, terrain waits and rejected motion, recording limits, storage failures and
wall-clock delays do not advance either objective. Exhaustion before takeoff is
reported with zero airborne time. A finished objective never stops the physical
session. A drained aircraft still needs a fresh-battery restart to regain power.
Battery behavior remains an estimate using the current aircraft model; these
results are not measurements of real aircraft endurance.

## Versioning and recovery

`AircraftChallengeRules.v1` is frozen into `configuration.challenge` before worker
initialization. It contributes to simulation and comparison identities alongside
the existing aircraft, response and assist configuration. When no challenge is
selected, the property is omitted; prior identities and recordings are unchanged.

`AircraftChallengeProgress.v1` is a bounded counter record. Its mission cursor
continues with accepted flight intervals after the result freezes, allowing exact
checkpoint association without retaining a history of telemetry. A
`AircraftChallengeRecovery.v1` envelope pairs that progress with the unchanged
Course or Regional recovery packet. The accepted tick, selected rules, battery
capacity and physical hash must match before the host adopts the detached restore.
Cancelled or failed validation leaves the current attempt intact. Recovery resumes
charge and progress; it never refills the battery or restarts the objective.

## Verification and scope

All challenge results remain unscored. Archive verification reports physics
integrity and challenge outcome separately:

- A canonical fresh-start archive derives the objective again from every accepted
  replay interval. A completed result can be independently verified, even if the
  pilot kept flying afterward.
- An archive ending before the objective is complete reports incomplete challenge
  progress.
- A checkpoint-origin clip can verify its contained physics but cannot establish
  the earlier challenge outcome. Imported progress is not achievement evidence.

The same controls and fresh-start path cover Academy, World, Beginner practice
and Regional flight in both supported control modes. Existing scored exercises,
historical replay paths and portable rate profiles retain their previous rules.
Scored aircraft competition and real-device/pilot qualification remain separate
gates.

Focused acceptance coverage includes strict rule bounds, accepted-clock counting,
takeoff/landing contact qualification, real consumed-charge termination, paused and
duplicate intervals, frozen results, safe-integer clocks, atomic recovery, failed
and cancelled restores, all four host launch paths, EN/UK labels, native file-input
visibility, and independent archive outcome verification.

## Local browser check (2026-10-17)

The World interface was exercised with a 30-second timed challenge. Its explicit
restart prepared the aircraft and retained deliberate **Arm**. After arming, the
physical clock reached 47 seconds while the challenge stayed at 30/30 seconds and
showed its completed, unscored result with continued flying available. The flight
was paused at 55.98 seconds and its final archive segment was captured. The actual
dedicated worker independently verified both complete-session physics from reset
and the 30-second challenge outcome, retaining unscored labels for both. This
checks the visible timer, restart/arming workflow, continuation and archive
verification in that browser; it does not establish whole-flight battery
endurance or real-aircraft fidelity.
