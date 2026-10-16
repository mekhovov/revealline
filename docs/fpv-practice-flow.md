# Watch → Try → Repeat: paused practice flow

14 October 2026. Focused follow-up to the quick-camera and paused Flight setup increments.

## Player-facing changes

World Studio and Academy now group Retry, Watch example and applicable section practice directly below Flight setup in Pause. A bounded top-down objective thumbnail identifies the selected route; it is a schematic of objective locations, not a promise of an unobstructed flight path. The older duplicate pause Restart is suppressed only while this card is available.

Recorded playback offers Try it yourself, Watch again and a named slow/normal playback-speed selector without opening Settings. World Studio retains quarter-speed where supported; Academy retains its existing half-speed and normal playback. The example sticks remain recorded commands, and taking over always creates a disarmed attempt. The controls do not change recording identities, simulation rules, physics, scoring or earned progress.

Worlds can practise the current recorded section using the existing verified checkpoint restoration. The original reconstruction restores orientation, momentum, response and world state. Section practice remains unscored and cannot export a qualifying recording. Paused exact-section availability comes from an existing matched demonstration, verified replay or accepted checkpoint proof. An in-progress recorder is not treated as verified evidence. Without one of those sources, the action explicitly offers Practise full route from launch, unscored, and retains that wording after fallback. Results continue to use their completed verification before offering the player’s recorded sections. Academy offers the whole drill rather than pretending to support checkpoint reconstruction.

The existing World results now group section replay, targeted practice, the authored example and the player's own verified flight under one Watch → Try → Repeat heading. Academy results offer the authored example alongside the existing result actions. An Academy recording reaching its end now presents an explicit Try/Watch again card instead of leaving the player at a frozen end frame. Camera and active input are retained by the new flow; lesson checkpoint transitions explicitly keep the chosen camera when leaving the expanded coach.

No extra active-flight overlay was added. The card appears only in Pause or at Academy playback end. Buttons are at least 44 CSS pixels, wrap naturally and have EN/UK labels. Device navigation uses the existing shared menu ownership and buttons. Cached state changes update labels; the small route schematic is rebuilt only when the course or mode changes, never for active flight telemetry.

## Verification

- 81 existing flight/UI/appearance checks pass.
- 53 existing control, radio, shared-shell, cooperative replay and replay-rate checks pass.
- Scoped ESLint, syntax checks and `git diff --check` pass.
- Canonical shared-shell and shared-style/asset projection checks pass.
- Temporary host-fixture exercises (not additional committed unit coverage): Academy Pause Retry and recorded Try return disarmed with Chase retained; replay end exposes Repeat and delivers no evidence. Worlds Woodland section restores an actual verified checkpoint, remains paused/unscored, retains Chase, and disables qualifying export.

Logs are `/tmp/fpv-practice-existing.log`, `/tmp/fpv-practice-controls.log`, `/tmp/fpv-practice-probes.log` (includes the initial unavailable-demo probe), and `/tmp/fpv-practice-world-probe.log` (correct matched Woodland proof). No new permanent unit coverage was added; D6 remains the deferred coverage phase.

## Remaining qualification

The parent delivery task owns actual integrated browser checks (EN/UK, phone portrait/landscape, handheld, normal/paused/replay/results navigation), source package preflight, frozen-package CI and protected publication. This isolated sparse checkout deliberately excludes most binary assets and cannot claim complete package qualification. No physical radio, Steam Deck or iPhone acceptance and no live deployment claim are made here.


## Browser-review follow-up

Root integration identified the theme forcing the older Restart button visible and an imported-world practice action promising a recorded section before its live recording was verified. The Restart suppression now uses a theme-resistant important rule. Paused practice now distinguishes accepted recorded sections from unscored full-route practice; a fresh/imported route without a matched example offers Practise full route, describes launch-point practice, and retains that wording after fallback. Temporary host exercises verify both an accepted Woodland checkpoint and an example-free full route, including pause state, step zero for full-route practice and disabled export.
