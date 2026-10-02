# Running enemies

**Running enemies** is a separate gameplay checkbox in pre-start setup and **Settings → Display & Language**, beside the enemy presentation options. It defaults to **Off** and remembers an explicit choice in the browser across Solo, Versus and Team.

Turning it on adds up to six runners to the next attempt. Touch or enclose them for Bonus Hunt points. The level keeps its original capture goal, objectives, ordinary enemies and other rules. Already authored Hunt missions keep their original population and objective; this checkbox does not replace them. Off means “keep the level as designed.”

The control distinguishes humanoids in the current attempt from the choice for the next start. Changing it does not discard an active attempt. **Continue** and ordinary **Retry** keep the accepted attempt recipe. Use **Restart with this setting** to explicitly replace the current attempt using the latest choice, through the host's normal restart/departure flow.

Blood, brutal destruction, enemy remains and character reactions have independent controls. Enabling those presentation options does not add enemies. Running enemies work with clean effects and blood disabled. A failed preference save is reported as session-only; existing corrupt or future-format saved data is preserved.

## Implementation

- `game/hunt/running-enemy-preferences.mjs` owns only prospective intent under `revealline.running-enemies.v1`. Same-page controls and validated storage events synchronize the choice; hosts own accepted attempts.
- Hosts resolve the selected source and difficulty, apply gameplay tuning once, then call `prepareRunningEnemyLevel` or `prepareTeamRunningEnemies`. Placement uses the actual geometry and reachable playable field, without a mission allowlist. Future valid levels use this same pipeline. An impossible custom level with no safe reachable field is explicitly rejected; the requested setting is not silently ignored.
- Solo/Versus supplemental attempts use level v10/core v11/replay v12. The descriptor retains the original base version and identity, complete finite actor recipes and Bonus Hunt definition. Historical simulation mechanics remain selected by the base version. Team uses its separately versioned supplemental recipe.
- Replay/restore compares the exact reconstructed source, tuning, classes and supplemental recipe. Ordinary progress keeps its original mission owner. Company rewards use an exact runtime mapping to the unchanged base identity, preserving existing reward promises; replay, performance and Hunt records retain the actual supplemental identity.
- Authored scenario versions remain unchanged. Optional Encounter Guide practice is unavailable for a supplemental attempt because its older scenario envelope cannot preserve that attempt; ordinary authored lessons continue to work.

## Evidence and limits

[Solo/Versus coverage](evidence/running-enemies-coverage.json) records working-tree observations based on `3636201d3`, with unchanged runtime hashes during the final pass:

- All 47 registered Solo/Versus route sources at Standard, all 18 Company source editions, and 204 unique serialized level definitions discovered in 216 JSON files.
- The default 91 missions also at Gentle and Expert in both modes.
- 8,773 source/mode memberships, deduplicated into 1,093 initial runs: 1,087 supplemental identities and six preserved authored Hunt identities. Zero preparation/projection issues or initial actor-count mismatches. Every inspected added layer contained six runners; the largest inspected total population was 22.

[Team coverage](evidence/running-enemies-team-coverage.json) records all 13 active routes plus two starter levels: 125 missions, 119 supplemental layers and six preserved authored Hunt missions, with zero structural failures.

These observations compile sources, prepare the finite population and inspect initial core/public views. They do not simulate playthroughs or qualify every level's balance, catchability, accessibility or device performance. Arbitrary browser-installed and future/imported levels are not an enumerable inventory. The manual browser check of **A return in reserve** showed six runners, **Bonus 0/6**, and the unchanged **78%** objective. Versus started with **Bonus 0/6** on both boards and no observed warnings or errors. After correcting the Team picture binding, **Twin landings** also started with six visible runners and its original **60%** objective; an unrelated saved Team hunt was kept.

Automated suites are **WAIVED_SKIPPED_NOT_PASSED** under `publishing/test-policy.json`. New preference regression cases are authored but unrun. Full lint passed; subsequent host fixes passed scoped lint and syntax checks. The added documentation and preference test pass formatting, scoped lint and syntax checks. Full repository formatting reported 26 pre-existing warnings in untouched files. Full `npm run validate` passed: EN/UK localization (12,487 messages; 8,971 references), content references (2,670 files) and presentation metadata. The normal in-memory build preparation and committed-source inspection will be recorded separately from these structural receipts; ZIP and expanded-site generation require more disk space. No publication is implied by these working-tree observations.
