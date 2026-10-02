# Updates from the installed game's startup screen

Based on main `3f16c1d53` (2026-10-02). The previous package-selection and
catalogue-growth correction, PR #937, is already merged into this baseline.

The existing “Find your line” startup/recovery screen now offers **Check for
updates** when opened as a web-installed app. A single metadata request runs
alongside initialization, with a four-second timeout. If a different published
build is identified while the screen remains visible, the action becomes
**Update game**. It navigates to the existing stable updater, where the player
reviews download size and approves preparation. This screen does not select an
edition, download packages, migrate progress, register a worker or reload play.

Readiness never waits for the check. The screen disappears normally once the
game is ready, cancelling the pending request. There is no minimum splash time,
new title-menu control or interrupting popup. A fast launch may finish before
the check; Settings remains the persistent update entry. A failed check leaves
the direct recovery link usable, including if the optional checking module
cannot load. Offline startup continues normally.

Default-game availability compares the fresh stable updater's build hash with
the loaded page's build, not just its version number or a stored installation
selection. Community editions stay within their own launcher and use their
immutable current-edition pointer (plus build identity when supplied). Existing
scope validation rejects cross-origin and cross-community candidates. Ordinary
browser tabs, local file launches and native wrapper schemes do not add this
PWA control or make the automatic metadata request.

## Verification evidence

The isolated [component preview](../../game/test/manual/startup-updates.html)
uses the actual startup markup, CSS and update controller with supplied metadata
responses. It never runs the game, changes a profile, bypasses the access gate or
opens the actual updater. Manual browser observations:

- Available update: **Update game** and optional-download explanation visible.
- Current build: **Check for updates** and the up-to-date message visible.
- Rejected connection: direct link remains, with an unable-to-check message.
- Browser presentation: update section hidden.
- 393 × 852 portrait: update action visible within the card.
- 852 × 393 landscape: ordinary vertical scrolling reaches all controls.

These are component observations in the desktop in-app browser with simulated
installed presentation, not physical Safari/iPhone installation evidence.
The [portrait preview](evidence/startup-updates-20261002/portrait.png) and
[landscape preview](evidence/startup-updates-20261002/landscape.png) record the
available-update state.

Lint, localization/repository validation, changed-file formatting and whitespace
checks passed. Full in-memory build inspection passed with 2,725 files; the
[summary](evidence/startup-updates-20261002/build-summary.json) pins its manifest
and changed runtime assets. This does not claim hosted publication admission.

Added regression cases cover same-version/different-build detection, unchanged
builds, frozen-release return paths, malformed/foreign update markers, community
pointers without hashes, failed optional module recovery and native-wrapper
exclusion. Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under
`publishing/test-policy.json`; these cases were not executed.

Before claiming physical-device qualification, install the published build on
iPhone, verify the action during startup and failure recovery, open the updater
from it, then repeat offline and with a slow connection. Confirm launch still
finishes without waiting and the existing progress-preserving updater completes.
Scheduled as a separate input to the existing v0.150.0 aggregate; no release
number allocation or frozen-release modification is included.
