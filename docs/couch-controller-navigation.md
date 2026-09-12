# Couch controller menus

This guide describes **v0.20's shared couch menu**. The [source checks](verification/round-29/couch-source.md), [packaged browser observations](verification/round-29/v020-browser.md), [archive verification](verification/round-29/v020-integrity.md) and [public deployment](verification/round-29/v020-public.md) have separate scopes; none certifies physical controllers. The [implementation plan](round-29-couch-navigation-plan.md) records the accepted scope.

Couch race has two independent boards using the same map, class, seed and steering. A shared menu chooses the setup and controls the round. It remains a local race: no network connection, shared-arena co-op or campaign rewards are added.

## Choose who controls the menu

Up to two standard controllers automatically occupy the existing Player 1 and Player 2 flight slots. Keyboard and touch remain available to both players; they do not require a menu join. Losing one controller does not move the surviving controller to the other player.

While the match is **Ready, paused or finished**, either assigned controller can take the shared menu:

1. Release its buttons and movement stick.
2. Press a face button or Menu. This joins and shows focus; it does not start or resume the round.
3. Release again, then use the D-pad or left stick to move focus. Press **South** to choose the focused action.

Only one controller owns the menu at a time. The other player's controller still belongs to that player's craft, but cannot change shared menu choices. If both join in the same sample, the lower browser controller index wins. A third pad outside the two flight slots cannot take this menu.

**Release menu controller** is available only with an owner while the match is not running. It clears shared menu ownership and any uncommitted edit. Either assigned player can then release and join again. An owner disconnect, missing assignment or replacement device also requires a new join. Ordinary pauses, round changes and focus loss retain the owner while requiring fresh neutral controls before another menu action.

## Fixed couch controls

Couch uses position names rather than the solo controller's saved layout or glyph-family preference. It keeps **held Boost**; the solo Boost Toggle setting does not configure either couch player.

| Context | Control            | Result                                                                                         |
| ------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| Menu    | D-pad / left stick | Move focus; browse an open select preview                                                      |
| Menu    | South              | Choose a button; begin or commit a select preview                                              |
| Menu    | East or Menu       | Cancel a preview; otherwise focus Start, Resume or the next-round action without activating it |
| Flight  | D-pad / left stick | Move that player's craft                                                                       |
| Flight  | South              | Ability                                                                                        |
| Flight  | West               | Supply                                                                                         |
| Flight  | Right shoulder     | Hold Boost                                                                                     |
| Flight  | Menu               | Pause both boards                                                                              |

South is the bottom face button, East the right face button and West the left face button. During setup, browsing a select is a draft: **South** applies once through the existing setup control; **East/Menu** cancels. A replaced option list or changed scope cancels a stale draft. Map, class, steering and round-duration changes retain their existing reset behavior; World changes appearance.

After **Menu** pauses flight, release its controls and check the menu status. **If there is no menu owner, join first** with a face button or Menu; that gesture only chooses the menu controller. Release again, then press **South** on **Resume**. With an existing owner, a separate released-and-pressed South gesture on Resume is enough. East/Menu never resumes or starts another round. A single craft recovering or losing does not turn the whole still-running match into a shared menu. Finished rounds keep the existing first-to-two series accounting, including draws; **New match** returns to Ready with a cleared series.

## Keyboard, touch and Focus boards

The existing two keyboard layouts and touch controls continue to work. Native pointer or keyboard interaction relinquishes controller focus and select editing without changing player assignments or silently transferring menu ownership. Release controller controls before taking menu focus again. Tab and native select keys keep their normal behavior.

**Focus boards** prioritizes the boards and shared actions by hiding setup and secondary controls. The menu status remains near the primary actions in this mode. **Show setup** reveals configuration and the Solo return link; doing so during flight pauses both boards first. Starting a round enables Focus boards automatically. Compact windows and long hints can require normal vertical page scrolling; the mode does not guarantee that every board, hint and control fits at once.

The current markup keeps a separate player-assignment note and shared-menu status, with visible focus/edit styles from the common navigation adapter. Action targets have a 44 CSS-pixel sizing floor and long labels can wrap. Those source rules express layout intent; actual target geometry, viewport reachability and physical-device behavior still require their own observations.

Focus loss, hidden pages, native inactivity and leaving the page pause running play and release held input. Returning does not automatically resume. A controller disconnect pauses both players; replacement cannot carry a held action into the round. Controller polling also does not guarantee the browser's trusted activation for audio: keyboard/touch remains available for **Enable music**, and a failure message should remain truthful.

Maintainers should use the [four bounded workflows](../authoring/prompts/round-29-couch-menus.md) and [Runtime Maintainer guidance](../authoring/skills/xonix-runtime-maintainer/SKILL.md). The existing Controller Lab mounts solo practice, not a two-controller couch session. Injected-pad tests, ordinary browser interactions, CSS viewport simulation and physical-controller checks must be reported separately. This increment does not change duel/core rules, command or replay formats, saved progress, artwork, solo bindings or the future network boundary.
