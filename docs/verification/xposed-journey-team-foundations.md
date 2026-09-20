# Shared Team foundations — candidate verification

P01 framework increment. Not a released Team Journey, P14 completion, or human
playtest acceptance. Existing historical Team editions keep their original rules.

## Implemented boundary

- Explicit `TeamMissionV1` selects two named map spawns and requires a coordination
  rating. Every advertised mode and preset is compiled, not merely the first mode.
- Team level v2 / ruleset v4 / pack v2 use the same `MapDesignV1` geometry compiler
  as Solo. Disconnected foundations have usable departures, exclude 50 authored
  cells from the example's earned denominator, and stay reclaimed after captures.
- Shared presets pin five/three/two team lives (active life plus four/two/one
  reserve recoveries), fixed player speed 10, and canonical field-keeper tiers.
  The new individual contact recovery takes 0.65 seconds and blocks held steering.
  Historical level v1 / ruleset v3 / pack v1 are not reinterpreted.
- The compiler currently accepts field keepers, foundations, walls and coverage
  in Team. Terrain, other actor domains, objectives, bonuses and timers fail
  explicitly until separately qualified. No automatic Solo-to-Team conversion.
- Registry, CLI, execution catalog, pack import and Studio inspection resolve
  the same preset edition. Team uses a separate execution identity, not Solo
  normalization. Display names do not alter simulation identity.
- The existing actual Team host accepts validated foundation packs and honors
  their fixed preset; a disabled difficulty selector cannot silently re-project
  them. Reverting to historical packs restores the ordinary selector. Cancelled
  import adoption restores the previous selection and difficulty.
- Static capture/coverage diagnostics inspect the real Team engine and the union
  of both seats' reachable cells. An isolated occupied chamber still warns;
  adding a valid second seat inside it removes a false inaccessibility diagnosis.
- Studio creates explicit Team templates, shows two distinct spawn markers and
  shared lives, edits either seat with copy-on-write map revisions, and retains
  undo/redo/checkpoints. It does not launch a Solo game for Team preview.

## Purpose-built greybox

`createTeamOpeningCandidates()` authors **Twin landings**, two separate launch
islands with keepers contesting north and south. Players choose a central bridge
or complementary outer returns. Both craft can contribute to a common network;
no completion requires a bonus or a particular cooperation toggle.

Six complete public-input fixtures cover Gentle/Standard/Expert with joint cuts
on and off, each repeated to verify identical state/events. Both players close
cuts, no player is downed, and foundations remain unchanged. Seed-1 omniscient
routes clear in approximately 20.9 seconds: this is feasibility, **not** evidence
for the authored 45–120 second human-duration hypothesis or balanced enjoyment.
There is no original background for this greybox yet, and it is not in the
released Journey selector.

## Checks and native observation

- Final combined framework/Studio/Team host/Legacy import regression: **147/147
  passed** in 31.5 seconds after the final changes.
- 117/117 Team foundation/compiler/import/actual-host/Legacy-authoring checks.
- 22/22 Studio capture/project/compiler checks before the final shared topology
  extraction; then 21/21 topology/project/compiler/complete-route checks.
- 14/14 final Team topology, structural creation/copy-on-write, stable simulation
  naming, invalid templates and empty-project checks.
- Full lint, formatting, content validation (717 source files) and whitespace
  checks passed before the final explanatory-copy-only correction.
- Local native Studio at project `team-foundations-native-check`: created
  `native-twin-landings` through the template control, assigned campaign membership,
  observed both seats/50 foundation cells/2330 earnable cells, moved only seat two
  from x51.5 to x52.5, verified Undo/Redo, selected Expert (two shared lives), saved
  checkpoint 3. Solo preview remained explicitly disabled for this Team mission.
  This is native authoring evidence, not native two-player gameplay or hardware QA.
  Both distinct seat markers were visually inspected; no console errors were recorded.

## Research recheck and remaining gates

The [Cubixx developer article](https://blog.playstation.com/2011/09/15/cubixx-hd-coming-to-psn-with-7-player-multiplayer/)
documents cooperative area capture and separately described competitive modes.
The [AirXonix developer rules](https://www.axysoft.com/airxonix/) distinguish field
balls from threats on filled ground. These support retaining explicit mode and
threat-domain contracts; they do not prove this greybox is enjoyable or establish
Reloaded's exact algorithms.

Still required: original art, native Team gameplay qualification, authored Team
Journey Continue/Next/Skip/chooser and profile adapter, automatic fresh-attempt
restart, global buffered steering qualification, broader actor/terrain bindings,
physical controllers/touch/accessibility, human complementary-role and pacing
testing, exact-source full hosted qualification and reviewed Pages promotion.

## Studio-to-Team export follow-up

Studio now exports one selected mission/preset as a valid immutable Team test
pack using the same compiler. It rejects known impossible topology quotas and
unapplied source edits. The download/import path contains geometry and rules,
not reference pictures, final art, publication authority or Journey awards.
Both Studio and the Team lobby explicitly distinguish preview scenery from
authored mission artwork. The lobby pins the exported preset.

Native local check: exported `native-twin-landings-expert-team-test.json` (738
bytes), verified pack v2/ruleset v4/Expert, both exact edited spawns and 60% goal,
then imported that downloaded file through the actual Team file chooser. Start
used Expert with one reserve; W and Down steered both craft onto exposed trails.
Both closed on reclaimed ground and paused at 1.2% shared coverage with the reserve
intact. This is a native opening route, not a complete playthrough or human test.

That test exposed a misleading generic Hunter start message on a keeper-only
mission. Guidance now checks the actual actor roster; native reload/import/start
confirmed field-keeper teaching and truthful geometry-test scenery text. The
corrected attempt is paused at 0:00/0% in the owned Team tab.

Export/model/actual-Team-host/Legacy-lobby-preview regression: **101/101 passed**
in 32 seconds; the earlier export/empty-Studio/three-preset cohort passed 7/7.
Full lint/format/source validation (718 files)/whitespace checks rerun separately.
This closes the manual Studio→real Team test import path, not the player-facing
authored Team Journey navigation, final presentation or release acceptance.
