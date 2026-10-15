# Localization clarity and prevention — 15 October 2026

This implements the requested player-clarity and recurrence-prevention batches from the [plan](localization-plan-2026-10-15.md). It is a source-review batch, not cumulative release acceptance. The release coordinator owns integration, versions, publication and release metadata.

Implementation started from main `55a9f55c742e4a9b78a3a79ff578f62ef819342c` in the isolated `codex/localization-clarity-guards-20261015` worktree. The primary checkout and its staged, untracked and ignored work were not edited. No dependencies or large assets were downloaded, and no history or evidence was deleted.

## Player-facing changes

- Translated 200 Neon catalog values: the original 128 reviewed values and 72 additional confirmed gaps. All 205 `neon*` values now contain Ukrainian; five existing translations are retained. Titles, complete descriptions and actor/terrain labels are covered. Literal word-art inscriptions, numbers, keys and canonical content remain unchanged.
- Translated the route-coverage objective, preserving its coverage placeholder.
- Corrected narrow-screen Large-text mission cards to size to their content, and placed footer actions in one full-width column. The browser confirmed readable titles and Back/backup labels at 390×844; card height increased from the clipped 44px to approximately 222px without changing action order.
- Armed Skip and pending/failure messages resolve official names when rendered. Imported/custom names remain literal, including a custom name deliberately matching an official English name.
- Candidate preparation reports translation keys for verifying, opening the picture and preparing rules. The existing status binding repaints these phases without restarting work.
- Unknown startup and mission-preparation errors show localized recovery instructions; original exceptions remain diagnostic data. Known campaign mismatch and picture-storage recovery retain their specific guidance.
- Added focused coverage for retained confirmation, pending operation ownership, cancellation, failure, startup and custom-name preservation.

Campaign records, save formats, replay identities, content hashes and diagnostic identifiers are unchanged. Translation lookup still requires exact registered content; the implementation does not infer ownership from a title.

## Agent and contributor safeguards

The scanner discovers namespaces from canonical English catalog files and uses an explicit maintained-source inventory. It recognizes named translator aliases, simple namespace wrappers and finite registries. It detects duplicate decoded JSON keys and statically provable missing interpolation values, including plural variants.

`npm run i18n:check:changes -- --base <reviewed-sha>` compares a change with an explicit base and rejects new high-confidence raw display copy, unknown literal keys and missing arguments. Existing debt is reported separately; uncertain dynamic calls remain unverified. Reasoned adjacent exceptions are visible in the report. Sparse-source reads use the Git index without expanding media archives.

The [contributor workflow](localization-contributing.md) gives one supported recipe for catalog ownership, lazy presentation, custom-name preservation, generated files and checks. The new change gate is a separate command: automatic adoption by all existing CI/release lanes remains coordinator work. No framework replacement or new runtime dependency was introduced.

## Verification evidence and limitations

Focused results are reported separately; these are not a single all-green product suite.

| Check                                                                     | Result and scope                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooling/audit/bundle fixtures                                             | 30/30 passed, including plural contracts, lexical shadowing, aliases, sparse sources and new-file coverage.                                                                                                                                                                                                                  |
| Solo, candidate and startup coverage                                      | 40 distinct tests passed across bounded runs: six Solo localization cases, 12 candidate-attempt tests, 21 boot/startup tests and one imported Journey mismatch case.                                                                                                                                                         |
| Existing live-flight, operation-status and continuous Library Next suites | All 15 selected cases passed.                                                                                                                                                                                                                                                                                                |
| Result continuation suite                                                 | 12/18 passed; six original waits timed out. An isolated retry of the immediate Next case also timed out. Their causes are not established by this batch.                                                                                                                                                                     |
| Earlier historical Journey suite                                          | Eight unchanged waits timed out. One representative failure reproduced with the original baseline application/test and current dependencies; this is a limited control, not full baseline qualification.                                                                                                                     |
| New fixture corrections                                                   | Two cold-load fixtures were revised to join real catalogue readiness or hold the exact preparation request. Two invalid typed-error network injections were replaced by real wrapped-download failure coverage. No timeout was increased.                                                                                    |
| Typed picture-storage recovery                                            | Source review preserves the typed recovery message; its outer catch is not directly qualified by the network fixtures.                                                                                                                                                                                                       |
| Browser                                                                   | Real English→Ukrainian switching, Ukrainian glyphs, mission selection and a completed Neon launch were observed locally with sound off. The translated route objective and corrected 390×844 Large-text chooser were rechecked after regeneration. This is sampled coverage, not all screens or language/state combinations. |
| Full static build                                                         | Blocked: required `authoring/company-studio` is absent from the sparse checkout. No complete static output was produced.                                                                                                                                                                                                     |
| Offline/native staging                                                    | Not run: no complete static build was available. No offline, physical-device, fresh-install or listening acceptance is claimed.                                                                                                                                                                                              |

Earlier timeouts are retained as inconclusive verification; they are neither silently ignored nor attributed to this change without evidence. The new focused tests establish their bounded localization behavior, not complete cold-launch qualification.

## Confirmed remaining work

1. **Official title on adjusted gameplay records — P1.** A translated Neon selection card can launch with an English briefing title. Exact source and normalized records translate correctly, but default gameplay tuning and Current Classic rules produce records absent from the presentation registry. Extend verified derivation ownership in a separately reviewed change. Translating by name or weakening exact identity checks would risk altering imported/custom names.
2. **Complete cumulative qualification — release gate.** Resolve or account for continuation/Journey waits, cover the typed storage-recovery boundary, and run static/offline/native checks from a complete available checkout. Repeat affected browser checks on the final accepted source. Do not count source completion as release acceptance.
3. **Existing tooling debt — P2.** The unchanged Studio preparation caller at `game/studio/studio.mjs:1387` omits `label` and `slot`. Dynamic call sites require focused evidence or later simplification. The change gate prevents new provable debt without certifying old callers.
4. **Deferred modernization — P2/P3.** Bounded bilingual-table consolidation (LOC-05), generator/data separation (LOC-06), richer machine-readable contributor metadata and broader CI adoption remain separately prioritized work.

Local diagnostic reports and browser screenshots are retained under `.cache/localization-clarity-20261015/` in the isolated worktree. They are development evidence, not release assets. Audio was off; no audio files or canonical content changed, and historical listening receipts are not current-source acceptance.
