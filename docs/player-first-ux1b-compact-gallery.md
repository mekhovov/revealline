# UX1-B compact mission gallery — published v0.141.1

Status update, 26 September 2026: PR #590 shipped as immutable `v0.141.1`. It is an intermediate
GitHub release that was not selected directly on Pages; the cumulative `v0.141.2` Pages release
retains this gallery. The candidate preparation and evidence below are preserved at their recorded
cutoff.

The v0.141.1 candidate was prepared on exact `main` parent
`b4ef4b3024675bd8e12b13af28215553707d1bff`, which retains the accepted v0.141.0 publishing
controller `44a6ce672632a2d30cbf94374b172e213b75063c` and exact product source
`5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb`. PR #673 selected the immutable
release after Archive94 admitted v0.132.5. Pages run `36246645007` then verified
1,877 files / 630,364,265 bytes with zero retries or failures. The player-first
gallery first passed an
exact-head focused gate as the former v0.133.0 candidate at
`38271ab0314a1aed17792286af45d5c9b2b62628`; that result is retained as
predecessor evidence and does not qualify this rebased source. This candidate
keeps the complete mode-compatible mission
catalogue visible while reducing the work needed to find and start a mission. It
advances the candidate identity to v0.141.1 without changing publishing, release
history, progression identity, simulation rules, or the underlying pack formats.

## Player contract

- The gallery remains grouped in authored campaign order. A horizontal campaign rail jumps to the first card in a campaign without filtering the rest of the gallery.
- An explicit advanced campaign filter remains available. Choosing a campaign shortcut clears that filter and restores the complete gallery.
- Cards are image-led in compact and expanded layouts. They expose structured current, completion, picture, and availability states through stable data attributes rather than parsed display text.
- Ready content uses one **Play** action. Downloadable content uses one **Download & play** action and starts the exact selected mission after authentication and preparation complete.
- A repeated activation of the same preparing card joins the owned operation and cannot start a second request. Activating another mission, changing filters, closing the chooser, or pressing Back retires the stale operation. Late completions cannot reclaim focus or launch content.
- Solo, Versus, and Team now route controller Confirm through the same duplicate-input guard. Couch no longer suppresses the synthetic click that it just accepted from a controller, and preparing cards no longer expose a controller-focused Cancel action.
- An installed pack may refresh its catalogue row during preparation. The chooser resolves the fresh row with the same exact identity before launch, rather than requiring a second action or launching a stale row.
- The selected mission and scroll position are retained across chooser returns and failed host handoffs. Campaign-rail focus and its horizontal position survive live catalogue refreshes by exact campaign identity.
- Keyboard and D-pad movement continue to use the shared spatial grid. Campaign shortcuts and gallery controls meet the 44 CSS pixel target. Touch uses the same visible actions.
- Mission previews decode near the scrollport. The fallback used when intersection observation is unavailable is bounded to twelve visible/nearby cards and releases offscreen resources.

## Responsive layout

The compact gallery uses two columns on ordinary phones, three columns at 601–899 CSS pixels including short-landscape viewports, four on compact desktops, and up to six on wide displays. Large-text and viewport rules can reduce columns. The mission card remains the stable focusable element while its preview and status update.

## Focused evidence

The candidate adds or updates focused coverage for:

- complete-gallery campaign shortcuts and exact campaign jumps;
- advanced-filter recovery through the campaign rail;
- structured current, completion, picture, and availability states;
- one-action preparation, repeated activation suppression, inline retry, Back cancellation, and stale intent retirement;
- bounded fallback preview decoding;
- Solo one-action launch and failed-download retry while preserving the current flight;
- Versus optional-pack preparation and exact mission replacement behavior;
- image-led compact CSS, responsive columns, and 44 pixel campaign shortcuts;
- retained selection, scroll, opener, and native input ownership.
- real Versus controller activation, including failed download, one owned Retry, repeated-Confirm suppression, and automatic play after preparation;
- real Team controller activation against the current Journey presentation fixture.
- the merged v0.132.5 source's Versus inventory and handoff expectations retain all 285 compatible mission identities and the exact `whole-spatial-v11` route.
- the merged v0.132.5 source's Solo inventory and handoff expectations retain 285 compatible identities and the exact `whole-spatial-v11` route.
- the merged v0.132.5 source's Team inventory, refresh, cancellation, and recovery expectations retain 288 compatible identities under exact current FPV revision 90 while retaining revisions 58–89.
- Team picture-binding and imported-map compatibility coverage continues to require the exact current presentation while preserving retained-history recovery.
- on the exact v0.132.5 product base `a8881ac17e44f38fb1e9dc15428899992727cc78`, the complete sequential focused audit passed 160/160. That run includes 4/4 Journey continuation-caption cases, 2/2 Team localization/controller cases, all compact-gallery unit and host coverage, and the revision-90 Team inventory continuation. The candidate then rebased cleanly over controller-only selector merge `8f7ea5540d6851fb2d6d77a42c899e071e65e52a` with no overlapping paths.
- after the predecessor became public, the candidate rebased cleanly onto selector merge `44a6ce672632a2d30cbf94374b172e213b75063c`. The exact current-source gallery/input cohort passes 155/155; validation covers 1,244 files and presentation revision 91; localization verifies 9,932 messages and 7,926 references; scoped lint, formatting, and diff checks pass.
- at the candidate cutoff, the pushed exact-head focused and release-ready gates still had to pass
  for the v0.141.1 PR head before merge. The temporary fast-release policy waived automated test
  suites for this change; those skips were not passes. The immutable v0.141.1 release subsequently
  completed, and v0.141.2 became the selected cumulative Pages release.
- local browser review verified the compact four-column desktop gallery, image-led cards, campaign rail, horizontal and vertical keyboard movement, Escape return, and an in-place English-to-Ukrainian refresh with localized campaign titles and actions.

## Evidence limits

The release is immutable, while the browser check remains desktop interaction evidence rather than
physical touch hardware or physical-controller qualification. The repository's committed temporary
fast-release policy waived the long automated suites; it did not turn them into passing evidence.
Focused source checks qualify the changed gallery and controller paths. The cumulative public
v0.141.2 release retains the gallery, the accepted Team binding and later community hardening. This
feature does not redesign mission Details, results, Pause, HUD, Collection records, or gameplay
teaching; those remain in UX2-UX5.
