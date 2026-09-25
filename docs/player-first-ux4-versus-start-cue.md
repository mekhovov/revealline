# UX4 Versus start cue

## Scope

Fresh `origin/main` at `d3e5ef4e9218ec79a3fbe72c71c02db3c719866c` (the merged v0.131 localization source) and immutable public v0.130.0 both move a prepared Versus duel to `running` immediately. They do not show the player-first `3, 2, 1, GO` sequence and do not reserve a shorter Retry cue.

This draft is the smallest independent correction:

- a new Versus mission shows `3`, `2`, `1`, then `GO` over both prepared boards;
- neither simulation nor the race clock advances before `GO`;
- Retry uses one 600 ms `READY` phase before `GO`;
- a second activation cannot create another duel while the cue owns the running boards;
- input accumulated during the cue is cleared at the `GO` boundary, followed by the existing neutral first simulation tick;
- backgrounding, disconnect, or Pause restarts an interrupted cue instead of consuming it offscreen;
- reduced effects keeps the same timing and removes the decorative shadow only.
- visible `READY` and `GO` copy follows the active English or Ukrainian interface locale.

The cue uses the animation-frame clock. It owns no timeout and never mutates simulation time.

## Evidence

Focused exact-branch evidence:

- `node --test game/test/couch-start-cue.test.mjs game/test/couch-start-cue-host.test.mjs` — 5/5 pass.
- `node --test game/test/versus-continuous-next-host.test.mjs` — 10/10 pass when run with the cue tests; the combined run is 15/15.
- `node --test game/test/candidate-versus-host.test.mjs` — 12/13 pass. The sole controller chooser wait expiry reproduces unchanged on fresh `origin/main`.
- `node --check game/couch/couch.mjs` and `node --check game/couch/start-cue.mjs` — pass.
- `git diff --check` — pass.

The current main branch also has four unrelated Solo/controller failures in `touchscreen-controller-host.test.mjs` and two Couch Help-controller failures in `couch-shell.test.mjs`; the selected failures reproduce unchanged in a detached fresh-main worktree. They are not counted as passes or corrected in this slice.

## Release-train dependencies

This PR is intentionally draft, unversioned, and must not merge ahead of the cumulative release train:

1. v0.131 localization (`PR506`) — merged and included in this draft's base
2. v0.132 offline installed play (`PR536`)
3. v0.133 compact gallery and guarded Couch Confirm (reconciled successor to the reverted `PR535`)

After v0.133, rebase this branch and reconcile `game/couch/couch.mjs`, `game/couch/index.html`, and the shared Couch host helper. The guarded controller activation from v0.133 is required before controller-only start can be claimed as qualified.

Related player-first work remains separate:

- `PR539` changes Couch secondary navigation and is expected before this feature.
- `PR543` changes Team teaching/layout and does not supply a Versus start gate.
- `PR545` removes automatic Team terminal Retry and does not overlap this start cue.

Target allocation should follow the release coordinator after those dependencies are accepted. This draft does not reserve or publish a version.

## Remaining qualification

- Rebase onto the accepted cumulative player source and rerun exact-head focused/build/release-ready gates.
- Verify full, reduced-effects, short-landscape, portrait, keyboard, touch, and modeled-controller behavior in a browser.
- Verify a physical controller/Steam Deck separately; modeled input is not hardware certification.
- Add the equivalent start gate to Solo and Team in later bounded features. Cross-mode UX4 is incomplete until all three modes use the same timing contract.
