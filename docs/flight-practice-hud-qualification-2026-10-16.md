# Flight practice: reachable HUD guidance and honest exercise qualification

Hosting remains deferred. This continues the six
[full-source-shell directory journeys](flight-practice-directory-journey-2026-10-15.md).
The repaired feature is existing FPV HUD guidance settings, not new simulator
mechanics, training content, physics or rendering.

## Fixed and observed

Both Academy and Worlds created their existing guidance preferences in old
wrappers but omitted the section when moving controls into Settings categories.
Academy's leftover wrapper was then hidden; Worlds likewise left the controls
outside its accessible settings panels. Two mounted-host regressions failed
before the fix. The repair moves each existing section into Accessibility with
one expression per host. It neither duplicates controls nor changes their
preference storage, listeners or flight behavior. Both regressions then pass.

In either FPV app, open **Settings → Accessibility → Flight guidance**. Select
**Guidance → Detailed** for numeric objective readings; **Text size** and **HUD
contrast** are independent choices. Ukrainian: **Налаштування → Доступність →
Підказки польоту**, then **Підказки → Докладні**. Preferences survive normal
reload; they do not arm, start or stabilize a flight. EN/UK repository guides and
all three shipped HTML guides now explain the route, with a matching-copy test.

The [original four-case receipt](flight-practice-hud-qualification-20261016/hud-settings-completed.json)
and [complete archive](flight-practice-hud-qualification-20261016/hud-settings-artifacts.tgz)
retain actual EN/UK Academy/Worlds browser observations in Chrome
`155.0.8059.80`. All four cases pass:

- Normal stable launcher and site access, then visible Accessibility controls.
- Detailed, Large and High contrast selected through native controls.
- Ordinary reload retains all three values and leaves the app unarmed.
- Only deliberate Start activates flight; the maintained Detailed HUD visibly
  shows `Height 0 m · 1.2–2.4 m` or `Висота 0 м · 1,2–2,4 м`.
- Ordinary Pause works. No page errors; owned browser/server/site cleanup passes.

This verifies settings retention and a visible **stationary** HUD, not motion,
exercise completion, physical input, accessibility, offline or hosting acceptance.
`qualified` stays false. Independent read-only review re-admitted the candidate,
checked all 283 staged pins, eight authority pins, eight screenshot pins and
individual/aggregate cases, and inspected native screenshots.

## Exact candidate boundary

Native HUD checks and the failed probe below use source
`6b420b1a2ffd65823fd7923b60411061e68d53d5`, tree
`b824ae25335babb3149cc808bce1bc7f1a4f21e3`, at
`/Volumes/alex/CodexMigrationStaging/flight-practice-hud-20261016-candidate`.
The [original envelope](flight-practice-hud-qualification-20261016/hud-candidate-envelope.json)
SHA-256 is `edad60bdf2f937b68d1997dc5ddd6056c3e512084e8c3ff466de77757e768398`.
The [build receipt](flight-practice-hud-qualification-20261016/hud-candidate-verification.json)
records two reproducible builds, committed inputs and original runtime/source
archive-member admission for all three apps: 94 / 101 / 162 files.
`publicEligible` stays false; `v0.151.1` is still a development candidate, not a
newly allocated public release.

Compared with the earlier `8cf5fe46d` candidate, all 87 Gym inputs are unchanged;
Academy's 94 inputs differ only in `app.mjs`, and Worlds' 155 only in
`world-app.mjs`, the two navigation expressions. No dependencies were added or
removed. The later bilingual guide additions at `6537c541f` are **not** inside
this native-tested candidate. Reproduce/admit the final guide-inclusive source
separately; do not relabel older browser receipts as that candidate's evidence.

The final guide-inclusive all-three bundle has now also passed two reproducible
builds, committed-input verification and original runtime/source archive admission.
It is frozen at `80a32d6a9014cd78f326b2d7685fbbbdf2b6b06c`, tree
`b4de309b044638ecb7460f8f8cb69b25af970301`, at
`/Volumes/alex/CodexMigrationStaging/flight-practice-hud-guides-all-three-20261016-candidate`.
Its [envelope](flight-practice-hud-qualification-20261016/final-guide-envelope.json)
SHA-256 is `f59ed9eb8d6b934edf1256efdbf849e1270a2d6a2119b9437306176acc9dd6d9`;
the [original receipt](flight-practice-hud-qualification-20261016/final-guide-verification.json)
retains 94 / 101 / 162 admitted files and `publicEligible: false`. Against the
native-tested candidate, each app's explicit input set differs only in its own
`guide.html`; no input was added or removed. This is artifact evidence, not a
fresh native browser or complete-build/hosting qualification.

An earlier guide-bundle attempt was rejected by the existing clean-source guard
after evidence files were added. Its log is retained. The successful build ran
after committing that evidence; the guard was not weakened. A separate default
Gym-only bundle is not used as all-three evidence. All immutable outputs remain
on the external drive; earlier candidates were not overwritten.

## Correction to historical movement claims

The historical ten-case player-flow observer read old FPV telemetry nodes using
`innerText` without verifying display visibility. The maintained SIM HUD hides
those containers. Their genuine native launch/mode/pause/retry and DOM-state
observations remain evidence, but they do not establish player-visible FPV
measurements. The [earlier report](flight-practice-player-flow-2026-10-15.md), plan
and checklist now explicitly narrow that claim; original receipts are untouched.
Gym movement/exercise evidence and the six directory/start/guide journeys are
unaffected. New observers require visible maintained HUD measurements instead.

## FPV exercise observer: implemented, native completion not yet accepted

The new strict protocols separately register one EN Academy Self-level probe and
the full eight EN/UK Academy/Worlds × Self-level/Acro cases. Each uses native
`flight-01` Lift and land, ordinary W/S/Shift input and a fresh context. The plan
cannot supply arbitrary callbacks, scripts, extra cases or alternate dependencies.
Case/overall limits remain 90 seconds / ten minutes.

The controller reads visible Detailed height/target bands and displayed throttle
(Academy stick position, Worlds percentage). A native throttle gauge plus
“Lower throttle fully” instruction is an explicit semantic soft-touchdown witness,
not fabricated zero height. A later visible zero-height/low-throttle reading and
native terminal completion are also required. Course/mode DOM identity metadata
may be hidden; it is never presented as a visible controller measurement.

A passing case additionally requires no helper error, successful owned-key
cleanup, a completion screenshot, the **actual** Notebook/Data backup exported
through normal UI, and independent replay against the exact admitted native
course/model. The verifier pins a fixed 24/25-file dependency closure, validates
the JSON-only locale projection and production recording/archive formats, and
runs copied bytes in a fresh ten-second, bounded Node child without inherited
environment. It checks course, mode, practice session, completed two-step outcome,
ground position and the actual export hash. Unit fixtures are synthetic tests,
never browser or human evidence. Releasing keys retains throttle, so a failed
case must close or safely pause its owned isolated context.

### Original probe failure and correction

The [unaltered first probe](flight-practice-hud-qualification-20261016/fpv-probe-failed.json)
and [complete archive](flight-practice-hud-qualification-20261016/fpv-probe-failed-artifacts.tgz)
remain **failed**. At the unchanged 90-second case limit, 844 visible readings
still show height zero and step zero; the controller settled at 54.6% throttle.
There was no native completion or actual export/replay. Input release and all
owned browser/server/site cleanup succeeded; no page errors occurred.

Root cause: although upright mathematical hover is 50%, the fixed-step model
rounds displacement and resets velocity when the next ground height is zero.
54.6% from rest produces roughly 18 mm/s for that tick, whose rounded displacement
is zero, so it never leaves the ground. A synthetic model/keyboard regression
reproduced this and failed with the original feedback. Prototype v3 now commands
60% for initial ground clearance until visible height reaches 0.1 m, then uses
the existing bounded feedback. The regression clears 0.2 m in both modes. This
changes **only the test controller**, not SIM physics. Pre-aborted Worlds export
also now rejects before its first navigation.

### Corrected probe: native completion, export and cleanup still failed

After free space recovered to about 1.7 GiB, one corrected probe ran with browser
and staging files on the external drive, using the final guide-inclusive `80a32d6a9`
candidate. Its [original receipt](flight-practice-hud-qualification-20261016/corrected-probe/failed.json)
and [complete archive](flight-practice-hud-qualification-20261016/corrected-probe/complete-artifacts.tgz)
retain a genuine native lift-and-land completion at 13.353 seconds, 129 visible
readings and successful key release. The [actual completion screenshot](flight-practice-hud-qualification-20261016/corrected-probe/native-completion.png)
is retained separately: 535879 bytes, SHA-256
`09c21e3370376cc1eb525ee285aca177803613ad9e66951db867a25895169f77`.

The aggregate is still **failed**. After a pointer activation of result Home,
Settings remained hidden and export timed out; no actual backup or independent
replay exists. Source and screenshots strongly support a first-pointer layout
mechanism: pointer-down cancels the celebration, hiding a flex item and moving
Home before release. There is no recorded down/up event trace, so this is not
claimed as fully instrumented causal proof or a fixed pointer path. C3 remains open.

This run also records **browser cleanup timed out**, `cleanup.completed: false`,
and retains its staged site. The wrapper's final empty-directory removal therefore
failed too. A later read-only process check found that owned browser PID had
exited and its disposable profile was gone; the staged site remains preserved.
That follow-up does not convert the original failed cleanup into a pass.

A separate keyboard export route is now prepared: wait for the ordinary visible,
enabled button and press Enter, including result Home. Unit tests reject hidden,
disabled, pre-aborted and pointer-only activation. The observer now keeps a separate
completion-screenshot pin even if a later failure capture replaces the main
screenshot field. Neither change rewrites original receipts. The keyboard route,
actual export/replay, clean native cleanup and complete eight-case matrix still
require a fresh native run; no further browser attempt was made in this continuation.

## Verification and next gates

Retained logs: 353 practice passes on the repaired hosts, 90 host-UI passes, 99
observer passes including corrected feedback/export/replay tests, then 100
latest observer passes including the separate keyboard route and mid-action
cancellation regression, and three
bilingual guide-copy passes. These suites overlap; do not sum them as independent
tests. The practice/host suites predate the final guide text; the guide-specific
suite covers that addition. Lint, formatting and whitespace checks pass for the
changed files. Failed before-fix regression logs are retained alongside passes.

Native batches were initially paused when local free disk dropped below 1 GiB
(about 0.8 GiB after the first cleanup). After recovery to 1.7 GiB the single
corrected external-profile attempt above was allowed; it failed export/cleanup.
No user files, profiles, previous candidates or failed outputs were deleted.
Keep a safe local margin and external build outputs for subsequent native work.

Recommended order remains:

1. Verify the prepared keyboard export route, genuine proof replay and clean
   native shutdown, then all eight cases. Repair/verify the first-pointer result
   target separately; keyboard export does not close C3.
   moving visible-HUD pause/retry, positive appearance handoff and complete-build
   directory checks still need their own evidence.
2. Remaining Gym/Worlds pointer cases, populated-data offline process restart,
   genuine distinct-version active-session update/rollback, cancellation/timeouts
   and eviction recovery. Historical or same-payload fixtures do not close these.
3. Named moving-performance/device/assistive checks, real novice and maintainer
   walkthroughs, and actual content/license/review decisions. Never synthesize
   human reviewers or mark required approvals from automated unit tests.

Hosting and public selector changes remain deferred at the user's request. The
[acceptance checklist](flight-practice-release-checklist-2026-10-15.md) remains open;
this is not full Phase 1 completion.
