# v0.97.0 main publication and player-first delivery status

**Scoped public acceptance — 24 September 2026.** v0.97.0 is deployed, its complete
main-site file inventory passes, and bounded native keyboard play is verified.
The physical test disk is full: persistence, successful storage recovery and
offline readiness remain unverified. v0.97.0 is the existing Twin receiver release;
UX0 is the separate, still-qualifying v0.98.0 candidate.

## Completed publication steps

| Identity or gate            | Verified value                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Existing stable release     | v0.97.0; GitHub release `395252920`                                                                                                     |
| Original game source        | `1518e15e248b59c6470cc6931023eaf6f1ac363c`                                                                                              |
| Original game tree          | `c618b5d01fd0742a5dfc8c55c9d851d1d21d58e8`                                                                                              |
| Annotated tag               | `2a65f2917d2ed86a273d1fb2e45f25de232e3563`                                                                                              |
| Selector PR / merge         | [PR341](https://github.com/mekhovov/revealline/pull/341); `ca3f3fd638e02e1907a0811d7759d24ba8f726b6`                                    |
| Selector tree               | `c12820bdf90ec8feaeeab389ab092e9921ad2551`                                                                                              |
| Hosted PR qualification     | Run `35962272265`: 64 Node and 5 Python infrastructure tests, complete publisher preview, extraction and independent byte reread passed |
| Main production             | [Run35962558115](https://github.com/mekhovov/revealline/actions/runs/35962558115), successful at `2026-09-24T06:07:08Z`                 |
| Deployment / success status | `6631370106` / `18767390016`; deploy job `107515171490`                                                                                 |
| Publishing receipt artifact | `10792966805`, 195,763 bytes; SHA-256 `d1998ebb5033d54267baf74861821dc5404b2f7cc26111ab0b0068d9616e8100`                                |

The selector preserves every earlier catalogue row, allocation and admission.
Archive65 retains v0.96.0 with its accepted original evidence. The published v0.97
game, nine release assets and qualification record were not rebuilt or modified.
Main production rechecked the highest stable release immediately before deployment.

The original v0.97 gameplay-suite waiver remains explicit. The passing 64/5
publisher checks establish infrastructure behavior, not a passing v0.97 gameplay
suite. Main's historical-policy test-step skip is not counted as a pass.

## Main-site acceptance

The [original public evidence](evidence/main-v0970/README.md) retains the complete
HTTP report, exact deployment authorities, source/receipt inputs and independent
native observation. The [full HTTP report](evidence/main-v0970/http/http-20260924T061200Z-494edbf9/http-report.json)
passed **4,271/4,271 files / 625,227,678 bytes**,
with zero failed files, retries or skipped paths. It ran from
`2026-09-24T06:12:00.725217Z` to `2026-09-24T06:17:40.290132Z`.
The helper checks complete response sizes, SHA-256, status and MIME against the
receipt-derived inventory. The [post-audit authority reconciliation](evidence/main-v0970/final-authority/report.json)
completed at 06:18:18 UTC and confirmed the admitted selector, run, receipt and
deployment authorities unchanged.

The separate [final release reconciliation](evidence/main-v0970/final-release/report.json)
passed at `2026-09-24T06:19:56.485501Z`: the release, annotated tag, referenced
game source and all nine original asset descriptors remain unchanged. This is
fresh metadata reconciliation; the complete HTTP audit above establishes deployed
game bytes.

The [ordinary root](https://mekhovov.github.io/revealline/) opened the
[canonical v0.97 game](https://mekhovov.github.io/revealline/releases/v0.97.0/site/game/).
Main-origin native keyboard checks used Codex's browser at **1280×720 CSS pixels,
DPR 2, scale 1**, without a viewport override:

- Solo Home showed v0.97.0 and 91 Journey missions. Missions acknowledged
  preparation immediately, opened the complete 201-entry compatible library and
  returned with Escape to the actual Missions opener.
- Team exposed 12 Journey missions, prepared Stepping exchange and focused Start
  together. Real keyboard play banked **0.5263158082962036%** territory with two
  reserves; Escape paused with Resume together focused.
- The guarded Team-to-Versus departure defaulted to Stay. Deliberate confirmation
  discarded only the new test attempt, preserving the user's existing Solo Continue.
- Versus exposed 91 Journey missions, started both prepared artwork boards,
  accepted each player's keyboard input and showed ordinary life-loss/recovery.
  Escape focused Resume race. **This main-origin session did not win or use Next.**

The [original native observation](evidence/main-v0970/native-observation.json) has SHA-256
`5365163d7fe73d9f4b59796e6680f3790c6d3230378ed17317481b0bd85545fe`.
Its `PASS_WITH_LIMITATIONS` remains narrower than full player-flow acceptance.
Database capacity/connection errors visibly offered Retry/Export; no persistence,
repair success or offline pass is claimed. Existing saved Solo Continue was left
unstarted. No complete Solo result/Collection journey, physical controller/touch,
mobile, screen-reader, 200% zoom, audio listening, exhaustive balance, performance
or clean-console qualification was performed. The owned tab was closed.

Observed follow-ups stay open: cold Home focuses Difficulty; gallery initially
focuses Search; technical menu prose, duplicate entries and raw round-state labels
remain. UX0–UX3 cover these. Team's initial loading shell briefly names First
Connection before resolving Stepping exchange: UX2 should use a neutral loading
destination until the selected mission is known. Do not change frozen release
bytes to hide these findings.

## Existing v0.97 Archive66 evidence — separate scope

Preservation commit `24cdbcc3f7db3bbdebca11e920fe9e80938a3c74` retains the original
Archive66 evidence at `publishing/pages-controller/evidence/archive-66-v0970/`.
The complete repeat HTTP audit passed **1,121 files / 594,897,841 bytes**, with zero
errors. The earlier metadata-write ENOSPC attempt remains retained and rejected.

The original native record, SHA-256
`b4fb32189acdec61db464cbced58fb49d059912d73bf89c833a69bef4baf8134`, reports
`PASS_WITH_LIMITATIONS` in Codex's browser at 1280×720, DPR 2, scale 1, using
native keyboard and mouse. It observed Solo Home and 91 Journey missions without
replacing the saved Continue; Team's 12 missions, real capture and Pause; guarded
departure; and a real Versus win followed by direct Next into the named successor.
Studio inspection compiled the existing Twin receiver draft without Apply/Save;
it does not prove a Twin receiver clear or balance review.

The physical test disk was full. Saving exposed database errors and Retry/Export;
persistence, successful recovery and offline readiness are not passing results.
Studio return navigation was interrupted with an unproven cause. Retain that
investigation and friendlier recovery copy as follow-ups. No full Solo journey,
cross-campaign ending, physical controller/touch, mobile, screen-reader, exhaustive
balance or clean-console claim is made. Frozen release bytes remain unchanged.

## Completed foundations and remaining player-first work

Previously released foundations include default Journey entry, unified compatible
content discovery, staged Next, shared presentation/settings and backup safeguards.
Their earlier scoped evidence remains historical; this publication does not mark
the entire redesign complete or assert that every existing flow is reliable.

| Order                                  | State                           | Remaining acceptance                                                                                                                                                                 |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v0.97 promotion                        | Complete within the scope above | Full public file inventory and bounded keyboard/session behavior pass; the listed persistence, hardware and wider journey checks remain open.                                        |
| UX0 — input correctness                | Implemented; PR320 qualifying   | Finish mandatory full suites, exact-source qualification/build and review; immutable v0.98 release, selector, Pages and public input/play verification. No new public UX0 claim yet. |
| UX1-A — rewards and completed-card art | Remaining; next implementation  | Actual mode-specific wins populate Journey Collection and completed cards with exact accepted originals; historical ambiguity, duplicates, storage failure and recovery handled.     |
| UX1-B — compact complete gallery       | Remaining                       | Campaign grouping, map/art previews, one-action play and retained selection across all content sources; bounded thumbnail memory and responsive input/layout.                        |
| UX2 — shared Home/lobbies/Pause        | Remaining                       | Direct Start, consistent mode structure, Back/Help/Settings/Sound and exact opener restoration; remove duplicate entry points and ordinary-menu tuning prose.                        |
| UX3 — gameplay layout and teaching     | Remaining                       | Objective-led HUD, contextual hints and both players' controls; entire boards remain usable on portrait and short landscape.                                                         |
| UX4 — start, failure and continuation  | Remaining; independent releases | 3–2–1/Go, short Retry, deliberate terminal Retry and named mission/round/campaign endings; no pre-Go simulation, stale launches or duplicate awards.                                 |
| UX5 — remaining player screens         | Remaining                       | Settings/difficulty, Records/replay, help, friendly recovery and complete return/input/loading coverage. Investigate Studio return separately after primary flows.                   |
| UX6 — whole-player qualification       | Remaining                       | Complete cross-mode journeys, accessibility/performance/public regression; physical devices, human balance, replay portability and comprehensive offline proof remain separate.      |

PR320's checked head at this record's preparation is
`26fe20f8c00aa2d09238595c8856fa5572ea0561`: preflight and build passed; all four
mandatory test shards remain in progress in run `35956795771`. Two additional
reviewed test corrections and their guidance are preserved separately at
`b3963c542d3d3921f17e98e1bf74611f8624f407`; they are not yet part of that checked
PR head or a public UX0 release. Integrate and qualify the final source before
merge/freeze. A completion time remains conditional on those blocking checks.

After UX0–UX6, continue unfinished map/artwork parity, themes/Studio, campaign
offline preparation, backup/history recovery, audio/encounters, community campaign
production and the community guide. Do not start bulk new missions or artwork
while primary flows remain unreliable. Online multiplayer, Deathmatch, full
Ukrainian translation, hosted administration and persistent co-op sessions stay
deferred. The 132-mission programme is not closed by existing mission counts.

Finish one feature through review, complete gates, versioned immutable release,
Pages and public verification before accepting it or advancing the next release.
The authoritative feature contract remains the player-first UX execution board;
this delivery note reports its release state, not a replacement plan.
