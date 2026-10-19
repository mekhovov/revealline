# F09 text and HUD scaling implementation notes

> Current proposal: reconciliation against main `102c4dffe9720b343f2b16649e72288bfee8f264`.
> The dated results below belong to their named earlier sources, including the
> 461 focused cases and eleven configured components at `869dff`. They do not
> qualify this proposed source. Only the six source-canonical stages in the final
> section have run for this reconciliation; its formatting and syntax checks,
> native/browser journeys, full validation and package checks remain pending.

## Measured baseline

Exact runtime: `cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`. Actual desktop browser at1280×720, English, primary Journey shell. Settings changes used normal controls; pause retained the same flight. [Computed measurements](text-scaling-baseline-2026-10-18.json) describe visible Home, Settings and paused HUD surfaces. This is not mobile or200% qualification.

| Surface                        | Standard | Large | Ratio |
| ------------------------------ | -------: | ----: | ----: |
| Home Start/Settings/seat label |     16px |  20px |  1.25 |
| Settings tabs and selects      |     16px |  20px |  1.25 |
| Settings title                 |     22px |  22px |  1.00 |
| HUD time/score                 |     26px |  30px |  1.15 |
| Cause message                  |     16px |  20px |  1.25 |
| Pause Resume/Settings          |     16px |  20px |  1.25 |
| Pause group heading            |     11px |  11px |  1.00 |

Existing Large remains useful and should keep its present meaning. No current200% in-game option exists. Logo artwork is distinct from text.

## Delivery contract

1. Keep one desired text-size owner. Before exposing an additional size, admit/preserve it through the shared record, legacy-library validation, every host select, generated simulator consumer and non-DOM caption renderer. No separate competing magnification preference.
2. Separate desired size from effective host presentation. Until its layout is qualified, a host must retain the desired choice, visibly explain a Large fallback, and never show a blank select or silently write Standard back. F06 comfort presets continue to select Large.
3. Add the Solo rendering with measured typography, wrapping and scroll access. A200% label requires actual computed-text and usable-layout evidence relative to Standard; do not obtain it by relabeling Large or enlarging only a subset. Preserve ordinary browser zoom.
4. Qualify EN/UK at320,390,1280 widths and handheld landscape; include Home, mission picker, paused flight, settings, critical cause/caption and import/recovery dialogs. Confirm visible controls and reachable scroll content; do not count hidden DOM text as readability proof.
5. Verify record/export compatibility, reload/cross-tab changes, failed persistence and newer intent; settings must leave simulation, replay, current mission, held-input release and caption controls unchanged. Physical devices remain unavailable.

F09a owns compatibility plus shared/Solo delivery; F09b owns each remaining family’s effective layout. Measurement is preparatory evidence, not a shipped feature.

## Current research

[W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text) requires content and functionality to survive resizing up to200%; clipping enlarged controls is a failure. [Xbox text display guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101) recommends scalable game text and accompanying icons. These inform acceptance; this document does not claim certification.

## Compatibility prerequisite delivery

The first F09a PR preserves `extra-large` as desired intent in the existing three-field shared record and library/backup format. `effectiveTextSize` is derived at runtime; every current host renders the established Large presentation. Existing Standard/Large choices and comfort presets keep their meanings. An incoming extra-large value appears as a disabled selected option with an EN/UK fallback explanation, or a read-only explanation where the host has no size control. Opening or relocalizing a screen does not save or reset that intent.

This prerequisite does not expose a selectable additional size, change CSS scale, or qualify 200% text. Solo layout, selection and measured qualification follow in a dependent deliverable; remaining families stay on their explicit fallback until separately qualified. Native decoding, browser history, controls and storage boundaries used in automated host tests are modeled, not physical-device evidence.

## Current-main compatibility integration · 19 October

The reviewed foundation now has a normal merge checkpoint `2e0cfde9d56690273db7aff0d453c8a96b3f196e`, tree `28102c6d4b1d9954c6f8bd8f7ca5baf3f517d049`, joining the earlier qualified foundation `f80709e1df12e8a9b7cd48cfd6713c636bf77c33` with captured main `cdbda99ac881eb9cac62d536543d9078b92ac081`. This contains the same 43 compatibility paths and does not add selectable Extra large text or a newly scaled layout.

Four reconciled files retain the current English/Ukrainian values, generated catalog and both complete display-host test blocks. All current-main interface values remain, plus exactly three compatibility entries per language. The canonical bundle is byte-identical to the existing generator and independently decodes to all 18 authored namespaces / 27,646 messages. The current display read, persist, receive, notice and motion-change owners remain exact. Shared comfort persistence/reentrancy, Survival save/resume and caption-reading source remain under their existing owners.

**Complete focused cohort: 456/456 pass across all 14 complete files**, with zero failures, skips, cancellations or todos. This is one uninterrupted serial Node 22 run at the checkpoint above. It took 119.011 seconds TAP / 119.894 seconds wall, sampled peak own-process-group RSS 1,972,416 KiB, and retained at least 2,344,841,216 free bytes. Limits were 1,536 MiB V8 heap, 2,048 MiB process-group RSS, 180 seconds and a 2 GiB disk floor; no guard triggered. The exact head, tracked state and 43-path source manifest stayed unchanged before and after. Full unfiltered stdout: 109,112 bytes, SHA-256 `9a7641b73c08fdf09fe33a8f0ed29174b1c65cf5e1ec251ea9b768732d159d95`; stderr empty, capture not truncated.

The configured full-project lint command also passes at that same source, with zero warnings, stdout or stderr: 16.648 seconds and 396,384 KiB peak process-group RSS. All 4,441 tracked modules within its configured module scopes were present. Both theme-bootstrap and SIM play-shell generator checks pass byte-identically; SIM remains 305,701 bytes with no new package slots. Changed JavaScript lint, reconciled-file formatting and whitespace checks also pass. These results do not substitute for full source validation or a package build.

The following earlier attempts remain failed results, separate from the final pass:

| Attempt at the same checkpoint          | Actual result                                            | Boundary                                                                                                                                        |
| --------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| First complete 14-file attempt          | 302 pass / 9 fail, 311 emitted cases, 97.484 seconds TAP | Two entire files could not import because tracked inputs were absent; six Solo Start waits and a missing Neon entrypoint inventory also failed. |
| After the first exact input restoration | 435 pass / 8 fail, 443 cases, 119.791 seconds TAP        | A second shared image, Neon launch modules and the remaining presentation-input closure were still absent.                                      |
| Three-file diagnostic cohort            | 22 pass / 9 fail, 31 cases, 69.953 seconds TAP           | Neon entrypoint validation passed; nine actual Solo Start checks still could not prepare their media.                                           |
| Next complete 14-file attempt           | 447 pass / 9 fail, 456 cases, 153.963 seconds TAP        | All files imported, but nine Solo Start checks still failed.                                                                                    |

Every attempt had complete bounded stdout, empty stderr, no truncation or triggered guards, and identical source before/after. Two separate one-case Start diagnostics failed at the original downloading boundary. After restoring the complete required current/retained presentation input closure, the unchanged diagnostic passed in 1.783 seconds TAP, followed by the complete 456-case pass above. None of these failed or partial runs is counted as an aggregate success.

The sparse review checkout was missing unchanged tracked inputs. Only already-local Git bytes were restored, with exact Git blob, size and SHA-256 checks: one 51,349-byte historical Snake proof, then 116 inputs totaling 206,797 bytes. The latter set includes the native proof, Neon entrypoints and their launch modules, required selected pictures and the small presentation images; the final 79-file closure accounts for only 17,621 bytes. No network asset fetch, bulk release copy, dependency installation, runtime correction, assertion change or timeout increase was used. Detailed input and run manifests remain in the review checkout's evidence directory.

Earlier 446-case and full-source receipts retain their original source scope. This successor remains a draft pending uninterrupted full-source validation, required remote CI/admission, current rendered review and package qualification. The protected 2 GiB reserve still excludes a large build or snapshot that cannot fit. Physical iPhone installed-PWA offline startup, Steam Deck, assistive technology and new host-layout qualification remain untested.

## Latest main reconciliation and qualification

A subsequent normal merge integrates observed main `457040a90d0e3af0377c2cad85ffaced5d93bf63` at `827ac5da8486958d6acde3c2dd750eac05db02a8`, tree `0a5d80a09b058503963ee558e5e1658ffe5a1fed`. The difference from that main remains the same 43 compatibility paths. Merged Team navigation repair #1740 preserves the captured level-select owner when a retired locale producer runs; no duplicate compatibility workaround was added.

Published predecessor `4b5f2cf49b7c558568a3883727ffdf430f31da6f` failed focused CI shard 2 in run 39265795520. The failed job reported one Team retained-context `document is not defined` error; its source repair is now included from main. The other three focused shards passed; scope-skipped broad test/build jobs were not passes. That failed CI result remains separate from the new local qualification.

**Latest complete cohort: 461/461 passes**, comprising all 14 prior complete files plus the full five-case `localization-couch-host.test.mjs` file. One uninterrupted serial Node 22 run at the new merge took 136.991 seconds TAP / 137.840 seconds wall, with peak sampled process-group RSS 1,977,008 KiB and minimum free space 3,455,467,520 bytes. No skips, cancellations, todos, guards, stderr, truncation or source changes. Full unfiltered stdout is 110,486 bytes, SHA-256 `750b8334f66f53e73174ef01d99c9cd56d338ed9c87df49953d7308180978b39`. All 43 feature paths, HEAD, tree and tracked working state match before and after.

Full configured project lint also passes on this merge: 18.918 seconds, peak 423,072 KiB, no warnings, stdout, stderr or resource guard. Theme-bootstrap and SIM play-shell checks pass without generated changes; SIM remains 305,701 bytes, SHA-256 `a5ebd172991cc1269a3e7abc132b967f47fbc405f8897435a55935203de3b8ae`, with no new package slots.

The first new 15-file attempt failed: 302 passed / 10 failed, 312 emitted cases, 102.980 seconds TAP / 104.132 seconds wall. Three complete files could not import absent committed replay/artwork inputs, six Solo starts could not settle without required media, and the Neon inventory was incomplete. No guard or source drift occurred. An earlier audit preflight stopped before Node because two committed review documents were absent. Restored only exact already-local HEAD blobs: those two documents (14,609 bytes), then 117 required replay, launcher and presentation inputs (258,146 bytes), each verified by Git object identity. No network hydration, production/test assertion change or timeout increase. The unchanged new source then passed all 461 checks. Failed attempts and full transcripts remain preserved.

The canonical catalog is independently byte-identical and decodes exactly to all 18 namespaces / 27,646 messages (1,270,807 bytes; SHA-256 `be17570df2b9e0ac58fc751544bdd99ba054c264c4598f9af246651ce170a378`). A broader localization command returned zero with 13,706 messages / 8,981 references, but this review document was edited during that run, so its before/after qualification audit failed. That attempt is not counted as a clean exact-source gate; its complete output and differing-document audit are retained.

Detailed receipts are in `.cache/improvements-evidence/2026-10-19/compat-latest-main-827ac5-{complete,restored-complete,full-lint,theme-bootstrap,play-shell}/`. Final documentation-only publication must retain the 42 non-document feature blobs from the passing merge. Full source validation, package, actual current browser journeys and new exact-head CI admission remain separate pending gates; no new mobile, installed-PWA, listening or hardware qualification is claimed.

## Configured source validation at 869dff

All eleven configured lint/localization/validation components now pass at published `869dffba635f963fdce4b7a04ef8052b97af1d5b`, tree `f1a978e843912d58605e8f98ae9067da886bb067`. Commands ran as separate fresh, serialized Node22.22.2 processes, with localization once followed by the nine remaining exact `package.json` validation commands. This is component-equivalent configured source qualification across two attempts, **not one uninterrupted npm invocation**, a package build, a full test-suite result or newer-main acceptance.

| Component               | Seconds including terminal source audit |
| ----------------------- | --------------------------------------: |
| lint                    |                                  27.934 |
| i18n                    |                                  117.35 |
| game-validate           |                                  53.718 |
| presentation-metadata   |                                   6.778 |
| reaction-projection     |                                   5.455 |
| academy-audio           |                                   5.627 |
| play-shell              |                                   5.845 |
| presentation-assets     |                                   5.975 |
| optional-worker         |                                   5.453 |
| world-visuals           |                                   5.479 |
| industrial-environments |                                  24.433 |

Every accepted component exited zero with empty stderr, no resource guard, capture error or truncation, unchanged source and no remaining owned descendants. Each process used1536MiB old space,2048MiB group/descendant RSS,180 seconds per running child, a2GiB free-disk floor and4MiB per output stream. Maximum sampled RSS was1424.3MiB during localization;0.5-second sampling can miss peaks in short processes. The localization check reports13,706 messages/9,071 references in the complete defined source closure. An earlier clean final-head localization check106.864s/1,516,448KiB retains its own narrower working-tree input scope.

The first chain passed its first seven components. Presentation-assets itself exited zero, but its postflight free space was1,774,960,640 bytes, below the2GiB reserve, so that stage was rejected and the chain stopped; its last three components were not run. The failed guard receipt and unfiltered output remain intact. Available space later recovered without deletion; new finalized Git packs were observed, but the precise writer/cause was not established. The interrupted component and the final three were then rerun into a fresh evidence directory with unchanged source and the same limits. All four passed. No failure was relabeled or guard relaxed.

The APFS-clone snapshot has29,236 available exact-target tracked files, verified GitOID/SHA256/executable mode and distinct inodes. It explicitly lists15,661 absent tracked history/raw paths; it is not an all-tracked checkout. All6,874 defined build/lint/localization-scanner prerequisites are present. Matching committed media came from the independently verified Team snapshot;212 differing files came from the exact compatibility checkout. No source asset hydration, ordinary-copy fallback, dependency installation, hardlink or Gitblob restoration was used. Original compatibility HEAD/index/working state and its43feature-path hashes were unchanged.

Before and after each accepted component, all29,236 snapshot files matched audit `fe2cdf6ebc822f67472bbc21a442daafa63e0ed1320b64af86a9536de60e665e`. Complete raw output, per-component limits/exits and all22 log hashes remain under `.cache/improvements-evidence/2026-10-19/compat-869-apfs-preflight/`; `configured-components-final.json` identifies exactly which attempt qualifies each component. The original interrupted `full-gates/` chain and its failure are retained alongside `full-gates-resumed/`. This documentation-only successor keeps all42 non-document feature blobs exact869; checks were not rerun at the successor.

Package capacity, actual current browser journeys and new-head remote CI/admission remain open. Physical iPhone installed-PWA offline cold launch, Steam Deck, listening and assistive-technology acceptance remain unqualified.

## Proposed compatibility reconciliation against 102c · source evidence only

The proposed 43-path compatibility update retains every current-main value and
owner outside its reviewed changes. Current main adds ten optional mission-opening
trace markers in `game/app.mjs`; all ten remain byte-exact alongside the original
four text compatibility edits. The other 39 authored candidates and all 78 pinned
generator inputs retain their independently reviewed bytes. The three canonical
outputs were regenerated from this reviewed source, rather than copied from an
older generated module. This is a source proposal, not a published or merged head.

The compatibility behavior is unchanged: retain `extra-large` intent, render the
established Large fallback on unsupported hosts, and explain that fallback without
saving, changing a flight or exposing a new selectable size. This does not qualify
200% typography or the separate Single Drone/Riy layout prototype.

### Accepted source-canonical run

Remote main was re-read immediately before this single run and matched exactly
`102c4dffe9720b343f2b16649e72288bfee8f264`. All six stages exited zero with complete
bounded capture, empty stderr and no remaining owned descendants:

| Stage                                  | Seconds | Peak owned RSS bytes |
| -------------------------------------- | ------: | -------------------: |
| Exact catalog projection, author       |   2.338 |          253,853,696 |
| Exact catalog projection, check/decode |   1.881 |          239,108,096 |
| Registered theme-bootstrap author      |   0.414 |          150,716,416 |
| Registered theme-bootstrap check       |   0.440 |          147,898,368 |
| Registered SIM shell author            |   0.678 |          165,429,248 |
| Registered SIM shell check             |   0.645 |          159,399,936 |

The catalog projection extracts seven pinned declarations from the registered
localization source using verified JavaScript UTF-16 and UTF-8 spans. It first
reproduces the original main catalog bytes from all 18 original namespace JSON
files. It then verifies exactly three added compatibility entries per language,
no altered or removed existing values, and complete lossless decoding to all 18
candidate namespaces. It does **not** run the full localization CLI, source
reference audit or content-registry generation/check.

The theme stage intentionally evaluates the registered pure theme compiler and
its admitted data/i18n/catalog dependencies in a Node process without a browser,
storage or network host. No application, game host or gameplay module entrypoint
runs. The SIM stage reads and projects source text. Its current-main bytes outside
the generated JS markers remain exact, and the complete CSS file remains unchanged.

| Canonical output                                       |     Bytes | Git blob                                   |
| ------------------------------------------------------ | --------: | ------------------------------------------ |
| `game/i18n/catalogs.mjs`                               | 1,278,099 | `d0a9885af95a24d8dbf592dd2e83e54569f2ac34` |
| `game/presentation/theme-bootstrap.mjs`                |    93,524 | `5cb5c5a4a8ac84818328369d8a775c456a60745e` |
| `optional-practice/civilian-fpv/flight-fullscreen.mjs` |   349,183 | `d595595a79b74481e2112be45e04506c4e6c650b` |

The immutable receipt is
`/tmp/revealline-compat1668-102c-canonical-private/receipt.json`, SHA-256
`92a29f3c551dcd16b8ede5f08393b340e8992cc7ff5d6b4f09b056d95ce304f5`.
It identifies the frozen runner and every output/log hash. The raw campaign
contains 3,767 stdout bytes and zero stderr bytes. Private allocation was
12,115,968 bytes of the 16 MiB cap; final free space was 788,955,136 bytes. Each
child retained the 256 MiB heap, 512 MiB owned RSS, 45-second wall limit and source
free-space guards of 256 MiB before launch / 128 MiB continuously. The native
2 GiB reserve remains unchanged. All original source artifacts, A checkout
files/HEAD/index and dependencies matched before and after. Earlier failures and
qualification receipts remain intact; none are relabeled as a new-head pass.

### Remaining gates for this proposal

The next bounded source-static plan checks formatting of all 40 authored files
with the captured current-main formatter configuration, plus syntax of all 39
owned JavaScript files including the three canonical outputs. These checks are
currently **unrun**. Generated output formatting is owned by the registered
canonical author/check stages; catalog bundles are also explicitly ignored by the
repository formatter. No generic formatter will rewrite generated bytes.

Complete native cohorts, full localization/content-registry/reference checks,
configured source validation, package build and current-head hosted CI remain
pending. Browser journeys, installed-PWA offline cold starts, listening, assistive
technology, physical iPhone and Steam Deck remain unqualified. Historical 869dff
results are useful regression evidence for that exact source only. Fresh remote
main and all 43 owned-path / 78 generator-input pins must be verified again before
any publication proposal; newer unrelated files must remain on their current
main bytes. No formatting, source application, Git update or publication is
performed by this documentation change.
