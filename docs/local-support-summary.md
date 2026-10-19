# Local support summary

In the primary game shell, open **Settings → Progress & Collection → Local support summary** and choose **Prepare / refresh summary**. Preparation reads a fixed set of local observations. Review the readable facts and the exact JSON before choosing **Download summary**. The existing platform export owner handles a browser download or the native iOS share sheet; a requested download does not prove a file reached its destination.

This slice covers the Solo/Journey shell, including installed editions and practice hosted there, native Capture Team and Versus hosts, and FPV Academy. In Team or Versus, open **Settings → Game data → Local support summary**. In Academy, use **Settings → Progress & Collection → Local support summary**. It does not claim to diagnose the separate Snake, online, Worlds or legacy civilian-flight hosts. No support endpoint, automatic transmission or persistent diagnostics store is added.

## Included observations

The `revealline-local-support-summary.v1` document contains:

- Capture time; declared build version and source revision when available.
- Host category, game state, language and the current save writer's permission/reason code. Permission does not prove that a save succeeded.
- Browser/native context, visibility/focus, standalone presentation and relevant API availability. The browser's online value is only a hint.
- The latest existing game controller result: status, assignment/neutral/Confirm-gate booleans, reason and sample age. There is no extra controller poll or input consumption. One scalar observation replaces the preceding one; there is no history. A sample older than two seconds, or captured while the page is inactive, is marked stale.
- Offline configuration and whether a service worker currently controls this page. Content is explicitly **not verified here**; use the existing Install & offline play screen for verification and repair.
- Read-only browser retention status and storage estimates rounded up to MiB. Each optional read has a 1.5-second deadline. Missing, invalid, failing and timed-out APIs remain explicit unknown/unavailable states.

The document excludes URL/query strings, names, controller/device identity, raw buttons or axes, input history, storage keys, save contents, media, credentials and exception text. It does not open a database, request retention, verify or install downloads, or read the contents of browser storage. It is not a backup or evidence of long-term storage durability.

Controller presence does not establish menu readiness. A recent connected observation uses the existing ready message only when assignment and neutral are both confirmed true and Confirm blocking is confirmed false. Otherwise it reports presence with readiness unconfirmed. A disconnected observation without a confirmed assignment says that no connected controller was observed; the existing assigned-controller disconnect instruction remains for a known assignment. Stale samples and other authoritative controller states retain their existing wording. The exact JSON and exported facts are unchanged by this presentation choice.

Actual browser review of Academy at `0e9f9e92` reproduced the need for this distinction: Settings → Progress & Collection → Prepare on a disarmed flight with no physical controller showed an assigned-controller disconnect instruction while the captured assignment was null. The shared presentation also called aggregate connected presence ready. The bounded wording correction has a complete 27-case component pass, including EN/UK locale refresh, partial/false readiness, stale samples and exact export.

Actual browser review of the corrected candidate showed **No connected controller was observed.** in English. Changing from Data to Display, selecting Ukrainian and returning to Data retired the earlier report and disabled Download; a fresh Prepare showed **Під’єднаного контролера не виявлено.** Prepare kept focus and the flight stayed disarmed. Before/after EN/UK screenshots were retained with the delivery evidence for 2026-10-19. This verifies that specific visible absent-controller path; physical connected/assigned-controller behavior and download delivery were not exercised. The complete five-file component and native primary/Team/Versus/Academy cohort passed 141/141 cases without skips, with the six-file candidate unchanged before and after the run. Full-source, built-package and physical-device gates remain pending.

## Interaction ownership

Only an explicit prepare/refresh action starts the optional observations. Refresh supersedes the prior observation. Closing Settings, hiding the page or leaving clears its prepared report; late results cannot republish it. A native export already awaiting a destination retains its ownership until it settles, including across a close/reopen. The newer report never receives an older export's success message.

The preview and export use the same captured document. Downloading does not silently refresh its facts. Keep the capture time when sharing it; the game and browser can change afterward.

## Capture Team observations

Team supplies its actual declared build, run state, locale and platform owner. Its current save permission remains unknown: an attempt generation, checkpoint or successful durable write does not establish a current writer lease. Offline configuration is only configuration; content is not verified.

The ordinary Team controller frame caches only sample time, physical connected/disconnected/unavailable status and whether any seat is assigned. Presence is observed before virtual seat mapping. Preparing a summary adds no hardware poll, session sample, raw button/axis read or consumed edge. Team's virtual menu owner cannot establish both players' physical neutral/Confirm readiness, so those values remain unknown. Device identity, seats, profiles and raw controls never enter the cache or report.

The cache clears with the host's existing input/lifecycle clear and disposal. Clearing the cache does not refresh or erase an already prepared preview: preview and export retain the same captured document. The shared view clears prepared reports on native Settings close, hidden page and page exit, and rejects late results when the page is no longer focused. Team attaches that view to its explicit native dialog and Data root; no private reset API or new export owner is introduced.

Sibling Snake and Overflight adapters extend the same collector. Future integration must union their host kinds, state/reason allowlists and scope mappings with Team rather than replace any adapter's collector. Versus uses the explicit visibility and invalidation contract below for its hidden/inert Settings section.

## Capture Versus observations and Settings ownership

Versus reports its actual match state, including a finished round without inventing a win or loss. Its build/platform, aggregate normal-frame controller cache and unknown physical readiness/save permission follow the same limits as Team. Native support controls use the existing Settings navigation scope and Confirm guard.

The shared view accepts an optional `getSettingsOpen` getter; existing dialog callers retain the native `.open` default. Public `invalidate()` retires the existing generation, cancels optional observations and clears the prepared report. It does not release a pending export. Preview/export remains a single captured document and a close/reopen cannot start a second export while the earlier destination is pending.

Versus supplies its real shell/Data visibility, including the compact category versus panel view. The settings-panel owner notifies after committed category, compact Back and resize changes. Crossing the compact CSS breakpoint also retires the visit when the category/view attributes are unchanged or focus is outside Settings; returning wide cannot revive that pending report. Repeated widths on the same side of the breakpoint preserve the captured document when the view is unchanged. The shell notifies after actual Settings visibility changes, including status-driven screen retirement, and disposal. Selecting an unchanged panel or an ordinary paused game frame does not erase the prepared document. Blur, hidden page and bfcache retire the report without resuming either board; late completion after away/back cannot publish into the returned view or move focus.

## FPV Academy observations

Academy owns its native Settings dialog, top menu/modal context and Progress & Collection panel. The shared mode organizer forwards committed category, compact Back and width-breakpoint changes to the same invalidation owner. An overlay, blur, hidden page, bfcache boundary, new attempt or disposal retires the report. Disposal aborts it synchronously before notebook or renderer cleanup. These observations do not arm or resume a flight.

Only an ordinary game frame records aggregate physical controller presence and sample time, before flight mapping and radio exclusion. Preparing a report adds no controller/radio polling, action consumption or simulation steps. Explicit Arm readiness reads do not populate this cache. Controller assignment, physical neutral/Confirm readiness and current save permission remain unknown. A stored lesson, reward or retention grant does not establish a writer lease. No runtime build/version/source owner is available, so those values remain unknown rather than being inferred from a URL or the main game's version.

Live disarmed, active, paused, complete and expired flights retain their actual meaning. Playback follows its presentation clock. Exhausting a recording reports **Playback ended**, even when opening Settings marks that clock paused. It does not claim the recorded flight completed its objective: an unfinished recording may leave the simulated model active. An in-progress paused recording remains paused and its existing Continue action remains the resume owner.

The view and collector are direct Academy-only package dependencies. Academy already admits their i18n and platform dependencies; the other optional hosts gain no support modules or new platform permission. Its standalone locale projection admits the support message family. Package file/byte caps stay unchanged; static dependency/parser checks do not qualify an actual built package. The shared SIM projection changes only to forward the optional Settings presentation callback. Export uses the existing platform owner with the mounted document/window and the exact captured JSON.

## Qualification boundaries

Unit/component coverage checks the allowlist, absence of input/storage-content reads, unavailable states, bounded reads, sample freshness, exact preview/export matching, cancellation, replacement, page lifecycle and native export ownership. Actual-host modeled tests exercise paused Solo state and its real controller router, plus Team physical presence, native Controls assignment, unknown readiness/save permission, paused Hunt checkpoint preservation, lifecycle retirement, exact preview/export and English/Ukrainian focus/copy. Preparing Team or Versus support adds zero controller observations, game ticks or storage writes. Versus modeled coverage also checks both paused boards, hidden-section ownership, category arrows, compact Back/resize, away/back pending work, foreground and bfcache retirement, native controller activation, finished-round EN/UK copy and exact export. These do not establish native layout, physical controller compatibility, native iOS transfer, offline cold start or other mode coverage.

Academy's corrected complete twelve-file modeled cohort passed 236/236 cases without skips, including distinct unfinished-playback endings, in-progress Continue, missing/throwing controller access, EN/UK copy and direct package/locale admission. Three final lifecycle checks were then added; the expanded attempt passed 237/239, with two fixture mistakes corrected. The final complete Academy native file (91 cases) and collector/component file (13 cases) passed 104/104 without skips. These are separate runs, not a new combined aggregate. Its registered shell projection and all 18 decoded catalog namespaces match canonical source exactly. Full-source validation, built-package admission and actual browser/device qualification remain separate pending gates.

## Private Rooms adapter

In Private Rooms, open **Settings → Local support summary**. This is an explicit local observation, not a request to the room service or a server-health check. The native Settings dialog owns report visibility, focus and retirement. Preparing or downloading never sends Ready, submits controls, pauses a room, polls transport or exports a match replay.

Only the existing local transport phase and accepted room status enter game-state copy. Connecting, recovering, waiting for readiness, playing, paused, finished and abandoned remain distinct; an inapplicable state is unknown. The ordinary input frame caches only sample time, controller status and a boolean assignment. Preparing reads that cache without another hardware sample. Clear, suspension, foreground loss and disposal retire the cache. Physical neutral/Confirm readiness and both players’ room readiness are not inferred from controller presence.

No room identifier, invitation, endpoint, credentials, seat details, accepted recipe, replay, transport queue or raw input enters a report. The page has no declared build version today, so that remains unknown. A server seat and replay export do not establish local save permission. Offline content remains unverified. Exact preview and export share one captured document through the existing platform export owner.

Complete modeled native tests exercise the actual Rooms mount, Settings dialog, shell, input router, collector and export view with legal room-core/lifecycle states and finite DOM/media boundaries. They check no extra input/transport/storage activity, state preservation, privacy, late-result retirement and EN/UK focus/JSON stability. They do not qualify rendered layout, a live service, physical controllers, offline play or native transfer.
