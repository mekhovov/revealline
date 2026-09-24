# Player menu navigation maintenance prompt

Implement the next accepted feature in `docs/player-first-ux-execution.md` from the
current reviewed source in an isolated worktree. Preserve unrelated work, historical
content, save ownership, exact pictures and existing mode mechanics.

Reproduce the actual player path before changing it. Use the shared controller
navigation adapter for menu keys and controller edges, not a second DOM-order
arrow handler. Model real card rectangles at one/two/three/six columns and after
reflow. Test ragged rows, hidden/disabled controls, grid exits, native text/select
editing, Tab and held Confirm. Opening focuses retained/current mission or first
enabled card; unresolved remote selection must retain its cancellable focus lease.
Expose `primary()` to hosts rather than hardcoding Search. Boot targets the visible
Start/Continue action only while its initial focus owner remains current.

Audit the rendered screen, not just a panel's descendants. Visible continuation
controls and mode/header links beside a menu must belong to its restricted input
root in Legacy, installed and Journey content. Keep live-board controls excluded.
Cancelling a departure restores the exact visible opener without resuming play.

Keep progression destinations explicit: a terminal Journey result opens Browse
missions instead of silently advancing into an optional Remix. Retain its accepted
run, picture and result until the player chooses a replacement. Test the final
core mission and optional-arc endings independently, including Back focus. In
Versus, an unfinished first-to-two match still offers Next round; do not label
that round as a completed Journey or advertise Rematch before it is available.

An incoming mission link can overlap initial picture materialization. Join the
captured boot writer before preparing the requested original, then recheck the
opening lease, foreground, run and newer-input ownership. An unrelated initial
picture failure must not authorize a substitute or prevent the correct original
from being prepared. Prove success, failure and cancellation with held real-asset
requests, not only a warm-cache timing check.

Test actual host keyboard/controller paths, departure cancellation and image/run
retention. Exercise every newly reachable setting through its real change handler.
When historical assertions fail, derive expected values from the accepted runtime
contract and verify picture identity from the bound background draw; do not relax
outcome, ownership or stale-operation assertions. Record source, browser and physical
device evidence separately. Run required gates, publish one feature through its PR
and immutable Pages pipeline, then verify normal public entry before accepting it.

For host replay fixtures, use the host's exact approved tuning and exposed controls;
Team has no Boost input. Preserve archived untuned proofs. Historical mastery must
be exercised through a genuine restored historical attempt, not awarded to a new
tuned run. A partial presentation fixture advertises only assets it prepares;
full production bindings still require real decoded frames and strict validation.
Join the real Missions activation operation and assert immediate loading separately
from readiness. Diagnose platform-specific fixture differences against full states.
A test-only portable golden must bound only witnessed per-route scalar differences
and retain exact remaining state, host/reference and public replay checks. Never
apply its tolerance to runtime saves, recordings or earned originals.

Separate retained historical component tests from current player journeys. An
injected unregistered campaign may test its original chooser/profile authority at
an explicitly named native-dialog boundary; that is not public-catalogue evidence.
Current selection must activate the visible Missions action, await its operation
and match the full source/edition/campaign/runtime identity. Preserve historical
routes while independently resolving the fresh host's approved tuning. A route
fixture must use legal host inputs, never neutral braking or injected outcomes.
Use decoded background identity, not the last actor draw call, for picture checks.
