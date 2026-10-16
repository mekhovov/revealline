# Imported Team Hunter startup compatibility — 29 September 2026

Status: scoped source correction; production testing deferred, not passed.
Baseline: accepted main `321408a3cfd75ae230d760f39fb692503652601a`.

## Root cause and impact

Schema-valid imported Team level v6/v7 missions containing a Hunter are accepted
by the ordinary importer, but current gameplay preparation prevents Start. This
is a preparation incompatibility, not an unsupported actor or corrupt import.
The twelve current authored Team cultural-specialist missions contain no Hunters
and their bounded startup control was unaffected; this does not establish that
every imported map or historical edition is balanced.

| Player step                                  | Baseline code                                                    | Result                                                         |
| -------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Import a valid v6/v7 Team pack with a Hunter | `readPlayableTeamCampaign`, `readCoopPack`, `validateCoopLevel`  | Import succeeds; hunters are forbidden only in level v5        |
| Start the accepted mission                   | `game/couch/relay-rescue.mjs:4131`, `createTunedCoop`            | Shared `applyGameplayTuning` prepares the attempt              |
| Adapt Hunter attack speed                    | `game/gameplay-tuning.mjs:448–452`                               | Unconditionally adds `level.encounter` for a Team Hunter       |
| Validate the prepared level                  | `game/gameplay-tuning.mjs:464–466`; `game/coop/core.mjs:181–189` | v6/v7 forbid that field, so preparation rejects its own result |
| Run without this unsupported override        | `game/coop/threats.mjs:11–27`, `initializeThreats`               | Existing Hunter defaults already support valid v6/v7 levels    |

The reported error is:

> Invalid tuned Team level: The Team bonus edition currently qualifies coverage, keepers and roamers only.

These are baseline line numbers. The oldest affected valid schema identified is
**level v6 / ruleset v8**, followed by **level v7 / ruleset v9**. Shallow local
history does not establish the first introducing commit or public release.
FPV/campaign appearance cannot avoid this error: imported sources bypass that
cosmetic overlay and still use the same preparation path.

## Chosen repair and alternatives

The current `gameplay-pressure.v4` adapter now checks the existing explicit
Team line-impact edition capability before adding an encounter override. v6/v7
retain their existing native committed Hunter attack speed **8** and historical
timing. Existing patrol-velocity tuning and difficulty-specific warning/concurrency
still apply. No actor is removed and no supplied field is silently discarded.

This is a compatibility repair, not a new simulation ruleset. The affected current
adapter inputs previously threw before producing an accepted tuned result. All
previously successful outputs must stay byte-identical. The level, pack and core
schemas remain strict; original data, settings and raw imports are not rewritten.
Frozen tuning v1–v3 remain untouched, including their historical outputs/errors.

Alternatives deliberately not taken:

- Reject v6/v7 Hunters during authoring/import: would break accepted historical
  content and contradict existing core support without repairing preparation.
- Allow `encounter` on historical v6/v7: would silently widen frozen schemas.
  If tunable committed attack speed is desired there, introduce an explicit new
  runtime/schema edition and opt-in path as separate work.
- Strip the field only in the Start host: tuning throws before that point and
  installed-attempt reconstruction would still disagree. Fix the shared adapter.

Installed recovery reconstructs from the retained level and tuning recipe,
compares the full-level-derived gameplay identity and replays the whole-run
checkpoint. Therefore fresh Start and restored attempts must share this repair;
there is no special recovery bypass or relabelled historical policy.

## Focused verification

The regression boundary includes:

- Actual raw-pack importer acceptance and subsequent v6/v7 Hunter creation/Start
  across Gentle, Standard and Expert, including legal input that reaches a real
  warning/committed attack at native speed 8.
- Hunter-free v6/v7 controls, immutable authored inputs, once-only tuning and
  expected version/ruleset identities.
- Rejection of v5 Hunters and authored v6/v7 `encounter` fields.
- Pre-fix bitwise result fingerprints for v1–v4 Hunters with absent/authored
  encounter values, all presets and fractional admin overrides.
- Frozen tuning v1–v3 file/behavior preservation and exact installed-attempt
  reconstruction rather than a host-only mocked success.

The initial 15-case import cohort recorded **9 passes and 6 failures** before the
guard; all six failures were accepted v6/v7 Hunter imports at the final tuning
validation. After the guard, import/tuning/Start succeeded in every case. Two
Expert attack-witness fixtures initially failed because another actual threat
interrupted the first player's trail before commitment. The legal second-player
approach exercises the attack without removing that threat or editing run state.
These fixture refinements are not described as product failures or hidden passes.

Final combined local run on the corrected source:

```text
node --test game/test/team-import-hunter-tuning.test.mjs game/test/team-hunter-tuning-compatibility.test.mjs
25 tests; 25 pass; 0 fail; 0 skipped; 626.56 ms
```

The 15 import cases include the six real warned-attack witnesses across both
editions and all presets. The ten compatibility cases include pre-fix current
output goldens, frozen adapter file/behavior fingerprints, strict schema controls,
and exact installed-attempt recipe reconstruction after 210 real engine ticks
for each affected edition. This is not IndexedDB or browser Resume acceptance.
Targeted ESLint, Prettier and `git diff --check` pass. No input fixture removes
the Expert-added threat to manufacture the Hunter commitment.

Independent read-only review found no blocker in this four-file change. Intended
adoption target is existing PR #757 at
`04b49041ac06fcc073782751ea56acd5fa8c8030`, not a replacement of its adapter.
Its current tuning blob `89d2ea7fe56cbab2c25c2f183f86f1da8b30768f` and foundations
blob `5d54506f8375dbe3270db93c21fb0096de287872` match this baseline exactly.
The existing `hasTeamLineImpacts` export and eight checked core/import/installed/
frozen-adapter dependencies also match; the three new test/doc paths are absent
there. This does not resolve PR #757's separate aggregate merge conflicts or
substitute for testing the owner's composed source after adoption.

No full suite, heavy local build, public gameplay, physical controller/touch or
human balance evidence is claimed. Scoped correctness and source review remain
required; final integrated build/provenance and release integrity belong to the
publisher's consolidated batch. Production qualification stays deferred.
