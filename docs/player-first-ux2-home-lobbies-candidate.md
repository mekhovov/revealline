# UX2 Home and lobby compaction candidate

## Scope and base

- Base: `28cb6149` (the exact unversioned Couch quick-start checkpoint).
- Local branch: `codex/ux2-shell-after-quickstart`.
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

- 133/135 final sequential shell, quick-start, Team, Versus, release-link, and default-entry checks passed. The two failures are inherited timing-sensitive Team lifecycle checks: their three-case focused run passed 3/3 on this candidate while the untouched exact base failed the same focused run 0/3. No production lifecycle code is changed by this candidate.
- The quick-start parity checks cover one-Confirm controller launch, native Confirm echo suppression, passive preparation/cancellation ownership, and the single owned Missions action stack.
- Team lobby keyboard coverage verifies collapsed Team options, explicit opening, Back-to-summary, and the retained mode destination. Mode departure and pause tests retain their existing explicit confirmation and opener contracts.
- A separate sequential cross-mode run passed 214/214 before the final duplicate-control removal and the CSS ownership assertion; the directly affected quick-start and shell checks were then rerun above.
- ESLint, repository and native Prettier checks, validation, presentation-metadata validation, and ordinary build passed.
- `node --check` passed for both Couch runtime modules, the shared shell, and the release resolver. A source scan found no duplicate IDs in the Solo, Versus, or Team documents.

Two inventory assertions were stale on the untouched exact base and were corrected to the currently exposed 198-card opening catalogue and 279-card cross-library chooser. Production simulation code was not changed here.

## Browser evidence

Home, Versus, and Team were checked separately in the local in-app Chromium browser. Start was the initial focus in each ready lobby. Solo rendered a compact two-column secondary menu, Versus kept Match options collapsed, and Team kept Team options collapsed while exposing its selected arena and objective. Team More exposed Home, the alternate catalogue, About, and Releases with correct nested-route URLs. Keyboard/controller behavior is covered by modeled host tests; this browser review is not physical touch or controller qualification.

## Reconciliation and limitations

- The candidate is based directly on the Couch quick-start checkpoint. It preserves quick-start's preparation/cancellation ownership, keeps the loading cancellation action hidden outside an active operation, and does not change operation leases.
- The exact base already includes the released Solo Pause hierarchy, so the obsolete standalone Pause candidate was not replayed.
- Collection remains a Solo/global destination because Couch has no safe deep link that opens Collection without changing the Solo shell or gallery owner. Adding a real cross-mode Collection entry belongs in the shared-shell follow-up.
- The release links were browser/source tested; no public/frozen release was created from this candidate.
- Physical controller, Steam Deck hardware, browser touch, 200% zoom, and full production suites remain release qualification work.
