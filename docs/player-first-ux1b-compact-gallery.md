# UX1-B compact mission gallery candidate

This unversioned candidate is reconciled onto the v0.130 product source and keeps the complete mode-compatible mission catalogue visible while reducing the work needed to find and start a mission. It does not change publishing, release history, progression identity, simulation rules, or the underlying pack formats.

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

## Evidence limits

This is a draft, not a release. Browser screenshots, physical touch hardware, and a physical controller are not qualified here. The inherited broad Solo, Versus, and Team host cohorts contain pre-existing catalogue-count/revision or presentation-fixture expectations from an earlier Journey inventory; this candidate does not weaken those assertions. Focused current-source checks qualify the changed gallery and controller paths while broader fixture reconciliation remains separate release work. The candidate does not redesign mission Details, results, Pause, HUD, Collection records, or gameplay teaching; those remain in UX2-UX5.
