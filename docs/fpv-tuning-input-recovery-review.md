# FPV input recovery and completion review — 17 October 2026

The continuation fetched main and rebased before edits. Main remains
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
**740 passing practice tests**, release validation, lint and scoped formatting.
Five new host regressions cover absent, malformed and failing inputs; four cover
startup diagnostics. The real Chrome fixture passes English and Ukrainian, keeps
continuous accepted sequences, exports/replays six short recordings, and disposes
all ten workers. A separate local browser with a deliberately stalled script and
404 proves the new observer retains a failed startup without hiding its cause.
All 20 existing numerical qualification sources are unchanged; no new benchmark
is claimed. Two independent reviews found no further actionable issue.

Desktop follow-up and ordinary publication/live acceptance are in progress.
Earlier delivery reports apply to `fb3caf12b`; they do not automatically qualify
this correction.
