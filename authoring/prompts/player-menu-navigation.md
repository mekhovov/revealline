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
core mission and optional-arc endings independently, including Back focus.

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
