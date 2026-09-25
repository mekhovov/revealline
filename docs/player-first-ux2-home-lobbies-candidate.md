# UX2 Home and lobby compaction candidate

## Scope and base

- Base: `f6fea50063b1824d5e7f12b826697975194a171d` (the refreshed v0.112 Couch quick-start checkpoint).
- Local branch: `codex/ux2-shell-after-v112`.
- This is an unversioned local checkpoint. It was not pushed, merged, tagged, frozen, or published.
- The already-released Solo Pause hierarchy on this base is retained. Team's direct Pause catalogue, Help, Settings, and Sound order also remains intact; the new More disclosure is a lobby destination and is hidden when those shared tools move into Pause.

## Player-facing result

- Home keeps a single full-width Start/Continue action, followed by compact Missions, Collection, Settings, More, and Sound actions. Difficulty and actor appearance remain in the existing collapsed disclosure.
- Versus keeps its mode selector, player identities, and one-action Start. Actor style and difficulty live in the collapsed Match options disclosure; Advanced setup owns map, format, craft, steering, and time without duplicating control IDs. The ready lobby uses short player-facing copy; detailed rules remain in Match options and More.
- Team keeps its mode selector, artwork teaser, current arena, objective, and one-action Start. Play style, difficulty, actors, and created-pack loading live in Team options. Technical edition status moved into that disclosure. More exposes Home, legacy/new Team catalogue, About, and Releases in the lobby.
- Duplicate Versus library entry is visually suppressed only when the unified Missions browser owns the route. Historical and special-content anchors remain in the DOM and keep their existing behavior.
- Nested Couch routes now resolve the shared Releases catalogue correctly for source and frozen builds.

## Automated evidence

Evidence for the reconciled checkpoint:

- The first serial changed-test inventory reported 142 cases: 138 passed, one Versus mission-index wait expired under load, and three already-paused Team lifecycle cases exposed stale controller echo ownership after foreground return.
- The unchanged Versus case passed its focused rerun. The complete Team host now passes 77/77 after a lifecycle-neutral correction, and the controller-confirm guard passes 18/18 including its new held-Confirm/neutral/fresh-keyboard boundary.
- The Team-original fixtures delegate only approved compiled actor paths; their initial integrated run reached and passed all original-picture cases while preserving strict reveal-picture failures and exact retained artwork.
- The quick-start parity checks cover one-Confirm controller launch, native Confirm echo suppression, passive preparation/cancellation ownership, and the single owned Missions action stack.
- Team lobby keyboard coverage verifies collapsed Team options, explicit opening, Back-to-summary, and the retained mode destination. Mode departure and Pause retain explicit confirmation and opener contracts.
- ESLint, repository and native Prettier checks, validation, presentation-metadata validation, motion syntax, and exact diff checks are rerun on the final reconciled checkpoint. The ordinary build remains conditional on the shared release disk reserve.
- A source scan found no duplicate IDs in the Solo, Versus, or Team documents.

Two inventory assertions were stale on the untouched exact base and were corrected to the currently exposed 198-card opening catalogue and 279-card cross-library chooser. Production simulation code was not changed here.

## Browser evidence

The byte-identical UX2 patch was checked across Home, Versus, and Team in the local in-app Chromium browser before reconciliation. Start was the initial focus in each ready lobby. Solo rendered a compact two-column secondary menu, Versus kept Match options collapsed, and Team kept Team options collapsed while exposing its selected arena and objective. Team More exposed Home, the alternate catalogue, About, and Releases with correct nested-route URLs. Keyboard/controller behavior is covered by modeled host tests; this browser review is not physical touch or controller qualification.

## Reconciliation and limitations

- The candidate is based directly on the refreshed v0.112 Couch quick-start checkpoint. Its menu patch preserves the reviewed predecessor. The integrated Team-original fixture correction updates test transport only. The additional controller lifecycle gate preserves the ordinary Steam echo window, blocks a held Confirm across background return, and restores fresh keyboard control after a sampled neutral frame. Quick-start preparation/cancellation ownership and operation leases remain unchanged.
- The exact base already includes the released Solo Pause hierarchy, so the obsolete standalone Pause candidate was not replayed.
- Collection remains a Solo/global destination because Couch still has no safe deep link that opens Collection without changing the Solo shell or gallery owner. Therefore this checkpoint completes the compact Solo Home, Couch lobby/options, Pause retention, and nested Home/About/Releases work, but it does not yet complete a cross-mode Collection entry.
- The release links were browser/source tested; no public/frozen release was created from this candidate.
- Physical controller, Steam Deck hardware, browser touch, 200% zoom, and full production suites remain release qualification work.
