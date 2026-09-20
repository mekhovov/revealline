# Controller navigation

The current source supports solo menu navigation, deliberate controller assignment, configurable controller layouts and explicit reading of mission/result details. The reader originated after v0.11; current source adds a focused Ready/paused Mission brief. Release, browser and target-device validation are recorded separately in the [next-milestone review](research/round-43-next-milestone-review.md). Territory rules, steering choices and normalized recorded commands remain unchanged. A connected but idle controller does not take over the interface.

Release its controls, then press a physical face button or Menu to join. Release again before starting a mission. The first press selects the controller; it cannot also start a flight or use an ability. Joining always uses physical indices 0, 1, 2, 3 or 9, independently of remapped Confirm. Only standard Gamepad API mappings are supported. The table shows the defaults; help and edit prompts follow your applied layout.

| Context       | Control            | Action                               |
| ------------- | ------------------ | ------------------------------------ |
| Flight        | D-pad / left stick | Move in a cardinal direction         |
| Flight        | South / A          | Equipped ability                     |
| Flight        | West / X           | Collect supplies                     |
| Flight        | Right shoulder     | Boost while held; optional Toggle    |
| Flight        | North / Y          | Open the hangar                      |
| Legacy flight | East / B           | Stop; ignored by continuous steering |
| Flight        | Menu               | Pause                                |
| Menus         | D-pad / left stick | Move the visible focus ring          |
| Menus         | South / A          | Activate, or begin/confirm an edit   |
| Menus         | East / B           | Cancel an edit, or go back           |
| Paused flight | Menu               | Resume when no dialog is open        |

Flight equipment is available only under the current level policy. First Light Arcade has no manual Scan/Supply/Boost; the stored legacy Stop binding does not add a Stop action to tap-to-steer play.

Confirm a campaign, class or other select to preview its choices. Directions move through enabled options without restarting the game. Confirm applies the choice; Back cancels. Volume sliders use the same preview/commit behavior. Existing keyboard and touch controls remain usable, and using them ends the controller's current edit.

The open dialog owns navigation. Back follows its cancellation rules: a picture returns to the collection, a cancellable earlier-release check can be aborted, and a backup commit cannot be closed through its busy guard. Returning from a gallery picture restores its page, search and originating card; removed content receives a valid fallback.

Disconnecting the selected pad pauses the flight even if another pad remains connected. A replacement must join deliberately. Blur, a hidden page, a scope change and applied keyboard/controller settings clear held commands. A button used to resume or confirm a hangar cannot also use an ability in the resumed flight.

## Keyboard capture ownership

`attachControllerNavigation` accepts an optional `ownsKeyboardEvent(event)` predicate, defaulting to false. When keyboard navigation is enabled and this predicate returns true, the document listener relinquishes its reader/editor state and reports native input, then yields without consuming the key or moving focus. The existing dialog capture handler owns validation and cancellation.

Solo grants ownership only to events inside the current top Settings dialog while its key-capture Cancel control is active. Do not skip all Settings keys or delegate events from another screen. The hook does not change routed controller commands, native select/slider handling or ordinary menu navigation after capture. Test the real document → dialog event order, including arrows, reserved Return/Space, Escape, Tab and unchanged Ready/paused checkpoints; isolated dialog-handler tests cannot prove this composition. See [keyboard controls](controls.md#current-keyboard-capture).

## Read details without starting a flight

Choose **Mission brief** from Ready or the compact paused dock. The focused view shows the current map, authored description and actual requirements; chapter cards and flight setup are hidden for this view. **Read mission brief / Done reading** controls the existing reader, and **Back** returns to the logical Ready/paused scope. Reading or Back never starts/resumes the flight. Ordinary mission selection restores the full chapter/setup view. First Flight keeps its own course lesson route; imported practice is labeled PRACTICE, the course FIRST FLIGHT, and ARCADE requires an actual validated Arcade policy.

Keep the full text in the bounded scroll region with readable Standard/Large type. A newly opened focused brief begins at the top; read entry/exit within that unchanged view keeps the reader's scroll behavior below. The source desktop keyboard journey passed; compact CSS/DOM reflow and controller tests remain modeled, with physical-device review separate. Creator tools belong in ordinary Settings; practice/course navigation isolation must hide unavailable links as well as retaining its guard.

While reading, your configured menu Up/Down scroll only the named text region. Left/Right do not switch controls or move the page sideways. Short text still supports entry and an immediate exit. The visible local prompt uses your applied Confirm and Back labels; reaching the top or bottom does not wrap around. Re-entering unchanged text retains its scroll position; content changed since the previous entry starts at the top. Resizing clamps the current position to the new bounds.

**Confirm, Back, Menu or Done reading** ends reading. It does not also resume, retry, start another mission or close a parent dialog. Release the controller, then use a separate gesture for the next action. An explicit exit returns focus to the entry control when it remains valid. Done stays in place and is disabled while inactive. A primary pointer press on the registered active Done button preserves the reader until its normal click returns focus; it performs no action on pointerdown. Pointer cancellation and other native input relinquish reading normally.

With keyboard menu navigation enabled, the named text region and its registered **Done reading** button share reading ownership. In the Mission brief, **Shift+Tab** from the text reaches enabled Done; **Tab** returns to the text. **Enter** or **Space** on Done uses the normal button click and restores the entry. Moving to another control ends reading without activating that control. The transfer follows actual adjacent tab order and never skips intervening controls. A real Shift+Tab begins with a separate Shift keydown: retain a still-current keyboard reader for that modifier without preventing its native behavior. Shift must still notify the host of native input, and stale or background readers retain their cancellation protections. Readers without a registered exit or without keyboard menu navigation retain their existing cancellation behavior.

Keyboard scrolling and touch retain their supported reading behavior. Other native input relinquishes controller reading without stealing its focus. Closing the brief, changing the scope/content, replacing a mission, restoring/importing, losing focus or disconnecting cancels the active reader. It never resumes automatically. The two reader surfaces are the mission/result overlay and full mission brief; this does not add readers to every Help, Settings, Library, Replay Theater or couch text area.

### Reader integration

[`attachControllerNavigation`](../game/ui/controller-navigation.mjs) exposes `beginReading({region, origin, label, exit})`, `endReading({restoreFocus: true})` and `readingState()`. The optional `exit` registers the stable Done button for ordinary pointer-click focus return and adjacent keyboard traversal when keyboard menu navigation is enabled; it never activates on pointerdown. After ending reading disables Done, a pending Tab transfer must retain its actual neighbor and recheck scope, root, foreground, and current focus after host callbacks. The returned state is an owned `{regionId, label}` or null. Only a connected, visible, named, focusable `data-game-reading` region and a valid origin within the current UI root can be used; the adapter rejects flight scope. It consumes reader directions/exits before ordinary control navigation. Scope, target or text invalidation consumes that command instead of activating fallback focus.

[`attachControllerReading`](../game/ui/controller-reading.mjs) binds the two first-party surfaces and their stable entry/Done controls. The app forwards `onReadingChange` to this helper and clears all input with `clearInput({preserveNavigation: true})` on reader transitions. That exception skips only the navigation reset, avoiding immediate cancellation of a newly opened reader. Ordinary lifecycle clears still cancel navigation. No extra hardware polling, persistent reading preference, simulation state or bridge command is introduced.

See [Controller practice](controller-practice.md) for a long-text exercise and [the accepted reader plan](round-22-controller-reading-plan.md) for the acceptance matrix. Unit/DOM tests do not establish actual overflow geometry or physical-controller accessibility. The combined correction passed native Shift+Tab, Enter/Space completion and opener restoration in inline and direct paused Brief, including Plain/Large at 600×400. Integrated focused checks passed on Node 20 and 22. Full-source and public release qualification, physical controllers and actual foreground lifecycle remain separate.

Maintainer prompt: “Verify Mission brief → Read → final paragraph → separate Shift keydown → Tab keydown/keyup → Shift keyup → Done → Enter and Space, plus Tab back into the text and Tab out of the reader. Preserve the paused/ready state and opener. Cover hidden/disabled/removed exits, changed text/scope, foreground loss during callbacks, native pointer Done and controller neutral gating. Keep native keyboard, physical devices and modeled tests as separate evidence.”

## Change a solo layout

Open **Settings → Edit controller settings**. Change the Flight and Menus maps independently; a button may be reused across those contexts. Each context needs one distinct index from 0 through 15 for every action. System/home index 16 is reserved. Choose position, Xbox or PlayStation labels for the same physical mapping; labels do not identify a device.

Stick controls select enabled/disabled input, horizontal and vertical axes and each inversion independently for Flight and Menus. Axes 0/1 are the standard left stick and 2/3 the right stick. Disabling both context sticks permits button-only control. The common press threshold is 0.10–0.60, with release from 0.02 up to press. Defaults remain equal at 0.35. Movement begins above press and, once active, continues only above release; equality releases it. A lower release threshold can reduce jitter but is not automatic hardware calibration.

The editor holds a complete draft. You can temporarily create a duplicate while swapping two buttons; Apply rejects unresolved conflicts. **Cancel draft** keeps the active layout. **Restore defaults in draft** still needs **Apply controller settings**. Applied changes clear pending input and require all mapped controls in both contexts to return to neutral before accepting a fresh press. Help and select/slider edit prompts update to the configured labels.

Ordinary saves retain the applied layout. Practice, a non-writing second tab, a returned history-cache page or failed storage can keep it for the current session and report that limitation. Export the library or complete backup to retain session-only choices. Existing profiles that omitted the preference use defaults; an explicit malformed mapping cannot be silently repaired. Import and Undo adopt the incoming layout and clear held input. New exports transfer forward to compatible readers; older frozen releases reject the new preference field. See [preference migration](controller-preference-migration.md).

## Practice and host limits

Use [Controller practice](controller-practice.md) to exercise the actual solo UI with a virtual pad. The working v2 bridge represents all sixteen supported physical buttons and four axes. Its status acknowledgement confirms the game sampled a neutral release before the parent applies a new stick draft. This is browser simulation; it neither changes the saved game's rules nor certifies a physical controller.

Browser history can retain a page in memory. This app suspends a flight before releasing its profile writer. A restored page stays paused and becomes session-only, with an explicit export/reload message, rather than silently writing an old in-memory collection over newer saved progress.

Text entry, date entry and native file pickers still use keyboard or touch. Some browsers require a trusted keyboard or pointer action before audio, sharing or other protected APIs are available. Polling a controller does not create that activation; menu navigation and silent play remain usable. See the primary API/accessibility sources in the [controller plan](round-15-controller-plan.md).

This increment covers the solo interface and its practice preview. The v0.13 working source adds [optional solo Boost Toggle](controller-boost.md), defaulting to Hold; it is separate from binding drafts and resets on pause, Stop and recovery. Couch players retain their existing separate Hold controls; Replay Theater menu navigation was delivered in v0.30; the complete couch/menu/device matrix remains open. Controller toggle steering, physical-button capture, haptics and arbitrary nonstandard mappings are not provided. Touch tap steering/Boost remains a separate existing option. Physical controller/browser/native-device sessions must be reported separately from simulated input and DOM tests. No hardware certification or universal controller-only OS interaction is implied.

## About: choose a local mode

About → Ways to play offers Solo campaign, Couch Versus and Couch Team, with a separate First Flight Coach entry. Versus uses two rival boards; Team uses one shared arena with Support and partner rescue. These links stay inside the selected software build, including frozen and archived releases, and remain available while the optional pack and release catalogues load. Online play remains explicitly deferred and has no playable action.

Use Tab and Enter for ordinary links, or join a controller with a neutral input followed by Confirm, then use the D-pad and a fresh Confirm. Back or Escape selects Return to game without automatically navigating. Late catalogue readiness must preserve the focused mode link. Mode choices do not write progress. The page uses stable descriptions instead of hardcoded inventory totals; changing campaign content must not leave misleading mission, class or pack counts in its summary or metadata.

Maintainer prompt: update the real About markup and shared navigation together. Keep all three local modes reachable in document order and within the current build; preserve deferred online wording. Exercise pending and completed catalogues, exact frozen/archive link resolution, controller Back, keyboard activation and native responsive target sizes. Distinguish modeled controller tests from physical-device evidence. Do not treat a passing link test as proof of a complete gameplay journey.

## Responsive Settings and accurate pause status

Solo Settings keeps its Close action and category tabs outside the scrolling panel. On a short landscape screen, keyboard focus must scroll the active panel without pushing Close out of view. If a viewport change hides the original toolbar opener, closing Settings restores the visible Game menu action; it must not resume the saved flight. A newer deliberate focus choice or another open dialog retains ownership.

A resumed saved flight displays “Flight resumed.” only while running. Pausing replaces that caption with explicit Resume guidance and preserves the unfinished cut; important interruption warnings retain priority. Test both Immediate and Grid + buffer with unchanged checkpoints and verified saved replays.

Maintainer prompt: exercise title and paused-flight Settings with Plain/Large text at phone portrait and short landscape, including a resize that hides the opener. Verify visible Close, panel-local scrolling, logical focus return and explicit Resume. Keep native keyboard observations separate from modeled controllers, physical hardware and public-release acceptance.
