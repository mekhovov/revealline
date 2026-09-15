# Relay Rescue integration · v0.52.0

This candidate rebases the completed two-arena co-op delivery onto `origin/main` at `2b8521b`. That upstream source is version 0.51.1; its newest published stable edition at preparation time is v0.51.0. The original co-op checkpoint `38ad5618d9ad2ea4703f6b4d3bb12bfb102c5a50` remains on `codex/relay-rescue-pre-rebase-0.46.0` and in its qualified local playable snapshot. Historical phase receipts describe their original commits, not the rebased history.

## Integration and review

Only the co-op commits were rebased; the unrelated local baseline and dirty original checkout were not included. Version conflicts retain the upstream version until this synchronized 0.52.0 bump. The couch test helper combines the quote-safe body parser with upstream's fetch-response seam. The co-op-only simulation, rules, levels and comparison fixture match the qualified prior delivery. The merge-only comparison correction was explicitly restored during flattening.

Independent review checked the merged presentation/audio lifecycle, featured chapter fallback, build allowlist, validation and test sharding. Those upstream features remain present. Relay Rescue now has direct links in the main header and mode chooser. Two stale Field Kit menu assertions were updated to include upstream's existing Release explorer; the link was preserved.

## Research and bounded improvements

Primary sources were revisited on 15 September 2026:

- [SMG Studio's Moving Out playtest account](https://blog.playstation.com/2020/04/27/how-playtesting-improved-moving-out-out-on-ps4-today/) describes how instructions changed player behavior, and how consistent introductions and observed retries informed revisions. The Individual Cuts lobby previously promised head joining despite disabling it. The briefing now follows the selected capabilities, introduces small loops first, and agrees with the existing live start message. Retry feedback names the observed cause without blaming either player and reports the actual required objective progress.
- [Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) recommends reinforcing gameplay information through multiple distinguishable cues. A dashed ring and SLOWED label now follow the actual Support slow interval, including pause and reduced effects. An empty pulse earns no new assistance credit.
- [Doom Turtle's Ember Knights co-op account](https://news.xbox.com/en-us/2025/10/22/ember-knights-co-op-xbox/) emphasizes visible, useful complementary actions. We preserve the tested local protection rules and make their active result easier to read, rather than changing enemy physics from an unrelated game's tuning.

A browser check at 1280 × 720 reproduced a viewport problem: starting play scrolled the HUD off-screen. Compacting duplicate control headings/status and correcting the arena height budget keeps the team HUD, objective, whole arena and keyboard controls together. Pause content remains scrollable when constrained. This observation does not qualify every phone or physical controller.

## Gameplay evidence

The first rebased core run passed all 100 selected tests. The combined updated co-op, couch input/navigation and Field Kit check then passed all 207 tests with no failures, skips or cancellations. Lint, formatting, native formatting, content validation and motion syntax checks pass in the integration workspace. Selected behavior includes joint capture transactions, earlier impacts, support, survivor-preserving recovery, warning/commit pacing, obstacle sliding and public-command winning routes. An additional Standard Relay Yard route uses Boost for one player and ordinary movement for the other: both clear at 11.775 simulated seconds with no knockdowns, and exchanged assignments reproduce the same physical result. This is a rehearsed legal route, not a measured human completion time or success rate.

Actual desktop browser input checks include two-player pillar contact and tangent movement, safe banking, pause, retry, and unprotected crossings that down both players and spend exactly one shared reserve. Precise full-clear proofs remain simulation evidence until separately recorded as a complete browser journey. The stronger shared-field enemy balance from v0.46.0 is preserved. Timing-sensitive failures do not justify silently weakening one player's opposition or making every rehearsed route succeed at every difficulty.

## Release gate

The optional hosted snapshot step follows all six exact-source gates and all four test shards. It archives and builds the same checked-out commit, retaining original ZIP, manifest, release record, source TAR and checksum. It does not publish or move tags. Final source qualification, immutable source/tag identity, successful PR checks, original release assets, admitted v0.51.0 archive, selected Pages deployment, complete public byte audit and browser/offline checks are recorded in the release delivery evidence after completion. This document is not a claim that those pending public gates already passed.

This delivery remains two authored arenas with territory and stronghold templates, three difficulty presets and three cooperation configurations. It does not claim the six-mission campaign, saved co-op progression or broad human/device qualification from later phases.
