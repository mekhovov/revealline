# P15 acceptance evidence — local technical preparation

Status: in progress, not a release, phase completion or human qualification. This
isolated increment follows P14 checkpoint `8c48b989`; it is not an accepted release
baseline. The existing publication owner retains source/release/Pages authority.
No version, public registry, release, asset or deployment changes are made here.

## One evidence contract, three entry points

`PlaytestEvidenceV1` records and `PlaytestLedgerV1` use bounded plain JSON. Every
record pins the project, mission, mode, difficulty, resolved simulation identity,
experience identity and explicit 40-character source commit. The experience pin
includes design, presentation and immutable background metadata. The same content
compiler and resolver serve the library, existing compiler CLI and Studio review.
There is no parallel registry or different preview definition.

The source commit is supplied, not authenticated or checked against served bytes.
The existing local data identity is a partition key, not a security signature.
Artifact entries describe bounded SHA-256/size/media-type references: this report
does not load, download, inspect or verify their bytes. Imported text is data, never
an instruction, executable markup or evidence of who performed a test.

Records distinguish automated, native-browser and human observations. Physical
touch/controller checks, player understanding, mission distinction, voluntary
retry, human pacing and Team coordination require a declared human observation.
That schema requirement does not authenticate a person or their claim. Automatic
restarts never imply enjoyment. No real human evidence was created in this increment.

Append is copy-on-write; identical reimport is idempotent and an altered existing
ID is rejected atomically. Corrections explicitly supersede an earlier record for
the exact same target and evidence kind. History is retained. An unrelated later
pass cannot hide an active failure. Changed build, preset, physics, lesson,
presentation or artwork pins leave earlier evidence stale, not current.

Reports distinguish `missing`, `not-run`, `reported-pass` and `reported-fail`.
Even every reported pass leaves `releaseEligible: false`: claims require review,
not automatic publication or gameplay awards. Mission evidence does not qualify
whole-Journey flow, performance, storage rollback, release composition or deployment.

## Use in Studio and CLI

Studio's optional **Review mission acceptance evidence** panel uses the applied
mission and challenge selected above it. Choose an applicable mode and enter the
actual tested commit. With no ledger, inspection truthfully lists missing checks.
An optional local JSON ledger is limited to 8 MiB and stays in memory for this visit;
it is not uploaded, autosaved or merged into the content draft. Clear discards that
session evidence. Source/preset/mission changes invalidate the displayed report.
Changing selection, clearing or choosing another file cancels ownership of a late
read. Invalid replacement input cannot silently reuse an earlier ledger. Imported
details render with `textContent`, never HTML. Exact targets, stale/superseded IDs,
observations and limitations remain available in the detailed report.

The existing compiler CLI supports:

```sh
node scripts/compile-content-project.mjs project.json --acceptance \
  --mission nearby-shore --mode solo --difficulty standard \
  --source-commit ACTUAL_40_CHARACTER_COMMIT --evidence-ledger observations.json
```

Omit `--evidence-ledger` to inspect missing evidence. Project input may be `-` for
stdin; the ledger must be a named bounded regular file. Conflicting, duplicate or
incomplete options fail. Exit zero means a report was produced, **not** acceptance;
reported failures and missing evidence remain visible in its JSON. Invalid inputs
exit nonzero. Neither source nor ledger is modified. No remote artifact is fetched.

## Verification and remaining gates

Initial framework ten tests passed on Node20. The first failed run exposed a test
helper sending an explicit `undefined` optional property; it was corrected to omit
that property, without weakening strict JSON validation. The subsequent shared
CLI/compiler/Studio regression cohort passed 32/32 on Node20.19.5 and22.22.2.
The six dedicated Studio tests pass on Node20, including read races, rejection
before oversized reads, parser budget enforcement, inert imported text, applied
selection invalidation and exact shared-report parity. The final expanded cohort
passes40/40 on both Node20.19.5 and22.22.2, including physical-kind restrictions,
physics/artwork pin changes, explicit correction rules and existing compiler,
Studio, Journey and Team regressions. Results are in
`.cache/journey-p15-acceptance-node{20,22}-r1.tap`. Scoped ESLint, formatting and
diff checks pass.

Native browser inspection of exact source
`51cc6b97d398a2b7d7a56ed9cf1fe95f0ab56416` on the read-only port8813 preview
verified the real Studio panel. Nearby shore/Standard/Solo displayed16 missing
checks; switching to Expert cleared that report before another explicit inspection.
Versus/Expert displayed17 checks including equal race conditions, with the exact
source and preset in its detailed target. Entering `HEAD` rejected inspection and
left no old check list. Inspecting then applying the Team review draft changed the
panel to Twin landings/Expert and Team-only mode; its17 missing checks included
human coordination instead of Versus parity. A normal-viewport screenshot confirms
the form, boundaries, readable results and collapsed detailed report. No ledger
upload, physical device, small-screen, full gameplay or human observation was
claimed by this native panel check. Those remain separately qualified work.

## Earlier-reader progress round trip

The previous backup test validated today's data with today's reader. The new
cross-release suite instead loads exact earlier source from local tag `v0.69.3`,
commit `406637f36c039f991e83d241cb49d4568a871109`. Three small historical files
(profile, catalog and shared JSON boundary) are preserved in a test-only fixture.
Their original SHA-256 pins are asserted before execution; only their two relative
import locations are relocated to in-memory module URLs. Tests need no Git history,
network, downloads or filesystem writes. No earlier implementation is edited.

Five cases verify:

- Current records at all three presets and modes survive an old reader's load and
  write, retaining unknown mission IDs and exact receipt identities.
- Concurrent earlier/current writers retain each other's progress in either order.
- Current backup → earlier restore/export → current restore retains all history;
  repeated no-op restore stays idempotent rather than advancing generations.
- An injected failed earlier write leaves durable data untouched, remains exportable
  in-session and merges a newer writer's history after retry.
- A Team clear earned by the recorded public command route, not an arranged won
  state, survives the earlier reader and returns to the current Team adapter.

Both versions open the same database name at version1, without schema upgrade.
Four cases deliberately use labelled synthetic storage receipts; only the last
case claims an actual command-earned clear. These local records grant no awards.
The five tests and broader39-test profile/backup/Team-progress/authority/preferences
cohort pass on Node20.19.5 and22.22.2; logs are
`.cache/journey-p15-storage-regression-node{20,22}-r1.tap`. Scoped ESLint, formatting
and diff checks pass. The finite IndexedDB model proves transaction semantics,
not real browser disk behavior, deployed Pages rollback, cache switching or an
unreleased future schema. Those remain separate required gates.

## Whole-reference implementation coverage

The central ledger still described every proposal as unimplemented despite later
campaign declarations. Its status now points to a read-only live audit, while all64
complete source/observation/proposal records remain unchanged. Historical null
implementation placeholders are explicitly distinguished from current projections.

`node scripts/audit-journey-adaptations.mjs` derives its chapter order from the
existing whole-Journey registry. It reads the three early JSON crosswalks and nine
later exported adaptation lists, then resolves actual missions using the shared
compiler. Current result: all48 numbered references have66 explicit adaptation
links across the83-candidate Solo review library; no unknown or uncovered numbered
references. Multiple adaptations and original missions without a screenshot source
are legitimate, not a quota. This does not increase released content.

Every link includes source hash, candidate/map revision, design rationale and all
six Solo/Versus preset identities. Early recorded simulation and reference pins
must match; duplicate links, missing missions, empty rationales and inferred final
approval fail. Later live declarations establish current compilation only, not that
an earlier route log qualifies a changed edition. Incomplete coverage remains
explicit and makes the CLI exit nonzero. There is no publication action.

Three audit tests pass on Node20.19.5 and22.22.2, including full coverage, invalid
link/pin/final-claim rejection, CLI/library parity and unchanged ledger bytes across
inspection. A separate comparison confirms all64 records are structurally identical
to the pre-edit ledger. Scoped code lint/format/diff checks pass; the source ledger's
pre-existing whole-file formatting is retained rather than mechanically rewriting
historical research. Logs: `.cache/journey-p15-adaptations-node{20,22}-r1.tap`.

All64 supplied originals were streamed again from the user-provided reference
directory and matched their stored byte counts and SHA-256 values:393,404,508bytes,
including48 numbered layouts. This is original-byte verification, **not** a new
visual inspection, reference-game behavior claim or human playtest. All48 final
dispositions remain open, with human/art/release qualification separate from this
coverage audit. The machine-readable local report is
`.cache/journey-p15-adaptations-r1.json` and can be regenerated without changing data.

This is infrastructure for honest qualification, not a substitute for playing the
game. Genuine human sessions, physical devices, complete accessibility/performance
checks, Legacy transition, rollback proof, original pending artwork, accepted
composition and public Pages verification remain open. Disk/publication constraints
continue to prohibit bulk builds, art generation and broad hydration in this worktree.
