# FPV tuning boundary review — 17 October 2026

This continuation starts from main `1d631986ad73ba1301a151a76b1607cf03dbe97a`.
It audits the completed original scope and corrects three reproduced transitions.
Physical radios, touch devices, pilot feedback and identified-aircraft data remain
unavailable as agreed. They do not block software corrections or become passes.

## Additional primary-source review

| Example | Recommendation applied to the existing plan |
| --- | --- |
| [Flight Division race update](https://flightdivision.com/changelog/2026-09-27-race-day) documents resetting records after aircraft power changed and separating records by drone. | Keep performance restrictions in comparison classes and preserve historical identities. No scored Advanced promotion follows from rate-curve compatibility. |
| [Flight Division timing update](https://flightdivision.com/changelog/2026-09-24-more-feel-more-flight) distinguishes physics response from end-to-end radio/display latency. | Retain explicit sample timing and fixed simulation frequency. Low-frame-rate behavior and physical latency require distinct evidence. |
| [Saturn FPV Tools](https://github.com/saturn-fpv/fpv-tools) documents five-model overlays, stick sensitivity inspection and CLI generation in an offline web-based app. | Our current evaluator/curve/CLI scope is sufficient. Approximate conversion stays a future convenience with error reporting. |
| [StickTime](https://github.com/juricabi/sticktime) offers Actual-rate choices, multiple aircraft and a browser emulator of its radio Lua implementation. | Preserve portable pilot rates independently of aircraft and delivery platform. Emulator or advertised model-fit results do not qualify our physical hardware or aircraft. |
| [WebFPV notes](https://webfpv.org/notes/) and [QuadMath](https://quadmath.com/sim.html) retain separate aircraft tuning and disclose headless checks or approximate build estimates. | Keep the software/physical distinction and verify saved-data transitions. Do not add unmeasured effects to claim realism. |
| [Tagged Betaflight App parser](https://github.com/betaflight/betaflight-configurator/blob/2026.6.2/src/components/tabs/presets/PresetsRepoIndexed/PresetParser.js) accepts case-insensitive `true` or `yes` for boolean properties. | Match `FORCE_OPTIONS_REVIEW` metadata and its saved receipt against independently executed tagged code. This changes neither rate commands nor our mandatory import review. |

These are documented features or implementation descriptions, not independent
measurements of competing simulators' flight fidelity. No broader firmware-family
support, catalog, firmware execution or automatic PID conversion is introduced.

## Corrections and acceptance

1. **Explicit history restoration supersedes import intent.** Restoring a revision
   invalidates both pending and completed previews, even when historical and current
   curves are equal. A late digest cannot replace the chosen draft or attach an old
   import receipt. Deliberate re-preview still works. Verify native and CLI input,
   persisted receipts and actual browser interaction.
2. **Regional flight limits preserve export.** Known typed duration/recording stops
   pause at the last committed state, retain recording/recovery export and require
   explicit restart or verified earlier recovery. Preparation, cancellation, blur
   and repeated resume cannot erase the stop. Unknown errors remain unavailable.
   Verify actual 720-second history, exact replay, boundary recovery and terrain
   history limits without changing quotas or simulation timing.
3. **Preset boolean parity.** Accept case-insensitive `yes` alongside `true` for
   the source's review metadata; preserve existing bare-directive support. The
   independent fixture covers true, false, mixed case and nonboolean strings.
   Import review remains required and unsupported settings remain inert.

Run focused regressions, full practice tests, editor and real-worker browser checks,
lint and release validation. Reuse previous numerical evidence only if every
relevant source pin matches; source-bound historical reports are not relabelled.
Publish through normal checks and main deployment, then verify ordinary password
access and offline persistence using isolated browser profiles. Credentials are
transient and excluded from reports.

## Status

The corrections and local browser acceptance are complete: **731 practice tests**,
six Chrome/Firefox/WebKit editor cases, the real Chrome renderer/Regional worker
check, lint and release validation pass. The browser exports a 36,000-tick record
at the actual duration stop (147,017 bytes, hash `fb9e9a84`), verifies exact replay,
restores it while keeping resume disabled, explicitly restarts, then verifies
terrain landing/takeoff and disposal of all eight workers. Ordinary desktop/iOS
staging passes. The existing six-runtime numerical report retains all 20 source
pins; no numerical rerun or wider-platform claim is made.

The initial protocol-injection probe omitted a session identifier, and the first
browser attempts targeted hidden menu controls after automatic stopping/restart.
Corrected harnesses use the ordinary pause shortcut; their failed outputs remain
in the evidence directory. Neither correction changes deployed access controls.
Independent reviews found no further actionable issue in the bounded changes.
Actual desktop fixture evidence and normal reviewed publication are recorded
separately when complete. See the [implementation status](fpv-tuning-implementation-status.md).
Advanced remains optional, unscored and default-ineligible. Physical controls,
pilots, aircraft identification, iOS execution and wider devices remain deferred;
validated propwash/ground effect and scored/default promotion depend on those gates.
