# P00 integration and inventory — delivery evidence

**Status: source qualified and merged; frozen snapshot verified; immutable GitHub Release published; not deployed on main Pages or accepted.** This report is publication metadata outside the immutable game source. Pending rows must receive actual evidence before P01 starts.

| Identity                         | Value                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Phase / candidate                | P00 / v0.55.0                                                                           |
| Game source                      | `acc9f265b651017fd268ffd8bbe6989bec614c41`                                              |
| Game tree                        | `824581317c87a9097097c255f57c11bed153fad0`                                              |
| Source PR                        | [#50](https://github.com/mekhovov/revealline/pull/50)                                   |
| Integrated main                  | `a6406ed51a949c7d94315cc9a58373b70f03bcc0`                                              |
| Exact-source workflow            | [34933733408](https://github.com/mekhovov/revealline/actions/runs/34933733408) — passed |
| Hosted gated snapshot            | [34934616278](https://github.com/mekhovov/revealline/actions/runs/34934616278) — passed |
| Publishing revision / deployment | Pending                                                                                 |
| Immutable public test URL        | Pending actual deployment and verification                                              |

## Delivered source scope

The original mixed checkout was preserved before integration. P00 retains the fullscreen/standalone lifecycle adapter, Home Screen declarations, fullscreen manifest fallbacks and focused tests. It keeps the current responsive CSS and the canonical v0.54 production repair. The phase register, compatibility contracts, complete baseline inventory and authoring/release prompts define the remaining execution work.

The final integration adds documentation to candidate `9a9fc8f`; runtime, content and production bytes are unchanged between that candidate and `acc9f265`. Earlier checks remain identified by their actual source. The inventory is intentionally the pre-repair `3f8930e` baseline; the final release preserves all 948 historical asset records, 16 historical theme revisions and 127 original blobs while adopting the canonical append-only production repair.

The original checkout preservation receipt records 201 files and 629,522,202 logical bytes. The final raw source check records 3,803 tracked files and 669,234,254 bytes, matching Git contents and modes, with aggregate SHA-256 `f77e1f08d9988c79931b4b74d4d005309e1cdbe21dd4bb4222e90ea9c3a087e1`. This aggregate is a source-identity observation, not the source TAR or distribution digest.

## Completed scoped verification

All six final source gates and the ordinary build passed: **4,051 tests across 365 files**, with zero failures, cancellations, skips or TODOs. All twelve hosted before/after raw identities matched the independent local Git-blob content/mode check. PR #50 merged normally at `9686daf10b172592fc1c2a135be3546f75bc5211`; the frozen game source remains the tested `acc9f265` commit.

The exact source qualification receipt has SHA-256 `b84d2995e56d3034f2eae8b4fa3c175b2c91157d7ad68f58b9ad11cc781fe956`. The prepared `source-qualification-evidence.zip` contains the original workflow/job snapshots, six raw logs, twelve identities, complete test partitions, timing summary and collector: 16 entries / 363,390 bytes, SHA-256 `f0ee2b15537537ff165d3e8c53c320362dda897c4451a9a6a5a240d36ffb67f0`. Every entry was reread. Attachment to the immutable GitHub release is pending.

Existing-log test-shard wall times were 27:56, 20:15, 16:10 and 19:20. The largest named parent tests were Countercurrent host (18.64 minutes), Fracture host (17.75), Route Worlds host (10.11) and Sentinel theme host (7.83). Nested durations overlap; these are diagnostics from the required run, not isolated benchmarks or an additional test run.

- [Cross-mode browser baseline](browser-baseline.md): ordinary Solo/Versus/Team entry, keyboard samples, pause/explicit Resume, Retry and actual browser fullscreen. Viewports: 1280×800, 390×844 and 844×390. It records the known Team controls and Versus sizing gaps.
- [Ordinary-build offline check](ordinary-build-browser.md): 600 core files / 55,102,105 bytes verified; offline reload and First Signal completion using an ordinary keyboard cut. The ordinary build reports `sourceRevision: null`; it is not the frozen/public release.
- [Async operation inventory](async-baseline.md): boot, preparation, download, media, data, recovery, authoring and Studio owners for P01.
- [Audio ownership inventory](audio-baseline.md): independent audio paths, master-control gaps and transport-intent constraints for P02.
- [Platform guidance review](platform-reference-check.md): primary-source navigation, input, progress and accessibility guidance; browser, modeled input and physical checks remain distinct.

Local focused fullscreen/renderer and production-history checks passed. Production reproduction and committed readiness passed with 194 required reviewed slots, 99 optional source slots and no missing declarations. Readiness is a declaration check; it does not establish P08-A's asset integration or visual-state acceptance.

The ordinary build independently verified all 646 manifest files / 312,091,349 bytes. After browser verification, its owned generated output was retired for disk capacity; its metadata and integrity receipt remain in the local P00 cache. No immutable release, source, reference or unrelated work was deleted.

## Frozen snapshot verification

The hosted snapshot was received without rebuilding or rewriting its originals. The parallel receiver completed in 456.583 seconds; the full outer archive SHA passed before decoding. It verified 3,803 source files and all 647 ZIP members (646 manifest files plus the original manifest). The packaged files total 312,091,399 bytes.

- Source TAR: 672,389,120 bytes, SHA-256 `8e0e60607a9321e940de9af1b1f109b79c13dc17e54fb99e62434757427f6a6f`; independently matches streamed Git archive output for `acc9f265`.
- Distribution ZIP: 312,325,608 bytes, SHA-256 `69807866db04cc22d6e4d5fdbd5e04b5bc8b57834548cc7a147da5bd0ec1eab7`.
- Original manifest SHA-256: `96085dafb2c7f8083564e9923647b914efe29a5704a35b23d7fe337f4be4ae56`.
- [Receiver receipt](snapshot-verification.json), [independent archive review](snapshot-independent-review.json), [independent source review](snapshot-source-review.json).

The first serial transfer attempt was cancelled before decoded originals because measured throughput would exceed its time bound. Its failure evidence remains in the local cache. The successful attempt used a separately reviewed bounded parallel receiver; all original release bytes stayed unchanged. An initial independent review assertion expected an unprefixed build-info version; the frozen writer's `v0.55.0` contract was inspected and the assertion corrected before the successful review.

Annotated tag `253ed21b6897a0784ba3d8d2b871c952fee90451` is pushed and peels to the tested source `acc9f265`. Draft release `388923117` contains all nine expected attachments. GitHub reports each uploaded size and SHA-256 equal to its independently verified local original; see [attachment verification](draft-attachment-verification.json). The verified draft was published at 2026-09-15 07:31:10 UTC without replacing any attachment. Published release ID 388923117 retains the same nine hashes. This does not establish Pages or public-play acceptance.

## Remaining release acceptance

1. Predecessor v0.54 is published and Archive13 has passed its complete public-byte and ordinary online/offline browser checks. Its first offline preparation timed out; retry verified 600 files and offline play passed. The finding is retained for P01.
2. Complete the reviewed publishing controller selecting the already published immutable v0.55 release and retain predecessor archives.
3. Bind the actual successful hosted artifact receipt to the deployment and audit every public body, including root aliases, current canonical assets and historical bridges.
4. Exercise actual public Solo/Versus/Team routes, relevant fullscreen and core-offline journeys; record release/source identity and scoped findings.
5. Review and close this report before advancing to P01.

## Outstanding planned work

P00 does not deliver the new map presentation. Team still needs approved reveal pictures, shared actors/objectives/fonts and control placement; Versus still needs full identity-aware artwork resolution and canvas sizing. Those remain required P03/P04/P05/P06/P08-A acceptance items. No physical touch/controller, Safari/PWA installation, exhaustive campaign, imported-map or full-state qualification is claimed here.

The separate v0.56 player-library/Team-controls candidate follows P00 and preserves its source history. Reconcile its actual released changes before modifying those surfaces in later phases; its existence does not close this report or any later phase.
