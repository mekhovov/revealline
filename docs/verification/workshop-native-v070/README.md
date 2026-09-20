# Nine Workshop exits — native keyboard evidence

Source: `508a638f556b80817f4c872b9950d7de7b207b17`, no overrides.
Local Git-backed preview at `localhost:18803`, Codex in-app browser, authored
Journey route. This is a source preview, not the public or built release.
Performed 2026-09-20. All 6,754 HTTP responses / 509 distinct paths were compared
with Git bytes and SHA-256. Inventory and compressed raw request log are retained.

| Tool | Actual keyboard route | Returned focus |
| --- | --- | --- |
| Asset Studio | Tab to prepared Return to Workshop; Enter | `shell-asset-studio` |
| Mission playground | Shift+Tab inside preview to final Main menu; Tab leaves iframe to adjacent Return; Enter | `shell-playground` |
| Enemy workshop | Escape from catalog, Tab past playground to Return; Enter | `shell-enemy-catalog` |
| Motion Lab | 47 native Tabs from body to footer Return; Enter | `shell-motion-lab` |
| Pictures & stories | First Tab to Return; Enter | `shell-still-media` |
| Video Poster | Idle Escape returns through the tool’s Back action | `shell-video-poster` |
| Design atlas | Direct Workshop entry, third Tab to Return; Enter | `shell-design-atlas` |
| Replay Theater | Play built-in Copper Crossing; Escape pauses and focuses Return; Enter | `shell-replay-theater` |
| Controller practice | Shift+Tab to iframe Main menu; Tab handshake to parent Mission; Shift+Tab three times to Return; Enter | `shell-controller-lab` |

After every return, Workshop was open over Home; Escape closed Workshop and
focused `shell-workshop`. Each URL retained `journey=authored`; the one-time tool
return parameter cleared after boot. No flight auto-launched.

Separate Return to game: re-entered Video Poster, moved from file picker with two
Shift+Tabs to the explicitly verified Return to game link, pressed Enter. Boot
settled with only Home open and Continue focused, retaining the authored route.
This is distinct from Return to Workshop.

A first Motion Lab attempt incorrectly estimated keyboard stops from all DOM
inputs, including unchecked radio-group members. It reached and activated Design
atlas. That actual link correctly retained the authored route; it was not a
misrouted Return action. Motion Lab and Design atlas were then each reopened
from their own card and verified separately. Future tests verify focus before Enter.

No editor values were changed or saved. No files were imported. The practice
previews were not started and no virtual or physical controller was connected.
Replay preview playback does not grant campaign results. This record does not
establish saved-attempt continuity, controller/touch use, all iframe modes, forced
slow/failure/cancel recovery, offline behavior or public deployment acceptance.

The 47-Tab Motion Lab path is a usability finding, corrected separately in
[the top-return change](../motion-return-top/README.md).
