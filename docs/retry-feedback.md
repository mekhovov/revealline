# Understand a loss and try again

Available in the latest frozen release, [v0.14.0](http://127.0.0.1:8767/releases/v0.14.0/site/game/). The preserved v0.13.0 keeps its earlier result text. The new release passes [all six source gates and 1,439 tests](verification/round-24/source-gates.md); its archived source [rebuilds all 134 outputs identically](verification/round-24/integrity-notes.md). A saved localhost build is not a public-host or store deployment.

When an attempt ends, **A new line awaits** explains the resolved cause, shows the revealed percentage and suggests one adjustment. The **Try again ↻** button starts a fresh attempt immediately. Reading, waiting or leaving **Read details** never starts it for you.

| What ended the attempt                             | Try next                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Your unfinished line crossed itself                | Rejoin safe ground without crossing your open line.                    |
| An enemy caught the unfinished line                | Try a shorter cut and keep enemies away from it.                       |
| An enemy reached your character                    | Keep a gap; border patrols can reach safe ground.                      |
| An active marked lane caught the character or line | Keep both outside the lane while it is active.                         |
| The open-line timer expired                        | Rejoin safe ground sooner. Stopping movement does not stop that timer. |
| The line exceeded its length limit                 | Plan a shorter line back to safe ground.                               |
| The mission clock expired                          | Plan a shorter route to the required reveal area and objectives.       |

These explanations use the actual game outcome. A generic fallback suggests reviewing the brief if no recognized cause is available. The game does not guess which enemy acted from its later position or promise that a suggestion guarantees a win. Real **Pause** still freezes the simulation; the warning about stopping movement is about a character waiting during play. Not every timer is a deadline: the existing mission settings distinguish limits from medal targets.

Retry resets this attempt's revealed territory, lives, objectives, encounter, ammunition and cooldowns to their initial setup. It uses the selected mission, seed, steering mode and **starting** equipment; a later hangar switch does not become the new starting class. Existing collected pictures, best results, seals and campaign clears remain. A lost attempt grants none of those rewards. Losing one life and recovering within an unfinished attempt is different: earlier captured territory is retained, while the failed open line is cleared. Shields and Impact retain their existing recovery behavior.

The retry consequence is part of **Read details**, including on compact screens. The Retry and Done controls remain outside the scrolling text. Configured menu Up/Down scroll; Confirm, Back or Menu ends reading without also retrying. Release before the next action. Keyboard/touch scrolling still works. Retry clears active input, including a controller Boost toggle; the saved Hold/Toggle preference stays selected and a fresh eligible gesture is required. It does not restore a held command from the ended run.

Practice displays its own consequence note and never grants campaign rewards. Storage warnings remain separate: this explanation does not claim that a new save succeeded, change an older saved-flight slot or replace the need for [backups](full-backup.md).

## Maintain the projection

[`retryExplanation(run, options)`](../game/ui/retry-view.mjs) reads only own data `status` and `failureCause` fields. It returns null unless status is `lost`, otherwise an owned `{cause, reason, tip, footnote}`. Unknown causes use fixed fallback text. Options may omit `practice`; an explicit value must be an own data boolean in a plain object. The helper neither executes field getters nor retains mutable simulation references. It is presentation, not validation of an imported outcome.

Keep the terminal guard: a prior failure cause survives recovery, shield absorption and possibly a later win. Impact redeployment need not establish a new cause. Mission timeout can supersede an earlier cause during recovery without a new `player.failed` event. Use the core result, not lives, captions, actor locations or the last event in a render frame. Replay reconstruction already verifies the cause; saved attempts only adopt unfinished runs.

The app places reason/tip/percentage in `#overlay-copy` and the consequence in `#retry-consequence`, both via `textContent` inside `#overlay-reading`. Hide and empty the latter before every overlay, showing it only for a real lost explanation. The old `.overlay-footnote` is hidden at some compact breakpoints and cannot carry essential retry text. Terminal handling also replaces the temporary run caption with neutral ended-flight text so nonterminal territory-retention advice cannot remain beside a reset note. Preserve independent save warnings and immediate `prepare()`→`resume()` Retry.

Run the focused checks:

```sh
node --test game/test/retry-view.test.mjs game/test/retry-integration.test.mjs
```

Six projection tests check owned data, status suppression and context without duplicating every string. Twenty-six integration tests include all seven causes in both steering modes, real replay/checkpoint verification, restoration during recovery, eventual wins with retained causes, terminal-session rejection, prior collection preservation and original frozen route expectations. Fixtures use normal fixed-tick commands; they are not manual play or new historical oracles. The [source browser checks](verification/round-24/source-browser.md) cover five measured viewports, consequence visibility, native and configured controller reading, held Retry Confirm and retained collection rewards. The [frozen offline check](verification/round-24/frozen-browser.md) verifies 127 files / 20,519,745 bytes, then reopens with the server stopped: ordinary loss → Read/Done → explicit Retry → an 8,160-point win, with one golden picture and a 3.75-second score retained after another reload. A separately imported staged boss practice scenario also resets correctly after offline Retry at 320 × 640. See the [accepted plan](round-24-retry-plan.md); these observations do not establish human comprehension, physical hardware compatibility or enjoyment.
