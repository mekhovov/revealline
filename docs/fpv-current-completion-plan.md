# SIM completion plan — current status and remaining work

Reviewed **18 October 2026, 21:15 CEST (Europe/Berlin)**. This is the current
execution index for the accepted rates, aircraft and Setup Workbench plans.
It distinguishes implemented features, released corrections, remaining software
work and qualification that requires outside evidence. It does not reopen
unrelated world-expansion or demonstration-authoring projects.

## Current status

**The core rates, thirteen-aircraft practice and Setup Workbench features are
delivered. The complete original ambition is not finished:** exact real-aircraft
fidelity, exhaustive source-kit coverage, wider-device qualification and Advanced
competitive promotion remain open or explicitly excluded as detailed below.

The latest three corrections are released through
[PR #1583](https://github.com/mekhovov/revealline/pull/1583), merged as
`3a2880287b501dffcdd1ab1937ffbe0fead8b782` on 18 October at 09:14 CEST.
The release's [public deployment metadata](https://mekhovov.github.io/revealline/main-deployment.json)
reported `20555cda6bd44a0736aa829e64c52e455b4e770c`; its
[Pages build, deployment and verification](https://github.com/mekhovov/revealline/actions/runs/39145153450)
all passed. This review downloaded the three corrected public modules and
confirmed their bytes matched the verified PR #1583 release. The later live
metadata check at 20:33 CEST reports
`461ace72e78f8cbd77c26549381d9e21d0a65e91`, the continuation's refreshed base;
the new continuation changes are not yet public.

### Current continuation — implementation and acceptance in progress

Work is isolated on `codex/fpv-sustained-flight-20261018`, based on refreshed
main `e3a20a2a342757444775c0c261131da168280b58`. Unrelated local demo/UI edits
remain untouched. The reviewed six-commit candidate was subsequently rebased
cleanly onto main `461ace72e78f8cbd77c26549381d9e21d0a65e91`. The following work is
**committed and under hosted review, not yet published** in
[PR #1626](https://github.com/mekhovov/revealline/pull/1626), final source
`cf13bcad9a59a387be7c31c9af8d30d74e7c1860`.

The hosted candidate checks passed on the exact PR source, including **1,364/1,364**
primary checks. The optional-practice integration run passed **1,221/1,221**
practice and **10/10** pointer checks; observers reported **170 pass, zero fail,
one skip** because their historical fixture bundle was absent. That optional run
is bound to merge-integration source `8fc952b7a0beb70b3065663e4b5390feb209d490`,
not the isolated PR head. Focused source and remaining feature checks still
await runners. The PR is ready for ordinary protected reconciliation; no enqueue
label or GitHub auto-merge request is required by this repository's controller.
An obsolete cancelled run's always-run aggregate
had blocked the source lane and was force-cancelled; the final source still must
pass its own normal checks. No final-source gate was waived. Repository
`REVEALLINE_FULL_CI=false` means the broader deferred lint/test gates must not be
reported as a full-repository pass. Publication and deployed UI acceptance remain.

| Priority                                  | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                       | Next gate                                                                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1: keyboard flight regression**        | Public Meteor75 flight reproduced throttle dropping to zero after deliberate Pause → Resume, causing a fall/flip. Fixed session-specific resume preserves the last accepted throttle, clears held rotation keys and retains zeroing on blur/source changes/restart. Six host regressions fail against the old source and pass with the fix. Local rendered World visible-button and P-key pauses both resumed at 50% throttle with neutral rotation. | Independent review complete; reloaded Academy and Regional acceptance passed. Normal hosted release checks remain. No physics constants changed.                                                                                        |
| **P1: sustained coverage**                | All fifteen aircraft pass 32-second controlled RC-input flights in Acro and Self-level (30 cases), rotated across Academy/World/learning hosts, including contacts, re-takeoff and exact recovery. All 35 cases now pass, including four 65-second Regional cases and a 735-second Meteor75 flight with 730.1 seconds airborne.                                                                                                                      | The [receipt](fpv-sustained-flight-qualification.json) retains named source hashes, initial synthetic-pilot diagnostics and exact scope. These in-process tests do not replace rendered/manual flight or establish total-memory bounds. |
| **P1: archive reliability investigation** | Both local and public World archive operations reported a closing IndexedDB connection. Public reload/refresh then showed only a new test session instead of the prior sixteen entries. Cause unknown; the six older archives cannot be confirmed preserved. A stale-handle reconnect correction is tested, but does not establish retention or explain the missing inventory.                                                                       | P1 retention remains open. Preserve this negative and the earlier 16 October owner audit; reconnect success is not proof of retained data. No bulk-delete path was found.                                                               |
| **P2: source inventory**                  | [Civilian disposition inventory](fpv-civilian-source-inventory.md) covers all 41 returned Swarm records and all ten spreadsheet tabs. Existing Mobula8 maps to the explicitly civilian indoor kit. Military-specific entries are excluded; equipment and ambiguous collections are not fabricated aircraft.                                                                                                                                          | Inventory complete within the documented source/access boundary; this does not claim every source kit is implemented.                                                                                                                   |
| **P2: civilian candidates**               | Cetus X (2022 Betaflight SPI ELRS, original 30C series cells) and Protos 1.6 AIO 1.0 are implemented with distinct original visualizations and visible approximation notices. All thirteen previous numerical identities remain unchanged. All fifteen pass the local numerical gate; targeted source/config/host checks pass.                                                                                                                       | Independent review and short Academy takeoff/steering/pause checks complete; hosted packaging/publication remains. [Implementation evidence](fpv-civilian-candidate-implementation.md).                                                 |
| **P2: actual browser zoom**               | Chrome Guest toolbar verified actual 200% zoom. EN/UK camera search, keyboard numeric editing, reachable focused fields/actions and revert checked; zoom restored to 100% and guest window closed. The discovered invalid-value/slider mismatch is corrected; final DOM reads confirm 86/86 and unfinished 4/86 exact/slider pairs.                                                                                                                  | Local corrected-control acceptance complete. Keep this single Chrome/desktop check distinct from narrow-viewport and mobile coverage.                                                                                                   |

The local rendered World session reached **14:20.30**, retained clip **12:00.00–14:20.30** and durable checkpoint **14:20.00** despite archive failure. This includes ground/ceiling contact, not measured continuous airtime. Reloaded Academy Meteor75 and both new presets passed short input/pause checks; Regional Meteor75 passed a separate current-source starting-area flight. [Rendered evidence](fpv-flight-continuation-20261018.md).

The public long-flight attempt reached 5:44.60 but encountered the pause bug;
it is **not** a completed twelve-minute rendered flight. It also confirmed
continued flight and durable checkpoints with the sixteen-entry archive store
full. The user authorized deletion of ten identified test archives. The first attempt reported a closed connection; all sixteen were still listed immediately afterward. After reload, the older inventory was absent. No successful cleanup or preservation claim is made; no further deletions were attempted.

Archive feedback now distinguishes a confirmed single deletion from a failed or
cancelled follow-up refresh, and initial list errors are visible. **19/19**
controls/integration checks pass, including EN/UK failure paths. This corrects
outcome reporting without changing storage algorithms or explaining the missing
public inventory. A new local 50.78-second Regional archive saved and verified
from reset; that positive result does not close retention R13.

The rebased candidate also has **30 rendered catalog smoke cases**: all fifteen
presets launched and steered in both modes through the World workbench. The
[receipt](fpv-rendered-catalog-20261018.json) preserves the excessive-throttle
Meteor75 Pro ceiling contact and gentler retest. Archive-full status did not stop
the remaining flights. These short checks advance R1; longer representative
routes and acceptance on a frozen public release remain.

Additional source-preview checks exercised X650 in Circuit stadium (25.54 s) and
Cetus X in Open meadow (72.76 s). These were unscored draft flights, not completed
course objectives. The Cetus archive finished through 64.50 s, verified from reset,
survived a normal same-tab reload and verified again. No archive deletion or
saved-library change was performed. [Detailed limits](fpv-flight-continuation-20261018.md).
The older missing inventory remains unresolved.

### Newly reproduced lesson defect — P1

A normal saved-Meteor75 **Meet your drone** practice attempt, entered through
the teaching guide's **Practice with BETAFPV Meteor75** action, did not complete
its initial on-pad condition. After settling upright with zero throttle, zero
vertical speed/drift and centred sticks, the explanation showed **−0.0 m** against
the **0.0–0.8 m** height band, with every other condition satisfied and zero hold
progress. The physical contact solver settles approximately 1 mm below its plane;
the mission adapter passed that small negative height straight to a strict bound.

Source review also found that **56 Flight School courses and 30 World courses**
request the authored `$floor` landing surface, while aircraft contacts supply
`course-boundary-y-min`. A predicate-isolation reproduction completes 3/3 steps
only after changing that support identifier; the original stays at 2/3. This
does not mean all those courses were flown or that every failure has one cause.

**R14 / P1: selected-aircraft mission completion** now precedes additional
assurance work. A separate versioned mission adapter is being implemented after
the Nazgul correction, preserving physical state/contacts and old recovery
identities. It must pass full simulated ground/lift/landing progression, named
platform and boundary negatives, historical recovery, independent review and
rendered acceptance. Allow **1–2 engineering days**, including release gates,
subject to newly found failures; no completion claim yet. PR #1626's independently
verified pause/archive corrections remain on their unchanged release path.

## Delivered and retained

| Accepted area            | Completed behavior                                                                                                                                                                                                                   | Evidence / qualification boundary                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rates and transfer       | Legacy plus Actual, Betaflight, Quick, KISS and Raceflight; versioned throttle, named profiles, per-setup assignments, CLI/preset review and native transfer.                                                                        | [Completion record](fpv-tuning-completion-plan.md). Firmware compatibility is limited to the verified releases 4.5.2, 4.5.5, 2025.12.4, 2025.12.5 and 2026.6.2; this does not execute Betaflight or translate its PID values into SIM gains.                                                               |
| Aircraft                 | Thirteen civilian presets, installed-component accounting, distinct numerical configurations, dimensions and simplified visualizations; editable battery/camera payloads and starter or retained rates.                              | [Original twelve](fpv-aircraft-presets.md), [Mobula8 and source limits](fpv-civilian-kits.md). Physical coefficients remain estimates where identified measurements are absent.                                                                                                                            |
| Practice and recording   | Aircraft-aware Academy, World, learning and Regional practice; unrestricted flight, bounded recent clips, recovery, persistent segmented archives and bounded ghosts. Storage failure does not stop flying.                          | [Implementation](fpv-aircraft-completion.md), [archives](fpv-aircraft-archives.md). Verification certifies recorded simulation behavior, not real-world fidelity or scored eligibility.                                                                                                                    |
| Optional endurance       | Depletion off by default; explicit battery/timed challenges preserve ordinary continuous practice.                                                                                                                                   | [Battery](fpv-aircraft-endurance.md), [challenges](fpv-aircraft-challenges.md). Mass, propulsion limits and instantaneous sag remain active without depletion.                                                                                                                                             |
| Workbench                | Basic/Expert views of one draft, search, rates/throttle/camera previews, shared-profile ownership, undo, import review, calibration/test return and complete setup saves.                                                            | [Workbench record](fpv-setup-workbench.md). Actual 200% Chrome zoom has new EN/UK evidence above; physical-device usability remains separately unverified.                                                                                                                                                 |
| Controller tools         | Independent reusable-tune library; manual A/B conditions; isolated simulation bench with physics-step metrics; bounded one-gain assistant with separate validation and explicit application.                                         | [Workbench phases 2–3](fpv-setup-workbench.md). All assess the SIM model; they do not establish real-aircraft tunes.                                                                                                                                                                                       |
| Flight regression repair | Regional headings, dense collision frames, pause/prefetch coordination, terrain recovery and paused-browser-stall recovery corrected. Learning reference demonstrations cannot silently replace selected-aircraft practice.          | [Flight audit](fpv-all-aircraft-flight-audit.md), PRs [#1577](https://github.com/mekhovov/revealline/pull/1577) and [#1580](https://github.com/mekhovov/revealline/pull/1580). The new keyboard pause/resume defect is reproduced and locally corrected above; earlier fixes remain source-bound evidence. |
| Latest usability repairs | No persistent archive before accepted flight progress; correct Draft / Saved for next flight / Used by this flight status; direct mouse/touch curve inspection with exact keyboard alternatives; completed archive-refresh feedback. | [PR #1583](https://github.com/mekhovov/revealline/pull/1583), released and checked on the public site. No physics constants, timing, historical identities or saved-library formats changed.                                                                                                               |

Recovery with retained flown history can create a checkpoint-origin archive
immediately; it need not wait for a new resumed tick. The lazy-start correction
prevents empty archives for fresh, unflown sessions without dropping recovered
history.

Implemented aircraft: **Air65 II Racing, Meteor75, Meteor75 Pro, Meteor85,
Mobula8, Pavo20 Pro II, SMART35, Nazgul ECO XL5, Mach R5 Sport, Rekon7 PRO,
Chimera7 Pro V2, Helion Pro and X650 V2**. These are available through the shared
practice paths. Fixed historical/scored challenges retain their original rules;
selected-aircraft practice variants provide access without rewriting old results.

## What the checks establish

| Evidence                        | Result                                                                                                                                                                                                                                                        | Limit                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest correction release       | **1,183/1,183** flight/practice checks, **1,756/1,756** broader preview/Appearance/SIM checks, **1,364/1,364** candidate primary checks and **10/10** pointer checks passed; normal package builds and publication passed.                                    | Separate suites overlap and must not be added into a unique-test total. [Flight/candidate run](https://github.com/mekhovov/revealline/actions/runs/39104883750), [preview run](https://github.com/mekhovov/revealline/actions/runs/39104883723), [release deployment](https://github.com/mekhovov/revealline/actions/runs/39106933666).           |
| Catalog and modes               | **5,616 startup combinations** and **728 short flight/configuration checks**; changes to mass, rates and PID alter actual solver motion across hosts.                                                                                                         | Startup checks generally accept one mission tick; sampled flights are approximately 3–4 seconds. Entries may share maps. This is not every completed lesson/course or every downloadable edition. [Coverage details](fpv-all-aircraft-flight-audit.md).                                                                                           |
| All-model public flights        | **26 brief keyboard takeoff/steering flights**, all thirteen aircraft in Acro and Self-level, on `4f68b924ee74`.                                                                                                                                              | Historical source-bound acceptance, not a new interactive pass on the current release or a physical-radio test.                                                                                                                                                                                                                                   |
| Latest correction UI acceptance | Meteor75 draft flights and archive verification in local Academy, World and Regional; public rate inspection, correct active-flight status, unchanged archive count before flying, and continued flight despite full archive storage.                         | The final public Meteor75 Acro observation lasted **2.76 seconds**. Existing saved setup/settings and archives were preserved. No sustained-flight or full-mission claim follows from this short check.                                                                                                                                           |
| Numerical behavior              | Original twelve-aircraft report selects **500 Hz** against the **2 kHz** reference, with browser/worker agreement on the recorded Node/Chrome/Firefox/WebKit environments. Mobula8 has later catalog-wide numerical checks and the all-thirteen flight audit. | The recorded cross-browser numerical report covers twelve aircraft on one Apple M4 Pro; it is not a refreshed thirteen-aircraft/device matrix. The historical reference backend's **250 Hz** identity remains separate. [Numerical report](fpv-aircraft-numerical-qualification.json), [browser report](fpv-aircraft-browser-qualification.json). |
| Continuous flight / delivery    | A recorded local flight exceeds twelve minutes; segmented archives, quota-failure trajectory equivalence, checkpoint recovery and offline/native staging have evidence.                                                                                       | Desktop native execution is an unsigned simulator-only ARM64 Mac development shell. iOS staging is not iOS runtime; desktop offline checks are not all OS-installed PWA/update/eviction scenarios. [Aircraft completion](fpv-aircraft-completion.md), [native receipt](fpv-native-second-review-qualification.json).                              |

The first PR #1583 full flight run passed **1,182/1,183**: an obsolete arena test
expected an archive before flying. Its replacement checks idle sessions, short
canonical flights, continuation and interruption of a genuinely flown session.
The corrected run passed **1,183/1,183** before publication. Earlier **35/35**
archive and **213/213** draft/curve/library/host checks remain supporting evidence,
not additional unique-test totals.

Earlier local browser evidence included a 7.16-second Meteor75 archive verified
from reset, a saved/draft roll readout of 145.7/184.0°/s at 50% stick after an
explicit 600→800°/s rate edit, and correct active-flight status after restart.
These observations stay tied to that earlier served source. Publication is now
confirmed; the old queued/final-run-pending wording is superseded.

## Remaining work, priorities and estimates

**Estimates are active engineering effort after the listed dependency is met,
not promised calendar dates.** No overall completion date is defensible while
measurements, devices and pilot availability are unknown. Missing radio/log/pilot
evidence was explicitly deferred by the user and must not block independent
software work. Defects found during qualification may extend these ranges.

P1 is the next available assurance work; P2 improves coverage or closes external
qualification; P3 depends on a qualified physical/platform baseline.

| ID / priority                     | Remaining item and current status                                                                                                                                                                                                                                                                                                         | Estimate / dependency                                                                                                                                                                                            | Done when                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 / P1                           | Refresh browser evidence on a frozen current release: all fifteen current catalog aircraft plus longer representative learning/course/Regional flights and pause/recovery under rendering/streaming load. **In progress; a reproduced keyboard pause/resume defect is now locally corrected.**                                            | **1–2 working days** for one available desktop/browser pass, excluding fixes. Requires a stable release snapshot and bounded, recorded route selection.                                                          | Each aircraft launches and steers; representative small/large aircraft complete selected maneuvers/routes in both flight modes; setup/PID/rate identity, contacts, pause/recovery and continued practice are recorded. Include a flight beyond twelve minutes and clearly list untested combinations. This does not promise exhaustive completion of all 6,480 current startup combinations. |
| R13 / P1                          | Diagnose missing archive inventory and establish retention across reopen. **Open:** sixteen cached public entries became one refreshed new session; the six protected entries are unconfirmed. Reconnect is corrected, and transaction-level tests retain unrelated archives, but native loss is unexplained.                             | **1–2 engineering days for instrumented reproduction after an appropriate diagnostic context is available; recovery ETA unknown.** No further destructive cleanup.                                               | Source-bound native database/context evidence identifies the failure; unrelated archives survive confirmed single deletions, writes, interruption and reopen. Recover or explicitly account for the six protected records. See [incident](fpv-archive-retention-followup-20261018.md).                                                                                                       |
| R2 / P1                           | Complete a page-by-page / sheet-tab **civilian source-kit disposition inventory**. **Completed bounded inventory:** 41 returned Swarm records and ten sheet tabs dispositioned in [the inventory](fpv-civilian-source-inventory.md). Only the explicit civilian indoor kit maps to Mobula8; excluded/ambiguous items are not implemented. | **Complete for the accessible catalog snapshot.** Refresh only when sources change or a specific civilian reference is clarified.                                                                                | Every accessible source entry has its exact name, supported civilian aircraft mapping, implemented/research/non-aircraft/excluded status and evidence gaps. Military-specific configurations remain excluded from this recreational scope.                                                                                                                                                   |
| R3 / P2                           | Actual **200% browser zoom** accessibility check. **Completed on Chrome Guest in EN/UK at verified 200%; corrected camera fields also pass final-source DOM acceptance.** Prior 640 × 360 remains only a separate layout proxy.                                                                                                           | **Local acceptance complete.** The [receipt](fpv-flight-continuation-20261018.md) distinguishes actual zoom and final-source DOM checks; deployed acceptance follows publication.                                | Numeric fields/actions remain reachable and focus unobscured in EN/UK; zoom is restored. Keep narrow viewport and actual zoom evidence separate.                                                                                                                                                                                                                                             |
| R4 / P2, optional cleanup         | Remove the ten identified temporary public test archives. **Authorized, but not completed: the first action failed; after reload the prior inventory was no longer listed.**                                                                                                                                                              | **No cleanup ETA until the missing inventory is understood/recovered.** Do not delete the new test session as a substitute or claim the six older archives were preserved.                                       | Re-identify only the ten test entries from 18 October, 05:13–05:50 UTC (07:13–07:50 CEST), preserve six older entries and all settings, and verify capacity. No automatic deletion. This affects archive capacity, not ability to fly.                                                                                                                                                       |
| R5 / P2                           | Resolve and implement additional supported civilian candidates, presently **Cetus X Betaflight ELRS** and **CADDXFPV Protos**. **Implemented and locally accepted with explicit evidence/assist limits; publication pending.**                                                                                                            | **Hosted release checks and public acceptance remain**, normally several hours but dependent on CI queues or newly found defects. Matched propulsion maps and whole-aircraft measurements remain absent.         | Exact named configuration, explicit battery inclusion, component accounting, honest assist capability, individual visualization and all-host regression coverage. If proprietary behavior cannot be represented, report that limitation rather than claim an exact replica.                                                                                                                  |
| R6 / P2                           | Activate a qualified measured propulsion model and fit motor response, inertia, directional drag and electrical behavior. **Both implementation and measurement work remain.**                                                                                                                                                            | **5–10 engineering days for one reference aircraft after a complete usable dataset and fit scope are accepted**, as an initial planning allowance; data collection and all-fifteen delivery cannot yet be dated. | Versioned, deterministic measured-map adapter with identified motor/propeller/ESC/voltage/density/flow conditions, bounded interpolation/extrapolation and consistent power/current; held-out response checks. Preserve old backends. The current evidence inspector alone does not close this item.                                                                                         |
| R7 / P2                           | Physical USB radio and touch-device checks, including mapping, calibration, input ownership and observed cadence. **Deferred / unmeasured.**                                                                                                                                                                                              | **1–2 working days per representative target** after devices are available, plus fixes.                                                                                                                          | Real-device flight and setup workflows pass; browser sample cadence is not misrepresented as physical input latency. Keyboard or emulated input does not substitute.                                                                                                                                                                                                                         |
| R8 / P2                           | Experienced-pilot comparisons. **Deferred by the user.**                                                                                                                                                                                                                                                                                  | **2–3 comparison sessions plus 1–2 review days** after pilots are available; scheduling unknown.                                                                                                                 | Repeatable documented maneuvers, subjective A/B feedback and reviewed keep/revert outcomes. Pilot preference and measured physical fit remain distinct evidence.                                                                                                                                                                                                                             |
| R9 / P2                           | Wider platform qualification: Intel/other architectures, low-end/mobile, iOS runtime, sustained rendering/streaming, actual OS-installed PWA update/offline/eviction behavior. **Only limited desktop/browser/native-fixture evidence exists.**                                                                                           | **3–5 working days for an initial agreed small device matrix** after access, with **1–2 days per additional target** as a planning allowance; remediation extra.                                                 | Source-bound replay, contact, capacity, worker lifecycle, storage/recovery and installation tests pass on actual targets. Refresh the all-fifteen matrix; staging/emulation alone does not qualify a device.                                                                                                                                                                                 |
| R10 / P3                          | Measured propwash and ground effect. **Gated on a qualified base and effect-specific evidence.**                                                                                                                                                                                                                                          | **No dependable ETA yet.** Define a fit/implementation estimate only after usable measurements and acceptance tolerances exist.                                                                                  | Each effect has an identified measurement basis and held-out validation, with versioned behavior and preserved historical playback. Arbitrary coefficients cannot close the gate.                                                                                                                                                                                                            |
| R11 / P3                          | Advanced scored comparison/sector integration and default promotion. **Not enabled; integration as well as qualification remains.**                                                                                                                                                                                                       | **1–2 engineering weeks after relevant physical/platform gates and comparison rules are agreed**, provisional; no calendar date now.                                                                             | Comparison/sector filtering and verified records work with frozen identities; platform/physical qualification and a reviewed promotion decision are recorded. Practice archives remain unscored until then.                                                                                                                                                                                  |
| R12 / separate distribution scope | Signed/full-game native distribution. **Unscheduled product/packaging work; simulator-only fixture is delivered.**                                                                                                                                                                                                                        | **Not estimated** until target platforms, signing/distribution access and package-budget scope are decided. Does not block the current web release.                                                              | Reviewed package fits the distribution budget and passes signed installation, update and runtime checks on its target platforms.                                                                                                                                                                                                                                                             |

R2 covers the requested [Swarm kit catalog](https://swarm.army/kits) and
[multi-tab kit spreadsheet](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit).
The [inventory](fpv-civilian-source-inventory.md) records each public record and
tab, its exact title and disposition, along with the first-party feed/loading-shell
and bounded sheet-header inspection limits.

Current sequence: **pause/resume fix and archive investigation → source-frozen
sustained receipt → local rendered acceptance → hosted release**. R2 inventory and R3 local paired-control acceptance
are complete; R5 candidates await hosted release checks.
R4 is now tied to the open archive-retention incident; approval is no longer missing.
R6 software preparation proceeds independently; measured activation and R7–R9
qualification await the relevant evidence/devices. R10–R11 remain downstream. Do not wait for
R6–R12 to improve released practice.

### R6 software and evidence follow-up

A separate exact-component correction is committed as
`48373316b65bf14e3731569e9de9296fcdb553d0` on
`codex/fpv-nazgul-diameter-20261018`, not yet published. The Nazgul V1.1 aircraft
specifies F5 props; the matched manufacturer SKU specifies **5.1 inches**, or
**129.54 mm**, rather than the previous 127 mm class-based value. New preset
revision 2 corrects the radius; the older saved configurations and both recording
backends retain their dimensions and hashes. **32/32** targeted checks and
independent review pass. The other fourteen aircraft are numerically unchanged.
The correction deliberately preserves the existing estimated reaction torque;
a dimensional specification does not supply a propulsion measurement.

The exact Meteor75 reference remains **0802SE 19500KV, 40 mm two-blade props and
BT2.0 1S 450 mAh**. The [manufacturer battery page](https://betafpv.com/products/bt2-0-450mah-1s-30c-battery-4pcs)
provides an image of voltage versus time under a constant 11 A discharge. It is
not a motor/propeller map, a maximum-current measurement or a battery-resistance
measurement. Raw observations, test temperature, cell age and repeated samples
remain unavailable. No matched propulsion dataset was found in the bounded
primary-source follow-up; do not blend another motor revision into this preset.

Software preparation continues without pilots or real radios. Commit
`66305696561c6c35e065a009066364cf777fe10c` on the separate
`codex/fpv-propulsion-load-20261018` branch implements a non-activating load-line
solver: it intersects documented voltage paths and solves battery voltage against
their current, using explicit battery-model inputs and a caller-declared DC
current basis. **30/30 tests** pass (14 new load cases and 16 existing evidence
cases); formatting, lint and independent review pass. Review caught and corrected
a false solution at nearly coincident voltage samples; that case now returns an
explicit numerical-resolution failure. [Contract and limits](fpv-propulsion-evidence.md).

This is a local numerical prerequisite with no UI/runtime integration, external
measurement bundle or catalog change. It does not delay PR #1626, activate measured
aircraft physics or close R6. Inspector integration, command/voltage surfaces,
allocation, versioned runtime integration and real measurements still remain.

Non-activating inspector integration is committed as `9d4da6c13` after dependency
commit `f9ddc2693` on that follow-up branch, not yet published:
manual circuit assumptions, an explicit DC-input-current declaration and a
user-requested calculation against the imported eligible voltage sweep. It has
no aircraft write path or measured-default claim. **46/46** targeted checks and
**19/19** package checks pass, along with independent review. Rendered UI acceptance
and hosted release remain. The unchanged bundled Academy byte budget has only
**12,138 bytes** spare, so integration/rebase must remeasure it.

## Blockers, concerns and scope boundaries

- **Realism is not yet measured for all aircraft.** All fifteen local candidates use estimated
  propulsion; inertia, drag, motor lag, reaction torque and electrical parameters
  also retain estimate labels. Manufacturer component names, correct installed
  mass, a passing numerical benchmark and partial static motor points cannot
  establish exact real-aircraft handling. [Fidelity limits](fpv-all-aircraft-flight-audit.md),
  [propulsion evidence](fpv-propulsion-evidence.md).
- **Source-kit scope is incomplete.** The broader site/spreadsheet request must
  not be marked fully delivered. Ground equipment is not aircraft mass or a new
  drone. Military-specific configurations are excluded, not pending work with an
  ETA. Cetus X and Protos now have frozen variants and explicit mass/assist uncertainty labels. The bounded civilian inventory is complete, without converting ambiguous or excluded entries into invented presets. [Source record](fpv-civilian-kits.md).
- **Flight coverage has limits.** Short flights and startup matrices do not
  establish full-course completion, sustained performance on every device or
  every map edition. One earlier World readiness timeout remains unexplained;
  later successes did not establish its cause. It is a historical reliability
  concern, not a reproduced current blocker. [Recorded limitation](fpv-input-recovery-delivery-verification.json).
- **Current live checks found real regressions.** Public Meteor75 pause/resume failure and native camera input/slider observations are retained alongside local fixes. A local archive connection-close error remains under investigation. Automated/source checks do not erase these observations.
- **Some acceptance needs outside access.** Physical radio/pilot evidence is
  deferred; wider devices and iOS runtime need actual targets. Actual desktop Chrome page zoom now has EN/UK observations; other devices remain separate. No available
  measurement has been relabeled as passed to close those rows.
- **Archive capacity may still need explicit cleanup.** The last public test
  observed a full sixteen-entry store and confirmed continued flight. The new
  lazy-start fix prevents new empty archives; it does not delete old records.
  The requested deletion attempt failed, then reload exposed a different inventory. The six older entries cannot be confirmed preserved; no further deletion is authorized outside the named ten.
- **Local workspace is shared and resource headroom varies.** Unrelated demo/UI
  edits remain untouched. Available disk space was approximately **1.1 GiB** during the failed-storage investigation and **5.9 GiB** at the latest check. Heavy verification already running in hosted CI is not duplicated locally; focused source/tests use isolated sparse worktrees. Free space changed during the audit, so recheck
  before large builds. Do not delete user files, archives or generated work to
  manufacture a passing check.

## Completion rule and review cadence

Update each row separately for implementation, automated qualification,
interactive acceptance and publication. A completed software feature is not a
passed physical/device gate. Preserve original failures beside subsequent
regression evidence, and record source/date/device with every new receipt.

Only add new implementation work for an accepted remaining item or a demonstrated
defect. Do not create unrelated features or repeatedly rerun unchanged suites to
make an open measurement gate appear complete. Estimates must be revised after
new data, device access or a reproduced failure changes the scope.

This continuation includes runtime corrections, two civilian presets and new
qualification tooling. Publication status will be updated only after normal
build/deploy checks and public acceptance. No physical-device or measured-fidelity
gate is closed by the software-only results.
