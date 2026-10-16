# Overflight / Проліт — native review candidate

This branch implements the approved dense FPV survivor direction on main
`2d447bc790bdf3951251c99041c8a918363ece0a`. It is a playable review candidate,
not a completed A5 qualification or a published release. C / Рій remains gated
on review of A.

## Latest parallel delivery — 5 October

The combined source is `a4d9b96757a467b2771f686b5db614ce9ef51473` in two draft
PRs stacked above [#1109](https://github.com/mekhovov/revealline/pull/1109):
[gameplay/qualification #1111](https://github.com/mekhovov/revealline/pull/1111),
then [Creator/Community #1112](https://github.com/mekhovov/revealline/pull/1112).
The [parallel qualification packet](qualification/overflight/parallel-20261005/README.md)
supersedes older completion and remaining-work statements below.

This follow-up qualifies strict builds without pulse, improves evolved Fan damage
from 45 to 60, integrates shared saved controller/radio mappings, adds independent
benchmark and resource-soak exports, and admits Overflight packages through the
existing Community client/service and native library ownership flow. EN/UK Studio
export/import/native play and actual cross-mode artwork reuse have browser receipts.
The rebuilt local distribution contains 3,097 files; its
[source and archive receipt](qualification/overflight/parallel-20261005/candidate-build.json)
does not allocate or publish a new release version.

Clean built-browser reference/stress trials, the 15-minute resource soak,
graphics recovery, ten retries and fresh-origin offline launch now pass locally;
see the [browser report](qualification/overflight/parallel-20261005/browser-qualification.md).
Current priorities: target-device and physical-controller qualification, review
of single-airframe difficulty and the remaining 912-visible surge, and five-player
acceptance. C remains gated
on A review. Earlier route counts, source hashes and browser checks below retain
their historical scope and do not independently qualify this combined source.

## Play and review

Serve the repository with its normal development server and open
`game/overflight/play.html`. The main game's mode chooser also links to Overflight.
Choose **Start**, read the native briefing, then **Start** again. WASD/arrows or
left stick steer; Space/right trigger boosts by default, with shared saved
controller bindings taking precedence. The review default offers three
airframes; the one-airframe preset is selectable in shared Settings.

`game/studio/overflight.html` edits and previews the same compiled project.
Its preview is the native game, with the same shell, renderer, appearances,
controller menu navigation, localization, display settings, sound master and
soundtrack library. Installed packages appear in the native mission selector,
with Export and Remove controls. Studio Export also exposes copyable JSON for browsers
that restrict downloads.
Local removal is available only for locally owned missions; Community editions use
the shared Community recovery and offload flow so another owner's copy survives.

Explicit developer/review routes:

| URL query                          | Purpose                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| `?reviewBuild=fan`                 | Ordinary-input automated sweeping build with earned choices.         |
| `?reviewBuild=echo`                | Ordinary-input automated lure-and-return build with earned choices.  |
| `?reviewBuild=systems`             | Ordinary-input automated systems/priority build with earned choices. |
| `?reviewBuild=fan-shield`          | Strict Fan/Slow Field/Side Burst/Shield build without pulse.         |
| `?reviewBuild=echo-scanner`        | Strict Echo/Slow Field/Side Burst/Scanner build without pulse.       |
| `?fixture=reference&diagnostics=1` | 1,500 simulated / 700 center-visible moving actors.                  |
| `?fixture=stress&diagnostics=1`    | 2,500 simulated / 1,200 center-visible moving actors.                |

For independent qualification append `&trial=1`, then repeat fresh page loads
with `trial=2` and `trial=3`; each warms up for 30 seconds and measures 120 seconds.
`trial=soak` measures 15 minutes after warm-up. The older unnumbered fixture's
consecutive windows are not independent qualification trials.

Review playback is visibly marked and never silently activates in normal play.
It waits 1.5 seconds on an earned card, applies it legally, and uses the same
slow-resume clock. It does not manufacture XP, health or damage. Its optional
20-second recorder captures the silent battlefield canvas only; HTML HUD and
upgrade cards require a normal screen recording. Recording runs cannot qualify
performance. Fixtures are separately labeled synthetic workloads and recycle
actors; they are not evidence of pacing, player success or enjoyment.

## Upgrade visuals and balance follow-up

The [5 October upgrade follow-up](qualification/overflight/upgrades-20261005/README.md)
adds animated Now → Next diagrams to every upgrade, concise copy, readable
highlighted titles, rank progress and equivalent static reduced-effects previews.
The card diagrams and runtime attacks use the same module parameters.

Proximity pulses now charge through 90 units of actual flight. The small module
meter shows the next pulse's charge. Stationary pulses have less damage, reach,
knockback and a longer interval; full flight charge restores stronger clearing.
Rank one still cannot one-shot a full-health opening enemy. Slow fields now deal
modest chip damage on a single per-enemy cadence rather than stacking overlapping
damage. Movement, contact damage and encounter populations are unchanged.

The reproduced earned-rank-two stationary route first took damage 11.45 seconds
after parking, compared with 81.45 seconds before this change. Both rank-two and
rank-three parked routes lost before the elite; the same moving policy retained
100 hull at 240 seconds. All 27 active three-airframe qualification routes still
complete. This is automated balance evidence, not a human difficulty guarantee.

## Delivered behavior

The sortie uses the approved baseline flight and rear-drop charge: 100 hull,
180 movement speed, a 330-speed 0.3-second boost, 2.5-second boost cooldown,
20 contact damage, 0.75-second protection, and a charge every 1.2 seconds placed
28 units behind retained heading. It remains stationary for 0.45 seconds before
30 area damage at radius 48. Ten earned three-card choices, two rerolls, two
primary branches, five additional/support systems and their evolutions change
attack geometry and flight routes. The combat/support slot limits are enforced.

Eighteen authored intervals alternate 35-second pressure patterns and five-second
relief. Existing enemies persist through relief; kills do not cause immediate
replacement quotas. The elite arrives at two minutes, final tank at five;
regular spawning stops at six. Defeating the final tank ends hostile combat
immediately. Replacements preserve the build/world and use safe placement plus
1.5 seconds of protection. Enemy arrivals and committed priority attacks are
telegraphed; at most two priority attacks commit simultaneously.

The candidate's late waves use slower, tougher crowds. Across three encounter
sets, three builds and three seeds, all 27 automated three-airframe routes won.
First drafts occurred at 14.02–22.50 seconds; specialized evolution timing ranged
from 52.13–114.13 seconds. The main seed evolved at 70.80–94.17 seconds depending
on the encounter set. The broad timing range is a pacing review item, not a
promise about human progression. One-airframe routes remain substantially harder.
See the retained [route evidence](qualification/overflight/README.md).

Sprinters signal a straight burst through a small body cue. Relay units warn
before drawing nearby pursuit toward a flank; radar support provides a bounded,
non-stacking local speed bonus. Destroying the source cancels either influence.
Couriers and refuge targets carry additional salvage. These roles reuse existing
native silhouettes, stay visible with reduced effects, and add no new immunity.

## Shared foundation and content

- Deterministic 60 Hz simulation, pooled actors/projectiles/pickups/effects, spatial
  grid and reusable query buffers. Ordinary pursuit decisions are staggered at
  10 Hz; movement and authoritative damage remain at 60 Hz. Area damage examines
  every relevant candidate; the old modes' 64-actor presentation sampler is unchanged.
- A dedicated Phaser WebGL scene submits the complete visible horde. Native
  character animation is baked during preparation into 276 atlas frames across
  two textures. Base RGBA storage is 5,533,504 bytes (5.28 MiB), with an equal
  retained CPU canvas allocation for recovery. This is below the 32 MiB base
  atlas budget; it is not a total-process or browser-memory claim.
- All twelve soldier families, three wardrobes and six machinery families are
  admitted across three encounter sets. Explicit cast preferences override
  visuals; the authored setting preserves the seeded mixture. Selected appearance
  identity survives retries.
- `OverflightProjectV1` and `compileOverflightProject()` own bounded arena,
  encounter, population, upgrade, goal and exact resource references. Data-only
  local community packages validate dependency closure and retain immutable
  identities through import/export and native discovery.
- Thirteen original shared pixel assets cover salvage, low supply cases,
  modules, support and impact/warning vocabulary. They are registered as optional
  Asset Studio slots. Motion Lab and native play share composite effect layers,
  geometry and reduced-motion behavior. Existing historical art bytes and pinned
  source approvals remain unchanged.
- [Cross-mode reuse proof](qualification/overflight/reuse.md) exercises the actual
  presentation compiler, shared board profile, Asset Studio adapter and existing
  Solo painter using one generated PNG and one decode, without source copying.

## Earlier verification and remaining gates (before the parallel follow-up)

The [qualification directory](qualification/overflight/README.md) distinguishes
source correctness, synthetic capacity, ordinary automated runs, browser checks
and external review. Browser evidence is specific to the local M4 Pro and
in-app Chromium; it cannot approve the Iris Xe Windows target or M1 Air Safari.
Two ordinary-input native automated builds completed, ten UI retries retained a single renderer, and current-source graphics recovery plus paged export passed. Physical gamepad testing, saved nonstandard controller mappings, five-player
formative testing, complete interface recordings and target-device benchmarks
remain required. Standard left-stick/RT flight is implemented; Capture's custom
radio/remap configuration has not been silently recreated as another settings store.

The earlier candidate’s complete [local distribution build](qualification/overflight/full-distribution-build.json)
passed on `cbd9d23d1a2eff81e7059013024974e2d6e1ca41`: 3,092 manifest files and a
1,004,092,578-byte ZIP. Independent checks verified 38 emitted files, including
the Play and Studio entrypoints, Motion Lab integration and all thirteen shared
library PNGs, plus the final ZIP checksum. The built site is available at
`.cache/overflight/full-distribution`. Offline browser installation and offline
play remain unverified; successful offline-metadata preparation does not qualify them.
That build predates the upgrade follow-up; the current follow-up has focused tests
and native browser evidence, and requires a fresh distribution for release.

The integration cohort passed [128/128 checks](qualification/overflight/final-tests.tap),
with [6/6 CI-registration checks](qualification/overflight/industrial-tests.tap).
The exact [Creator CI cohort](qualification/overflight/creator-tests.tap) passed
208/208 on `cbd9d23d1`, after a test-only Motion Lab canvas adapter correction.
These cohorts overlap and are reported separately, without an aggregate test total.

The existing presentation collection-size test also fails on unchanged main:
its baseline JSON is 1,198,897 bytes against a 1 MiB assertion. Historical approvals
and that unrelated threshold were not changed to make this branch appear green.

Pending PRs inspected include #1107 shared Snake soundtrack, #1105/#1104 flight
learning, #1102/#1101 finite ground motion, #1099 controller layout performance,
#1098 win rewards, and #1095 chapter environments. Their unmerged functionality
is not assumed available. Overflight uses the shared services present in the
verified main snapshot.

## Workspace and cleanup safety

Implementation is isolated on `codex/overflight-survivor`; the user's original
checkout and its existing uncommitted work were preserved. Space cleanup removed
only 570 byte-verified duplicate generated output files in the temporary PR1098
run directory. Every deleted path was checked against its recoverable main Git
blob immediately before removal. The external receipt is
`/private/tmp/revealline-pr1098.P7W826/overflight-verified-duplicate-cleanup-2026-10-05.jsonl`.
No unique evidence, local originals, source changes or unpushed commits were
removed. Logical duplicate size was 563,014,996 bytes; APFS sharing means this
is not a claim that the same amount of physical capacity was freed.

A second storage recovery removed a disposable pip download cache (5,248,323
bytes) and 160 inactive `revealline-neon-artwork/dist` files (25,730,415 logical
bytes) only after matching each byte-for-byte with its retained source-tree
original. No active file handles were found in that output directory. The exact
paths, hashes and retained originals are recorded in
`/private/tmp/overflight-neon-duplicate-cleanup-20261005.json`.
