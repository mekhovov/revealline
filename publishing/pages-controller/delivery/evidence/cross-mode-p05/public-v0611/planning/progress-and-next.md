# Current plan — v0.61.1 accepted within scope; remaining delivery

**Latest accepted public version: v0.61.1.** Media Preview focus and the recorded desktop play journey are accepted within the [reported scope](../README.md). The picker obscured by pinned feedback and the host-close focus loss remain open. This is a P03/P05 correction and public delivery, not completion of either phase or the whole game. [Play v0.61.1](https://mekhovov.github.io/revealline/releases/v0.61.1/site/game/)

P00 integration, P01 loading feedback and P02-A master sound controls retain their accepted scopes. The v0.60.8 Missions/backup, v0.60.9 Motion Lab value and v0.61.0 ordinary Solo continuation reports remain unchanged. Earlier content-completeness statements apply only to their recorded scopes.

## Immediate release queue

**Queue snapshot: 18 September 2026, 05:39 UTC.** Public v0.61.1 acceptance occurred at 05:33 UTC. This separately dated snapshot uses the [retained local original records](queue-snapshot.json); it is not a new remote audit or public acceptance of the candidates below.

| Order | Candidate | Current status | Remaining delivery gate |
| --- | --- | --- | --- |
| 1 | v0.61.2 — Team continuation | [Qualified local package](queue-originals/team-package-ready.json) | Complete its own publication and public gates, including a qualifying Team win and continuation. Partial native observations do not close that gate. |
| 2 | v0.61.3 — Enemy Return | [Qualified local package](queue-originals/enemy-package-ready.json) | Complete original release/public delivery and the actual return/focus journey. Earlier scoped checks remain separate. |
| 3 | v0.61.4 — About return | [Qualified local package](queue-originals/about-package-ready.json); 5,838 tests across 461 files per source family | Finish final release/public delivery and its actual About/return journey. Package readiness is not public acceptance. |
| 4 | v0.61.5 — Studio correction | [Qualified local package](queue-originals/studio-package-ready.json); 5,853 tests across 462 files per source family | Complete release/public delivery and affected actual Studio/guide journeys. |
| 5 | v0.61.6 — Versus board fitting | [Both full source families passed 5,865 tests across 464 files](queue-originals/versus-hosted-review.json); ordinary build and manual freeze passed; source PR #119 remains a draft; artifact inspection is proposed | Complete original artifact inspection, final qualification/package review, release and public responsive/input journeys. Board fitting alone does not establish actor body extents or full Versus acceptance. |

The v0.61.6 [manual](queue-originals/versus-manual-run.json) and [PR](queue-originals/versus-pr-run.json) originals record success at 05:29:15 and 05:26:30 UTC. They were inspected for this later queue snapshot; the earlier coordinator handoff had still described freezing as finishing. The [unreviewed inspection request](queue-originals/versus-inspection-request.unreviewed.json) is not evidence that inspection ran.

In parallel, finish the focused-control visibility and host-return corrections listed below. Every independently completed correction keeps its reviewed hunks, source PR, immutable version/release, Pages deployment and explicit public acceptance. A new checkpoint records later queue changes; old release reports are never rewritten to imply earlier acceptance.

## Prioritized remaining phases

| Order | Phase | Status | Remaining completion gate |
| --- | --- | --- | --- |
| Accepted scopes | P00 / P01 / P02-A | Complete within recorded scopes | Preserve baseline integration, loading feedback and master-sound guarantees. |
| 1 | P03 — native navigation | Partial | Complete current menus, dialogs, mode entry/exit, focus restoration and explicit Back/Resume. Fix the v0.61.1 picker hidden by pinned feedback or left offscreen after rotation, and the host Close local connections focus loss. Correct Motion Lab focus after rotation. Verify whole keyboard/controller/touch journeys. |
| 2 | P05 — shared readable presentation | Partial | Keep focused fields visible beside pinned operation feedback. Fix the short-landscape saving-warning overlap and the source-confirmed Team canvas omission of the Large-text preference. Complete cross-mode preferences, EN/UA glyphs, text modes, zoom and reduced effects. |
| 3 | P08-A — artwork and actor parity | Partial | Preserve exact picture identities and the complete arena; finish readable silhouettes, heading, motion and displayed scale across Solo, Versus and Team with independent collision geometry. Resolve the shared 64-logical-pixel actor cap versus nominal minimum display size on narrow 72-column boards; Versus arena fit alone does not qualify actor body extents. |
| 4 | P08-B — action feedback | Partial | Explain trail danger, capture, loss/recovery, bonuses, Support/rescue and victory without obscuring play; cover reduced effects and every advertised mode. |
| 5 | P09 — challenge and enemy intelligence | Partial foundations | Tune the three-level benchmark, route pressure and warnings/counters. Prove deterministic collision, replay/checkpoints and defeat-once rewards, then complete human difficulty and replay-value playtests. |
| 6 | P07 — rewards and continuation | Partial; ordinary Solo correction accepted in v0.61.0 | Finish all advertised mode transitions, objective/mastery clarity, satisfying full-picture and optional skippable-story rewards, recovery and duplicate-reward safeguards. |
| 7 | P02-B — complete music | Partial | Custom MP3s and shared playlists in every advertised mode; actual transfer and offline playback; audition and qualify synth, chiptune, rock and metal tracks. |
| 8 | P04 — creation framework | Partial | Demonstrate real upload/edit/export/import/play with exact original bytes, previews/history, asset and edition registries, prompts and safe failure recovery. |
| 9 | P06 — discovery and installation | Partial | Compatible catalog, explicit optional downloads, replacement/removal and interrupted-install recovery. Validate storage capacity before campaign expansion. |
| 10 | P10 — richer Team encounters | Queued | First Connection and Relay Yard variants with Support, rescue, shared objectives and a separate two-player readability/encounter matrix. |
| 11 | P11-A–D — FPV campaigns | Queued | Four independently released twelve-mission campaigns with complete art, actors, sound, progression and rewards. |
| 12 | P12-A–D — DroneAid campaigns | Queued | Four independently released twelve-mission campaigns with distinct Support/Combat framing and authored class interactions. |
| 13 | P13 — Ukrainian culture | Queued | Twelve Living Atlas missions with cultural, historical and visual review. |
| 14 | P14 — retro arcade | Queued | Twelve After School Arcade missions with distinct nostalgic art, encounters and music. |
| 15 | P15 — spend management | Queued | Twelve Spend in Motion missions with understandable noncombat goals and complete Coupa-theme presentation. |
| 16 | P16 — supporting workflows | Partial | Complete Collection, scores, replay, learning, data recovery and legacy-content journeys under the established navigation standard. |
| 17 | P17 — reproducible authoring | Partial | Complete guides, AI skills, prompts, templates and CLI examples. Independently create, install, play, export and recover an example from a fresh workspace. |
| Release gate | P18 — full browser qualification | Partial evidence | Cross-phase regression, performance, accessibility, media/offline recovery and real touch/controller hardware. Resolve required outstanding issues. |
| Later | Native stores / network multiplayer | Deferred | Separate packaging, signing, lifecycle, hardware, authoritative-network and reconnect gates. |

Bulk content follows the three-level gameplay/presentation benchmark. **132 new Solo missions and 36 Team configurations remain programme targets**, alongside the retained illustration, story, character-animation and finished-music targets. Registry coverage, source checks and a byte audit do not establish complete content or enjoyable challenge.

## Retained content ledger

These are the last accepted ledger limits, retained for planning; this documentation update did not re-audit the content library. Candidate files and enlarged previews do not count as accepted finished content.

| Content | Last accepted scope | Still open |
| --- | --- | --- |
| Map picture families | 15/29 families; 60/116 pictures | 14 families and 56 pictures beyond accepted content. |
| Victory stories | 1/12 | Eleven stories plus complete playback/recovery qualification. |
| Reserve illustrations | 40 selected source originals | Source reserves are not 40 installed missions or runtime derivatives. |
| Character presentations | Partial | Target of 56 complete animated sets remains unmet; body images alone do not count. |
| Finished music | Partial | The 24-track programme still requires completed listening and qualification; recipes or candidate tracks do not establish the album gate. |

## Next implementation focus

First make the active control reliably visible after viewport changes and while operation feedback is pinned. The public v0.61.1 picker can be activated while covered, so keyboard reachability alone is insufficient. Preserve Cancel/Close visibility without placing them over the focused field or its label. Restore a useful keyboard target after Close local connections; the current Back link remains reachable but requires fresh traversal. The public observations and their limits are retained in the [release report](../README.md).

Complete the separate Motion Lab rotation-focus correction, then the compact saving-warning placement and Team canvas Large-text propagation. Local source or focused test success does not close their public device/input gates. Motion Lab's animation recipe has a wrapped label and passed actual keyboard naming; a failed exact automation locator alone is not a semantic-label defect.

Then finish cross-mode artwork and action feedback before judging difficulty on the three-level FPV benchmark. Record comprehension, attempts, loss causes, safe routes and route variety. The introductory First Signal win is a smoke test, not evidence that enemy pressure or replay value is finished. Complete audible music, story, offline and hardware journeys in their own gates.

The existing [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) and [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) provide references for visible focus and return paths. This evidence-only update does not claim a fresh web research pass.

For each release, report the player-visible result, exact source/PR, playable URL, passed evidence and remaining limitations. Only accepted public scope becomes Complete. Candidate packages, content targets and whole parent phases stay open until their own gates pass.
