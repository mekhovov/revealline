# Controller, radio and FPV delivery plan

> **Historical snapshot:** this document records the 1 October 2026 planning review. Queue, deployment, pull-request status, capacity figures and recommendations below are dated evidence, not current instructions or current repository status.

Reviewed 1 October 2026 against main
`955c539a757c08c534c9038500785b20e64abb36` and the current GitHub PR/issue
state. This plan covers the
two-controller, EdgeTX radio and bundled FPV experience. It distinguishes
working source from release readiness so that a feature is not called delivered
merely because its code exists.

## Recommended direction

Use a **web-first release sequence**:

1. make the cumulative Pages package fit and reproduce its exact release inputs;
2. restore the deferred automated verification;
3. ship the beginner flight school and its drone-response aid;
4. admit the demonstration packs in a reviewed, size-aware sequence;
5. decide whether historical Team imports justify their compatibility cost;
6. keep the personal-best ghost, native packaging and broader physical-device
   matrix behind those gates.

This order gives laptop and mobile-browser players the finished controller/radio
work sooner, while reducing the chance that more optional content makes the
existing capacity and verification gaps harder to resolve. Choose a native-first
order only if an installable desktop/iOS application is the next product goal.

## How to read the status

Four states must stay separate:

- **Implemented** means the behavior exists in source.
- **Merged** means it is part of `main`.
- **Release qualified** means the exact cumulative artifact passed its required
  checks and can be published.
- **Physically qualified** means a named device, transport, browser and platform
  were exercised together.

A milestone expresses scheduling intent. It does not prove any of those states.
The current release target remains v0.150.0.

## Completed work

| Area | What players now have | Evidence and limit |
| --- | --- | --- |
| Input foundation | Browser-exposed gamepads are assigned to independent seats. USB, Bluetooth and dongle transport is handled by the operating system/browser. Keyboard, touch and existing Solo controller behavior remain available. | Contracts and research are in [two-controller support](two-controller-support.md). A device still depends on the host exposing it through the Gamepad API. |
| Two standard controllers | Explicit joining, stable player ownership, separate movement/actions, one menu owner, neutral-release guards and disconnect pausing in Versus/Team. | Two USB PS5 DualSense controllers were physically confirmed. Bluetooth, dongles and other controller families were not physically qualified. |
| Regular Solo radio | Raw radios can capture and verify axis, button and hat recipes. Solo has its own stored radio setup, while unmapped actions retain keyboard/touch input. | A RadioMaster TX15 was confirmed over USB with right-stick movement in regular Solo. |
| Shared and mixed multiplayer | One TX15 can control Player 1/left with its left stick and Player 2/right with its right stick. Two configured radios, or a radio plus gamepad, can own separate seats. | Shared TX15 Team movement was physically confirmed. Two-radio and radio/gamepad cases have software coverage but no physical session. |
| Saved setup and recovery | Verified layouts restore only for an unambiguous device identity. Reconnects do not steal occupied seats, resume play or arm the drone. Malformed/newer/concurrent-tab storage is guarded. | Standard gamepad and raw-radio profiles remain separate. Identical radios still need explicit assignment. |
| FPV radio controls | Four flight channels, arm/disarm, reset, descriptive stick labels, custom profiles and deliberate arming guards are implemented. | TX15 USB flight, arm/disarm and reset were physically confirmed. See [TX15 verification](tx15-radio-verification.md). |
| Main-game integration | FPV is bundled, launches from the game, returns to the originating route and retains its separate calibration/progress data. | Core integration [#797](https://github.com/mekhovov/revealline/pull/797) and menu verification [#819](https://github.com/mekhovov/revealline/pull/819) are merged. |
| Offline preparation | A game-launched FPV simulator exposes preparation/removal controls, retains language/return parameters and can admit its scoped worker/icons for offline use. | [#853](https://github.com/mekhovov/revealline/pull/853) is merged. Optional FPV content is not automatically prepared merely because its launcher is bundled. |
| Compact game landing | The native landing page is compact while Settings and FPV access remain reachable. | [#854](https://github.com/mekhovov/revealline/pull/854) is merged. |
| Replay review controls | Focused toolbar controls can pause FPV and review at 0.5× or 1× speed. | [#862](https://github.com/mekhovov/revealline/pull/862) is merged. |
| Native source compatibility | Source HTML is processable by the iOS native policy and the official plugin bridge builds. | [#859](https://github.com/mekhovov/revealline/pull/859) is merged. Full native staging remains capacity-blocked. |
| Radio recovery and live feedback | The World Studio restores a unique verified radio profile after reload/reconnect and shows calibrated live stick positions across simulator surfaces. | [#899](https://github.com/mekhovov/revealline/pull/899) is merged. The TX15 path was physically confirmed; controlled Gamepad checks covered all 60 challenges. |
| Guided setup and fullscreen | Radio setup follows Connect → Calibrate → Check/save, with advanced details separated. FPV entry points support immersive fullscreen. | [#901](https://github.com/mekhovov/revealline/pull/901) is merged. |
| Unified FPV experience | The simulator now uses the game's visual language and includes a Fly lobby, world selection, playlists, Workshop, Library, settings, sound and mobile/fullscreen improvements. | [#904](https://github.com/mekhovov/revealline/pull/904) is merged. |

## Retained player guidance

For regular Solo, use the TX15 right-stick movement preset. For one shared radio,
use the shared preset so the physical stick sides match the players shown on
screen. Center both sticks before regular game input, including the non-centering
left vertical stick. This differs from the FPV simulator, where throttle uses its
full range.

The tested Mode 2 FPV channels are:

- **Roll — right stick left/right:** moves the drone sideways.
- **Pitch — right stick up/down:** tilts the drone forward or backward.
- **Yaw — left stick left/right:** turns the drone around its vertical axis.
- **Throttle — left stick up/down:** raises or lowers motor power.

The exact tested USB identity reports eight axes and 24 buttons. Its measured arm
switch is axis 4, OFF −1 / ON +1; reset is button 1. Verified custom profiles take
precedence. Other identities or layouts must be captured and verified. Extra
gameplay switches are player configuration, not a universal EdgeTX default.

## Remaining work and recommended priorities

### P0 — Make the cumulative web release publishable

**Plain meaning:** prove that all selected v0.150.0 files fit the hosting limits
and that the release generator can reproduce the exact intended bytes.

**Why it is needed:** the held historical-import candidate reports a default
payload of **951,900,757 bytes**, which is **1,900,757 bytes above** the
950,000,000-byte Pages ceiling before publication metadata. It also reports a
stale revision ledger. Open FPV work can be correct in source and still fail to
reach players if the cumulative artifact cannot be built and deployed.

**What it brings:** a specific releasable web candidate, reliable optional
offline installation and a known budget for later training/demo content.

**Impact of deferral:** newer work remains source-only or release-held; adding
more media increases the overage; a successful deployment of an earlier main
revision does not prove the intended v0.150.0 aggregate will publish.

**Recommended action:** inventory cumulative payloads first. Preserve licenses,
required runtime files and unique sources. Move only genuinely optional bodies
behind explicit downloads or remove proven duplicates; do not raise the ceiling
or delete content merely to turn the check green. Reproduce the revision ledger,
then build and verify the exact chosen candidate.

**Acceptance:** production generation is reproducible, the default Pages payload
is under its ceiling with metadata headroom, optional packages have explicit
ownership, and the exact artifact passes launch, return, prepare-offline,
network-off revisit, update and removal checks.

### P0 — Restore deferred automated verification

Tracking: [#813](https://github.com/mekhovov/revealline/issues/813).

**Plain meaning:** run the checks that were intentionally skipped during the
earlier fast integration, investigate real failures and remove the temporary
confidence gap.

**Why it is needed:** focused, company, persistence, offline, artifact,
localization and edition suites were waived. Several later FPV changes also
record deferred unit coverage. A waiver means “not run,” not “passed.”

**What it brings:** evidence that controller ownership, saved profiles, menus,
offline behavior, localization and edition builds still work together on current
main. It also makes failures in later PRs easier to distinguish from old debt.

**Impact of deferral:** regressions may be discovered only by players; every new
feature inherits uncertain test results; release decisions depend too heavily on
manual sessions and historical pass counts.

**Recommended action:** after the package boundary is known, restore the smallest
release-representative suite first, then the broader deferred suites. Reproduce
the prior readiness timeouts and fix their cause rather than only increasing
timeouts. Reconcile the six preserved overlap/tooling sources from #813.

**Acceptance:** all required current-main suites pass in an appropriate
environment, or each remaining failure has a bounded owner and explicit release
decision. The waiver can then be retired for this scope.

### P1 — Ship the beginner flight school

Candidate: [#905](https://github.com/mekhovov/revealline/pull/905), currently
open and unstable.

**Plain meaning:** add 14 guided lessons and 59 steps that teach setup, arming,
Roll (right stick left/right), Pitch (right stick up/down), Yaw (left stick
left/right), Throttle (left stick up/down) and basic flight.

**Why it is needed:** the simulator now exposes capable controls, but a new
player can still enter a complex cockpit without understanding stick roles,
arming or coordinated motion.

**What it brings:** a clear first-run path, fewer setup mistakes and a way for
players to learn before attempting scored challenges.

**Impact of deferral:** all core controls keep working, but FPV remains much more
approachable to experienced pilots than beginners. Support and calibration
questions are likely to continue.

**Recommended action:** make this the next player-facing feature after both P0
gates. Rebase it on current main, resolve the unstable checks and include its
payload in the capacity calculation before merging.

### P1 — Add the optional drone-response aid

Candidate: [#907](https://github.com/mekhovov/revealline/pull/907), currently
open and unstable.

**Plain meaning:** show a small schematic drone beside the sticks so a player can
see how stick input changes the craft, even when the FPV camera view makes that
motion hard to understand.

**Why it is needed:** early learners often cannot connect a stick movement to
roll, pitch, yaw or throttle from the camera view alone.

**What it brings:** immediate visual feedback that reinforces the flight-school
instructions. Because it is optional, experienced pilots can hide it.

**Impact of deferral:** flight remains fully playable, but the lessons are less
self-explanatory and players may learn the wrong correction from camera motion.

**Recommended action:** treat it as the companion to #905. Validate both
together, but keep the implementation optional and presentation-only.

### P1 — Admit challenge demonstrations in a controlled sequence

Candidates: Warehouse [#894](https://github.com/mekhovov/revealline/pull/894),
Racing Stadium [#895](https://github.com/mekhovov/revealline/pull/895) and
Container Yard combat [#896](https://github.com/mekhovov/revealline/pull/896).

**Plain meaning:** provide watchable example flights for challenges so players
can learn a route, maneuver or combat response before flying it.

**Why it is needed:** written instructions explain goals but do not always show
timing, line choice or coordinated stick movement. Demonstrations help players
who are stuck after the beginner lessons.

**What it brings:** self-service learning and clearer expectations across 52
challenge examples. It also lays the replay foundation used by the later ghost
feature.

**Impact of deferral:** challenges remain playable and scoreable; players lose
the example path and may abandon harder levels. There is no core input loss.

**Recommended action:** land these after #905/#907, one coherent world group at
a time, with exact incremental byte cost and current-main checks recorded.
#894 and #868 currently need conflict resolution; #895/#896 are clean at this
checkpoint, but all must be rechecked after their base changes.

### P2 — Decide historical Team import compatibility

Candidate: draft [#868](https://github.com/mekhovov/revealline/pull/868);
decision tracking: [#824](https://github.com/mekhovov/revealline/issues/824).

**Plain meaning:** decide whether the game must import two exact old fpv38/fpv50
`.rlteam` formats, and separately retain a small correction to the Sentry
projectile-loss message.

**Why it is needed:** users who still possess those specific old files otherwise
cannot recover them through the current importer. The message correction benefits
ordinary play but does not require the compatibility package.

**What it brings:** preservation for two known historical formats and clearer
loss feedback. The optional old-theme package is 1,946,423 bytes.

**Impact of deferral:** current saves and current Team play continue to work.
Only owners of those two historical file formats lose import support; the
misleading projectile message remains.

**Recommended action:** split the small player-facing message fix from the old
import adapter. Ship the message fix after normal validation. Keep the importer
optional unless there is evidence of affected users. Resolve the stale revision
ledger and Pages overage before admitting the archive package.

### P2 — Choose a native desktop/iOS distribution scope

Tracking: [#865](https://github.com/mekhovov/revealline/issues/865).

**Plain meaning:** decide which parts of the almost 950 MB web inventory belong
inside an installed desktop/iOS player application.

**Why it is needed:** the recorded candidate contains 2,660 files totaling
**949,537,804 bytes**. Desktop and iOS staging share a **805,306,368-byte
(768 MiB)** limit, so staging stops **144,231,436 bytes** early. Source-level
HTML compatibility does not solve that capacity decision.

**What it brings:** a buildable installed application with a deliberate content
contract, predictable storage use and preserved licenses/manifests.

**Impact of deferral:** the browser/PWA experience can still ship on laptops and
mobile browsers, but a complete packaged desktop/iOS release cannot.

**Recommended action:** keep this P2 for a web-first strategy. Promote it to P0
only if an installable native app is the next release goal. Define “core in app”
versus “optional download” before changing the guard; then stage and hash-verify
the exact desktop and iOS inventories.

### P3 — Add the personal-best ghost

Candidate: [#913](https://github.com/mekhovov/revealline/pull/913), stacked on
#896 and currently outside the milestone.

**Plain meaning:** optionally draw a non-colliding replay of the player's best
verified run as a pacing reference during a new attempt.

**Why it is useful:** experienced players can compare lines and improve sector
times without changing physics, collision, rewards or proof generation.

**What it brings:** replay value and mastery feedback after the training and
demonstration foundation exists.

**Impact of deferral:** no setup, controller, radio, campaign or basic FPV
function is lost.

**Recommended action:** defer until #896 is accepted and the two local
package-count test mismatches are explained against current main. Give it a
milestone only after the release budget and onboarding work are stable.

### Deferred by the user — Broaden physical-device qualification

Already confirmed: two USB PS5 controllers; TX15 USB FPV flight/arm/reset; TX15
regular Solo right stick; shared TX15 Team movement.

Still unqualified physically: two radios; radio plus gamepad; identical-radio
assignment/reconnection; Bluetooth; controller dongles; mobile browsers; Steam
Deck; packaged desktop/iOS applications.

**Why it matters:** modeled Gamepad tests prove ownership and mapping logic, but
cannot prove that each operating system/browser exposes every real device in the
same way.

**Impact of deferral:** the implemented fallback and assignment behavior remain,
but support claims must stay limited to the verified combinations above.

**Recommendation:** keep deferred as requested. Resume with a small risk-based
matrix when hardware and native artifacts are available: mixed radio/gamepad
first, identical radios second, Bluetooth/dongle third, native platforms last.

### P3 — Close the remaining historical-source decisions

Tracking: [#824](https://github.com/mekhovov/revealline/issues/824).

**Plain meaning:** explicitly adopt or supersede old proposals for Enemy Catalog
focus/action wrapping and Still Media close/focus recovery, in addition to the
Team-import decision above.

**Why it is needed:** preserved local ideas should not remain indefinitely in an
ambiguous state where nobody knows whether they were replaced or forgotten.

**What it brings:** a clean source history and prevents useful narrow fixes from
being lost.

**Impact of deferral:** there is no known controller/radio release blocker, but
future audits keep rediscovering the same proposals and may accidentally replay
stale code.

**Recommended action:** close each checkbox with a current-main commit or written
supersession proof. Do not bulk-replay historical branches or generated output.

## Re-prioritization guide

| If the main goal is… | Promote | Defer |
| --- | --- | --- |
| Reach browser players safely | Web capacity and deferred verification; then #905/#907 | Native packaging, ghost and broad hardware matrix |
| Ship an installed desktop/iOS app next | Native scope/capacity and native runtime qualification to P0 | Demonstrations and ghost |
| Preserve old user files | #868 import compatibility to P1 after capacity correction | Ghost and some demonstration content |
| Serve expert pilots and competition | Demonstrations and #913 after verification | Historical imports unless demand exists |
| Minimize release risk | Only both P0 items, then publish a bounded candidate | All new content until the candidate is accepted |

The recommended default remains browser-first because the original controller
and radio goal is already usable there, while native packaging requires a
separate product decision and over 144 MB of scope reduction or a justified new
capacity policy.

## Evidence and completion rules

- User-confirmed physical observations are limited to the named scenarios.
- Historical source checks do not automatically qualify later merged code.
- A successful deployment of main `955c539a7` does not qualify the still-open
  v0.150.0 candidates.
- The current test waiver is recorded in
  [focused-test-waiver-20260930.md](focused-test-waiver-20260930.md). Deferred
  checks must be reported as `WAIVED_SKIPPED_NOT_PASSED`.
- The recorded native attempt, inventory and hashes remain attached to
  [native-capacity issue #865](https://github.com/mekhovov/revealline/issues/865).
- Mark the selected release scope complete only after its exact artifact is
  accepted. Retain explicit platform exclusions and user-deferred checks.
