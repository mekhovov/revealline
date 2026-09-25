# UX1-B compact mission gallery candidate

This stacked, unversioned candidate keeps the complete mode-compatible mission catalogue visible while reducing the work needed to find and start a mission. It is based on the exact UX1-A2 candidate and does not change publishing, release history, progression identity, simulation rules, or the underlying pack formats.

## Player contract

- The gallery remains grouped in authored campaign order. A horizontal campaign rail jumps to the first card in a campaign without filtering the rest of the gallery.
- An explicit advanced campaign filter remains available. Choosing a campaign shortcut clears that filter and restores the complete gallery.
- Cards are image-led in compact and expanded layouts. They expose structured current, completion, picture, and availability states through stable data attributes rather than parsed display text.
- Ready content uses one **Play** action. Downloadable content uses one **Download & play** action and starts the exact selected mission after authentication and preparation complete.
- A repeated activation of the same preparing card joins the owned operation and cannot start a second request. Activating another mission, changing filters, closing the chooser, or pressing Back retires the stale operation. Late completions cannot reclaim focus or launch content.
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

## Evidence limits

This is a stacked draft, not a release. Browser screenshots, physical touch hardware, and a physical controller are not qualified here. The candidate does not redesign mission Details, results, Pause, HUD, Collection records, or gameplay teaching; those remain in UX2-UX5.

## v0.110.1 stack reconciliation

The local release candidate now stacks UX1-A1, UX1-A2, and this gallery on the exact accepted v0.110.1 source. It retains the current `whole-spatial-v9` catalogue, the 279-row Solo/Versus inventory, and current Team revision-74 picture authority.

Two cross-layer corrections were required. Read-only remote Journey sources now report no completion when they intentionally have no progress profile, while real profile-backed sources still resolve exact earned originals. Classic cards also remove their UI-only rules-edition marker before the immutable release-index installer verifies the source record. The complete focused rewards group passes 35/35 and the reconciled gallery/remote-host group passes 159/159; lint, formatting, native formatting, validation, presentation metadata checks, motion-lab syntax, and an ordinary build pass. Physical-device, comprehensive offline, and full long-suite qualification remain release-stage evidence.
