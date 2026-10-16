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
world bounds, and solid objects retain their usual contact response. The `.rlpack`
and editable ZIP are each under 3 KiB and contain no external model or downloaded
asset. The separate native proof archive is 41,774 bytes.

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
node authoring/fpv-worlds/momentum-contact/catalogue-probe.mjs --write
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

The third command uses the installed `parse5` and `fake-indexeddb` development
dependencies to mount the production World app at a lightweight DOM boundary.
It imports the pack and native archive through their existing controls and checks
that both verified examples expose **Watch example**. Wrong-model imports and
stale verified records with an incompatible model remain unavailable. The shared
read-only identity resolver also matches actual flight identities for ordinary,
old/new Hunt, mixed-mode Hunt and both supported pursuit contracts. The catalogue
does not create physics worlds to decide whether an example is available.
`evidence/catalogue.json` records this functional check and its source hashes.

The [native browser receipt](evidence/native-browser.json) records a separate
pass on immutable source `1ba932e6f61b918a9571c4a193c30f554855e951`: Library pack
installation, 2/2 proof verification, visible **Watch example**, and complete
Self-level and Acro replays at 20.9 seconds with 2/2 caught and no echo tail.
Switching to Acro reset playback to paused at zero; explicit Resume completed
the second example. Warning/error logs were empty. The completion captures are
[Self-level](evidence/fpv-hunt-native-self-level-complete.png) and
[Acro](evidence/fpv-hunt-native-acro-complete.png). The older main-branch HUD visible
in those screenshots is handled separately by PR #1110.

This is functional evidence outside the permanent unit suites. Additional unit
coverage remains deferred under D6. The DOM boundary is not a browser layout or
native UI acceptance claim; the separate browser receipt covers only its listed
journeys. Package, public deployment, offline, physical-device and human player
acceptance gates remain open; no release version or publication authority changes
here.
