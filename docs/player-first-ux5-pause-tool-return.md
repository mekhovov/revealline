# UX5 — paused Settings and Help return

Status: draft release input. This change is intentionally unversioned and does not publish, tag or
select a release.

## Cross-mode review

The player-first contract says a tool opened from gameplay pauses and releases the attempt, and
closing the tool returns to Pause without resuming it.

- Versus already opens Settings and Help as owned screens. Back returns to the remembered paused
  lobby action.
- Team reparents Settings and Help into its paused overlay. Settings keeps an explicit owner and
  restores that visible opener; Help closes back to its summary.
- Solo's Pause actions already restore their exact openers. The remaining mismatch was the
  persistent shell Settings action: when used during flight it installed Pause but the modal still
  remembered the shell toolbar as its return. The same latent path existed for the older direct Help
  action.

## Change

After Solo pauses for Settings or Help, it makes the matching visible Pause command the modal
origin. Closing by button, Escape or controller Back therefore leaves the attempt paused and places
focus in the menu that now owns it. Title Settings and Help keep their title openers because no
paused overlay exists there. No simulation, persistence, sound preference or controller binding is
changed.

This is independent of PR535's compact gallery and PR539's Couch secondary-navigation cleanup.
When those branches land, reconciliation must preserve this paused-tool focus handoff and avoid
duplicating Couch navigation work.

## Focused evidence

- `game/test/pause-menu-host.test.mjs`: 4/4 pass, including Settings and Help opened while running,
  unchanged checkpoints, explicit Pause return focus and explicit Resume.
- Selected Solo modal restoration cases: 3/3 pass (responsive fallback, title return and running
  Settings return).
- `game/test/settings-assists-host.test.mjs`: 1/1 pass.
- `game/test/steamdeck-menu-confirm-host.test.mjs`: 11/11 pass.
- `game/test/controller-practice-pause-host.test.mjs`: 3/3 pass.
- Scoped ESLint, Prettier and `git diff --check` are required before the draft is pushed.

The complete modal-navigation file is 49/54 on this exact head. Its five inherited failures cover
Collection reading/disclosure, a nested Studio editor and Collection appearance setup; they were
also present in the pre-change baseline. The three directly affected Settings cases pass when
selected. This draft does not weaken those assertions or classify the inherited failures as UX5
passes. Physical controller, Steam Deck and touch-device checks remain separate release
qualification.
