# Recovered browser input and Team layout check

The earlier no-op Start observations remain historical evidence. In this later
browser session, native input worked. No product change was made to explain that
recovery. This is a bounded browser check of the existing composed stylesheet,
not physical phone/controller or public-release qualification.

## Exact source

The HTTP preview served frozen music source `8ee3bbe5b01529648cff8054536a269d2c11c3a1`
with only the previously reviewed `composed.css` substituted. Its SHA256 remains
`2319eac31296c3fdfb5878116a0c83b3a7c017c6326ce1933aacc4c65070f8d6`.
The newer PR209 head `e9434d03` differs only in soundtrack-distribution CLI and
its tests; this observation is still bound to 8ee, not a new release gate.
All 239 unique logged file bindings / 2,993,908 bytes were checked again against
Git or the composed CSS. The log spans preview sessions; it is not a current-run
request or transferred-byte total. See `source-inventory.json`.

## Input observed

- After exact artwork preparation, Enter on Start together opened First Connection.
- Escape paused. Seven Tab presses reached Settings, Enter opened it, and Left
  selected Controls. Space opened the native touch visibility selector; Down and
  Return selected Show both players. Escape returned to the paused owner and
  restored Settings focus. Seven Shift+Tab presses reached explicit Resume;
  Return resumed. Merely closing Settings did not resume.
- Both pads appeared. Regular floating sticks, then Large direction pads were
  selected through the actual settings UI. Plain/Large text remained applied.
- First-player Right started an exposed cut. Second-player Left independently
  started an exposed cut. A real Hunter collision put player one into Rescue with
  the explanatory caption, while player two remained exposed. Escape paused both.
- Rotation/resize with no held gesture did not invent a pause. The live-gesture
  interruption fix has separate host tests; no held-finger resize was exercised here.
- Session sound was enabled and Audio displayed “Quiet Orchard · playing”. No
  listening acceptance, MP3-credit row or track-change geometry claim follows.
- Captured console warnings/errors were empty. The preview tab was closed and
  temporary viewport reset; the owned server was stopped.

These are keyboard and browser pointer interactions with real player controls.
They are not simultaneous native touch or physical gamepad input. No DOM event
injection, internal gameplay state or direct host-handler calls were used.
The initial wrong `/game/team/` path returned404 and was corrected using the tracked
route. An unmatched label locator was replaced with the observed combobox role;
neither tool attempt is a game failure or a successful interaction.

## Measured layouts

All rows use First Connection with both touch pads enabled, except the initial
standard screenshot also establishes the layout before Large preferences.
Measurements are of the actual canvas, not its decorative border.

| Viewport | Text / controls           | Canvas  |                                             HUD height |
| -------- | ------------------------- | ------- | -----------------------------------------------------: |
| 568×320  | Standard / regular stick  | 438×219 | 44px visually; initial DOM sample omitted HUD selector |
| 844×390  | Standard / regular stick  | 578×289 |                                                   44px |
| 568×320  | Large Plain / Large D-pad | 418×209 |                                                   44px |
| 844×390  | Large Plain / Large D-pad | 558×279 |                                                   44px |
| 600×400  | Large Plain / Large D-pad | 572×286 |                                                   44px |
| 960×501  | Large Plain / Large D-pad | 784×392 |                                                   44px |
| 960×540  | Large Plain / Large D-pad | 862×431 |                                                   44px |
| 1024×600 | Large Plain / Large D-pad | 982×491 |                                                   44px |
| 390×844  | Large Plain / Large D-pad | 370×185 |                                                   74px |

Every captured row has zero horizontal page overflow. Every visible button in the
measured Pause/touch set is at least44px on each axis. The2:1 arena is complete.
Landscape controls deliberately overlap corner artwork; at568×320 they cover a
substantial part of those corners. This is a space/readability tradeoff, not proof
of comfortable two-person phone play. Portrait Large text is explicitly not a
single44px row. Long initial instructions and short Resume captions are distinct
states; do not combine their geometry into one simultaneous claim.

## Still required

Final accepted PR209 reconciliation, full track metadata/credit presentation,
stronghold objectives and independent event messages, Solo/Versus final journeys,
simultaneous fingers, real iPhone Safari/Home Screen lifecycle, Steam Deck A-start,
full source gates and versioned public deployment remain open. The compact-track
replacement is still queued. This check closes only the earlier inconclusive
browser activation within this narrow composed Team preview.
