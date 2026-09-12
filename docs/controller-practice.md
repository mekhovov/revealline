# Controller practice

Open [Controller practice](../game/controller-lab/index.html) from the served game. The page drives the **actual game UI** through a clearly labeled virtual controller. It is an input simulation: it does not demonstrate physical controller compatibility, Bluetooth behavior, native hardware mapping or trusted browser activation.

Choose a mission, starting class, steering policy and viewport, then **Load practice**. The base campaign and Fieldcraft maps use the same validated scenario handoff as Playground. The loaded practice does not award campaign progress, score-table entries or cosmetic unlocks. The handoff replaces the current Playground practice scenario in this tab's session storage; it never imports a pack or rewrites the player's library.

1. **Connect virtual pad** sends neutral input. Press a physical face button **0–3** or **Menu / 9** to join, then release. Use the game's **configured menu Confirm** afterward; joining consumes the first press. The fixed joining controls remain available after remapping.
2. All sixteen buttons are labeled by physical position and index. These labels stay the same when the game remaps actions. **Default layout only:** 0 confirms / uses Ability; 1 goes Back / stops; 2 picks up; 3 opens Hangar; 5 boosts; 9 pauses; D-pad indices 12–15 navigate or steer. Inspect the game's controller settings for a custom layout.
3. **Pulse** presses for 200 ms and releases automatically. **Hold** toggles a button until pressed again. Combine held physical inputs to test simultaneous mapped actions. Changing gesture mode releases existing holds. **Release all · buttons + sticks** neutralizes all sixteen buttons and four live axes, resets the four slider drafts to zero, and cancels pending stick application. A new menu scope requires neutral input before another gesture.
4. The scope and focused-control readouts come from the game. They contain short labels, controller ownership and controller status only. The lab does not read the iframe DOM or accept commands to win, unlock, edit state or write storage.
5. Disconnect during movement to test the actual router's lost-device behavior. Connect again, release, and deliberately join. Hiding the page disconnects the virtual pad. A missing heartbeat expires after 1200 ms; the parent normally sends one every 150 ms.

The iframe has the selected **logical viewport dimensions**, scaled visually to fit the available space. This is useful for inspecting responsive layout; it does not reproduce a phone's browser chrome, virtual keyboard, performance or hardware. Use the real device for those checks. Virtual controls focus the iframe before posting input. Clicking other parent controls may pause the game through its ordinary focus-loss handling.

## Both sticks and focus handoff

Four labeled sliders expose left horizontal/vertical axes **0/1** and right horizontal/vertical axes **2/3**, each with a visible numeric readout. Values range from −1 to 1 in steps of 0.05. Negative means left/up; positive means right/down. The game applies its selected axes and inversions, so the lab itself sends these physical values unchanged.

Editing any slider releases live inputs and changes draft values only. **Apply stick values** focuses the game, sends neutral packets and waits for the game to acknowledge a new neutral snapshot actually sampled through `readPads`. Only then does the lab send all four draft values. Waiting is bounded at two seconds; a timeout keeps live axes neutral and offers retry guidance while preserving the draft. Receipt of a packet alone cannot acknowledge it. Stale or future acknowledgements cannot apply the draft.

Editing a slider may pause the flight through normal focus-loss handling. Resume explicitly with the game's configured controls, then Apply again to exercise flight movement. Apply never resumes the game automatically; a held stick is cleared/gated when Resume changes the input scope.

Release all, Disconnect, loading practice, hiding the page and pagehide cancel pending application. Editing again, changing gesture mode or pressing a physical button also cancels it. A history-cache return stays disconnected and never resumes a previous button or stick hold. Scope/focus input gates inside the real game remain authoritative after application.

The sliders are useful for testing stick choice, inversion, activation thresholds and neutral resets. Each application intentionally inserts neutral input; repeated Apply operations do **not** demonstrate continuous hysteresis while moving through the release threshold. Use the pure/router sequence tests or a physical controller for that behavior.

File pickers, fullscreen, native share/download flows and audio may require a direct click or touch inside the game. A simulated controller postMessage is not trusted user activation. Keyboard and touch remain available within practice.

Navigation links inside the practice game show a reminder instead of leaving the iframe. Use the **Controller practice page's header links** to leave practice and open ordinary solo play or Playground. Downloads and links to sections of the current document remain available. Selecting another campaign or mission inside the preview keeps practice rewards disabled.

## Transport and containment

`attachControllerPreview({ enabled, window })` in [controller-preview.mjs](../game/ui/controller-preview.mjs) returns `null` unless explicitly enabled inside a same-origin iframe with a nonopaque origin and a valid per-load `controller-session` query token. The app additionally requires a successfully validated practice scenario and `controller-preview=1`. Ordinary campaign play must never enable this path from the query flag alone. Serve the lab over localhost or HTTPS; `file:` and opaque origins are rejected. Native wrapper behavior is not established by this browser lab.

`attachPracticeNavigation({ enabled, document, onBlocked })` in [practice-navigation.mjs](../game/ui/practice-navigation.mjs) captures `click` and `auxclick` for navigation anchors, including nested targets and synthetic controller clicks. It permits download anchors and fragments that resolve to the exact current document; empty, malformed and other destinations are blocked before target activation. `onBlocked({ href })` supplies the reminder, and `destroy()` removes both listeners. Disabled mode installs no listeners, so ordinary solo navigation remains unchanged. Source hrefs are not rewritten.

The lab names its iframe `revealline-controller-practice`. Before acquiring a profile writer, the solo app rejects a marked frame that lacks its validated scenario and controller-preview flag. This keeps a query-stripped solo reload from acquiring saving rights. The link guard covers ordinary UI activation; it is not a security sandbox for hostile same-origin scripts, arbitrary browser navigation or other applications loaded in the frame. The parent header is the explicit exit from practice.

The bridge exposes `readPads`, `clear`, `report` and `destroy`. `readPads` returns a fresh standard-mapped slot-0 virtual pad with **four axes and sixteen button records**, or an empty list. Those descriptor lengths stay fixed even when a valid input packet supplies fewer button values. The router is still authoritative for neutral gates, join, menu repeats, flight actions and selected-device loss. `clear` is for lifecycle resets, not each menu transition: it neutralizes the current state, invalidates the last read acknowledgement and requires a subsequent neutral parent packet before accepting held input again.

Accepted input has exactly these fields:

```json
{
  "format": "revealline.controller-preview.v2",
  "session": "0123456789abcdef0123456789abcdef",
  "sequence": 1,
  "pad": {
    "index": 0,
    "connected": true,
    "axes": [0, 0, 0, 0],
    "buttons": [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ]
  }
}
```

Sequence numbers must increase. Axes are **exactly four** finite numbers in −1…1; buttons are a dense array of at most sixteen booleans. Disconnected packets must be neutral on all four axes and all buttons. Unknown properties, malformed arrays, hidden/accessor fields, duplicate or older packets and wrong source/origin messages are rejected. Parsers produce owned values; they never evaluate code or convert input into game commands. The bounded shape is smaller than 4 KiB. Current source rejects v1/two-axis packets explicitly; frozen v0.5.0 keeps its own original v1 bridge and lab unchanged.

Each load generates a new random 32-character lowercase hexadecimal `session` token and places it in the iframe URL. Both envelopes carry that token. The bridge binds its expected token from its own URL before receiving input; the parent binds feedback to the current load. Mismatched tokens are rejected before changing sequence counters. This prevents queued input or a high-sequence status from an older document sharing the iframe's WindowProxy from affecting its replacement. The token identifies an input session; it does not grant trust to hostile scripts on the same origin.

`report({ scope, focusedId, focusedLabel, assigned, message })` keeps its existing application call signature. It sends changed feedback at most ten times per second using `revealline.controller-preview-status.v2`. The bridge adds `readSequence`: the sequence of its most recent accepted connected snapshot actually returned by `readPads`, or **−1** after clearing, lease expiry or a disconnected read. A receive event does not advance this acknowledgement. A new acknowledgement counts as changed feedback even if focus/status labels are unchanged.

The status envelope has exactly `format`, `session`, `sequence`, `readSequence`, `scope`, `focusedId`, `focusedLabel`, `assigned` and `message`. Scope, id and label are at most 160 characters; message is at most 240; assigned is a boolean. `sequence` is a nonnegative safe integer; `readSequence` is −1 or a nonnegative safe integer. The lab validates the exact iframe source, origin, session, envelope and increasing status sequence before displaying text. A pending stick application accepts only an acknowledgement at or after its new neutral packet and below the next sequence the lab would send. Every packet sent while that application waits is neutral. No run, score, field, save or profile values belong in this protocol.

## Verification boundary

Run:

```sh
node --test game/test/controller-preview.test.mjs game/test/controller-lab.test.mjs game/test/practice-navigation.test.mjs
```

The current focused run passes **48 tests**: 19 bridge/preview tests, 21 parent lab tests (including its nested scenarios), and eight practice-navigation tests. Automated coverage includes strict transport validation, source/origin rejection, per-load token rotation and queued old-document rejection, stale packet handling, heartbeat loss, all-four-axis clear/release semantics, sampled acknowledgement versus receipt, remapped equipment/right-stick input through the real router, bounded feedback, an actual join→menu→flight→pause→disconnect roundtrip, both steering policies through all offered scenario preparations, and parent-page DOM simulations for all sixteen buttons, draft sliders, pulses, holds, acknowledgement timeout/cancellation, import failure and disposal. A static markup check verifies the actual button-index and slider-label inventory.

Navigation tests exercise nested and synthetic clicks, auxiliary activation, every actual solo-page navigation destination, fragment/download exceptions and teardown. The app's boot guard and query-stripped reload require separate app integration checks. DOM simulations do not establish browser focus timing or physical-device behavior. Complete the actual browser journey and physical controller checks described in [the controller plan](round-15-controller-plan.md) separately.
