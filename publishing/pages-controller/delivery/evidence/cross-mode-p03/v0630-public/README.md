# v0.63.0 — Field details public acceptance

[Play v0.63.0](https://mekhovov.github.io/revealline/releases/v0.63.0/site/game/). The paused Field details feature is accepted within the recorded public keyboard and responsive-layout scope. Players can inspect their mission, threats, exposed line, bonuses and available actions, read the full description, return to Pause and explicitly resume. **P03 navigation, P05 readability and the complete game remain unfinished.**

| Authority | Accepted identity |
|---|---|
| Frozen game source / tree | `3e47f60b9f9b4c5088410536d649ff595b2667eb` / `fd0138c0e5f71b8b25368878c1948f5bef14255d` |
| Source PR / merge | [PR155](https://github.com/mekhovov/revealline/pull/155) / `eca7f1a90e6f5526d8de3f669751e11c239edbbd` |
| Publisher PR / commit / tree | [PR157](https://github.com/mekhovov/revealline/pull/157) / `d97bea7cd435a55884eaa43586771e481de85fd7` / `60a4230a9f4a1dd119049f8e9a003757e8d2e00a` |
| Pages run / deployment / success status | `35433279357` / `6539128893` / `18557975370` |
| Immutable release | `391999066` |
| Hosted HTTP audit run | `35433600912` |
| Public inventory | 3,373 files / 643,901,139 bytes / 3,373 attempts; zero failures, retries or uninspected files |
| Inventory SHA-256 | `ddf7c16728d8ff917672134d0b9c8a8e3cf6e39b86710db25c5ad5a9d54ed195` |

The exact source passed 6,234 tests across 483 files in each of two hosted families, both using Node 20.19.6, plus the six source gates, production checks and ordinary build. Earlier focused Node 20/22 checks remain separate. The complete deployed inventory passed byte/hash/MIME verification and independent row reconciliation. The final authority refresh confirmed the publisher, deployment, Latest release, tag and all nine immutable asset descriptors unchanged.

The [original public observation](native-observation-r1.json) records actual keyboard journeys in Tactical and Arcade. Field details Read → text → Done → Back restored its Pause opener; an actual unfinished Arcade line stayed paused while its report was read. Large/Plain and Standard/Theme layouts were checked at 390×844 and 600×400 with reading and exit controls visible. Explicit Resume/Continue returned to the saved flight. Legal Arcade cuts reached 7.3% / 1,700 points / three lives, and capture completion requested a fresh direction. This was not a level-completion or public Team win→Next test.

The additive [explorer routing observation](native-routing-r1.json) records a fresh public explorer showing Current v0.63.0, five Tabs to the retained v0.62.1 Play link, Return to the admitted Archive30 route, its v0.62.1 title with Continue focused, and browser Back to the current explorer. This establishes keyboard routing and title reachability only; previous archive play remains separate. The original root acceptance and Field details observation are unchanged.

The original observation also retains unsuccessful input/resize attempts and their limits. Screenshots were inspected inline; no exported screenshot hashes are invented. Desktop browser resizing is not a physical-phone test. Physical controllers/touch, screen readers, zoom, full EN/UA, foreground lifecycle, listening, offline behavior, new backup/restore or configuration-import acceptance remain separate requirements.

[Root acceptance](root-acceptance.json) is the original scoped decision. The [originals ZIP](originals.zip) contains only the explicit allowlist and exact files named by the accepted evidence's pin lists. [The index](originals-index.json) records each original source path, byte length and SHA-256. [Privacy review](privacy-review.json) records exclusions. Original records are copied without reserialization; their earlier `publicAdmission:false` scope flags and runner paths remain intact. All raw stderr, signed-URL failure logs, nested transport archives and large public payload binaries are excluded. The Pages receipt has one byte-identical alias to its nine-authority input rather than a duplicate copy.

This is documentation of the existing acceptance, not another audit, test run, browser observation or release. The [v0.62.1 evidence](../v0621-public/README.md) remains unchanged. Next are the separate Team v0.64.0 and Replay v0.64.1 candidates, each requiring exact final integrated-source qualification before freeze, publication and public acceptance, followed by the remaining navigation/readability work and the ordered phases in the [execution register](../../../../../../docs/cross-mode-execution.md). Native stores and online multiplayer retain separate later gates.
