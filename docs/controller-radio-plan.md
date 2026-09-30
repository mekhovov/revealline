# Controller, radio and FPV delivery plan

Reviewed 30 September 2026 against main
`09a43d83351af276f184293ed3c72261575ed8bc` and current GitHub PR/issue state.
This is the current plan for the two-controller / EdgeTX work. Older counts,
branch descriptions and ZIP hashes in the linked reviews remain dated evidence.
This plan does not replace the repository-wide delivery register or assign
another task's active work to this lane.

## Status and scope

Core implementation is merged. Two-controller couch play, regular Solo radio
input, shared-radio sticks, mixed device assignments, saved layouts and the
bundled FPV entry are implemented. The user confirmed selected USB hardware
scenarios. This does not establish every browser, transport or native platform.

Keep four delivery states separate: implemented source, merged source, verified
published bytes, and physical-device qualification. A release milestone records
intent, not proof of all four. v0.150.0 remains the existing release target;
the release task owns publication and cumulative acceptance. This review did not
re-verify the live published site or create a new release/version.

## Completed phases

| Phase                                     | Delivered behavior                                                                                                                                                                                                                                          | Evidence and practical limit                                                                                                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Input contracts and transport research | Use browser-exposed gamepads with independent player seats; the operating system handles USB, Bluetooth and dongles. Preserve keyboard/touch and existing Solo controller behavior.                                                                         | Research references and contracts are in [two-controller support](two-controller-support.md). A transport still requires the OS/browser to expose the device correctly.                                                                      |
| 2. Two standard controllers               | Explicit joining, stable assignments, independent movement/actions, one menu owner, neutral-release guards and disconnect pausing in Versus/Team.                                                                                                           | User confirmed two USB PS5 DualSense controllers. Other transports and platforms have not received equivalent physical qualification.                                                                                                        |
| 3. Raw radios and regular Solo            | Capture and verify axis/button/hat recipes; regular Solo uses its own radio adapter and storage. Unmapped actions retain keyboard/touch support.                                                                                                            | User confirmed TX15 right-stick movement in regular Solo. Existing standard-gamepad mappings remain separate.                                                                                                                                |
| 4. Shared and mixed multiplayer           | One TX15 can supply P1/left with its left stick and P2/right with its right stick. Two separately configured radios or a radio plus a gamepad can own separate seats. Shared physical channels cannot control both players.                                 | Shared TX15 Team movement was physically confirmed. Two-radio and radio/gamepad cases have modeled host/session coverage, not physical confirmation.                                                                                         |
| 5. Saved setup and recovery               | Restore applied layouts only for unambiguous device identities; do not steal occupied seats or auto-resume. Retain disconnected profiles and guard malformed/newer/concurrent-tab storage. Action mapping can extend movement recipes without erasing them. | Historical software checks cover reconnect, ambiguity, storage and input ownership. Identical radios still require explicit assignment.                                                                                                      |
| 6. FPV radio controls                     | Verified TX15 default, four flight channels, arm/disarm and reset capture, descriptive physical-stick labels, saved custom profiles and deliberate arming guards. Explicit device deselection clears the runtime selection/verification.                    | User confirmed TX15 USB flight, arm/disarm and reset. Exact-device defaults are not generic EdgeTX channel assumptions. See [physical session](tx15-radio-verification.md).                                                                  |
| 7. Game integration                       | Bundled FPV entry, same-tab launch and validated Back to game route. FPV calibration/progress remain separate from regular Solo/couch controls.                                                                                                             | Core integration [#797](https://github.com/mekhovov/revealline/pull/797) and menu verification [#819](https://github.com/mekhovov/revealline/pull/819) are merged. Entry placement may change with the separate compact-menu work.           |
| 8. Offline integration                    | Game-launched FPV exposes its own supported preparation/removal controls. Its scoped worker/icons and admitted entry navigation preserve language/return query parameters offline.                                                                          | [#853](https://github.com/mekhovov/revealline/pull/853) is merged. Optional FPV is separate from core downloads: bundled files alone do not mean it has already been prepared offline. Cumulative installed/offline acceptance remains open. |
| 9. Native source compatibility            | Explicit HTML structure allows the native policy to process the sprite review and sound credits. Official iOS plugin bridge builds.                                                                                                                         | [#859](https://github.com/mekhovov/revealline/pull/859) is merged. All 47 included source HTML pages passed at its recorded candidate. Full native staging is still capacity-blocked.                                                        |

## Device and player instructions retained by the plan

For regular Solo use the right-stick TX15 movement preset. For one shared radio,
choose the shared preset so physical stick sides match screen/player sides.
Center both sticks before regular game input, including the non-centering left
vertical stick. This is separate from the FPV simulator's full-range throttle.

The tested Mode 2 FPV channels are Roll (right stick left/right), Pitch (right
stick up/down), Yaw (left stick left/right), and Throttle (left stick up/down).
The exact tested USB identity has eight axes and 24 buttons. Its measured arm
switch is axis 4, OFF −1 / ON +1; reset is button 1. Verified custom profiles take
precedence. Other identities/layouts require capture and verification.

Extra gameplay switches are a player configuration step, not an unfinished
universal default. Map each logical player separately; do not guess channels.
Move assigned controls to neutral after connection and use deliberate switch
transitions. Saved setup never authorizes automatic arming or resume.

## Remaining work, in recommended order

### P1 — Close the web release and installed/offline journey

Owner: release task, with the FPV and menu owners for their inputs.

Merge/admit compatible pending inputs, including [#862](https://github.com/mekhovov/revealline/pull/862)
for pause from focused toolbar controls and 0.5×/1× replay review, and the separate
compact-menu work [#854](https://github.com/mekhovov/revealline/pull/854). These are
open at this checkpoint, not completed parts of main. Do not duplicate them.

Acceptance: verify exact cumulative build identity and published bytes; launch
FPV through the final menu; return to the originating game route; prepare optional
FPV offline, revisit the admitted query-bearing entry with networking unavailable,
and verify update/removal and profile/progress preservation. An older local ZIP
or source-only observation cannot close this step. Web delivery need not wait
for native capacity or deferred hardware work.

### P1 — Resolve the deferred verification gap

Owner: existing verification follow-up [#813](https://github.com/mekhovov/revealline/issues/813)
and release task.

The previous broad host rerun had 15 passes and 10 initial-picture readiness
timeouts. That is not a full passing gate; shared-host load was present, but its
causal role is not proven. Reproduce in an appropriate environment, determine
whether fixture readiness, missing data, performance or a product defect is
responsible, and repair the actual cause without hiding failures in larger
timeouts. Requalify affected input/menu paths when the owner restores testing.

The [current test waiver](focused-test-waiver-20260930.md) governs test-only
commands. Report deferred checks as `WAIVED_SKIPPED_NOT_PASSED`. Required source,
localization, build, capacity, admission and release-ready checks still apply.
Do not treat a waived suite or historical focused pass as current qualification.

### P2 — Unblock desktop/iOS packaging

Owner: native packaging decision coordinated with the release task;
[issue #865](https://github.com/mekhovov/revealline/issues/865), v0.150.0.

The recorded web candidate built 2,660 files totaling **949,537,804 bytes**. The
shared desktop/iOS inventory limit is **805,306,368 bytes (768 MiB)**, leaving an
excess of **144,231,436 bytes**. Staging stops before a complete native output.
These figures belong to the recorded candidate, not an unbuilt newer main.

Recommended next step: inventory which authoring, edition and optional-content
payloads a native player distribution must ship. Decide an explicit packaging
scope or justify a supported capacity policy with memory/storage evidence.
Preserve required assets, retained originals, licenses, manifests and radio/FPV
dependencies. Do not silently drop files or raise the limit just to pass.

Acceptance: build the chosen current distribution, stage desktop and iOS, verify
all files and manifest hashes, and record the exact source/bridge identities.
This closes packaging only; app compilation and runtime qualification are next.
See the [native receipt](verification/radio-native-staging-20260930.md).

### P2 — Qualify native runtime when the environment is available

Dependency: successful packaging and an appropriate native toolchain/device.

The current host has Command Line Tools, but no full Xcode or simulator. iOS
compilation, launch, module MIME behavior, storage durability, focus/background
recovery and actual Gamepad exposure remain unverified. Desktop staging likewise
does not prove an installed Electron application works. Record platform/browser,
device identity, mapping, transport and exact artifact for each qualification.
No new hardware session is requested while the user's deferral stands.

### Deferred by user — Expand the physical matrix

Already confirmed: two USB PS5 controllers; TX15 USB FPV flight/arm/reset;
TX15 regular Solo right stick; shared TX15 Team movement.

Still unqualified physically: two radios; radio plus gamepad; identical-radio
assignment/reconnection; Bluetooth/dongles; mobile, Steam Deck and packaged native
runs. Modeled Gamepad coverage is useful but does not prove OS/browser/device
exposure. Resume these checks only when the user lifts the deferral.

### Parallel repository work — Finish the local-source audit

Owner: repository-wide audit and each active feature owner. This radio lane's
commits are pushed; that does not certify every historical checkout. Account for
unique bytes and intended behavior before marking local residues integrated,
superseded or explicitly deferred. [#824](https://github.com/mekhovov/revealline/issues/824)
tracks bounded historical UX/Team decisions. Active owner changes must not be
bulk-staged into this plan or a radio PR. Withdrawn broad recovery archives are
not blanket proof of safe remote preservation.

## Evidence and completion rules

- User-confirmed physical observations are limited to the scenarios above.
- Historical source checks: 40 focused controller/radio/FPV cases at `908bc6b08`;
  seven FPV packaging cases at an earlier candidate. Later offline/review changes
  require their own qualification; these counts do not apply automatically.
- Build and native attempt: exact candidate `a1b7e328f`, ZIP and manifest hashes,
  successful web build, capacity rejection and toolchain limits are preserved in
  the native receipt. Later merges are not covered by that build.
- This plan update performs documentation/source/status review, not new tests,
  browser acceptance, publication, native launch or physical trials.
- Complete the overall feature only when its chosen release scope is accepted;
  retain explicit platform exclusions and user-deferred checks. Do not label all
  devices supported solely because the common Gamepad path exists.
