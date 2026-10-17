# FPV input recovery and completion review — 17 October 2026

The continuation fetched main and rebased before edits. The starting main was
`fb3caf12bd43743670f47c42dc21f7a406223379`; the previous delivery evidence is
preserved at `6018a0f5d113759ad7a13ad06208366cbd5d652e`. Unrelated local files
remain untouched.

## Additional examples and decisions

| Primary evidence | Decision for this implementation |
| --- | --- |
| [Betaflight profile synchronization fix #5231](https://github.com/betaflight/betaflight-configurator/pull/5231) guards dirty drafts and in-flight loads when the transmitter changes profiles. | Retain stale-tab, draft and history/import protections. Transmitter-owned profile selection is outside rate/throttle transfer; an App update does not expand our firmware whitelist. |
| [Betaflight preview fix #5266](https://github.com/betaflight/betaflight-configurator/pull/5266) corrects preview rendering. | Keep curves and indicators in a shared coordinate system and retain narrow-screen editor checks. Our existing SVG viewBox provides this; no new rate algorithm is needed. |
| [Betaflight App 2026.6.2 release](https://github.com/betaflight/betaflight-configurator/releases/tag/2026.6.2) specifically fixes serial-device enumeration. | Distinguish App releases from firmware versions and avoid attributing earlier profile/preview fixes to this maintenance patch. |
| [Liftoff's official 2026 announcements](https://store.steampowered.com/oldnews/?appgroupname=Liftoff&appids=410340&feed=steam_community_announcements) include Quick Rates/low-throttle corrections in 1.7.2 and a replay-settings correction in 1.7.3. They also warn that controller calibration/layouts can differ between platforms. | Preserve independent numerical fixtures, separate device calibration from portable profiles, and freeze replay configuration. Test input disappearance as a recoverable host condition. These releases do not validate our physical model. |
| [VelociDrone's manual](https://www.velocidrone.com/desktop_manual) limits its special Micro profile to Angle mode. | Continue separating rate evaluation from self-level assistance and aircraft tuning. Imported numbers do not imply the same whole-aircraft behavior. |
| [QuadMath's web simulator](https://quadmath.com/sim.html) places radio calibration, per-axis CLI rates, camera and aircraft settings together. | Retain direct tuning access and clear input status. Missing hardware must preserve a completed practice segment and its export. |

These sources describe features or fixes; they are not independent measurements
of competing simulators. No online catalog, automatic PID conversion, generic
realism slider or broader firmware support is added.

## Remaining software work found by review

1. **Recover from unavailable input in Advanced practice.** A mounted host with
   the real worker reproduces the issue without a physical radio: after a valid
   flight tick, selecting an unavailable radio and pressing Start sends no step,
   but disables Start, Restart and Export. Switching back to keyboard cannot
   recover. The worker itself still exports an exactly replayable recording.
   Keep input-sampling failure separate from worker failure; pause, preserve the
   last committed state and export, provide EN/UK guidance and require explicit
   resume after input becomes available. Genuine worker errors remain unavailable.
2. **Capture startup evidence when it fails.** The earlier public World timeout
   lacks request timing and startup state, so its cause remains unknown. Add
   bounded, credential-free diagnostics to the live acceptance runner for initial
   unlock, reload and offline process reopen. Preserve failures, do not retry them
   automatically or change access controls. Bind Advanced practice, Regional and
   import modules directly in the public source check.
3. **Verify and deliver.** Run focused regressions, a real browser/worker input
   recovery check, the practice suite, lint and release validation. Publish the
   correction through normal main checks and verify current public password,
   offline restart, saved rates, recording replay and cleanup with the supplied
   transient credential. Retain source-bound receipts and the original timeout.

## Scope and acceptance limits

The phase 1–3 source review found no additional actionable gap in rates/throttle,
ordered CLI/preset imports, profile inheritance/history, backup/stale-write guards,
or independent algorithm drafts. Phases 4–6 remain implemented as optional,
unscored Advanced practice. The input boundary above is the concrete new defect.

Physical radio/touch, pilot feedback, measured aircraft fitting, iOS execution and
a wider hardware matrix remain deferred. Validated propwash/ground effect,
verified Advanced competition and default promotion depend on those gates.
Synthetic input loss tests validate recovery software, not radio hardware.
Browser elapsed times do not establish physical input-to-display latency.

## Verification and delivery status

The [local verification receipt](fpv-input-recovery-verification.json) records
**741 passing practice tests**, release validation, lint and scoped formatting.
Five new host regressions cover absent, malformed and failing inputs; five cover
startup diagnostics. The real Chrome fixture passes English and Ukrainian, keeps
continuous accepted sequences, exports/replays six short recordings, and disposes
all ten workers. A separate local browser with a deliberately stalled script and
404 proves the new observer retains a failed startup without hiding its cause.
All 20 existing numerical qualification sources are unchanged; no new benchmark
is claimed. The initial independent reviews missed unconstrained network/capture error strings.
A subsequent PR review used synthetic URL-bearing errors to demonstrate that those
metadata fields could retain URL details; no actual credential leak was reported.
The correction retains only fixed error categories, with a fail-before/pass-after
regression and a repeated real-browser stalled-script check. The original action
result/error, request status/timing and bounded cleanup remain intact. An independent
review of the correction found no further issue. Existing outer failure stacks and
page-error logs are outside this narrow metadata claim.

The [actual Electron fixture](fpv-input-recovery-native-runtime.json) also passes:
unavailable-radio Start preserves export/restart at 220 mission ticks, and explicit
keyboard resume continues the same flight to 478 ticks. Both OS-saved recordings
replay exactly with the earlier input/hash prefix retained. Restart and leaving
practice dispose both workers. Ordinary desktop/iOS staging passes all 209 source
pins; this is one desktop fixture, not production authentication or iOS execution.

A separate [public baseline observation](fpv-input-recovery-startup-public-baseline.json)
used the pre-privacy-correction diagnostic helper for three independent World password logins.
All became ready, with no page errors or pending requests at the observation end.
This does not explain the original timeout or qualify the correction before publication;
it is explicitly bound to the existing `fb3caf12b` deployment metadata.

[PR #1565](https://github.com/mekhovov/revealline/pull/1565) was checked at
`13675fd0070ef5efb0b6bdb901f33922d27a6484` and merged as `3e744a5ef7bede48eafcb79a8377bb46fb37d76f`.
All 12 non-skipped product checks passed; general test/build jobs were explicitly
skipped. The normal [Pages publication](https://github.com/mekhovov/revealline/actions/runs/39045107325) passed build, deploy and verify.
Fresh ordinary password entry, saved 900°/s rates, visible offline installation,
a new offline browser process, recording export/replay and worker disposal pass
for both Academy and World. All eight startup observations pass. A separate live
UI check on each route uses the saved Actual profile and the ordinary unavailable
radio path: the exported recording is unchanged after failed Start; keyboard
selection stays paused; explicit Start continues the same flight. The six saved
exports replay through the published production module with retained hash/input
prefixes, and restart/return dispose all four workers. These checks do
not establish the cause of the earlier timeout or qualify startup reliability.

The [final delivery receipt](fpv-input-recovery-delivery-verification.json)
verifies all 16 public source pins against the hosted inventory, current native
and local evidence, and unchanged numerical sources. The hosted Pages archive is
963,368,960 bytes with 16,631,040 bytes of
headroom below the unchanged 980,000,000-byte limit. Available software and this
delivery scope are complete; the stated physical and promotion gates remain open.
