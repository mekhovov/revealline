# Local support summary

In the primary game shell, open **Settings → Progress & Collection → Local support summary** and choose **Prepare / refresh summary**. Preparation reads a fixed set of local observations. Review the readable facts and the exact JSON before choosing **Download summary**. The existing platform export owner handles a browser download or the native iOS share sheet; a requested download does not prove a file reached its destination.

This slice covers the Solo/Journey shell, including installed editions and practice hosted there, and the native Capture Team host. In Team, open **Settings → Game data → Local support summary**. It does not claim to diagnose the separate Versus, Snake, online or SIM hosts. No support endpoint, automatic transmission or persistent diagnostics store is added.

## Included observations

The `revealline-local-support-summary.v1` document contains:

- Capture time; declared build version and source revision when available.
- Host category, game state, language and the current save writer's permission/reason code. Permission does not prove that a save succeeded.
- Browser/native context, visibility/focus, standalone presentation and relevant API availability. The browser's online value is only a hint.
- The latest existing game controller result: status, assignment/neutral/Confirm-gate booleans, reason and sample age. There is no extra controller poll or input consumption. One scalar observation replaces the preceding one; there is no history. A sample older than two seconds, or captured while the page is inactive, is marked stale.
- Offline configuration and whether a service worker currently controls this page. Content is explicitly **not verified here**; use the existing Install & offline play screen for verification and repair.
- Read-only browser retention status and storage estimates rounded up to MiB. Each optional read has a 1.5-second deadline. Missing, invalid, failing and timed-out APIs remain explicit unknown/unavailable states.

The document excludes URL/query strings, names, controller/device identity, raw buttons or axes, input history, storage keys, save contents, media, credentials and exception text. It does not open a database, request retention, verify or install downloads, or read the contents of browser storage. It is not a backup or evidence of long-term storage durability.

## Interaction ownership

Only an explicit prepare/refresh action starts the optional observations. Refresh supersedes the prior observation. Closing Settings, hiding the page or leaving clears its prepared report; late results cannot republish it. A native export already awaiting a destination retains its ownership until it settles, including across a close/reopen. The newer report never receives an older export's success message.

The preview and export use the same captured document. Downloading does not silently refresh its facts. Keep the capture time when sharing it; the game and browser can change afterward.

## Capture Team observations

Team supplies its actual declared build, run state, locale and platform owner. Its current save permission remains unknown: an attempt generation, checkpoint or successful durable write does not establish a current writer lease. Offline configuration is only configuration; content is not verified.

The ordinary Team controller frame caches only sample time, physical connected/disconnected/unavailable status and whether any seat is assigned. Presence is observed before virtual seat mapping. Preparing a summary adds no hardware poll, session sample, raw button/axis read or consumed edge. Team's virtual menu owner cannot establish both players' physical neutral/Confirm readiness, so those values remain unknown. Device identity, seats, profiles and raw controls never enter the cache or report.

The cache clears with the host's existing input/lifecycle clear and disposal. Clearing the cache does not refresh or erase an already prepared preview: preview and export retain the same captured document. The shared view clears prepared reports on native Settings close, hidden page and page exit, and rejects late results when the page is no longer focused. Team attaches that view to its explicit native dialog and Data root; no private reset API or new export owner is introduced.

Sibling Snake and Overflight adapters extend the same collector. Future integration must union their host kinds, state/reason allowlists and scope mappings with Team rather than replace any adapter's collector. Versus uses a hidden/inert Settings section and needs a separate explicit view visibility contract.

## Qualification boundaries

Unit/component coverage checks the allowlist, absence of input/storage-content reads, unavailable states, bounded reads, sample freshness, exact preview/export matching, cancellation, replacement, page lifecycle and native export ownership. Actual-host modeled tests exercise paused Solo state and its real controller router, plus Team physical presence, native Controls assignment, unknown readiness/save permission, paused Hunt checkpoint preservation, lifecycle retirement, exact preview/export and English/Ukrainian focus/copy. Preparing Team support adds zero controller observations, game ticks or storage writes. These do not establish native layout, physical controller compatibility, native iOS transfer, offline cold start or other mode coverage.
