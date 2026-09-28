# Optional practice installation observation

This check uses the original optional-package ZIPs downloaded from candidate CI.
It validates their envelope, hashes, selected source and dependency inventories
before staging those exact validated bytes. It does not rebuild or publish them.

```sh
node scripts/observe-optional-installation.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/frozen-optional-bundle /tmp/new-installation-observation.json
```

The frozen bundle must contain both `civilian-flight` and `civilian-fpv`, with a
`/revealline/` installation base. The observer uses installed Chrome, a temporary
persistent browser profile and an isolated loopback server with production-style
headers. It never opens the user's normal browser profile. Both test apps are
uninstalled and the temporary profile removed on completion. Cleanup failures
retain that directory and identify it in the receipt instead of hiding the failure.

The public UI prepares each package offline and imports one explicitly scripted,
replay-verified FPV attempt. No database records, reward receipts or completion
flags are injected. The input frames come from a frozen teaching example under a
synthetic practice session; this establishes import/persistence behaviour, not a
human flight or learning achievement.

The check covers:

- Distinct manifest identities and coexisting prepared caches/worker scopes.
- Chrome PWA installation, explicit standalone preference and two launched windows.
- Offline page startup and byte-identical exported proof persistence.
- A candidate installed over an earlier local version-path fixture.
- A truncated dependency rejected without advancing installation pointers.
- Removal restoring the previous pointer and offline operation.
- Removing/uninstalling the gym while keeping the FPV registration and proof.

`v0.0.0` and `v0.0.1` are local path fixtures holding the same candidate payload,
except the deliberately truncated dependency in the rejected-install fixture.
They do not allocate releases or establish migration between different models,
campaign revisions or historical binaries. The candidate's real version and
source commit/tree remain recorded separately. Gameplay offline checks run in the
browser tab; the standalone windows verify the installed launchers and coexistence.

The report separates browser preparation, OS installation registration and
standalone-window status. Failed assertions preserve the completed checkpoints
and failure message. The observer pins its source at startup and checks that it
remained unchanged. It never grants publication review approvals from these checks.

The [candidate observation](verification/evidence/optional-installation-c1a62377a.json)
records seven successful transitions and both standalone launchers on Chrome
154.0.8037.57 in an isolated headless macOS browser session. This is one automated
environment. Other operating systems, browser families, real radio hardware,
real version migrations and deployed public bytes remain separate gates.

Installation and window control use the official experimental
[Chrome DevTools PWA protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/PWA.pdl).
