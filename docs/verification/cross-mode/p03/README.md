# Cross-mode navigation update — source integration evidence

Prepared for v0.59.0 on 16 September 2026. **P03 remains In progress.** This record supports the named navigation feature; final committed-source qualification, immutable release and public verification are separate gates.

## Retained originals

- [Integration bundle](integration/README.md): earlier source composition, failed and corrected focused cohorts, review records and exact input identities. Its ZIP is 917,952 bytes, SHA-256 `4658460bba55658c58a617b63fe1db75cea1f1562c8d50379b61ebbee61eefa3`.
- [Final supplement](supplement/README.md): canonical fpv26 generation, failed 8/11 and corrected 11/11 production-history runs, final Team checks, source-browser admission/HTTP originals, reviews and cleanup. Its ZIP is 1,427,514 bytes, SHA-256 `a46697dad8d1d19289ddc386f965e3e4153b558abb7731257bad660c3f070cac`.
- [Scoped recipe review](recipe-review.md): exact changed screen/motion inputs, preserved historical stages and unchanged original payloads.
- [Native observations](native/observations.md): actual keyboard actions, focus/clock observations and responsive desktop viewports, including unsupported attempts. Screenshots were inspected inline only.

Each bundle's manifest maps original source paths to ZIP members and pins their exact bytes. Paths recording the original cache location are provenance, not missing loose runtime dependencies. The original files are retained inside the committed ZIPs, including failed logs; each delivery also carries its packaging receipt and independent review. Do not normalize, overwrite or sum overlapping evidence.

## Checks completed on recorded working inputs

| Scope                                | Result                                                                                                                             | Boundary                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Canonical production write and check | Passed; fpv26, 293 slots, 131 compiled files                                                                                       | 127 original payloads / 4,007,816 bytes unchanged; exact source/index snapshots retained         |
| Complete production-history file     | 11/11 on Node 20.19.5 and 22.22.2                                                                                                  | Initial 8/11 retained; fixed test ordering/classification, preserved published oracles           |
| Final Team cohort                    | 205/205 on each runtime                                                                                                            | Exact fpv26 picture envelope and recorded final working inputs                                   |
| Earlier Versus cohort                | 75/75 on each runtime                                                                                                              | Source-scoped, overlapping development tests                                                     |
| Earlier non-Team cohort              | 645/645 on Node 22                                                                                                                 | Source-scoped, not a final full-suite count                                                      |
| Native source HTTP audit             | 1,022 rows, 343 successful paths; zero unexpected responses                                                                        | All 427 admitted files rehashed; three expected source-only 404 rows retained                    |
| Native keyboard journeys             | Solo win, pictures/Collection/Library, cut Pause/read/Resume, Team and Versus entry/readers/options/departure, Versus results/Next | Served fpv25 working presentation; final fpv26 preserves payloads but still needs public testing |

There are no cancelled, skipped or TODO cases in the corrected cohorts. Test totals overlap and must not be added. The production and Team checks precede the documentation/version commit; the release's full source gates must qualify that actual final commit.

## Final review correction

Independent review of source `f1bda4ff` found that story focus recovery could focus Resume while the page was inactive. A focused-Pause regression reproduced it (35/36). The fallback now uses the existing visible/focused-page guard. The complete story UI file passes 36/36 on Node 20.19.5 and 22.22.2, including both hidden-document and unfocused-window paths, unchanged video position and explicit foreground Resume. [Correction originals](story-inactive/manifest.json) retain the initial failure, corrected runs and source review inside the exact-byte ZIP.

The first hosted source attempt (manual `35070262423`, PR `35070255185`) was deliberately cancelled after review so it cannot qualify the corrected commit. Its completed preflights and partial test runs remain superseded observations. The corrected commit must receive new complete hosted gates; the version stays 0.59.0 because no immutable release was published.

## Hosted integration regression review

The corrected story source `124f58df` completed both hosted families with 5,251/5,292 reported cases passing; all four shards failed and manual freezing was skipped. [Host-flow corrections](host-flow/README.md) retain the original failures and explain the obsolete navigation fixtures, exact selected-content waits, explicit replacement/restart choices and native-focus boundaries. Scoped local verification is complete as recorded there: Node 20 legacy 103/103 and optional 9/9; Node 22 optional 9/9, with the earlier legacy 101/103 failure and final renderer/chapter 7/7 retest kept separate. No qualified v0.59.0 artifact or public release is claimed.

## Outstanding acceptance

Actual foreground loss/return, physical touch/controller journeys and remaining complete screen coverage stay open under P03. The native browser's unsupported focus query and hidden-tab attempt do not establish lifecycle behavior. Viewport overrides do not certify phones or handhelds. Audio listening, comprehensive offline/media recovery, later presentation/campaign phases and native-store readiness are not established here.

The [execution register](../../../cross-mode-execution.md) remains the authoritative phase tracker. The feature release may be accepted only after exact-source and actual public checks; that acceptance must not mark the entire P03 phase complete.
