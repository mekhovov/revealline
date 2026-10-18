# Local support summary

In the primary game shell, open **Settings → Progress & Collection → Local support summary** and choose **Prepare / refresh summary**. Preparation reads a fixed set of local observations. Review the readable facts and the exact JSON before choosing **Download summary**. The existing platform export owner handles a browser download or the native iOS share sheet; a requested download does not prove a file reached its destination.

The primary slice covers the Solo/Journey shell, including installed editions and practice hosted there. The Survival/Raid adapter also uses **Settings → Progress & Collection → Local support summary** in Single Drone, Riy, Single Raid, Time Attack and Marathon. Their JSON host identities are respectively `overflight`, `overflight-riy`, `overflight-hunt`, `overflight-time-attack` and `overflight-marathon`, within `overflight-game-shell`. Other host adapters require their own qualification. No support endpoint, automatic transmission or persistent diagnostics store is added.

## Included observations

The `revealline-local-support-summary.v1` document contains:

- Capture time; declared build version and source revision when available.
- Host category, game state, language and the current save writer's permission/reason code. Permission does not prove that a save succeeded.
- Browser/native context, visibility/focus, standalone presentation and relevant API availability. The browser's online value is only a hint.
- The latest existing game controller result: status, assignment/neutral/Confirm-gate booleans, reason and sample age. There is no extra controller poll or input consumption. One scalar observation replaces the preceding one; there is no history. A sample older than two seconds, or captured while the page is inactive, is marked stale.
- Offline configuration and whether a service worker currently controls this page. Content is explicitly **not verified here**; use the existing Install & offline play screen for verification and repair.
- Read-only browser retention status and storage estimates rounded up to MiB. Each optional read has a 1.5-second deadline. Missing, invalid, failing and timed-out APIs remain explicit unknown/unavailable states.

The document excludes URL/query strings, names, controller/device identity, raw buttons or axes, input history, storage keys, save contents, media, credentials and exception text. It does not open a database, request retention, verify or install downloads, or read the contents of browser storage. It is not a backup or evidence of long-term storage durability.

Survival/Raid copies only the last scalar readiness result already produced by its normal controller owner. Clearing input, changing controller preferences or disposing the owner invalidates that observation. Preparing/exporting a report never polls a pad or consumes an input edge. The host reports the version already read during controller preference initialization; source revision remains unknown. A ready flight is not started, and an upgrade draft pauses gameplay. Normal save permission remains explicitly unknown because the existing record stores report individual write results rather than expose a current permission lease. Review, fixture and Studio contexts are non-saving practice. Neither status is a saved-flight durability claim.

## Interaction ownership

Only an explicit prepare/refresh action starts the optional observations. Refresh supersedes the prior observation. Closing Settings, hiding the page or leaving clears its prepared report; late results cannot republish it. A native export already awaiting a destination retains its ownership until it settles, including across a close/reopen. The newer report never receives an older export's success message.

The preview and export use the same captured document. Downloading does not silently refresh its facts. Keep the capture time when sharing it; the game and browser can change afterward.

## Qualification boundaries

Unit/component coverage checks the allowlist, absence of input/storage-content reads, unavailable states, bounded reads, sample freshness, exact preview/export matching, cancellation, replacement, page lifecycle and native export ownership. Actual-host modeled tests exercise paused Solo state, its real controller router, readiness/disconnection, unchanged flight/storage and English/Ukrainian copy. The Survival/Raid source adapter has separate actual-core coverage for all five operation owners and executes its actual mounting code with the real controller and shared report UI at a modeled DOM boundary. These do not establish native layout, physical controller compatibility, native iOS transfer, offline cold start or other mode coverage.
