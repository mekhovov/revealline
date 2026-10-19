# F09 text and HUD scaling implementation notes

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
