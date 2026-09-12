# Controller practice

Open [Controller practice](../game/controller-lab/index.html) from the served game. The page drives the **actual game UI** through a clearly labeled virtual controller. It is an input simulation: it does not demonstrate physical controller compatibility, Bluetooth behavior, native hardware mapping or trusted browser activation.

Choose a mission, starting class, steering policy and viewport, then **Load practice**. The base campaign and Fieldcraft maps use the same validated scenario handoff as Playground. The loaded practice does not award campaign progress, score-table entries or cosmetic unlocks. The handoff replaces the current Playground practice scenario in this tab's session storage; it never imports a pack or rewrites the player's library.

1. **Connect virtual pad** sends neutral input. Press **A** to join, wait for its pulse to release, then press **A** again to activate the focused control. Joining consumes the first press.
2. Use the D-pad to move menu focus or steer. A confirms or uses equipment; B goes back or stops; X picks up; Y opens the hangar; RB boosts; Menu pauses.
3. **Pulse** presses for 200 ms and releases automatically. **Hold** toggles a button until pressed again. Combine held direction with RB to test boost. Changing gesture mode releases existing holds. **Release all buttons** neutralizes every control. A new menu scope requires neutral input before another gesture.
4. The scope and focused-control readouts come from the game. They contain short labels, controller ownership and controller status only. The lab does not read the iframe DOM or accept commands to win, unlock, edit state or write storage.
5. Disconnect during movement to test the actual router's lost-device behavior. Connect again, release, and deliberately join. Hiding the page disconnects the virtual pad. A missing heartbeat expires after 1200 ms; the parent normally sends one every 150 ms.

The iframe has the selected **logical viewport dimensions**, scaled visually to fit the available space. This is useful for inspecting responsive layout; it does not reproduce a phone's browser chrome, virtual keyboard, performance or hardware. Use the real device for those checks. Virtual controls focus the iframe before posting input. Clicking other parent controls may pause the game through its ordinary focus-loss handling.

File pickers, fullscreen, native share/download flows and audio may require a direct click or touch inside the game. A simulated controller postMessage is not trusted user activation. Keyboard and touch remain available within practice.

Navigation links inside the practice game show a reminder instead of leaving the iframe. Use the **Controller practice page's header links** to leave practice and open ordinary solo play or Playground. Downloads and links to sections of the current document remain available. Selecting another campaign or mission inside the preview keeps practice rewards disabled.

## Transport and containment

`attachControllerPreview({ enabled, window })` in [controller-preview.mjs](../game/ui/controller-preview.mjs) returns `null` unless explicitly enabled inside a same-origin iframe with a nonopaque origin. The app additionally requires a successfully validated practice scenario and `controller-preview=1`. Ordinary campaign play must never enable this path from the query flag alone. Serve the lab over localhost or HTTPS; `file:` and opaque origins are rejected. Native wrapper behavior is not established by this browser lab.

`attachPracticeNavigation({ enabled, document, onBlocked })` in [practice-navigation.mjs](../game/ui/practice-navigation.mjs) captures `click` and `auxclick` for navigation anchors, including nested targets and synthetic controller clicks. It permits download anchors and fragments that resolve to the exact current document; empty, malformed and other destinations are blocked before target activation. `onBlocked({ href })` supplies the reminder, and `destroy()` removes both listeners. Disabled mode installs no listeners, so ordinary solo navigation remains unchanged. Source hrefs are not rewritten.

The lab names its iframe `revealline-controller-practice`. Before acquiring a profile writer, the solo app rejects a marked frame that lacks its validated scenario and controller-preview flag. This keeps a query-stripped solo reload from acquiring saving rights. The link guard covers ordinary UI activation; it is not a security sandbox for hostile same-origin scripts, arbitrary browser navigation or other applications loaded in the frame. The parent header is the explicit exit from practice.

The bridge exposes `readPads`, `clear`, `report` and `destroy`. `readPads` returns a fresh standard-mapped slot-0 virtual pad with two axes and sixteen button records, or an empty list. The router is still authoritative for neutral gates, join, menu repeats, flight actions and selected-device loss. `clear` is for lifecycle resets, not each menu transition: it neutralizes the current state and requires a subsequent neutral parent packet before accepting held input again.

Accepted input has exactly these fields:

```json
{
  "format": "revealline.controller-preview.v1",
  "sequence": 1,
  "pad": {
    "index": 0,
    "connected": true,
    "axes": [0, 0],
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

Sequence numbers must increase. Axes are finite numbers in −1…1; buttons are a dense array of at most sixteen booleans. Disconnected packets must be neutral. Unknown properties, malformed arrays, accessors, duplicate or older packets and wrong source/origin messages are rejected. Parsers produce owned values; they never evaluate code or convert input into game commands. The bounded shape is smaller than 4 KiB.

`report({ scope, focusedId, focusedLabel, assigned, message })` sends changed feedback at most ten times per second using `revealline.controller-preview-status.v1`. Scope, id and label are at most 160 characters; message is at most 240; assigned is a boolean. The lab validates the exact iframe source, origin, envelope and increasing sequence before displaying text. No run, score, field, save or profile values belong in this protocol.

## Verification boundary

Run:

```sh
node --test game/test/controller-preview.test.mjs game/test/controller-lab.test.mjs game/test/practice-navigation.test.mjs
```

Automated coverage includes strict transport validation, source/origin rejection, stale packet handling, heartbeat loss, clear/release semantics, bounded feedback, an actual router join→menu→flight→pause→disconnect roundtrip, both steering policies through all offered scenario preparations, and parent-page DOM simulations for pulses, simultaneous holds, cancellation, import failure and disposal. Navigation tests exercise nested and synthetic clicks, auxiliary activation, every actual solo-page navigation destination, fragment/download exceptions and teardown. The app's boot guard and query-stripped reload require separate app integration checks. DOM simulations do not establish browser focus timing or physical-device behavior. Complete the actual browser journey and physical controller checks described in [the controller plan](round-15-controller-plan.md) separately.
