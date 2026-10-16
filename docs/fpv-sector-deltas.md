# FPV sector comparison

Each scored attempt shows the latest completed objective's sector time, its difference from a verified personal best, and the cumulative difference. Negative means ahead; positive means behind. The compact timing bar sits below the flight view. Final results offer an expandable split table. A new or incompatible setup has no comparison until a complete practice flight is recorded.

The baseline is the fastest complete `practice` proof for the exact course, pack revision, runtime, flight mode, response, world, rules and conditions. Stored labels and summaries cannot establish a record: the app replays shortlisted proofs before enabling Arm and requires all objectives and split boundaries to reproduce. Invalid candidates fall through to the next candidate. The comparison stays fixed for the attempt, including after another record is saved.

Interrupted v2 attempts save their reference record ID, including an explicit null when no comparison was selected. Recovery replays the command prefix, restores completed sector history, and verifies that original reference again. A missing or invalid reference remains unavailable instead of being replaced with a different PB. Older recovery saves without reference metadata select the current compatible best. Unfinished sector time remains part of the next split after resuming. Legacy v1 proofs retain their original execution and reward paths.

Demonstrations, recorded playback, free flight and authoring/checkpoint practice show absolute sector times without a PB comparison. Watching does not create records. Final practice suggestions select the largest positive sector loss when a baseline exists; otherwise the action explicitly names the longest section. New attempts, mode/response changes, closing the flight and disposing the app cancel pending reference work so it cannot update another attempt.

## Verification

- [Replay evidence](fpv-sector-replay-verification.json) covers all 56 existing demonstrations, exact pre-change state/identity preservation, no path sampling for sector extraction, and recovery partway through a sector.
- [Built browser evidence](fpv-sector-browser-verification.json) records the focused Chromium checks, including invalid-fastest fallback, faster/slower signs, fixed recovery references, cancellation, mode/response isolation, unscored views, final split tables, Ukrainian mobile layout and offline recovery.
- The playtest package includes `flight-sectors.mjs` through the established optional-package allowlist and build dependency closure. Build artifacts remain development playtests, not release qualification.
- No unit coverage was added or run. Broad device/controller qualification and final-phase unit coverage remain separate work.

The UI fixture uses the frozen `woodland-01` self-level commands as a practice recording. A second genuine runtime recording waits 100 ticks on the launch pad before consuming those commands: 1,184 versus 1,284 ticks. The expected first split differs by exactly two seconds; subsequent split times match. Mid-sector recovery at tick 700 restores two completed sectors and retains the accumulated two-second loss. Browser checks use those actual proofs, including a deliberately truncated invalid candidate, rather than trusting synthetic summaries.
