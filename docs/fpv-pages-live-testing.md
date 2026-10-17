# FPV rates and Advanced practice: Pages testing

The rolling main publication hosts Academy and World directly at:

- `/revealline/optional-practice/civilian-fpv/index.html`
- `/revealline/optional-practice/fpv-worlds/index.html`

`game/build-config.json` includes the rates, tuning, import, Advanced worker,
Rapier and browser export dependencies. `game-cli.mjs` produces separate opt-in
offline workers from the final bundled bytes. The core offline boot does not
automatically download the simulator bodies.

The optional release selector is currently empty. That affects the separate
`/revealline/practice/<id>/app/` installation channel; it does not prevent the
direct SIM routes above from updating when the reviewed source reaches `main`.
No optional-package selector change or optional-package release/promotion is
needed for direct-route live testing. The repository's existing main-branch
review and product-release policies still apply.

## Input recovery correction — 17 October 2026

[PR #1565](https://github.com/mekhovov/revealline/pull/1565) preserves Advanced
practice when the selected radio is unavailable. It also restricts new startup
request/capture error metadata to fixed categories. Local acceptance passes 741 practice
tests, English/Ukrainian real browser-worker checks, actual Electron export and
resume, and release validation. Ordinary publication is in progress; the public
site is not yet claimed to contain this correction.

After that publication, the manual check requires no physical radio:

1. Open either SIM route, unlock normally, then open Settings → Controls →
   Rates & throttle → Advanced reference quad.
2. Start a short keyboard practice flight and pause. Keep throttle low.
3. Choose Calibrated radio with no radio connected and press Start practice.
   The pane should explain that input is unavailable while Export practice
   recording and Restart practice remain available.
4. Choose Keyboard / touch. The flight stays paused until Start practice is
   pressed. It then continues the same recording; Restart practice starts a new
   flight. Export and return to tuning to finish.

The [review](fpv-tuning-input-recovery-review.md) records exact scope. The new
public runner captures bounded startup state and request paths if readiness
fails; the previous startup timeout remains unexplained. Neither simulated input
loss nor this no-radio check qualifies physical controller hardware. Advanced
remains optional and unscored.

## Boundary correction publication — 17 October 2026

[PR #1564](https://github.com/mekhovov/revealline/pull/1564) preserves restored
profile history against stale imports, matches preset boolean review metadata,
and keeps Regional recording/recovery export available at flight limits.
All 12 non-skipped product checks passed for `dcad53bc6`; the general test/build
jobs were explicitly skipped. The ordinary controller merged the correction as
`fb3caf12bd43743670f47c42dc21f7a406223379`. Every source pin in the local correction
receipt is unchanged at that merge.

The normal [Pages publication](https://github.com/mekhovov/revealline/actions/runs/39038793037)
passed build, deploy and verification. The
[final public acceptance](fpv-boundary-public-final-acceptance.json) passes both
fresh installations: ordinary password entry, saved 900°/s rates, visible offline
preparation and a new browser process reopened offline. Academy's 11-tick record
verifies hash `13902221`; World's 12-tick record verifies `1d473fbb`. Both workers
are disposed. Public source bindings and the runner remained stable. Credentials
are absent from reports.

The first World attempt timed out waiting for startup after password submission.
Its [failed report](fpv-boundary-public-acceptance.json) is preserved. Reopening
the same profile without cache clearing or unlock changes succeeded; the full
fresh rerun also passed. The cause is not established, and this observation is
retained alongside the passing run.

The [delivery receipt](fpv-boundary-delivery-verification.json) binds the deployed
revision to hosted archive evidence, public sources, browser acceptance and the
native fixture. The staged site contains 3,425 files and 960,384,263 bytes; its
actual uncompressed archive is 963,368,960 bytes, leaving 16,631,040 bytes below
the unchanged 980,000,000-byte cap. The separate optional catalogue is present and
empty. Earlier reports below retain their original source and test scope.

The [local boundary review](fpv-tuning-boundary-review.md) records 731 passing
practice tests, six editor browser cases, actual 720-second Regional worker
export/replay/recovery/restart and an actual Electron fixture with exact library
retention. The latter checks short Regional export/recovery, not a native
12-minute run. Physical devices, pilot feedback, aircraft measurements, iOS and
wider-platform qualification remain deferred; Advanced is optional and unscored.

## Follow-up publication — 17 October 2026

[PR #1562](https://github.com/mekhovov/revealline/pull/1562) delivers atomic drone
duplication, case-insensitive preset-option matching and export/reference/restart
after genuine Advanced flight limits. All 12 non-skipped product checks pass on
`2af1ee906`; general test/build jobs were explicitly skipped. The normal controller
merged it as `80494f63db57be3e44586d8271c70c3e7a3cb403`, and the ordinary
[Pages publication](https://github.com/mekhovov/revealline/actions/runs/39002032297)
passed build, deploy and verification. A concurrent authoring-page display fix
changes no source pinned by FPV qualification.

The [current public acceptance](fpv-post-publication-public-acceptance.json)
passes Academy and World in fresh isolated Chrome profiles. Both start locked,
accept the normal password form, save 900°/s Actual rates and install offline
through visible controls. New browser processes reopened offline retain those
rates and run Advanced reference practice. Academy exports 12 ticks with hash
`1d473fbb`; World exports 11 ticks with hash `13902221`. Each recording replays
exactly and returning to tuning disposes its worker. Public metadata, manifest,
source pins and runner remain unchanged during acceptance. Credentials are
excluded from reports. These short neutral-input flights verify lifecycle, not
physical fidelity or performance; the different tick counts are recorded as such.

The [current desktop fixture check](fpv-native-post-publication-runtime.json)
separately verifies actual Electron UI, OS recording saves, exact library
retention across process reopen, two successful replays and complete worker
disposal. The fixture is explicitly labelled and retains locked production pages;
it does not qualify native production authentication, iOS or a signed installer.

The [final delivery verification](fpv-post-publication-delivery-verification.json)
pins these receipts and all hosted artifacts. The staged site contains 3,442 files
and 963,685,141 bytes; the actual uploaded archive is 966,676,480 bytes, leaving
13,323,520 bytes below the unchanged 980,000,000-byte cap. The optional catalogue
is present and empty. No manual merge/deploy, forced worker activation or gate
bypass was used. Current public acceptance covers fresh installations; the
authentic installed-update evidence below retains its original source scope.
Advanced remains optional, unscored and default-ineligible, with physical and
wider-platform qualification deferred.

## Original public publication — 17 October 2026

[PR #1561](https://github.com/mekhovov/revealline/pull/1561) delivered implementation
`eaecd60562917b7cf47d4995af00d561b154debd`. After its 12 non-skipped product
checks passed, the ordinary repository controller merged it as
`b2f251dac0d762d476f725b1bc601a2d6d5485a5`. The normal
[Pages run](https://github.com/mekhovov/revealline/actions/runs/38997742653)
passed build, deploy and verification; the public metadata reports that exact
merge. The two general CI test/build jobs were skipped, not counted as passes.

The retained [publication receipts](fpv-public-delivery-artifacts/delivery-summary.json)
verify 3,442 staged files / 963,681,552 bytes and an actual uploaded archive of
966,676,480 bytes. Archive headroom is 13,323,520 bytes below the unchanged
980,000,000-byte limit. The optional catalogue exists with no selected releases;
its empty check does not qualify separately published optional packages. These
receipts cover the main site's integrated SIM routes.

The [fresh password check](fpv-public-fresh-password-acceptance.json) passes the
normal access form and Rates & throttle editor on both live routes in separate
Chrome contexts. Each context initially remains locked. The exact
[historical runner](fpv-public-delivery-artifacts/fresh-password-runner.mjs.txt)
and [provenance](fpv-public-delivery-artifacts/fresh-password-provenance.json)
are retained without credentials. This check alone makes no offline-install or
flight claim.

The separate [fresh-install check](fpv-public-fresh-install-acceptance.json)
passes on both routes. In a new persistent profile it unlocks normally, creates
and saves a 900°/s Actual profile through visible controls, then uses the visible
offline installer. A complete browser-process restart with networking disabled
loads from the expected installed worker and retains the saved rates. Advanced
reference practice starts offline, exports a 12-tick unscored recording, replays
exactly with hash `1d473fbb`, and releases its worker on return to tuning.
Both recordings are retained. Public metadata, manifest, source pins and runner
remain unchanged during the check. These short neutral-input flights establish
loading/export/replay behavior, not flight fidelity or performance.

The repeatable fresh-install runner accepts `HTTPS_ROOT EXPECTED_SHA REPORT.json
PLAYWRIGHT_MODULE` after `node scripts/smoke-fpv-public-fresh-install.mjs`.
Supply `FPV_LIVE_TEST_PASSWORD` transiently; the runner removes it from the
browser subprocess environment and excludes it from reports. Existing-install
update acceptance uses the separate two-stage runner and preserved old profiles.

The [public existing-install check](fpv-public-delivery-acceptance.json) passes
both genuine old-main installations from `8b0199194` to deployed `b2f251dac`.
The old worker continues controlling the page while the new worker waits;
closing the scoped page permits natural activation. No forced activation or
cache clearing is used. Restarting the browser offline retains Legacy response,
synthetic/unverified radio settings, 27° tilt and 108° vertical FOV. Production
library APIs verify named profile creation and backup/restore; the visible CLI
editor saves an 880°/s patch while the saved 900°/s profile remains unchanged.
The preview draft is retained when returning to that profile; explicit Revert
restores the saved 900°/s value without changing the saved library. The subsequent
offline Advanced recording uses 900°/s, replays exactly and disposes its worker.
The 12-tick recordings have hash `1d473fbb` and remain unscored.

Upgrade provenance and failed attempts remain explicit:

- The profiles used for this update originated in the [first public baseline](fpv-public-delivery-baseline-runner-change-failure.json).
  Both per-package password/installation checks completed, but a concurrent
  formatting change made that report's whole-run runner-stability check fail.
  It remains a failed report. The separate frozen [baseline run](fpv-public-delivery-baseline.json)
  passed, but its profiles were not substituted for this final update.
- An initial complete attempt using the separate frozen-baseline profiles hit an [asynchronous-wait harness defect](fpv-public-delivery-waiting-worker-failure.json).
  A [separate reproduction](fpv-public-delivery-wait-harness-diagnostic.json)
  showed that the installed browser wrapper returned immediately for async wait
  predicates. Cleanup then activated its Academy worker without the intended
  observation checkpoint. Those profiles remain diagnostic evidence; final
  acceptance uses the original profiles from the first baseline described above.
  Explicit bounded async polling replaced the defective waits.
- A [JSON ordering failure](fpv-public-delivery-legacy-order-failure.json)
  was independently diagnosed as [deeply equal data](fpv-public-delivery-legacy-comparison-diagnostic.json).
  Exact canonical-data comparison retains every value and array order.
- The [880°/s recording failure](fpv-public-delivery-draft-preview-failure.json)
  came from deliberately retained preview drafts, as confirmed by the
  [saved-library diagnostic](fpv-public-delivery-draft-preview-diagnostic.json).
  The probe now explicitly reverts before flying saved rates. A subsequent
  [selector failure](fpv-public-delivery-profile-selector-failure.json) was fixed
  by waiting on the actual labeled control instead of assuming an HTML ID.

The [input state](fpv-public-delivery-artifacts/update-state-before-acceptance.json)
matches the final report's preparation-state hash. Academy's previously observed
natural activation is explicitly resumed; World's activation is observed in the
final run. The [final state](fpv-public-delivery-artifacts/update-state-after-acceptance.json)
retains both activation checkpoints. Runtime sources and public deployment
remained unchanged throughout these harness corrections. The
[combined verification](fpv-public-delivery-verification.json) binds the final
reports, source hashes and retained recordings.

All live checks use disposable browser profiles on one desktop. Physical radios,
touch hardware, pilot feedback, identified-aircraft measurements, iOS runtime,
wider-device qualification and Advanced promotion remain deferred. Advanced
stays optional, unscored and default-ineligible.

## Local generated-output check

Use the Pages workflow's Node **22.22.2**. Build into a new directory with enough
space for both the expanded site and its download ZIP. The complete build is
large; do not delete other work to make room. Use a canonical output parent:
on macOS, `/tmp` is a symlink, so an absolute `/private/tmp/...` path satisfies
the normal builder's no-symlink staging rule.

```sh
node scripts/game-cli.mjs build --out NEW_SITE --publication-profile main-pages
node scripts/smoke-fpv-pages.mjs NEW_SITE PLAYWRIGHT_MODULE REPORT.json
```

The [current delivery check](fpv-pages-delivery-live-testing-evidence.json) passes
against the normal production build at
`/private/tmp/fpv-rates-delivery-20261017-pages`, version `0.151.1`. It includes the
historical camera migration fix and the measured dense Regional collider bound.
Academy and World pass online and offline with saved rates, Advanced practice,
export, restart and complete worker disposal. The [inventory check](fpv-pages-delivery-inventory.json)
verifies all 3,433 manifest entries, the download ZIP checksum and all five changed
runtime modules against this checkout.

The publication contains 3,435 files / 963,673,325 bytes. Its conservative archive
forecast is 972,296,192 bytes, leaving 7,703,808 bytes below the unchanged cap.
The distribution ZIP digest is
`f790928a38f0cf61c20b49ab3e7b18628180eba7de61a099174046aeeeaff4f4`.
This local working-tree build has `sourceRevision: null`; the exact committed
main publication and public upgrade acceptance are still checked separately.
The [public baseline](fpv-public-delivery-baseline.json) verifies the normal
password form and visible offline installation on old-main revision `8b0199194`
for both SIMs. Its disposable saved browser profiles are retained for exact
post-deployment update acceptance. The initial runner-change failure is retained;
the frozen final runner passes. No password is included in the evidence.

The [genuine historical upgrade](fpv-historical-update-qualification.md) and
[current Electron runtime](fpv-native-current-runtime-20261017.json) provide
additional, explicitly scoped migration and native evidence.

The [historical seventh-review check](fpv-pages-seventh-review-live-testing-evidence.json)
passes against the normal production build at
`/private/tmp/fpv-rates-seventh-review-20261017-pages`, version `0.151.1`, after
rebasing onto `8b0199194` and protecting numeric edits from late import previews.
Academy and World pass online and in isolated offline contexts, including saved
rates, keyboard installer activation, Advanced start/restart/export and worker
disposal. All 3,433 manifest entries and the archive checksum verify; the changed
tuning module matches current source. Served bytes and the runner remain stable.

The publication contains 3,435 files / 963,672,685 bytes. Its conservative archive
forecast is 972,295,168 bytes, leaving 7,704,832 bytes below the unchanged cap.
The distribution ZIP digest is
`5b5575dae69c19b9b279761acfc72b04ea22a8d10e6356590b018e848859fcd6`.
This is a local working-tree build (`sourceRevision: null`), ready for the normal
reviewed integration process. The separate two-revision update check below covers
local generated packages. Public HTTPS, the real password form, historical-version
updates and exact committed publication remain separate gates. No deployment was
performed.

The seventh temporary build was removed only after matching its recorded manifest
and ZIP checksums, to make room for the current build. Its receipts are retained.

The [historical sixth-review check](fpv-pages-sixth-review-live-testing-evidence.json)
passes against the normal production build at
`/private/tmp/fpv-rates-sixth-review-20261017-pages`, version `0.151.1`, after the
rebase onto `b133a5ec8` and the incomplete-numeric-draft correction. Academy and
World pass online and in isolated offline contexts, including saved rates,
keyboard installer activation, Advanced start/restart/export and worker disposal.
All 3,433 manifest entries and the archive checksum verify, and the changed tuning
module matches the checkout. Served bytes and the test runner remain unchanged.

The publication contains 3,435 files / 963,654,909 bytes. Its conservative archive
forecast is 972,277,248 bytes, leaving 7,722,752 bytes below the unchanged cap.
The distribution ZIP digest is
`8d5b156be7634546cc452880c39d21858f51e17057e7a046bb09e23c16ca11d7`.
This remains a local working-tree build (`sourceRevision: null`), ready for normal
reviewed integration. Public HTTPS, the real password form and existing-install
update checks remain separate; this review does not publish Pages.
Its superseded temporary output was removed only after verifying the recorded
manifest and ZIP digests, to make room for the seventh-review build. The
repository receipts remain unchanged.

The [historical fifth-review check](fpv-pages-fifth-review-live-testing-evidence.json)
passes against the normal production build at
`/private/tmp/fpv-rates-fifth-review-20261016-pages`, version `0.151.1`, after the
rebase onto `0597edff7` and the firmware-header/pending-save corrections. Academy
and World pass online and in isolated offline contexts, including saved rates,
keyboard installer activation, Advanced start/restart/export and worker disposal.
All 3,433 manifest entries and the archive checksum verify; both changed runtime
modules match the checkout byte-for-byte. Served bytes and the test runner remain
unchanged during the check.

The publication contains 3,435 files / 963,654,068 bytes. Its conservative archive
forecast is 972,276,736 bytes, leaving 7,723,264 bytes below the unchanged cap.
The distribution ZIP digest is
`1aefe089097d5ae21bd14c57c43faa16674466301e5306fd6aa8761dea84b4e2`.
This is a local working-tree build (`sourceRevision: null`), ready for the normal
reviewed main publication process. No public deployment, real-password or
existing-install update claim follows from this local remembered-unlock fixture.

The [historical fourth-review check](fpv-pages-fourth-review-live-testing-evidence.json)
passes against the normal production build at
`/private/tmp/fpv-rates-fourth-review-20261016-pages`, version `0.151.1`, after the
rebase onto `1cdf442dc` and the preset/calibration corrections. Academy and World
pass online and in isolated offline contexts, including saved rates, keyboard
installer activation, Advanced start/restart/export and complete worker disposal.
All 3,433 manifest entries and the archive checksum verify. The seven changed FPV
runtime/shared-install modules, including the rebased host changes, match the
checkout byte-for-byte. Build-only worker inputs are validated separately; the
normal builder emits manifest-specific workers checked by the offline tests.

The publication contains 3,435 files / 963,653,304 bytes. Its conservative archive
forecast is 972,276,224 bytes, leaving 7,723,776 bytes below the unchanged cap.
The distribution ZIP digest is
`1aee5b1fb08f0966c8db39ded19b245aee7ec5babcf68f36f5984e86e293de5d`.
This remains a local working-tree build (`sourceRevision: null`), ready for the
normal reviewed main publication process. Public HTTPS, the real password form
and existing-install updates remain separate checks; no deployment was performed.

The [historical third-review check](fpv-pages-third-review-live-testing-evidence.json)
passes against the normal production build at
`/private/tmp/fpv-rates-third-review-20261016-pages`, version `0.151.1`, after the
rebase onto `20768f599` and the camera/replay validation fixes. Academy and World
pass online and in isolated offline contexts, including saved rates, keyboard
installer activation, Advanced start/restart/export and worker disposal.
All 3,432 manifest entries and the archive checksum verify; both changed runtime
modules match the checkout byte-for-byte. Generated/served bytes and the test
runner remain unchanged during the check.

The publication contains 3,434 files / 963,638,027 bytes. Its conservative archive
forecast is 972,258,816 bytes, leaving 7,741,184 bytes below the unchanged cap.
The distribution ZIP digest is
`d775830b75a1376dec66d73f4be36566caae09f41c1958a916461ff4f83d4ba7`.
This is a local working-tree build (`sourceRevision: null`), ready for the normal
reviewed main publication process. Public HTTPS, the real password form and
existing-install updates remain separate checks; no deployment was performed.
Its superseded temporary output was removed only after checking its recorded
manifest and ZIP digests, to make room for the fourth-review build. The repository
receipts remain unchanged.

The [historical second-review check](fpv-pages-second-review-live-testing-evidence.json)
passes against the unmodified normal production build at
`/private/tmp/fpv-rates-second-review-20261016-pages`, version `0.151.1`. Academy
and World both pass online and in isolated offline contexts, including saved
rates, keyboard installer activation, Advanced start/restart/export and worker
disposal. All 3,430 manifest entries and the ZIP checksum were verified, and all
seven changed runtime modules match the checkout byte-for-byte.

The publication contains 3,432 files / 963,612,018 bytes. Its conservative archive
forecast is 972,226,560 bytes, leaving 7,773,440 bytes below the unchanged cap.
The distribution ZIP digest is
`899acc0d0311d450d8c82cc1c45044cb1d457dc5a9eb1f1c66515f10b950d6a4`.
The local working-tree build has `sourceRevision: null`; exact committed CI
publication, public HTTPS, the real password form and existing-install updates
remain separate checks. No Pages deployment was performed.
Its superseded temporary output was removed only after verifying its recorded
manifest and archive digests, to make room for the third-review build. The
repository evidence remains unchanged.

The [first continuation check](fpv-pages-continuation-live-testing-evidence.json)
used a successful, unmodified normal CLI build at
`/private/tmp/fpv-rates-completion-20261016-pages`, version `0.151.1`. Both packages
pass online and in isolated offline contexts, including saved rates, keyboard
installer activation, Advanced start/restart/export and worker disposal. The
site has 3,432 publication files / 963,601,242 bytes; its conservative archive
forecast is 972,215,808 bytes, leaving 7,784,192 bytes below the unchanged cap.
The distribution ZIP digest is
`74dc9e80f48a9b517860e6d606fb8a33db8524780b4c535f3babf0398506c59f`.
This was a local working-tree build, not a deployed or committed CI artifact.
Its superseded temporary output was removed after checking its recorded manifest
and ZIP digests to make room for the second-review build. The original receipts
remain unchanged.

The first continuation build rejected the `/tmp` symlink before staging; using
the canonical parent completed normally. The first browser check then found an
outdated test locator expecting diagnostics to begin with “Raw input” instead of
the new “Input source” heading. Its [failure report](fpv-pages-continuation-selector-failure.json)
is preserved. Updating only the locator and explicitly checking the raw-input
field produced the passing run against the same unchanged generated site. No
runtime or gate was altered to obtain that pass.

The earlier [baseline evidence](fpv-pages-live-testing-evidence.json) used the unchanged production
`prepareBuildProject` and `writeBuildEntry` functions. The normal CLI run was
stopped during slow serial staging on a network volume. An equivalent local
harness staged the exact prepared entries with bounded concurrency, omitting
only the download ZIP and checksum that the Pages workflow discards. After the
host and worker-scope fixes described below, production preparation ran again,
changed entries were replaced, and **every staged file** was rehashed. The final
preparation's source guard rejected a concurrent admission-only policy update
(World's file-count limit changed from 179 to 180 for its worker bootstrap).
A fresh-policy check proved that all other policy values were unchanged,
regenerated both bundled offline workers byte-for-byte, and rehashed every
published file. The report preserves the rejected attempt and the explicit
equivalence receipt; it does not claim unchanged preparation sources, a completed
normal CLI run, or public deployment. Native standalone metadata was rebuilt
separately because that format does include the admission limits.

The second command uses an installed Playwright module and Chrome. It serves only
the generated manifest-checked files under `/revealline/`, checks that a fresh
browser remains locked, then uses a disposable remembered-unlock fixture. It
does not edit the access gate or claim verification of the real password. It
checks saved 900°/s Actual roll rates, the real Advanced module worker, restart,
a nonempty unscored recording export, worker disposal, and reloading both
simulators and re-entering Advanced practice with the browser offline after
verified package preparation. Each simulator uses an isolated browser context so the other's
offline cache cannot supply missing files. This does not test browser-process
restart or storage eviction.

The current probe navigates to each visible installer: Academy Settings → Help &
Extras → Help → Workshop & offline, and World Settings → Content & Offline.
It traverses keyboard focus to the enabled installation button, activates it with
Enter/Space, and checks the trusted activation, accessible name and visible
completion status. Screen-reader behavior, browser application-install prompts
and the real password form remain separate checks. The earlier baseline probe
called the production installation API directly and did not establish this UI
behavior.
The probe records every served file's manifest hash and rechecks those bytes at
the end. A local working-tree build deliberately has no committed source
revision; the final committed CI artifact remains a separate check.

The main game's shared-tools extension is intentionally outside these optional
offline packages. The probe allows only that exact offline request/error, once
per isolated simulator, and checks the explicit “SIM tools remain available”
fallback. All other failed requests and console errors fail the check.

The full generated host exposed a pointer bug: clearing a menu hint shortened
the tuning dialog by 42 pixels between pointer down and pointer up, moving Save
away from the pointer. Academy and World preserve the hint while a dialog is open. The latest-main
rebase retains its broader protection and HUD accessibility grouping. The original failure is retained in
[`fpv-pages-pointer-investigation.json`](fpv-pages-pointer-investigation.json);
the final probe repeats the same physical Save and Advanced clicks and records
their geometry in
[`fpv-pages-live-testing-evidence.json`](fpv-pages-live-testing-evidence.json).

The isolated World offline check also found that its initial Advanced worker
request escaped World's service-worker scope. World now supplies an explicit
same-scope bootstrap, which imports the shared simulation implementation. Arena
restart and Regional recovery retain that URL. The original failure is recorded
in [`fpv-pages-offline-worker-investigation.json`](fpv-pages-offline-worker-investigation.json).
The final probe checks the actual worker URL before and after restart, online
and offline, for both packages.

Capacity evidence is a conservative local forecast. The unchanged production
workflow independently checks the final staged inventory and the actual
uploaded tar archive against **980,000,000 bytes**. Its optional overlay, rolling
metadata and exact committed build must pass those gates; local browser success
does not waive them.

## Local existing-install update and browser restart

Run the focused package check without building two complete Pages sites:

```sh
node scripts/smoke-fpv-offline-update.mjs PLAYWRIGHT_MODULE REPORT.json
```

The [seventh-review update evidence](fpv-offline-update-seventh-review.json)
passes for Academy and World in Chrome. The normal optional-package builder
creates two revisions; the earlier fixture differs only by an inert stylesheet
comment. The test uses the real generated service workers, a disposable
persistent browser profile, the normal tuning-library API, the visible Advanced
practice controls, and actual recording exports. It preserves the production
access gate and uses the same remembered-unlock fixture as the separate Pages
probe after checking that a fresh profile is locked.

For both packages, the new worker reaches **installed / waiting** while the old
worker continues controlling an open, paused flight. Saving 900°/s rates for the
next flight leaves the active 800°/s recording byte-for-byte unchanged. Only
closing every page in the simulator's scope permits natural activation. The
probe neither sends `skipWaiting` nor clears caches or saved data; both revision
caches remain present. It then closes the entire browser process and relaunches
the same profile with networking disabled. The current stylesheet, exact saved
library bytes, named profile history, assigned drone setup and 33° tilt / 105°
vertical FOV survive. A new Advanced recording uses the saved 900°/s rate.

This closes the local generated-package update/restart gap. It does not qualify
historical schema migration, storage eviction, an OS installation prompt, the
real password, public HTTPS, or an installed full Pages release. Full Pages
publication still requires its ordinary reviewed build and live update check.
The report binds the runner and all package source inputs and verifies they
remain unchanged during the test.

## Commit and live verification

The latest-main rebase includes **Measure exact Pages candidate**, a read-only
diagnostic workflow for narrowly eligible same-repository pull requests. Its
contract rejects feature branches changing build/publishing tooling, package
manifests and certain shared modules. This FPV branch changes those paths and is
therefore outside that workflow's scope. Do not relax its contract or treat a
local measurement as its successful run; use the ordinary reviewed main build
and publication process below.

1. Commit the reviewed implementation, tests and evidence while excluding
   unrelated local work. Rebase the feature branch again if `main` has moved.
   Run the repository's required checks on the resulting source.
2. Review and integrate through the repository's existing main-branch process.
   A local commit or a feature-branch push does not deploy Pages.
3. Let **Publish GitHub Pages from main** build the exact main commit. Require
   successful build, capacity/archive checks, deploy and public verification.
   Do not substitute the historical `build-pages.mjs` tag/archive workflow.
4. Check `/revealline/main-deployment.json` identifies the intended commit, then
   open the direct SIM routes in a fresh browser profile. Unlock with the normal
   password form. An old installed worker may still show its older cached build;
   do not clear the player's saves or caches to manufacture a successful update.
5. In Settings → Controls → Rates & throttle, create an Actual profile, edit
   each axis, save it, select its drone assignment, and reload. Preview a known
   Betaflight snippet with its correct firmware version; inspect unapplied
   settings before saving a new profile. Export and re-import a backup.
6. Test draft → return → save/revert. Open **Advanced reference quad ·
   experimental**, start, pause, export a recording, and return to tuning.
   Repeat with World/Regional content, including a verified landing and takeoff.
   Keep Advanced optional and unscored.
7. Prepare each simulator offline using its normal UI, close/reopen it offline,
   and repeat a rates/Advanced test. Confirm another simulator's offline copy and
   existing profiles remain intact. Test an existing installation separately from
   a fresh profile.
8. Check that unsaved camera edits survive profile changes, numeric entries show
   their committed rate, and a new World/Regional selection becomes the next
   draft test's origin. Change a previewed import and verify that saving it asks
   for another preview; test header-derived defaults and rotation-only CLI export.
9. Export Regional recovery, restore it, and cancel another restore while it is
   verifying. The current paused flight must survive cancellation or corrupt data.
   Check EN/UK, keyboard/touch and export cancellation. Physical-radio and pilot
   checks are deferred until those resources are available. Report device/browser
   details and the displayed/source build when filing problems.
10. Clear camera tilt or enter an out-of-range FOV: saving, drone duplication and
    starting practice must keep the editor open and request a valid value. Switch
    profiles and reopen tuning to confirm the unfinished text survives. Correct
    the values to fractional degrees and verify save/test/reload preserves them.
    Rate-only exports should remain available during an unfinished camera edit.

The public checks above establish only their listed HTTPS/browser flows. The
broader checklist remains useful for manual testing; it is not a claim that every
step ran on the public site. Physical flight fidelity, the device performance
matrix, real radio sampling and scored competition eligibility are not
established by Pages acceptance. The historical Regional capacity failure under host contention remains evidence.
The separate [second-review bounded capacity run](fpv-regional-contact-capacity-2026-10-16-second-review.json)
passes on its pinned sources; neither result is changed by deployment.
