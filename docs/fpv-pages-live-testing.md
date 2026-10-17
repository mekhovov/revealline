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

The [current sixth-review check](fpv-pages-sixth-review-live-testing-evidence.json)
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

Physical flight fidelity, the device performance matrix, public HTTPS behavior,
real radio sampling and scored competition eligibility are not established by
this Pages delivery check. The historical Regional capacity failure under host contention remains evidence.
The separate [second-review bounded capacity run](fpv-regional-contact-capacity-2026-10-16-second-review.json)
passes on its pinned sources; neither result is changed by deployment.
