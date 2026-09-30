# Team readability and recovery — 29 September 2026

## Scope and exact source

Current-main base: `6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8`.
Reviewed integrated runtime: `aa32c591e7a7b57dabc2ab122d0125f0a35fbbf5`.
The later two-line display-fixture correction changes no runtime code.
Existing PR757 is updated by a normal descendant push; its historical head
`8e15bc7523c39a33ecc2a5d457f24b0d99bdc170` remains an ancestor.

Levels' independently reviewed Resume and Support commits were adopted as
`0e13057b7` and `552d5faa0`, preserving their logical boundaries. The narrow
More reconciliation avoids the historical patch's unnecessary Help closure.
See the separate [Resume evidence](../team-resume-rescue-guidance-2026-09-29.md).

## Automated evidence

- `node --test game/test/coop-host.test.mjs game/test/coop-actor-layout.test.mjs game/test/coop-resume-down-warning.test.mjs game/test/team-contextual-teaching.test.mjs game/test/team-contextual-teaching-host.test.mjs`: **112/112**, zero skips/cancellations.
- Complete `display-preferences-host.test.mjs`: **9/9**, zero skips/cancellations.
- Selected recipe-source mutation/missing-byte tests: **2/2**. This authenticates
  the new `game/text-size.mjs` dependency, not production approval.
- Changed-file ESLint, Prettier and `git diff --check`: pass.
- Presentation metadata: field-kit revision100 remains exact, 5,206,987 bytes,
  SHA-256 `baaf4c56fd2847c6bbbbc6c096625cdf47425689bdd4f5de78da3ff31031208e`.

More's actual terminal-loss cases now assert the collapsed disclosure. The new
navigation test alone covers lobby → Start → Pause, not a completed victory.
Renderer checks cover minimum CSS widths 292/362 and full 1152, Standard exact
command digests, Large numerals/downed/warnings, plate bounds/head exclusion and
unchanged prepared bodies/contact geometry.

Preserved red evidence is intentional: More failed because its disclosure stayed
open. The earlier sparse-checkout missing Motion Lab module was an environment
failure and is not behavioral red proof. The old Versus display fixture also
failed on unchanged source: joining a controller activates the compatibility-click
shield, so its immediate synthetic mouse click never opened Settings. The test now
uses a fresh modeled South press on the actual Options control; all following
assertions remain. No runtime guard or timeout was weakened. Details and logs are
linked in this directory and hashed in `manifest.json`. Committed red TAP copies
remove trailing whitespace only; the manifest records original and prepared hashes,
and local `.cache/team-readability` retains the raw failures.

## Browser review

Ordinary local Team route `http://127.0.0.1:63008/game/couch/relay-rescue.html?journey=legacy`.
English/Ukrainian, Large/Plain, reduced effects; no injected game state or rewards.
Start and Pause/Resume were used through visible controls/keyboard. More opened
while paused and keyboard Back closed it. Settings returned to Pause without
resuming. Relay Yard was chosen through Arena & team options.

| CSS viewport | Observation                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1280×800     | First Connection full 1152×576 board; enlarged player/Hunter labels; no horizontal overflow.                                                                                                                    |
| 844×390      | First Connection 492×246 board; both direction pads 52×52; Boost/Support ≥55px tall; Pause 44px; controls outside board.                                                                                        |
| 390×844      | First Connection 370×185 board; both direction pads 52×52; controls end at 535.54px; no horizontal overflow.                                                                                                    |
| 390×844      | Relay Yard Ukrainian: anchors/core/Hunter labels visible; pre-existing DOM HUD Support text is cramped.                                                                                                         |
| 568×320      | Relay Yard 264×132 board; both direction pads 44×44; Pause 44px; controls within viewport, but Ukrainian HUD and ability labels wrap poorly. This is an outstanding layout defect, not whole-layout acceptance. |

First Connection screenshots were captured after the Large/More checkpoint
`885105e84`; these renderer bytes remain exact in the integrated runtime. Relay
Yard screenshots were captured after reloading `aa32c591e`. The recordings show
initial running boards and Settings/Pause transitions, not a full clear/rescue or
all animation states. Those recovery states have scoped automated evidence.
Browser clicks on touch controls are not physical touch qualification; modeled
controllers are not hardware/Steam Deck certification. 200% zoom, complete offline,
performance, actual listening, all editions and exhaustive mission play remain open.

## Production and next work

No simulation, image bytes, compiled bindings, historical approvals or version
metadata changes. Large changes the Team renderer dependency fingerprint and
therefore reopens Team/equipment production review. Complete a reviewed successor
on the final integrated renderer; do not update old hashes or weaken the guard.
The existing v0.150.0 source intake/publisher owns that adoption and the required
build, immutable freeze, archive admission, Pages byte checks and public play.

Next narrow layout slice: reflow the existing Ukrainian HUD/status and ability
labels at portrait/very short landscape while preserving the whole 2:1 board,
44px targets, both player identities and real objective/status information. Do not
shrink typography or claim this canvas correction also fixed that DOM layout.
