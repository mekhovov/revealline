# Optional practice installation observation

This check validates frozen optional-package envelopes, hashes, selected source and
complete dependency inventories before staging those exact bytes. It accepts local
frozen candidates or original candidate CI downloads. It does not rebuild or publish
them, allocate a release or grant review approval.

```sh
node scripts/observe-optional-installation.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/current-frozen-bundle /tmp/new-installation-observation.json /absolute/path/to/previous-frozen-bundle
```

The current bundle must contain both `civilian-flight` and `civilian-fpv`, with a
`/revealline/` installation base. The optional previous bundle must contain
`civilian-fpv`. Both candidates must pass normal admission, have different versions,
commits, trees and FPV archives, and preserve the same stable launcher manifest.
The report identifies both sources and lists every changed FPV runtime file. The
initial launcher comes from the previous candidate; update stages the current
launcher's exact bytes before advancing the candidate pointer.

Omit the last argument to retain the older same-payload path-fixture check. In that
mode `v0.0.0` holds the current payload under a different local version path. Both
modes reserve `v0.0.1` for a deliberately truncated dependency. Fixture paths must
not collide with either candidate version. They are never published releases.

The observer uses installed Chrome, a temporary persistent browser profile and an
isolated loopback server with production-style headers. It never opens the user's
normal browser profile. Both test apps are uninstalled and the temporary profile
removed on completion. Cleanup failures retain that directory and identify it in
the receipt instead of hiding the failure.

The public UI prepares each package offline and imports one explicitly scripted,
replay-verified FPV attempt. No database records, reward receipts or completion flags
are injected. Input frames come from the previous candidate's teaching example
under a synthetic practice session. Setup imports a deliberately unverified radio
mapping and independent response profile, including reordered/reversed channels
and full-travel throttle. This establishes import and persistence behaviour, not
a human flight, learning achievement or physical-radio compatibility.

The check covers:

- Distinct manifest identities and coexisting prepared caches/worker scopes.
- Chrome PWA installation, explicit standalone preference and two launched windows.
- Offline startup and byte-identical exported flight proofs and profile settings.
- Installation over the admitted previous candidate or the declared path fixture.
- A truncated dependency rejected without advancing installation pointers.
- Removal restoring the previous pointer, offline operation and saved settings.
- Removing/uninstalling the gym while preserving the FPV registration and proof.

Gameplay offline checks run in the browser tab; the standalone windows verify the
installed launchers and coexistence. A passing report requires browser preparation,
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
