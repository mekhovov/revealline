# Continuous gameplay implementation

Implementation and follow-up refinements, 2026-10-05. Branch: `codex/snake-continuous-play`.

Menu UX baseline is preserved in commit `261db930d`, copied from the current
uncommitted `codex/unified-game-menus` checkout without modifying that checkout.

## Required behavior

- Shared Start/Continue/Next/Retry/Random/Skip enter play directly. Preserve Menu UX
  compact pause, settings return, focus graph and optional-package projections.
- Snake loss: 0.65s signal loss, final eight moves (nine compact visual snapshots,
  240ms/move), ready cue and automatic retry. Immediate Retry and cancellation.
- Victory: 5.2s core celebration then 5s cancellable auto-next; Next/Retry usable
  throughout. Retain core picture rewards; Snake celebrates the completed board.
- Host-owned cancellable transitions, fresh Confirm edges, no background or stale
  timer launch. Respect Team shared board and competitive match outcome semantics.
- Live per-step enemy totals, failed attempts included, no replay/import/demo
  awards. Transactional lineage counters, max backup merge, resumable cursors.
- Existing Collections gains global/per-game enemy cards; no Snake picture grants.
- Completion stars for verified Snake mission clears; higher ratings only for
  calibrated exact seed17 authored classic setups, with Solo/Team proof budgets.
- Fresh Snake profiles start Open Loop, then Twin Islands; keep old saves/links.
- New versioned mechanics: jammer, head-only lane attacks, latched relay shield,
  eight missions. Follow with perimeter/contour/rover pairs and ricochet/eroder/
  projectile guard pairs plus two finales. Preserve v1-v3 recipes/replays.

## Implemented phases

- Root: Snake host, per-step match observer, compact replay, integration, browser QA.
- UX agent: shared shell/lifecycle/preferences and non-Snake hosts/projections.
- Persistence agent: enemy statistics service/UI/backup and Snake ratings.
- Mechanics agent: v4 simulation/content/rendering and compatibility tests.

1. **Continuous play.** Shared transition controller and preferences; direct
   activation; native celebration, focused Next and cancellable countdown. Snake
   captures nine compact boundaries per board, shows native signal loss and the
   final eight moves, then retries the exact setup. Competitive outcomes keep
   their own termination rules and Rematch. Open Loop is the fresh default.
2. **Progress and Collections.** Transactional lineage counters observe actual
   simulation steps, including failed attempts. Existing Collections owns its
   pictures and gains totals, family portraits and game filters. Aggregate
   backups carry the statistics sidecar; repeated imports merge by maximum.
   Non-owning and restored-tab branches isolate future event cursors. Snake
   records retain completion stars and 249 explicitly calibrated exact setups;
   other seeds and ungraded modes keep honest completion/record presentation.
3. **Signal Tactics.** Eight v4 missions introduce/master jammer, lane and relay
   mechanics, then combine them. Live captions, optional field guides and sound
   cues teach their counterplay without adding a start gate.
4. **Expanded opponents.** Fourteen more v4 missions introduce/master perimeter,
   contour, rover, ricochet, eroder and projectile guard behavior, with two
   finales. The original 96 mission recipes and v1–v3 simulation remain intact.
   Studio cloning/import/export preserves v4 mechanics.

All source changes remain on the isolated implementation branch. No public
deployment has been performed.

## Follow-up refinements, 2026-10-05

- **Readable signal loss with a real information cost.** The jammer warns with
  an antenna cue and dashed amber arena edge, then replaces the whole playfield
  with an opaque loss screen for its existing four interference moves. Actor
  positions, snake movement, and internal geometry are hidden. A recovery count,
  pips, and the arena boundary remain visible. Pulse temporarily stabilizes the
  feed, reduced effects keeps the same information with static bands, and a
  terminal collision reveals the board. Existing simulation and replay identities
  remain unchanged.
- **Longer victories, no defeat fireworks.** The shared celebration lasts
  5,200 ms; the separate auto-next countdown remains 5,000 ms. The shared
  celebration mount requires a winning outcome, and Snake also suppresses
  confetti on loss. Immediate Next and Retry still skip the remaining delay.
- **Automatic replay inside Snake results.** Opening Results starts a looping
  preview of the existing final-eight-move snapshot buffer. It advances at
  240 ms per move with a short hold on the final frame. Pause replay holds the
  preview and cancels automatic progression without hiding the result menu.
  Preview playback never advances simulation, saves an attempt, grants awards,
  or rearms auto-next, and it stops advancing while the page is inactive.
- **Mobile action priority.** Snake Results keeps Next, Retry/Rematch, and Home
  in a fixed footer, with continuation status/countdown in that same footer.
  The preview is bounded by viewport height; descriptive content scrolls.
  Random, Choose mission, Collections, and the slower-pace offer sit in an
  expandable More options section. Next remains the initial win focus.
- **Statistics within their menus.** Pause/results use a compact disclosure
  showing current-run and lifetime totals; enemy-family text rows expand in
  place without stealing focus. Collections retains its portrait cards and
  filters. Non-Snake totals mount inside the actual result card, and the compact
  continuation control sits beside the primary action rather than outside the
  card as a detached column.
- **Reward pictures no longer own continuation.** Core victories show the
  result card immediately. Explicit View picture retains a reachable Next,
  Retry, Choose mission, and Results dock. Dock actions restore the result
  surface before forwarding native actions. Accepting a new attempt clears
  picture-only presentation, captions, celebration, and the owned arrival
  animation before painting the new run.

## Review map

| Area                           | Main sources                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Shared transition and settings | `game/ui/continuous-play.mjs`, `continuous-celebration.mjs`, `mode-play-shell.mjs`, `global-settings-view.mjs`                   |
| Snake flow and recording       | `game/snake/classic-app.mjs`, `classic-match.mjs`, `classic-recent-replay.mjs`, `classic-audio.mjs`                              |
| Other hosts                    | `game/app.mjs`, `game/couch/`, `optional-practice/civilian-flight/app.mjs`, `optional-practice/civilian-fpv/{app,world-app}.mjs` |
| Totals and portability         | `game/enemy-stats.mjs`, `game/ui/enemy-stats*.mjs`, `game/backup.mjs`, `game/coop/enemy-stats-ownership.mjs`                     |
| Grades                         | `game/snake/classic-ratings.mjs`, `classic-rating-calibrations.mjs`, `scripts/calibrate-snake-ratings.mjs`                       |
| New mechanics and content      | `game/snake/classic-core-v4.mjs`, `classic-catalogue-v4.mjs`, `classic-mechanic-guide.mjs`, `classic-view.mjs`                   |

## Verification record

### First-round baseline

The checks below were completed for commit `241a388ab` and its implementation
predecessors, before the follow-up refinements above. Their old 3.8-second timing
and production artifact describe that baseline, not a rebuilt current checkout.

- Final combined Snake, statistics, ownership, transition and audio group:
  **127 passing tests**, no failures (12.0 seconds locally).
- Production-host regression: ordinary Snake loss resumes after 3,000 ms with
  50 ms host frames (configured sequence 2,970 ms). Victory retains its full
  3,800 ms celebration and then its separate 5,000 ms countdown. Next/Retry
  remain direct throughout. See `verification/snake-continuous-play-measurements.json`.
- A synthetic 30,000-step attempt retains nine boundaries and opens the replay
  without reading input journals, replaying simulation, or cloning level recipes.
- Final root UI/replay/audio group: 37 passing tests, including pause/settings,
  controller cancellation, stale input, imported outcomes, and BFCache ownership.
- Final mechanics/Studio group: 52 passing tests, including 132 exact winning
  proofs for 22 missions × Solo/Team × three paces. These prove playability for
  their setups, not optimal routes or human difficulty calibration.
- Persistence tests cover duplicate events, failed attempts, bonus targets,
  repeated imports, independent backup lineages, session-only branches, unknown
  sidecars and ownership. Higher grades bind accepted setup, seed and revision.
- Real browser: direct Snake launch, crash replay/retry and cancellation,
  compact pause, settings return, EN/UK, muted audio, and layouts at 320×640 and
  740×360. Relay instructions remain visible during live play. Browser error
  logs were empty in these checks. Core Collections navigation reached the
  existing password gate; its integration is covered by host tests rather than
  a claim of a live authenticated walkthrough.
- Physical controller/touch hardware and broad human balance sessions were not
  available. Input paths are covered by deterministic host tests and browser UI
  checks; the new missions remain subject to normal playtesting feedback.

- Shared/non-Snake focused group: 109 passing checks. All nine optional-package
  runtime/source-admission/reproducibility checks pass. Four older Team menu
  regressions were updated for actual localized text nodes, compact labels and
  the new action order; their targeted rerun passes.
- Actual aggregate backup export and Collection Import/Undo host regressions
  pass, including the existing external-chapter snapshot boundary.
- Full `npm run validate` passes: EN/UK localization (12,934 messages), content
  validation, presentation inventory, and byte-identical reaction, audio, play
  shell, presentation assets, optional worker and Worlds visual projections.
- ESLint passes for every changed JavaScript module, and `git diff --check` is
  clean.
- Production build passes: 3,010 files, version 0.142.4, output
  `/private/tmp/revealline-snake-continuous-play-build`. Distribution SHA-256:
  `88a7bcd413ebc13096665c6a37dc9dd593870b61e9ec5727bab9c61dd0757cd6`.
  Free disk space was checked before building (5.9 GiB) and afterward (4.7 GiB).
  All 35 changed core runtime modules/styles match the final source, comparing
  syntax trees for the five modules compacted by the existing build process.

### Follow-up verification

- Snake host/UI regressions: 28 passing tests, including automatic result-preview
  playback, preview pause without gameplay/save mutation, footer action
  placement/focus, no loss celebration, and the full 5,200 ms celebration followed
  by a separate 5,000 ms countdown.
- Signal rendering, v4, and presentation regressions: 24 passing tests, including
  concealment during signal loss, Pulse stabilization, reduced effects, and the
  132 retained winning proofs. This verifies compatibility, not human difficulty
  calibration of the stronger blackout.
- Compact statistics UI: five passing focused tests. Shared transition and result
  work: 18 unit tests, six focused host checks, and nine optional-package checks
  passed. The generated optional play-shell projection was refreshed from its
  canonical shared sources.
- Real-browser Snake Results checks at 320×640 and 740×360 found no horizontal
  overflow and kept the action footer in view, including when More options was
  expanded. The final-eight-move preview started automatically inside Results.
- Combined Snake/shared/core group: **106 passing tests**. Optional SIM hosts:
  **73 passing tests**, including five new stalled-frame/focus regressions.
  Optional package admission, source closure, reproducibility and offline
  checks: **9 passing tests**. Team's two retained result checks and new
  stalled-result check pass.
- The main-game browser walkthrough exposed a null controller frame after an
  automatic Next dispatch. The update now rejects the obsolete sample after
  input is cleared or the attempt changes. Its production-host regression
  advances the full celebration/countdown and verifies the next simulation
  continues; direct picture-view Next, cancellation and failed loading pass.
  One ownership fixture timed out under concurrent test load and passed
  unchanged in isolation; it was not treated as a production success until
  that isolated verification.
- Core results were checked at 320×640 and 740×360: no horizontal overflow,
  a roughly 107px narrow action footer and 59px landscape action footer.
  The final landscape layout keeps the picture, score, stars, totals and all
  primary actions visible together; the narrow portrait layout does the same.
  Saved views: [core portrait](verification/core-results-mobile-320.jpg),
  [core landscape](verification/core-results-landscape-740.jpg), and
  [Ukrainian Snake result](verification/snake-results-uk-320.jpg).
  Picture-view Next and automatic Next entered playable missions with the
  previous picture cleared. Snake's Ukrainian mobile result was also checked.
- Full repository validation and scoped lint pass. The generated optional
  play-shell remains byte-identical. The final production build passes:
  3,010 files, version 0.142.4, distribution SHA-256
  `16333648bfd1ea457551ed7c83720c4a706061b9ce9b2a0e64162bfe1e963282`.
  Disk space was checked before building (2.8 GiB) and afterward (1.7 GiB).
  The earlier interim build missed the final landscape CSS and was replaced
  by this complete build from the frozen source. All 17 changed shipped runtime
  files match: 15 byte-identical and two compacted apps with identical syntax
  trees. Their manifest hashes/sizes and the distribution archive hash were
  independently verified. Gym remains in its optional package; its package
  admission and host checks are recorded above.

## Acceptance

At most one activation to play/continue/retry/advance; zero required activations
after ordinary Snake loss. No stale launch or duplicate awards. Replay cost must
not grow with attempt history. Preserve old recordings, setup-specific grades,
and backup imports. Verify EN/UK, narrow/short viewports, keyboard/gamepad/touch,
reduced effects, muted audio, offline closures and generated shared sources.
