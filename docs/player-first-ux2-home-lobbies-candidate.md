# UX2 Home and lobby compaction candidate

## Scope and base

- Base: `1fd63337ba1d1635d117877bf16c3e95d83a4167` (the clean post-PR370 Couch quick-start checkpoint).
- Local branch: `codex/ux2-shell-post-v112`.
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

- 70/70 directly affected shell, quick-start, Versus, release-link, and default-entry checks passed, plus the focused Team lobby keyboard/Back case passed 1/1.
- The quick-start parity checks cover one-Confirm controller launch, native Confirm echo suppression, passive preparation/cancellation ownership, and the single owned Missions action stack.
- Team lobby keyboard coverage verifies collapsed Team options, explicit opening, Back-to-summary, and the retained mode destination. Mode departure and pause tests retain their existing explicit confirmation and opener contracts.
- A broader 164-check diagnostic passed 144 and exposed 20 inherited failures outside the UX2 delta: three timing-sensitive Team lifecycle checks and seventeen Team-original fixture checks that reject current registered actor assets before reaching the changed copy assertions. The untouched exact base reproduced the Team-original fixture failure 0/2.
- ESLint, repository and native Prettier checks, validation, presentation-metadata validation, and ordinary build passed.
- `node --check` passed for both Couch runtime modules, the shared shell, and the release resolver. A source scan found no duplicate IDs in the Solo, Versus, or Team documents.

Two inventory assertions were stale on the untouched exact base and were corrected to the currently exposed 198-card opening catalogue and 279-card cross-library chooser. Production simulation code was not changed here.

## Browser evidence

The byte-identical UX2 patch was checked across Home, Versus, and Team in the local in-app Chromium browser before reconciliation. Start was the initial focus in each ready lobby. Solo rendered a compact two-column secondary menu, Versus kept Match options collapsed, and Team kept Team options collapsed while exposing its selected arena and objective. Team More exposed Home, the alternate catalogue, About, and Releases with correct nested-route URLs. Keyboard/controller behavior is covered by modeled host tests; this browser review is not physical touch or controller qualification.

## Reconciliation and limitations

- The candidate is based directly on the clean post-PR370 Couch quick-start checkpoint. Its runtime and test patch, excluding this refreshed evidence file, matches the reviewed predecessor exactly. It preserves quick-start's preparation/cancellation ownership, keeps the loading cancellation action hidden outside an active operation, and does not change operation leases.
- The exact base already includes the released Solo Pause hierarchy, so the obsolete standalone Pause candidate was not replayed.
- Collection remains a Solo/global destination because Couch has no safe deep link that opens Collection without changing the Solo shell or gallery owner. Adding a real cross-mode Collection entry belongs in the shared-shell follow-up.
- The release links were browser/source tested; no public/frozen release was created from this candidate.
- Physical controller, Steam Deck hardware, browser touch, 200% zoom, and full production suites remain release qualification work.
