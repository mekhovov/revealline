# Couch controller navigation: scoped source verification

Recorded 2026-09-12 for host/test commit `4eb71551dee4ff72f08100ade4613ec29c31115c`, following plan `40ee9c4` and UI `84af5c3`. Guide commit `d163398a262a962de2afbf9765ec9eca1586b563` adds documentation only. Implementation is isolated on `codex/couch-navigation`, based on `9b97ea4ab0fa43c583c060d79f6806a6ec599b43`; this report does not certify a release or deployment.

## Result and retained evidence

The affected nine-file batch passed **174/174**. Afterwards, one test was strengthened to inspect every stepped public event for a held Confirm leaking into flight actions, instead of inspecting only the last tick's transient event array. The final new suite then passed **16/16**. These runs overlap: this increment adds **16 unique tests**, not 190. Production code was unchanged between runs; the 174-test batch was not repeated merely for the test assertion or documentation edits.

Raw evidence remains in the isolated worktree cache, outside release assets:

| Evidence                                                                                                                                                       | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Affected batch TAP](/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/couch-navigation/.cache/couch-navigation/affected.tap)                | `6cc09de7e122915ca04531b31c24d1fde0d9a9176e5be4d27a2ec72445e167bc` |
| [Final new-suite TAP](/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/couch-navigation/.cache/couch-navigation/navigation-final.tap)       | `f2286b7156e2c933bde32e19739f5aacbe9e1580167566873ac7047f935f58bd` |
| [Scoped verification metadata](/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/couch-navigation/.cache/couch-navigation/verification.json) | `645eb1a7906e8c28f73eee037e41549b0dc49d57633b64a1255e3253a270e3fc` |

The metadata records all six changed runtime/test file hashes. Its source and log references were rehashed when writing this report; all eight matched. Principal final pins:

| File                                                                  | SHA-256                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Couch host](../../../game/couch/couch.mjs)                           | `513ac90d989a5ae1e547e72788faa8e781cc8d90ce3c6d05b776f8fa179e3d4a` |
| [New integration tests](../../../game/test/couch-navigation.test.mjs) | `83889c6b46b6a572be8f10f61e53a27a09810617bf5775850d9605ff71642d9a` |
| [Minimal DOM fixture](../../../game/test/helpers/couch-dom.mjs)       | `eaea45cd3b4904881a0fd208a036e83457a81d0ed36e4239bd2bed18b586570a` |

## What the tests establish

The new suite imports the actual couch entry and parses its HTML into a minimal DOM fixture. It uses the production router, navigation adapter, couch input and duel/core; drawing and audio-device effects are outside the assertions.

- Sparse two-pad allocation, simultaneous deliberate joins, nonowner exclusion, explicit ownership release and a third unassigned pad. Joining and held Confirm cannot start twice or emit flight actions.
- Real select preview/cancel/commit, primary focus, Back/Menu without implicit resume, native checkbox activation, keyboard handoff while a D-pad remains held, and separate held touch inputs.
- Loss while already Ready, changed descriptors at the same index and explicit disconnect/reconnect before another frame. The loss sample cannot step flight or activate a menu; the surviving player retains its slot.
- Exactly one hardware query per visible frame, including multiple fixed steps, and none during hidden/unfocused/disposed frames. Persisted return stays paused, previews cancel, and Ready Escape retains the truthful Start caption.
- Real Sentinel wins under both steering policies, driven through controller Start/Next and keyboard flight input. Existing legal route segments reach the expected tick/score and match independently stepped core checkpoints at couch's existing seed `2026`. Two round wins reset the series only on explicit rematch. Separate cases cover a lost craft while its opponent continues, both-lost draws and a round-timeout draw.

The only existing-test adjustment is `doc.hasFocus = () => true` in [the encounter harness](../../../game/test/couch-encounter.test.mjs). All three existing cases and their assertions remain intact. Core physics, duel protocol/ranking, recorded command formats, content, saved profiles and historical proofs were not edited.

## Commands and review boundary

Commands ran from the isolated worktree with Node `22.22.2`:

```sh
mise exec node@22.22.2 -- node --test \
  game/test/couch-navigation.test.mjs game/test/couch-input.test.mjs \
  game/test/couch-encounter.test.mjs game/test/multiplayer.test.mjs \
  game/test/multiplayer-encounter.test.mjs game/test/controller-router.test.mjs \
  game/test/controller-router-bindings.test.mjs game/test/controller-bindings.test.mjs \
  game/test/controller-navigation.test.mjs
mise exec node@22.22.2 -- node --test game/test/couch-navigation.test.mjs
mise exec node@22.22.2 -- npx eslint game/couch/couch.mjs \
  game/test/couch-navigation.test.mjs game/test/helpers/couch-dom.mjs \
  game/test/couch-encounter.test.mjs --max-warnings 0
mise exec node@22.22.2 -- npx prettier --check game/couch/couch.mjs \
  game/couch/index.html game/couch/couch.css game/test/couch-navigation.test.mjs \
  game/test/helpers/couch-dom.mjs game/test/couch-encounter.test.mjs \
  docs/round-29-couch-navigation-plan.md
git diff --check
```

Scoped lint, formatting and diff checks passed. Root and both peer reviewers independently read the implementation and found no concrete blocker; neither peer reran the suites. The final review included the strengthened event assertion.

The fixture models geometry and simplifies DOM event dispatch. It does not establish real capture/default-focus ordering, CSS visibility, physical gamepad behavior or human usability. Browser acceptance remains ongoing and must be reported separately. No browser automation, broad test suite, release build or frozen-artifact mutation was performed for this scoped handoff. See the [accepted plan](../../round-29-couch-navigation-plan.md) and [player/maintainer guide](../../couch-controller-navigation.md).
