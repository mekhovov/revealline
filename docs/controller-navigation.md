# Controller navigation

The current solo controller work keeps the same territory rules, steering choices and recorded commands as keyboard and touch. It adds a separate route for menus and a deliberate controller assignment. A connected but idle controller does not take over the interface.

Release its controls, then press a face button to join. Release again before starting a mission. The first press selects the controller; it cannot also start a flight or use an ability. Only standard Gamepad API mappings are supported by this increment.

| Context | Control | Action |
| --- | --- | --- |
| Flight | D-pad / left stick | Move in a cardinal direction |
| Flight | South / A | Equipped ability |
| Flight | West / X | Collect supplies |
| Flight | Right shoulder | Boost while held |
| Flight | North / Y | Open the hangar |
| Flight | East / B | Stop |
| Flight | Menu | Pause |
| Menus | D-pad / left stick | Move the visible focus ring |
| Menus | South / A | Activate, or begin/confirm an edit |
| Menus | East / B | Cancel an edit, or go back |
| Paused flight | Menu | Resume when no dialog is open |

Confirm a campaign, class or other select to preview its choices. Directions move through enabled options without restarting the game. Confirm applies the choice; Back cancels. Volume sliders use the same preview/commit behavior. Existing keyboard and touch controls remain usable, and using them ends the controller's current edit.

The open dialog owns navigation. Back follows its cancellation rules: a picture returns to the collection, a cancellable earlier-release check can be aborted, and a backup commit cannot be closed through its busy guard. Returning from a gallery picture restores its page, search and originating card; removed content receives a valid fallback.

Disconnecting the selected pad pauses the flight even if another pad remains connected. A replacement must join deliberately. Blur, a hidden page, a scope change and remapping through the existing keyboard settings clear held commands. A face button used to resume or confirm a hangar cannot also use an ability in the resumed flight.

Browser history can retain a page in memory. This app suspends a flight before releasing its profile writer. A restored page stays paused and becomes session-only, with an explicit export/reload message, rather than silently writing an old in-memory collection over newer saved progress.

Text entry, date entry and native file pickers still use keyboard or touch. Some browsers require a trusted keyboard or pointer action before audio, sharing or other protected APIs are available. Polling a controller does not create that activation; menu navigation and silent play remain usable. See the primary API/accessibility sources in the [controller plan](round-15-controller-plan.md).

This increment covers the solo interface. Controller remapping, adjustable dead zones, glyph selection and complete companion-page navigation are the next control slice. Physical controller/browser/native-device sessions must be reported separately from simulated input and DOM tests. No gamepad hardware certification or universal controller-only OS interaction is implied.
