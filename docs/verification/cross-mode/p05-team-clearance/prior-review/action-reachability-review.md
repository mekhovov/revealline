# Independent action reachability review

Static review of the proposed general-shell CSS plus unchanged Team runtime and exact170508 input/navigation/markup. No browser or tests were run in this review. **No new action-reachability blocker was found.** Physical input and final layout acceptance remain separate.

## State ownership

- `proposal/game/couch/relay-rescue.css:58` hides only `.masthead` when an attempt has `.playing` and the actual gameplay overlay has `hidden`. It does not hide the game, canvas, board footer, touch pads, tools or mode actions.
- Runtime `relay-rescue.mjs:382` sets the overlay from `run && !running()`; Start (`:695`) adds `.playing`, and Lobby (`:779`) removes it. Pause, terminal win/loss and stopped-render recovery make the overlay visible; the masthead therefore returns. No added CSS rule hides it in those states.
- The host is shared by Full teamwork, Joint Cuts and Individual cuts, both starter levels and accepted imported Team packs. Those configuration choices do not select a separate pause or header path. The stylesheet is Team-specific; Solo/Versus pages are unchanged.

## Reachable actions during flight and after Pause

| Input/path | Source trace | Effect of hiding the masthead |
| --- | --- | --- |
| Keyboard on the live canvas | `couch-input.mjs:273` handles fresh Escape independently of movement; Team `:325` supplies `onPause`; Start and Resume focus the canvas through `input.focus()` | Pause remains reachable without a header action. Controller navigation explicitly yields in `flight` (`controller-navigation.mjs:573`) |
| Standard-mapped gamepad | `ui/input.mjs:12` maps button 9 to Pause; `couch-input.mjs:421` accepts either assigned player's fresh pause and clears physical input | No dependency on header links; paused navigation uses the overlay root |
| Pointer or touch | `relay-rescue.html:176` keeps `#coop-pause` outside the masthead; Team `:1074` retains its click handler | Actual Pause target remains present and is the native layout target of the correction; visibility at final dimensions still needs root's retest |
| Resume, Retry and Change setup | Existing overlay controls at HTML `:157–161`; `primary()` selects Resume when paused; Team `:1073–1075` preserves guarded handlers | No element moves or replacement actions are introduced |
| Solo / Versus exits | `placeTools()` at Team `:225` moves the original mode choices into `coop-pause-modes`; HTML `:165–166` contains both links; click routing `:917–918` preserves fixed return destinations and discard confirmation | Both destinations remain within the keyboard/controller navigation root. A Solo-origin return uses the existing checked return route; direct/Versus-origin entries retain their existing alternatives |
| Help, Options, audio/display and picture tools | `placeTools()` moves the original `coop-tools` into `coop-pause-tools`; navigation root is `coop-overlay` while paused | Existing disclosures and their current controls remain reachable; the header contained no unique help or settings action |
| Gameplay movement, Boost and Support | Existing two-player key bindings, standard gamepad mapping and `.race-pad` controls remain unchanged | No live control is removed or reduced in size |

The hidden masthead contains the brand/Home and contextual Race/Back-to-Solo links plus a stage label. The necessary Solo/Versus destinations are available in Pause. The masthead itself also returns while paused; its Home shortcut is not needed to Resume or leave Team through the equivalent supported mode journey. The stage label returns on Pause. A persistent in-flight level label is a separate presentation choice, not an inaccessible action introduced here.

## Existing evidence and limits

The earlier complete 164-case cohorts included actual Team mode-link movement, paused Tab containment, Help/Options Back behavior, guarded departures, controller/touch assignment and explicit Resume. The runtime and regression bytes are unchanged. Those finite-DOM results do not establish CSS hit targets or real controller support for this new rule.

The root's completed F3 session proves Escape still focuses Resume and restores the masthead with the earlier short-landscape CSS, and records the desktop overflow. The new viewport-independent rule must still be observed at both dimensions and with touch-visible/hidden variants. No physical-device, arbitrary-controller, zoom, offline, complete-gameplay or phase-acceptance claim follows from this static review.
