# Demo Confirm and spectator routing recovery

## Reproduced defects

Accepted main `5e23fa8a62accf7a719cca5dd45c0702b52d37a5` retains the shared
release-committed Confirm coordinator, but the active Demo branch returns before
sampling it. Demo forwards the router's press-time `ui.confirm` directly to menu
navigation. Its menu callback also still expects obsolete transaction command
fields, including a call to the removed lifecycle `reset` method.

The existing real-host `demo-confirm-host.test.mjs` reproduces the consequence:
three cases pass and four fail. Watching and practice Back activate on A-down in
Gamepad-first order, or during a held A when native input arrives before RAF.
The native-first winner and touch-derived cases already pass. This establishes a
current Demo integration defect, not the origin of every historical Deck report.

Five additional existing `demo-input.test.mjs` cases fail because the router no
longer implements the `spectator` option still passed by the host. The missing
implementation is in `7e3d3bbdaf9bf82044cf93b851d3b356ee63dc2e` from PR #781;
merge `571319c38ded490fce09e4e9062e799928c0a40d` omitted its spectator changes
while incorporating later router work. The surviving tests cover configured
Back/Menu, remapped Back, and fresh Hold/Toggle Boost gestures.

## Repair

Demo now advances the shared Confirm coordinator from the already sampled frame
before dispatching other controller commands. Menu Confirm is masked from the
legacy press-time path. A release that closes Demo, changes its menu root or
scope, or hands input to gameplay cannot dispatch the old frame into that new
owner. The obsolete menu transaction adapter is removed.

The spectator router behavior is restored independently of the newer radio and
raw-profile support. It preserves spectator Back/Menu meanings and fresh Boost
edges while ordinary gameplay retains its bindings and boost policy. No extra
Gamepad read, suppression timeout, persistent setting, or release version is
introduced.

## Verification and remaining plan

Four new real-host tests exercise pure Gamepad taps and five-second holds in
watching and practice, with no native echoes. They also cover a simultaneous
Back or Down edge on release: Home remains open and its restored focus does not
move. Holds advance wall-clock time while rendering normally; they do not model
a five-second stalled simulation frame.

Final focused results, with Node 20.19.5:

- Router, binding and Demo input suites: **119 passed, zero failures or skips**,
  including all five formerly failing spectator cases.
- Shared Confirm lifecycle and real Demo Confirm host suites: **26 passed, zero
  failures or skips**, including the previously failing native-ordering cases,
  native-first winners, touchscreen recovery and the new pure-Gamepad cases.
- Selected real Demo gameplay handoff test: **one passed, 16 unrelated cases
  skipped**. It verifies one hardware read per ordinary gameplay frame.
- Source validation, presentation metadata, scoped ESLint, formatting and patch
  whitespace checks passed. Independent review found no actionable issue in the
  combined coordinator/spectator change.

```sh
node --test game/test/controller-router.test.mjs game/test/controller-router-bindings.test.mjs game/test/demo-input.test.mjs
node --test --test-concurrency=1 game/test/controller-confirm-lifecycle.test.mjs game/test/demo-confirm-host.test.mjs
node --test --test-name-pattern='controller gameplay action takes over while preserving one hardware read per frame' game/test/demo-host.test.mjs
```

Completed implementation is separate from acceptance. Exact-head CI and release
integration remain with Releases. Fresh packaged Chrome/fullscreen testing is
pending browser access. Physical Steam Deck Game Mode Chrome, short taps and
holds, the existing launch routes, and touchscreen/keyboard recovery remain
hardware acceptance gates. Use the same build's opt-in controller trace if a
failure remains; automated host tests do not certify Steam Input ordering.
