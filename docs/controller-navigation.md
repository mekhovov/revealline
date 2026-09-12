# Controller navigation

The current source supports solo menu navigation, deliberate controller assignment, configurable controller layouts and explicit reading of mission/result details. The reader is source work after frozen v0.11.0; release and target-device validation are recorded separately. Territory rules, steering choices and normalized recorded commands remain unchanged. A connected but idle controller does not take over the interface.

Release its controls, then press a physical face button or Menu to join. Release again before starting a mission. The first press selects the controller; it cannot also start a flight or use an ability. Joining always uses physical indices 0, 1, 2, 3 or 9, independently of remapped Confirm. Only standard Gamepad API mappings are supported. The table shows the defaults; help and edit prompts follow your applied layout.

| Context       | Control            | Action                             |
| ------------- | ------------------ | ---------------------------------- |
| Flight        | D-pad / left stick | Move in a cardinal direction       |
| Flight        | South / A          | Equipped ability                   |
| Flight        | West / X           | Collect supplies                   |
| Flight        | Right shoulder     | Boost while held; optional Toggle  |
| Flight        | North / Y          | Open the hangar                    |
| Flight        | East / B           | Stop                               |
| Flight        | Menu               | Pause                              |
| Menus         | D-pad / left stick | Move the visible focus ring        |
| Menus         | South / A          | Activate, or begin/confirm an edit |
| Menus         | East / B           | Cancel an edit, or go back         |
| Paused flight | Menu               | Resume when no dialog is open      |

Confirm a campaign, class or other select to preview its choices. Directions move through enabled options without restarting the game. Confirm applies the choice; Back cancels. Volume sliders use the same preview/commit behavior. Existing keyboard and touch controls remain usable, and using them ends the controller's current edit.

The open dialog owns navigation. Back follows its cancellation rules: a picture returns to the collection, a cancellable earlier-release check can be aborted, and a backup commit cannot be closed through its busy guard. Returning from a gallery picture restores its page, search and originating card; removed content receives a valid fallback.

Disconnecting the selected pad pauses the flight even if another pad remains connected. A replacement must join deliberately. Blur, a hidden page, a scope change and applied keyboard/controller settings clear held commands. A button used to resume or confirm a hangar cannot also use an ability in the resumed flight.

## Read details without starting a flight

Choose **Read details** on a visible ready, paused or result overlay. For the complete authored description, open **Mission brief** in the flight deck and choose **Read mission brief**. The full brief includes its title, authored paragraphs, generated requirements and optional seal explanation. Entering that reader during flight first pauses; entering from Ready does not start the mission.

While reading, your configured menu Up/Down scroll only the named text region. Left/Right do not switch controls or move the page sideways. Short text still supports entry and an immediate exit. The visible local prompt uses your applied Confirm and Back labels; reaching the top or bottom does not wrap around. Re-entering unchanged text retains its scroll position; content changed since the previous entry starts at the top. Resizing clamps the current position to the new bounds.

**Confirm, Back, Menu or Done reading** ends reading. It does not also resume, retry, start another mission or close a parent dialog. Release the controller, then use a separate gesture for the next action. An explicit exit returns focus to the entry control when it remains valid. Done stays in place and is disabled while inactive. A primary pointer press on the registered active Done button preserves the reader until its normal click returns focus; it performs no action on pointerdown. Pointer cancellation and other native input relinquish reading normally.

Keyboard and touch keep their native reading behavior. Using them relinquishes controller reading without stealing their focus. Closing the brief, changing the scope/content, replacing a mission, restoring/importing, losing focus or disconnecting cancels the active reader. It never resumes automatically. The two reader surfaces are the mission/result overlay and full mission brief; this does not add readers to every Help, Settings, Library, Replay Theater or couch text area.

### Reader integration

[`attachControllerNavigation`](../game/ui/controller-navigation.mjs) exposes `beginReading({region, origin, label, exit})`, `endReading({restoreFocus: true})` and `readingState()`. The optional `exit` registers the stable Done button for ordinary pointer-click focus return; it never activates on pointerdown. The returned state is an owned `{regionId, label}` or null. Only a connected, visible, named, focusable `data-game-reading` region and a valid origin within the current UI root can be used; the adapter rejects flight scope. It consumes reader directions/exits before ordinary control navigation. Scope, target or text invalidation consumes that command instead of activating fallback focus.

[`attachControllerReading`](../game/ui/controller-reading.mjs) binds the two first-party surfaces and their stable entry/Done controls. The app forwards `onReadingChange` to this helper and clears all input with `clearInput({preserveNavigation: true})` on reader transitions. That exception skips only the navigation reset, avoiding immediate cancellation of a newly opened reader. Ordinary lifecycle clears still cancel navigation. No extra hardware polling, persistent reading preference, simulation state or bridge command is introduced.

See [Controller practice](controller-practice.md) for a long-text exercise and [the accepted reader plan](round-22-controller-reading-plan.md) for the acceptance matrix. Unit/DOM tests do not establish actual overflow geometry or physical-controller accessibility.

## Change a solo layout

Open **Settings → Edit controller settings**. Change the Flight and Menus maps independently; a button may be reused across those contexts. Each context needs one distinct index from 0 through 15 for every action. System/home index 16 is reserved. Choose position, Xbox or PlayStation labels for the same physical mapping; labels do not identify a device.

Stick controls select enabled/disabled input, horizontal and vertical axes and each inversion independently for Flight and Menus. Axes 0/1 are the standard left stick and 2/3 the right stick. Disabling both context sticks permits button-only control. The common press threshold is 0.10–0.60, with release from 0.02 up to press. Defaults remain equal at 0.35. Movement begins above press and, once active, continues only above release; equality releases it. A lower release threshold can reduce jitter but is not automatic hardware calibration.

The editor holds a complete draft. You can temporarily create a duplicate while swapping two buttons; Apply rejects unresolved conflicts. **Cancel draft** keeps the active layout. **Restore defaults in draft** still needs **Apply controller settings**. Applied changes clear pending input and require all mapped controls in both contexts to return to neutral before accepting a fresh press. Help and select/slider edit prompts update to the configured labels.

Ordinary saves retain the applied layout. Practice, a non-writing second tab, a returned history-cache page or failed storage can keep it for the current session and report that limitation. Export the library or complete backup to retain session-only choices. Existing profiles that omitted the preference use defaults; an explicit malformed mapping cannot be silently repaired. Import and Undo adopt the incoming layout and clear held input. New exports transfer forward to compatible readers; older frozen releases reject the new preference field. See [preference migration](controller-preference-migration.md).

## Practice and host limits

Use [Controller practice](controller-practice.md) to exercise the actual solo UI with a virtual pad. The working v2 bridge represents all sixteen supported physical buttons and four axes. Its status acknowledgement confirms the game sampled a neutral release before the parent applies a new stick draft. This is browser simulation; it neither changes the saved game's rules nor certifies a physical controller.

Browser history can retain a page in memory. This app suspends a flight before releasing its profile writer. A restored page stays paused and becomes session-only, with an explicit export/reload message, rather than silently writing an old in-memory collection over newer saved progress.

Text entry, date entry and native file pickers still use keyboard or touch. Some browsers require a trusted keyboard or pointer action before audio, sharing or other protected APIs are available. Polling a controller does not create that activation; menu navigation and silent play remain usable. See the primary API/accessibility sources in the [controller plan](round-15-controller-plan.md).

This increment covers the solo interface and its practice preview. The v0.13 working source adds [optional solo Boost Toggle](controller-boost.md), defaulting to Hold; it is separate from binding drafts and resets on pause, Stop and recovery. Couch players retain their existing separate Hold controls; complete couch menu ownership and Replay Theater menu navigation are future work. Controller toggle steering, physical-button capture, haptics and arbitrary nonstandard mappings are not provided. Touch tap steering/Boost remains a separate existing option. Physical controller/browser/native-device sessions must be reported separately from simulated input and DOM tests. No hardware certification or universal controller-only OS interaction is implied.
