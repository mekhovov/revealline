# Independent Team composition source review

No actionable source blocker found. This review concerns the actual candidate on `d2455ebfa444a8692d2694790afa6e4199af64e0`; it does not qualify tests, browser behavior, a phase or a public release.

## Runtime identity

| File | Bytes | SHA-256 |
|---|---:|---|
| `game/couch/coop-view.mjs` | 21420 | `f54b0a83047606aa845209716cdd4ee6a952c892808606d2597539927b76e342` |
| `game/couch/relay-rescue.mjs` | 63875 | `5709387a4b4afab60f9ee67eb7cb314bd2a6b9ce6941854dbe8bd5f8173993cb` |
| `game/couch/relay-rescue.html` | 22232 | `95ea2552db1b2d3dceb26ac4f0f41ff2fab6addb8979acfbac1d768c810e1ea7` |
| `game/couch/relay-rescue.css` | 19284 | `315069d23962338346347c5cfb102249c3efbe380d99032baf207fef079e16dc` |

## Reviewed contracts

- **Terminal earned picture:** Accepted snapshot, level/revision, dimensions, fit and sampling checks precede the won-picture branch. The early return remains inside try/finally. Running, paused, lost and procedural painting retain their path. No simulation mutation or image disposal was added. Source: `game/couch/coop-view.mjs:63-82,122-136 and final canvas restore`.
- **Borrowed lobby teaser:** The lobby borrows the current prepared image, retains its complete 2:1 mapping behind an opaque centre and clears retired canvas pixels. Preview-only failure permits retained-binding retry without another decoder, lease or run; valid Start is not blocked. Source: `game/couch/relay-rescue.mjs:699-790,895-902,953-962`.
- **Direct picture recovery focus:** Ownership includes selection identity, attempt, generation, Settings visit, scope and foreground. Direct focus/layout callbacks are followed by currentness checks. Explicit Cancel retains its legitimate same-selection handoff. Focus/reveal exceptions retire focus ownership without preventing the reader from starting. Finalization retires observers. Source: `game/couch/relay-rescue.mjs:596-698,792-802,828-889`.
- **Successful function-target handoff limitation:** Existing navigation.focusAvailable success behavior is preserved; the new direct-handoff reentrancy/reveal guarantee does not extend inside that callback. Source: `game/couch/relay-rescue.mjs:finish function branch and preparePicture success`.
- **Visible lobby return:** The synchronous handoff checks generation, Settings visit, foreground, active target and actual current primary around focus/layout. It reveals only an offscreen action, does not reacquire the retained picture or start play, and removes observers in finally. Source: `game/couch/relay-rescue.mjs:1040-1143`.
- **Player copy and diagnostics:** Only current failures produce fixed friendly UI copy and local original-error diagnostics. Currentness is rechecked after the console callback. Existing decode/binding refusals and lease assertions remain. Source: `game/couch/relay-rescue.mjs:878-887; game/test/coop-picture-host.test.mjs`.
- **Meaningful regression boundaries:** Reviewed real public-command authored wins, independent preview/arena traces, exact original bytes, stale/cancelled work, no auto-Start, Settings completion, reentrant focus/layout and observer cleanup cases. Native decode, rasterization, viewport geometry and physical-device acceptance remain separate. Source: `game/test/coop-victory-picture.test.mjs; coop-lobby-preview.test.mjs; coop-lobby-focus.test.mjs; coop-picture-recovery-focus.test.mjs; coop-won-terminal-host.test.mjs; helpers/coop-host.mjs`.

## Base preservation

Both shared guidance files retain their complete exact d245 prefix, followed by the Team sections. Strict FPV28 bindings, compiled runtime, actor revision assertion and flight-media pins match d245. There is no tracked delta in Team/core mechanics, content, compiled presentation or the strict binding table. No artwork or producer change is part of this composition. The two current-composition documents identify d245/FPV28 and retain historical evidence as historical.

## Open qualification

Fresh d245 browser qualification and First Connection ordinary native win → full picture → Retry remain open. Earlier Relay Yard victory and First Connection partial capture/loss/Retry are predecessor evidence only. Root owns the complete Node20/22 runs, native checks and subsequent release gates. This reviewer ran no tests, built nothing, made no browser/remote actions and changed no source.
