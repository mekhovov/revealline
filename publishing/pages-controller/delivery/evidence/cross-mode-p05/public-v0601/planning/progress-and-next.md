# RevealLine — Team correction and next priorities

**[v0.60.1](https://mekhovov.github.io/revealline/releases/v0.60.1/site/game/) is the accepted public baseline for the Team Options and live-control correction.** The full public audit passed 2,674 files / 638,988,304 bytes without failures or retries, and the affected actual browser journeys passed their stated scope. **P03 and P05 remain incomplete.** [Root acceptance](../acceptance.json) and [delivery evidence](../README.md) define the boundaries.

## What this update changes

- **Keep the selected Options control visible.** Changing text style or size reveals that same focused action and its complete ring inside the scroller. It does not select another action or resume gameplay; newer focus, menu or foreground ownership wins.
- **Give live controls enough room.** Team hides redundant masthead navigation only while playing with the overlay closed. Pause and both touch pads retain space without shrinking the arena, text or targets. Opening the menu restores the header and existing navigation.

Scoped local browser observations cover the clipped Large-text selector, portrait pad overflow and short-landscape/desktop Pause overflow. Simulation, checkpoints, replay and input semantics are unchanged. The later public browser observations independently verify these same affected layout cases. Neither set certifies physical devices or full phase completion.

## v0.60.1 delivery gates

| Gate | Current result |
| --- | --- |
| Exact source qualification | **Passed.** Both hosted families passed **5,416 tests across 430 files each**, with zero failures or skips. These are repeated qualification families, not 10,832 distinct tests. |
| Source PR | **Merged:** [PR #81](https://github.com/mekhovov/revealline/pull/81), merge `d650bd54e60b726e1fb7ec2fd15ee4570735ecc4`. Its tree matches qualified source `822f3290787c704a217e7c185d4b8beb7a527e82`, tree `88bd680e09210f9bf56ca18465fdb46afb2f1307`. |
| Immutable release and originals | **Published:** [v0.60.1](https://github.com/mekhovov/revealline/releases/tag/v0.60.1), release ID `390577418`, **17 September 2026 at 09:31:48 UTC**. Frozen-original inspection and upload reviews passed. Publication and public acceptance retain separate evidence. |
| Publisher and Pages | **Deployed:** [PR #82](https://github.com/mekhovov/revealline/pull/82), merged publisher `c1576deeab14bea21b00449912a6a465c3efaf90`; [run 35206271586](https://github.com/mekhovov/revealline/actions/runs/35206271586) succeeded, deployment `6499869218`, success status `18467370379`. The complete audit and scoped browser acceptance are recorded separately below. |
| Actual public files and authority | **Passed:** 2,674 files / 638,988,304 bytes, zero failures/retries/skipped or uninspected files; original rows independently reconciled. Source/release/tag/latest/deployment authorities remained unchanged after the audit. |
| Affected public Team journeys | **Accepted within scope:** Options focus after reflow, complete live arena/Pause/pads at desktop 1280×720, landscape 844×390 and portrait 390×844; keyboard menu flow and explicit Resume. No flight, win/rescue, physical input or 200% zoom claim. |
| Whole P03/P05 acceptance | **Pending.** This correction does not close either phase. |

## Earlier releases remain preserved

Archive 16 retains original v0.57.2 and v0.60.0 on commit `fcea949bca18193e9303143766a6eecdf4cb8b61`, run `35200608771`, deployment `6498838394`. Its separate audit passed **1,347 files / 625,710,011 bytes**, preserving all 660 earlier canonical rows, with no failures, retries or skipped files.

Scoped browser retention was accepted, including a real v0.60.0 victory, picture/results, retry cancellation, explicit pause/resume and Explorer navigation. Keep the recorded limits: v0.57.2's first keyboard Deploy required a native click fallback; the v0.60.0 session-only run was not saved across Explorer return. Archive acceptance is separate from v0.60.1 public acceptance and physical/offline qualification.

## Next work, in priority order

1. **Integrate Practice/Playground readability and Undo corrections.** A fresh fixture from exact `822f3290`, with only reviewed parent `e674b1ba…` then successor `c79fd477…`, confirms all twelve preimages and the final twelve-path scope. Eleven complete affected files pass on Node 20.19.5 and 22.22.2: **128 reported results per runtime, comprising 127 leaf cases and one parent group**. All 901 inputs remained unchanged. Additive guidance selects **69 original evidence files / 3,179,056 bytes** and preserves Team guidance. Root has since integrated those twelve paths and additive guidance into isolated `codex/p05-practice-playground`, based on `822f3290`. It remains **unversioned and uncommitted**, separate from accepted v0.60.1. Actual integrated-browser observations and the newly found defect are recorded below; they do not constitute acceptance.
2. **Close remaining native navigation journeys.** Prioritize decision/cancel paths, real Collection/score pagination, Team terminal results and failed/cancelled transitions; then foreground interruption, story return, offline/recovery and saved-run migration. Preserve accepted practice-exit and earlier ordinary journeys without counting them again as new coverage.
3. **Advance other supporting tools.** Production/Viewport now has a foreground-owner correction and V-C3/V-C4 modeled coverage for newer focus and all five presets. The current candidate passed both complete affected files on Node 20.19.5 (**24 cases**); its startup file separately passed on Node 22.22.2 (**12 cases**). Do not combine those into one suite or infer a current two-file Node 22 pass. Integration, actual browser journeys, layout/zoom and release gates remain open. These are local authoring tools; no public tool route is claimed. Motion/Recovery and disabled-transport styling remain later candidates.

The earlier Practice/Playground browser evidence remains bound to **`170508f1 + e674 + c79`**. The later, still-uncommitted integrated candidate based on `822f3290` was also observed on local port `49904`:

- Practice Theme/Large was inspected at **390×844 and 844×390**. A held virtual button remained held through text changes, the child iframe stayed unchanged, and explicit release/disconnect worked.
- **A persisted-return defect remains open:** browser History Back restored the body to Plain/Standard while the selector still displayed Large. A regression correction is being prepared; this state is not accepted.
- Playground Plain/Standard showed no observed overflow at **390×844 and 844×390**. A real PNG upload and export produced an **862,703-byte download**. Import and exact round-trip verification remain underway.

U1/U2/G1/G2/G3 retain their earlier scoped observations. These newer observations do not close U4, R1, physical input, 200% zoom, complete browser or release gates:


| Row | Remaining boundary |
| --- | --- |
| **U3** | Newer-owner/background Undo guards have modeled evidence only; no naturally occurring native non-owner invocation was reproduced. |
| **U4** | Complete the style/size matrix, resolve the newly observed History Back body/selector mismatch, and qualify meaningful 200% browser zoom and physical touch/controller use. The newer integrated Practice Theme/Large and Playground Plain/Standard samples at 390×844 and 844×390 are scoped observations, not full layout acceptance; the older 351×760 sample remains distinct. |
| **G4** | A nonempty offscreen action-box set was not observed; current native evidence covers a visible Pause target and empty paused/menu sets. |
| **R1** | Complete the integrated PNG import/export round trip, including original-byte agreement and recovery, then final source, build/artifact, deployment and public journeys. The observed upload and 862,703-byte export download alone do not close this gate. |

## Remaining phase plan

| Phase | State and next completion requirement |
| --- | --- |
| **P00; P01; P02-A** | Accepted within their retained integration, loading and sound-authority scopes. |
| **P03 — native navigation** | **In progress.** Complete screens, decisions, pagination, terminal/lifecycle/recovery journeys and real-input gates. |
| **P05 — readable presentation** | **In progress / partial.** v0.60.0 Studio/Replay and v0.60.1 scoped Team correction accepted. Complete other routes, EN/UA text, palettes, contrast, focus, zoom and reduced effects. |
| **P08-A — art and actors** | **Partial.** Preserve exact art across modes; finish readable heading/scale and both detail treatments, including installable compatible content. |
| **P08-B; P09** | **Partial foundations; queued.** Clear danger/capture/loss/pickup/Support feedback, then fair enemy pressure and compatible encounters. |
| **P07 — rewards/continuation** | **Partial foundations; queued.** Retry/Next, picture/story rewards, failure recovery and campaign completion; no duplicate awards or compulsory download to replay owned content. |
| **P02-B — music** | **Partial foundations; queued.** Custom/mixed playlists in every advertised mode, original-byte transfer, offline/failure recovery and an auditioned soundtrack. |
| **P04; P06** | **Partial foundations; queued.** Creation and original-byte import/edit/export/play; compatible discovery, bounded storage and safe replacement/removal/recovery. |
| **P10 — Team encounters** | **Queued.** Support/rescue, shared objectives and complete encounter/readability acceptance. Layout fixes do not deliver these encounters. |
| **P11-A–D; P12-A–D; P13–P15** | **Queued.** Four FPV and four DroneAid campaigns plus culture, retro and spend management: **132 new Solo missions remain future work**. Finish the three-level quality benchmark before bulk production. |
| **P16; P17** | **Partial foundations; queued.** Collection/scores/replay/recovery and reproducible guides, AI skills, prompts, CLI examples and an independently created/recovered pack. |
| **P18** | **Open.** Cross-phase regression, performance/memory, media/offline recovery, accessibility, physical input and human playtests. |
| **Native stores; network play** | **Deferred separate gates.** Browser work implies neither store certification nor online readiness. |

Content counts have not advanced: the last audited delivery remains 15/29 map families, 60/116 pictures and 1/12 victory stories; 40 reserve originals are accepted as source artwork. Candidate pictures, complete animated sets and the finished 24-track collection still need production and acceptance.

Each accepted delivery requires a related-hunk commit, a new version, exact-source checks, reviewed source/publication PRs, immutable originals and actual public verification. Human enjoyment, challenge and replay value need playtests; source and HTTP tests cannot establish them.

## Guidance informing the next checks

Guidance rechecked on 17 September 2026 supports consistent keyboard/controller navigation and predictable focus after UI scaling ([Xbox XAG 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)). The [W3C minimum focus criterion](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) prevents complete obscuration; RevealLine deliberately uses the stronger requirement that the whole action and focus ring remain visible. A partial clip is not by itself proof of failure against that minimum criterion. These recommendations guide the remaining tests, not an accessibility certification.
