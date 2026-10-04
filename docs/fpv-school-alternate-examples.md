# Optional alternate School examples

This increment adds 28 optional command recordings for existing School lessons:
`beginner-01`–`beginner-12` in Acro and `beginner-27`–`beginner-42` in Self-level.
The existing 178 built-in recordings, course definitions, scoring, physics and
player code remain unchanged. These files are explicit imports, not additional
content in the built-in registry or the admitted Worlds ZIP.

The 14 foundation Self-level examples (`beginner-13`–`beginner-26`) already have
their own optional archive. The 16 lessons at `beginner-43`–`beginner-58` contain
Acro skill objectives; Self-level remains unscored practice there and is excluded
from this batch. Eligibility follows `worldCourseRequiresAcro(course)`, which
checks `rotation-v1`, `attitude-v1`, `path-v1` and `crossing-v1` objectives across
both modes. It does not infer eligibility from a nonexistent `step.skill` field.

## Import and use

Download either or both files from
[`authoring/fpv-worlds/demonstrations/optional/school-alternates-v1`](../authoring/fpv-worlds/demonstrations/optional/school-alternates-v1/):

| File                                           | Examples |   Bytes | SHA-256                                                            |
| ---------------------------------------------- | -------: | ------: | ------------------------------------------------------------------ |
| `fpv-school-acro-proof-part-1-of-1.json`       |       12 | 176,551 | `81f5a88402188a5632991e53ed3e5fbabd919ffcdbeb7916c0acc91ca0937422` |
| `fpv-school-self-level-proof-part-1-of-1.json` |       16 | 603,794 | `db03219d3e9925b34e7d99769af3ba630ac94f8148365d906b3d88a200ad4c2b` |

In World Studio's Flight Lab, import the chosen proof archive. Select the matching
flight mode for the lesson. Imported examples become available only after the
player resolves their original dependencies and replays their commands against
the matching course, response and model identities. Watching an example does not
score a personal attempt or advance progress. The original recommended-mode
example remains available in its own mode.

## Authoring qualification

Generation uses the existing `scripts/qualify-fpv-acro-school.mjs`, with explicit
`mode` and `proofArchive: true`; it never installs into the built-in registry.
The command pilot advances the unchanged 50 Hz runtime through ordinary
normalized controls. It does not inject positions, completion or objective
state. The existing pilot required no change.

- The 12 Acro examples completed in 9,104 ticks; the 16 Self-level examples in
  30,657 ticks. All 28 had zero contacts and full health.
- Every exported proof independently replayed to the identical terminal state.
  Every archive then imported through `importProofPart` as untrusted
  `missing-dependency` records and replayed again to the identical terminal state.
- The two archives total 780,345 bytes. Authoring-only data adds zero runtime
  source-input bytes and does not change package or library limits.
- The eligibility receipt pins both production trees to main baseline
  `bf167a4fdfc81d7327fd94518da65ac82d64eb7e`, checks the exact 28 pairs and excluded
  groups, and retains the 154 World plus 24 Flight recordings.

Full generator receipts are
[`Acro`](evidence/fpv-school-alternate-acro-physics.json) and
[`Self-level`](evidence/fpv-school-alternate-self-level-physics.json). The manual
[`eligibility probe`](evidence/fpv-school-alternate-eligibility-probe.mjs) and its
[`receipt`](evidence/fpv-school-alternate-eligibility.json) preserve the exact
selection and byte audit. Intermediate generator outputs, including duplicate
demonstration payloads, remain in ignored
`dist/fpv-school-alternates-generated-bf167a4fd`.

Reproduce Acro generation with Node 22:

```sh
node scripts/qualify-fpv-acro-school.mjs --self-level --mode acro --proof-archive --output NEW_ACRO_DIRECTORY
```

Here `--self-level` selects the 12 original Self-level lessons and `--mode acro`
selects the recording's actual flight mode. For the other group, call the
exported `qualifyAcroSchool` with
`ids: [...EXPERIENCED_LESSON_ORDER, ...ADVANCED_LESSON_ORDER]`,
`mode: 'self-level'`, `proofArchive: true` and a new output directory. The CLI
does not provide an arbitrary multi-ID option. Do not select all School lessons
in Self-level: the Acro skill group is deliberately outside this archive.

## Scope of acceptance

Normal main integration at `114011bead19c5114ebf7c4273bcf1bb3fda4a3f` includes
Orchard PR #1021, main `5e4abe273`. Its only incoming production change is the
Orchard material path in `world-visuals.mjs`. The scoped
[`39-check integration audit`](evidence/fpv-school-alternate-main-integration.json)
confirms all frozen School data/tool bytes and all other production modules stay
exact. Each of the 28 School IDs fails the canonical Orchard guard. The final
School branch has no production delta against that main; replay, host and
registry identities retain their original qualification.

Actual-player import, dependency matching, optional example lookup, replay and
persistence verification is pending. The manual fixture reuses the complete
102-file Railworks admitted player by verified immutable hardlinks; this is
retained package provenance, not a new package admission or a claim that these
optional archives are bundled.

Controlled-input reachability does not establish novice teaching quality,
physical-radio acceptance or hardware performance. Additional unit coverage,
coaching improvements and public deployment remain separate gates.
