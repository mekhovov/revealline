# Demo clock continuity follow-up — 30 September 2026

## Source and delivery scope

This narrow continuation starts from current main `451b82dc13dc8a8545ff964ffb724d3d756ac62a`. The old Demo branch was a clean ancestor of main; rebasing from `c697f72df` lost no commits and required no conflict resolution. The existing ten authored routes, eight base maps, two supported live maps and earned-picture fixes from merged [PR #781](https://github.com/mekhovov/revealline/pull/781) remain intact. No historical aggregate was replayed wholesale.

The actual-host checks first used prerequisite `65330cd48a330b2bd8eaf8319914c8d7098a5315` from [PR #816](https://github.com/mekhovov/revealline/pull/816), restoring the Ready export already imported by the app. After its protected merge, this branch fast-forwarded to `451b82dc1`; those two commits have identical trees. That prerequisite is already on main and is not a duplicate change in this PR.

[Named source hashes](source-scope.json) identify the files relevant to these checks. This is a bounded verification scope, not a complete distributable inventory. The intended scheduling target is the existing [v0.150.0 milestone](https://github.com/mekhovov/revealline/milestone/57); scheduling does not allocate, publish or qualify a release.

## Change and review

A visible spectator clock previously waited indefinitely for its outstanding animation frame. If a browser withheld that callback while still executing timers, simulation, recap rotation and music scheduling had no independent wake. Each visible request now owns a 250 ms fallback timer. The first callback cancels both handles; ticket identity and cancellation generations reject any queued sibling. This remains one simulation clock.

The existing two-second admitted debt, quarter-second slices, finite catch-up burst, bot maneuver budget and hidden no-paint boundary remain unchanged. Recovery advances suppress delayed one-shot game audio and visual effects. Independent music updates continue while Demo is explicitly paused; neither focus nor timer recovery changes playback intent. Practice continues through the ordinary foreground game loop.

This closes a concrete scheduling gap consistent with the historical [158.0978-second visible-return stall](../demo-qualification-2026-09-29/loading-recovery/browser-final-review.md). It does **not** establish the physical cause of that earlier observation, nor prove uninterrupted execution during browser/OS suspension.

The opt-in Solo test fixture's controlled animation frames and monotonic clock were dropped during the prior integration. They are restored while preserving the newer PNG/JPEG/WebP dimension handling. Tests may now explicitly withhold callbacks without changing visibility. Independent review found no blocking clock ownership, stale-callback, picture-policy or save-isolation defect in the narrow diff.

## Verification

- [Clock tests](clock-tests.tap): **20/20 passed**. A controlled 160-second visible/unfocused interval delivers timers alone and progresses simulation, recaps, audio scheduling and paint. Tests cover both callback orderings, stale siblings, Pause, hidden transitions, freeze/reset/stop/disposal, bounded debt and planner budgets. Modeled scene counters are not real browser footage.
- [Offline source/director tests](source-tests.tap): **13/13 passed**. The new test uses the shipped catalogue, real replay admission and production director. Uncached optional replay bodies fail once per scene; an independently verified retained recording plays while preserving Pause and cache bytes. With no compatible source, the pool remains unavailable without repeated fetches or content installation. This is a modeled network/storage boundary, not a physical offline-device acceptance.
- [Initial actual-app background cohort](background-tests.tap): **4/6 passed**. The new withheld-frame test passed: a real first-signal recording completed to the exact independently replayed checkpoint, retained its recap and adopted/advanced a new scene while visible and unfocused. Explicit Pause and ordinary checkpoint/storage preservation were checked. Earlier hidden rotation and pending-source adoption cases also passed.
- The first two cases in that initial cohort failed the existing **five-second initial-picture readiness predicate**, before operating the demo. Unrelated validation/i18n jobs and Git repacking were present; the later host command could not even create its log because of `ENOSPC`. Contention is context, not a proven cause. The failures are retained and no timeout was widened.
- After disk space recovered to about 15 GiB, the [single focused recheck](background-readiness-recheck.tap) passed both previously failed cases: **2 passed / 4 unselected**, with unchanged tested runtime/fixture bytes and the same five-second predicate. Unselected cases are not extra passes. This later result does not erase the initial failures.
- The [additional host/audio/earned-picture/Ready cohort](host-tests.tap) is **incomplete**. Ten top-level cases and seven nested cases report success, including shared audio intent, earned images through takeover/completion, exact Ready handoffs and early keyboard/touch/save-isolation checks. The process exited with code 7 before its TAP summary while the filesystem again reported ENOSPC; the retained output cannot establish the exact termination cause. No full-cohort pass is claimed. A later small documentation command also failed to create its temporary here-document. No further test retry was started.

Scoped JavaScript lint and formatting checks passed before the shared dependency directory disappeared. A later pinned Prettier check passed using an isolated cache location. No heavy build, native package, new two-hour observer, physical controller/audio trial or unfamiliar-viewer review was run. Earlier failures and observation records remain untouched. The proposed change does not alter earned-art policy, expose unearned originals, grant progression or change recording formats.

## Offline policy reconciliation

Current main retains frozen replay bodies in hosted distributions and ZIPs but excludes them from mandatory root/company offline caches. The [current Demo guide](../../demo-mode.md) now states this boundary and the failure behavior. Older source-pinned packaging reports remain historical; they are not rewritten to claim current mandatory caching.

## Remaining priorities

1. Repeat source-pinned rendered browser/native observation on the intended release build, including visible-but-unfocused windows, hidden pauses, music boundaries and resource measurements. Preserve the earlier watchdog failure and browser stall until independently explained or bounded by appropriate new evidence.
2. Complete physical keyboard/controller/touch, native lifecycle and audible-output acceptance, plus the three unfamiliar-viewer checks. Automated boundaries do not substitute for these gates.
3. Continue optional variety with attributable human recordings and independently qualified maps. Current authored routes must not be relabeled as human play or retagged as company missions.
4. Keep repository-wide preservation reconciliation separate from this clean scoped PR. A read-only snapshot found 268 registered worktrees, 46 substantively dirty checkouts and two older tips absent from remote reachability. Active owners and historical conflicts were preserved. The release coordination audit owns semantic disposition; this task cannot truthfully declare every unrelated worktree clean.

The two unpublished historical tips were `codex/combined-native-spatial-audio-20260929` (`1c70bc3a9`, closed #796) and `codex/radio-release-input` (`26e64d3d8`, old version/catalogue changes). No reset, deletion, force push or blind integration was performed. Current source scheduling and tests do not replace the wider [deferred-work record #813](https://github.com/mekhovov/revealline/issues/813).
