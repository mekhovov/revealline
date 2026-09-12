# Round 29: couch setup, pause and results with a controller

Accepted implementation contract, 2026-09-12, following root and independent review. No implementation or release verification is claimed. Round 28/v0.19 verification remains separate.

## Player outcome and current gap

A player using a standard controller can choose the shared race setup, start, pause, resume and play another round without reaching for the mouse. One controller navigates the shared menu; the two craft retain their separate inputs. Keyboard and touch remain usable throughout.

Today [`attachCouchInput`](../game/couch/couch-input.mjs) assigns up to two standard pads, but its inactive `poll()` clears flight input and returns before interpreting buttons. [`couch.mjs`](../game/couch/couch.mjs) binds Start/Resume/Next round to DOM clicks; the only gamepad interface action during flight is Pause. Thus a controller can pause both boards and then cannot resume them. Native selectors and buttons already provide the actions needed. Replay Theater has a separate controller gap, but its existing empty, verification, cancellation and restart states are outside this increment.

The shared [`router`](../game/ui/controller-router.mjs) already supplies deliberate joining, neutral gates and repeated menu directions. [`navigation`](../game/ui/controller-navigation.mjs) already drives ordinary DOM handlers, previews select edits, cancels stale targets and maintains a visible focus ring. Reuse these contracts without changing their solo defaults.

## Ownership and fixed couch controls

Preserve couch's existing automatic flight allocation: the first available standard pad fills Player 1, the next fills Player 2, and surviving assignments remain in their original player slot when another disconnects. Keyboard players do not occupy a controller slot; keyboard/touch input still combines with that player's pad under the current priority rules. Do not introduce a two-player Ready lobby or require joining before keyboard play.

Menu ownership is separate and temporary. While the match is Ready, paused or finished, either assigned pad may release its controls and press a physical face button or Menu to claim the shared menu. Use the router's fixed join indices `0, 1, 2, 3, 9`; the join gesture only shows focus. Release again before Confirm. If both join in one sample, the lower physical index wins, exactly as the router specifies. The other pad cannot move focus or activate controls. Pads outside the two current flight slots cannot claim this menu.

Retain the owner across rounds and ordinary scope changes, with a fresh neutral gate. Add a native **Release menu controller** button (`race-menu-release`), available only in a non-running match with an owner. It invalidates menu ownership, cancels previews and requires a new neutral sample and join edge from either assigned pad. Treat the router's intentional invalidation result as released ownership, not a hardware-fault announcement. Keyboard/touch may use this button too. An owner disconnect event, missing slot or changed router signature revokes ownership; a replacement must join again. Native pointer/keyboard input relinquishes the controller focus/edit mode, as the shared navigation adapter already does, without silently changing flight assignments.

| Context | Fixed standard input                       | Meaning                                                                                     |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Both    | D-pad `12/15/13/14`; left stick axes `0/1` | Cardinal direction; digital priority Up, Right, Down, Left, strict stick threshold `> 0.35` |
| Menu    | South `0`                                  | Activate focused control; begin/commit a select preview                                     |
| Menu    | East `1`; Menu `9`                         | Cancel an edit; otherwise focus the primary action without activating it                    |
| Flight  | South `0`; West `2`; right shoulder `5`    | Ability; supply; held Boost, unchanged                                                      |
| Flight  | Menu `9`                                   | Pause both boards, unchanged                                                                |

Couch does not adopt the solo saved mapping, glyph-family preference or Boost Toggle. East and North do not gain flight Stop/Hangar actions. Use position labels in couch hints and explicitly call these the fixed couch controls. This is not a claim of complete remapping support.

## Host integration and finite API

Keep the public signatures of `attachCouchInput`, `createControllerRouter` and `attachControllerNavigation`. The host supplies their existing injection points:

```js
// These readers return the same current frame's snapshot, never query hardware.
input = attachCouchInput({
  getGamepads: readCachedPads,
  onPads: rememberPlayerSlots,
  // Existing active/tap/pause/stop callbacks remain.
});
menuRouter = createControllerRouter({ readPads: readAssignedMenuPads });
navigation = attachControllerNavigation({
  getScope: couchScope,
  getRoot: () => document,
  getDefaultFocus: () => document.getElementById('race-start'),
  accept: isCouchMenuControl,
  onBack: focusPrimaryAction,
  onMenu: focusPrimaryAction,
  onHint: showMenuHint,
});
```

The snippets name internal host functions, not new exported APIs. `rememberPlayerSlots(count, slots)` copies the existing `onPads` slot pair. `readAssignedMenuPads()` masks unassigned entries with null while preserving the sparse browser array's original length and positions; do not compact it with `filter()`. The router's snapshot reads both an entry's physical index and its array position. A failed hardware read is retained as a failed frame read for both consumers; do not turn a denied API into a successful empty-controller report.

At the start of each visible, focused animation frame, capture the hardware array once, bounded to the router's existing 32-slot limit. Feed that snapshot to `input.poll()` once, which updates flight assignments before menu filtering. Then:

1. If the match was running at frame entry, do not dispatch menu actions that frame, even if polling just paused it. Continue existing fixed stepping only if it remains running.
2. Otherwise sample the menu router once using the current stable scope and rAF timestamp. Do not sample it during flight: an ability press must not silently claim a menu.
3. Handle owner loss and scope invalidation before forwarding an edge. Compare the assignment pair and inspect polling/loss state even when already Ready: a disconnect/reassignment there need not change the match status, so a paused-transition flag alone is insufficient. Consume that loss/reassignment sample before any menu edge. On a new join or return to a menu with an owner, focus the primary action and call `navigation.engage()`; this must not click it. On later samples, pass only `result.ui` to `navigation.handle()`.
4. If a menu Confirm starts/resumes a round, consume that frame for the transition: no fixed step from its cached input. The next frame uses the existing flight neutral gate. Preserve one `input.consume()` per actual fixed tick, including its current pending-action edge behavior.

Host `clear()` on an actual transition clears flight input, the accumulator, router edges/repeats and navigation previews. Crucially, `attachCouchInput`'s internal inactive `clear()` runs every Ready/menu frame and must **not** clear the menu router: doing so prevents joining. Keep that implementation private to the flight adapter. Repeated native input cancellation must not create another hardware read.

Scope is `flight` only while `match.status === 'running'`. Otherwise use a short stable token containing match state, a host round/setup generation and whether setup is shown, for example `couch:paused:4:focus`. Increment the generation when `prepare()` creates a new duel, never each render. Revealing/hiding setup invalidates select previews even if the match object is unchanged.

## States, lifecycle and visible controls

| Actual state                                 | Primary button and behavior                            | Navigation boundary                                                                                |
| -------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Loading/error                                | Existing load message and native Solo return           | No router/menu dispatch before a valid mounted duel                                                |
| Ready                                        | Start round                                            | Join/Back/Menu do not start or advance either board                                                |
| Running, including one recovering/lost craft | Primary unavailable; Pause available                   | Only existing flight commands; do not treat an individual run's terminal state as a finished match |
| Paused                                       | Resume round                                           | A separate Confirm resumes; Back/Menu only focus Resume                                            |
| Finished win, loss, timeout or draw          | Next round, or Play another match after two round wins | Keep existing winner/series accounting and fresh-round behavior; no automatic restart              |

Derive button availability from the duel state: disable Pause outside running and disable the primary button while running. This also prevents the current Ready Pause click from producing a misleading Resume caption. Lifecycle calls to `pause()` must likewise leave a Ready duel's Start caption intact; Resume describes an actually paused round. New match still clears the series and returns to Ready. Setup commits retain their existing reset behavior; World remains a visual change. Focus boards/Show setup remains the way to reveal setup and the existing Solo link; leaving board focus during flight still pauses first.

The controller allowlist includes only the five setup selectors, existing race actions and checkboxes, Release menu controller, and the existing Solo link with ID `race-solo-return`. Exclude both `.race-pad` groups and canvases. The shared adapter skips hidden/disabled/inert controls and uses ordinary native handlers. In a select: browse without applying; Confirm changes once; Back/Menu cancels without resetting the round. Replaced class/theme options invalidate a draft before it can commit. Do not add a custom keyboard navigation map: Tab, arrows inside native selects, Enter/Space and both existing flight key sets retain their current boundaries.

Put a concise `race-menu-status` polite status/hint near the primary actions, visible in Focus boards mode (the current `race-pad-status` micro-note is hidden there). Show player assignment separately from menu ownership, for example “Player 2 controller has the menu. South selects; East cancels; Menu focuses Resume.” An unowned menu says “Release controls, then press a face button or Menu to choose the menu controller.” Include keyboard/touch availability and clear no-standard-pad/API-unavailable feedback, using the captured hardware frame to distinguish unsupported mappings from no connected pads. Update polite status only when its text changes; do not announce every frame or overwrite round results with controller hints. Reuse the shared focus/editor styles, preserve 44px action targets, and let long labels wrap.

Blur, hidden visibility, native inactivity and pagehide pause a running duel, clear cached/held input and cancel previews. While unfocused/hidden, perform no hardware reads, menu dispatch or physics; reset frame timing so returning cannot consume the absence as elapsed play. Keep owner identity through ordinary focus loss but require neutral again; actual owner loss requires rejoining. For a persisted pagehide, retain listeners and return paused with fresh timing; for terminal disposal, destroy both adapters and stop callbacks. Neither path automatically resumes. A disconnect detected by flight polling pauses both players; surviving slots remain stable and the menu cannot act on that same loss sample.

Gamepad polling does not manufacture browser user activation. If Enable music requires a trusted native action, preserve the existing failure message and silent play; do not promise controller-only OS/API activation.

## Implementation ownership and verification

Production changes are confined to `game/couch/couch.mjs`, its `index.html` and `couch.css`. The existing input/router/navigation signatures should suffice; report any necessary shared-adapter change before expanding scope. No changes to core, multiplayer commands/ranking, map/pack/replay/session formats, solo preferences, saved progress, art or archived proofs. This remains local couch play; no network service is introduced.

One owner implements host sampling/lifecycle wiring; another can implement the finite markup/status styling after IDs are agreed. Tests belong in a new `game/test/couch-navigation.test.mjs`, using the actual couch entry, router, navigation, couch input and public duel/core. Extend the existing couch DOM fixture only as needed for genuine focus/visibility/selector behavior; do not substitute spies for all action handlers. A small shared test fixture is acceptable if it avoids copying the existing encounter harness. Keep the current encounter and input tests as compatibility checks.

Meaningful acceptance cases:

- Two assigned pads plus keyboard: neutral/join/held Confirm never starts; a fresh Confirm starts exactly one round. Hold it across the transition and verify no ability, supply, Boost or directional command leaks. A nonowner cannot change setup; simultaneous joins choose the documented index. Release ownership and disconnect/reconnect require a fresh join without moving the surviving flight slot.
- Drive real Start → flight → Pause → Resume → finished → Next, including a best-of-three reset and a draw. Select preview cancellation preserves the same duel/tick/selection; commit invokes one reset. Back/Menu in Ready, paused and results never invoke the primary action. Native keyboard/touch remain usable after controller focus and during mixed flight input.
- Assert one hardware query per active frame, zero during hidden/unfocused/disposed frames, and no extra read per fixed substep. Long gaps, blur, visibility, disconnect and persisted return cannot advance either board or commit a stale edit. A lost craft while its opponent still runs does not open shared menu navigation.
- Run existing ordinary and Sentinel couch routes under Immediate and Steering Assist, comparing unchanged real outcomes/checkpoints and paused encounter phases. Preserve frozen expectations; no new game-state writes or copied prose assertions.

Browser acceptance uses the actual couch page: native setup/start/pause/resume/rematch/return, keyboard focus and select behavior, compact `320×640`, landscape `844×390` and desktop `1280×720`, including Focus boards and long installed-map/class labels. Check readable status, reachable primary actions, visible focus, 44px targets and honest scrolling bounds; do not infer them from CSS strings. Deterministic injected-pad DOM tests cover two-pad routing. The current Controller Lab mounts solo practice, not couch: do not claim it exercised this path or add a second-pad transport in this increment. A CSS-sized iframe is viewport simulation, not physical touch/controller testing. Physical controller compatibility and human ease-of-use remain unmeasured unless separately observed.

## Primary rationale

[Xbox Accessibility Guideline 107](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) recommends digital alternatives and single, non-simultaneous actions throughout menu UI. Its select-then-adjust guidance supports reusing the existing preview/commit editor. This bounded addition does not claim all of XAG 107, notably remapping, is satisfied.

[Xbox Accessibility Guideline 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports logical focus order and consistent menu actions. Explicit primary focus and distinct cancel/confirm behavior apply that guidance without introducing an automatic resume shortcut.

The [W3C Gamepad specification](https://www.w3.org/TR/gamepad/) defines indexed snapshots, inactive-document/permission behavior and gesture-gated exposure. Treat missing entries and denied reads as ordinary unavailable-input conditions. Stable player allocation, application pause policy and one hardware read per frame are host decisions; a browser index or standard mapping is not a hardware certification.
