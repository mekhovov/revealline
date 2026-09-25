# Reveal Line — current delivery status and remaining plan

Status checked **25 September 2026**. This document supersedes the execution
status in `plan-status-2026-09-23.md`; it does not replace the gameplay contracts,
research evidence, historical release receipts, or player-feedback register.

Effort estimates below are engineering ranges, not calendar promises. A source
PR, immutable GitHub release, Pages selection, and public acceptance are separate
states. Skipped automated suites are never counted as passes.

## 1. Current outcome

- **Public default remains v0.110.1.** It is the most recent Pages build with
  accepted public evidence. It includes the corrected Team picture authority and
  retains all historical levels, settings, uploads, Studio projects, and releases.
- **v0.111.0 is an immutable published release**, adding the public soundtrack
  archive player. Its first Pages selector was merged, but publication stopped
  when v0.111.1 became the latest stable release during assembly.
- **v0.111.1 is an immutable published release** at source
  `cd9565357add4d1521faae76e6d029446b6d8503`. It fixes trusted Steam Deck menu
  confirmation echoes and has complete release assets. It is **not yet the public
  Pages default**.
- The v0.111.1 selector preview is currently blocked because v0.111.0 has not yet
  been admitted as a retained historical Pages archive. The correct repair is to
  preserve/admit v0.111.0, then select v0.111.1; verification must not be weakened.
- Archive76 production for v0.111.0 has succeeded (run `36094583007`, merge
  `d1c19658`, deployment `6653723980`). Full public byte audit and native
  acceptance are still required before the archive can be admitted.
- Protected main is currently `251f2e859df42e8fc8e9b3bc412982b925b93fdf`.
  Required GitHub Actions checks, merge commits, no force-push, and one publisher
  are active release constraints.

## 2. Completed and publicly delivered

| Area                     | Accepted result                                                                                                             | Boundary                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Default experience       | Redesigned Journey is the default; retained Classic and Custom content stays available                                      | Delivered since v0.83.0                                              |
| Unified library          | Journey, Classic, Custom, downloadable, and legacy content share one tagged selector with owner-specific launch/progression | Delivered since v0.84.0                                              |
| Difficulty and tuning    | Main-menu difficulty affects pressure, speed/count dimensions, and lives; bounded global playtest overrides exist           | Delivered since v0.86.0; whole-Journey balance remains open          |
| Fair field motion        | Current enemies fly straight between physical impacts; course variation occurs at collisions, not mid-flight                | Delivered since v0.91.0                                              |
| Continuous progression   | Next crosses campaign, pack, and collection boundaries in Solo, Versus, and Team                                            | Delivered since v0.90.0                                              |
| Current-rules Classic    | Compatible Classic missions can launch with current rules while Original editions remain selectable                         | v0.101.0/v0.104.0                                                    |
| FPV/pixel foundation     | FPV gameplay presentation, prepared actor motion, compact navigation, Pause focus, and Steam menu fixes are released        | v0.98.0 and v0.103.0–v0.108.0                                        |
| Team presentation repair | Team artwork, readable actors, and corrected picture authority are publicly accepted                                        | v0.109.0/v0.110.1; v0.110.0 remains an unpublished draft             |
| Release safety           | Immutable tags/assets, protected main, archived releases, exact-source qualification, and Pages selectors are enforced      | Active; latest ordering issue is being repaired rather than bypassed |

The original Xposed-led programme is not complete merely because these foundations
ship. Whole-campaign spatial quality, Team adoption, broad presentation parity,
and final human/device qualification remain open.

## 3. Implemented or source-ready, not yet delivered

| Work                               | Current evidence                                                                                                          | Remaining gate                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.111.0 soundtrack archive        | Release and nine immutable assets published                                                                               | Admit as retained Pages archive and verify the frozen route                                                                                   |
| v0.111.1 Steam confirmation repair | PR470 merged; exact source qualified; release and assets published                                                        | Correct selector PR, Pages deployment, public marker/route/native verification                                                                |
| Couch quick start                  | Reconciled feature branch on protected-main lineage; focused product paths pass; stale touch fixture corrected            | Merge newest protected main, rerun focused/authority/no-producer checks, reviewed PR and release                                              |
| Trail/impact readability           | Canonical six-file feature patch audited; provisional focused cohort 125/125                                              | Apply after final Couch head, generate Field Kit rev78, Team current78/retained58–77 authority, producer/history checks, visual/public review |
| Team specialist candidates         | PR428, PR435, PR438, and PR440 rebuilt as unversioned drafts; focused cohorts culminate at 110/110                        | Restack on the accepted release chain; resolve inherited production-ledger debt; no default/public adoption yet                               |
| Reviewed Team library              | PR475 exposes an opt-in reviewed-specialist library without changing the ordinary Team route; initial focused checks pass | Complete validation and route/picture/Next/Continue evidence, then restack and release                                                        |
| Ukrainian/FPV spatial studies      | Ornament and workshop source studies exist with original imagery and retained identities                                  | Campaign placement, current-speed balance, cultural/readability review, Team adaptation, public release                                       |

The Team candidate tests are deterministic source evidence, not proof of human
balance or fun. Their inherited `Stale production revision ledger` failure remains
open and must not be relabelled as a pass. The trail rev78 work also preserves an
inherited equipment-review caveat: no new whole-Team/equipment approval is claimed.

## 4. Updated execution order and ETA

| Priority | Deliverable                                              |                                 Estimated effort | Completion condition                                                                                                                                      |
| -------- | -------------------------------------------------------- | -----------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0       | Preserve v0.111.0 and publish v0.111.1 on Pages          |                2–6 hours of pipeline/review time | v0.111.0 retained archive is admitted; v0.111.1 selector merges; public marker and both frozen routes pass                                                |
| R1       | Couch quick-start release                                |                                       6–12 hours | Current protected-main ancestry, focused keyboard/controller/touch checks, Team picture authority, reviewed PR, immutable release, public acceptance      |
| R2       | Trail/impact readability and Field Kit rev78             |                                      12–24 hours | Rev78 production/ledger, Team authority retention, focused Solo/Versus/Team checks, source-native visual review, release and Pages proof                  |
| R3       | Reviewed Team specialist library and adoption            |                                 1–2 working days | All 12 candidates reachable through an explicit library/profile; Original editions preserved; launch/picture/Next/Continue tests and public qualification |
| R4       | Actor direction, size, animation, and reveal parity      |                                 1–2 working days | Readable role/direction states, unchanged collision footprints, compact-board checks, reduced-effects support, public visual evidence                     |
| R5       | Neon Arcade and FPV Field Kit shell across shipped pages |                                 2–4 working days | Shared resolver, supporting-page coverage, Tiny5/licensing, keyboard/controller/touch accessibility, release evidence                                     |
| R6       | Remaining spatial campaign redesign batches              |    2–4 days per campaign group; 11–24 days total | Distinct route decisions, two viable approaches, current-speed balance, preserved editions, 3–5 mission release batches                                   |
| R7       | Team default progression and complementary balance       |                        3–6 working days after R3 | Purpose-built partner dependencies, no unavoidable spawn pressure, controller recovery, human cooperative review                                          |
| R8       | Whole-Journey and final P13–P15 qualification            | 3–7 working days plus tester/device availability | Pacing, accessibility, performance, offline/recovery, physical devices, and human retry/failure comprehension evidence                                    |

R4–R8 may be prepared in parallel, but release publication remains serialized.
Spatial content should continue in small playable batches rather than waiting for
an entire campaign rewrite.

## 5. Blockers and concerns

1. **Pages ordering:** v0.111.1 is now the latest immutable stable release, while
   v0.111.0 is not yet an admitted historical Pages archive. This blocks the
   selector by design.
2. **Moving protected main:** recent release-safety commits advance main while
   feature drafts are prepared. Final PRs must merge current main and rerun required
   checks; force-push/rebase shortcuts are not allowed for protected delivery.
3. **Disk pressure:** local free space has repeatedly fallen below 1 GiB during
   hydrated sparse checks. Cleanup is limited to clean, pushed, recoverable,
   inactive worktrees and disposable dependencies. Unpushed work, media, historical
   releases, and another task's active workspace must remain untouched.
4. **Test waiver:** long suites are temporarily skipped for fast releases. Exact
   source identity, validation, lint/format, build/provenance, hashes, archive
   preservation, and public availability remain mandatory. A skip is not a pass.
5. **Candidate versus shipped content:** PR428/435/438/440 and PR475 are not in the
   default route and are not publicly accepted. Their mission counts cannot be
   presented as delivered gameplay.
6. **Human evidence:** automated clears and deterministic routes cannot establish
   enjoyment, fairness, understandable failures, physical-controller behavior, or
   willingness to retry. These remain explicit final gates.
7. **Reference limits:** supplied Xposed Reloaded screens prove visible geometry and
   actors, not exact speeds, collision tolerances, or hidden rules. Adaptations must
   remain original and use explicitly defined Reveal Line contracts.

## 6. Original-plan completion boundary

The shared map framework, foundations, terrain, relays, speed zones, difficulty,
admin tuning, unified selector, retained editions, continuous Next, current-rules
Classic adapter, core enemy roles, and release pipeline are available.

Still incomplete from the original plan:

- convincing whole-Journey spatial balance and final dispositions for every
  reference adaptation;
- broad timed-bonus placement and human temptation/timing review;
- complete actor/trail/reveal parity and two consistent pixel-art shells;
- default adoption and human balance of the 12 Team specialist missions;
- the remaining Ukrainian/FPV campaign batches;
- whole-Journey Solo/Versus pacing and final Team cooperation review;
- final accessibility, performance, offline/recovery, physical-device, and human
  P13–P15 qualification.

The priority remains **distinct, fair spatial pressure with minimal interruption**:
finish release recovery first, then ship the prepared Couch/trail/Team slices one
at a time while campaign redesign continues in bounded parallel batches.
