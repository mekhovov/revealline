# RevealLine — completed work and remaining delivery

Checkpoint: 30 September 2026. Main source at this review is
`4d9d70237506e51a877e5df3f4e6b6b91e20bb76`. This is an integration and planning
receipt, not whole-game or public-release acceptance.

## Completed

- Fetched main and ran the requested rebase at `3dbf92d3`. The branch already
  matched main and was clean; there were no conflicts. Main subsequently advanced
  to `451b82dc` through [PR #816](https://github.com/mekhovov/revealline/pull/816),
  and the shared primary checkout now contains that commit.
- The missing mission Ready export has merged. Independent pinned-source review
  passed twelve isolated contract checks and linked 498 Solo modules without
  evaluating the app. This does not establish public gameplay or device acceptance.
- Verified the latest immutable release is still
  [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3), published
  29 September. Root Pages and the immutable release selector are separate surfaces.
- Reviewed local source, working/index changes and stash deltas. Historical
  recovery remains available at `117d892e8bb140a1c30b574f1b23bba280d0adfe`.
  Two additional historical integration tips are now advertised on GitHub as
  preservation branches, without changing their owners' original refs.
- The Levels successor is pushed as [PR #820](https://github.com/mekhovov/revealline/pull/820),
  based on repaired main. Its runtime restoration and source evidence are distinct
  from public mission-discovery and gameplay acceptance.

See the [local reconciliation record](verification/local-reconciliation-2026-09-30/README.md).
Preservation means recoverable and reviewable, not integrated or release-ready.
Closed unmerged [PR #802](https://github.com/mekhovov/revealline/pull/802) remains
historical evidence; it is not silently enrolled as a runtime feature.

## Remaining — current release inputs

The current source inputs below have the existing
[v0.150.0 milestone](https://github.com/mekhovov/revealline/milestone/57).
Source owners retain their branches and the release coordinator owns cumulative
integration, version allocation, immutable publication and Pages deployment.

| Order | Item | Current state | Required closure |
|---|---|---|---|
| 1 | Boot repair, #816 | Merged at `451b82dc` | Verify actual deployed startup and affected handoff; a merge is not public acceptance. |
| 2 | [Creator Guide, #815](https://github.com/mekhovov/revealline/pull/815) | Open source input | Current-main reader/focus/return qualification. |
| 3 | [Audio/spatial restoration, #817](https://github.com/mekhovov/revealline/pull/817) | Draft source input | Dependency, playback, interruption and integration review. |
| 4 | [Offline readiness, #818](https://github.com/mekhovov/revealline/pull/818) | Draft source input | Optional extras stay outside starter downloads; installed journeys remain usable. |
| 5 | [Settings-location verification, #819](https://github.com/mekhovov/revealline/pull/819) | Merged at `4d9d7023` | Verify final public offline-control ownership. |
| 6 | [Cooling/pressure routes, #820](https://github.com/mekhovov/revealline/pull/820) | Open source input | Integrate the intended missing routes and verify they can be found and launched publicly. |
| 7 | [Demo clock continuity, #821](https://github.com/mekhovov/revealline/pull/821) | Draft source input | Verify visible-frame stalls and lifecycle behavior without accepting unrelated Demo gaps. |
| 8 | [Company budget/practice, #822](https://github.com/mekhovov/revealline/pull/822) | Draft source input | Pass edition capacity and actual cached-practice checks. |
| 9 | [Steam Deck Confirm checks, #823](https://github.com/mekhovov/revealline/pull/823) | Open source input | Qualify current-menu Confirm behavior; modeled checks do not certify hardware. |
| 10 | [Creator documents, #827](https://github.com/mekhovov/revealline/pull/827) | Draft, stacked on #815 | Preserve the parent dependency and qualify document-reader return/downloads before cumulative integration. |
| 11 | Pause/Skip and other current-main ports | Active owner work | Finish conflict review; push each scoped successor and assign its release target. Never stage another owner's unfinished rebase. |
| 12 | Deferred failures and missing closed-source hunks | Reconciliation continues | Resolve [#813](https://github.com/mekhovov/revealline/issues/813); port missing intended Team/Community/source behavior without merging stale branches wholesale. |
| 13 | Publish the cumulative candidate | Coordinator-owned | Freeze qualified main, publish the allocated version, deploy, verify inventory and player journeys, retain rollback. |

This order prioritizes startup and safe current-game delivery; it does not create
a competing release queue. Do not hold ready player fixes for this documentation
packet, historical evidence adoption or future bulk content.

## Remaining — original product obligations

Phase numbers below refer to the original P00–P18 programme. Xposed Journey reuses
some numbers for different scopes; the two registers must not be conflated.
Historical scoped acceptance does not certify today's integrated build.

| Phase | Current boundary | Still required |
|---|---|---|
| P00/P01 | Initial scope accepted; regression closure open | New loading/failure/cancel paths preserve state and acknowledge actions. |
| P02-A/B | Partial across current integration | Shared mute, custom MP3s/playlists, actual listening, interruption, transfer and offline recovery. |
| P03/P05 | Partial | Every screen/dialog via keyboard, touch and real controllers; opener/Resume ownership, EN/UK, Large/Plain, reduced effects and compact handheld layouts. |
| P04 | Partial | Complete authoring upload/edit/preview/export/import/play with exact-original recovery. |
| P06/P07 | Default entry/library foundations delivered | Safe installation, complete mission discovery, retained Retry/Next, mastery and optional stories without duplicate rewards. |
| P08-A/B | Partial | Exact artwork/actor parity, readable playing scale/heading and clear trail/capture/loss/pickup/rescue/victory feedback across modes. |
| P09/P10 | Partial | Fair pressure, readable counters, compatible replays/checkpoints, Team Support/rescue and the separate Team qualification matrix. |
| P11–P15 | Production not fully accepted | Complete themed design cards, art/audio and meaningful playable campaign slices. The later Xposed Journey backlog supersedes the old 132-mission allocation. |
| P16/P17 | Partial | Collection, scores, saves/replays, recovery, current guides/skills and an independent fresh-workspace create → install → play → export → recover example. |
| P18 | Incomplete | Whole-game performance, accessibility, storage/media/offline lifecycle, physical devices/controllers and human-quality acceptance. |
| Native stores / network multiplayer | Deferred | Separate packaging/signing/lifecycle/store and authoritative-networking gates. |

The [approved Xposed Journey contract](xposed-journey-plan.md) describes 242 Solo
candidates, 12 finale Remixes and 12 purpose-built Team missions as an authoring
backlog, not shipped counts or remaining minimum quotas. Reconcile accepted
content before promising additional production quantities.

[Studio history-restoration follow-up #826](https://github.com/mekhovov/revealline/issues/826)
records one inherited lifecycle investigation for shared editor suspension and
Content/Company Studio. It is scheduled after current release repairs, not a
reason to copy an old branch or block ready player fixes.

The next bounded, unowned display task identified here is Enemy Workshop shared
preferences: its current host omits the shared display adapter and reads only
the OS motion preference. Reuse existing saved/live/BFCache Plain/Large/reduced
policy, preserving drafts, selections, preview-child state and opener focus.
Keep this queued until the current release repairs are settled.

## Delivery rules, timing and concerns

- Review and commit related hunks only. Preserve unrelated staged/unstaged work;
  a clean primary checkout is not proof that every active worktree is finished.
- Push each reviewed slice and assign an existing release target or an explicit
  evidence-only disposition. Recovery branches are never release candidates.
- Keep source/admission, localization, generated-source, build and capacity
  gates. The current test-policy waiver reports `WAIVED_SKIPPED_NOT_PASSED`;
  skipped suites must never be counted as current passing qualification.
- Public verification closes delivery: version identity, complete published
  inventory, affected player journeys and rollback. No new game version is
  allocated by this documentation-only input.
- Local storage repeatedly exhausted during the audit, including failed report
  writes. Avoid concurrent large builds/checkouts. Do not delete owner source or
  historical recovery to make room.
- Source branches, owner edits and checks continue to change. There is no honest
  fixed release ETA until the current protected checks, capacity and integration
  blockers clear. Report each accepted batch immediately; keep wider content,
  listening, hardware and native-store timelines separate.

This checkpoint changes no gameplay, scoring, saves, artwork, version or
publishing policy. It records remaining work rather than declaring it complete.
