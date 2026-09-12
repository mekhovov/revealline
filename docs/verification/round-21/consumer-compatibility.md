# Round 21 portable encounter compatibility

These checks cover the current source increment after frozen v0.10.0. They are scoped automated checks, not the final source gates or a release/browser/device certification. No frozen release, package version or content index was changed by this work.

## Preserved v0.10 oracle

Before changing consumers, all **743 regular files** in the previously extracted v0.10.0 source tree were compared byte for byte with `releases/v0.10.0/source.tar`. The fixture generator imported only those archived modules. Provenance:

- Tag: `v0.10.0`; source commit: `40ae9d23ad8737c4f77f9cc07923948133b7c09d`.
- Source archive SHA-256: `cfc48dd29d71eefaef128a839a38f2f1302ec5f63a3994742adb0cf84242eeab`.
- New fixture: [compatibility-v0100.json](../../../game/test/fixtures/compatibility-v0100.json), canonical semantic SHA-256 `d1e58e7c23006d761a6dfc503e4476f079285e773fda20ef8b3ac24b2940151b`.
- Formatted fixture: 58,779 bytes; file SHA-256 `b7b2d916ca95ae47e2df274502d5379cf9d532e648d8f095a2a535b9097ac94f`.
- One-time generator: `.cache/round-21/create-v0100-fixture.mjs`. Ordinary tests need neither this cache nor Git/archive access.

The six new oracle tests replay an original first-campaign completion under each turning policy, compare the entire exported replay, verify asynchronously, restore two suspended live cuts, and compare the old player-library export, campaign key, completion variants, chapter continuation and appearance milestones. Expected data was emitted by v0.10.0 before the new consumer code; no previous golden fixture or proof expectation was regenerated. Earlier v0.6/v0.7 compatibility suites also pass in the scoped run. See the separate [v0.10 archive/rebuild evidence](../round-20/integrity-notes.md).

## New dispatch and boundaries

| Existing maps                                  | Staged encounter maps                             |
| ---------------------------------------------- | ------------------------------------------------- |
| `xonix-level.v1` / `xonix-core.v2`             | `xonix-level.v2` / `xonix-core.v3`                |
| `xonix-replay.v3` / `fnv1a64-state-v2`         | `xonix-replay.v4` / `fnv1a64-state-v3`            |
| Pack v1 or v2; existing optional goals         | Pack v3; required `masteries: []`                 |
| Existing campaign/map/board/record projections | Campaign identity includes the actual new ruleset |

The new checkpoint hashes every leaf of the normalized encounter descriptor and the entire 14-field authoritative encounter state. A forged, internally consistent checksum cannot inject a phase or defeat: reconstruction compares it with the state produced by legal recorded inputs. Tests mutate every state field and every descriptor leaf. Old maps acquire no empty encounter property or checksum section.

Sessions, player libraries, pack libraries, progress and complete backups retain their existing outer formats. Mixed old/new expansions round-trip together. Invalid version pairs fail before adoption; session-pair validation also runs before backup image decoding. Every campaign uses one simulation version. Changed encounter configuration cannot restore under the original installed campaign, while palette substitutions preserve simulation identity. Encounter maps can earn ordinary local progress, pictures and scores; they cannot acquire optional mastery authority.

The existing generic replay player and continuation helpers need no production change. Direct `verifyReplayAsync` now owns and validates its replay before its first yield, closing a pre-existing caller-mutation window. Existing prepared boundaries, cancellation and replay-only reward exclusions remain in force.

## Executed checks

| Check                                                                                                                         | Actual result      |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| New v0.10 oracle                                                                                                              | 6 tests            |
| New encounter replay/session/progress/catalog consumers                                                                       | 12 tests           |
| New encounter packs, complete backup, rollback and Undo                                                                       | 9 tests            |
| New CLI inspection/indexed-build regressions                                                                                  | 3 tests            |
| Combined portable suites, including existing compatibility/replay/session/library/progress/catalog/pack/backup/transfer tests | **294/294 passed** |
| New CLI tests plus the existing goal-inspection suite                                                                         | **14/14 passed**   |
| Final new tests plus the independently authored Sentinel route suite                                                          | **53/53 passed**   |
| ESLint and Prettier on the changed consumer, test, CLI and guide files                                                        | Passed             |

There are **30 new unique tests** in this change. The combined runs overlap and must not be summed into a total. Raw scoped logs are `.cache/round-21/portable-suites.tap`, `consumer-cli.tap` and `encounter-final-scoped.tap`. The final source-gate runner has been prepared separately and has **not** run at this report's creation.

The CLI changes are limited to including v3's explicit empty mastery array in catalog preflight and reporting the `level-v2-` inspected identity. Isolated build tests confirm mixed indexed content is included, and a bad encounter engine cannot replace an existing valid output. A peer review found no concrete new authority, pair-dispatch or persistence defect; its independently authored Sentinel checks also verify legal routes and saved prefixes. Browser presentation, physical controllers/iOS, native packaging and player enjoyment remain separate verification work.

Changed production files: `game/replay.mjs`, `sessions.mjs`, `library.mjs`, `progress.mjs`, `mastery-catalog.mjs`, `packs.mjs`, `backup.mjs`, and two lines in `scripts/game-cli.mjs`. Player/developer guide changes are limited to [replays](../../replays.md) and [Replay Theater](../../replay-theater.md).
