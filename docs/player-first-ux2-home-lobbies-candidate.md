# UX2 Home and lobby compaction candidate

## Scope and base

- Base: `f54a6ecbdf329c7fd175d90ec258537d035c72e7` (`v0.110.1`).
- Local branch: `codex/ux2-home-lobbies-compact`.
- This is an unversioned local checkpoint. It was not pushed, merged, tagged, frozen, or published.
- Pause-specific markup and mission-gallery implementations remain outside this candidate. Team's retained Pause catalogue, Help, Settings, and Sound order remains direct; the new More disclosure is hidden when the shared tools move into Pause.

## Player-facing result

- Home keeps a single full-width Start/Continue action, followed by compact Missions, Collection, Settings, More, and Sound actions. Difficulty and actor appearance remain in the existing collapsed disclosure.
- Versus keeps its mode selector, player identities, and one-action Start. Actor style, difficulty, map, format, craft, steering, and time live in Match options. The ready lobby now uses short player-facing copy; detailed rules remain in Match options and Help.
- Team keeps its mode selector, artwork teaser, objective, and one-action Start. Arena, play style, difficulty, actors, and created-pack loading live in Team options. Technical edition status moved into that disclosure. More exposes Home, legacy/new Team catalogue, About, and Releases in the lobby.
- Duplicate Versus library entry is visually suppressed only when the unified Missions browser owns the route. Historical and special-content anchors remain in the DOM and keep their existing behavior.
- Nested Couch routes now resolve the shared Releases catalogue correctly for source and frozen builds.

## Automated evidence

Passed on this checkpoint:

- 83/83 focused player-host checks across release links, Home return behavior, Team briefing variants, Team entry memory, responsive focus recovery, Team discovery input, Steam Deck Confirm ownership, and touchscreen/controller host behavior.
- 4/4 focused Versus shell checks for lobby/setup reachability, controller setup/Help boundaries, markup ownership, and controller Help reading.
- 1/1 focused Team lobby keyboard check, including collapsed Team options, explicit opening, Back-to-summary, and the retained mode destination.
- 12/12 Team default-entry/legacy/catalogue/controller checks.
- ESLint, repository Prettier check, validation, presentation-metadata validation, and ordinary build.
- `node --check` for both changed Couch runtime modules.

Known baseline test failures were reproduced on the untouched base and were not classified as candidate regressions: the queryless Versus library fixture currently expects 201 cards while the accepted inventory exposes 279; timing-based controller/menu fixtures can also observe later simulation ticks under local load. Production simulation code was not changed here.

## Browser evidence

The local candidate was inspected in the in-app Chromium browser at:

- 1280 × 800 desktop,
- 390 × 844 portrait,
- 844 × 390 short landscape.

Home, Versus, and Team were checked separately. Start remained visible or became the focus-owned scroll destination; all inspected primary actions measured at least 44 CSS pixels high. Home's measured action heights were 44–64 px, Versus 48–64 px, and Team 44–64 px. Both Couch lobbies retained scrollable content rather than shrinking controls. Keyboard/controller behavior is covered by modeled host tests; these browser checks are pointer/visual checks, not physical touch or controller qualification.

## Reconciliation and limitations

- The queued Couch quick-start work also edits `game/couch/index.html`, `game/couch/couch.css`, and likely preparation controls. Reconcile its preparation/cancellation ownership before publication. This candidate deliberately retains explicit cancellation while loading and does not change operation leases.
- Collection remains a Solo/global destination because Couch has no safe deep link that opens Collection without changing the Solo shell or gallery owner. Adding a real cross-mode Collection entry belongs in the shared-shell follow-up.
- The release links were browser/source tested; no public/frozen release was created from this candidate.
- Physical controller, Steam Deck hardware, browser touch, 200% zoom, and full production suites remain release qualification work.
