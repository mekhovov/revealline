# Flight practice capacity: decision options

Status: proposal for review, not an approved infrastructure change. No repository,
host, domain, release or deployment credential has been created or changed.

## Why a decision remains

The [measured baseline](flight-practice-capacity-review-2026-10-14.md) plus one
three-app generation and a comparable retained generation needs at least
975,198,521 bytes, before the populated directory and final combined inventory.
That exceeds the unchanged 950,000,000-byte project guard by at least 25,198,521.
The bounded lossless audit found only 1,235,912 bytes of possible savings; it does
not prove no other safe reduction exists, but it does not close this gap.

GitHub documents a 1 GB published-site limit; using a custom Actions workflow
does not remove that limit. Any eventual design must also respect the provider's
bandwidth, usage terms and deployment limits, rather than treating more
repositories as unlimited capacity. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Options and recommendation

| Option                                                                                          | Benefit                                                                                    | Cost / unresolved risk                                                                                              | Recommendation                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Further bounded, content-preserving reduction in the existing site                              | Keeps current paths, identity and deployment architecture                                  | No measured reduction large enough yet; byte-pinned assets and original downloads must remain valid                 | Accept a concrete, measured proposal; do not delay indefinitely on speculative compression |
| Dedicated practice project site under the same account, if provider policy and ownership permit | Separates optional executable payload and retained versions from the main site's inventory | Adds a deployment target and compatibility handoff; same origin still shares browser quota; needs explicit approval | Preferred architecture to evaluate if the owner approves an additional target              |
| Move to a suitable larger-capacity hosting service                                              | Could remove the immediate size constraint and provide explicit cache/header controls      | Domain/origin migration, operational ownership, cost, record migration and rollback all need design                 | Consider if growth exceeds a small dedicated practice site                                 |
| Drop old versions, remove playable content or increase the guard                                | Smaller short-term change                                                                  | Breaks approved retention/content guarantees or only hides the provider limit                                       | Not recommended; no such change is authorized                                              |

GitHub project sites normally use `https://<owner>.github.io/<repositoryname>`.
A separately approved project can therefore have a distinct path on the same
origin, rather than necessarily introducing a different origin. This is an
architectural inference, not a provisioned target or capacity approval.
[GitHub Pages site types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Compatibility requirements for a dedicated target

Do not simply replace catalogue URLs. The current v1 validator deliberately
requires `<package-id>/app/` relative to `/practice/index.json`. The publisher
also binds the manifest identity to its deployment base path; the installer
requires the exact package/version scope beneath that root.

If approved, prototype a small **fixed, reviewed handoff** at each existing
stable launcher path. It must keep the current v1 catalogue authoritative and
carry only validated play/locale intent, preserve the reviewed appearance
handoff if present, and never accept a user-supplied destination. New clients
could use a separately versioned, bounded hosting descriptor only after an
explicit compatibility design. Neither approach is implemented here.

The prototype must prove the one-Play journey, ordinary details view, original
FPV shortcut, EN/UK navigation and unavailable-target recovery for both old and
new clients. A browser-side handoff is not an HTTP redirect service and must be
tested with JavaScript disabled and offline; a visible fallback link is required.

Each actual application would own a narrow worker scope beneath its approved
target path. Workers cannot register on a different origin, and their default
scope cannot extend above their script directory without an appropriate server
header. Do not install an origin-wide worker to bridge the sites.
[MDN worker registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).

Changing a manifest ID/root is an installation migration, not an ordinary update.
Audit existing installed identities and record keys first, despite the current
empty public selection. Preserve old URLs and old working installations; explain
whether an existing icon remains functional or needs explicit reinstallation.
Never silently clear browser storage. Same-origin projects still share quota and
may share application record keys unless those are deliberately namespaced.

## Approval and acceptance boundary

Before implementation the owner must approve the hosting option, target identity,
operational owner, credentials approach, retention policy and any cost. Reuse the
existing reviewed bundle/publisher/release workflow; add a target adapter rather
than a competing publisher. Publication remains gated by real review evidence.

Acceptance requires: exact inventories for both sites, uploaded/downloaded hash
verification, stable identities, three-app online/offline relaunch, prior-version
retention, failed-update recovery, record preservation, v1 compatibility, broken-
target fallback and documented rollback. A target outage must not blank the
directory or invalidate a player's prepared app. None of these checks is waived
by this proposal.
