# UX1-B compact mission gallery — v0.133.0

This v0.133.0 candidate is reconciled onto the v0.130 product source and keeps the complete mode-compatible mission catalogue visible while reducing the work needed to find and start a mission. Versions v0.131.0 and v0.132.0 were already reserved by separate draft features when this release was allocated. It does not change publishing, release history, progression identity, simulation rules, or the underlying pack formats.

## Player contract

- The gallery remains grouped in authored campaign order. A horizontal campaign rail jumps to the first card in a campaign without filtering the rest of the gallery.
- An explicit advanced campaign filter remains available. Choosing a campaign shortcut clears that filter and restores the complete gallery.
- Cards are image-led in compact and expanded layouts. They expose structured current, completion, picture, and availability states through stable data attributes rather than parsed display text.
- Ready content uses one **Play** action. Downloadable content uses one **Download & play** action and starts the exact selected mission after authentication and preparation complete.
- A repeated activation of the same preparing card joins the owned operation and cannot start a second request. Activating another mission, changing filters, closing the chooser, or pressing Back retires the stale operation. Late completions cannot reclaim focus or launch content.
- Solo, Versus, and Team now route controller Confirm through the same duplicate-input guard. Couch no longer suppresses the synthetic click that it just accepted from a controller, and preparing cards no longer expose a controller-focused Cancel action.
- An installed pack may refresh its catalogue row during preparation. The chooser resolves the fresh row with the same exact identity before launch, rather than requiring a second action or launching a stale row.
- The selected mission and scroll position are retained across chooser returns and failed host handoffs.
- Keyboard and D-pad movement continue to use the shared spatial grid. Campaign shortcuts and gallery controls meet the 44 CSS pixel target. Touch uses the same visible actions.
- Mission previews decode near the scrollport. The fallback used when intersection observation is unavailable is bounded to twelve visible/nearby cards and releases offscreen resources.

## Responsive layout

The compact gallery uses two columns on ordinary phones and short landscape, three on tablets, four on compact desktops, and up to six on wide displays. Large-text and viewport rules can reduce columns. The mission card remains the stable focusable element while its preview and status update.

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
- current v0.130 Versus inventory and handoff expectations: 19/19 host cases pass with all 285 compatible mission identities and the exact `whole-spatial-v11` route.

## Evidence limits

This is a release candidate, not a public release. Browser screenshots, physical touch hardware, and a physical controller are not qualified here. The repository's committed temporary fast-release policy waives the long automated suites; it does not turn them into passing evidence. Focused current-source checks qualify the changed gallery and controller paths. A broader current-source run found that the FPV theme advanced to revision 82 while Team's exact picture-binding policy still ends at revision 79; that production drift remains a release blocker and must be corrected without weakening Team assertions before this candidate can publish. The candidate does not redesign mission Details, results, Pause, HUD, Collection records, or gameplay teaching; those remain in UX2-UX5.
