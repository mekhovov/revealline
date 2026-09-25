# UX2 Home and lobby compaction — v0.115.0

## Scope and base

- Accepted predecessor source: `10190539b243c9edc78eeef9dba174041409aaf2`.
- Release branch: `codex/ux2-shell-current-main`.
- This is the versioned v0.115.0 source candidate. It is not accepted until the
  protected merge, immutable release, Pages deployment, public-byte audit and
  scoped public player journey all pass.
- Solo, Versus and Team now share the Pause order: Resume, Retry/Restart, Missions, How to play, Settings, and Home. Match/Team setup, mode changes and More remain secondary. Existing leave safeguards, Team's explicit retry confirmation, and exact opener restoration remain intact. Versus Retry uses one deliberate action and the existing retained-picture preparation lease; it does not add another confirmation.

## Player-facing result

- Home keeps a single full-width Start/Continue action, followed by compact Missions, Collection, Settings, More, and Sound actions. Difficulty and actor appearance remain in the existing collapsed disclosure.
- Versus keeps its mode selector, player identities, and one-action Start. Actor style and difficulty live in the collapsed Match options disclosure; Advanced setup owns map, format, craft, steering, and time without duplicating control IDs. The ready lobby uses short player-facing copy; detailed rules remain in Match options and More.
- Team keeps its mode selector, artwork teaser, current arena, objective, and one-action Start. Play style, difficulty, actors, and created-pack loading live in Team options. Technical edition status moved into that disclosure. More exposes Home, legacy/new Team catalogue, About, and Releases in the lobby.
- Versus Pause removes lobby-only prose and setup controls, exposes the six common player actions, and keeps quick Sound in the compact two-column action grid. Team Pause reuses its existing Help and Settings controls in the same direct hierarchy and exposes a guarded Home action; no duplicate Settings or Help owner is introduced.
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
- The Pause correction adds a focused two-mode contract test. Versus proves the six visible actions, one-action retained-setup Retry, and guarded Home return. Team proves the direct Help/Settings/Home order, exact Settings return, and the retained Home discard safeguard. The new test passes 2/2. Focused legacy checks for paused Team Help, modeled-controller Settings/Sound, and Versus child-screen restoration also pass.

Two inventory assertions were stale on the untouched exact base and were corrected to the currently exposed 198-card opening catalogue and 279-card cross-library chooser. Production simulation code was not changed here.

## Browser evidence

The reconciled UX2 patch was checked across Home, Solo, Versus, and Team in local Chromium at 1440×900, 390×844, and 844×390. Start was the initial focus in each ready lobby; Settings and More returned to their exact openers. Direct Solo, Versus, and Team starts reached play. On short landscape, every Versus Pause action is at least 48 pixels high and the six-action hierarchy ends at 353 CSS pixels with no horizontal overflow. Team's direct Pause actions are at least 44 pixels high; Resume is focused and the Help/Settings/Home row remains inside the 390-pixel viewport. Versus Retry starts the retained deterministic setup with one click, and Settings/Help/Home all restore their exact paused opener. Team Settings and guarded Home do the same. No page or console errors were recorded. Keyboard/controller behavior is covered by modeled host tests; browser clicks are not physical touch or controller qualification.

## Reconciliation and limitations

- The v0.115.0 release is reconciled onto the accepted v0.114.0 source. Its menu patch preserves the reviewed predecessor, newer Horizon content, production assets, and publication history. The integrated Team-original fixture correction updates test transport only. The additional controller lifecycle gate preserves the ordinary Steam echo window, blocks a held Confirm across background return, and restores fresh keyboard control after a sampled neutral frame. Quick-start preparation/cancellation ownership and operation leases remain unchanged.
- The exact base already includes the released Solo Pause hierarchy, so the obsolete standalone Pause candidate was not replayed.
- Collection remains a Solo/global destination because Couch still has no safe deep link that opens Collection without changing the Solo shell or gallery owner. Therefore this checkpoint completes the compact Solo Home, Couch lobby/options, Pause retention, and nested Home/About/Releases work, but it does not yet complete a cross-mode Collection entry.
- The release links and shared Pause hierarchy were browser/source tested. Public
  and frozen-release verification remains part of the v0.115.0 acceptance gate.
- Physical controller, Steam Deck hardware, browser touch, 200% zoom, and full production suites remain release qualification work.
