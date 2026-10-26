# Full combat session acceptance

Local working-tree acceptance, 2026-10-19. This complements the rendering evidence in [README.md](README.md); it does not combine separate CPU/GPU measurements into an application FPS claim.

## Method and scope

The dedicated `game/test/fpv-combat-full-session.test.mjs` executes production radio normalization and ownership, companion encounter authority, mission adapters, collision geometry, the aircraft numerical solver, accepted transaction handling, bounded recording, and paired recovery. The aircraft solver runs through the production client API in-process at 500 Hz, with combat accepted at 50 Hz. No base-flight/actor-position stubs or direct solver shortcuts advance the long runs. The radio input is a synthetic Gamepad profile; it does not access or alter the user's USB radio or saved profile.

The native geometry is the shipped `snake-hunt-loops-01` course. A separate geometry-admitted companion shooting lane supplies six moving humanoid targets with 25 health and no return fire. This authored scenario ensures repeatable objective completion and sustained accepted shots; it is not a balance or worst-case 20-target difficulty test. The physical aircraft is the Holybro X650 V2 preset, self-level mode, with the preset's ordinary disabled battery depletion. A test pilot controls altitude by feeding raw radio axes through the real calibration path. The original course and historical mission rules are unchanged.

The regional long run uses the existing verified six-cell endurance fixture, with an authored start providing clear shooting-lane space. The boundary flight uses its normal start and actual streamed regional physics. It does not claim that the procedural fixture is Railway Valley. Actual Railway Valley renderer and admission evidence remains separate.

Each long run pauses at accepted ticks 2,000 and 6,000, submits additional controls while paused, proves that physics/combat did not advance, exports paired gameplay/physics, restores the same boundary, and re-arms through radio OFF→ON. Held Fire is suppressed on each ownership change until a fresh release. The saved radio profile must remain identical. Final recovery verifies persistent actor state, clocks, scoring and projectiles; one-shot accepted events must clear to prevent duplicate effects.

Run with:

```sh
FPV_COMBAT_ACCEPTANCE_OUTPUT=/tmp/fpv-combat-full-session-acceptance.json \
  node --test game/test/fpv-combat-full-session.test.mjs
```

## Results

**4/4 passed**, zero failures; 170.05 seconds wall time on Node 20.19.5 / Apple M4 Pro, macOS arm64. The [machine-readable results](full-session-acceptance.json) include exact source hashes and per-minute timing windows; the [test log](full-session-acceptance.txt) records completion. The new test file also passes ESLint.

| Scenario | Accepted duration | Outcome | Step path mean / p95 / p99 |
| --- | --- | --- | --- |
| Native aircraft hunt | 9,000 ticks / 180 seconds | Time limit completed; 1,125 shots, 963 hits/defeats | 1.317 / 2.090 / 3.142 ms |
| Native Standard elimination | 80 ticks / 1.6 seconds | All six required targets cleared; 10 shots, six hits | 0.614 / 0.927 / 1.828 ms |
| Regional aircraft continuous | 36,017 ticks / 720.34 seconds | 112 waves, 4,503 shots, 672 hits/defeats | 3.290 / 4.204 / 8.003 ms |
| Regional Standard boundary/return | 3,315 flight ticks / 66.3 seconds | Actual 128 m cell boundary crossed outward and inward; three total recenters | 0.391 / 0.710 / 1.340 ms |

Both aircraft runs accepted every submitted physics transaction, with zero rejected intervals. Their accepted event IDs remained unique. The continuous run then restored the final recovery and accepted tick **36,018**, with radio Fire requiring its fresh release. No runtime or user configuration change was needed.

The regional continuous run retained companion commands from tick **27,000 through 36,017** in three sealed segments plus 17 tail commands. Its separate aircraft recorder retained **662.62–720.34 seconds** in three segments, still reported `recording`, and had no recorder error. The native hunt also exceeded the aircraft byte-window capacity, retaining **133–180 seconds**, while its companion recording remained complete. These are explicit bounded recent histories, not unbounded whole-run recordings.

Final paired recovery sizes were 3,513,457 bytes for the hunt, 18,691 bytes for elimination, and 5,512,164 bytes for the continuous regional run. Final save / restore costs were approximately **259 / 2,143 ms**, **1.6 / 4.2 ms**, and **264 / 8,494 ms**, respectively. Intermediate regional restores cost approximately 6.0–10.2 seconds. These are paused recovery operations; the regional restore cost is a visible latency limitation to keep in mind, not normal frame time.

The real boundary flight left the encounter at flight tick 710, travelled to x=150,222 mm, and returned at tick 3,315 to x=103,983 mm. The companion stayed at tick **710** throughout the outside portion, preserving every actor, projectile, score, cooldown and health value; Fire produced no outside-area progress. Fourteen verified terrain asset requests and actual physics generated the transitions. Returning paused the flight, and paired recovery preserved the final physical boundary and recenter count.

Per-minute CPU timings do not show sustained growth with retained history: regional mean step costs begin around 3.12 ms and end around 3.19 ms. The 180–300 second windows have higher p95 values (7.02–8.36 ms), and the maximum individual regional step was 62.32 ms. Shared-machine scheduling and garbage collection are included. These figures do not establish smooth visual frames or a zero-hitch guarantee.

## Final contact-fix recheck

After preserving transient substep contact metadata, all four scenarios passed
again in 164.38 seconds; see the [recheck log](full-session-final-recheck.txt).
The detailed timings and source hashes above belong to the earlier measured run;
the recheck confirms the same assertions against the final contact bridge and
does not replace that earlier timing report.

## Timing interpretation

`stepCpu` contains elapsed wall time around radio sampling and the production session step, including the actual solver and returned session snapshot. Tests run faster than real time. It excludes browser worker message transfer, WebGL rendering, DOM/layout, audio, USB scheduling and the application's animation-frame scheduler. Save/restore pauses are measured separately. Assertion/report-generation overhead and the caller's pre-step snapshot are outside the step timer. Other development work may share the machine; these are functional-run timings, not an isolated machine benchmark.

The existing 10-minute renderer measurements use real WebGL with synthetic accepted events and actor motion. This acceptance uses actual flight/combat with no renderer. **Neither result, nor their sum, proves a full application's 60 FPS desktop or 30 FPS mobile frame budget.** A later, separate [combined browser acceptance](combined-browser-acceptance.md) exercises the actual host, solver worker transport, renderer, UI, audio, normalized synthetic radio input and long recovery. Its before-run findings and corrected late-state/boundary results are reported separately; neither report establishes worst-case full-game or physical-USB frame timing.

## Remaining limits

- Physical-radio usability was confirmed by the user before and after pause. The automated tests here inject raw Gamepad samples and do not replace an extended human USB-radio session.
- These complete sessions cover representative native and regional adapters, not a full duration flight on every catalogue level or every aircraft preset.
- The six-target controlled lane provides sustained hits and deterministic completion. Maximum population, hostile return fire, all materials/families and full remains rendering are covered by separate focused and renderer stress checks, not by this particular full-session workload.
- This in-process report excludes browser rendering and transport. The separate [combined browser acceptance](combined-browser-acceptance.md) now records prolonged transport, actual UI recovery, main-thread heap and observable worker/renderer cleanup. Total-process/worker memory, worst-case full-game frame budgets and mobile qualification remain outside that evidence.
- Combat remains local practice. A checkpoint checksum and validated bounded recording are not a claim that an expired historical recording is a complete verified replay.
