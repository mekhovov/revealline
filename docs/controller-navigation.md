# Controller navigation

The working source after frozen v0.5.0 supports solo menu navigation, deliberate controller assignment and configurable controller layouts. The proposed next release is v0.6.0; release and target-device validation must be recorded separately. Territory rules, steering choices and normalized recorded commands remain unchanged. A connected but idle controller does not take over the interface.

Release its controls, then press a physical face button or Menu to join. Release again before starting a mission. The first press selects the controller; it cannot also start a flight or use an ability. Joining always uses physical indices 0, 1, 2, 3 or 9, independently of remapped Confirm. Only standard Gamepad API mappings are supported. The table shows the defaults; help and edit prompts follow your applied layout.

| Context       | Control            | Action                             |
| ------------- | ------------------ | ---------------------------------- |
| Flight        | D-pad / left stick | Move in a cardinal direction       |
| Flight        | South / A          | Equipped ability                   |
| Flight        | West / X           | Collect supplies                   |
| Flight        | Right shoulder     | Boost while held                   |
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

## Change a solo layout

Open **Settings → Edit controller settings**. Change the Flight and Menus maps independently; a button may be reused across those contexts. Each context needs one distinct index from 0 through 15 for every action. System/home index 16 is reserved. Choose position, Xbox or PlayStation labels for the same physical mapping; labels do not identify a device.

Stick controls select enabled/disabled input, horizontal and vertical axes and each inversion independently for Flight and Menus. Axes 0/1 are the standard left stick and 2/3 the right stick. Disabling both context sticks permits button-only control. The common press threshold is 0.10–0.60, with release from 0.02 up to press. Defaults remain equal at 0.35. Movement begins above press and, once active, continues only above release; equality releases it. A lower release threshold can reduce jitter but is not automatic hardware calibration.

The editor holds a complete draft. You can temporarily create a duplicate while swapping two buttons; Apply rejects unresolved conflicts. **Cancel draft** keeps the active layout. **Restore defaults in draft** still needs **Apply controller settings**. Applied changes clear pending input and require all mapped controls in both contexts to return to neutral before accepting a fresh press. Help and select/slider edit prompts update to the configured labels.

Ordinary saves retain the applied layout. Practice, a non-writing second tab, a returned history-cache page or failed storage can keep it for the current session and report that limitation. Export the library or complete backup to retain session-only choices. Existing profiles that omitted the preference use defaults; an explicit malformed mapping cannot be silently repaired. Import and Undo adopt the incoming layout and clear held input. New exports transfer forward to compatible readers; older frozen releases reject the new preference field. See [preference migration](controller-preference-migration.md).

## Practice and host limits

Use [Controller practice](controller-practice.md) to exercise the actual solo UI with a virtual pad. The working v2 bridge represents all sixteen supported physical buttons and four axes. Its status acknowledgement confirms the game sampled a neutral release before the parent applies a new stick draft. This is browser simulation; it neither changes the saved game's rules nor certifies a physical controller.

Browser history can retain a page in memory. This app suspends a flight before releasing its profile writer. A restored page stays paused and becomes session-only, with an explicit export/reload message, rather than silently writing an old in-memory collection over newer saved progress.

Text entry, date entry and native file pickers still use keyboard or touch. Some browsers require a trusted keyboard or pointer action before audio, sharing or other protected APIs are available. Polling a controller does not create that activation; menu navigation and silent play remain usable. See the primary API/accessibility sources in the [controller plan](round-15-controller-plan.md).

This increment covers the solo interface and its practice preview. Couch players retain their existing separate controls; complete couch menu ownership and Replay Theater menu navigation are future work. Toggle steering/boost, physical-button capture, haptics and arbitrary nonstandard mappings are not provided. Physical controller/browser/native-device sessions must be reported separately from simulated input and DOM tests. No hardware certification or universal controller-only OS interaction is implied.
