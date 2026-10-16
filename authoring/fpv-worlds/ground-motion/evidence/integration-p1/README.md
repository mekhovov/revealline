# P1 integration, source qualification only

Recovery ref `codex/fpv-ground-motion-before-p1-e03` preserves the published
`f9617ba8e0fdb0a526171f0fab944d06ad2d834e`. Its five commits were rebased onto
`e03fdbb5cd73176a01df49347fbe9eab722f1882`. The actor-key conflict retained both
P1's conditional vehicleModel and this feature's groundMotion; the reaction
projection was regenerated and independently checked byte-identical to its
readable inputs (28 modules, 24 recordings, 894,479 bytes).

Integrated runtime: `c888632ecefe7b3846ef19d16a693eb060a91fc3`.
P1 policy, offline/install/worker changes, appearance modules, definitions and
all V3 pursuit behavior remain in the integrated branch. No policy limits were
edited. The only integration-specific runtime change appends the optional
movement policy to the pursuit admission cache key.

## Reproduced admission coverage and correction

The before/after probe observer delegates every query to the real native
collision object without changing arguments, results or physics. On a valid
two-actor graph, two equal shapes with different movement policies caused only
the first actor's policy to be checked (1,366 queries). Reversing actor order
changed which policy was omitted. The optional cache-key suffix produces 1,366
queries for each distinct policy in either order; both equal-policy controls
still perform exactly one set. Legacy absent keys are identical.

Separate native thin-ceiling cases reject with either policy. The before receipt
does not demonstrate acceptance of an invalid layout; it demonstrates omitted
policy coverage. No ban on V3 composition or broad pursuit behavior change was
introduced. Eight opted-in variants of V1/V2 pursuit policies, both actor orders
and both flight modes, run 300 ordinary neutral ticks, export a genuine V3
partial-practice record, replay exactly, and reject that record when the opt-in
is removed. Their actor snapshots still omit the descriptor-only policy.

The first mixed-recording manual runner correctly received the existing replay
refusal but expected the wrong words in its message. That stopped fixture and
its source are retained. The corrected runner matches the existing exact error;
production did not change.

## Preserved behavior

- 35 existing native pursuit, successor, editor and pinned-completion tests pass.
  No test case or assertion was added or weakened.
- 1,074 manual controls compare the unchanged e03 source baseline with the
  integrated runtime: all 192 V2/V3 catalogue courses normalize, export and
  split/compile identically. The other 12 of 204 entries are FlightCourse.v1 and
  are outside this World-validator loop.
- 22 paired flights retain exact identities and every snapshot over 150 ordinary
  ticks: three retained ground-actor courses plus six original and two successor
  pursuit courses, each in both modes.
- All 16 original Festival r5 and all 16 Harbor r4 records replay to their exact
  stored completed final identities. No course, proof, seed or input was replaced.
- The established ten-retained-ground-recording runner also passes (Woodland,
  Container Yard and Festival); its four Festival records overlap the full set
  above and are not additional unique demonstrations.
- Source formatting, scoped lint, full-range whitespace and reaction projection
  checks pass. Full current-main validation/admission and native browser checks
  remain separate and pending.

The baseline checkout was checked against e03 for all tracked game and optional
practice files before importing it; Art's concurrent authoring-only Canals files
were not read by the runtime. The receipts retain baseline/candidate module
hashes. The parity run occurred at docs head 3dc65b874 with the final cache change
present; those hashes equal frozen c888. Mixed-recording receipts pin c888 itself.

## Source and receipt ownership

`source-bridge.json` reads all 105 committed Worlds inputs from e03 and c888.
Four admitted inputs differ: model, collision, pursuit and generated reaction.
Their total addition is 2,495 bytes; integrated raw total is 16,981,627 bytes,
with 3,989,893 bytes remaining under P1's existing 20 MiB policy. The expected
112-member package still requires actual admission. Readable Library is projected
into reaction; it is not an additional member. This is a source inventory, not a
new package receipt or a relabeling of historical ca284/102 evidence.

`manifest.json` pins every raw and stored artifact. JSON/log files use lossless
gzip; manual runners are retained readable and are not registered with CI.
Historical source/native/admission evidence outside this directory is unchanged.
The newly integrated offline lifecycle, populated Library storage and final
capability-cohort endpoint still need their separately coordinated native flow.

Executed existing-test command:

```sh
node --test --test-concurrency=1 game/test/fpv-native-pursuit.test.mjs game/test/fpv-native-pursuit-successor.test.mjs game/test/fpv-native-pursuit-editor.test.mjs game/test/fpv-native-pursuit-completion.test.mjs
```

The retained manual runner files record their absolute baseline/candidate and
archive arguments. Local CPU results do not establish browser frame time,
rendering quality, sustained hardware performance, offline durability or FPS.
