# Momentum contact practice

This bounded fictional course exercises an opt-in ordinary Hunt contact rule:
an accepted catch keeps the drone's velocity. It has two unarmed moving runners,
an ordered quota, no tail, and native manual flight in Self-level and Acro. It is
separate from the built-in catalogue; no existing mission is replaced.

## Open the practice

Use a simulator built from this branch or a later version containing this policy.
In **FPV World Studio → Library**, use **Import .rlpack / editable project**:

- `momentum-contact-practice.rlpack` installs the ready-to-fly pack. Select
  **Keep moving after the catch** in the installed content and start a flight.
- `momentum-contact-practice.zip` opens the editable project through the same
  importer. Use the existing actor/objective controls, preview, Undo, and export.

After installing the exact pack, use **Library → Import recordings / examples** to choose
`momentum-contact-practice.proofs.json`. It contains one Self-level and one Acro
demonstration. Import verifies each against the installed pack before replay is
available. These examples do not count as the player's own completed practice.
Their saved date is fixed fixture metadata so the archive is reproducible.

Catch runner 01 before runner 02, then keep flying for half a second. Successful
catch momentum continues on the next native tick. Wrong-order targets, hazards,
world bounds, and solid objects retain their usual contact response. Both
archives are under 3 KiB and contain no external model or downloaded asset.

Older runtimes reject the new policy field. Do not remove that field to make the
same recording appear compatible: it selects different physics and identity.

## Version and compatibility

The optional `contactPolicy: "retain-momentum-v1"` belongs to the selected mode's
`hunt-contact-v1` criterion in `FlightCourse.v2`. It selects the proof model
`civilian-world-hunt.v2`. Missing policy retains `civilian-world-hunt.v1` and does
not insert any default field. Course revision and schema are otherwise ordinary;
the explicit criterion value is part of the exact course identity.

This is an opt-in runtime capability, not a global collision change. The existing
swept collision position remains authoritative. Only the already accepted catch
skips contact velocity cancellation; there is no extra movement or second catch
within the consumed tick. Ground/support responses still run after contact.
Eligibility, target order, health, tail generation, damage, and all unsuccessful
contacts retain their current rules. Native pursuit (`FlightCourse.v3`) rejects
this field because its protected contacts and deferred catch transactions need
their own compatibility decision.

The existing actor editor preserves imported policy through Apply, objective
movement and actor-reference normalization. It does not expose a new policy
toggle. Objectives created by the existing controls keep their old behavior.

## Reproduce the focused evidence

From the repository root with Node 20 or later:

```sh
node authoring/fpv-worlds/momentum-contact/qualify.mjs --write
node authoring/fpv-worlds/momentum-contact/proof-archive.mjs --write
```

This manually invoked functional probe uses production validation, pinned Rapier
collision, normal quantized controls, recorder, replay/recovery, editor and pack
producers. It never teleports flight state or calls catch helpers. The retained
baseline was captured on `2d447bc790bdf3951251c99041c8a918363ece0a` before edits.

`evidence/qualification.json` records exact source hashes and results:

- All 134 existing nonlegacy catalogue identities and four archived Hunt proofs
  retain their exact identities and outcomes.
- Complete real-input flights in both modes keep exact velocity on successful
  catches; paired legacy runs stop. First catch tick and swept position match.
- Cross-policy proofs and model-only substitutions are rejected. Recovery stays
  paused and explicit continuation reproduces the same complete recording.
- Wrong-order, non-target, inactive-objective, moving-hazard, wall, support and
  bounds encounters compare exact old/new state on every simulated tick.
- DOM-boundary editor checks cover Apply, movement, target order, actor deletion,
  host Undo and JSON round-trip for both absent and explicit policy.
- Independent pack builds and editable ZIP import/export preserve exact bytes
  and dependency identity. `course.mjs` is the readable fixture source;
  `evidence/practice-proofs.json` contains the two complete demonstration proofs.

The second command uses the native `FPVProofArchive.v2` producer and importer to
create the player-facing `.proofs.json`. Its exact pack dependency, archive and
file hashes, both replay outcomes and checksum rejection evidence are recorded
in `evidence/proof-archive.json`.

This is functional evidence outside the permanent unit suites. Additional unit
coverage remains deferred under D6. The DOM boundary is not a browser layout or
native UI acceptance claim. Package, deployment and physical-device qualification
remain separate; no release version or publication authority changes here.
