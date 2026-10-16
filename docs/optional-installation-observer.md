# Optional practice installation observation

This check validates frozen optional-package envelopes, hashes, selected source and
complete dependency inventories before staging those exact bytes. It accepts local
frozen candidates or original candidate CI downloads. It does not rebuild or publish
them, allocate a release or grant review approval.

```sh
node scripts/observe-optional-installation.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/current-frozen-bundle /tmp/new-installation-observation.json /absolute/path/to/previous-frozen-bundle
```

The current bundle must contain `civilian-flight`, `civilian-fpv`, and `fpv-worlds`, with a
`/revealline/` installation base. The optional previous bundle must contain
`civilian-fpv`. Both candidates must pass normal admission, have different versions,
commits, trees and FPV archives, and preserve the same stable launcher manifest.
The report identifies both sources and lists every changed FPV runtime file. The
initial launcher comes from the previous candidate; update stages the current
launcher's exact bytes before advancing the candidate pointer.

The sole historical diagnostic exception is explicitly enabled with
`OPTIONAL_INSTALLATION_PREVIOUS_HISTORICAL=v0.142.4-98ad851`. It accepts only the
hash-pinned historical source/tree/envelope and committed validator closure in
`scripts/practice-historical-admission.mjs`; current B still passes current
admission. Unknown modes or other prior snapshots reject. This is not a general
historical registry or publisher-policy exception. See the
[genuine historical upgrade result](flight-practice-historical-upgrade-2026-10-16.md).

## Optional short download-fault lane

Set `OPTIONAL_INSTALLATION_DOWNLOAD_FAULTS=all-short` together with
`OPTIONAL_INSTALLATION_WORLD_SEED=worlds-template-copy` to add six checks: all
three apps × real inactivity and native download cancellation. Only the owned
loopback server's one exact admitted README dependency is delayed, at the explicit
unpublished `v0.0.1` recovery path. Its first byte and all immutable app files are
unchanged. The current/prior package distinction is recorded independently;
these recovery paths do not represent real release migrations.

The idle case requires an observed downloading state and approximately 30 seconds
without new bytes before app-side request termination. The Cancel case clicks
the visible Cancel download button once, well before that deadline, and requires
prompt termination plus cancellation copy where exposed. Gym currently shows its
generic failure copy; its prompt request-abort evidence is required separately.
A server safety timeout, ineffective Cancel, silent retry, stale status or missing
request cannot pass. Monotonic server events distinguish bytes written from the
browser's separate received-progress witness. No accelerated clock is used.

After every fault, installation pointers, existing prepared-cache URL/size/hash
inventories, original workers, exact Academy proof/profile exports and the
nonempty World project fingerprints must remain unchanged. The temporary failed
scope must have no cache/worker. A pristine retry and scoped removal must restore
the same baseline and recheck those records. Gym practice records are unpopulated
in this lane. Helper hashes and independent fault/browser cleanup are recorded.

This lane does **not** establish cancellation during local verification, the real
five-minute overall limit, actual quota exhaustion/eviction or real hardware.
Network delay cannot deterministically pause local hashing/cache writes; a
Verifying label alone is insufficient evidence. The fixed real trickle transport
is used by the separately bounded lane below, never by a shortened-clock substitute.

## Separate real five-minute lane

Use exactly one of `overall-civilian-flight`, `overall-civilian-fpv` or
`overall-fpv-worlds` as `OPTIONAL_INSTALLATION_DOWNLOAD_FAULTS`, with the same
saved-world seed. Each invocation runs one app's real overall-timeout case and
one pristine retry/removal. Run all three separately to cover all apps. The
default and six-case `all-short` journey are unchanged. Quota faults cannot be
combined with this lane. The existing ten-minute aggregate limit is not increased;
at least 390 seconds must remain before attaching its fault.

The owned server writes successive original dependency bytes every five seconds.
Acceptance requires approximately five-minute client termination (295–315 seconds),
at least 55 contiguous original-byte writes, no 30-second write gap, no silent
retry, and no server safety/cleanup termination or Cancel. This measures server
transmission plus native client failure, not direct browser receipt of every byte.
Generic failure text cannot identify the internal timer. All existing pointer,
worker, six-cache admitted pin, proof/profile and World retention checks recur
after failure and retry/removal. Native execution is still required; synthetic
timing regressions are not five-minute qualification.

## Separate historical active-session lane

Only the explicit `owned-window-minimize-98ad851` diagnostic uses an isolated
visible Chrome context. Headless installed-app windows can acknowledge native
minimization without changing state; the preserved third attempt records that
failure. Visibility does not waive actual bounds, focus/pause, identity or cleanup
checks. Default, migration and download lanes remain headless.

With the pinned historical admission above, set
`OPTIONAL_INSTALLATION_ACTIVE_SESSION=academy-v0.142.4-98ad851`. Do not combine it
with download/quota faults. The retained historical standalone window uses normal
Settings, keyboard selection and Detailed HUD, explicit Start/Arm, visible Height
movement and explicit pause/resume. An initially disarmed Start is retained; the
observer waits for the public Arm control's enabled state rather than hidden
renderer state. No completed course/proof is manufactured.

Do not infer natural blur from Playwright's `bringToFront`: this installed
automation runtime enables focus emulation, and the first native attempt failed
before update because both separate windows remained logically focused. The
failed receipt and plain-page probes are preserved. A visible-browser probe with
the same override is not independent natural-focus proof either.

For the separate minimized-window diagnostic, additionally set
`OPTIONAL_INSTALLATION_ACTIVE_WINDOW=owned-window-minimize-98ad851`. The observer
hash-pins the installed Playwright focus-default implementation, acquires only
the isolated context's exact A/B target sessions, and removes its focus emulation
on those targets. Native window minimization then produces actual browser blur;
no DOM event, hidden application state or historical package byte is synthesized.
Both original normal window geometry and automation defaults are restored, and
sessions detach independently. Native bounds alone never substitute for the
application's paused/focus/visible-HUD witness. Ordinary cross-window switching
and physical-device behavior remain unqualified.

Only after the observed pause does the real current package prepare and advance active/previous
pointers. The old window must retain its immutable URL, document identity and time
origin, remain paused with stable visible height after focus returns, and move
again only after explicit resume. The whole helper, including update, has one
30-second budget. Native input ownership, pending actions and cleanup are checked;
the parent also requires actual B preparation and exact record retention.
An original paused screenshot and source hash are retained. This is historical
Academy session continuity, not uninterrupted background flight, exact simulation
tick continuity, all-app migration or a human/physical-input review. Native results
must be recorded separately from its synthetic unit tests. Upward movement must
be positive, not a fall/reset to ground. A failed focus transfer retains its last
bounded public snapshot and stops after 1.5 seconds inside the unchanged shared
30-second deadline.

## Separate all-three historical migration lane

Set `OPTIONAL_INSTALLATION_MIGRATION=all-three-98ad851`, the pinned historical
admission and the same saved-world seed. Download, quota and active-session/window
flags must be absent. This lane has its own
`OptionalInstallationHistoricalMigrationObservation.v1` report and
`optional-installation-all-three-historical.v1` protocol; omitted OS-installation
and process-restart checks cannot pass under the default protocol's name.

All three original historical runtimes/launchers are prepared. The historical
World project is created through Missions → Workshop and installed normally.
Each app upgrades to genuinely different admitted current bytes, then returns to
its retained historical runtime through ordinary current-shell removal and an
offline stable launcher. Ordinary online Play visits prepare/update launchers;
workers must activate normally after the old launcher client leaves. There is
one worker per stable launcher scope; activation retains exactly its current and
one previous admitted shell cache. The migration lane hashes both and rejects
extra/missing caches. Read-only status must bind the active worker to the exact
admitted revision, scope and ready state, with no installing/waiting worker.
Only genuinely absent historical status fields are compatible; explicit unknown
or malformed values fail closed. Bounded stage snapshots preserve failures
without registering/updating workers, opening caches or weakening dependency hashes.
There is no forced activation, unregister or manual cache deletion.

Seven ordered checkpoints require exact active/previous pointers, every admitted
runtime **and launcher** response hash, no extra/missing cache/worker scopes,
unchanged sibling ownership, exact shared synthetic proof/profile exports, and
the full nonempty historical World project/revision/card fingerprints. Gym has
no persistent flight-record store to populate. This lane does not qualify
populated assets/recordings, flights, hardware, OS installation, process restart,
human reviews or public release. Native execution is required after unit tests.

## Default journey and evidence boundaries

Omit the last argument to retain the older same-payload path-fixture check. In that
mode `v0.0.0` holds the current payload under a different local version path. Both
modes reserve `v0.0.1` for a deliberately truncated dependency. Fixture paths must
not collide with either candidate version. They are never published releases.

The observer uses installed Chrome, a temporary persistent browser profile and an
isolated loopback server with the existing preview security headers (which allow
validated HTTPS media/catalogue connections). It never opens the user's
normal browser profile. All three test apps are uninstalled and the temporary profile
removed on completion. Cleanup failures retain that directory and identify it in
the receipt instead of hiding the failure.
Pending browser/server startup also retains the directory as unverified cleanup:
a resource that resolves after the observation deadline cannot silently recreate
a supposedly deleted profile. Delayed-start and late-close-failure regressions
cover that ownership boundary.

The public UI prepares each package offline and imports one explicitly scripted,
replay-verified FPV attempt. No database records, reward receipts or completion flags
are injected. Input frames come from the previous candidate's teaching example
under a synthetic practice session. Setup imports a deliberately unverified radio
mapping and independent response profile, including reordered/reversed channels
and full-travel throttle. This establishes import and persistence behaviour, not
a human flight, learning achievement or physical-radio compatibility.

The check covers:

- Distinct manifest identities and coexisting prepared caches/worker scopes.
- Chrome PWA installation, explicit standalone preference and three launched windows.
- Closing **every** tab and installed window before reopening all three stable
  launchers offline. An uncached network probe must fail before each launch.
- Reopening three new installed standalone windows while still offline, then
  reaching each app's mounted start screen through the public launcher action.
- Closing the persistent browser context, requiring its close event, and launching
  a new browser on the same disk profile with offline enabled before application
  navigation. All three stable launchers and installed windows must reopen again;
  the uncached network probe and unchanged profile/proof exports are rechecked.
- Offline startup and byte-identical exported FPV flight proofs and profile settings.
- Installation over the admitted previous candidate or the declared path fixture.
- A truncated dependency rejected without advancing installation pointers.
- Removal restoring the previous pointer, offline operation and saved settings.
- Removing/uninstalling the gym while preserving FPV registration/proof and the
  World Studio installation pointer.

Password-gated candidates require an authorized test credential in the
`OPTIONAL_INSTALLATION_PASSWORD` environment variable. The observer enters it
through the ordinary unlock form; it never changes admitted files, injects an
unlock record, or records the password. Missing credentials fail immediately with
an actionable message. Keep credentials out of command arguments and receipts.

The observer follows the current simulator Settings menus: Academy's Help & Extras,
Progress & Collection, and Controls; Gym's and World's Content & Offline. Launcher
transitions verify the exact origin, app/version path and English language query;
the helper also tests Ukrainian routing. Academy's Workshop & offline disclosure
is expanded through its summary's native keyboard Enter action before preparation, failed-download and removal
checks. Radio Setup's **Back up or import a profile** disclosure is likewise expanded
before importing a profile and before every subsequent export; closing Setup recreates
that editor with its transfer tools collapsed. The adapter checks actual visibility
and leaves already-open disclosures open. Profile import/export uses native button
Enter; a current-runtime controlled diagnostic confirmed a first pointer click can
leave the export empty while Enter produces the profile JSON. The initial export
must match every fixture field, including the retained radios array in the current
`FlightProfiles.v2` library (older `FlightProfiles.v1` exports remain supported).
Proof import/export also uses native Enter: in the full current controlled journey,
the first pointer export after offline reopening left the textarea empty rather
than producing even an empty-attempt JSON backup. Later exports must remain
byte-identical through offline use, update and rollback.
Unknown export formats fail instead of silently dropping fields. It does not click
hidden controls or directly invoke application functions. Offline preparation and
removal also use native button Enter. A read-only DOM witness requires fresh status
or progress activity within 30 seconds, then a fresh terminal status; stale success
text cannot pass a new action. Error statuses fail promptly. Preparation waits up to
315 seconds, allowing the application's five-minute overall transfer deadline plus
status rendering. Ordinary browser operations and protocol/cleanup calls are
bounded to 30 seconds. The complete staging/browser journey has a ten-minute deadline;
failure still enters the independently bounded cleanup and writes a failure receipt.
Bundle admission happens before that deadline. The unit regression is
`node --test scripts/test-optional-installation-observer.mjs`.

The receipt's `closedTabsRelaunch` identifies the zero-surviving-page transition;
each installed app also records its new `offlineWindow`. The new `browserRestart`
field separately records attempted/passed process restart, confirmed context
closure, and each app's `restartedOfflineWindow`. An overall pass now requires
both transitions. Failure receipts retain the attempted/passed distinction.
Browser-context offline emulation and a failed uncached probe are not an OS
reboot, physical airplane-mode test or proof that every external origin was
unreachable. Those remain separate qualification steps. Historical receipts
without these restart fields only establish their original window-relaunch scope.
Both observer and helper hashes are recorded and rechecked before declaring a pass.

The [15 October observation](flight-practice-observation-2026-10-15.md) passed nine
checkpoints on unchanged candidate runtime bytes from `da0b010820`, using authorized
normal-form access. It includes the new browser restart, while retaining a prior
hidden-Open-link timeout. Its update remains a same-payload path fixture, not a
distinct-release migration. Current reports must retain those separate boundaries.

The October 14 three-app extension has helper/contract regressions, but its first
source-bound attempt against `8718babd1827383a22596c5a0156b280a594929d`
stopped at the candidate's password gate without an authorized test credential.
It completed zero preparation checkpoints and cleaned up its isolated profile.
This is **not** a passing installation observation. Rerun the command with authorized
access before treating the new three-app browser journey as qualified.

An unpublished three-app fixture additionally exposed a pointer-focus layout issue:
the first pointer press on Academy's Workshop & offline summary can move the dialog
before mouseup, leaving the disclosure closed. Native keyboard Enter opens it.
The observer uses and records that keyboard route; it does **not** claim the first
pointer interaction has passed. Simulator/UI follow-up and device checks remain necessary.
This controlled fixture predates the later October 14 SIM world-catalogue/shared-worker
changes and is only an observer-adapter diagnostic, not current runtime qualification.

A refreshed, unpublished fixture built from baseline
`caab4312e42d9193faa3a0450aaba015b3c6ae5e` completed all eight checkpoints on Chrome
155.0.8059.40 on October 14. Its own frozen commit is
`7997fd5c1144bfa9ae5922a9c619b44644c4cab9`; only copied password metadata and the
development version were changed for ordinary-form test access. All three apps
prepared, all four open tabs/windows closed, the uncached network probe failed,
and all three launchers reopened offline both in tabs and installed standalone
windows. Profile-library and proof exports remained byte-identical through the
same-payload path update, rejected damaged dependency, rollback and scoped gym
removal. No page errors occurred; observer/helper hashes remained unchanged and
all test applications/profile were removed successfully.

This is a passing **controlled observer regression**, not qualification of the
unchanged release candidate, distinct-version schema migration, a browser-process
restart, physical input or public deployment. Real-package qualification still
requires authorized access and the release's original frozen bytes. The first
pointer interactions described above remain unqualified; the passing run records
native keyboard transfer actions explicitly.

Gameplay offline checks run in the browser tab; standalone windows additionally
verify the apps' mounted start screens and coexistence. A passing report requires browser preparation,
OS installation, standalone windows, no captured page errors, unchanged observer
source and successful cleanup. Failed assertions preserve completed checkpoints
and their failure message. A distinct-candidate pass covers the listed changed
files only; it cannot establish arbitrary historical model/schema migrations or
production deployment and rollback.

The [distinct-candidate observation](verification/evidence/optional-installation-910502531.json)
updates frozen `d22621010` / v0.142.1 to `910502531` / v0.142.2 and rolls back
offline, retaining the exact verified proof and unverified radio/response settings.
Its three changed runtime files are the input-guard implementation, worker and
package manifest; the model and proof schemas are unchanged. All seven checkpoints
and both standalone launcher windows pass, with successful cleanup.

The earlier [same-payload candidate observation](verification/evidence/optional-installation-c1a62377a.json)
records seven successful transitions and both standalone launchers on Chrome
154.0.8037.57 in an isolated headless macOS browser session. It remains evidence
for its original narrower scope. Other operating systems, browser families,
physical radios and deployed public bytes remain separate gates.

Installation and window control use the official experimental
[Chrome DevTools PWA protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/PWA.pdl).
