# Root workspace reconciliation

Reviewed 23 September 2026 against `main` `8c383561140289fee2cefa9450a7439c8f485a03` (v0.95.0). The preserved source workspace is `codex/fpv-redesign` at `677b091681d424198de17c6f7e864795d2618880` plus its staged, unstaged and untracked content.

This review expands untracked directories to files and compares the final working bytes with the same path on current `main`. It covers 398 files / 1,050,089,420 bytes:

| Result                                   | Files | Disposition                                                                                                                   |
| ---------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------- |
| Exact current-main bytes                 |    24 | Already retained; do not republish.                                                                                           |
| Different bytes at an existing main path |   109 | Current implementations supersede these older candidates. Porting the working file wholesale would regress released behavior. |
| Path absent from main                    |   265 | All are classified below; none is an unshipped runtime module.                                                                |

## Feature decisions

| Local feature family                               | Current authority                                                                                                 | Decision                                                                                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation themes and Asset Studio               | `game/presentation/`, `authoring/asset-studio/`, and the v0.94/v0.95 retained-presentation work on current `main` | The current files are materially newer and larger than the local candidates. Keep current main.                                                                                                                      |
| Soundtrack catalogue, player, backup and albums    | Soundtrack library v3, the 70-recording hosted catalogue and its admitted archive on current `main`               | The local v2/24-recording implementation and older verification notes are superseded. Local MP3 sources remain outside the game repository by design.                                                                |
| FPV title artwork                                  | `authoring/library/fpv-field-kit/originals/title-hangar.png` plus prepared runtime derivatives                    | The loose `game/ui/art/field-kit/title-hangar.png` has the exact source hash `cbeef16d7c8f20d1f211c61d455d8b02f1c7abff83b41348cbd711b2f7b69eac`; it is a duplicate, not a missing runtime asset.                     |
| Xposed research and mission mapping                | `docs/research/xposed-journey-ledger.json`                                                                        | The current ledger contains all 64 source identities and the earlier FPV proposals under `historicalProposal`. The older adaptation ledger is therefore superseded. Source screenshots remain local research inputs. |
| Shared typography, responsive UI and support pages | Current v0.95 game/site/authoring surfaces                                                                        | The local CSS/HTML is an older partial migration and includes an invalid `2var (...)` font declaration. Do not port it.                                                                                              |
| Pages workflow                                     | Frozen release selector and archive admission on current `main`                                                   | The local release-event workflow predates the immutable selector/archive system and must not replace it.                                                                                                             |

## Local-only classification

| Class                                      | Files |       Bytes | Repository treatment                                                                       |
| ------------------------------------------ | ----: | ----------: | ------------------------------------------------------------------------------------------ |
| Supplied Xposed screenshots                |    64 | 393,404,508 | Keep locally; retain hashes, dimensions and observations in the tracked journey ledger.    |
| UA-FPV soundtrack research                 |    80 | 222,096,227 | Keep locally pending individual rights/listening review; never admit by filename alone.    |
| Licensed soundtrack source and derivatives |    31 | 197,023,394 | Already covered by current ignore rules and the separately published soundtrack archive.   |
| Drone reference images                     |    22 | 130,926,170 | Keep locally as research; production art requires original reviewed assets and provenance. |
| Generated concept outputs                  |    49 | 100,715,901 | Keep locally until a specific asset revision passes preparation and provenance review.     |
| Superseded Xposed ledger                   |     2 |     176,555 | Replaced by `xposed-journey-ledger.json`.                                                  |
| Historical local soundtrack evidence       |    14 |     123,466 | Superseded by the hosted-soundtrack evidence already tracked on main.                      |
| Superseded planning documents              |     2 |      50,648 | Do not replace the current delivery plan or current soundtrack documentation.              |
| Duplicate title source                     |     1 |   1,705,416 | Use the tracked source and prepared runtime derivatives.                                   |

The raw research directories are now explicitly ignored so a future broad add cannot publish roughly one gigabyte of third-party or unreviewed media. Ignoring does not delete local files. A reviewed production asset must be copied into its declared source/derivative location with provenance, validation and a dedicated feature PR.

## Result

No runtime change from this workspace needs a new feature PR. The useful feature work has already reached current main in newer forms. Remaining local media are inputs for future artwork, campaign and audio production; they are not ready game assets. This PR records that decision and protects the repository boundary without changing gameplay, versions, releases or historical evidence.

The machine-readable summary is [`2026-09-23-root-workspace.json`](2026-09-23-root-workspace.json).
